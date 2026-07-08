package com.lift.domain.lifetransition.dto.response;

import com.lift.domain.lifetransition.enumtype.PaymentStatus;
import com.lift.domain.lifetransition.enumtype.ProcedureType;
import com.lift.domain.lifetransition.enumtype.ReportPlanType;
import com.lift.domain.lifetransition.model.LifeReport;
import com.lift.domain.lifetransition.service.BenefitEstimationService.ReportEstimation;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 결제 완료 후 공개되는 상세 리포트. PDF 다운로드용 데이터로도 사용된다.
 */
public record LifeReportResDTO(
        Long reportId,
        Long assessmentId,
        String summaryTitle,
        String summaryMessage,
        int totalPriorityScore,
        PaymentStatus paymentStatus,
        ReportPlanType paymentPlan,
        Integer paymentAmount,
        boolean aiChatAvailable,
        boolean pdfAvailable,
        int aiQuestionLimit,
        int aiQuestionUsedCount,
        int aiQuestionRemaining,
        LocalDateTime createdAt,
        BenefitSummaryResDTO benefitSummary,
        List<ReportItemResDTO> items,
        List<PublicBenefitResDTO> publicBenefits,
        List<PublicBenefitResDTO> pendingBenefits,
        List<String> requiredForMatching
) {

    public static LifeReportResDTO from(LifeReport report, ReportEstimation estimation) {
        return from(report, estimation, BenefitRecommendationResult.empty());
    }

    public static LifeReportResDTO from(
            LifeReport report,
            ReportEstimation estimation,
            BenefitRecommendationResult benefitRecommendation
    ) {
        Map<ProcedureType, BenefitEstimateResDTO> estimates = estimation.perItem();
        BenefitRecommendationResult recommendation =
                benefitRecommendation == null ? BenefitRecommendationResult.empty() : benefitRecommendation;
        return new LifeReportResDTO(
                report.getId(),
                report.getAssessment().getId(),
                report.getSummaryTitle(),
                report.getSummaryMessage(),
                report.getTotalPriorityScore(),
                report.getPaymentStatus(),
                report.getResolvedPaymentPlan(),
                report.getResolvedPaymentAmount(),
                report.canUseAiChat(),
                report.canUsePdfEstimate(),
                report.getAiQuestionLimit(),
                report.getAiQuestionUsedCount(),
                report.getAiQuestionRemaining(),
                report.getCreatedAt(),
                estimation.summary(),
                report.getItems().stream()
                        .map(item -> ReportItemResDTO.from(item, estimates.get(item.getProcedureType())))
                        .toList(),
                recommendation.ranked(),
                recommendation.pending(),
                recommendation.requiredForMatching()
        );
    }

    /**
     * {@link com.lift.domain.lifetransition.service.Gov24PublicBenefitService}의 확정/보완필요 판정 결과.
     */
    public record BenefitRecommendationResult(
            List<PublicBenefitResDTO> ranked,
            List<PublicBenefitResDTO> pending,
            List<String> requiredForMatching
    ) {
        public static BenefitRecommendationResult empty() {
            return new BenefitRecommendationResult(List.of(), List.of(), List.of());
        }
    }
}
