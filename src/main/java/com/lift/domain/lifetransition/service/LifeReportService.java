package com.lift.domain.lifetransition.service;

import com.lift.domain.lifetransition.dto.request.ReportPaymentCompleteReqDTO;
import com.lift.domain.lifetransition.dto.request.ReportPdfEstimateReqDTO;
import com.lift.domain.lifetransition.dto.request.TossPaymentConfirmReqDTO;
import com.lift.domain.lifetransition.dto.response.LatestChatReportResDTO;
import com.lift.domain.lifetransition.dto.response.LatestReportRouteResDTO;
import com.lift.domain.lifetransition.dto.response.LifeReportResDTO;
import com.lift.domain.lifetransition.dto.response.ReportPaymentResDTO;
import com.lift.domain.lifetransition.dto.response.ReportPreviewResDTO;
import com.lift.domain.lifetransition.enumtype.PaymentStatus;
import com.lift.domain.lifetransition.enumtype.ReportPlanType;
import com.lift.domain.lifetransition.exception.LifeTransitionErrorCode;
import com.lift.domain.lifetransition.model.LifeReport;
import com.lift.domain.lifetransition.repository.LifeReportRepository;
import com.lift.domain.user.model.UserAccount;
import com.lift.domain.user.service.UserService;
import com.lift.global.apiPayload.exception.ProjectException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 리포트 미리보기 / 결제 mock / 상세 조회를 담당한다.
 */
@Service
@RequiredArgsConstructor
public class LifeReportService {

    private final LifeReportAccessManager reportAccessManager;
    private final BenefitEstimationService benefitEstimationService;
    private final Gov24PublicBenefitService gov24PublicBenefitService;
    private final TossPaymentClient tossPaymentClient;
    private final LifeReportRepository lifeReportRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public ReportPreviewResDTO getPreview(Authentication authentication, Long reportId) {
        LifeReport report = reportAccessManager.getOwnedReport(authentication, reportId);
        return ReportPreviewResDTO.from(report, benefitEstimationService.previewRangeLabel(report));
    }

    @Transactional(readOnly = true)
    public LatestChatReportResDTO getLatestChatReport(Authentication authentication) {
        UserAccount user = userService.getCurrentUser(authentication);
        return lifeReportRepository
                .findByAssessment_UserAccount_IdAndPaymentStatusOrderByPaidAtDescIdDesc(
                        user.getId(),
                        PaymentStatus.PAID
                )
                .stream()
                .filter(LifeReport::canUseAiChat)
                .findFirst()
                .map(LatestChatReportResDTO::from)
                .orElseGet(LatestChatReportResDTO::empty);
    }

    @Transactional(readOnly = true)
    public LatestReportRouteResDTO getLatestReportRoute(Authentication authentication) {
        UserAccount user = userService.getCurrentUser(authentication);
        return lifeReportRepository
                .findFirstByAssessment_UserAccount_IdOrderByIdDesc(user.getId())
                .map(LatestReportRouteResDTO::from)
                .orElseGet(LatestReportRouteResDTO::empty);
    }

    /**
     * MVP용 결제 완료 mock. 실제 토스페이먼츠 연동 없이 결제 상태만 PAID로 전환한다.
     */
    @Transactional
    public ReportPaymentResDTO completeMockPayment(
            Authentication authentication,
            Long reportId,
            ReportPaymentCompleteReqDTO request
    ) {
        LifeReport report = reportAccessManager.getOwnedReport(authentication, reportId);
        ReportPlanType plan = resolveMockPaymentPlan(request);
        Integer amount = request == null || request.amount() == null ? plan.getPrice() : request.amount();

        report.markPaid(plan, amount);
        report.getAssessment().markPaid();
        return ReportPaymentResDTO.from(report);
    }

    /**
     * 토스페이먼츠 테스트 결제 승인. 결제창 인증 성공 후 서버에서 금액/주문번호를 검증하고 승인한다.
     */
    @Transactional
    public ReportPaymentResDTO completeTossPayment(
            Authentication authentication,
            Long reportId,
            TossPaymentConfirmReqDTO request
    ) {
        LifeReport report = reportAccessManager.getOwnedReport(authentication, reportId);
        ReportPlanType plan = validateTossPaymentRequest(reportId, request);
        if (report.isPaid()) {
            return ReportPaymentResDTO.from(report);
        }

        TossPaymentConfirmation confirmation = tossPaymentClient.confirm(
                request.paymentKey(),
                request.orderId(),
                request.amount()
        );
        validateTossConfirmation(request, confirmation);

        report.markTossTestPaid(plan, request.amount(), confirmation.orderId(), confirmation.paymentKey());
        report.getAssessment().markPaid();
        return ReportPaymentResDTO.from(report);
    }

    /**
     * 결제 완료 후 상세 리포트를 반환한다. 미결제 상태면 403(PAYMENT_REQUIRED).
     */
    @Transactional(readOnly = true)
    public LifeReportResDTO getDetail(Authentication authentication, Long reportId) {
        LifeReport report = reportAccessManager.getPaidOwnedReport(authentication, reportId);
        return LifeReportResDTO.from(
                report,
                benefitEstimationService.estimate(report),
                gov24PublicBenefitService.findBenefits(report)
        );
    }

    /**
     * PDF 저장용 상세 리포트를 반환한다.
     * 월급이 있으면 해당 값으로 임시 계산하고, 없으면 금액 범위/산식 중심으로 반환한다.
     */
    @Transactional(readOnly = true)
    public LifeReportResDTO getPdfDetail(
            Authentication authentication,
            Long reportId,
            ReportPdfEstimateReqDTO request
    ) {
        LifeReport report = reportAccessManager.getPdfCapableOwnedReport(authentication, reportId);
        Integer monthlyAverageWage = request == null ? null : request.monthlyAverageWage();
        BenefitEstimationService.ReportEstimation estimation = monthlyAverageWage == null
                ? benefitEstimationService.estimateWithoutMonthlyWage(report)
                : benefitEstimationService.estimateWithMonthlyWage(report, monthlyAverageWage);

        return LifeReportResDTO.from(report, estimation, gov24PublicBenefitService.findBenefits(report));
    }

    private ReportPlanType resolveMockPaymentPlan(ReportPaymentCompleteReqDTO request) {
        if (request == null) {
            return ReportPlanType.PLUS;
        }

        ReportPlanType plan = request.plan() != null
                ? request.plan()
                : ReportPlanType.findByPrice(request.amount());
        if (plan == null) {
            throw new ProjectException(LifeTransitionErrorCode.PAYMENT_PLAN_INVALID_REQUEST);
        }
        validatePlanAmount(plan, request.amount(), LifeTransitionErrorCode.PAYMENT_PLAN_INVALID_REQUEST);
        return plan;
    }

    private ReportPlanType validateTossPaymentRequest(Long reportId, TossPaymentConfirmReqDTO request) {
        ReportPlanType plan = ReportPlanType.findByPrice(request.amount());
        if (plan == null) {
            throw new ProjectException(LifeTransitionErrorCode.TOSS_PAYMENT_INVALID_REQUEST);
        }
        String expectedPrefix = "LIFT-" + reportId + "-";
        if (request.orderId() == null || !request.orderId().startsWith(expectedPrefix)) {
            throw new ProjectException(LifeTransitionErrorCode.TOSS_PAYMENT_INVALID_REQUEST);
        }
        return plan;
    }

    private void validatePlanAmount(ReportPlanType plan, Integer amount, LifeTransitionErrorCode errorCode) {
        if (amount != null && amount != plan.getPrice()) {
            throw new ProjectException(errorCode);
        }
    }

    private void validateTossConfirmation(TossPaymentConfirmReqDTO request, TossPaymentConfirmation confirmation) {
        if (confirmation == null
                || !request.paymentKey().equals(confirmation.paymentKey())
                || !request.orderId().equals(confirmation.orderId())
                || !request.amount().equals(confirmation.totalAmount())
                || !"DONE".equals(confirmation.status())) {
            throw new ProjectException(LifeTransitionErrorCode.TOSS_PAYMENT_CONFIRM_FAILED);
        }
    }
}
