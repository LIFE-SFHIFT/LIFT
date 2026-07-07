package com.lift.domain.lifetransition.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lift.domain.lifetransition.dto.response.DemoReportChatResDTO;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 데모 체험용 챗봇. 서버에 저장된 리포트가 없는 데모 모드에서, 프론트가 보낸 리포트 JSON을 근거로
 * OpenAI에 질문한다. OpenAI 키가 없거나 호출이 실패하면 리포트 요약 기반 폴백 답변을 준다.
 *
 * <p>결제 완료 리포트 챗봇({@link OpenAiLifeReportAiService})과 동일한 퇴직 특화 프롬프트
 * ({@link RetirementChatPrompt})를 사용해 말투·가드레일을 일치시킨다.
 *
 * <p>report는 임의 JSON이라 {@link Object}(JSON object→Map, array→List)로 다뤄 Jackson 버전에 의존하지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DemoReportChatService {

    private final OpenAiResponsesClient openAiResponsesClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DemoReportChatResDTO answer(String question, Object report) {
        String trimmed = question == null ? "" : question.strip();

        if (openAiResponsesClient.isEnabled()) {
            Optional<String> aiAnswer = callOpenAi(trimmed, report);
            if (aiAnswer.isPresent()) {
                return new DemoReportChatResDTO(aiAnswer.get(), true);
            }
        }
        return new DemoReportChatResDTO(fallbackAnswer(report), false);
    }

    private Optional<String> callOpenAi(String question, Object report) {
        try {
            Map<String, Object> userContent = new LinkedHashMap<>();
            userContent.put("question", question);
            if (report != null) {
                userContent.put("report", report);
            }
            String userJson = objectMapper.writeValueAsString(userContent);
            return openAiResponsesClient.complete(RetirementChatPrompt.input(userJson));
        } catch (JsonProcessingException e) {
            log.warn("데모 챗 payload 직렬화 실패.", e);
            return Optional.empty();
        }
    }

    /** OpenAI가 없을 때, 프론트가 보낸 리포트 JSON의 항목을 요약해 근거 기반으로 안내한다. */
    private String fallbackAnswer(Object report) {
        List<?> items = items(report);
        if (items == null || items.isEmpty()) {
            return "퇴직 후 챙길 실업급여·퇴직금·건강보험·국민연금·세금 정산 중 궁금한 걸 물어보세요. "
                    + "정확한 자격·금액·기한은 관할 기관에서 확인하는 게 좋아요.";
        }

        StringBuilder sb = new StringBuilder("리포트 기준으로 지금 챙길 항목을 정리해 드릴게요.\n");
        int no = 1;
        for (Object raw : items) {
            String name = str(raw, "procedureName");
            if (name == null) {
                name = str(raw, "title");
            }
            sb.append(no++).append(". ").append(name == null ? "항목" : name)
                    .append(" — ").append(eligibilityText(str(raw, "eligibilityLevel")));
            String amount = amountLabel(raw);
            if (amount != null) {
                sb.append(" · 예상 ").append(amount);
            }
            sb.append("\n");
        }
        sb.append("\n실업급여·퇴직금·건강보험·국민연금·세금 중 궁금한 걸 콕 집어 물어보면 더 자세히 도와드릴게요.\n");
        sb.append("※ 실제 자격·금액·기한은 관할 기관에서 꼭 확인하세요.");
        return sb.toString();
    }

    private List<?> items(Object report) {
        if (report instanceof Map<?, ?> map && map.get("items") instanceof List<?> list) {
            return list;
        }
        return null;
    }

    private String amountLabel(Object item) {
        if (item instanceof Map<?, ?> map && map.get("estimate") instanceof Map<?, ?> estimate) {
            Object label = estimate.get("amountLabel");
            return label == null ? null : label.toString();
        }
        return null;
    }

    private String str(Object item, String field) {
        if (item instanceof Map<?, ?> map) {
            Object value = map.get(field);
            return value == null ? null : value.toString();
        }
        return null;
    }

    private String eligibilityText(String level) {
        if (!StringUtils.hasText(level)) {
            return "확인 필요";
        }
        return switch (level) {
            case "HIGH" -> "신청 가능성 높음";
            case "LOW" -> "현재 조건에선 어려울 수 있음";
            default -> "확인 필요";
        };
    }
}
