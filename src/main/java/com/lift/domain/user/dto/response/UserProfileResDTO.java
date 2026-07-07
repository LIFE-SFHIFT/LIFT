package com.lift.domain.user.dto.response;

import com.lift.domain.lifetransition.enumtype.AnnualIncomeRange;
import com.lift.domain.lifetransition.enumtype.AssetRange;
import com.lift.domain.lifetransition.enumtype.HouseholdType;
import com.lift.domain.lifetransition.enumtype.HousingType;
import com.lift.domain.user.model.UserAccount;
import java.util.List;

public record UserProfileResDTO(
        Long userId,
        String nickname,
        String email,
        String provider,
        String childName,
        Integer childBirthYear,
        Integer childBirthMonth,
        List<String> careAreas,
        String characteristicKeyword,
        List<String> interests,
        String sido,
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
        Boolean disabledPerson,
        String guardianNickname,
        String guardianType,
        String communityRoleType
) {

    public static UserProfileResDTO from(UserAccount userAccount) {
        return new UserProfileResDTO(
                userAccount.getId(),
                userAccount.getNickname(),
                userAccount.getEmail(),
                userAccount.getProvider().getPath(),
                userAccount.getChildName(),
                userAccount.getChildBirthYear(),
                userAccount.getChildBirthMonth(),
                userAccount.getCareAreas(),
                userAccount.getCharacteristicKeyword(),
                userAccount.getInterests(),
                userAccount.getSido(),
                userAccount.getSigungu(),
                userAccount.getHouseholdType(),
                userAccount.getAnnualIncomeRange(),
                userAccount.getAssetRange(),
                userAccount.getHousingType(),
                userAccount.getHasDependentChildren(),
                userAccount.getHasSupportingFamily(),
                userAccount.getBasicLivelihoodRecipient(),
                userAccount.getNearPoverty(),
                userAccount.getSingleParent(),
                userAccount.getDisabledPerson(),
                userAccount.getGuardianNickname(),
                userAccount.getGuardianType(),
                userAccount.getCommunityRoleType()
        );
    }
}
