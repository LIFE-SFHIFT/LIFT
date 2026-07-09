package com.lift.domain.lifetransition.service;

import com.lift.domain.lifetransition.dto.response.LifeReportResDTO.BenefitRecommendationResult;
import com.lift.domain.lifetransition.dto.response.PublicBenefitResDTO;
import com.lift.domain.lifetransition.dto.response.RequiredDocumentResDTO;
import com.lift.domain.lifetransition.enumtype.AnnualIncomeRange;
import com.lift.domain.lifetransition.enumtype.HouseholdType;
import com.lift.domain.lifetransition.enumtype.LifeEventType;
import com.lift.domain.lifetransition.enumtype.PublicBenefitFitLevel;
import com.lift.domain.lifetransition.enumtype.PublicBenefitPriorityGroup;
import com.lift.domain.lifetransition.enumtype.PublicBenefitSourceType;
import com.lift.domain.lifetransition.model.Gov24BenefitCache;
import com.lift.domain.lifetransition.model.LifeAssessment;
import com.lift.domain.lifetransition.model.LifeReport;
import com.lift.domain.lifetransition.repository.Gov24BenefitCacheRepository;
import com.lift.domain.lifetransition.rule.rules.UnemploymentBenefitRule;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 정부24/보조금24 공공서비스 혜택 데이터 연동.
 *
 * 기존 룰 엔진은 설명 가능한 핵심 절차를 만들고, 이 서비스는 정부24/보조금24 공개
 * 카탈로그에서 사용자의 상황과 가까운 추가 혜택 후보를 보강한다.
 *
 * 매 요청마다 외부 API를 직접 호출하지 않고, 미리 수집해 {@code gov24_benefit_cache}에
 * 캐싱해 둔 데이터({@link Gov24BenefitCacheRepository})를 읽어와 동일한 키워드 매칭·점수 로직을 적용한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class Gov24PublicBenefitService {

    private static final String SOURCE_LABEL = "공공데이터포털 · 정부24 공공서비스";
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);

    /** 소관기관명 앞부분으로 지역 전용 혜택을 판별하기 위한 광역시·도 목록(정부24 표기 기준). */
    private static final List<String> SIDO_NAMES = List.of(
            "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시",
            "울산광역시", "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도",
            "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도"
    );

    private final Gov24BenefitCacheRepository gov24BenefitCacheRepository;
    private final Gov24PublicServiceProperties properties;
    private final PublicBenefitRecommendationService recommendationService;

    private volatile CachedRows cachedRows;

    public BenefitRecommendationResult findBenefits(LifeReport report) {
        if (!properties.isAvailable()) {
            return BenefitRecommendationResult.empty();
        }

        LifeAssessment assessment = report.getAssessment();
        boolean isInvoluntary = UnemploymentBenefitRule.isInvoluntaryReason(assessment.getResignationReason());

        Map<String, BenefitCandidate> confirmedCandidates = new LinkedHashMap<>();
        List<PublicBenefitResDTO> pendingBenefits = new ArrayList<>();
        Set<String> requiredForMatching = new LinkedHashSet<>();

        List<String> keywords = buildKeywords(report).stream()
                .limit(Math.max(1, properties.getMaxKeywords()))
                .toList();

        for (Gov24BenefitCache cached : fetchCachedRows()) {
            Map<String, Object> row = cached.getRawJson();
            if (row == null) {
                continue;
            }
            String matchedKeyword = findMatchedKeyword(row, keywords);
            if (!StringUtils.hasText(matchedKeyword)) {
                continue;
            }
            if (regionMismatch(row, assessment)) {
                continue;
            }
            if (excludedByStructuredCriteria(cached, assessment, isInvoluntary)) {
                continue;
            }

            boolean verifiedMatch = hasVerifiedStructuredMatch(cached, assessment, isInvoluntary);
            BenefitCandidate candidate = toCandidate(report, cached, row, null, matchedKeyword, verifiedMatch);
            if (candidate == null) {
                continue;
            }

            List<String> structuredMissing = missingStructuredFields(cached, assessment);
            if (structuredMissing.isEmpty()) {
                confirmedCandidates.merge(
                        dedupeKey(candidate.benefit()),
                        candidate,
                        (left, right) -> left.score() >= right.score() ? left : right
                );
            } else {
                requiredForMatching.addAll(structuredMissing);
                pendingBenefits.add(withMissingInputs(candidate.benefit(), structuredMissing));
            }
        }

        List<PublicBenefitResDTO> preRanked = confirmedCandidates.values().stream()
                .sorted(Comparator.comparingInt(BenefitCandidate::score).reversed())
                .limit(Math.max(15, properties.getMaxResults()))
                .map(BenefitCandidate::benefit)
                .map(benefit -> trimLongFields(benefit, 1200))
                .toList();

        List<PublicBenefitResDTO> ranked = recommendationService.recommend(report, preRanked).stream()
                .limit(Math.max(1, properties.getMaxResults()))
                .toList();

        return new BenefitRecommendationResult(ranked, pendingBenefits, List.copyOf(requiredForMatching));
    }

    /**
     * 사용자가 입력한 값이 있는데 구조화 조건과 명백히 어긋나는 경우에만 후보에서 제외한다.
     * 조건이 존재해도 사용자 값이 아직 없으면(null) 배제하지 않고 pending으로 넘어간다.
     */
    private boolean excludedByStructuredCriteria(Gov24BenefitCache cached, LifeAssessment assessment, boolean isInvoluntary) {
        Integer age = assessment.getAge();
        if (age != null) {
            if (cached.getMinAge() != null && age < cached.getMinAge()) {
                return true;
            }
            if (cached.getMaxAge() != null && age > cached.getMaxAge()) {
                return true;
            }
        }
        Integer tenureYears = assessment.getTenureYears();
        if (tenureYears != null && cached.getMinTenureYears() != null && tenureYears < cached.getMinTenureYears()) {
            return true;
        }
        Integer insuranceMonths = assessment.getEmploymentInsuranceMonths();
        if (insuranceMonths != null && cached.getMinInsuranceMonths() != null && insuranceMonths < cached.getMinInsuranceMonths()) {
            return true;
        }
        if (Boolean.TRUE.equals(cached.getIsInvoluntarySub()) && !isInvoluntary) {
            return true;
        }

        // 연소득: 사용자 소득구간의 '하한'이 혜택 상한을 이미 넘으면 명백히 자격 밖이다.
        Long incomeLowerBound = annualIncomeLowerBound(assessment.getAnnualIncomeRange());
        if (incomeLowerBound != null && cached.getMaxAnnualIncomeWon() != null
                && incomeLowerBound > cached.getMaxAnnualIncomeWon()) {
            return true;
        }

        // '전용' 혜택인데 사용자가 명시적으로 아니라고 답한 경우만 제외한다(값이 없으면(null) 제외하지 않음).
        if (Boolean.TRUE.equals(cached.getRequiresBasicLivelihood())
                && Boolean.FALSE.equals(assessment.getBasicLivelihoodRecipient())) {
            return true;
        }
        if (Boolean.TRUE.equals(cached.getRequiresSingleParent())
                && Boolean.FALSE.equals(assessment.getSingleParent())) {
            return true;
        }
        if (Boolean.TRUE.equals(cached.getRequiresDisabled())
                && Boolean.FALSE.equals(assessment.getDisabledPerson())) {
            return true;
        }
        // 차상위 전용은 수급자도 대상에 포함되므로, 둘 다 명시적으로 아닐 때만 제외한다.
        if (Boolean.TRUE.equals(cached.getRequiresNearPoverty())
                && Boolean.FALSE.equals(assessment.getNearPoverty())
                && Boolean.FALSE.equals(assessment.getBasicLivelihoodRecipient())) {
            return true;
        }
        return false;
    }

    /**
     * 지역 전용 혜택인데 사용자의 거주지와 다르면 true(제외 대상).
     *
     * <p>소관기관명 앞부분이 광역시·도면 그 지역 주민만 대상이므로, 사용자 시/도와 다르면 제외한다.
     * 시/군/구까지 명시된 혜택(예: "서울특별시 서초구")은 사용자 시/군/구와도 대조한다. 소관기관이
     * 중앙부처/공단 등(전국)이거나, 사용자가 지역을 입력하지 않았으면 제외하지 않는다.
     */
    private boolean regionMismatch(Map<String, Object> row, LifeAssessment assessment) {
        String org = value(row, "소관기관명", "제공기관명", "기관명", "부서명");
        if (!StringUtils.hasText(org)) {
            return false;
        }
        String benefitSido = SIDO_NAMES.stream()
                .filter(org::startsWith)
                .findFirst()
                .orElse(null);
        if (benefitSido == null) {
            // 중앙부처/공단/재단 등 → 전국 대상으로 간주, 지역으로 제외하지 않음.
            return false;
        }

        String userSido = assessment.getRegionSido();
        if (!StringUtils.hasText(userSido)) {
            // 사용자가 지역을 입력하지 않으면 지역으로 걸러낼 근거가 없다.
            return false;
        }
        if (!userSido.startsWith(benefitSido) && !benefitSido.startsWith(userSido)) {
            return true; // 시/도가 다르면 명백히 대상 밖.
        }

        // 시/도가 같고, 혜택이 시/군/구까지 특정하면 시/군/구도 대조한다.
        String benefitSigungu = org.substring(benefitSido.length()).trim();
        if (benefitSigungu.contains(" ")) {
            benefitSigungu = benefitSigungu.substring(0, benefitSigungu.indexOf(' '));
        }
        String userSigungu = assessment.getRegionSigungu();
        if (StringUtils.hasText(benefitSigungu)
                && StringUtils.hasText(userSigungu)
                && !userSigungu.equals(benefitSigungu)) {
            return true;
        }
        return false;
    }

    /** 연소득 구간의 하한(원). 소득 정보가 없거나(UNKNOWN/NONE) 미상이면 null. */
    private Long annualIncomeLowerBound(AnnualIncomeRange range) {
        if (range == null) {
            return null;
        }
        return switch (range) {
            case UNDER_22M -> 12_000_000L;
            case UNDER_32M -> 22_000_000L;
            case UNDER_44M -> 32_000_000L;
            case UNDER_50M -> 44_000_000L;
            case OVER_50M -> 50_000_000L;
            case UNKNOWN, NONE -> null;
        };
    }

    /**
     * 나이·근속연수·고용보험 가입기간·비자발적 이직 여부 중 하나라도 실제 사용자 값과 대조해
     * 자격을 검증한 경우 true를 반환한다. DB에 조건이 있어도 사용자 값이 없어 대조하지 못했다면
     * false다 — "긴급복지"처럼 텍스트만 겹치는 느슨한 매칭보다 신뢰도가 높은 후보를 가중치로
     * 구분하기 위해 사용한다.
     */
    private boolean hasVerifiedStructuredMatch(Gov24BenefitCache cached, LifeAssessment assessment, boolean isInvoluntary) {
        if (assessment.getAge() != null && (cached.getMinAge() != null || cached.getMaxAge() != null)) {
            return true;
        }
        if (assessment.getTenureYears() != null && cached.getMinTenureYears() != null && cached.getMinTenureYears() > 0) {
            return true;
        }
        if (assessment.getEmploymentInsuranceMonths() != null && cached.getMinInsuranceMonths() != null) {
            return true;
        }
        if (Boolean.TRUE.equals(cached.getIsInvoluntarySub()) && isInvoluntary) {
            return true;
        }
        // 소득/수급/한부모/장애 '전용' 조건을 사용자 값과 대조해 부합한 경우도 검증된 매칭으로 본다.
        if (cached.getMaxAnnualIncomeWon() != null && annualIncomeLowerBound(assessment.getAnnualIncomeRange()) != null) {
            return true;
        }
        if (Boolean.TRUE.equals(cached.getRequiresBasicLivelihood()) && Boolean.TRUE.equals(assessment.getBasicLivelihoodRecipient())) {
            return true;
        }
        if (Boolean.TRUE.equals(cached.getRequiresSingleParent()) && Boolean.TRUE.equals(assessment.getSingleParent())) {
            return true;
        }
        if (Boolean.TRUE.equals(cached.getRequiresDisabled()) && Boolean.TRUE.equals(assessment.getDisabledPerson())) {
            return true;
        }
        if (Boolean.TRUE.equals(cached.getRequiresNearPoverty())
                && (Boolean.TRUE.equals(assessment.getNearPoverty()) || Boolean.TRUE.equals(assessment.getBasicLivelihoodRecipient()))) {
            return true;
        }
        return false;
    }

    /**
     * 구조화 조건은 있지만(min/max 등이 non-null) 사용자 입력이 비어 있어 확정 판정이
     * 불가능한 필드 목록을 반환한다. 비어 있으면 확정 가능하다는 뜻이다.
     */
    private List<String> missingStructuredFields(Gov24BenefitCache cached, LifeAssessment assessment) {
        List<String> missing = new ArrayList<>();
        boolean ageConstrained = cached.getMinAge() != null || cached.getMaxAge() != null;
        if (ageConstrained && assessment.getAge() == null) {
            missing.add("age");
        }
        boolean tenureConstrained = cached.getMinTenureYears() != null && cached.getMinTenureYears() > 0;
        if (tenureConstrained && assessment.getTenureYears() == null) {
            missing.add("tenureYears");
        }
        return missing;
    }

    private PublicBenefitResDTO withMissingInputs(PublicBenefitResDTO benefit, List<String> structuredMissing) {
        List<String> combined = new ArrayList<>(benefit.missingInputs() == null ? List.of() : benefit.missingInputs());
        for (String field : structuredMissing) {
            if (!combined.contains(field)) {
                combined.add(field);
            }
        }
        return trimLongFields(benefit, 1200).withAiRecommendation(
                benefit.fitLevel(),
                benefit.priorityGroup(),
                benefit.reason(),
                benefit.aiSummary(),
                combined,
                benefit.relevanceScore()
        );
    }

    private List<Gov24BenefitCache> fetchCachedRows() {
        CachedRows cached = cachedRows;
        Instant now = Instant.now();
        if (cached != null && cached.expiresAt().isAfter(now)) {
            return cached.rows();
        }

        List<Gov24BenefitCache> rows = gov24BenefitCacheRepository.findAll().stream()
                .filter(row -> row.getRawJson() != null)
                .toList();
        if (!rows.isEmpty()) {
            cachedRows = new CachedRows(List.copyOf(rows), now.plus(CACHE_TTL));
        }
        return rows;
    }

    private BenefitCandidate toCandidate(
            LifeReport report,
            Gov24BenefitCache cached,
            Map<String, Object> row,
            Map<String, Object> detail,
            String keyword,
            boolean verifiedMatch
    ) {
        String title = value(row, "서비스명", "서비스명칭", "서비스", "serviceName", "srvNm");
        if (!StringUtils.hasText(title)) {
            return null;
        }

        Map<String, Object> source = detail == null ? row : merge(row, detail);
        LifeAssessment assessment = report.getAssessment();

        String summary = value(source, "서비스목적요약", "서비스목적", "지원내용", "서비스내용", "서비스개요", "summary");
        String provider = value(source, "소관기관명", "제공기관명", "기관명", "부서명", "provider");
        String category = value(source, "서비스분야", "지원유형", "생애주기", "대상자", "분야", "category");
        String applicationUrl = value(source, "온라인신청사이트URL", "온라인신청URL", "신청URL", "상세조회URL", "url", "URL");
        String sourceId = value(source, "서비스ID", "서비스아이디", "서비스관리번호", "서비스코드", "id", "serviceId");
        String supportTarget = value(source, "지원대상", "대상자");
        String selectionCriteria = value(source, "선정기준");
        String supportContent = value(source, "지원내용");
        String applicationMethod = value(source, "신청방법");
        String applicationDeadline = value(source, "신청기한");
        String contact = value(source, "전화문의", "문의처");
        List<RequiredDocumentResDTO> documents = extractDocuments(source);
        String reason = buildReason(assessment, title, summary, provider, keyword);
        int score = score(assessment, cached, title, summary, provider, supportTarget, selectionCriteria, supportContent, applicationDeadline, keyword, applicationUrl, verifiedMatch);
        PublicBenefitFitLevel fitLevel = fitLevel(score, supportTarget, selectionCriteria);
        PublicBenefitPriorityGroup priorityGroup = priorityGroup(assessment, title, supportContent, applicationDeadline, fitLevel);
        List<String> missingInputs = missingInputs(assessment, supportTarget, selectionCriteria);

        PublicBenefitResDTO benefit = new PublicBenefitResDTO(
                title,
                blankToNull(summary),
                blankToNull(provider),
                blankToNull(category),
                blankToNull(applicationUrl),
                blankToNull(sourceId),
                keyword,
                reason,
                SOURCE_LABEL,
                // 런타임 후보는 전부 gov24_benefit_cache(DB)에서 읽어 온다(fetchCachedRows).
                // 라이브 정부24 API를 직접 호출하지 않으므로 출처는 DB다.
                PublicBenefitSourceType.DB,
                fitLevel,
                priorityGroup,
                blankToNull(supportTarget),
                blankToNull(selectionCriteria),
                blankToNull(supportContent),
                blankToNull(applicationMethod),
                blankToNull(applicationDeadline),
                blankToNull(contact),
                documents,
                missingInputs,
                null,
                score
        );
        return new BenefitCandidate(benefit, score);
    }

    private List<String> buildKeywords(LifeReport report) {
        Set<String> keywords = new LinkedHashSet<>();
        LifeAssessment assessment = report.getAssessment();

        if (assessment.getEventType() == LifeEventType.RETIREMENT) {
            keywords.addAll(List.of("실업급여", "구직급여", "퇴직", "재취업", "직업훈련", "생활안정"));
        } else if (assessment.getEventType() == LifeEventType.UNEMPLOYMENT) {
            keywords.addAll(List.of("실업", "구직", "국민취업지원", "직업훈련", "긴급복지", "생활안정"));
        } else {
            keywords.addAll(List.of("이직", "재취업", "취업", "직업훈련", "내일배움", "고용"));
        }

        report.getItems().forEach(item -> {
            switch (item.getProcedureType()) {
                case UNEMPLOYMENT_BENEFIT -> keywords.addAll(List.of("구직", "고용보험"));
                case HEALTH_INSURANCE_CONTINUATION -> keywords.addAll(List.of("건강보험", "보험료"));
                case NATIONAL_PENSION_EXCEPTION -> keywords.addAll(List.of("국민연금", "납부예외"));
                case TAX_CHECK -> keywords.addAll(List.of("근로장려금", "소득세"));
                case SEVERANCE_PAY -> keywords.addAll(List.of("체불", "임금"));
            }
        });

        if (StringUtils.hasText(assessment.getRegionSigungu())) {
            keywords.add(assessment.getRegionSigungu());
        }
        if (StringUtils.hasText(assessment.getRegionSido())) {
            keywords.add(assessment.getRegionSido());
        }
        return List.copyOf(keywords);
    }

    private String findMatchedKeyword(Map<String, Object> row, List<String> keywords) {
        String merged = joinForSearch(
                value(row, "서비스명", "서비스명칭", "서비스", "serviceName", "srvNm"),
                value(row, "서비스목적요약", "서비스목적", "지원내용", "서비스내용", "서비스개요", "summary"),
                value(row, "지원내용", "지원대상", "선정기준"),
                value(row, "소관기관명", "제공기관명", "기관명", "부서명", "provider"),
                value(row, "서비스분야", "지원유형", "생애주기", "대상자", "분야", "category")
        );
        for (String keyword : keywords) {
            if (contains(merged, keyword)) {
                return keyword;
            }
        }
        return null;
    }

    private String buildReason(
            LifeAssessment assessment,
            String title,
            String summary,
            String provider,
            String keyword
    ) {
        String merged = joinForSearch(title, summary, provider);
        if (contains(merged, assessment.getRegionSigungu())) {
            return assessment.getRegionSigungu() + " 지역 조건이 걸린 공공서비스라 신청 가능성을 확인해 볼 만해요.";
        }
        if (contains(merged, assessment.getRegionSido())) {
            return assessment.getRegionSido() + " 지역 공공서비스라 거주지 기준 확인이 필요해요.";
        }
        return "'" + keyword + "' 상황과 연결되는 공공서비스예요. 소득, 고용보험, 거주지 조건을 확인해 보세요.";
    }

    private int score(
            LifeAssessment assessment,
            Gov24BenefitCache cached,
            String title,
            String summary,
            String provider,
            String supportTarget,
            String selectionCriteria,
            String supportContent,
            String applicationDeadline,
            String matchedKeyword,
            String applicationUrl,
            boolean verifiedMatch
    ) {
        int score = 0;
        String merged = joinForSearch(title, summary, provider, supportTarget, selectionCriteria, supportContent);

        if (verifiedMatch) {
            // 나이·근속연수 등 구조화 조건을 실제 사용자 값과 대조해 확정한 후보는, "긴급복지"류
            // 키워드만 겹치는 느슨한 매칭보다 신뢰도가 높으므로 우선 노출되도록 가중치를 준다.
            score += 50;
        }
        if (contains(title, matchedKeyword)) {
            score += 40;
        }
        if (contains(merged, matchedKeyword)) {
            score += 20;
        }
        if (contains(merged, assessment.getRegionSigungu())) {
            score += 24;
        } else if (contains(merged, assessment.getRegionSido())) {
            score += 14;
        }
        if (StringUtils.hasText(applicationUrl)) {
            score += 6;
        }
        if (containsAny(merged, "구직", "취업", "고용", "훈련", "실업", "생계", "생활안정", "긴급")) {
            score += 10;
        }
        if (assessment.getCurrentIncomeStatus() != null && containsAny(merged, "저소득", "소득", "무소득", "생계")) {
            score += 8;
        }
        if (assessment.getHouseholdType() == HouseholdType.WITH_CHILDREN || Boolean.TRUE.equals(assessment.getHasDependentChildren())) {
            if (containsAny(merged, "자녀", "아동", "양육", "가구")) {
                score += 10;
            }
        }
        // 수급/차상위/한부모/장애: 구조화 컬럼이 추출돼 있으면 정확한 컬럼 매칭을 쓰고,
        // 아직 추출 전(null)이면 기존 텍스트 포함 검사로 폴백한다.
        if (Boolean.TRUE.equals(assessment.getBasicLivelihoodRecipient())) {
            if (cached.getRequiresBasicLivelihood() != null) {
                if (Boolean.TRUE.equals(cached.getRequiresBasicLivelihood())) {
                    score += 14;
                }
            } else if (containsAny(merged, "기초생활", "수급자")) {
                score += 14;
            }
        }
        if (Boolean.TRUE.equals(assessment.getNearPoverty())) {
            if (cached.getRequiresNearPoverty() != null) {
                if (Boolean.TRUE.equals(cached.getRequiresNearPoverty())) {
                    score += 12;
                }
            } else if (containsAny(merged, "차상위", "저소득")) {
                score += 12;
            }
        }
        if (Boolean.TRUE.equals(assessment.getSingleParent())) {
            if (cached.getRequiresSingleParent() != null) {
                if (Boolean.TRUE.equals(cached.getRequiresSingleParent())) {
                    score += 12;
                }
            } else if (contains(merged, "한부모")) {
                score += 12;
            }
        }
        if (Boolean.TRUE.equals(assessment.getDisabledPerson())) {
            if (cached.getRequiresDisabled() != null) {
                if (Boolean.TRUE.equals(cached.getRequiresDisabled())) {
                    score += 12;
                }
            } else if (containsAny(merged, "장애", "장애인")) {
                score += 12;
            }
        }
        // 연소득: 사용자 소득이 혜택 상한 이하로 확인되면 정합성 가점.
        Long incomeLowerBound = annualIncomeLowerBound(assessment.getAnnualIncomeRange());
        if (incomeLowerBound != null && cached.getMaxAnnualIncomeWon() != null
                && incomeLowerBound <= cached.getMaxAnnualIncomeWon()) {
            score += 8;
        }
        if (assessment.getHousingType() != null && containsAny(merged, "월세", "전세", "주거", "임대")) {
            score += 8;
        }
        if (containsAny(applicationDeadline, "상시", "수시")) {
            score += 4;
        } else if (StringUtils.hasText(applicationDeadline)) {
            score += 8;
        }
        return score;
    }

    private PublicBenefitFitLevel fitLevel(int score, String supportTarget, String selectionCriteria) {
        String merged = joinForSearch(supportTarget, selectionCriteria);
        if (containsAny(merged, "제외", "해당되지 않는", "불가") && score < 70) {
            return PublicBenefitFitLevel.NEEDS_CHECK;
        }
        if (score >= 78) {
            return PublicBenefitFitLevel.HIGH;
        }
        if (score >= 42) {
            return PublicBenefitFitLevel.NEEDS_CHECK;
        }
        return PublicBenefitFitLevel.LOW;
    }

    private PublicBenefitPriorityGroup priorityGroup(
            LifeAssessment assessment,
            String title,
            String supportContent,
            String applicationDeadline,
            PublicBenefitFitLevel fitLevel
    ) {
        String merged = joinForSearch(title, supportContent);
        if (fitLevel == PublicBenefitFitLevel.LOW) {
            return PublicBenefitPriorityGroup.LOW;
        }
        if (StringUtils.hasText(applicationDeadline) && !containsAny(applicationDeadline, "상시", "수시")) {
            return PublicBenefitPriorityGroup.DEADLINE;
        }
        if (containsAny(merged, "현금", "지원금", "급여", "장려금", "대출", "보증", "감면")) {
            return PublicBenefitPriorityGroup.TOP_MONEY;
        }
        if (contains(merged, assessment.getRegionSigungu()) || contains(merged, assessment.getRegionSido())) {
            return PublicBenefitPriorityGroup.LOCAL;
        }
        return PublicBenefitPriorityGroup.NEEDS_INFO;
    }

    private List<String> missingInputs(LifeAssessment assessment, String supportTarget, String selectionCriteria) {
        String merged = joinForSearch(supportTarget, selectionCriteria);
        List<String> missing = new ArrayList<>();
        if (containsAny(merged, "연소득", "총소득", "소득요건", "소득기준") && assessment.getAnnualIncomeRange() == null) {
            missing.add("연소득 범위");
        }
        if (containsAny(merged, "재산", "자산") && assessment.getAssetRange() == null) {
            missing.add("재산 범위");
        }
        if (containsAny(merged, "가구", "배우자", "부양", "자녀") && assessment.getHouseholdType() == null) {
            missing.add("가구 형태");
        }
        if (containsAny(merged, "월세", "전세", "주거", "임대") && assessment.getHousingType() == null) {
            missing.add("주거 형태");
        }
        return missing.stream().distinct().limit(4).toList();
    }

    private List<RequiredDocumentResDTO> extractDocuments(Map<String, Object> source) {
        List<RequiredDocumentResDTO> documents = new ArrayList<>();
        addDocuments(documents, value(source, "구비서류"), "신청자 준비", true);
        addDocuments(documents, value(source, "본인확인필요구비서류"), "본인 확인", true);
        addDocuments(documents, value(source, "공무원확인구비서류"), "기관 확인", false);
        return documents.stream()
                .filter(doc -> StringUtils.hasText(doc.documentName()) && !"해당없음".equals(doc.documentName()))
                .limit(8)
                .toList();
    }

    private void addDocuments(List<RequiredDocumentResDTO> documents, String raw, String issuer, boolean required) {
        if (!StringUtils.hasText(raw) || raw.contains("해당없음")) {
            return;
        }
        String normalized = raw.replace("||", "\n");
        for (String line : normalized.split("\\r?\\n")) {
            String name = line.replaceFirst("^[\\-ㆍ○\\*\\s]+", "").trim();
            if (StringUtils.hasText(name) && name.length() >= 2) {
                documents.add(new RequiredDocumentResDTO(name, null, issuer, required));
            }
        }
    }

    private PublicBenefitResDTO trimLongFields(PublicBenefitResDTO benefit, int maxLength) {
        return new PublicBenefitResDTO(
                benefit.title(),
                shorten(benefit.summary(), maxLength),
                benefit.provider(),
                benefit.category(),
                benefit.applicationUrl(),
                benefit.sourceId(),
                benefit.matchedKeyword(),
                benefit.reason(),
                benefit.sourceLabel(),
                benefit.sourceType(),
                benefit.fitLevel(),
                benefit.priorityGroup(),
                shorten(benefit.supportTarget(), maxLength),
                shorten(benefit.selectionCriteria(), maxLength),
                shorten(benefit.supportContent(), maxLength),
                benefit.applicationMethod(),
                benefit.applicationDeadline(),
                benefit.contact(),
                benefit.requiredDocuments() == null ? List.of() : benefit.requiredDocuments(),
                benefit.missingInputs() == null ? List.of() : benefit.missingInputs(),
                benefit.aiSummary(),
                benefit.relevanceScore()
        );
    }

    private String shorten(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength - 1) + "…";
    }

    private String value(Map<String, Object> row, String... keys) {
        for (String key : keys) {
            Object exact = row.get(key);
            if (exact != null && StringUtils.hasText(String.valueOf(exact))) {
                return String.valueOf(exact).trim();
            }
        }

        for (Map.Entry<String, Object> entry : row.entrySet()) {
            String normalizedKey = normalize(entry.getKey());
            for (String key : keys) {
                if (normalizedKey.equals(normalize(key))
                        && entry.getValue() != null
                        && StringUtils.hasText(String.valueOf(entry.getValue()))) {
                    return String.valueOf(entry.getValue()).trim();
                }
            }
        }
        return null;
    }

    private Map<String, Object> merge(Map<String, Object> base, Map<String, Object> detail) {
        Map<String, Object> result = new LinkedHashMap<>(base);
        detail.forEach((key, value) -> {
            if (value != null && StringUtils.hasText(String.valueOf(value))) {
                result.put(key, value);
            }
        });
        return result;
    }

    private String dedupeKey(PublicBenefitResDTO benefit) {
        if (StringUtils.hasText(benefit.sourceId())) {
            return normalize(benefit.sourceId());
        }
        return normalize(nullToBlank(benefit.title()) + "::" + nullToBlank(benefit.provider()));
    }

    private boolean containsAny(String target, String... needles) {
        for (String needle : needles) {
            if (contains(target, needle)) {
                return true;
            }
        }
        return false;
    }

    private boolean contains(String target, String needle) {
        return StringUtils.hasText(target)
                && StringUtils.hasText(needle)
                && target.contains(needle);
    }

    private String joinForSearch(String... values) {
        StringBuilder builder = new StringBuilder();
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                builder.append(value).append(' ');
            }
        }
        return builder.toString();
    }

    private String blankToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String nullToBlank(String value) {
        return value == null ? "" : value;
    }

    private String normalize(String value) {
        return nullToBlank(value)
                .replaceAll("\\s+", "")
                .toLowerCase(Locale.ROOT);
    }

    private record CachedRows(List<Gov24BenefitCache> rows, Instant expiresAt) {
    }

    private record BenefitCandidate(PublicBenefitResDTO benefit, int score) {
    }
}
