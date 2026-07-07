package com.lift.domain.lifetransition.enumtype;

/**
 * 가구 형태(단일 선택). 자녀/부양가족 여부는 가구 형태가 아니라 가구원 정보이므로
 * 별도 boolean 필드(hasDependentChildren, hasSupportingFamily)로 분리해서 관리한다.
 *
 * <p>{@code WITH_CHILDREN}, {@code SUPPORTING_FAMILY}는 분리 이전에 저장된 레거시 값이다.
 * 신규 입력에서는 사용하지 않으며, 조회 시 새 boolean 구조로 매핑해 호환성을 유지한다.
 */
public enum HouseholdType {
    UNKNOWN,
    SINGLE,
    COUPLE,
    OTHER,

    @Deprecated
    WITH_CHILDREN,
    @Deprecated
    SUPPORTING_FAMILY
}
