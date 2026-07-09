package com.lift.domain.lifetransition.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
 * 정부24 혜택 원문(지원대상/선정기준/지원내용)에서 개인정보 기반 매칭에 쓸 구조화 자격조건을
 * AI로 추출한다. 매일 동기화가 "새로 생겼거나 원문이 바뀐" 혜택에 대해서만 호출하므로, 사용자
 * 트래픽과 무관하게 데이터 변경량에만 비용이 묶인다(실시간 판정은 AI를 쓰지 않는다).
 *
 * <p>추출 원칙은 보수적이다. 신청자 <b>본인</b> 기준으로 원문에 <b>명확히</b> 명시된 경우에만 값을
 * 채우고, 불명확·계산필요·타인(자녀 등) 기준이면 null로 둔다. AI는 자격 판정자가 아니라 원문을
 * 구조화하는 역할만 하며, 실제 제외/추천은 서버 규칙({@link Gov24PublicBenefitService})이 한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BenefitCriteriaExtractionService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final RestClient.Builder restClientBuilder;
    private final OpenAiProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ClientHttpRequestFactory requestFactory = createRequestFactory();

    private static ClientHttpRequestFactory createRequestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(15));
        factory.setReadTimeout(Duration.ofSeconds(90));
        return factory;
    }

    public boolean isEnabled() {
        return properties.isAvailable();
    }

    /**
     * raw_json 원문에서 구조화 자격조건을 추출한다. 비활성이거나 호출 실패(크레딧 부족 등)면
     * {@link Optional#empty()}를 돌려줘, 호출자가 값을 채우지 않고 재시도 대상으로 남기게 한다.
     */
    public Optional<ExtractedCriteria> extract(Map<String, Object> rawJson) {
        if (!properties.isAvailable() || rawJson == null) {
            return Optional.empty();
        }

        String title = str(rawJson.get("서비스명"));
        String target = str(rawJson.get("지원대상"));
        String criteria = str(rawJson.get("선정기준"));
        String content = str(rawJson.get("지원내용"));
        if (!StringUtils.hasText(target) && !StringUtils.hasText(criteria)) {
            // 자격을 판단할 원문이 없으면 추출할 것도 없다.
            return Optional.of(ExtractedCriteria.empty());
        }

        try {
            RestClient restClient = restClientBuilder.requestFactory(requestFactory).build();
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", properties.getModel());
            payload.put("reasoning", Map.of("effort", "low"));
            payload.put("input", List.of(
                    Map.of("role", "system", "content", systemPrompt()),
                    Map.of("role", "user", "content", objectMapper.writeValueAsString(Map.of(
                            "서비스명", title,
                            "지원대상", target,
                            "선정기준", criteria,
                            "지원내용", content
                    )))
            ));
            payload.put("text", Map.of("format", responseFormat()));

            String rawBody = restClient.post()
                    .uri(properties.getBaseUrl().replaceAll("/+$", "") + "/responses")
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + properties.getApiKey())
                    .body(payload)
                    .exchange((request, response) -> {
                        String body = new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
                        if (response.getStatusCode().isError()) {
                            log.warn("혜택 구조화 추출 오류 응답 {}: {}", response.getStatusCode(),
                                    body.length() > 300 ? body.substring(0, 300) : body);
                            return null;
                        }
                        return body;
                    });

            if (!StringUtils.hasText(rawBody)) {
                return Optional.empty();
            }
            Map<String, Object> response = objectMapper.readValue(rawBody, MAP_TYPE);
            String text = extractText(response);
            if (!StringUtils.hasText(text)) {
                return Optional.empty();
            }
            Map<String, Object> parsed = objectMapper.readValue(text, MAP_TYPE);
            return Optional.of(toCriteria(parsed));
        } catch (RestClientException | IOException | IllegalArgumentException e) {
            log.warn("혜택 구조화 추출 실패. title={}", title, e);
            return Optional.empty();
        }
    }

    private String systemPrompt() {
        return """
                너는 한국 공공서비스 혜택의 '지원대상/선정기준' 원문을 읽고, 신청자 본인의 자격조건을
                구조화된 JSON으로 추출하는 도구다. 아래 규칙을 반드시 지켜라.
                - 신청자 '본인' 기준만 추출한다. 자녀·배우자·부양가족 등 타인의 나이/조건은 무시하고 null로 둔다.
                - 원문에 '명확히' 적힌 경우에만 값을 채운다. 애매하거나 추정이 필요하면 null로 둔다.
                - minAge/maxAge: 신청자 본인의 나이 자격 상·하한(만 나이). 나이가 '수급 기간'에만 영향을 주거나
                  자격요건이 아니면 null.
                - minInsuranceMonths: 고용보험 최소 가입 개월(예: 180일 → 6). 불명확하면 null.
                - minTenureYears: 최소 근속연수. 불명확하면 null.
                - isInvoluntarySub: 비자발적 이직(계약만료/권고사직/폐업 등)이 자격요건이면 true, 아니면 null.
                - maxAnnualIncomeWon: 연소득 상한을 '원 단위 정수'로. '중위소득 60%'처럼 계산이 필요하거나
                  기준이 불명확하면 null(억지로 계산하지 마라).
                - requiresBasicLivelihood: 기초생활수급자 전용이면 true, 아니면 null.
                - requiresNearPoverty: 차상위계층/저소득 전용이면 true, 아니면 null.
                - requiresSingleParent: 한부모(가정) 전용이면 true, 아니면 null.
                - requiresDisabled: 장애인 전용이면 true, 아니면 null.
                절대 없는 조건을 지어내지 말고, 확실하지 않으면 null을 택하라.
                """;
    }

    private Map<String, Object> responseFormat() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("minAge", nullableType("integer"));
        properties.put("maxAge", nullableType("integer"));
        properties.put("minInsuranceMonths", nullableType("integer"));
        properties.put("minTenureYears", nullableType("integer"));
        properties.put("isInvoluntarySub", nullableType("boolean"));
        properties.put("maxAnnualIncomeWon", nullableType("integer"));
        properties.put("requiresBasicLivelihood", nullableType("boolean"));
        properties.put("requiresNearPoverty", nullableType("boolean"));
        properties.put("requiresSingleParent", nullableType("boolean"));
        properties.put("requiresDisabled", nullableType("boolean"));

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("additionalProperties", false);
        schema.put("required", List.copyOf(properties.keySet()));
        schema.put("properties", properties);

        return Map.of(
                "type", "json_schema",
                "name", "benefit_eligibility_criteria",
                "strict", true,
                "schema", schema
        );
    }

    private Map<String, Object> nullableType(String type) {
        return Map.of("type", List.of(type, "null"));
    }

    private ExtractedCriteria toCriteria(Map<String, Object> row) {
        return new ExtractedCriteria(
                integer(row.get("minAge")),
                integer(row.get("maxAge")),
                integer(row.get("minInsuranceMonths")),
                integer(row.get("minTenureYears")),
                bool(row.get("isInvoluntarySub")),
                longValue(row.get("maxAnnualIncomeWon")),
                bool(row.get("requiresBasicLivelihood")),
                bool(row.get("requiresNearPoverty")),
                bool(row.get("requiresSingleParent")),
                bool(row.get("requiresDisabled"))
        );
    }

    @SuppressWarnings("unchecked")
    private String extractText(Object value) {
        if (value instanceof Map<?, ?> map) {
            Object outputText = map.get("output_text");
            if (outputText instanceof String text && StringUtils.hasText(text)) {
                return text;
            }
            if ("output_text".equals(map.get("type")) && map.get("text") instanceof String s && StringUtils.hasText(s)) {
                return s;
            }
            for (Object child : ((Map<String, Object>) map).values()) {
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

    private Integer integer(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String s && StringUtils.hasText(s)) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Long longValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String s && StringUtils.hasText(s)) {
            try {
                return Long.parseLong(s.trim().replaceAll("[,_]", ""));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Boolean bool(Object value) {
        if (value instanceof Boolean b) {
            return b ? Boolean.TRUE : null; // false는 "조건 없음"과 구분이 없으므로 null로 통일
        }
        return null;
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    /**
     * 추출 결과. 모든 필드는 nullable이며, null은 "해당 조건 없음/불명확"을 뜻한다.
     */
    public record ExtractedCriteria(
            Integer minAge,
            Integer maxAge,
            Integer minInsuranceMonths,
            Integer minTenureYears,
            Boolean isInvoluntarySub,
            Long maxAnnualIncomeWon,
            Boolean requiresBasicLivelihood,
            Boolean requiresNearPoverty,
            Boolean requiresSingleParent,
            Boolean requiresDisabled
    ) {
        public static ExtractedCriteria empty() {
            return new ExtractedCriteria(null, null, null, null, null, null, null, null, null, null);
        }
    }
}
