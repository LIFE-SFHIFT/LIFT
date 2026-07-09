package com.lift.domain.localnotice.service;

import com.lift.domain.localnotice.model.LocalNoticeItem;
import com.lift.domain.localnotice.model.LocalNoticeSource;
import com.lift.domain.localnotice.repository.LocalNoticeItemRepository;
import com.lift.domain.localnotice.repository.LocalNoticeSourceRepository;
import com.lift.domain.localnotice.service.LocalNoticeFeedFetcher.RawFeedItem;
import com.lift.domain.localnotice.service.LocalNoticeRelevanceJudgeService.JudgeResult;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@link LocalNoticeSyncService}의 DB 반영만 담당하는 트랜잭션 경계 빈.
 *
 * <p>동기화 오케스트레이션(RSS 폴링, OpenAI 판단 등 네트워크 I/O)은 {@code LocalNoticeSyncService}가
 * 트랜잭션 <b>밖</b>에서 수행하고, 실제 DB 쓰기만 이 빈의 짧은 {@link Transactional} 메서드로 위임한다.
 * 이렇게 나눈 이유는 두 가지다.
 * <ul>
 *   <li>같은 빈 안에서 {@code @Scheduled} 메서드가 {@code this.syncNow()}를 부르면 Spring AOP 프록시를
 *       거치지 않아 {@code @Transactional}이 통째로 무시된다(자기호출 문제). 그 경우 영속성 컨텍스트가 없어
 *       엔티티 더티체킹 기반 변경(AI 판정 결과 등)이 flush되지 않고 사라진다. 트랜잭션 경계를 별도 빈으로
 *       빼면 어느 경로(스케줄러/수동 트리거)에서 불러도 프록시를 타 트랜잭션이 정상 적용된다.</li>
 *   <li>수 분이 걸릴 수 있는 외부 HTTP 호출(RSS·OpenAI)을 하나의 긴 트랜잭션으로 감싸면 그동안 DB 커넥션을
 *       붙잡아 풀 고갈/타임아웃 위험이 있다. 여기서는 소스 단위·항목 단위로 짧게 커밋한다.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class LocalNoticeSyncPersistence {

    private final LocalNoticeSourceRepository sourceRepository;
    private final LocalNoticeItemRepository itemRepository;

    /** 동기화 대상(활성) 소스 목록. */
    @Transactional(readOnly = true)
    public List<LocalNoticeSource> loadEnabledSources() {
        return sourceRepository.findByEnabledTrue();
    }

    /** 소스 폴링 실패를 기록한다. */
    @Transactional
    public void markSourceFailure(Long sourceId, String message) {
        sourceRepository.findById(sourceId).ifPresent(source -> source.markFetchFailure(message));
    }

    /**
     * 한 소스의 폴링 성공을 기록하고, 그 소스의 원문 항목들을 (소스,guid) 기준으로 UPSERT한다.
     * 네트워크 I/O 없이 짧게 끝나는 하나의 트랜잭션이다.
     */
    @Transactional
    public UpsertCounts persistSourceItems(Long sourceId, List<PreparedFeedItem> items) {
        LocalNoticeSource source = sourceRepository.findById(sourceId).orElse(null);
        if (source == null) {
            return new UpsertCounts(0, 0, 0);
        }
        source.markFetchSuccess();

        int inserted = 0;
        int updated = 0;
        int unchanged = 0;
        for (PreparedFeedItem prepared : items) {
            RawFeedItem raw = prepared.raw();
            Optional<LocalNoticeItem> existing = itemRepository.findBySourceIdAndGuid(sourceId, raw.guid());
            if (existing.isEmpty()) {
                itemRepository.save(LocalNoticeItem.create(
                        source, raw.guid(), raw.title(), raw.link(), raw.summary(), raw.publishedAt(),
                        prepared.contentHash(), prepared.matchedKeyword()
                ));
                inserted++;
            } else {
                LocalNoticeItem item = existing.get();
                if (prepared.contentHash().equals(item.getContentHash())) {
                    unchanged++;
                } else {
                    item.updateRawContent(raw.title(), raw.link(), raw.summary(), raw.publishedAt(),
                            prepared.contentHash(), prepared.matchedKeyword());
                    updated++;
                }
            }
        }
        return new UpsertCounts(inserted, updated, unchanged);
    }

    /** 지금까지 AI 판단을 시도한 누적 건수(비용 상한 집행용). */
    @Transactional(readOnly = true)
    public long countJudged() {
        return itemRepository.countByAiJudgedAtIsNotNull();
    }

    /**
     * 1차 필터를 통과했지만 아직 AI 판단이 안 된 후보를, 판단에 필요한 최소 정보만 담은 가벼운 형태로 읽는다.
     * 엔티티를 트랜잭션 밖으로 들고 나가 detached 상태에서 변경하는 실수를 막기 위해 DTO로 옮겨 반환한다.
     */
    @Transactional(readOnly = true)
    public List<PendingItem> loadPending() {
        return itemRepository.findByMatchedKeywordIsNotNullAndAiJudgedAtIsNull().stream()
                .map(item -> new PendingItem(item.getId(), item.getTitle(), item.getSummary()))
                .toList();
    }

    /** AI 판단 결과 하나를 해당 항목에 반영한다(짧은 트랜잭션). */
    @Transactional
    public void applyVerdict(Long itemId, JudgeResult verdict) {
        itemRepository.findById(itemId).ifPresent(item -> item.applyAiVerdict(
                verdict.isLifecycleSupport(),
                verdict.category(),
                verdict.targetGroupSummary(),
                verdict.supportContentSummary(),
                verdict.reason()
        ));
    }

    /** 오케스트레이터가 UPSERT 전에 미리 계산해 둔(키워드 매칭·해시 포함) 항목. */
    public record PreparedFeedItem(RawFeedItem raw, String contentHash, String matchedKeyword) {
    }

    /** AI 판단 대상 후보의 최소 정보. */
    public record PendingItem(Long id, String title, String summary) {
    }

    /** 한 소스 UPSERT 결과 집계. */
    public record UpsertCounts(int inserted, int updated, int unchanged) {
    }
}
