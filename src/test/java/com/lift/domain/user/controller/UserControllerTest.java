package com.lift.domain.user.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(properties = {
        "lift.auth.jwt-secret=test-jwt-secret-32-bytes-minimum-value",
        "lift.oauth.mock-enabled=true",
        "lift.oauth.social-enabled=true"
})
@AutoConfigureMockMvc
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private String accessToken;

    @BeforeEach
    void setUp() throws Exception {
        MvcResult loginResult = mockMvc.perform(get("/api/auth/callback/kakao")
                        .param("code", "profile-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andReturn();
        accessToken = readBody(loginResult).at("/result/accessToken").asText();
    }

    @Test
    void 내정보_생활프로필을_저장하고_조회한다() throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("nickname", "새출발");
        request.put("sido", "서울특별시");
        request.put("sigungu", "강남구");
        request.put("householdType", "SINGLE");
        request.put("annualIncomeRange", "UNDER_32M");
        request.put("assetRange", "UNDER_240M");
        request.put("housingType", "MONTHLY_RENT");
        request.put("hasDependentChildren", false);
        request.put("basicLivelihoodRecipient", false);
        request.put("nearPoverty", true);
        request.put("singleParent", false);
        request.put("disabledPerson", false);

        mockMvc.perform(authorized(patch("/api/users/me/profile"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.nickname").value("새출발"))
                .andExpect(jsonPath("$.result.sido").value("서울특별시"))
                .andExpect(jsonPath("$.result.sigungu").value("강남구"))
                .andExpect(jsonPath("$.result.householdType").value("SINGLE"))
                .andExpect(jsonPath("$.result.annualIncomeRange").value("UNDER_32M"))
                .andExpect(jsonPath("$.result.nearPoverty").value(true));

        mockMvc.perform(authorized(get("/api/users/me/profile")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.nickname").value("새출발"))
                .andExpect(jsonPath("$.result.housingType").value("MONTHLY_RENT"))
                .andExpect(jsonPath("$.result.nearPoverty").value(true));
    }

    private MockHttpServletRequestBuilder authorized(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
    }

    private JsonNode readBody(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}
