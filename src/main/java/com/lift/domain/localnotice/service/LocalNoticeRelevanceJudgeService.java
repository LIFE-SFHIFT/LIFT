package com.lift.domain.localnotice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lift.domain.lifetransition.service.OpenAiProperties;
import jakarta.annotation.PostConstruct;
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
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * RSS로 걸러진 "후보" 공고(제목에 키워드가 있는 것만)의 요약을 AI에 보내, 실제로 생애주기별
 * 지원사업/장려금인지 맥락적으로 판단한다.
 *
 * <p>1차 필터(제목 키워드 매칭)는 코드가 처리하고, "신청 대상과 지원 내용이 실제로 있는지" 같은
 * 맥락 판단만 이 서비스가 담당한다. 신규/변경된 후보에만 호출되므로({@code aiJudgedAt IS NULL}인
 * 행만 배치 대상) 사용자 트래픽과 무관하게 "제목 키워드가 걸린 신규 공고 수"에만 비용이 묶인다.
 *
 * <p>{@link com.lift.domain.lifetransition.service.BenefitCriteriaExtractionService}와 동일하게
 * {@link OpenAiProperties} 기반 Responses API를 재사용한다(신규 API 키/의존성 불필요). 역할은
 * "구조화 추출"이 아니라 "참/거짓 분류"라는 점만 다르다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LocalNoticeRelevanceJudgeService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final RestClient.Builder restClientBuilder;
    private final OpenAiProperties properties;

    /** 타임아웃 고정 RestClient. 호출마다 새로 build하지 않고 한 번만 구성해 재사용한다. */
    private RestClient restClient;

    @PostConstruct
    void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(15));
        factory.setReadTimeout(Duration.ofSeconds(60));
        this.restClient = restClientBuilder.requestFactory(factory).build();
    }

    /** ObjectMapper는 Spring 자동 설정으로 Bean이 제공되므로, 호출할 때마다 새로 만들지 않는다. */
    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isEnabled() {
        return properties.isAvailable();
    }

    /**
     * 제목/요약을 보고 참/거짓 판단을 시도한다. 비활성이거나 호출 실패(크레딧 부족 등)면
     * {@link Optional#empty()}를 돌려줘, 호출자가 값을 채우지 않고 재시도 대상으로 남기게 한다.
     */
    public Optional<JudgeResult> judge(String title, String summary) {
        if (!properties.isAvailable() || !StringUtils.hasText(title)) {
            return Optional.empty();
        }

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", properties.getModel());
            payload.put("reasoning", Map.of("effort", "low"));
            payload.put("input", List.of(
                    Map.of("role", "system", "content", systemPrompt()),
                    Map.of("role", "user", "content", objectMapper.writeValueAsString(Map.of(
                            "제목", title,
                            "요약", summary == null ? "" : summary
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
                            log.warn("지자체 공고 관련성 판단 오류 응답 {}: {}", response.getStatusCode(),
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
            return Optional.of(toResult(parsed));
        } catch (RestClientException | IOException | IllegalArgumentException e) {
            log.warn("지자체 공고 관련성 판단 실패. title={}", title, e);
            return Optional.empty();
        }
    }

    private String systemPrompt() {
        return """
                너는 한국 지자체 홈페이지 게시판(고시/공고/새소식)에서 수집한 공고의 제목과 요약을 읽고,
                이 공고가 '생애주기별 지원사업 또는 장려금'에 해당하는지를 판단하는 도구다.
                아래 규칙을 반드시 지켜라.
                - isLifecycleSupport: 청년/출산/육아/노인/장애인/한부모/저소득 등 특정 생애주기·계층을 대상으로
                  금전(지원금·장려금·바우처·수당 등) 또는 실질적 혜택(감면·대출·서비스 이용권 등)을 제공하는
                  '신청 가능한' 사업이면 true. 인사·행정예고, 입찰·계약, 시설 공사, 채용공고, 단순 홍보성
                  행사 안내처럼 개인이 신청해서 받는 지원이 아니면 false.
                - 제목/요약만으로 신청 대상이나 지원 내용을 전혀 알 수 없어 판단이 불가능하면 isLifecycleSupport는
                  false로 두고 reason에 그 이유를 적어라(추측해서 true로 채우지 마라).
                - category: isLifecycleSupport가 true일 때만 아래 중 원문에 명확히 드러나는 하나를 고른다.
                  청년/출산/육아/노인/장애인/기타. 애매하면 기타.
                - targetGroupSummary: 신청 대상을 원문에 적힌 대로 한두 문장으로 요약. 원문에 없으면 null.
                - supportContentSummary: 지원 내용(금액/혜택)을 원문에 적힌 대로 한두 문장으로 요약. 원문에 없으면 null.
                - reason: 판단 근거를 한 문장으로. 항상 채운다(참/거짓 모두).
                절대 없는 내용을 지어내지 말고, 원문에 없으면 null을 택하라.
                """;
    }

    private Map<String, Object> responseFormat() {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("isLifecycleSupport", Map.of("type", "boolean"));
        props.put("category", nullableType("string"));
        props.put("targetGroupSummary", nullableType("string"));
        props.put("supportContentSummary", nullableType("string"));
        props.put("reason", Map.of("type", "string"));

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("additionalProperties", false);
        schema.put("required", List.copyOf(props.keySet()));
        schema.put("properties", props);

        return Map.of(
                "type", "json_schema",
                "name", "local_notice_relevance_verdict",
                "strict", true,
                "schema", schema
        );
    }

    private Map<String, Object> nullableType(String type) {
        return Map.of("type", List.of(type, "null"));
    }

    private JudgeResult toResult(Map<String, Object> row) {
        boolean verdict = Boolean.TRUE.equals(row.get("isLifecycleSupport"));
        return new JudgeResult(
                verdict,
                str(row.get("category")),
                str(row.get("targetGroupSummary")),
                str(row.get("supportContentSummary")),
                str(row.get("reason"))
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

    private String str(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    /** AI 판단 결과. {@code isLifecycleSupport}가 false여도 {@code reason}은 항상 채워진다. */
    public record JudgeResult(
            boolean isLifecycleSupport,
            String category,
            String targetGroupSummary,
            String supportContentSummary,
            String reason
    ) {
    }
}
