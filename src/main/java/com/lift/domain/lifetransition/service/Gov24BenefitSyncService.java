package com.lift.domain.lifetransition.service;

import com.lift.domain.lifetransition.model.Gov24BenefitCache;
import com.lift.domain.lifetransition.repository.Gov24BenefitCacheRepository;
import com.lift.domain.lifetransition.service.BenefitCriteriaExtractionService.ExtractedCriteria;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 정부24 혜택 데이터를 매일 동기화한다.
 *
 * <p>동작 순서:
 * <ol>
 *   <li>정부24 serviceList를 조회한다({@link Gov24CatalogClient}).</li>
 *   <li>각 항목의 원문(서비스명·지원대상·선정기준·지원내용)으로 content_hash를 만든다.</li>
 *   <li>서비스ID 기준으로 UPSERT: 신규면 INSERT, 원문 해시가 달라졌으면 UPDATE, 같으면 스킵.</li>
 *   <li>아직 구조화 추출이 안 된 행(criteria_extracted_at IS NULL)만 AI로 자격조건을 추출해 채운다.</li>
 * </ol>
 *
 * <p>AI 호출은 4단계(신규/변경 건)에서만 일어나므로, 사용자 트래픽과 무관하게 데이터 변경량에만
 * 비용이 묶인다. 실시간 리포트 조회는 이 테이블을 읽기만 하고 AI를 호출하지 않는다.
 *
 * <p>스케줄러는 {@code lift.public-data.gov24.sync-enabled=true}일 때만 빈으로 등록된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "lift.public-data.gov24", name = "sync-enabled", havingValue = "true")
public class Gov24BenefitSyncService {

    private final Gov24CatalogClient catalogClient;
    private final Gov24BenefitCacheRepository repository;
    private final BenefitCriteriaExtractionService extractionService;
    private final Gov24PublicServiceProperties properties;

    /** 매일 지정 시각(cron)에 자동 동기화. 기본 09:00. */
    @Scheduled(cron = "${lift.public-data.gov24.sync-cron:0 0 9 * * *}")
    public void scheduledSync() {
        log.info("정부24 혜택 동기화 시작(스케줄).");
        SyncResult result = syncNow();
        log.info("정부24 혜택 동기화 완료(스케줄): {}", result);
    }

    /**
     * 동기화를 즉시 실행한다(수동 트리거/검증용). 결과 요약을 반환한다.
     */
    @Transactional
    public SyncResult syncNow() {
        List<Map<String, Object>> rows;
        try {
            rows = catalogClient.fetchServiceList();
        } catch (RuntimeException e) {
            log.warn("정부24 serviceList 조회 실패. 동기화를 건너뛴다.", e);
            return new SyncResult(0, 0, 0, 0, 0);
        }

        int inserted = 0;
        int updated = 0;
        int unchanged = 0;
        for (Map<String, Object> row : rows) {
            String externalId = str(row.get("서비스ID"));
            if (!StringUtils.hasText(externalId)) {
                continue;
            }
            String title = str(row.get("서비스명"));
            String hash = contentHash(row);

            Optional<Gov24BenefitCache> existing = repository.findByExternalId(externalId);
            if (existing.isEmpty()) {
                repository.save(Gov24BenefitCache.create(externalId, title, row, hash));
                inserted++;
            } else {
                Gov24BenefitCache entity = existing.get();
                if (hash.equals(entity.getContentHash())) {
                    unchanged++;
                } else {
                    entity.updateRawContent(title, row, hash);
                    updated++;
                }
            }
        }

        ExtractSummary extract = runExtraction();
        SyncResult result = new SyncResult(rows.size(), inserted, updated, unchanged, extract.extracted());
        log.info("동기화 결과: 조회 {}건, 신규 {}건, 변경 {}건, 유지 {}건, 구조화추출 {}건(시도 {}건, 중단 {})",
                rows.size(), inserted, updated, unchanged, extract.extracted(), extract.attempted(), extract.abortedEarly());
        return result;
    }

    /**
     * 아직 추출되지 않은 행에 대해 AI 구조화 추출을 수행한다. 배치 상한을 두고,
     * 추출이 시스템적으로 실패(크레딧 부족 등)하면 첫 실패에서 중단해 불필요한 호출을 막는다.
     */
    private ExtractSummary runExtraction() {
        if (!extractionService.isEnabled()) {
            log.info("OpenAI 비활성 상태 — 구조화 추출을 건너뛴다(원문/해시만 갱신).");
            return new ExtractSummary(0, 0, false);
        }

        List<Gov24BenefitCache> pending = repository.findByCriteriaExtractedAtIsNull();
        int limit = Math.max(1, properties.getSyncExtractBatchSize());

        int extracted = 0;
        int attempted = 0;
        boolean abortedEarly = false;
        for (Gov24BenefitCache entity : pending) {
            if (attempted >= limit) {
                break;
            }
            attempted++;
            Optional<ExtractedCriteria> criteria = extractionService.extract(entity.getRawJson());
            if (criteria.isEmpty()) {
                // API 오류/크레딧 부족으로 판단 — 이 행은 추출 미표시로 남겨 다음 동기화에서 재시도.
                // 시스템적 장애일 가능성이 높으므로 이번 실행에서는 추가 호출을 멈춘다.
                abortedEarly = true;
                break;
            }
            ExtractedCriteria c = criteria.get();
            entity.applyExtractedCriteria(
                    c.minAge(), c.maxAge(), c.minInsuranceMonths(), c.minTenureYears(), c.isInvoluntarySub(),
                    c.maxAnnualIncomeWon(), c.requiresBasicLivelihood(), c.requiresNearPoverty(),
                    c.requiresSingleParent(), c.requiresDisabled()
            );
            extracted++;
        }
        return new ExtractSummary(extracted, attempted, abortedEarly);
    }

    /** 원문(서비스명|지원대상|선정기준|지원내용)의 MD5. Postgres md5()와 동일 규칙으로 계산한다. */
    private String contentHash(Map<String, Object> row) {
        String joined = str(row.get("서비스명")) + "|"
                + str(row.get("지원대상")) + "|"
                + str(row.get("선정기준")) + "|"
                + str(row.get("지원내용"));
        try {
            MessageDigest md5 = MessageDigest.getInstance("MD5");
            byte[] digest = md5.digest(joined.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            // MD5는 모든 JVM에 존재하므로 사실상 도달 불가.
            throw new IllegalStateException("MD5 not available", e);
        }
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    /** 동기화 결과 요약. */
    public record SyncResult(int fetched, int inserted, int updated, int unchanged, int extracted) {
    }

    private record ExtractSummary(int extracted, int attempted, boolean abortedEarly) {
    }
}
