package com.lift.domain.lifetransition.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 퇴직 특화 챗봇(리포트 기반) 전송 흐름 재현 테스트.
 * 결제 완료 후 채팅 전송 시 500이 아니라 실제 답변이 오는지 검증한다.
 */
@SpringBootTest(properties = {
        "lift.auth.jwt-secret=test-jwt-secret-32-bytes-minimum-value",
        "lift.oauth.mock-enabled=true"
})
@AutoConfigureMockMvc
class LifeReportChatControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private String login() throws Exception {
        MvcResult loginResult = mockMvc.perform(get("/api/auth/callback/kakao").param("code", "life-mock-code"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .at("/result/accessToken").asText();
    }

    @Test
    void 결제후_채팅_전송시_퇴직_챗봇_답변이_온다() throws Exception {
        String token = login();

        // 진단 → 분석 → 결제
        Map<String, Object> req = new LinkedHashMap<>();
        req.put("eventType", "RETIREMENT");
        req.put("resignationReason", "CONTRACT_EXPIRED");
        req.put("nextJobStatus", "NOT_CONFIRMED");
        req.put("employmentInsuranceMonths", 24);
        req.put("currentIncomeStatus", "NONE");

        MvcResult created = mockMvc.perform(post("/api/life/assessments")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();
        long assessmentId = body(created).at("/result/assessmentId").asLong();

        MvcResult analyzed = mockMvc.perform(post("/api/life/assessments/" + assessmentId + "/analyze")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        long reportId = body(analyzed).at("/result/reportId").asLong();

        mockMvc.perform(post("/api/life/reports/" + reportId + "/payments/mock-complete")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        // 실업급여를 물어보면 500이 아니라 실제 답변이 와야 한다.
        MvcResult chat = mockMvc.perform(post("/api/life/reports/" + reportId + "/chat/messages")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("content", "실업급여는 언제까지 신청해야 하나요?"))))
                .andExpect(status().isOk())
                .andReturn();

        String answer = body(chat).at("/result/aiMessage/content").asText();
        assertThat(answer).contains("실업급여");
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}
