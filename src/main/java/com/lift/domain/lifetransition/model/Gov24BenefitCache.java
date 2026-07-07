package com.lift.domain.lifetransition.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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
}
