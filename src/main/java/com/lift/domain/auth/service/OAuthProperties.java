package com.lift.domain.auth.service;

import com.lift.domain.auth.enumtype.SocialProvider;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "lift.oauth")
public class OAuthProperties {

    private String baseUrl = "http://localhost:8080";
    private String frontendBaseUrl = "http://localhost:3000";

    /**
     * true면 client-id가 설정되지 않은 provider에 한해 개발용 모의 로그인을 허용한다.
     * 운영 환경에서는 반드시 false여야 한다.
     */
    private boolean mockEnabled = false;

    private ProviderRegistration kakao = new ProviderRegistration();
    private ProviderRegistration naver = new ProviderRegistration();

    public ProviderRegistration getRegistration(SocialProvider provider) {
        return switch (provider) {
            case KAKAO -> kakao;
            case NAVER -> naver;
        };
    }

    @Getter
    @Setter
    public static class ProviderRegistration {

        private String clientId;
        private String clientSecret;
        private String redirectUri;
        private String scope;
        private String tokenUri;
        private String userInfoUri;

        public boolean isConfigured() {
            return clientId != null && !clientId.isBlank();
        }
    }
}
