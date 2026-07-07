package com.lift.domain.lifetransition.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
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

    private final RestClient.Builder restClientBuilder;
    private final OpenAiProperties properties;

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

            Map<String, Object> response = restClientBuilder.build()
                    .post()
                    .uri(properties.getBaseUrl().replaceAll("/+$", "") + "/responses")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + properties.getApiKey())
                    .body(payload)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });

            String answer = extractText(response);
            return StringUtils.hasText(answer) ? Optional.of(answer.strip()) : Optional.empty();
        } catch (RestClientException | IllegalArgumentException e) {
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
