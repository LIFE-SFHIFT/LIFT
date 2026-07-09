package com.lift.domain.auth.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 데모 기간 기본값(lift.oauth.social-enabled=false)에서는 카카오/네이버 로그인 진입점과
 * 콜백이 모두 403으로 차단되는지 검증한다. 프론트 버튼을 우회한 직접 URL 접근 방어.
 */
@SpringBootTest(properties = {
        "lift.auth.jwt-secret=test-jwt-secret-32-bytes-minimum-value",
        "lift.oauth.mock-enabled=true"
})
@AutoConfigureMockMvc
class AuthSocialLoginDisabledTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void 소셜로그인_스위치가_꺼져있으면_로그인_리다이렉트가_403이다() throws Exception {
        mockMvc.perform(get("/api/auth/login/kakao"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("COMMON403_1"));

        mockMvc.perform(get("/api/auth/login/naver"))
                .andExpect(status().isForbidden());
    }

    @Test
    void 소셜로그인_스위치가_꺼져있으면_콜백도_403이다() throws Exception {
        mockMvc.perform(get("/api/auth/callback/kakao").param("code", "any-code"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("COMMON403_1"));
    }
}
