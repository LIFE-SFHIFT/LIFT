package com.lift.domain.lifetransition.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 정부24 공공서비스 Open API에서 미리 수집해 둔 원본 데이터 캐시.
 * 매 리포트 조회마다 외부 API를 호출하는 대신, 이 테이블에서 읽어와 기존
 * {@link com.lift.domain.lifetransition.service.Gov24PublicBenefitService}의
 * 키워드 매칭·점수 로직을 그대로 적용한다.
 *
 * <p>원본(raw_json) 외에, 개인정보 기반 정밀 매칭을 위한 구조화 자격조건 컬럼을 함께 보관한다.
 * 이 값들은 매일 동기화 시 원문(지원대상/선정기준)을 AI가 읽어 채워 넣으며, 원문에 명확히
 * 명시된 경우에만 값을 두고 불명확하면 null(=조건 없음으로 간주)로 남긴다.
 */
@Entity
@Getter
@Table(name = "gov24_benefit_cache")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Gov24BenefitCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "external_id")
    private String externalId;

    @Column(name = "title")
    private String title;

    /** 정부24 serviceList 원본 응답 한 건을 그대로 JSON으로 보관한다 (Korean 필드명 그대로). */
    @Column(name = "raw_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> rawJson;

    /** 원문(서비스명+지원대상+선정기준+지원내용) 해시. 동기화 시 변경 감지에 쓴다. */
    @Column(name = "content_hash")
    private String contentHash;

    /** 마지막으로 이 원문을 수집(fetch)한 시각. 참고용이며 변경 판단은 content_hash로 한다. */
    @Column(name = "fetched_at")
    private Instant fetchedAt;

    /** AI 구조화 추출을 마친 시각. null이면 아직 추출되지 않은(재시도 대상) 행이다. */
    @Column(name = "criteria_extracted_at")
    private Instant criteriaExtractedAt;

    /**
     * 지원대상/선정기준 원문에서 나이가 "명확한 자격요건"으로 명시된 경우에만 채운 값이다.
     * 나이가 언급되더라도 그것이 신청자 본인이 아닌 대상(자녀 등)이거나, 수급 기간에만 영향을
     * 주거나, 여러 자격 경로가 섞여 하나의 범위로 단순화하면 왜곡되는 경우는 null로 둔다.
     */
    @Column(name = "min_age")
    private Integer minAge;

    @Column(name = "max_age")
    private Integer maxAge;

    @Column(name = "min_insurance_months")
    private Integer minInsuranceMonths;

    @Column(name = "min_tenure_years")
    private Integer minTenureYears;

    @Column(name = "is_involuntary_sub")
    private Boolean isInvoluntarySub;

    /** 연소득 상한(원). 이 값 이하 소득자만 대상. null이면 소득 무관. */
    @Column(name = "max_annual_income_won")
    private Long maxAnnualIncomeWon;

    /** 기초생활수급자 전용 여부. true면 수급자가 아닌 사용자는 대상에서 제외. */
    @Column(name = "requires_basic_livelihood")
    private Boolean requiresBasicLivelihood;

    /** 차상위/저소득 전용 여부(수급자 포함). */
    @Column(name = "requires_near_poverty")
    private Boolean requiresNearPoverty;

    /** 한부모 전용 여부. */
    @Column(name = "requires_single_parent")
    private Boolean requiresSingleParent;

    /** 장애인 전용 여부. */
    @Column(name = "requires_disabled")
    private Boolean requiresDisabled;

    /**
     * 동기화가 새 혜택을 발견했을 때 생성한다. 구조화 컬럼은 이후 AI 추출 단계에서 채운다.
     */
    public static Gov24BenefitCache create(
            String externalId,
            String title,
            Map<String, Object> rawJson,
            String contentHash
    ) {
        Gov24BenefitCache entity = new Gov24BenefitCache();
        entity.externalId = externalId;
        entity.title = title;
        entity.rawJson = rawJson;
        entity.contentHash = contentHash;
        entity.fetchedAt = Instant.now();
        entity.criteriaExtractedAt = null;
        return entity;
    }

    /**
     * 원문이 바뀐 기존 혜택을 갱신한다. 원문이 달라졌으므로 구조화 추출을 다시 하도록
     * {@code criteriaExtractedAt}을 null로 되돌린다(다음 추출 단계의 재시도 대상).
     */
    public void updateRawContent(String title, Map<String, Object> rawJson, String contentHash) {
        this.title = title;
        this.rawJson = rawJson;
        this.contentHash = contentHash;
        this.fetchedAt = Instant.now();
        this.criteriaExtractedAt = null;
    }

    /**
     * AI가 원문에서 뽑아낸 구조화 자격조건을 반영한다. 호출 후 이 행은 추출 완료로 표시된다.
     */
    public void applyExtractedCriteria(
            Integer minAge,
            Integer maxAge,
            Integer minInsuranceMonths,
            Integer minTenureYears,
            Boolean isInvoluntarySub,
            Long maxAnnualIncomeWon,
            Boolean requiresBasicLivelihood,
            Boolean requiresNearPoverty,
            Boolean requiresSingleParent,
            Boolean requiresDisabled
    ) {
        this.minAge = minAge;
        this.maxAge = maxAge;
        this.minInsuranceMonths = minInsuranceMonths;
        this.minTenureYears = minTenureYears;
        this.isInvoluntarySub = isInvoluntarySub;
        this.maxAnnualIncomeWon = maxAnnualIncomeWon;
        this.requiresBasicLivelihood = requiresBasicLivelihood;
        this.requiresNearPoverty = requiresNearPoverty;
        this.requiresSingleParent = requiresSingleParent;
        this.requiresDisabled = requiresDisabled;
        this.criteriaExtractedAt = Instant.now();
    }

    /** 추출이 실패했을 때, 무한 재시도를 막기 위해 시도 시각만 남긴다(값은 그대로 null 유지). */
    public void markExtractionAttempted() {
        this.criteriaExtractedAt = Instant.now();
    }
}
