package com.lift.domain.lifetransition.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 진단 보완 입력 요청. 나이·근속연수 등 선택 필드만 갱신한다.
 * 최초 생성 시 필수였던 {@link LifeAssessmentCreateReqDTO}의 제약은 그대로 두고,
 * 이 DTO는 값이 있는 필드만 부분 갱신(null은 미변경)한다.
 */
public record LifeAssessmentPatchReqDTO(
        @Min(value = 0, message = "나이는 0 이상이어야 합니다.")
        @Max(value = 120, message = "나이를 확인해주세요.")
        Integer age,

        @Min(value = 0, message = "근속연수는 0 이상이어야 합니다.")
        @Max(value = 60, message = "근속연수를 확인해주세요.")
        Integer tenureYears
) {
}
