package com.lift.domain.user.dto.response;

import com.lift.domain.auth.enumtype.AuthNextStep;
import com.lift.domain.user.model.UserAccount;
import java.time.LocalDateTime;

public record UserAgreementResDTO(
        boolean serviceTermsAgreed,
        boolean privacyPolicyAgreed,
        boolean marketingAgreed,
        LocalDateTime agreedAt,
        AuthNextStep nextStep
) {

    public static UserAgreementResDTO from(UserAccount userAccount) {
        return new UserAgreementResDTO(
                userAccount.isServiceTermsAgreed(),
                userAccount.isPrivacyPolicyAgreed(),
                userAccount.isMarketingAgreed(),
                userAccount.getAgreementAgreedAt(),
                userAccount.isLifeTransitionOnboardingCompleted() ? AuthNextStep.HOME : AuthNextStep.TERMS
        );
    }
}
