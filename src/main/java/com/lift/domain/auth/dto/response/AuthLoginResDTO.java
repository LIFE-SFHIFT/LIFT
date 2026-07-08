package com.lift.domain.auth.dto.response;

import com.lift.domain.auth.enumtype.AuthNextStep;
import com.lift.domain.auth.service.AuthTokenService;
import com.lift.domain.user.model.UserAccount;
import java.time.Instant;

public record AuthLoginResDTO(
        Long userId,
        String provider,
        String nickname,
        String tokenType,
        String accessToken,
        String refreshToken,
        Instant accessTokenExpiresAt,
        Instant refreshTokenExpiresAt,
        boolean isNewUser,
        boolean agreementCompleted,
        boolean onboardingCompleted,
        AuthNextStep nextStep
) {

    public static AuthLoginResDTO of(
            UserAccount userAccount,
            AuthTokenService.AuthTokenPair tokenPair,
            boolean isNewUser,
            AuthNextStep nextStep
    ) {
        return new AuthLoginResDTO(
                userAccount.getId(),
                userAccount.getProvider().getPath(),
                userAccount.getNickname(),
                "Bearer",
                tokenPair.accessToken(),
                tokenPair.refreshToken(),
                tokenPair.accessTokenExpiresAt(),
                tokenPair.refreshTokenExpiresAt(),
                isNewUser,
                userAccount.isAgreementCompleted(),
                userAccount.isLifeTransitionOnboardingCompleted(),
                nextStep
        );
    }
}
