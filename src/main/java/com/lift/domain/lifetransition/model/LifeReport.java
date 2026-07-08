package com.lift.domain.lifetransition.model;

import com.lift.domain.lifetransition.enumtype.PaymentStatus;
import com.lift.domain.lifetransition.enumtype.ReportPlanType;
import com.lift.global.common.entity.BaseCreatedEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 룰 엔진 분석 결과로 생성되는 리포트. 미리보기/결제/상세/AI 채팅의 중심 엔티티.
 */
@Entity
@Getter
@Table(name = "life_reports")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LifeReport extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assessment_id", nullable = false, unique = true)
    private LifeAssessment assessment;

    @Column(name = "summary_title", nullable = false, length = 150)
    private String summaryTitle;

    @Column(name = "summary_message", nullable = false, length = 500)
    private String summaryMessage;

    @Column(name = "total_priority_score", nullable = false)
    private int totalPriorityScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 20)
    private PaymentStatus paymentStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_plan", length = 20)
    private ReportPlanType paymentPlan;

    @Column(name = "payment_amount")
    private Integer paymentAmount;

    @Column(name = "ai_question_limit", nullable = false)
    private int aiQuestionLimit;

    @Column(name = "ai_question_used_count", nullable = false)
    private int aiQuestionUsedCount;

    @Column(name = "payment_provider", length = 30)
    private String paymentProvider;

    @Column(name = "payment_order_id", length = 80)
    private String paymentOrderId;

    @Column(name = "payment_key", length = 220)
    private String paymentKey;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @OneToMany(mappedBy = "report", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ReportItem> items = new ArrayList<>();

    private LifeReport(
            LifeAssessment assessment,
            String summaryTitle,
            String summaryMessage,
            int totalPriorityScore
    ) {
        this.assessment = assessment;
        this.summaryTitle = summaryTitle;
        this.summaryMessage = summaryMessage;
        this.totalPriorityScore = totalPriorityScore;
        this.paymentStatus = PaymentStatus.UNPAID;
        this.aiQuestionLimit = 0;
        this.aiQuestionUsedCount = 0;
    }

    public static LifeReport create(
            LifeAssessment assessment,
            String summaryTitle,
            String summaryMessage,
            int totalPriorityScore
    ) {
        return new LifeReport(assessment, summaryTitle, summaryMessage, totalPriorityScore);
    }

    public void addItem(ReportItem item) {
        items.add(item);
        item.assignReport(this);
    }

    public void markPaid(ReportPlanType plan, Integer amount) {
        markPaid("MOCK", plan, amount, null, null);
    }

    public void markTossTestPaid(ReportPlanType plan, Integer amount, String orderId, String paymentKey) {
        markPaid("TOSS_TEST", plan, amount, orderId, paymentKey);
    }

    private void markPaid(
            String provider,
            ReportPlanType plan,
            Integer amount,
            String orderId,
            String paymentKey
    ) {
        ReportPlanType resolvedPlan = plan == null ? ReportPlanType.PLUS : plan;
        this.paymentStatus = PaymentStatus.PAID;
        this.paymentPlan = resolvedPlan;
        this.paymentAmount = amount == null ? resolvedPlan.getPrice() : amount;
        this.aiQuestionLimit = resolvedPlan.getAiQuestionLimit();
        this.aiQuestionUsedCount = Math.min(aiQuestionUsedCount, aiQuestionLimit);
        this.paymentProvider = provider;
        this.paymentOrderId = orderId;
        this.paymentKey = paymentKey;
        this.paidAt = LocalDateTime.now();
    }

    public boolean isPaid() {
        return paymentStatus == PaymentStatus.PAID;
    }

    public ReportPlanType getResolvedPaymentPlan() {
        if (paymentPlan != null) {
            return paymentPlan;
        }
        return isPaid() ? ReportPlanType.PLUS : null;
    }

    public Integer getResolvedPaymentAmount() {
        if (paymentAmount != null) {
            return paymentAmount;
        }
        ReportPlanType resolvedPlan = getResolvedPaymentPlan();
        return resolvedPlan == null ? null : resolvedPlan.getPrice();
    }

    public boolean canUseAiChat() {
        return isPaid() && getResolvedPaymentPlan() == ReportPlanType.PLUS;
    }

    public boolean canUsePdfEstimate() {
        return isPaid() && getResolvedPaymentPlan() == ReportPlanType.PLUS;
    }

    public boolean isAiQuestionLimitReached() {
        return aiQuestionUsedCount >= aiQuestionLimit;
    }

    public int getAiQuestionRemaining() {
        return Math.max(0, aiQuestionLimit - aiQuestionUsedCount);
    }

    public void increaseAiQuestionUsedCount() {
        this.aiQuestionUsedCount++;
    }

    public boolean isOwnedBy(Long userId) {
        return assessment != null && assessment.isOwnedBy(userId);
    }
}
