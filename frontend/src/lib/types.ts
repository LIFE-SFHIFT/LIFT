// 백엔드 도메인과 1:1로 맞춘 타입 정의.

export type LifeEventType = "RETIREMENT" | "JOB_CHANGE" | "UNEMPLOYMENT";
export type CommunityCategory = LifeEventType;
export type ResignationReason =
  | "CONTRACT_EXPIRED"
  | "RECOMMENDED_RESIGNATION"
  | "MANDATORY_RETIREMENT"
  | "PERSONAL_REASON"
  | "FIRED"
  | "COMPANY_CLOSURE"
  | "UNKNOWN";
export type NextJobStatus = "CONFIRMED" | "NOT_CONFIRMED" | "UNKNOWN";
export type CurrentIncomeStatus = "NONE" | "HAS_INCOME" | "UNKNOWN";
// 가구 형태는 단일 선택 4종. 자녀/부양가족은 별도 boolean(hasDependentChildren,
// hasSupportingFamily)으로 분리했다. 예전 WITH_CHILDREN/SUPPORTING_FAMILY 저장값은
// normalizeHouseholdSelection에서 새 구조로 변환한다.
export type HouseholdType = "UNKNOWN" | "SINGLE" | "COUPLE" | "OTHER";
export type AnnualIncomeRange =
  | "UNKNOWN"
  | "NONE"
  | "UNDER_22M"
  | "UNDER_32M"
  | "UNDER_44M"
  | "UNDER_50M"
  | "OVER_50M";
export type AssetRange = "UNKNOWN" | "UNDER_240M" | "OVER_240M";
export type HousingType = "UNKNOWN" | "MONTHLY_RENT" | "JEONSE" | "OWNED" | "FAMILY";
export type AssessmentStatus = "DRAFT" | "ANALYZED" | "PAID";
export type PaymentStatus = "UNPAID" | "PAID";
export type ReportPlanType = "BASIC" | "PLUS";
export type EligibilityLevel = "HIGH" | "NEEDS_CHECK" | "LOW";
export type PriorityLevel = "HIGH" | "MEDIUM" | "LOW";
export type PublicBenefitFitLevel = "HIGH" | "NEEDS_CHECK" | "LOW";
export type PublicBenefitPriorityGroup =
  | "TOP_MONEY"
  | "DEADLINE"
  | "LOCAL"
  | "NEEDS_INFO"
  | "LOW";
export type PublicBenefitSourceType = "DB" | "GOV24_API";
export type ChatSenderType = "USER" | "AI";
export type ProcedureType =
  | "UNEMPLOYMENT_BENEFIT"
  | "HEALTH_INSURANCE_CONTINUATION"
  | "NATIONAL_PENSION_EXCEPTION"
  | "TAX_CHECK"
  | "SEVERANCE_PAY";

export interface ApiResponse<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  result: T;
}

export interface UserProfile {
  userId: number;
  nickname: string | null;
  email: string | null;
  provider: string;
  childName: string | null;
  childBirthYear: number | null;
  childBirthMonth: number | null;
  careAreas: string[];
  characteristicKeyword: string | null;
  interests: string[];
  sido: string | null;
  sigungu: string | null;
  householdType: HouseholdType | null;
  annualIncomeRange: AnnualIncomeRange | null;
  assetRange: AssetRange | null;
  housingType: HousingType | null;
  hasDependentChildren: boolean | null;
  hasSupportingFamily: boolean | null;
  basicLivelihoodRecipient: boolean | null;
  nearPoverty: boolean | null;
  singleParent: boolean | null;
  disabledPerson: boolean | null;
  guardianNickname: string | null;
  guardianType: string | null;
  communityRoleType: string | null;
}

export interface UserProfileUpdateRequest {
  nickname?: string | null;
  childName?: string | null;
  guardianType?: string | null;
  sido?: string | null;
  sigungu?: string | null;
  householdType?: HouseholdType | null;
  annualIncomeRange?: AnnualIncomeRange | null;
  assetRange?: AssetRange | null;
  housingType?: HousingType | null;
  hasDependentChildren?: boolean | null;
  hasSupportingFamily?: boolean | null;
  basicLivelihoodRecipient?: boolean | null;
  nearPoverty?: boolean | null;
  singleParent?: boolean | null;
  disabledPerson?: boolean | null;
}

export interface UserAgreementRequest {
  serviceTermsAgreed: boolean;
  privacyPolicyAgreed: boolean;
  marketingAgreed?: boolean | null;
}

export interface UserAgreementResponse {
  serviceTermsAgreed: boolean;
  privacyPolicyAgreed: boolean;
  marketingAgreed: boolean;
  agreedAt: string | null;
  nextStep: string;
}

export interface AuthLoginResponse {
  userId: number;
  provider: string;
  nickname: string | null;
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  isNewUser: boolean;
  agreementCompleted: boolean;
  onboardingCompleted: boolean;
  nextStep: "TERMS" | "ONBOARDING" | "HOME";
}

export interface AssessmentCreateRequest {
  eventType: LifeEventType;
  retirementDate?: string | null;
  resignationReason?: ResignationReason | null;
  nextJobStatus?: NextJobStatus | null;
  nextJobStartDate?: string | null;
  employmentInsuranceMonths?: number | null;
  currentIncomeStatus?: CurrentIncomeStatus | null;
  regionSido?: string | null;
  regionSigungu?: string | null;
  monthlyAverageWage?: number | null;
  age?: number | null;
  tenureYears?: number | null;
  householdType?: HouseholdType | null;
  annualIncomeRange?: AnnualIncomeRange | null;
  assetRange?: AssetRange | null;
  housingType?: HousingType | null;
  hasDependentChildren?: boolean | null;
  hasSupportingFamily?: boolean | null;
  basicLivelihoodRecipient?: boolean | null;
  nearPoverty?: boolean | null;
  singleParent?: boolean | null;
  disabledPerson?: boolean | null;
}

export type BenefitEstimateKind =
  | "RECEIVE"
  | "SAVE_MONTHLY"
  | "VARIABLE"
  | "NOT_ESTIMATED";

export interface BenefitEstimate {
  kind: BenefitEstimateKind;
  amount: number | null;
  amountLabel: string | null;
  headline: string;
  detail: string;
}

export interface BenefitSummary {
  totalReceiveAmount: number;
  totalMonthlySaving: number;
  receiveItemCount: number;
  hasVariable: boolean;
  estimated: boolean;
  basisNote: string;
}

export interface AssessmentResponse {
  assessmentId: number;
  eventType: LifeEventType;
  status: AssessmentStatus;
  createdAt: string;
}

export interface HighlightItem {
  procedureType: ProcedureType;
  procedureName: string;
  title: string;
  eligibilityLevel: EligibilityLevel;
  priorityLevel: PriorityLevel;
}

export interface ReportPreview {
  reportId: number;
  summaryTitle: string;
  summaryMessage: string;
  totalItemCount: number;
  actionableItemCount: number;
  expectedAmountRangeLabel: string | null;
  paymentStatus: PaymentStatus;
  locked: boolean;
  highlightItems: HighlightItem[];
  ctaMessage: string;
}

export interface LatestChatReport {
  available: boolean;
  reportId: number | null;
}

export interface LatestReportRoute {
  available: boolean;
  reportId: number | null;
  paymentStatus: PaymentStatus | null;
}

export interface RequiredDocument {
  documentName: string;
  description: string | null;
  issuer: string | null;
  required: boolean;
}

export interface ReportItem {
  itemId: number;
  procedureType: ProcedureType;
  procedureName: string;
  eligibilityLevel: EligibilityLevel;
  priorityLevel: PriorityLevel;
  title: string;
  reason: string;
  deadlineText: string | null;
  officialUrl: string | null;
  sortOrder: number;
  estimate: BenefitEstimate | null;
  requiredDocuments: RequiredDocument[];
}

export interface PublicBenefit {
  title: string;
  summary: string | null;
  provider: string | null;
  category: string | null;
  applicationUrl: string | null;
  sourceId: string | null;
  matchedKeyword: string;
  reason: string;
  sourceLabel: string;
  sourceType: PublicBenefitSourceType;
  fitLevel: PublicBenefitFitLevel;
  priorityGroup: PublicBenefitPriorityGroup;
  supportTarget: string | null;
  selectionCriteria: string | null;
  supportContent: string | null;
  applicationMethod: string | null;
  applicationDeadline: string | null;
  contact: string | null;
  requiredDocuments: RequiredDocument[];
  missingInputs: string[];
  aiSummary: string | null;
  relevanceScore: number;
}

export interface ReportDetail {
  reportId: number;
  assessmentId: number;
  summaryTitle: string;
  summaryMessage: string;
  /** 데모 모드에서 미리보기 금액 범위를 재사용하기 위한 필드. 백엔드 응답에는 없다. */
  expectedAmountRangeLabel?: string | null;
  totalPriorityScore: number;
  paymentStatus: PaymentStatus;
  paymentPlan: ReportPlanType | null;
  paymentAmount: number | null;
  aiChatAvailable: boolean;
  pdfAvailable: boolean;
  aiQuestionLimit: number;
  aiQuestionUsedCount: number;
  aiQuestionRemaining: number;
  createdAt: string;
  benefitSummary: BenefitSummary;
  items: ReportItem[];
  publicBenefits: PublicBenefit[];
  pendingBenefits: PublicBenefit[];
  requiredForMatching: string[];
}

export interface AssessmentPatchRequest {
  age?: number | null;
  tenureYears?: number | null;
}

export interface PaymentResponse {
  reportId: number;
  paymentStatus: PaymentStatus;
  assessmentStatus: AssessmentStatus;
  paymentPlan: ReportPlanType | null;
  paymentAmount: number | null;
  aiChatAvailable: boolean;
  pdfAvailable: boolean;
}

export interface PaymentCompleteRequest {
  plan: ReportPlanType;
  amount: number;
}

export interface TossPaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface ReportPdfEstimateRequest {
  monthlyAverageWage?: number | null;
}

export interface ChatMessage {
  messageId: number;
  senderType: ChatSenderType;
  content: string;
  createdAt: string;
}

export interface ChatMessageCreateResponse {
  userMessage: ChatMessage;
  aiMessage: ChatMessage;
  aiQuestionLimit: number;
  aiQuestionUsedCount: number;
  aiQuestionRemaining: number;
}

export interface ChatMessagesResponse {
  messages: ChatMessage[];
  aiQuestionLimit: number;
  aiQuestionUsedCount: number;
  aiQuestionRemaining: number;
}

export type DocumentFetchStatus = "FETCHED" | "ACTION_REQUIRED" | "UNAVAILABLE";

export interface FetchedDocument {
  documentName: string;
  issuer: string | null;
  status: DocumentFetchStatus;
  statusLabel: string;
  source: string;
  message: string;
  mockDownloadUrl: string | null;
}

export interface FetchedItemDocuments {
  itemId: number;
  procedureType: ProcedureType;
  procedureName: string;
  documents: FetchedDocument[];
}

export interface DocumentFetchResponse {
  reportId: number;
  fetchedAt: string;
  totalCount: number;
  autoFetchedCount: number;
  items: FetchedItemDocuments[];
}

export interface CommunityPostSummary {
  postId: number;
  category: CommunityCategory;
  title: string;
  contentPreview: string;
  authorName: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  mine: boolean;
  createdAt: string;
}

export interface CommunityComment {
  commentId: number;
  authorName: string;
  content: string;
  mine: boolean;
  createdAt: string;
}

export interface CommunityPostDetail {
  postId: number;
  category: CommunityCategory;
  title: string;
  content: string;
  authorName: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  mine: boolean;
  createdAt: string;
  comments: CommunityComment[];
}

export interface CommunityPostCreateRequest {
  category: CommunityCategory;
  title: string;
  content: string;
}

export interface CommunityCommentCreateRequest {
  content: string;
}

export interface CommunityLikeResponse {
  postId: number;
  likeCount: number;
  liked: boolean;
}
