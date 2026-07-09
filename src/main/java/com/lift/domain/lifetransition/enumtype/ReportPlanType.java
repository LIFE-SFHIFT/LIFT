package com.lift.domain.lifetransition.enumtype;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 결제 리포트 플랜. 화면의 가격 선택과 서버의 기능 권한을 같은 값으로 묶는다.
 */
@Getter
@RequiredArgsConstructor
public enum ReportPlanType {

    BASIC(6_900, 0, true, "기본 리포트"),
    PLUS(13_900, 10, true, "확장 리포트");

    private final int price;
    private final int aiQuestionLimit;
    private final boolean pdfAvailable;
    private final String displayName;

    public static ReportPlanType findByPrice(Integer price) {
        if (price == null) {
            return null;
        }

        for (ReportPlanType plan : values()) {
            if (plan.price == price) {
                return plan;
            }
        }
        return null;
    }
}
