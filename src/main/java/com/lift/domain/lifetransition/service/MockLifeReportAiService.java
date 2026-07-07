package com.lift.domain.lifetransition.service;

import com.lift.domain.lifetransition.model.LifeReport;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * LLM 키가 없을 때(기본값) 동작하는 퇴직 특화 챗봇.
 *
 * <p>실제 LLM 대신 룰 엔진이 계산한 리포트 항목과 {@link BenefitEstimationService}의 예상 금액을
 * 근거로 결정적인 답변을 만든다. 자격을 새로 판단하지 않으며, 실질적인 안내는
 * {@link RetirementReportChatComposer}가 담당한다. OpenAI 키를 켜면
 * {@link OpenAiLifeReportAiService}로 자동 대체된다.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "lift.openai", name = "enabled", havingValue = "false", matchIfMissing = true)
public class MockLifeReportAiService implements LifeReportAiService {

    private final BenefitEstimationService benefitEstimationService;
    private final RetirementReportChatComposer composer;

    @Override
    public String generateAnswer(LifeReport report, String userQuestion) {
        return composer.compose(
                report,
                benefitEstimationService.estimate(report).perItem(),
                userQuestion
        );
    }
}
