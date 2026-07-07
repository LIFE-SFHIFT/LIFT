package com.lift.domain.lifetransition.controller;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 데모 챗봇 엔드포인트 테스트. OpenAI 키가 없는 기본 환경에서도 로그인/결제 없이 200과
 * 리포트 근거 폴백 답변이 오는지 검증한다.
 */
@SpringBootTest(properties = {
        "lift.auth.jwt-secret=test-jwt-secret-32-bytes-minimum-value",
        "lift.openai.enabled=false"
})
@AutoConfigureMockMvc
class DemoReportChatControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void 비로그인_데모_챗은_리포트_근거_폴백_답변을_준다() throws Exception {
        String bodyJson = """
                {
                  "question": "실업급여 얼마나 받을 수 있어요?",
                  "report": {
                    "items": [
                      {
                        "procedureName": "실업급여",
                        "title": "고용24에서 실업급여 수급 자격을 먼저 확인하세요",
                        "eligibilityLevel": "HIGH",
                        "estimate": { "amountLabel": "약 720만원" }
                      }
                    ]
                  }
                }
                """;

        mockMvc.perform(post("/api/ai/report-chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.aiPowered").value(false))
                .andExpect(jsonPath("$.result.answer", containsString("실업급여")));
    }

    @Test
    void 질문이_비어있으면_400() throws Exception {
        mockMvc.perform(post("/api/ai/report-chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("question", ""))))
                .andExpect(status().isBadRequest());
    }
}
