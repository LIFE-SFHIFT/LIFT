package com.lift.domain.lifetransition.dto.request;

import com.lift.domain.lifetransition.enumtype.ReportPlanType;

/**
 * 빠른 데모 결제 완료 요청. 운영 결제와 동일하게 플랜/금액을 서버에 남긴다.
 */
public record ReportPaymentCompleteReqDTO(
        ReportPlanType plan,
        Integer amount
) {
}
