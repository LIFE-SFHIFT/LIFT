package com.lift.domain.lifetransition.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * OpenAI Responses API 호출을 담당하는 공용 클라이언트.
 *
 * <p>키가 없거나(비활성) 호출이 실패하면 {@link Optional#empty()}를 돌려주고, 호출자가
 * 상황에 맞게 처리(500 응답 또는 규칙 기반 폴백)하도록 한다. 실제 리포트 챗봇과 데모 챗봇이
 * 이 클라이언트를 함께 사용한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OpenAiResponsesClient {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final RestClient.Builder restClientBuilder;
    private final OpenAiProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** OpenAI 연동이 켜져 있고 API 키가 준비됐는지 여부. */
    public boolean isEnabled() {
        return properties.isAvailable();
    }

    /**
     * Responses API에 입력 메시지 목록을 보내 답변 텍스트를 받는다.
     *
     * @param input {@link RetirementChatPrompt#input(String)}가 만든 role/content 메시지 목록
     * @return 답변 텍스트. 비활성이거나 실패하면 {@link Optional#empty()}
     */
    public Optional<String> complete(List<Map<String, Object>> input) {
        if (!isEnabled()) {
            return Optional.empty();
        }

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", properties.getModel());
            payload.put("input", input);

            // Spring Boot 4 + Jackson2/3 혼재 환경에서는 응답 미디어 타입이 octet-stream으로
            // 잡혀 메시지 컨버터 선택이 실패한다(Map/String 모두). 그래서 exchange로 원시 응답
            // 스트림을 직접 읽어, 컨버터에 의존하지 않고 우리 ObjectMapper로 파싱한다.
            String rawBody = restClientBuilder.build()
                    .post()
                    .uri(properties.getBaseUrl().replaceAll("/+$", "") + "/responses")
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + properties.getApiKey())
                    .body(payload)
                    .exchange((request, response) -> {
                        String text = new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
                        if (response.getStatusCode().isError()) {
                            log.warn("OpenAI Responses 오류 응답 {}: {}", response.getStatusCode(),
                                    text.length() > 500 ? text.substring(0, 500) : text);
                            return null;
                        }
                        return text;
                    });

            if (!StringUtils.hasText(rawBody)) {
                return Optional.empty();
            }

            Map<String, Object> response = objectMapper.readValue(rawBody, MAP_TYPE);
            String answer = extractText(response);
            return StringUtils.hasText(answer) ? Optional.of(answer.strip()) : Optional.empty();
        } catch (RestClientException | IllegalArgumentException | IOException e) {
            log.warn("OpenAI Responses 호출 실패: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /** Responses API 응답 트리에서 첫 번째 output_text를 재귀적으로 찾아 반환한다. */
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
}
