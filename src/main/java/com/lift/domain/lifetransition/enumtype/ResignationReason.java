package com.lift.domain.lifetransition.enumtype;

/**
 * 퇴직/이직 사유. 실업급여 자격 판단의 핵심 입력값이다.
 */
public enum ResignationReason {
    CONTRACT_EXPIRED,
    RECOMMENDED_RESIGNATION,
    MANDATORY_RETIREMENT,
    PERSONAL_REASON,
    FIRED,
    COMPANY_CLOSURE,
    UNKNOWN
}
