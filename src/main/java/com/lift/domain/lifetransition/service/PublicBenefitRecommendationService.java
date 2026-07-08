package com.lift.domain.lifetransition.service;

import com.lift.domain.lifetransition.dto.response.PublicBenefitResDTO;
import com.lift.domain.lifetransition.enumtype.PublicBenefitFitLevel;
import com.lift.domain.lifetransition.enumtype.PublicBenefitPriorityGroup;
import com.lift.domain.lifetransition.model.LifeAssessment;
import com.lift.domain.lifetransition.model.LifeReport;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * 공공데이터 후보를 사용자에게 보여줄 순서와 설명으로 다듬는다.
 *
 * AI는 최종 자격 판정자가 아니다. 서버 규칙으로 만든 후보와 근거 안에서만 우선순위,
 * 쉬운 설명, 추가 확인 질문을 정리한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicBenefitRecommendationService {

    private static final int AI_CANDIDATE_LIMIT = 15;

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final RestClient.Builder restClientBuilder;
    private final OpenAiProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();
    // 추론 모델(gpt-5.4-mini)은 응답이 수십 초 걸릴 수 있어, 기본 타임아웃으로는 간헐적으로 실패해
    // heuristic 폴백(aiSummary 없음)으로 빠진다. 넉넉한 타임아웃을 명시한다.
    private final ClientHttpRequestFactory requestFactory = createRequestFactory();

    private static ClientHttpRequestFactory createRequestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(15));
        factory.setReadTimeout(Duration.ofSeconds(90));
        return factory;
    }

    public List<PublicBenefitResDTO> recommend(LifeReport report, List<PublicBenefitResDTO> candidates) {
        List<PublicBenefitResDTO> fallback = heuristic(candidates);
        if (fallback.isEmpty() || !properties.isAvailable()) {
            return fallback;
        }

        try {
            List<AiRecommendation> recommendations = callOpenAi(report, fallback.stream()
                    .limit(AI_CANDIDATE_LIMIT)
                    .toList());
            if (recommendations.isEmpty()) {
                return fallback;
            }
            return applyRecommendations(fallback, recommendations);
        } catch (RestClientException | IOException | IllegalArgumentException e) {
            log.warn("OpenAI public benefit ranking failed. Falling back to heuristic ranking.", e);
            return fallback;
        }
    }

    private List<PublicBenefitResDTO> heuristic(List<PublicBenefitResDTO> candidates) {
        return candidates.stream()
                .sorted(Comparator.comparingInt(PublicBenefitResDTO::relevanceScore).reversed())
                .toList();
    }

    private List<AiRecommendation> callOpenAi(
            LifeReport report,
            List<PublicBenefitResDTO> candidates
    ) throws IOException {
        RestClient restClient = restClientBuilder.requestFactory(requestFactory).build();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", properties.getModel());
        payload.put("reasoning", Map.of("effort", "low"));
        payload.put("input", List.of(
                Map.of(
                        "role", "system",
                        "content", """
                                너는 한국 행정 혜택 추천 랭커다.
                                절대 수급 가능 확정이라고 쓰지 말고, 제공된 JSON 안의 정보만 근거로 삼아라.
                                사용자가 바로 행동할 수 있도록 우선순위, 쉬운 요약, 추가 확인 필요값을 한국어로 정리한다.
                                금액이나 법적 조건을 새로 만들지 말고, 후보 원문에 있는 내용만 요약한다.
                                """
                ),
                Map.of(
                        "role", "user",
                        "content", objectMapper.writeValueAsString(Map.of(
                                "assessment", assessmentContext(report.getAssessment()),
                                "candidates", candidates.stream().map(this::candidateContext).toList()
                        ))
                )
        ));
        payload.put("text", Map.of("format", responseFormat()));

        // Spring Boot 4 + Jackson2/3 혼재 환경에서 응답이 octet-stream으로 잡혀 컨버터 선택이
        // 실패할 수 있어, exchange로 원시 응답을 직접 읽어 ObjectMapper로 파싱한다.
        String rawBody = restClient.post()
                .uri(properties.getBaseUrl().replaceAll("/+$", "") + "/responses")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + properties.getApiKey())
                .body(payload)
                .exchange((httpRequest, httpResponse) -> {
                    String body = new String(httpResponse.getBody().readAllBytes(), StandardCharsets.UTF_8);
                    if (httpResponse.getStatusCode().isError()) {
                        log.warn("OpenAI 공공혜택 랭킹 오류 응답 {}: {}", httpResponse.getStatusCode(),
                                body.length() > 500 ? body.substring(0, 500) : body);
                        return null;
                    }
                    return body;
                });

        if (!StringUtils.hasText(rawBody)) {
            return List.of();
        }
        Map<String, Object> response = objectMapper.readValue(rawBody, MAP_TYPE);
        String text = extractText(response);
        if (!StringUtils.hasText(text)) {
            return List.of();
        }
        Map<String, Object> parsed = objectMapper.readValue(text, new TypeReference<>() {
        });
        Object raw = parsed.get("recommendations");
        if (!(raw instanceof List<?> rows)) {
            return List.of();
        }

        List<AiRecommendation> result = new ArrayList<>();
        for (Object row : rows) {
            if (row instanceof Map<?, ?> map) {
                result.add(toRecommendation(map));
            }
        }
        return result;
    }

    private Map<String, Object> assessmentContext(LifeAssessment assessment) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("eventType", value(assessment.getEventType()));
        context.put("resignationReason", value(assessment.getResignationReason()));
        context.put("nextJobStatus", value(assessment.getNextJobStatus()));
        context.put("nextJobStartDate", text(assessment.getNextJobStartDate()));
        context.put("employmentInsuranceMonths", assessment.getEmploymentInsuranceMonths());
        context.put("currentIncomeStatus", value(assessment.getCurrentIncomeStatus()));
        context.put("regionSido", text(assessment.getRegionSido()));
        context.put("regionSigungu", text(assessment.getRegionSigungu()));
        context.put("age", assessment.getAge());
        context.put("tenureYears", assessment.getTenureYears());
        context.put("householdType", value(assessment.getHouseholdType()));
        context.put("annualIncomeRange", value(assessment.getAnnualIncomeRange()));
        context.put("assetRange", value(assessment.getAssetRange()));
        context.put("housingType", value(assessment.getHousingType()));
        context.put("hasDependentChildren", assessment.getHasDependentChildren());
        context.put("hasSupportingFamily", assessment.getHasSupportingFamily());
        context.put("basicLivelihoodRecipient", assessment.getBasicLivelihoodRecipient());
        context.put("nearPoverty", assessment.getNearPoverty());
        context.put("singleParent", assessment.getSingleParent());
        context.put("disabledPerson", assessment.getDisabledPerson());
        return context;
    }

    private Map<String, Object> candidateContext(PublicBenefitResDTO benefit) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("sourceId", text(benefit.sourceId()));
        context.put("title", text(benefit.title()));
        context.put("provider", text(benefit.provider()));
        context.put("category", text(benefit.category()));
        context.put("matchedKeyword", text(benefit.matchedKeyword()));
        context.put("fitLevel", value(benefit.fitLevel()));
        context.put("priorityGroup", value(benefit.priorityGroup()));
        context.put("reason", text(benefit.reason()));
        context.put("summary", text(benefit.summary()));
        context.put("supportTarget", text(benefit.supportTarget()));
        context.put("selectionCriteria", text(benefit.selectionCriteria()));
        context.put("supportContent", text(benefit.supportContent()));
        context.put("applicationDeadline", text(benefit.applicationDeadline()));
        context.put("applicationMethod", text(benefit.applicationMethod()));
        context.put("requiredDocuments", benefit.requiredDocuments() == null
                ? List.of()
                : benefit.requiredDocuments().stream().map(doc -> doc.documentName()).toList());
        context.put("missingInputs", benefit.missingInputs() == null ? List.of() : benefit.missingInputs());
        context.put("relevanceScore", benefit.relevanceScore());
        return context;
    }

    private Map<String, Object> responseFormat() {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("type", "object");
        item.put("additionalProperties", false);
        item.put("required", List.of("sourceId", "title", "fitLevel", "priorityGroup", "reason", "aiSummary", "missingInputs", "relevanceScore"));
        item.put("properties", Map.of(
                "sourceId", Map.of("type", "string"),
                "title", Map.of("type", "string"),
                "fitLevel", Map.of("type", "string", "enum", List.of("HIGH", "NEEDS_CHECK", "LOW")),
                "priorityGroup", Map.of("type", "string", "enum", List.of("TOP_MONEY", "DEADLINE", "LOCAL", "NEEDS_INFO", "LOW")),
                "reason", Map.of("type", "string", "maxLength", 120),
                "aiSummary", Map.of("type", "string", "maxLength", 180),
                "missingInputs", Map.of("type", "array", "items", Map.of("type", "string"), "maxItems", 5),
                "relevanceScore", Map.of("type", "integer", "minimum", 0, "maximum", 200)
        ));

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("additionalProperties", false);
        schema.put("required", List.of("recommendations"));
        schema.put("properties", Map.of(
                "recommendations", Map.of(
                        "type", "array",
                        "minItems", 0,
                        "maxItems", 8,
                        "items", item
                )
        ));

        return Map.of(
                "type", "json_schema",
                "name", "public_benefit_recommendations",
                "strict", true,
                "schema", schema
        );
    }

    private List<PublicBenefitResDTO> applyRecommendations(
            List<PublicBenefitResDTO> fallback,
            List<AiRecommendation> recommendations
    ) {
        Map<String, PublicBenefitResDTO> byId = new LinkedHashMap<>();
        Map<String, PublicBenefitResDTO> byTitle = new LinkedHashMap<>();
        for (PublicBenefitResDTO benefit : fallback) {
            if (StringUtils.hasText(benefit.sourceId())) {
                byId.put(benefit.sourceId(), benefit);
            }
            byTitle.put(benefit.title(), benefit);
        }

        List<PublicBenefitResDTO> result = new ArrayList<>();
        Set<String> used = new LinkedHashSet<>();
        for (AiRecommendation recommendation : recommendations) {
            PublicBenefitResDTO original = byId.getOrDefault(recommendation.sourceId(), byTitle.get(recommendation.title()));
            if (original == null || used.contains(key(original))) {
                continue;
            }
            result.add(original.withAiRecommendation(
                    recommendation.fitLevel(),
                    recommendation.priorityGroup(),
                    recommendation.reason(),
                    recommendation.aiSummary(),
                    recommendation.missingInputs(),
                    recommendation.relevanceScore() <= 0 ? original.relevanceScore() : recommendation.relevanceScore()
            ));
            used.add(key(original));
        }

        for (PublicBenefitResDTO benefit : fallback) {
            if (!used.contains(key(benefit))) {
                result.add(benefit);
            }
        }
        return result;
    }

    private AiRecommendation toRecommendation(Map<?, ?> row) {
        String sourceId = text(row.get("sourceId"));
        String title = text(row.get("title"));
        PublicBenefitFitLevel fitLevel = enumValue(PublicBenefitFitLevel.class, row.get("fitLevel"), PublicBenefitFitLevel.NEEDS_CHECK);
        PublicBenefitPriorityGroup priorityGroup = enumValue(PublicBenefitPriorityGroup.class, row.get("priorityGroup"), PublicBenefitPriorityGroup.NEEDS_INFO);
        String reason = text(row.get("reason"));
        String aiSummary = text(row.get("aiSummary"));
        List<String> missingInputs = strings(row.get("missingInputs"));
        int relevanceScore = number(row.get("relevanceScore"));
        return new AiRecommendation(sourceId, title, fitLevel, priorityGroup, reason, aiSummary, missingInputs, relevanceScore);
    }

    private String extractText(Object value) {
        if (value instanceof Map<?, ?> map) {
            Object outputText = map.get("output_text");
            if (outputText instanceof String text && StringUtils.hasText(text)) {
                return text;
            }
            Object type = map.get("type");
            Object text = map.get("text");
            if ("output_text".equals(type) && text instanceof String s && StringUtils.hasText(s)) {
                return s;
            }
            for (Object child : map.values()) {
                String found = extractText(child);
                if (StringUtils.hasText(found)) {
                    return found;
                }
            }
        }
        if (value instanceof List<?> list) {
            for (Object child : list) {
                String found = extractText(child);
                if (StringUtils.hasText(found)) {
                    return found;
                }
            }
        }
        return null;
    }

    private <T extends Enum<T>> T enumValue(Class<T> type, Object value, T fallback) {
        try {
            return Enum.valueOf(type, text(value));
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }

    private List<String> strings(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        return list.stream()
                .map(this::text)
                .filter(StringUtils::hasText)
                .limit(5)
                .toList();
    }

    private String key(PublicBenefitResDTO benefit) {
        return StringUtils.hasText(benefit.sourceId()) ? benefit.sourceId() : benefit.title();
    }

    private String value(Enum<?> value) {
        return value == null ? "UNKNOWN" : value.name();
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private int number(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(text(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private record AiRecommendation(
            String sourceId,
            String title,
            PublicBenefitFitLevel fitLevel,
            PublicBenefitPriorityGroup priorityGroup,
            String reason,
            String aiSummary,
            List<String> missingInputs,
            int relevanceScore
    ) {
    }
}
