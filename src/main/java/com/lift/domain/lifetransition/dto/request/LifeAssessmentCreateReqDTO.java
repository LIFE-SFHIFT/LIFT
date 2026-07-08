package com.lift.domain.lifetransition.dto.request;

import com.lift.domain.lifetransition.enumtype.CurrentIncomeStatus;
import com.lift.domain.lifetransition.enumtype.AnnualIncomeRange;
import com.lift.domain.lifetransition.enumtype.AssetRange;
import com.lift.domain.lifetransition.enumtype.HouseholdType;
import com.lift.domain.lifetransition.enumtype.HousingType;
import com.lift.domain.lifetransition.enumtype.LifeEventType;
import com.lift.domain.lifetransition.enumtype.NextJobStatus;
import com.lift.domain.lifetransition.enumtype.ResignationReason;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 생애 이벤트 진단 생성 요청.
 * 이벤트에 따라 선택 입력이 달라지므로 eventType만 필수로 두고 나머지는 선택으로 받는다.
 */
public record LifeAssessmentCreateReqDTO(
        @NotNull(message = "생애 이벤트 유형은 필수입니다.")
        LifeEventType eventType,

        LocalDate retirementDate,

        ResignationReason resignationReason,

        NextJobStatus nextJobStatus,

        LocalDate nextJobStartDate,

        @Min(value = 0, message = "고용보험 가입 개월 수는 0 이상이어야 합니다.")
        @Max(value = 600, message = "고용보험 가입 개월 수를 확인해주세요.")
        Integer employmentInsuranceMonths,

        CurrentIncomeStatus currentIncomeStatus,

        @NotBlank(message = "시/도는 필수입니다.")
        @Size(max = 50, message = "시/도는 최대 50자까지 입력 가능합니다.")
        String regionSido,

        @NotBlank(message = "시/군/구는 필수입니다.")
        @Size(max = 50, message = "시/군/구는 최대 50자까지 입력 가능합니다.")
        String regionSigungu,

        @Min(value = 0, message = "월 평균임금은 0 이상이어야 합니다.")
        @Max(value = 100_000_000, message = "월 평균임금을 확인해주세요.")
        Integer monthlyAverageWage,

        @NotNull(message = "나이는 필수입니다.")
        @Min(value = 0, message = "나이는 0 이상이어야 합니다.")
        @Max(value = 120, message = "나이를 확인해주세요.")
        Integer age,

        @Min(value = 0, message = "근속연수는 0 이상이어야 합니다.")
        @Max(value = 60, message = "근속연수를 확인해주세요.")
        Integer tenureYears,

        HouseholdType householdType,

        AnnualIncomeRange annualIncomeRange,

        AssetRange assetRange,

        HousingType housingType,

        Boolean hasDependentChildren,

        Boolean hasSupportingFamily,

        Boolean basicLivelihoodRecipient,

        Boolean nearPoverty,

        Boolean singleParent,

        Boolean disabledPerson
) {
}
