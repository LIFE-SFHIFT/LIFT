package com.lift.domain.auth.service;

import com.lift.domain.auth.enumtype.SocialProvider;
import com.lift.global.apiPayload.code.GeneralErrorCode;
import com.lift.global.apiPayload.exception.ProjectException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
@Component
@RequiredArgsConstructor
public class SocialOAuthClient {

    private static final String BEARER_PREFIX = "Bearer ";

    private final OAuthProperties oAuthProperties;
    private final RestClient.Builder restClientBuilder;

    public SocialUserProfile getUserProfile(SocialProvider provider, String code, String state) {
        if (oAuthProperties.isMockEnabled() && code.startsWith("mock-")) {
            return createDevelopmentProfile(provider, code);
        }

        OAuthProperties.ProviderRegistration registration = oAuthProperties.getRegistration(provider);
        if (registration == null || !registration.isConfigured()) {
            if (oAuthProperties.isMockEnabled()) {
                return createDevelopmentProfile(provider, code);
            }

            throw new ProjectException(GeneralErrorCode.BAD_REQUEST);
        }

        validateTokenExchangeConfiguration(provider, registration);

        Map<String, Object> userInfo = requestProviderUserInfo(provider, registration, code, state);

        if (provider == SocialProvider.NAVER) {
            return parseNaverProfile(userInfo);
        }

        return parseKakaoProfile(userInfo);
    }

    private Map<String, Object> requestProviderUserInfo(
            SocialProvider provider,
            OAuthProperties.ProviderRegistration registration,
            String code,
            String state
    ) {
        try {
            String providerAccessToken = requestProviderAccessToken(provider, registration, code, state);
            return requestUserInfo(provider, registration, providerAccessToken);
        } catch (RestClientException e) {
            log.warn("[AUTH] {} 토큰 교환/사용자 조회 실패: {}", provider, e.getMessage(), e);
            throw new ProjectException(GeneralErrorCode.UNAUTHORIZED);
        }
    }

    private void validateTokenExchangeConfiguration(
            SocialProvider provider,
            OAuthProperties.ProviderRegistration registration
    ) {
        if (provider.isClientSecretRequired() && !StringUtils.hasText(registration.getClientSecret())) {
            throw new ProjectException(GeneralErrorCode.BAD_REQUEST);
        }
    }

    private String requestProviderAccessToken(
            SocialProvider provider,
            OAuthProperties.ProviderRegistration registration,
            String code,
            String state
    ) {
        MultiValueMap<String, String> requestBody = new LinkedMultiValueMap<>();
        requestBody.add("grant_type", "authorization_code");
        requestBody.add("client_id", registration.getClientId());
        requestBody.add("redirect_uri", resolveRedirectUri(provider, registration));
        requestBody.add("code", code);

        if (StringUtils.hasText(state)) {
            requestBody.add("state", state);
        }

        if (StringUtils.hasText(registration.getClientSecret())) {
            requestBody.add("client_secret", registration.getClientSecret());
        }

        Map<String, Object> tokenResponse = restClientBuilder.build()
                .post()
                .uri(resolveTokenUri(provider, registration))
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(requestBody)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });

        Object accessToken = tokenResponse == null ? null : tokenResponse.get("access_token");
        if (!(accessToken instanceof String token) || token.isBlank()) {
            // 응답 본문에는 토큰이 포함될 수 있어 error 코드만 남긴다.
            Object error = tokenResponse == null ? null : tokenResponse.get("error");
            log.warn("[AUTH] {} 토큰 응답에 access_token 없음. error={}", provider, error);
            throw new ProjectException(GeneralErrorCode.UNAUTHORIZED);
        }

        return token;
    }

    private Map<String, Object> requestUserInfo(
            SocialProvider provider,
            OAuthProperties.ProviderRegistration registration,
            String providerAccessToken
    ) {
        return restClientBuilder.build()
                .get()
                .uri(resolveUserInfoUri(provider, registration))
                .header(HttpHeaders.AUTHORIZATION, BEARER_PREFIX + providerAccessToken)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
    }

    private SocialUserProfile parseKakaoProfile(Map<String, Object> userInfo) {
        if (userInfo == null || userInfo.get("id") == null) {
            throw new ProjectException(GeneralErrorCode.UNAUTHORIZED);
        }

        Map<String, Object> kakaoAccount = mapValue(userInfo.get("kakao_account"));
        Map<String, Object> profile = mapValue(kakaoAccount.get("profile"));
        Map<String, Object> properties = mapValue(userInfo.get("properties"));

        String providerUserId = String.valueOf(userInfo.get("id"));
        String email = stringValue(kakaoAccount.get("email"));
        String nickname = firstText(
                stringValue(profile.get("nickname")),
                stringValue(properties.get("nickname")),
                defaultNickname(SocialProvider.KAKAO)
        );

        return new SocialUserProfile(providerUserId, email, nickname);
    }

    private SocialUserProfile parseNaverProfile(Map<String, Object> userInfo) {
        if (userInfo == null) {
            throw new ProjectException(GeneralErrorCode.UNAUTHORIZED);
        }

        Map<String, Object> response = mapValue(userInfo.get("response"));
        if (response.isEmpty()) {
            throw new ProjectException(GeneralErrorCode.UNAUTHORIZED);
        }

        String providerUserId = stringValue(response.get("id"));
        if (!StringUtils.hasText(providerUserId)) {
            throw new ProjectException(GeneralErrorCode.UNAUTHORIZED);
        }

        return new SocialUserProfile(
                providerUserId,
                stringValue(response.get("email")),
                firstText(stringValue(response.get("nickname")), defaultNickname(SocialProvider.NAVER))
        );
    }

    private SocialUserProfile createDevelopmentProfile(SocialProvider provider, String code) {
        String stableId = UUID.nameUUIDFromBytes((provider.getPath() + ":" + code).getBytes(StandardCharsets.UTF_8))
                .toString();

        return new SocialUserProfile(
                stableId,
                provider.getPath() + "_" + stableId.substring(0, 8) + "@" + provider.getPath() + ".com",
                defaultNickname(provider)
        );
    }

    private String defaultNickname(SocialProvider provider) {
        return switch (provider) {
            case KAKAO -> "살림 챙김러";
            case NAVER -> "로드맵 탐색가";
        };
    }

    private String resolveRedirectUri(
            SocialProvider provider,
            OAuthProperties.ProviderRegistration registration
    ) {
        if (StringUtils.hasText(registration.getRedirectUri())) {
            return registration.getRedirectUri();
        }

        return oAuthProperties.getBaseUrl() + "/api/auth/callback/" + provider.getPath();
    }

    private Map<String, Object> mapValue(Object value) {
        if (!(value instanceof Map<?, ?> map)) {
            return Map.of();
        }

        Map<String, Object> converted = new java.util.LinkedHashMap<>();
        map.forEach((key, mapValue) -> {
            if (key instanceof String stringKey) {
                converted.put(stringKey, mapValue);
            }
        });

        return converted;
    }

    private String resolveTokenUri(SocialProvider provider, OAuthProperties.ProviderRegistration registration) {
        return StringUtils.hasText(registration.getTokenUri())
                ? registration.getTokenUri()
                : provider.getTokenUri();
    }

    private String resolveUserInfoUri(SocialProvider provider, OAuthProperties.ProviderRegistration registration) {
        return StringUtils.hasText(registration.getUserInfoUri())
                ? registration.getUserInfoUri()
                : provider.getUserInfoUri();
    }

    private String stringValue(Object value) {
        return value instanceof String string ? string : null;
    }

    private String firstText(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }

        return null;
    }
}
