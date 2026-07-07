package com.lift.domain.lifetransition.enumtype;

/**
 * 공공 지원 혜택 후보의 출처.
 */
public enum PublicBenefitSourceType {
    /** 사람이 직접 검증해 큐레이션한 정형 조건 혜택. 현재는 gov24_benefit_cache로 일원화되어 있어 사용되지 않는다. */
    DB,
    /** 공공데이터포털 정부24 공공서비스 Open API에서 실시간 조회한 혜택. */
    GOV24_API
}
