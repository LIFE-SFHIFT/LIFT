import type {
  AnnualIncomeRange,
  AssessmentCreateRequest,
  AssessmentPatchRequest,
  AssessmentResponse,
  ChatMessage,
  ChatMessageCreateResponse,
  ChatMessagesResponse,
  CommunityCategory,
  CommunityComment,
  CommunityCommentCreateRequest,
  CommunityLikeResponse,
  CommunityPostCreateRequest,
  CommunityPostDetail,
  CommunityPostSummary,
  DocumentFetchResponse,
  EligibilityLevel,
  LatestChatReport,
  LatestReportRoute,
  LifeEventType,
  PaymentCompleteRequest,
  PaymentResponse,
  PublicBenefit,
  ReportDetail,
  ReportItem,
  ReportPdfEstimateRequest,
  ReportPreview,
  ReportPlanType,
  ResignationReason,
  TossPaymentConfirmRequest,
  UserAgreementRequest,
  UserAgreementResponse,
  UserProfile,
  UserProfileUpdateRequest,
} from "./types";

const PROFILE_KEY = "lift.demo.profile";
const REPORT_KEY = "lift.demo.report";
const ASSESSMENT_KEY = "lift.demo.assessment";
const CHAT_KEY = "lift.demo.chat";
const COMMUNITY_KEY = "lift.demo.community";
const ASSESSMENT_INPUTS_KEY = "lift.demo.assessmentInputs";

function planPrice(plan: ReportPlanType): number {
  return plan === "PLUS" ? 13_900 : 6_900;
}

function planFromAmount(amount?: number | null): ReportPlanType {
  return amount === 6_900 ? "BASIC" : "PLUS";
}

function planAiLimit(plan: ReportPlanType): number {
  return plan === "PLUS" ? 10 : 0;
}

/**
 * 데모 로그인(백엔드 미연동) 전용 목업 혜택 카탈로그.
 *
 * <p>실제 백엔드는 Supabase gov24_benefit_cache(100+건)를 읽어 매칭하지만, 데모는 프론트에서만
 * 돌아가므로 대표성 있는 소규모 카탈로그를 두고 백엔드와 동일한 매칭 규칙(키워드·지역·나이·특성)을
 * 적용한다. 그래서 데모에서도 입력값(지역/나이/장애/한부모/소득 등)에 따라 후보가 달라진다.
 *
 * regionSido가 null이면 전국(중앙부처), requires*가 true면 그 특성 전용(해당자만 노출)이다.
 */
interface DemoCatalogItem {
  title: string;
  provider: string;
  category: string;
  summary: string;
  supportTarget: string;
  benefitType: "CASH" | "TRAINING" | "SERVICE";
  /** 이 혜택이 연결되는 상황 키워드. 사용자 상황 키워드와 겹치면 후보로 잡힌다. */
  keywords: string[];
  regionSido?: string;
  regionSigungu?: string;
  minAge?: number;
  maxAge?: number;
  minInsuranceMonths?: number;
  isInvoluntarySub?: boolean;
  requiresDisabled?: boolean;
  requiresSingleParent?: boolean;
  requiresBasicLivelihood?: boolean;
  requiresNearPoverty?: boolean;
  applicationDeadline?: string;
  applicationUrl?: string;
  contact?: string;
  requiredDocuments?: string[];
  /** 기본 관련도 점수(높을수록 상단). 지역·특성·나이 정합 시 가점된다. */
  baseScore: number;
}

const DEMO_CATALOG: DemoCatalogItem[] = [
  // ── 전국 · 고용/실업 ──
  {
    title: "실업급여(구직급여)",
    provider: "고용노동부",
    category: "고용·창업",
    summary: "비자발적으로 이직한 고용보험 피보험자에게 구직급여를 지급합니다.",
    supportTarget: "고용보험 가입 후 비자발적으로 이직해 재취업을 준비하는 구직자",
    benefitType: "CASH",
    keywords: ["실업", "구직", "구직급여", "실업급여", "고용보험"],
    minInsuranceMonths: 6,
    applicationDeadline: "이직 후 지체없이",
    applicationUrl: "https://www.work24.go.kr",
    contact: "1350",
    requiredDocuments: ["이직확인서", "고용보험 피보험자격 이력"],
    baseScore: 88,
  },
  {
    title: "국민취업지원제도",
    provider: "고용노동부",
    category: "고용·창업",
    summary: "저소득 구직자에게 구직촉진수당과 취업지원서비스를 제공합니다.",
    supportTarget: "15~69세 저소득 구직자",
    benefitType: "CASH",
    keywords: ["구직", "국민취업지원", "실업", "취업"],
    minAge: 15,
    maxAge: 69,
    applicationDeadline: "상시신청",
    applicationUrl: "https://www.work24.go.kr",
    contact: "1350",
    baseScore: 84,
  },
  {
    title: "국민내일배움카드",
    provider: "고용노동부",
    category: "고용·창업",
    summary: "직업훈련 희망자에게 훈련비와 훈련장려금을 지원합니다.",
    supportTarget: "직업훈련을 희망하는 국민(만 75세 이상 등 제외)",
    benefitType: "TRAINING",
    keywords: ["직업훈련", "내일배움", "재취업", "취업"],
    minAge: 15,
    maxAge: 75,
    applicationDeadline: "상시신청",
    applicationUrl: "https://www.hrd.go.kr",
    contact: "1350",
    requiredDocuments: ["신분증", "직업훈련 가입신청서"],
    baseScore: 80,
  },
  {
    title: "조기재취업수당",
    provider: "고용노동부",
    category: "고용·창업",
    summary: "구직급여 수급 중 조기에 재취업하면 남은 급여의 일부를 지급합니다.",
    supportTarget: "구직급여 수급자 중 소정급여일수를 절반 이상 남기고 재취업한 사람",
    benefitType: "CASH",
    keywords: ["재취업", "구직", "취업"],
    applicationDeadline: "재취업 후 12개월 경과 시",
    contact: "1350",
    baseScore: 68,
  },
  {
    title: "청년 일자리 도약 장려금",
    provider: "고용노동부",
    category: "고용·창업",
    summary: "청년(만 15~34세)을 정규직으로 채용한 중소기업에 인건비를 지원합니다.",
    supportTarget: "만 15~34세 청년",
    benefitType: "CASH",
    keywords: ["취업", "고용", "청년", "재취업"],
    minAge: 15,
    maxAge: 34,
    applicationUrl: "https://www.work24.go.kr",
    requiredDocuments: ["근로계약서", "사업자등록증"],
    baseScore: 82,
  },
  {
    title: "긴급복지 생계지원",
    provider: "보건복지부",
    category: "생활안정",
    summary: "갑작스러운 위기로 생계가 곤란한 가구에 생계비를 지원합니다.",
    supportTarget: "실직·휴폐업 등 위기사유로 생계가 곤란한 가구",
    benefitType: "CASH",
    keywords: ["긴급복지", "생활안정", "생계", "실업"],
    applicationDeadline: "상시신청",
    contact: "129",
    baseScore: 76,
  },
  // ── 전국 · 고령 ──
  {
    title: "노인 일자리 및 사회활동 지원",
    provider: "보건복지부",
    category: "고용·창업",
    summary: "만 65세 이상 어르신에게 일자리와 활동수당을 제공합니다.",
    supportTarget: "만 65세 이상(일부 60세 이상)",
    benefitType: "SERVICE",
    keywords: ["노인", "고령", "일자리"],
    minAge: 60,
    applicationDeadline: "연중 모집",
    baseScore: 74,
  },
  {
    title: "노인 보청기 지원 사업",
    provider: "보건복지부",
    category: "생활안정",
    summary: "저소득 어르신에게 보청기 구입비를 지원합니다.",
    supportTarget: "만 65세 이상 기초생활수급자·차상위계층",
    benefitType: "SERVICE",
    keywords: ["노인", "고령"],
    minAge: 65,
    requiresNearPoverty: true,
    baseScore: 60,
  },
  // ── 지역 특정 ──
  {
    title: "서울형 긴급복지지원",
    provider: "서울특별시",
    category: "생활안정",
    summary: "위기상황에 처한 서울시민에게 생계·의료·주거비를 신속 지원합니다.",
    supportTarget: "위기상황에 처한 서울 거주 중위소득 100% 이하 시민",
    benefitType: "CASH",
    keywords: ["긴급복지", "생활안정", "생계"],
    regionSido: "서울특별시",
    applicationDeadline: "상시신청",
    baseScore: 78,
  },
  {
    title: "경기도형 긴급복지",
    provider: "경기도",
    category: "생활안정",
    summary: "위기상황이 발생한 경기도 가구에 단기 생계·주거·의료비를 지원합니다.",
    supportTarget: "위기상황에 처한 경기 거주 중위소득 100% 이하 가구",
    benefitType: "CASH",
    keywords: ["긴급복지", "생활안정", "생계"],
    regionSido: "경기도",
    applicationDeadline: "상시신청",
    baseScore: 78,
  },
  {
    title: "부산형 긴급복지지원",
    provider: "부산광역시",
    category: "생활안정",
    summary: "위기상황에 처한 부산시민에게 생계·의료비를 지원합니다.",
    supportTarget: "위기상황에 처한 부산 거주 저소득 시민",
    benefitType: "CASH",
    keywords: ["긴급복지", "생활안정", "생계"],
    regionSido: "부산광역시",
    applicationDeadline: "상시신청",
    baseScore: 78,
  },
  // ── 특성(전용) ──
  {
    title: "장애인 취업성공패키지",
    provider: "고용노동부",
    category: "고용·창업",
    summary: "구직 장애인에게 단계별 취업지원 서비스와 수당을 제공합니다.",
    supportTarget: "만 18~69세 구직장애인",
    benefitType: "SERVICE",
    keywords: ["장애", "취업", "구직", "직업훈련"],
    minAge: 18,
    maxAge: 69,
    requiresDisabled: true,
    applicationUrl: "https://www.work24.go.kr",
    baseScore: 84,
  },
  {
    title: "저소득 한부모가족 생활안정 지원",
    provider: "성평등가족부",
    category: "생활안정",
    summary: "저소득 한부모가족에게 아동양육비 등 생활안정 비용을 지원합니다.",
    supportTarget: "기준 중위소득 이하 한부모가족",
    benefitType: "CASH",
    keywords: ["한부모", "생활안정", "양육"],
    requiresSingleParent: true,
    applicationDeadline: "상시신청",
    baseScore: 80,
  },
  {
    title: "기초생활보장 생계급여",
    provider: "보건복지부",
    category: "생활안정",
    summary: "소득인정액이 기준 중위소득 32% 이하인 가구에 생계급여를 지급합니다.",
    supportTarget: "기초생활수급(생계급여) 대상 가구",
    benefitType: "CASH",
    keywords: ["기초생활", "생계", "생활안정", "수급"],
    requiresBasicLivelihood: true,
    applicationDeadline: "상시신청",
    baseScore: 78,
  },
  {
    title: "자활근로(기초·차상위)",
    provider: "보건복지부",
    category: "고용·창업",
    summary: "근로능력 있는 저소득층에게 자활 일자리와 소득을 제공합니다.",
    supportTarget: "기초생활수급자·차상위계층 중 근로 가능자",
    benefitType: "SERVICE",
    keywords: ["차상위", "자활", "생활안정", "취업", "일자리"],
    requiresNearPoverty: true,
    applicationDeadline: "상시신청",
    baseScore: 72,
  },
];

const INVOLUNTARY_REASONS: ResignationReason[] = [
  "CONTRACT_EXPIRED",
  "RECOMMENDED_RESIGNATION",
  "COMPANY_CLOSURE",
];

/** 사용자가 입력한 시/도와 혜택 지역이 명백히 다르면 true(제외 대상). 백엔드 regionMismatch와 동일. */
function demoRegionMismatch(item: DemoCatalogItem, inputs: DemoAssessmentInputs): boolean {
  if (!item.regionSido) return false; // 전국(중앙부처)
  if (!inputs.regionSido) return false; // 사용자가 지역 미입력 → 거를 근거 없음
  if (item.regionSido !== inputs.regionSido) return true;
  if (item.regionSigungu && inputs.regionSigungu && item.regionSigungu !== inputs.regionSigungu) {
    return true;
  }
  return false;
}

/** 사용자 상황·특성에서 검색 키워드를 만든다. 백엔드 buildKeywords + 특성 키워드 확장과 동일한 취지. */
function demoSituationKeywords(inputs: DemoAssessmentInputs): string[] {
  const kw = new Set<string>();
  const base: Record<string, string[]> = {
    RETIREMENT: ["실업급여", "구직급여", "구직", "실업", "퇴직", "재취업", "직업훈련", "내일배움", "생활안정", "고용", "긴급복지", "생계", "취업", "고용보험"],
    UNEMPLOYMENT: ["실업", "구직", "구직급여", "국민취업지원", "직업훈련", "내일배움", "긴급복지", "생활안정", "생계", "재취업", "취업", "고용", "고용보험"],
    JOB_CHANGE: ["이직", "재취업", "취업", "직업훈련", "내일배움", "고용", "구직", "일자리"],
  };
  (base[inputs.eventType ?? "UNEMPLOYMENT"] ?? base.UNEMPLOYMENT).forEach((k) => kw.add(k));
  // 특성/나이 키워드: 해당자에게만 관련 혜택이 잡히도록 확장
  if (inputs.disabledPerson) kw.add("장애");
  if (inputs.singleParent) { kw.add("한부모"); kw.add("양육"); }
  if (inputs.basicLivelihoodRecipient) { kw.add("기초생활"); kw.add("수급"); }
  if (inputs.nearPoverty) { kw.add("차상위"); kw.add("자활"); }
  if (inputs.age != null && inputs.age >= 60) { kw.add("노인"); kw.add("고령"); }
  return Array.from(kw);
}

interface DemoAssessmentInputs {
  eventType: LifeEventType | null;
  age: number | null;
  tenureYears: number | null;
  employmentInsuranceMonths: number | null;
  resignationReason: ResignationReason | null;
  regionSido: string | null;
  regionSigungu: string | null;
  disabledPerson: boolean;
  singleParent: boolean;
  basicLivelihoodRecipient: boolean;
  nearPoverty: boolean;
}

function saveAssessmentInputs(inputs: DemoAssessmentInputs): DemoAssessmentInputs {
  return writeJson(ASSESSMENT_INPUTS_KEY, inputs);
}

function readAssessmentInputs(): DemoAssessmentInputs {
  return readJson(ASSESSMENT_INPUTS_KEY, {
    eventType: null,
    age: null,
    tenureYears: null,
    employmentInsuranceMonths: null,
    resignationReason: null,
    regionSido: null,
    regionSigungu: null,
    disabledPerson: false,
    singleParent: false,
    basicLivelihoodRecipient: false,
    nearPoverty: false,
  });
}

/** 진단 요청(payload)에서 데모 매칭 입력을 추출한다. boolean 특성은 미응답(undefined)을 false로 본다. */
function toDemoInputs(payload: AssessmentCreateRequest): DemoAssessmentInputs {
  return {
    eventType: payload.eventType ?? null,
    age: payload.age ?? null,
    tenureYears: payload.tenureYears ?? null,
    employmentInsuranceMonths: payload.employmentInsuranceMonths ?? null,
    resignationReason: payload.resignationReason ?? null,
    regionSido: payload.regionSido ?? null,
    regionSigungu: payload.regionSigungu ?? null,
    disabledPerson: payload.disabledPerson === true,
    singleParent: payload.singleParent === true,
    basicLivelihoodRecipient: payload.basicLivelihoodRecipient === true,
    nearPoverty: payload.nearPoverty === true,
  };
}

/** 카탈로그 항목 + 계산된 점수/보류필드를 화면용 PublicBenefit으로 변환한다. */
function toDemoBenefit(
  item: DemoCatalogItem,
  score: number,
  missing: string[],
  situationKw: string[],
): PublicBenefit {
  const matched = item.keywords.find((k) => situationKw.includes(k)) ?? item.keywords[0];
  const fitLevel: PublicBenefit["fitLevel"] =
    score >= 82 ? "HIGH" : score >= 55 ? "NEEDS_CHECK" : "LOW";
  const hasDeadline =
    item.applicationDeadline != null &&
    !["상시신청", "연중 모집"].includes(item.applicationDeadline);
  const priorityGroup: PublicBenefit["priorityGroup"] = hasDeadline
    ? "DEADLINE"
    : item.benefitType === "CASH"
      ? "TOP_MONEY"
      : item.regionSido
        ? "LOCAL"
        : "NEEDS_INFO";
  return {
    title: item.title,
    summary: item.summary,
    provider: item.provider,
    category: item.category,
    applicationUrl: item.applicationUrl ?? null,
    sourceId: `demo-${item.title}`,
    matchedKeyword: matched,
    reason: `'${matched}' 상황과 연결되는 공공서비스예요. 소득·거주지 조건을 확인해 보세요.`,
    sourceLabel: "공공데이터포털 · 정부24 공공서비스 (데모)",
    sourceType: "GOV24_API",
    fitLevel,
    priorityGroup,
    supportTarget: item.supportTarget,
    selectionCriteria: null,
    supportContent: item.summary,
    applicationMethod: null,
    applicationDeadline: item.applicationDeadline ?? null,
    contact: item.contact ?? null,
    requiredDocuments: (item.requiredDocuments ?? []).map((name) => ({
      documentName: name,
      description: null,
      issuer: null,
      required: true,
    })),
    missingInputs: missing,
    aiSummary: null,
    relevanceScore: score,
  };
}

/**
 * 데모 카탈로그를 사용자 입력으로 매칭한다. 백엔드 Gov24PublicBenefitService와 동일한 규칙:
 * 키워드 매칭 → 지역 불일치 제외 → 특성 전용 제외 → 나이/가입기간 제외 → 나이 미입력 시 보류(pending)
 * → 점수 계산 → 관련도 내림차순 정렬.
 */
function buildDemoBenefits(inputs: DemoAssessmentInputs): {
  ranked: PublicBenefit[];
  pending: PublicBenefit[];
  requiredForMatching: string[];
} {
  const isInvoluntary = Boolean(
    inputs.resignationReason && INVOLUNTARY_REASONS.includes(inputs.resignationReason),
  );
  const situationKw = demoSituationKeywords(inputs);
  const confirmed: PublicBenefit[] = [];
  const pending: PublicBenefit[] = [];
  const required = new Set<string>();

  for (const item of DEMO_CATALOG) {
    // 1) 키워드 매칭: 상황 키워드와 하나라도 겹쳐야 후보
    if (!item.keywords.some((k) => situationKw.includes(k))) continue;
    // 2) 지역 불일치 제외
    if (demoRegionMismatch(item, inputs)) continue;
    // 3) 특성 '전용' 혜택인데 해당자가 아니면 제외
    if (item.requiresDisabled && !inputs.disabledPerson) continue;
    if (item.requiresSingleParent && !inputs.singleParent) continue;
    if (item.requiresBasicLivelihood && !inputs.basicLivelihoodRecipient) continue;
    if (item.requiresNearPoverty && !inputs.nearPoverty && !inputs.basicLivelihoodRecipient) continue;
    // 4) 고용보험 가입기간 미달 제외
    if (
      item.minInsuranceMonths != null &&
      inputs.employmentInsuranceMonths != null &&
      inputs.employmentInsuranceMonths < item.minInsuranceMonths
    ) {
      continue;
    }
    // 5) 비자발적 이직 요건
    if (item.isInvoluntarySub && !isInvoluntary) continue;
    // 6) 나이: 값이 있으면 범위 밖 제외, 없으면 보류
    const ageConstrained = item.minAge != null || item.maxAge != null;
    if (ageConstrained && inputs.age != null) {
      if (item.minAge != null && inputs.age < item.minAge) continue;
      if (item.maxAge != null && inputs.age > item.maxAge) continue;
    }
    const missing: string[] = [];
    if (ageConstrained && inputs.age == null) missing.push("age");

    // 점수: 지역·특성·나이 정합 시 가점
    let score = item.baseScore;
    if (item.regionSido && item.regionSido === inputs.regionSido) score += 12;
    if (item.requiresDisabled && inputs.disabledPerson) score += 10;
    if (item.requiresSingleParent && inputs.singleParent) score += 10;
    if (item.requiresBasicLivelihood && inputs.basicLivelihoodRecipient) score += 10;
    if (item.requiresNearPoverty && (inputs.nearPoverty || inputs.basicLivelihoodRecipient)) score += 8;
    if (ageConstrained && inputs.age != null) score += 6;
    if (item.isInvoluntarySub && isInvoluntary) score += 8;

    const benefit = toDemoBenefit(item, score, missing, situationKw);
    if (missing.length > 0) {
      pending.push(benefit);
      missing.forEach((m) => required.add(m));
    } else {
      confirmed.push(benefit);
    }
  }

  return {
    ranked: confirmed.sort((a, b) => b.relevanceScore - a.relevanceScore),
    pending,
    requiredForMatching: Array.from(required),
  };
}

const now = () => new Date().toISOString();

const defaultProfile: UserProfile = {
  userId: 0,
  nickname: "데모 사용자",
  email: null,
  provider: "demo",
  childName: null,
  childBirthYear: null,
  childBirthMonth: null,
  careAreas: [],
  characteristicKeyword: null,
  interests: [],
  sido: null,
  sigungu: null,
  householdType: "UNKNOWN",
  annualIncomeRange: "UNKNOWN",
  assetRange: "UNKNOWN",
  housingType: "UNKNOWN",
  hasDependentChildren: false,
  hasSupportingFamily: false,
  basicLivelihoodRecipient: false,
  nearPoverty: false,
  singleParent: false,
  disabledPerson: false,
  guardianNickname: "데모 사용자",
  guardianType: null,
  communityRoleType: null,
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): T {
  window.localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function profile(): UserProfile {
  return readJson(PROFILE_KEY, defaultProfile);
}

function saveProfile(next: UserProfile): UserProfile {
  return writeJson(PROFILE_KEY, next);
}

function normalizeReport(report: ReportDetail): ReportDetail {
  const legacy = report as Partial<ReportDetail>;
  if (report.paymentStatus === "PAID" && legacy.paymentPlan == null) {
    return {
      ...report,
      paymentPlan: "PLUS",
      paymentAmount: 13_900,
      aiChatAvailable: true,
      pdfAvailable: true,
      aiQuestionLimit: report.aiQuestionLimit || 10,
      aiQuestionRemaining: report.aiQuestionRemaining || Math.max(0, 10 - report.aiQuestionUsedCount),
    };
  }

  return {
    ...report,
    paymentPlan: legacy.paymentPlan ?? null,
    paymentAmount: legacy.paymentAmount ?? null,
    aiChatAvailable: Boolean(legacy.aiChatAvailable),
    pdfAvailable: Boolean(legacy.pdfAvailable),
    aiQuestionLimit: legacy.aiQuestionLimit ?? 0,
    aiQuestionUsedCount: legacy.aiQuestionUsedCount ?? 0,
    aiQuestionRemaining: legacy.aiQuestionRemaining ?? 0,
  };
}

function latestReport(): ReportDetail | null {
  const report = readJson<ReportDetail | null>(REPORT_KEY, null);
  return report ? normalizeReport(report) : null;
}

function saveReport(report: ReportDetail): ReportDetail {
  return writeJson(REPORT_KEY, normalizeReport(report));
}

// PDF 저장 시 월급으로 예상액을 재계산하려면 원본 진단 입력이 필요하므로 함께 보관한다.
function savedAssessment(): AssessmentCreateRequest | null {
  return readJson<AssessmentCreateRequest | null>(ASSESSMENT_KEY, null);
}

function saveAssessment(payload: AssessmentCreateRequest): AssessmentCreateRequest {
  return writeJson(ASSESSMENT_KEY, payload);
}

// ─── 데모 금액 계산: 백엔드 BenefitEstimationService(2026년 기준)를 미러링한다 ───
const DAILY_BENEFIT_LOWER = 66_048; // 구직급여 1일 하한액
const DAILY_BENEFIT_UPPER = 68_100; // 구직급여 1일 상한액
const PENSION_RATE = 0.09;
const PENSION_MONTHLY_INCOME_CAP = 6_370_000;
const HEALTH_EMPLOYEE_RATE = 0.03545;
const WAGE_REPLACEMENT_RATE = 0.6; // 실업급여: 평균임금 대비 지급률
const DAYS_PER_MONTH = 30; // 1일 평균임금 근사: 월급 / 30
// 연소득 구간 정보가 없을 때 월 절감액 추정에 쓰는 기본 월소득
const DEFAULT_MONTHLY_INCOME = 3_000_000;

/** 구직급여일액을 법정 하한~상한 사이로 고정. 백엔드 clampDailyBenefit와 동일. */
function clampDailyBenefit(raw: number): number {
  const v = Math.round(raw);
  if (v > DAILY_BENEFIT_UPPER) return DAILY_BENEFIT_UPPER;
  if (v < DAILY_BENEFIT_LOWER) return DAILY_BENEFIT_LOWER;
  return v;
}

// 백엔드 UnemploymentBenefitRule의 비자발적 이직 사유와 동일하게 유지한다.
const QUALIFYING_RESIGNATION_REASONS: ResignationReason[] = [
  "CONTRACT_EXPIRED",
  "RECOMMENDED_RESIGNATION",
  "COMPANY_CLOSURE",
  "MANDATORY_RETIREMENT",
];

// 연소득 구간의 [하한, 상한] 근사값. 열린 구간(OVER_50M)은 대표 상한을 쓴다.
const ANNUAL_INCOME_BOUNDS: Partial<Record<AnnualIncomeRange, [number, number]>> = {
  UNDER_22M: [12_000_000, 22_000_000],
  UNDER_32M: [22_000_000, 32_000_000],
  UNDER_44M: [32_000_000, 44_000_000],
  UNDER_50M: [44_000_000, 50_000_000],
  OVER_50M: [50_000_000, 70_000_000],
};

/** 소정급여일수: 고용보험 가입기간 + 연령(50세 이상 우대). */
function paymentDays(insuranceMonths: number, age: number | null): number {
  const years = Math.floor(insuranceMonths / 12);
  const senior = age !== null && age >= 50;
  if (years < 1) return 120;
  if (years < 3) return senior ? 180 : 150;
  if (years < 5) return senior ? 210 : 180;
  if (years < 10) return senior ? 240 : 210;
  return senior ? 270 : 240;
}

function roundTo(value: number, unit: number): number {
  return Math.round(value / unit) * unit;
}

function manwon(amount: number): string {
  // 백엔드 won()·프론트 formatWon()과 동일하게 '만원' 단위는 버림 처리해, 항목 표와 요약 금액이 어긋나지 않게 한다.
  return `${Math.floor(amount / 10_000).toLocaleString("ko-KR")}만원`;
}

function rangeLabel(min: number, max: number): string | null {
  if (max <= 0) return null;
  const lo = roundTo(min, 100_000);
  const hi = roundTo(max, 100_000);
  return lo >= hi ? `약 ${manwon(hi)}` : `약 ${manwon(lo)} ~ ${manwon(hi)}`;
}

function previewFrom(report: ReportDetail): ReportPreview {
  return {
    reportId: report.reportId,
    summaryTitle: report.summaryTitle,
    summaryMessage: report.summaryMessage,
    totalItemCount: report.items.length,
    actionableItemCount: report.items.filter((item) => item.eligibilityLevel !== "LOW").length,
    expectedAmountRangeLabel: report.expectedAmountRangeLabel ?? null,
    paymentStatus: report.paymentStatus,
    locked: report.paymentStatus !== "PAID",
    highlightItems: report.items.slice(0, 2).map((item) => ({
      procedureType: item.procedureType,
      procedureName: item.procedureName,
      title: item.title,
      eligibilityLevel: item.eligibilityLevel,
      priorityLevel: item.priorityLevel,
    })),
    ctaMessage: "데모 결제로 상세 리포트를 바로 열어볼 수 있어요.",
  };
}

function reportFromAssessment(
  payload: AssessmentCreateRequest,
  wageOverride?: number | null,
): ReportDetail {
  const createdAt = now();
  const reportId = Date.now();
  const noIncome = payload.currentIncomeStatus === "NONE";
  // 월급이 입력되면(PDF 저장 단계) 범위 대신 정확값으로 계산한다. 백엔드 estimateWithMonthlyWage와 동일.
  const wage = wageOverride ?? payload.monthlyAverageWage ?? null;
  const hasWage = wage != null && wage > 0;

  // 실업급여 자격: 백엔드 UnemploymentBenefitRule과 같은 기준으로 판정한다.
  const insuranceMonths = payload.employmentInsuranceMonths ?? 0;
  const insuranceOk = insuranceMonths >= 6;
  const reasonOk =
    payload.resignationReason != null &&
    QUALIFYING_RESIGNATION_REASONS.includes(payload.resignationReason);
  const unemploymentEligibility: EligibilityLevel = insuranceOk
    ? reasonOk
      ? "HIGH"
      : "NEEDS_CHECK"
    : "LOW";
  // 다음 일자리가 확정된 이직은 실업 상태가 아니므로 수급액을 계산하지 않는다.
  const nextJobConfirmed =
    payload.eventType === "JOB_CHANGE" && payload.nextJobStatus === "CONFIRMED";
  const days = paymentDays(insuranceMonths, payload.age ?? null);
  const unemploymentEstimable = unemploymentEligibility !== "LOW" && !nextJobConfirmed;
  // 월급이 있으면 구직급여일액(= 월급/30 × 60%, 하한~상한 고정) × 일수로 정확 계산한다.
  const unempDaily = hasWage
    ? clampDailyBenefit((wage / DAYS_PER_MONTH) * WAGE_REPLACEMENT_RATE)
    : 0;
  const unempMin = !unemploymentEstimable
    ? 0
    : hasWage
      ? unempDaily * days
      : DAILY_BENEFIT_LOWER * days;
  const unempMax = !unemploymentEstimable
    ? 0
    : hasWage
      ? unempDaily * days
      : DAILY_BENEFIT_UPPER * days;

  // 퇴직금: 월급이 있으면 1일 평균임금 × 30 × 근속연수, 없으면 연소득 구간으로 추정.
  const tenure = payload.tenureYears ?? 0;
  const incomeBounds = payload.annualIncomeRange
    ? ANNUAL_INCOME_BOUNDS[payload.annualIncomeRange]
    : undefined;
  const severanceEstimable = tenure >= 1 && (hasWage || Boolean(incomeBounds));
  const wageSeverance = hasWage ? Math.round(wage / DAYS_PER_MONTH) * 30 * tenure : 0;
  const sevMin = !severanceEstimable
    ? 0
    : hasWage
      ? wageSeverance
      : Math.floor(incomeBounds![0] / 12) * tenure;
  const sevMax = !severanceEstimable
    ? 0
    : hasWage
      ? wageSeverance
      : Math.floor(incomeBounds![1] / 12) * tenure;

  const receiveMin = unempMin + sevMin;
  const receiveMax = unempMax + sevMax;
  const receiveTotal = receiveMax > 0 ? roundTo((receiveMin + receiveMax) / 2, 100_000) : 0;

  // 월 절감액: 월급이 있으면 월급 기준, 없으면 연소득 구간 중간값(없으면 기본 월소득)으로 추정한다.
  const savingBase = hasWage
    ? wage
    : incomeBounds
      ? Math.round((incomeBounds[0] + incomeBounds[1]) / 2 / 12)
      : DEFAULT_MONTHLY_INCOME;
  const pensionSaving = noIncome
    ? Math.round(Math.min(savingBase, PENSION_MONTHLY_INCOME_CAP) * PENSION_RATE)
    : 0;
  const healthSaving = Math.round(savingBase * HEALTH_EMPLOYEE_RATE);
  const monthlySaving = pensionSaving + healthSaving;

  const unempRangeText = rangeLabel(unempMin, unempMax);
  const sevRangeText = rangeLabel(sevMin, sevMax);

  const items: Omit<ReportItem, "itemId" | "sortOrder">[] = [
    {
      procedureType: "UNEMPLOYMENT_BENEFIT",
      procedureName: "실업급여",
      eligibilityLevel: unemploymentEligibility,
      priorityLevel: "HIGH",
      title: "고용24에서 실업급여 수급 자격을 먼저 확인하세요",
      reason:
        "계약 만료·권고사직·폐업·정년퇴직 등 비자발적 퇴사에 가까울수록 신청 가능성이 높습니다.",
      deadlineText: "퇴사 후 가능한 빨리 워크넷 구직등록과 수급자격 신청을 진행하세요.",
      officialUrl: "https://www.work24.go.kr",
      estimate: unemploymentEstimable
        ? {
            kind: "RECEIVE",
            amount: roundTo((unempMin + unempMax) / 2, 100_000),
            amountLabel: unempRangeText,
            headline: `실업급여로 ${unempRangeText}을 받을 수 있어요`,
            detail: hasWage
              ? `1일 ${unempDaily.toLocaleString("ko-KR")}원 × ${days}일`
              : `구직급여일액(하한 66,048원~상한 68,100원) × ${days}일 기준이에요. 월급을 입력하면 더 정확해져요.`,
          }
        : {
            kind: "NOT_ESTIMATED",
            amount: null,
            amountLabel: null,
            headline: nextJobConfirmed
              ? "다음 일자리가 확정되어 수급 대상이 아닐 수 있어요"
              : "자격 확인이 필요해요",
            detail: nextJobConfirmed
              ? "입사 전 공백 기간의 조건은 고용센터에서 확인해보세요."
              : "고용보험 가입기간(6개월 이상)을 충족하면 예상 금액을 계산해 드려요.",
          },
      requiredDocuments: [
        {
          documentName: "이직확인서",
          description: "사업주 제출 여부 확인",
          issuer: "고용24",
          required: true,
        },
        {
          documentName: "고용보험 피보험자격 이력",
          description: "가입기간 확인",
          issuer: "근로복지공단",
          required: true,
        },
      ],
    },
    ...(sevMax > 0
      ? [
          {
            procedureType: "SEVERANCE_PAY",
            procedureName: "퇴직금",
            eligibilityLevel: "HIGH",
            priorityLevel: "MEDIUM",
            title: "퇴직금 지급액과 지급기한(14일)을 확인하세요",
            reason:
              "계속근로기간 1년 이상이면 퇴직금이 발생하고, 퇴직일로부터 14일 이내에 지급되어야 합니다.",
            deadlineText: "퇴직일로부터 14일 이내 지급이 원칙이에요.",
            officialUrl: "https://www.moel.go.kr",
            estimate: {
              kind: "RECEIVE",
              amount: roundTo((sevMin + sevMax) / 2, 100_000),
              amountLabel: sevRangeText,
              headline: `퇴직금으로 ${sevRangeText}을 받을 수 있어요`,
              detail: hasWage
                ? `1일 평균임금 ${Math.round(wage / DAYS_PER_MONTH).toLocaleString("ko-KR")}원 × 30일 × ${tenure}년`
                : `연소득 구간 기준 월급 추정치 × ${tenure}년으로 계산했어요. 월급을 입력하면 더 정확해져요.`,
            },
            requiredDocuments: [
              {
                documentName: "퇴직금 산정 내역서",
                description: "지급액/산정 기준 확인",
                issuer: "이전 직장",
                required: false,
              },
            ],
          } satisfies Omit<ReportItem, "itemId" | "sortOrder">,
        ]
      : []),
    {
      procedureType: "HEALTH_INSURANCE_CONTINUATION",
      procedureName: "건강보험 임의계속가입",
      eligibilityLevel: "NEEDS_CHECK",
      priorityLevel: "MEDIUM",
      title: "건강보험료가 오르면 임의계속가입을 비교하세요",
      reason: "직장가입자에서 지역가입자로 바뀌면 보험료가 달라질 수 있습니다.",
      deadlineText: "지역가입자 보험료 고지 후 신청 가능 기간을 확인하세요.",
      officialUrl: "https://www.nhis.or.kr",
      estimate: {
        kind: "SAVE_MONTHLY",
        amount: healthSaving,
        amountLabel: `월 약 ${manwon(healthSaving)}`,
        headline: "매달 아낄 수 있는 금액이 있을 수 있어요",
        detail: "이전 직장 보험료와 지역가입 보험료를 비교해야 합니다.",
      },
      requiredDocuments: [
        {
          documentName: "임의계속가입 신청서",
          description: "공단 제출",
          issuer: "국민건강보험공단",
          required: true,
        },
      ],
    },
    {
      procedureType: "NATIONAL_PENSION_EXCEPTION",
      procedureName: "국민연금 납부예외",
      eligibilityLevel: noIncome ? "HIGH" : "NEEDS_CHECK",
      priorityLevel: "LOW",
      title: "소득 공백이 있으면 국민연금 납부예외를 검토하세요",
      reason: "현재 소득이 없다면 납부예외 신청으로 현금 유출을 줄일 수 있습니다.",
      deadlineText: null,
      officialUrl: "https://www.nps.or.kr",
      estimate:
        pensionSaving > 0
          ? {
              kind: "SAVE_MONTHLY",
              amount: pensionSaving,
              amountLabel: `월 약 ${manwon(pensionSaving)}`,
              headline: `국민연금 납부예외로 매달 약 ${manwon(pensionSaving)}을 아낄 수 있어요`,
              detail: "소득 없는 기간 동안 납부를 유예해요. 다만 나중에 받을 연금액은 줄 수 있어요.",
            }
          : {
              kind: "SAVE_MONTHLY",
              amount: null,
              amountLabel: null,
              headline: "월 납부액을 유예할 수 있어요",
              detail: "소득 신고 상태에 따라 가능 여부가 달라집니다.",
            },
      requiredDocuments: [
        {
          documentName: "납부예외 신청서",
          description: "소득 없음 확인",
          issuer: "국민연금공단",
          required: true,
        },
      ],
    },
  ];

  const inputs = saveAssessmentInputs(toDemoInputs(payload));
  const { ranked, pending, requiredForMatching } = buildDemoBenefits(inputs);

  return {
    reportId,
    assessmentId: reportId,
    summaryTitle:
      payload.eventType === "RETIREMENT"
        ? "퇴직 후 정산과 보험 전환을 먼저 챙기세요"
        : payload.eventType === "JOB_CHANGE"
          ? "이직 전후 공백 기간의 행정 절차를 정리했어요"
          : "실직 직후 신청 가능한 절차를 우선 정리했어요",
    summaryMessage:
      "입력한 상황을 기준으로 신청 가능성, 마감 위험, 필요 서류를 데모 로드맵으로 구성했어요.",
    expectedAmountRangeLabel: rangeLabel(receiveMin, receiveMax),
    totalPriorityScore: 8,
    paymentStatus: "UNPAID",
    paymentPlan: null,
    paymentAmount: null,
    aiChatAvailable: false,
    pdfAvailable: false,
    aiQuestionLimit: 0,
    aiQuestionUsedCount: 0,
    aiQuestionRemaining: 0,
    createdAt,
    benefitSummary: {
      totalReceiveAmount: receiveTotal,
      totalMonthlySaving: monthlySaving,
      receiveItemCount: (unempMax > 0 ? 1 : 0) + (sevMax > 0 ? 1 : 0),
      hasVariable: true,
      estimated: receiveMax > 0 || monthlySaving > 0,
      basisNote: "데모 계산값입니다. 실제 자격과 금액은 관할 기관에서 확인해야 합니다.",
    },
    items: items.map((item, index) => ({
      ...item,
      itemId: index + 1,
      sortOrder: index + 1,
    })),
    publicBenefits: ranked,
    pendingBenefits: pending,
    requiredForMatching: requiredForMatching,
  };
}

function requireReport(): ReportDetail {
  const report = latestReport();
  if (!report) throw new Error("아직 생성된 데모 리포트가 없습니다.");
  return report;
}

function initialCommunity(): CommunityPostDetail[] {
  return [
    {
      postId: 1,
      category: "UNEMPLOYMENT",
      title: "이직확인서 처리 여부는 어디서 확인하나요?",
      content:
        "전 직장에서 제출했다고 했는데 고용24에서 아직 안 보여요. 보통 며칠 정도 걸리는지 궁금합니다.",
      authorName: "익명",
      likeCount: 3,
      commentCount: 1,
      liked: false,
      mine: false,
      createdAt: now(),
      comments: [
        {
          commentId: 1,
          authorName: "익명",
          content: "고용24에서 이직확인서 처리여부 메뉴를 먼저 확인해보세요.",
          mine: false,
          createdAt: now(),
        },
      ],
    },
  ];
}

function community(): CommunityPostDetail[] {
  return readJson(COMMUNITY_KEY, initialCommunity());
}

function saveCommunity(posts: CommunityPostDetail[]) {
  writeJson(COMMUNITY_KEY, posts);
}

export const demoApi = {
  getMyProfile(): Promise<UserProfile> {
    return Promise.resolve(profile());
  },

  updateMyProfile(payload: UserProfileUpdateRequest): Promise<UserProfile> {
    const current = profile();
    const next = saveProfile({
      ...current,
      ...payload,
      guardianNickname: payload.nickname ?? current.guardianNickname,
    });
    return Promise.resolve(next);
  },

  agreeTerms(_payload: UserAgreementRequest): Promise<UserAgreementResponse> {
    return Promise.resolve({
      serviceTermsAgreed: true,
      privacyPolicyAgreed: true,
      marketingAgreed: false,
      agreedAt: now(),
      nextStep: "HOME",
    });
  },

  createAssessment(payload: AssessmentCreateRequest): Promise<AssessmentResponse> {
    const current = profile();
    saveProfile({
      ...current,
      sido: payload.regionSido ?? current.sido,
      sigungu: payload.regionSigungu ?? current.sigungu,
      householdType: payload.householdType ?? current.householdType,
      annualIncomeRange: payload.annualIncomeRange ?? current.annualIncomeRange,
      assetRange: payload.assetRange ?? current.assetRange,
      housingType: payload.housingType ?? current.housingType,
      hasDependentChildren: payload.hasDependentChildren ?? current.hasDependentChildren,
      hasSupportingFamily: payload.hasSupportingFamily ?? current.hasSupportingFamily,
      basicLivelihoodRecipient:
        payload.basicLivelihoodRecipient ?? current.basicLivelihoodRecipient,
      nearPoverty: payload.nearPoverty ?? current.nearPoverty,
      singleParent: payload.singleParent ?? current.singleParent,
      disabledPerson: payload.disabledPerson ?? current.disabledPerson,
    });
    saveAssessment(payload);
    const report = saveReport(reportFromAssessment(payload));
    return Promise.resolve({
      assessmentId: report.assessmentId,
      eventType: payload.eventType,
      status: "DRAFT",
      createdAt: report.createdAt,
    });
  },

  patchAssessment(
    _assessmentId: number,
    payload: AssessmentPatchRequest,
  ): Promise<AssessmentResponse> {
    const current = readAssessmentInputs();
    const nextInputs = saveAssessmentInputs({
      ...current,
      age: payload.age ?? current.age,
      tenureYears: payload.tenureYears ?? current.tenureYears,
    });
    const { ranked, pending, requiredForMatching } = buildDemoBenefits(nextInputs);
    const report = saveReport({
      ...requireReport(),
      publicBenefits: ranked,
      pendingBenefits: pending,
      requiredForMatching,
    });
    return Promise.resolve({
      assessmentId: report.assessmentId,
      eventType: "RETIREMENT",
      status: "ANALYZED",
      createdAt: report.createdAt,
    });
  },

  analyze(_assessmentId: number): Promise<ReportPreview> {
    const report = saveReport({
      ...requireReport(),
      paymentStatus: "UNPAID",
      paymentPlan: null,
      paymentAmount: null,
      aiChatAvailable: false,
      pdfAvailable: false,
      aiQuestionLimit: 0,
      aiQuestionUsedCount: 0,
      aiQuestionRemaining: 0,
    });
    return Promise.resolve(previewFrom(report));
  },

  getPreview(_reportId: number): Promise<ReportPreview> {
    return Promise.resolve(previewFrom(requireReport()));
  },

  getLatestReportRoute(): Promise<LatestReportRoute> {
    const report = latestReport();
    return Promise.resolve({
      available: Boolean(report),
      reportId: report?.reportId ?? null,
      paymentStatus: report?.paymentStatus ?? null,
    });
  },

  getLatestChatReport(): Promise<LatestChatReport> {
    const report = latestReport();
    return Promise.resolve({
      available: Boolean(report?.aiChatAvailable),
      reportId: report?.aiChatAvailable ? report.reportId : null,
    });
  },

  completePayment(
    _reportId: number,
    payload?: PaymentCompleteRequest,
  ): Promise<PaymentResponse> {
    const plan = payload?.plan ?? planFromAmount(payload?.amount);
    const amount = payload?.amount ?? planPrice(plan);
    const aiLimit = planAiLimit(plan);
    const report = saveReport({
      ...requireReport(),
      paymentStatus: "PAID",
      paymentPlan: plan,
      paymentAmount: amount,
      aiChatAvailable: plan === "PLUS",
      pdfAvailable: plan === "PLUS",
      aiQuestionLimit: aiLimit,
      aiQuestionUsedCount: 0,
      aiQuestionRemaining: aiLimit,
    });
    return Promise.resolve({
      reportId: report.reportId,
      paymentStatus: "PAID",
      assessmentStatus: "PAID",
      paymentPlan: plan,
      paymentAmount: amount,
      aiChatAvailable: plan === "PLUS",
      pdfAvailable: plan === "PLUS",
    });
  },

  confirmTossPayment(
    reportId: number,
    payload?: TossPaymentConfirmRequest,
  ): Promise<PaymentResponse> {
    return this.completePayment(reportId, {
      plan: planFromAmount(payload?.amount),
      amount: payload?.amount ?? 13_900,
    });
  },

  getReport(_reportId: number): Promise<ReportDetail> {
    return Promise.resolve(requireReport());
  },

  getPdfReport(_reportId: number, payload: ReportPdfEstimateRequest): Promise<ReportDetail> {
    const base = requireReport();
    if (!base.pdfAvailable) {
      throw new Error("확장 리포트 결제 후 이용할 수 있습니다.");
    }
    const assessment = savedAssessment();
    // 진단 입력이 없으면(구버전 리포트 등) 저장된 리포트 그대로 반환한다.
    if (!assessment) {
      return Promise.resolve(base);
    }
    // 월급 유무와 무관하게 진단으로 예상액을 온전히 재계산한다. 월급이 있으면 정확값, 없으면 범위.
    // (리포트 식별 정보·결제 상태는 원본을 유지한다.)
    const wage = payload.monthlyAverageWage ?? null;
    const recomputed = reportFromAssessment(assessment, wage != null && wage > 0 ? wage : null);
    return Promise.resolve({
      ...recomputed,
      reportId: base.reportId,
      assessmentId: base.assessmentId,
      paymentStatus: base.paymentStatus,
      paymentPlan: base.paymentPlan,
      paymentAmount: base.paymentAmount,
      aiChatAvailable: base.aiChatAvailable,
      pdfAvailable: base.pdfAvailable,
      aiQuestionLimit: base.aiQuestionLimit,
      aiQuestionUsedCount: base.aiQuestionUsedCount,
      aiQuestionRemaining: base.aiQuestionRemaining,
      createdAt: base.createdAt,
    });
  },

  fetchDocuments(_reportId: number): Promise<DocumentFetchResponse> {
    const report = requireReport();
    return Promise.resolve({
      reportId: report.reportId,
      fetchedAt: now(),
      totalCount: report.items.reduce((sum, item) => sum + item.requiredDocuments.length, 0),
      autoFetchedCount: report.items.length,
      items: report.items.map((item) => ({
        itemId: item.itemId,
        procedureType: item.procedureType,
        procedureName: item.procedureName,
        documents: item.requiredDocuments.map((doc) => ({
          documentName: doc.documentName,
          issuer: doc.issuer,
          status: "FETCHED",
          statusLabel: "자동 조회 완료",
          source: doc.issuer ?? "LIFT 데모",
          message: "데모 문서가 생성되었습니다.",
          mockDownloadUrl: null,
        })),
      })),
    });
  },

  getChatMessages(_reportId: number): Promise<ChatMessagesResponse> {
    const report = requireReport();
    if (!report.aiChatAvailable) {
      throw new Error("확장 리포트 결제 후 이용할 수 있습니다.");
    }
    const messages = readJson<ChatMessage[]>(CHAT_KEY, []);
    const limit = report.aiQuestionLimit;
    const used = Math.floor(messages.length / 2);
    return Promise.resolve({
      messages,
      aiQuestionLimit: limit,
      aiQuestionUsedCount: used,
      aiQuestionRemaining: Math.max(0, limit - used),
    });
  },

  // 데모 챗도 실제 OpenAI로 답하도록, 저장된 리포트 JSON을 백엔드(/api/ai/report-chat)로 보낸다.
  // OpenAI 키가 서버에 설정돼 있으면 실제 AI 답변, 없으면 서버가 리포트 요약 기반 폴백을 준다.
  async sendChatMessage(
    _reportId: number,
    content: string,
  ): Promise<ChatMessageCreateResponse> {
    const report = requireReport();
    if (!report.aiChatAvailable) {
      throw new Error("확장 리포트 결제 후 이용할 수 있습니다.");
    }
    const messages = readJson<ChatMessage[]>(CHAT_KEY, []);
    const used = Math.floor(messages.length / 2) + 1;
    if (used > report.aiQuestionLimit) {
      throw new Error("AI 질문 가능 횟수를 모두 사용했습니다.");
    }
    const userMessage: ChatMessage = {
      messageId: Date.now(),
      senderType: "USER",
      content,
      createdAt: now(),
    };

    let answer =
      "지금은 답변을 불러오지 못했어요. 잠시 후 다시 시도하거나, 리포트의 우선순위 높은 항목부터 확인해 주세요.";
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/ai/report-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: content, report: latestReport() }),
      });
      const body = (await res.json()) as {
        result?: { answer?: string };
      };
      if (res.ok && body.result?.answer) {
        answer = body.result.answer;
      }
    } catch {
      // 네트워크/서버 오류 시 위의 폴백 문구를 그대로 사용한다.
    }

    const aiMessage: ChatMessage = {
      messageId: Date.now() + 1,
      senderType: "AI",
      content: answer,
      createdAt: now(),
    };
    writeJson(CHAT_KEY, [...messages, userMessage, aiMessage]);
    return {
      userMessage,
      aiMessage,
      aiQuestionLimit: report.aiQuestionLimit,
      aiQuestionUsedCount: used,
      aiQuestionRemaining: Math.max(0, report.aiQuestionLimit - used),
    };
  },

  getCommunityPosts(
    category?: CommunityCategory | "ALL",
    mode: "latest" | "popular" = "latest",
  ): Promise<CommunityPostSummary[]> {
    const posts = community()
      .filter((post) => !category || category === "ALL" || post.category === category)
      .sort((a, b) =>
        mode === "popular"
          ? b.likeCount - a.likeCount
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    return Promise.resolve(
      posts.map(({ comments, content, ...post }) => ({
        ...post,
        contentPreview: content.slice(0, 90),
        commentCount: comments.length,
      })),
    );
  },

  createCommunityPost(payload: CommunityPostCreateRequest): Promise<CommunityPostDetail> {
    const posts = community();
    const post: CommunityPostDetail = {
      postId: Date.now(),
      category: payload.category,
      title: payload.title,
      content: payload.content,
      authorName: "데모",
      likeCount: 0,
      commentCount: 0,
      liked: false,
      mine: true,
      createdAt: now(),
      comments: [],
    };
    saveCommunity([post, ...posts]);
    return Promise.resolve(post);
  },

  getCommunityPost(postId: number): Promise<CommunityPostDetail> {
    const post = community().find((item) => item.postId === postId);
    if (!post) throw new Error("글을 찾을 수 없습니다.");
    return Promise.resolve(post);
  },

  deleteCommunityPost(postId: number): Promise<boolean> {
    saveCommunity(community().filter((post) => post.postId !== postId));
    return Promise.resolve(true);
  },

  likeCommunityPost(postId: number): Promise<CommunityLikeResponse> {
    const posts = community();
    const next = posts.map((post) =>
      post.postId === postId
        ? { ...post, liked: true, likeCount: post.liked ? post.likeCount : post.likeCount + 1 }
        : post,
    );
    saveCommunity(next);
    const post = next.find((item) => item.postId === postId)!;
    return Promise.resolve({ postId, liked: post.liked, likeCount: post.likeCount });
  },

  unlikeCommunityPost(postId: number): Promise<CommunityLikeResponse> {
    const posts = community();
    const next = posts.map((post) =>
      post.postId === postId
        ? { ...post, liked: false, likeCount: post.liked ? Math.max(0, post.likeCount - 1) : post.likeCount }
        : post,
    );
    saveCommunity(next);
    const post = next.find((item) => item.postId === postId)!;
    return Promise.resolve({ postId, liked: post.liked, likeCount: post.likeCount });
  },

  createCommunityComment(
    postId: number,
    payload: CommunityCommentCreateRequest,
  ): Promise<CommunityComment> {
    const comment: CommunityComment = {
      commentId: Date.now(),
      authorName: "데모",
      content: payload.content,
      mine: true,
      createdAt: now(),
    };
    saveCommunity(
      community().map((post) =>
        post.postId === postId
          ? { ...post, commentCount: post.commentCount + 1, comments: [...post.comments, comment] }
          : post,
      ),
    );
    return Promise.resolve(comment);
  },

  deleteCommunityComment(postId: number, commentId: number): Promise<boolean> {
    saveCommunity(
      community().map((post) =>
        post.postId === postId
          ? {
              ...post,
              comments: post.comments.filter((comment) => comment.commentId !== commentId),
              commentCount: Math.max(0, post.commentCount - 1),
            }
          : post,
      ),
    );
    return Promise.resolve(true);
  },
};
