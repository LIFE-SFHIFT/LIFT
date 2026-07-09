package com.lift.global.config;

import com.lift.global.auth.ApiAccessDeniedHandler;
import com.lift.global.auth.ApiAuthenticationEntryPoint;
import com.lift.global.auth.BearerTokenAuthenticationFilter;
import java.util.Arrays;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@EnableWebSecurity
@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final BearerTokenAuthenticationFilter bearerTokenAuthenticationFilter;
    private final ApiAuthenticationEntryPoint apiAuthenticationEntryPoint;
    private final ApiAccessDeniedHandler apiAccessDeniedHandler;

    // 프론트엔드(Next.js) 개발 서버 등 허용할 오리진. 콤마로 구분한다.
    @Value("${lift.cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}")
    private String allowedOrigins;

    private final String[] allowUris = {
            // Swagger 허용
            "/swagger-ui/**",
            "/swagger-resources/**",
            "/v3/api-docs/**",
            "/api/auth/login/**",
            "/api/auth/callback/**",
            "/api/auth/refresh",
            // access token이 만료된 상태에서도 refresh token 폐기가 가능해야 한다.
            "/api/auth/logout",
            "/api/terms/**",
            // 데모(비로그인) 체험용 퇴직 챗봇. 리포트는 요청 본문으로 받는다.
            "/api/ai/report-chat",
            // 커뮤니티는 데모 로그인도 공유 게시판에 글을 남길 수 있도록 허용한다.
            // 로그인 사용자는 필터가 세팅한 Authentication으로 본인 계정에 귀속되고,
            // 비로그인(데모) 요청은 서비스에서 공유 데모 계정으로 저장된다.
            "/api/community/**",
            // 지자체 RSS 파이프라인이 확정한 지역 지원사업/장려금 공개 조회(확정 공고만, 읽기 전용).
            // 데모(비로그인) 사용자도 지역 혜택을 볼 수 있도록 커뮤니티 조회와 동일하게 허용한다.
            "/api/local-notices/**"
            // NOTE: 내부 파이프라인 트리거/덤프용 /api/internal/local-notices/** 는 여기에 넣지 않는다.
            // 인증 없이 열면 외부인이 POST /sync 로 OpenAI 판단 호출(=비용)을 태울 수 있어,
            // permitAll에서 제외해 anyRequest().authenticated() 로 떨어뜨린다(유효 토큰 필수).
            // 관리자 롤이 생기면 그때 롤 기반 인가로 좁힌다.
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(allowUris).permitAll()
                        .anyRequest().authenticated()
                )
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(apiAuthenticationEntryPoint)
                        .accessDeniedHandler(apiAccessDeniedHandler)
                )
                .addFilterBefore(bearerTokenAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();
        // '*'가 포함된 항목(예: 로컬 개발용 http://localhost:*)은 패턴으로, 나머지는 정확 매칭으로 등록한다.
        // allowCredentials(true)와 함께 와일드카드를 쓰려면 allowedOrigins가 아니라 allowedOriginPatterns여야 한다.
        List<String> exactOrigins = origins.stream().filter(o -> !o.contains("*")).toList();
        List<String> originPatterns = origins.stream().filter(o -> o.contains("*")).toList();
        if (!exactOrigins.isEmpty()) {
            configuration.setAllowedOrigins(exactOrigins);
        }
        if (!originPatterns.isEmpty()) {
            configuration.setAllowedOriginPatterns(originPatterns);
        }
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
