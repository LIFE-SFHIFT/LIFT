package com.lift.domain.lifetransition.controller;

import com.lift.domain.lifetransition.dto.request.ReportChatMessageCreateReqDTO;
import com.lift.domain.lifetransition.dto.request.ReportPaymentCompleteReqDTO;
import com.lift.domain.lifetransition.dto.request.ReportPdfEstimateReqDTO;
import com.lift.domain.lifetransition.dto.request.TossPaymentConfirmReqDTO;
import com.lift.domain.lifetransition.dto.response.DocumentFetchResDTO;
import com.lift.domain.lifetransition.dto.response.LatestChatReportResDTO;
import com.lift.domain.lifetransition.dto.response.LatestReportRouteResDTO;
import com.lift.domain.lifetransition.dto.response.LifeReportResDTO;
import com.lift.domain.lifetransition.dto.response.ReportChatMessageCreateResDTO;
import com.lift.domain.lifetransition.dto.response.ReportChatMessagesResDTO;
import com.lift.domain.lifetransition.dto.response.ReportPaymentResDTO;
import com.lift.domain.lifetransition.dto.response.ReportPreviewResDTO;
import com.lift.domain.lifetransition.service.LifeDocumentFetchService;
import com.lift.domain.lifetransition.service.LifeReportChatService;
import com.lift.domain.lifetransition.service.LifeReportService;
import com.lift.global.apiPayload.ApiResponse;
import com.lift.global.apiPayload.code.GeneralSuccessCode;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 리포트 미리보기 / 결제 / 상세 / AI 채팅 API.
 */
@RestController
@RequestMapping("/api/life/reports")
@RequiredArgsConstructor
public class LifeReportController {

    private final LifeReportService lifeReportService;
    private final LifeReportChatService lifeReportChatService;
    private final LifeDocumentFetchService lifeDocumentFetchService;

    @GetMapping("/latest-chat-target")
    public ApiResponse<LatestChatReportResDTO> getLatestChatReport(Authentication authentication) {
        return ApiResponse.of(GeneralSuccessCode.OK, lifeReportService.getLatestChatReport(authentication));
    }

    @GetMapping("/latest-route-target")
    public ApiResponse<LatestReportRouteResDTO> getLatestReportRoute(Authentication authentication) {
        return ApiResponse.of(GeneralSuccessCode.OK, lifeReportService.getLatestReportRoute(authentication));
    }

    @GetMapping("/{reportId}/preview")
    public ApiResponse<ReportPreviewResDTO> getPreview(
            Authentication authentication,
            @PathVariable Long reportId
    ) {
        return ApiResponse.of(GeneralSuccessCode.OK, lifeReportService.getPreview(authentication, reportId));
    }

    @PostMapping("/{reportId}/payments/mock-complete")
    public ApiResponse<ReportPaymentResDTO> completeMockPayment(
            Authentication authentication,
            @PathVariable Long reportId,
            @RequestBody(required = false) ReportPaymentCompleteReqDTO request
    ) {
        return ApiResponse.of(GeneralSuccessCode.OK, lifeReportService.completeMockPayment(authentication, reportId, request));
    }

    @PostMapping("/{reportId}/payments/toss/confirm")
    public ApiResponse<ReportPaymentResDTO> completeTossPayment(
            Authentication authentication,
            @PathVariable Long reportId,
            @Valid @RequestBody TossPaymentConfirmReqDTO request
    ) {
        return ApiResponse.of(GeneralSuccessCode.OK, lifeReportService.completeTossPayment(authentication, reportId, request));
    }

    @GetMapping("/{reportId}")
    public ApiResponse<LifeReportResDTO> getDetail(
            Authentication authentication,
            @PathVariable Long reportId
    ) {
        return ApiResponse.of(GeneralSuccessCode.OK, lifeReportService.getDetail(authentication, reportId));
    }

    @PostMapping("/{reportId}/pdf-estimate")
    public ApiResponse<LifeReportResDTO> getPdfDetail(
            Authentication authentication,
            @PathVariable Long reportId,
            @Valid @RequestBody(required = false) ReportPdfEstimateReqDTO request
    ) {
        return ApiResponse.of(GeneralSuccessCode.OK, lifeReportService.getPdfDetail(authentication, reportId, request));
    }

    @PostMapping("/{reportId}/documents/fetch")
    public ApiResponse<DocumentFetchResDTO> fetchDocuments(
            Authentication authentication,
            @PathVariable Long reportId
    ) {
        return ApiResponse.of(GeneralSuccessCode.OK, lifeDocumentFetchService.fetch(authentication, reportId));
    }

    @PostMapping("/{reportId}/chat/messages")
    public ApiResponse<ReportChatMessageCreateResDTO> createChatMessage(
            Authentication authentication,
            @PathVariable Long reportId,
            @Valid @RequestBody ReportChatMessageCreateReqDTO request
    ) {
        return ApiResponse.of(GeneralSuccessCode.OK, lifeReportChatService.createMessage(authentication, reportId, request));
    }

    @GetMapping("/{reportId}/chat/messages")
    public ApiResponse<ReportChatMessagesResDTO> getChatMessages(
            Authentication authentication,
            @PathVariable Long reportId
    ) {
        return ApiResponse.of(GeneralSuccessCode.OK, lifeReportChatService.getMessages(authentication, reportId));
    }
}
