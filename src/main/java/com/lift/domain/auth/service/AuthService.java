package com.lift.domain.auth.service;

import com.lift.domain.auth.dto.response.AuthLoginResDTO;
import com.lift.domain.auth.dto.response.AuthTokenResDTO;
import com.lift.domain.auth.enumtype.AuthNextStep;
import com.lift.domain.auth.enumtype.SocialProvider;
import com.lift.domain.user.model.UserAccount;
import com.lift.domain.user.service.UserAccountStore;
import com.lift.global.apiPayload.code.GeneralErrorCode;
import com.lift.global.apiPayload.exception.ProjectException;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final OAuthProperties oAuthProperties;
    private final UserAccountStore userAccountStore;
    private final AuthTokenService authTokenService;
    private final SocialOAuthClient socialOAuthClient;
    private final OAuthStateStore oAuthStateStore;

    public URI createLoginRedirectUri(SocialProvider provider) {
        requireSocialLoginEnabled();
        OAuthProperties.ProviderRegistration registration = oAuthProperties.getRegistration(provider);
        if (registration == null || !registration.isConfigured()) {
            if (oAuthProperties.isMockEnabled()) {
                return createMockLoginRedirectUri(provider, registration);
            }

            throw new ProjectException(GeneralErrorCode.BAD_REQUEST);
        }

        String redirectUri = resolveRedirectUri(provider, registration);
        String scope = StringUtils.hasText(registration.getScope())
                ? registration.getScope()
                : provider.getDefaultScope();

        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(provider.getAuthorizationUri())
                .queryParam("response_type", "code")
                .queryParam("client_id", registration.getClientId())
                .queryParam("redirect_uri", redirectUri)
                .queryParam("state", oAuthStateStore.issue(provider));

        if (StringUtils.hasText(scope)) {
            builder.queryParam("scope", scope);
        }

        return builder.encode().build().toUri();
    }

    /**
     * 데모 기간에는 실제 카카오/네이버 로그인을 서버에서도 차단한다.
     * 프론트 버튼을 숨겨도 URL 직접 접근으로 우회할 수 있으므로 여기서 최종 방어한다.
     */
    private void requireSocialLoginEnabled() {
        if (!oAuthProperties.isSocialEnabled()) {
            throw new ProjectException(GeneralErrorCode.FORBIDDEN);
        }
    }

    private URI createMockLoginRedirectUri(
            SocialProvider provider,
            OAuthProperties.ProviderRegistration registration
    ) {
        String redirectUri = resolveMockRedirectUri(provider, registration);
        return UriComponentsBuilder.fromUriString(redirectUri)
                .queryParam("code", "mock-" + provider.getPath() + "-login")
                .encode()
                .build()
                .toUri();
    }

    public AuthLoginResDTO loginWithCallback(SocialProvider provider, String code, String state) {
        requireSocialLoginEnabled();
        if (!StringUtils.hasText(code)) {
            throw new ProjectException(GeneralErrorCode.BAD_REQUEST);
        }

        validateState(provider, state);

        SocialUserProfile socialUserProfile = socialOAuthClient.getUserProfile(provider, code, state);
        UserAccountStore.UserCreationResult userCreationResult = userAccountStore.getOrCreateSocialUser(
                provider,
                socialUserProfile.providerUserId(),
                socialUserProfile.email(),
                socialUserProfile.nickname()
        );

        UserAccount userAccount = userCreationResult.userAccount();
        AuthTokenService.AuthTokenPair tokenPair = authTokenService.issueTokens(userAccount.getId());

        return AuthLoginResDTO.of(
                userAccount,
                tokenPair,
                userCreationResult.created(),
                resolveNextStep(userAccount)
        );
    }

    public AuthTokenResDTO refresh(String refreshToken) {
        return AuthTokenResDTO.from(authTokenService.refresh(refreshToken));
    }

    public void logout(String refreshToken) {
        authTokenService.revoke(refreshToken);
    }

    private void validateState(SocialProvider provider, String state) {
        OAuthProperties.ProviderRegistration registration = oAuthProperties.getRegistration(provider);

        // 실제 소셜 연동이 구성된 경우에만 state를 검증한다. (모의 로그인은 리다이렉트 없이 콜백만 호출)
        if (registration != null && registration.isConfigured() && !oAuthStateStore.consume(provider, state)) {
            log.warn("[AUTH] state 검증 실패 provider={} statePresent={}", provider, StringUtils.hasText(state));
            throw new ProjectException(GeneralErrorCode.UNAUTHORIZED);
        }
    }

    private String resolveRedirectUri(SocialProvider provider, OAuthProperties.ProviderRegistration registration) {
        if (StringUtils.hasText(registration.getRedirectUri())) {
            return registration.getRedirectUri();
        }

        return oAuthProperties.getBaseUrl() + "/api/auth/callback/" + provider.getPath();
    }

    private String resolveMockRedirectUri(
            SocialProvider provider,
            OAuthProperties.ProviderRegistration registration
    ) {
        if (registration != null && StringUtils.hasText(registration.getRedirectUri())) {
            return registration.getRedirectUri();
        }

        return oAuthProperties.getFrontendBaseUrl() + "/login/callback/" + provider.getPath();
    }

    private AuthNextStep resolveNextStep(UserAccount userAccount) {
        if (!userAccount.isAgreementCompleted()) {
            return AuthNextStep.TERMS;
        }

        if (!userAccount.isLifeTransitionOnboardingCompleted()) {
            return AuthNextStep.ONBOARDING;
        }

        return AuthNextStep.HOME;
    }
}
