package com.lift.domain.lifetransition.rule.rules;

import com.lift.domain.lifetransition.enumtype.EligibilityLevel;
import com.lift.domain.lifetransition.enumtype.LifeEventType;
import com.lift.domain.lifetransition.enumtype.PriorityLevel;
import com.lift.domain.lifetransition.enumtype.ProcedureType;
import com.lift.domain.lifetransition.enumtype.ResignationReason;
import com.lift.domain.lifetransition.rule.LifeTransitionRule;
import com.lift.domain.lifetransition.rule.RuleContext;
import com.lift.domain.lifetransition.rule.RuleDocument;
import com.lift.domain.lifetransition.rule.RuleItemResult;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 실업급여(구직급여) 판단 규칙.
 *
 * <ul>
 *     <li>RETIREMENT 또는 UNEMPLOYMENT 이고</li>
 *     <li>고용보험 가입기간 >= 6개월 이고</li>
 *     <li>이직 사유가 CONTRACT_EXPIRED / RECOMMENDED_RESIGNATION / COMPANY_CLOSURE 중 하나면 → HIGH</li>
 * </ul>
 * 가입기간은 충족하나 사유가 자발적/불명확이면 NEEDS_CHECK, 가입기간 미달이면 LOW.
 */
@Component
public class UnemploymentBenefitRule implements LifeTransitionRule {

    private static final int MIN_INSURANCE_MONTHS = 6;

    private static final Set<ResignationReason> QUALIFYING_REASONS = Set.of(
            ResignationReason.CONTRACT_EXPIRED,
            ResignationReason.RECOMMENDED_RESIGNATION,
            ResignationReason.COMPANY_CLOSURE
    );

    /**
     * 비자발적 이직 사유(계약만료/권고사직/폐업) 여부. 다른 서비스에서 동일 기준을 재사용할 때 쓴다.
     */
    public static boolean isInvoluntaryReason(ResignationReason resignationReason) {
        return resignationReason != null && QUALIFYING_REASONS.contains(resignationReason);
    }

    @Override
    public List<RuleItemResult> evaluate(RuleContext context) {
        if (context.eventType() != LifeEventType.RETIREMENT
                && context.eventType() != LifeEventType.UNEMPLOYMENT) {
            return List.of();
        }

        EligibilityLevel eligibilityLevel = resolveEligibility(context);

        RuleItemResult item = new RuleItemResult(
                ProcedureType.UNEMPLOYMENT_BENEFIT,
                eligibilityLevel,
                PriorityLevel.HIGH,
                "실업급여(구직급여) 신청 검토",
                buildReason(context, eligibilityLevel),
                "퇴사(이직) 다음 날부터 12개월 이내에 소정급여일수를 모두 받아야 하므로 최대한 빨리 신청하세요.",
                ProcedureType.UNEMPLOYMENT_BENEFIT.getDefaultOfficialUrl(),
                List.of(
                        new RuleDocument("이직확인서", "이전 직장에서 고용센터로 제출(사업주 신고). 처리 여부를 확인하세요.", "이전 직장 / 고용센터", true),
                        new RuleDocument("고용보험 피보험자격 이력", "고용보험 가입기간 확인용", "근로복지공단", true),
                        new RuleDocument("신분증", "본인 확인용", "본인", true),
                        new RuleDocument("본인 명의 통장", "실업급여 수령 계좌", "본인", true)
                )
        );

        return List.of(item);
    }

    private EligibilityLevel resolveEligibility(RuleContext context) {
        boolean insuranceOk = context.employmentInsuranceMonthsOrZero() >= MIN_INSURANCE_MONTHS;
        boolean reasonOk = context.resignationReason() != null
                && QUALIFYING_REASONS.contains(context.resignationReason());

        if (insuranceOk && reasonOk) {
            return EligibilityLevel.HIGH;
        }
        if (insuranceOk) {
            // 가입기간은 충족하나 자발적/불명확 사유 → 개별 판단 필요
            return EligibilityLevel.NEEDS_CHECK;
        }
        return EligibilityLevel.LOW;
    }

    private String buildReason(RuleContext context, EligibilityLevel eligibilityLevel) {
        return switch (eligibilityLevel) {
            case HIGH -> "고용보험 가입기간(6개월 이상)과 비자발적 이직 사유 조건을 충족해 신청 가능성이 높습니다. 실업 상태에서 적극적으로 재취업을 준비 중이어야 합니다.";
            case NEEDS_CHECK -> "고용보험 가입기간은 충족하지만 이직 사유에 따라 수급 자격이 달라질 수 있어 고용센터 상담으로 확인이 필요합니다.";
            case LOW -> "고용보험 가입기간(현재 " + context.employmentInsuranceMonthsOrZero()
                    + "개월)이 부족해 지금은 신청이 어려울 수 있습니다. 정확한 피보험 단위기간을 고용센터에서 확인하세요.";
        };
    }
}
