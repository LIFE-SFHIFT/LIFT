package com.lift.domain.lifetransition.service;

import com.lift.domain.lifetransition.dto.request.ReportChatMessageCreateReqDTO;
import com.lift.domain.lifetransition.dto.response.ReportChatMessageCreateResDTO;
import com.lift.domain.lifetransition.dto.response.ReportChatMessagesResDTO;
import com.lift.domain.lifetransition.exception.LifeTransitionErrorCode;
import com.lift.domain.lifetransition.model.LifeReport;
import com.lift.domain.lifetransition.model.ReportChatMessage;
import com.lift.domain.lifetransition.repository.ReportChatMessageRepository;
import com.lift.global.apiPayload.exception.ProjectException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 리포트 기반 AI 채팅. 결제 완료된 리포트에서만 이용 가능하며, AI 질문은 최대 10회로 제한된다.
 */
@Service
@RequiredArgsConstructor
public class LifeReportChatService {

    private final LifeReportAccessManager reportAccessManager;
    private final ReportChatMessageRepository reportChatMessageRepository;
    private final LifeReportAiService lifeReportAiService;

    @Transactional
    public ReportChatMessageCreateResDTO createMessage(
            Authentication authentication,
            Long reportId,
            ReportChatMessageCreateReqDTO request
    ) {
        LifeReport report = reportAccessManager.getAiChatCapableOwnedReport(authentication, reportId);

        if (report.isAiQuestionLimitReached()) {
            throw new ProjectException(LifeTransitionErrorCode.AI_QUESTION_LIMIT_EXCEEDED);
        }

        ReportChatMessage userMessage = reportChatMessageRepository.save(
                ReportChatMessage.userMessage(report, request.content())
        );

        String aiAnswer = lifeReportAiService.generateAnswer(report, request.content());
        ReportChatMessage aiMessage = reportChatMessageRepository.save(
                ReportChatMessage.aiMessage(report, aiAnswer)
        );

        // 사용자 질문 1건당 1회 차감
        report.increaseAiQuestionUsedCount();

        return ReportChatMessageCreateResDTO.of(report, userMessage, aiMessage);
    }

    @Transactional(readOnly = true)
    public ReportChatMessagesResDTO getMessages(Authentication authentication, Long reportId) {
        LifeReport report = reportAccessManager.getAiChatCapableOwnedReport(authentication, reportId);
        List<ReportChatMessage> messages = reportChatMessageRepository.findByReport_IdOrderByIdAsc(reportId);
        return ReportChatMessagesResDTO.of(report, messages);
    }
}
