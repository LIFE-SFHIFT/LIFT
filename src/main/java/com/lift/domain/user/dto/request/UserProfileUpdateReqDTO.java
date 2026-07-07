package com.lift.domain.user.dto.request;

import com.lift.domain.lifetransition.enumtype.AnnualIncomeRange;
import com.lift.domain.lifetransition.enumtype.AssetRange;
import com.lift.domain.lifetransition.enumtype.HouseholdType;
import com.lift.domain.lifetransition.enumtype.HousingType;
import jakarta.validation.constraints.Size;

public record UserProfileUpdateReqDTO(
        @Size(max = 20, message = "닉네임은 최대 20자까지 입력 가능합니다.")
        String nickname,

        @Size(max = 20, message = "자녀 이름은 최대 20자까지 입력 가능합니다.")
        String childName,

        String guardianType,

        @Size(max = 50, message = "시/도는 최대 50자까지 입력 가능합니다.")
        String sido,

        @Size(max = 50, message = "시/군/구는 최대 50자까지 입력 가능합니다.")
        String sigungu,

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
