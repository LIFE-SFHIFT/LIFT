package com.lift.domain.lifetransition.service;

import com.lift.domain.lifetransition.dto.response.BenefitEstimateResDTO;
import com.lift.domain.lifetransition.enumtype.CurrentIncomeStatus;
import com.lift.domain.lifetransition.enumtype.HouseholdType;
import com.lift.domain.lifetransition.enumtype.NextJobStatus;
import com.lift.domain.lifetransition.enumtype.ProcedureType;
import com.lift.domain.lifetransition.enumtype.ResignationReason;
import com.lift.domain.lifetransition.model.LifeAssessment;
import com.lift.domain.lifetransition.model.LifeReport;
import com.lift.domain.lifetransition.model.ReportItem;
import com.lift.domain.lifetransition.model.RequiredDocument;
import com.lift.global.apiPayload.code.GeneralErrorCode;
import com.lift.global.apiPayload.exception.ProjectException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 결제 완료 리포트를 근거로 답변하는 실제 OpenAI 연동 AI 챗봇.
 *
 * <p>'퇴직·이직 행정' 한 가지 도메인에만 특화된 상담사로 동작한다. 시스템 프롬프트로 역할·근거·범위를
 * 강하게 고정하고, 리포트/진단 JSON 밖의 사실은 지어내지 않으며, 퇴직과 무관한 질문(요리 레시피,
 * 코딩, 잡담 등)은 정중히 거절하도록 가드레일을 건다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "lift.openai", name = "enabled", havingValue = "true")
public class OpenAiLifeReportAiService implements LifeReportAiService {

    private final OpenAiResponsesClient openAiResponsesClient;
    private final BenefitEstimationService benefitEstimationService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String generateAnswer(LifeReport report, String userQuestion) {
        try {
            Map<String, Object> userContent = new LinkedHashMap<>();
            userContent.put("question", userQuestion.strip());
            userContent.put("assessment", assessmentContext(report.getAssessment()));
            userContent.put("report", reportContext(report));

            String userJson = objectMapper.writeValueAsString(userContent);
            return openAiResponsesClient.complete(RetirementChatPrompt.input(userJson))
                    .orElseThrow(() -> new ProjectException(GeneralErrorCode.INTERNAL_SERVER_ERROR));
        } catch (JsonProcessingException e) {
            log.warn("OpenAI 리포트 챗 payload 직렬화 실패.", e);
            throw new ProjectException(GeneralErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    /** 사용자의 퇴직 상황(진단) 요약. 답변 개인화용이며, 여기에 없는 사실은 지어내지 않도록 근거로만 쓴다. */
    private Map<String, Object> assessmentContext(LifeAssessment assessment) {
        Map<String, Object> context = new LinkedHashMap<>();
        if (assessment == null) {
            return context;
        }
        putIfNotNull(context, "age", assessment.getAge());
        putIfNotNull(context, "tenureYears", assessment.getTenureYears());
        putIfNotNull(context, "employmentInsuranceMonths", assessment.getEmploymentInsuranceMonths());
        putIfNotNull(context, "monthlyAverageWage", assessment.getMonthlyAverageWage());
        putIfNotNull(context, "retirementDate", assessment.getRetirementDate());
        putIfNotNull(context, "resignationReason", resignationReasonLabel(assessment.getResignationReason()));
        putIfNotNull(context, "nextJobStatus", nextJobStatusLabel(assessment.getNextJobStatus()));
        putIfNotNull(context, "currentIncomeStatus", incomeStatusLabel(assessment.getCurrentIncomeStatus()));
        putIfNotNull(context, "householdType", householdTypeLabel(assessment.getHouseholdType()));
        putIfNotNull(context, "hasDependentChildren", assessment.getHasDependentChildren());
        putIfNotNull(context, "hasSupportingFamily", assessment.getHasSupportingFamily());
        String region = region(assessment);
        putIfNotNull(context, "region", region);
        return context;
    }

    private void putIfNotNull(Map<String, Object> context, String key, Object value) {
        if (value != null) {
            context.put(key, value);
        }
    }

    private String region(LifeAssessment assessment) {
        String sido = assessment.getRegionSido();
        String sigungu = assessment.getRegionSigungu();
        if (StringUtils.hasText(sido) && StringUtils.hasText(sigungu)) {
            return sido + " " + sigungu;
        }
        if (StringUtils.hasText(sido)) {
            return sido;
        }
        return StringUtils.hasText(sigungu) ? sigungu : null;
    }

    private String resignationReasonLabel(ResignationReason reason) {
        if (reason == null) {
            return null;
        }
        return switch (reason) {
            case CONTRACT_EXPIRED -> "계약기간 만료";
            case RECOMMENDED_RESIGNATION -> "권고사직";
            case MANDATORY_RETIREMENT -> "정년퇴직";
            case PERSONAL_REASON -> "자발적 퇴사(개인사유)";
            case FIRED -> "해고";
            case COMPANY_CLOSURE -> "폐업/도산";
            case UNKNOWN -> null;
        };
    }

    private String nextJobStatusLabel(NextJobStatus status) {
        if (status == null) {
            return null;
        }
        return switch (status) {
            case CONFIRMED -> "재취업/이직 확정";
            case NOT_CONFIRMED -> "재취업 미확정(구직 중)";
            case UNKNOWN -> null;
        };
    }

    private String incomeStatusLabel(CurrentIncomeStatus status) {
        if (status == null) {
            return null;
        }
        return switch (status) {
            case HAS_INCOME -> "현재 소득 있음";
            case NONE -> "현재 소득 없음";
            case UNKNOWN -> null;
        };
    }

    private String householdTypeLabel(HouseholdType type) {
        if (type == null) {
            return null;
        }
        return switch (type) {
            case SINGLE -> "1인 가구";
            case COUPLE -> "부부 가구";
            case OTHER -> "기타 가구";
            case WITH_CHILDREN -> "자녀 있는 가구";
            case SUPPORTING_FAMILY -> "부양가족 있는 가구";
            case UNKNOWN -> null;
        };
    }

    private Map<String, Object> reportContext(LifeReport report) {
        Map<ProcedureType, BenefitEstimateResDTO> estimates =
                benefitEstimationService.estimate(report).perItem();

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("summaryTitle", report.getSummaryTitle());
        context.put("summaryMessage", report.getSummaryMessage());
        context.put("totalPriorityScore", report.getTotalPriorityScore());
        context.put("items", report.getItems().stream()
                .map(item -> itemContext(item, estimates.get(item.getProcedureType())))
                .toList());
        return context;
    }

    private Map<String, Object> itemContext(ReportItem item, BenefitEstimateResDTO estimate) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("procedureType", item.getProcedureType().name());
        context.put("procedureName", item.getProcedureType().getDisplayName());
        context.put("title", item.getTitle());
        context.put("eligibilityLevel", item.getEligibilityLevel().name());
        context.put("priorityLevel", item.getPriorityLevel().name());
        context.put("reason", item.getReason());
        context.put("deadlineText", item.getDeadlineText());
        context.put("officialUrl", item.getOfficialUrl());
        if (estimate != null) {
            context.put("estimatedAmountLabel", estimate.amountLabel());
            context.put("estimatedHeadline", estimate.headline());
            context.put("estimateBasis", estimate.detail());
        }
        context.put("requiredDocuments", item.getRequiredDocuments().stream().map(this::documentContext).toList());
        return context;
    }

    private Map<String, Object> documentContext(RequiredDocument document) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("documentName", document.getDocumentName());
        context.put("description", document.getDescription());
        context.put("issuer", document.getIssuer());
        context.put("required", document.isRequired());
        return context;
    }
}
