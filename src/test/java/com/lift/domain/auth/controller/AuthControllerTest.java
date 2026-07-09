package com.lift.domain.auth.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lift.domain.auth.repository.OAuthStateRepository;
import com.lift.domain.auth.repository.RefreshTokenSessionRepository;
import com.lift.domain.user.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = {
        "lift.auth.jwt-secret=test-jwt-secret-32-bytes-minimum-value",
        "lift.oauth.mock-enabled=true",
        "lift.oauth.social-enabled=true",
        "lift.oauth.naver.client-id=test-naver-client",
        "lift.oauth.naver.client-secret=test-naver-secret"
})
@AutoConfigureMockMvc
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Autowired
    private RefreshTokenSessionRepository refreshTokenSessionRepository;

    @Autowired
    private OAuthStateRepository oAuthStateRepository;

    @BeforeEach
    void setUp() {
        refreshTokenSessionRepository.deleteAll();
        oAuthStateRepository.deleteAll();
        userAccountRepository.deleteAll();
    }

    @Test
    void mockCallbackIssuesTokenThatAuthenticatesProtectedEndpoint() throws Exception {
        MvcResult loginResult = mockMvc.perform(get("/api/auth/callback/kakao")
                        .param("code", "mock-code"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.result.refreshToken").isNotEmpty())
                .andReturn();

        JsonNode loginBody = readBody(loginResult);
        String accessToken = loginBody.at("/result/accessToken").asText();

        mockMvc.perform(get("/api/users/me/summary")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.userId").isNumber())
                .andExpect(jsonPath("$.result.provider").value("KAKAO"));
    }

    @Test
    void refreshRotatesRefreshTokenAndRejectsOldToken() throws Exception {
        JsonNode loginBody = readBody(mockMvc.perform(get("/api/auth/callback/kakao")
                        .param("code", "refresh-code"))
                .andExpect(status().isOk())
                .andReturn());
        String refreshToken = loginBody.at("/result/refreshToken").asText();

        String refreshBody = objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken));
        MvcResult refreshResult = mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(refreshBody))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode refreshedBody = readBody(refreshResult);
        assertThat(refreshedBody.at("/result/refreshToken").asText()).isNotEqualTo(refreshToken);

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(refreshBody))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginRedirectForConfiguredProviderIncludesState() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/login/naver"))
                .andExpect(status().isFound())
                .andReturn();

        String location = result.getResponse().getHeader(HttpHeaders.LOCATION);
        assertThat(location)
                .startsWith("https://nid.naver.com/oauth2.0/authorize")
                .contains("client_id=test-naver-client")
                .contains("state=");
    }

    @Test
    void loginRedirectForMockProviderGoesToFrontendCallback() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/login/kakao"))
                .andExpect(status().isFound())
                .andReturn();

        String location = result.getResponse().getHeader(HttpHeaders.LOCATION);
        assertThat(location)
                .startsWith("http://localhost:3000/login/callback/kakao")
                .contains("code=mock-kakao-login");
    }

    @Test
    void configuredProviderCallbackWithoutStateIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/auth/callback/naver")
                        .param("code", "provider-code"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidProviderIsBadRequest() throws Exception {
        mockMvc.perform(get("/api/auth/callback/google")
                        .param("code", "provider-code"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void malformedRefreshBodyIsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("잘못된 요청입니다."))
                .andExpect(jsonPath("$.result").doesNotExist());
    }

    private JsonNode readBody(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}
