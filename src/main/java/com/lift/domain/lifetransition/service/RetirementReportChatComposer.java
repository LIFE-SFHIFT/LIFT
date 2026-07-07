package com.lift.domain.lifetransition.service;

import com.lift.domain.lifetransition.dto.response.BenefitEstimateResDTO;
import com.lift.domain.lifetransition.enumtype.EligibilityLevel;
import com.lift.domain.lifetransition.enumtype.ProcedureType;
import com.lift.domain.lifetransition.model.LifeReport;
import com.lift.domain.lifetransition.model.ReportItem;
import com.lift.domain.lifetransition.model.RequiredDocument;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 퇴직/이직 상황에 특화된 챗봇 답변을 리포트 근거로만 조합한다.
 *
 * <p>자격을 새로 판단하지 않고 룰 엔진이 계산한 리포트 항목(신청 가능성·마감·서류·공식 링크)과
 * {@link BenefitEstimationService}가 계산한 예상 금액만 인용한다. LLM 없이 동작하는 기본 엔진이며,
 * 데모/오프라인 상황에서도 퇴직 도메인에 맞는 실질적인 안내를 제공하는 것이 목적이다.
 */
@Component
public class RetirementReportChatComposer {

    private static final String DISCLAIMER =
            "※ 실제 자격·금액·기한은 개인 상황에 따라 달라질 수 있어요. 마지막엔 관할 기관에서 꼭 확인하세요.";

    /** 범위 밖(요리·잡담 등) 질문에 대한 거절 안내. OpenAI 미사용/실패 시에도 일관되게 막는다. */
    private static final String OFF_TOPIC_REPLY =
            "저는 퇴직·이직 행정만 도와드리는 LIFT 퇴직 도우미예요. 방금 여쭤보신 내용은 제가 안내할 수 있는 "
            + "범위 밖이라 도와드리기 어려워요.\n대신 실업급여·퇴직금·건강보험·국민연금·세금 정산처럼 퇴직 후 "
            + "챙겨야 할 것이라면 무엇이든 편하게 물어봐 주세요.";

    /** 퇴직·이직 행정과 명백히 무관한 질문을 걸러내기 위한 키워드. */
    private static final List<String> OFF_TOPIC_KEYWORDS = List.of(
            "레시피", "요리", "찌개", "김치", "된장", "만드는 법", "끓이", "맛집", "여행", "날씨",
            "코딩", "프로그래밍", "코드", "번역", "주식", "코인", "비트코인", "부동산 매매",
            "연애", "운세", "게임", "노래", "영화", "다이어트"
    );

    /** 퇴직 행정과 관련됐다고 볼 수 있는 신호 키워드(있으면 무관 질문으로 보지 않는다). */
    private static final List<String> RETIREMENT_SIGNAL_KEYWORDS = List.of(
            "실업급여", "구직급여", "실업", "워크넷", "고용센터", "고용24", "이직확인서", "수급",
            "퇴직금", "퇴직", "퇴사", "정산", "중간정산", "irp", "dc", "db", "퇴직연금",
            "건강보험", "보험료", "임의계속", "지역가입", "피부양자", "건보",
            "국민연금", "연금", "납부예외", "추납", "노령연금",
            "세금", "연말정산", "종합소득세", "환급", "원천징수", "소득세", "홈택스",
            "서류", "준비물", "챙겨", "구비", "마감", "기한", "언제까지", "신청",
            "우선", "순서", "뭐부터", "먼저", "리포트", "로드맵"
    );

    /** 질문 키워드 → 절차 유형 매핑. 위에 있을수록 우선 매칭한다. */
    private record Intent(ProcedureType procedure, List<String> keywords) {
    }

    private static final List<Intent> INTENTS = List.of(
            new Intent(ProcedureType.UNEMPLOYMENT_BENEFIT,
                    List.of("실업급여", "구직급여", "실업", "워크넷", "고용센터", "고용24", "이직확인서", "수급")),
            new Intent(ProcedureType.SEVERANCE_PAY,
                    List.of("퇴직금", "퇴직 정산", "퇴직소득", "중간정산", "irp", "dc", "db", "퇴직연금")),
            new Intent(ProcedureType.HEALTH_INSURANCE_CONTINUATION,
                    List.of("건강보험", "보험료", "임의계속", "지역가입", "피부양자", "건보")),
            new Intent(ProcedureType.NATIONAL_PENSION_EXCEPTION,
                    List.of("국민연금", "연금", "납부예외", "추납", "노령연금")),
            new Intent(ProcedureType.TAX_CHECK,
                    List.of("세금", "연말정산", "종합소득세", "환급", "원천징수", "소득세", "홈택스"))
    );

    /**
     * 리포트와 예상 금액을 근거로 사용자 질문에 답한다.
     *
     * @param report     질문 대상 리포트
     * @param estimates  절차별 예상 금액(없으면 빈 맵)
     * @param question   사용자 질문
     */
    public String compose(LifeReport report, Map<ProcedureType, BenefitEstimateResDTO> estimates, String question) {
        String q = question == null ? "" : question.strip();
        String lower = q.toLowerCase();

        // 0) 퇴직·이직 행정과 명백히 무관한 질문(요리 레시피 등)은 근거 조합 없이 정중히 거절한다.
        if (isOffTopic(lower)) {
            return OFF_TOPIC_REPLY;
        }

        // 1) 특정 절차를 물으면 해당 항목을 자세히 답한다.
        Optional<ProcedureType> matched = detectProcedure(lower);
        if (matched.isPresent()) {
            ReportItem item = findItem(report, matched.get());
            if (item != null) {
                return withDisclaimer(procedureAnswer(item, estimates.get(item.getProcedureType())));
            }
            return withDisclaimer(
                    "'" + matched.get().getDisplayName() + "'는 이번 로드맵의 우선 항목에는 포함되지 않았어요.\n"
                            + "대신 아래 항목부터 확인해 보세요.\n\n" + overview(report, estimates));
        }

        // 2) 서류 / 마감 / 우선순위 등 카테고리 질문
        if (containsAny(lower, "서류", "준비물", "필요한 것", "챙겨", "구비")) {
            return withDisclaimer(documentsAnswer(report));
        }
        if (containsAny(lower, "마감", "기한", "언제까지", "며칠", "데드라인", "늦으면")) {
            return withDisclaimer(deadlineAnswer(report));
        }
        if (containsAny(lower, "먼저", "뭐부터", "순서", "우선", "제일 급")) {
            return withDisclaimer(overview(report, estimates));
        }

        // 3) 그 외에는 전체 로드맵을 요약하고 세부 질문을 유도한다.
        return withDisclaimer(
                "'" + report.getSummaryTitle() + "' 기준으로 퇴직 후 챙길 것을 정리해 드릴게요.\n\n"
                        + overview(report, estimates)
                        + "\n\n실업급여·퇴직금·건강보험·국민연금·세금 중 궁금한 걸 콕 집어 물어보면 더 자세히 알려드려요.");
    }

    /**
     * 무관 질문 판별: 요리·잡담 등 명백한 범위 밖 키워드가 있고, 동시에 퇴직 행정 신호가 전혀 없을 때만 true.
     * (예: "된장찌개 레시피"는 거절, "퇴직하고 나서 세금 신경 쓸 게 김치처럼 많네"처럼 신호가 섞이면 통과)
     */
    private boolean isOffTopic(String lowerQuestion) {
        boolean hasOffTopic = OFF_TOPIC_KEYWORDS.stream().anyMatch(lowerQuestion::contains);
        if (!hasOffTopic) {
            return false;
        }
        boolean hasRetirementSignal = RETIREMENT_SIGNAL_KEYWORDS.stream().anyMatch(lowerQuestion::contains);
        return !hasRetirementSignal;
    }

    private Optional<ProcedureType> detectProcedure(String lowerQuestion) {
        return INTENTS.stream()
                .filter(intent -> intent.keywords().stream().anyMatch(lowerQuestion::contains))
                .map(Intent::procedure)
                .findFirst();
    }

    private ReportItem findItem(LifeReport report, ProcedureType type) {
        return report.getItems().stream()
                .filter(item -> item.getProcedureType() == type)
                .findFirst()
                .orElse(null);
    }

    private String procedureAnswer(ReportItem item, BenefitEstimateResDTO estimate) {
        StringBuilder sb = new StringBuilder();
        sb.append("[").append(item.getProcedureType().getDisplayName()).append("] ")
                .append("· ").append(eligibilityText(item.getEligibilityLevel())).append("\n");
        sb.append(item.getReason());

        String money = moneyLine(estimate);
        if (money != null) {
            sb.append("\n\n💰 ").append(money);
        }
        if (StringUtils.hasText(item.getDeadlineText())) {
            sb.append("\n⏰ 마감: ").append(item.getDeadlineText());
        }

        String docs = requiredDocuments(item);
        if (docs != null) {
            sb.append("\n📄 필요 서류: ").append(docs);
        }
        if (StringUtils.hasText(item.getOfficialUrl())) {
            sb.append("\n🔗 신청/확인: ").append(item.getOfficialUrl());
        }
        return sb.toString();
    }

    private String overview(LifeReport report, Map<ProcedureType, BenefitEstimateResDTO> estimates) {
        List<ReportItem> items = report.getItems().stream()
                .sorted((a, b) -> Integer.compare(priorityWeight(b), priorityWeight(a)))
                .toList();
        if (items.isEmpty()) {
            return "지금 로드맵에 정리된 항목이 없어요. 진단을 먼저 완료해 주세요.";
        }

        StringBuilder sb = new StringBuilder();
        int no = 1;
        for (ReportItem item : items) {
            sb.append(no++).append(". [").append(item.getProcedureType().getDisplayName()).append("] ")
                    .append(eligibilityText(item.getEligibilityLevel()));
            String money = moneyLine(estimates.get(item.getProcedureType()));
            if (money != null) {
                sb.append(" · ").append(money);
            }
            if (StringUtils.hasText(item.getDeadlineText())) {
                sb.append(" · ⏰ 마감 있음");
            }
            sb.append("\n");
        }
        return sb.toString().stripTrailing();
    }

    private String documentsAnswer(LifeReport report) {
        String docs = report.getItems().stream()
                .filter(item -> !item.getRequiredDocuments().isEmpty())
                .map(item -> "· " + item.getProcedureType().getDisplayName() + ": " + requiredDocuments(item))
                .collect(Collectors.joining("\n"));
        if (!StringUtils.hasText(docs)) {
            return "이번 로드맵 항목에는 별도로 안내된 필요 서류가 없어요.";
        }
        return "퇴직 후 절차별로 미리 챙겨두면 좋은 서류예요.\n\n" + docs;
    }

    private String deadlineAnswer(LifeReport report) {
        String deadlines = report.getItems().stream()
                .filter(item -> StringUtils.hasText(item.getDeadlineText()))
                .map(item -> "· " + item.getProcedureType().getDisplayName() + ": " + item.getDeadlineText())
                .collect(Collectors.joining("\n"));
        if (!StringUtils.hasText(deadlines)) {
            return "이번 로드맵 항목에는 정해진 마감일 안내가 없어요. 다만 실업급여처럼 퇴사 후 빨리 신청할수록 유리한 항목이 있으니 서두르는 게 좋아요.";
        }
        return "마감·기한이 있는 항목부터 먼저 처리하세요.\n\n" + deadlines;
    }

    private String moneyLine(BenefitEstimateResDTO estimate) {
        if (estimate == null) {
            return null;
        }
        if (StringUtils.hasText(estimate.headline())) {
            return estimate.headline();
        }
        if (StringUtils.hasText(estimate.amountLabel())) {
            return "예상 " + estimate.amountLabel();
        }
        return null;
    }

    private String requiredDocuments(ReportItem item) {
        String docs = item.getRequiredDocuments().stream()
                .map(RequiredDocument::getDocumentName)
                .collect(Collectors.joining(", "));
        return StringUtils.hasText(docs) ? docs : null;
    }

    private String eligibilityText(EligibilityLevel level) {
        return switch (level) {
            case HIGH -> "신청 가능성 높음";
            case NEEDS_CHECK -> "확인 필요";
            case LOW -> "현재 조건에선 어려울 수 있음";
        };
    }

    private int priorityWeight(ReportItem item) {
        return switch (item.getPriorityLevel()) {
            case HIGH -> 3;
            case MEDIUM -> 2;
            case LOW -> 1;
        };
    }

    private boolean containsAny(String haystack, String... needles) {
        for (String needle : needles) {
            if (haystack.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private String withDisclaimer(String body) {
        return body + "\n\n" + DISCLAIMER;
    }
}
