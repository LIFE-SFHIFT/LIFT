package com.lift.domain.lifetransition.service;

import com.lift.domain.lifetransition.dto.request.LifeAssessmentCreateReqDTO;
import com.lift.domain.lifetransition.dto.response.LifeAssessmentResDTO;
import com.lift.domain.lifetransition.dto.response.ReportPreviewResDTO;
import com.lift.domain.lifetransition.exception.LifeTransitionErrorCode;
import com.lift.domain.lifetransition.model.LifeAssessment;
import com.lift.domain.lifetransition.model.LifeReport;
import com.lift.domain.lifetransition.model.ReportItem;
import com.lift.domain.lifetransition.model.RequiredDocument;
import com.lift.domain.lifetransition.repository.LifeAssessmentRepository;
import com.lift.domain.lifetransition.repository.LifeReportRepository;
import com.lift.domain.lifetransition.rule.RuleContext;
import com.lift.domain.lifetransition.rule.RuleEngineResult;
import com.lift.domain.lifetransition.rule.RuleEngineService;
import com.lift.domain.lifetransition.rule.RuleItemResult;
import com.lift.domain.user.model.UserAccount;
import com.lift.domain.user.service.UserService;
import com.lift.global.apiPayload.exception.ProjectException;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 진단 생성 및 룰 엔진 분석(리포트 생성)을 담당한다.
 */
@Service
@RequiredArgsConstructor
public class LifeAssessmentService {

    private final LifeAssessmentRepository lifeAssessmentRepository;
    private final LifeReportRepository lifeReportRepository;
    private final RuleEngineService ruleEngineService;
    private final BenefitEstimationService benefitEstimationService;
    private final UserService userService;

    @Transactional
    public LifeAssessmentResDTO createAssessment(Authentication authentication, LifeAssessmentCreateReqDTO request) {
        UserAccount user = userService.getCurrentUser(authentication);
        user.updateProfile(
                null,
                null,
                null,
                request.regionSido(),
                request.regionSigungu(),
                request.householdType(),
                request.annualIncomeRange(),
                request.assetRange(),
                request.housingType(),
                request.hasDependentChildren(),
                request.hasSupportingFamily(),
                request.basicLivelihoodRecipient(),
                request.nearPoverty(),
                request.singleParent(),
                request.disabledPerson()
        );

        LifeAssessment assessment = LifeAssessment.builder()
                .userAccount(user)
                .eventType(request.eventType())
                .retirementDate(request.retirementDate())
                .resignationReason(request.resignationReason())
                .nextJobStatus(request.nextJobStatus())
                .nextJobStartDate(request.nextJobStartDate())
                .employmentInsuranceMonths(request.employmentInsuranceMonths())
                .currentIncomeStatus(request.currentIncomeStatus())
                .regionSido(request.regionSido())
                .regionSigungu(request.regionSigungu())
                .monthlyAverageWage(request.monthlyAverageWage())
                .age(request.age())
                .tenureYears(request.tenureYears())
                .householdType(request.householdType())
                .annualIncomeRange(request.annualIncomeRange())
                .assetRange(request.assetRange())
                .housingType(request.housingType())
                .hasDependentChildren(request.hasDependentChildren())
                .hasSupportingFamily(request.hasSupportingFamily())
                .basicLivelihoodRecipient(request.basicLivelihoodRecipient())
                .nearPoverty(request.nearPoverty())
                .singleParent(request.singleParent())
                .disabledPerson(request.disabledPerson())
                .build();

        LifeAssessment saved = lifeAssessmentRepository.save(assessment);
        return LifeAssessmentResDTO.from(saved);
    }

    /**
     * 룰 엔진을 실행해 리포트/항목/필요서류를 생성하고, 결제 전 미리보기를 반환한다.
     * 이미 분석된 진단이면 기존 리포트의 미리보기를 그대로 반환한다(재실행하지 않음).
     */
    @Transactional
    public ReportPreviewResDTO analyze(Authentication authentication, Long assessmentId) {
        UserAccount user = userService.getCurrentUser(authentication);

        LifeAssessment assessment = lifeAssessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new ProjectException(LifeTransitionErrorCode.ASSESSMENT_NOT_FOUND));

        if (!assessment.isOwnedBy(user.getId())) {
            throw new ProjectException(LifeTransitionErrorCode.REPORT_ACCESS_DENIED);
        }

        LifeReport report = lifeReportRepository.findByAssessment_Id(assessmentId)
                .orElseGet(() -> createReport(assessment));

        return ReportPreviewResDTO.from(report, benefitEstimationService.previewRangeLabel(report));
    }

    private LifeReport createReport(LifeAssessment assessment) {
        RuleEngineResult result = ruleEngineService.analyze(RuleContext.from(assessment));

        LifeReport report = LifeReport.create(
                assessment,
                result.summaryTitle(),
                result.summaryMessage(),
                result.totalPriorityScore()
        );

        AtomicInteger sortOrder = new AtomicInteger(0);
        for (RuleItemResult itemResult : result.items()) {
            ReportItem item = ReportItem.create(
                    itemResult.procedureType(),
                    itemResult.eligibilityLevel(),
                    itemResult.priorityLevel(),
                    itemResult.title(),
                    itemResult.reason(),
                    itemResult.deadlineText(),
                    itemResult.officialUrl(),
                    sortOrder.getAndIncrement()
            );

            itemResult.requiredDocuments().forEach(doc ->
                    item.addRequiredDocument(RequiredDocument.create(
                            doc.documentName(),
                            doc.description(),
                            doc.issuer(),
                            doc.required()
                    ))
            );

            report.addItem(item);
        }

        assessment.markAnalyzed();
        return lifeReportRepository.save(report);
    }
}
