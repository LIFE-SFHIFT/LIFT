package com.lift.domain.lifetransition.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * 놓치면손해(생애 전환) 진단·리포트 통합 테스트.
 * 기존 mock 소셜 로그인 흐름으로 토큰을 발급받아 인증된 요청을 수행한다.
 */
@SpringBootTest(properties = {
        "lift.auth.jwt-secret=test-jwt-secret-32-bytes-minimum-value",
        "lift.oauth.mock-enabled=true"
})
@AutoConfigureMockMvc
class LifeAssessmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private String accessToken;

    @BeforeEach
    void setUp() throws Exception {
        MvcResult loginResult = mockMvc.perform(get("/api/auth/callback/kakao")
                        .param("code", "life-mock-code"))
                .andExpect(status().isOk())
                .andReturn();
        accessToken = readBody(loginResult).at("/result/accessToken").asText();
    }

    @Test
    void 진단생성후_분석하면_미리보기를_반환한다() throws Exception {
        long assessmentId = createRetirementAssessment();

        MvcResult analyzeResult = mockMvc.perform(authorized(post("/api/life/assessments/" + assessmentId + "/analyze")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isSuccess").value(true))
                .andExpect(jsonPath("$.result.reportId").isNumber())
                .andExpect(jsonPath("$.result.locked").value(true))
                .andExpect(jsonPath("$.result.paymentStatus").value("UNPAID"))
                .andExpect(jsonPath("$.result.totalItemCount").isNumber())
                .andExpect(jsonPath("$.result.actionableItemCount").isNumber())
                // 월급 없이도 진단 입력만으로 예상 수령액 범위가 계산되어야 한다.
                .andExpect(jsonPath("$.result.expectedAmountRangeLabel", containsString("~")))
                .andExpect(jsonPath("$.result.highlightItems").isArray())
                .andReturn();

        JsonNode preview = readBody(analyzeResult).at("/result");
        // 미리보기에는 하이라이트만 노출되고 전체 항목보다 적어야 한다(잠금).
        assertThat(preview.at("/highlightItems").size()).isLessThanOrEqualTo(2);
        assertThat(preview.at("/totalItemCount").asInt()).isGreaterThanOrEqualTo(preview.at("/highlightItems").size());
        assertThat(preview.at("/actionableItemCount").asInt()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void 미결제_리포트_상세조회는_403으로_차단된다() throws Exception {
        long reportId = analyzeAndGetReportId(createRetirementAssessment());

        mockMvc.perform(authorized(get("/api/life/reports/" + reportId)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.isSuccess").value(false))
                .andExpect(jsonPath("$.code").value("LIFE403_2"));
    }

    @Test
    void 결제_mock완료후_상세리포트가_공개된다() throws Exception {
        long reportId = analyzeAndGetReportId(createRetirementAssessment());

        mockMvc.perform(authorized(post("/api/life/reports/" + reportId + "/payments/mock-complete")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.result.assessmentStatus").value("PAID"));

        mockMvc.perform(authorized(get("/api/life/reports/" + reportId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.result.publicBenefits").isArray())
                .andExpect(jsonPath("$.result.items").isArray())
                .andExpect(jsonPath("$.result.items[0].requiredDocuments").isArray())
                .andExpect(jsonPath("$.result.items[0].officialUrl").isNotEmpty());
    }

    @Test
    void 토스결제_승인은_금액과_주문번호를_먼저_검증한다() throws Exception {
        long reportId = analyzeAndGetReportId(createRetirementAssessment());

        mockMvc.perform(authorized(post("/api/life/reports/" + reportId + "/payments/toss/confirm"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "paymentKey", "test_payment_key",
                                "orderId", "WRONG-" + reportId,
                                "amount", 1000
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LIFE400_2"));
    }

    @Test
    void PDF용_월급입력_여부에_따라_예상금액_버전이_나뉜다() throws Exception {
        long reportId = analyzeAndGetReportId(createRetirementAssessment());

        mockMvc.perform(authorized(post("/api/life/reports/" + reportId + "/payments/mock-complete")))
                .andExpect(status().isOk());

        // 월급이 없어도 실업급여는 법정 하한~상한 일액으로 범위 추정치를 계산한다.
        mockMvc.perform(authorized(post("/api/life/reports/" + reportId + "/pdf-estimate"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.benefitSummary.estimated").value(true))
                .andExpect(jsonPath("$.result.items[0].estimate.kind").value("RECEIVE"))
                .andExpect(jsonPath("$.result.items[0].estimate.amountLabel", containsString("~")));

        mockMvc.perform(authorized(post("/api/life/reports/" + reportId + "/pdf-estimate"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("monthlyAverageWage", 3_000_000))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.benefitSummary.estimated").value(true))
                .andExpect(jsonPath("$.result.benefitSummary.totalReceiveAmount").isNumber())
                .andExpect(jsonPath("$.result.items[0].estimate.amount").isNumber())
                .andExpect(jsonPath("$.result.items[0].estimate.amountLabel").isNotEmpty());
    }

    @Test
    void AI질문은_10회까지만_허용되고_초과시_403이다() throws Exception {
        long reportId = analyzeAndGetReportId(createRetirementAssessment());
        mockMvc.perform(authorized(post("/api/life/reports/" + reportId + "/payments/mock-complete")))
                .andExpect(status().isOk());

        String body = objectMapper.writeValueAsString(Map.of("content", "실업급여는 언제 신청하나요?"));

        for (int i = 1; i <= 10; i++) {
            MvcResult result = mockMvc.perform(authorized(post("/api/life/reports/" + reportId + "/chat/messages"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isOk())
                    .andReturn();
            assertThat(readBody(result).at("/result/aiQuestionUsedCount").asInt()).isEqualTo(i);
        }

        mockMvc.perform(authorized(post("/api/life/reports/" + reportId + "/chat/messages"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("LIFE403_3"));

        // 채팅 이력은 사용자/AI 메시지 각 10건 = 20건이어야 한다.
        mockMvc.perform(authorized(get("/api/life/reports/" + reportId + "/chat/messages")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.aiQuestionUsedCount").value(10))
                .andExpect(jsonPath("$.result.aiQuestionRemaining").value(0))
                .andExpect(jsonPath("$.result.messages.length()").value(20));
    }

    private long createRetirementAssessment() throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("eventType", "RETIREMENT");
        request.put("retirementDate", "2026-06-30");
        request.put("resignationReason", "CONTRACT_EXPIRED");
        request.put("nextJobStatus", "NOT_CONFIRMED");
        request.put("employmentInsuranceMonths", 12);
        request.put("currentIncomeStatus", "NONE");
        request.put("regionSido", "서울특별시");
        request.put("regionSigungu", "강남구");

        MvcResult result = mockMvc.perform(authorized(post("/api/life/assessments"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.status").value("DRAFT"))
                .andReturn();

        return readBody(result).at("/result/assessmentId").asLong();
    }

    private long analyzeAndGetReportId(long assessmentId) throws Exception {
        MvcResult result = mockMvc.perform(authorized(post("/api/life/assessments/" + assessmentId + "/analyze")))
                .andExpect(status().isOk())
                .andReturn();
        return readBody(result).at("/result/reportId").asLong();
    }

    private MockHttpServletRequestBuilder authorized(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
    }

    private JsonNode readBody(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}
