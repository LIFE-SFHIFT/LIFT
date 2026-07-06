import type {
  AssessmentCreateRequest,
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
  LatestChatReport,
  LatestReportRoute,
  PaymentResponse,
  ReportDetail,
  ReportPdfEstimateRequest,
  ReportPreview,
  UserAgreementRequest,
  UserAgreementResponse,
  UserProfile,
  UserProfileUpdateRequest,
} from "./types";

const PROFILE_KEY = "lift.demo.profile";
const REPORT_KEY = "lift.demo.report";
const CHAT_KEY = "lift.demo.chat";
const COMMUNITY_KEY = "lift.demo.community";

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

function latestReport(): ReportDetail | null {
  return readJson<ReportDetail | null>(REPORT_KEY, null);
}

function saveReport(report: ReportDetail): ReportDetail {
  return writeJson(REPORT_KEY, report);
}

function previewFrom(report: ReportDetail): ReportPreview {
  return {
    reportId: report.reportId,
    summaryTitle: report.summaryTitle,
    summaryMessage: report.summaryMessage,
    totalItemCount: report.items.length,
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

function reportFromAssessment(payload: AssessmentCreateRequest): ReportDetail {
  const createdAt = now();
  const reportId = Date.now();
  const unemployed = payload.eventType === "UNEMPLOYMENT";
  const noIncome = payload.currentIncomeStatus === "NONE";
  const receiveAmount = unemployed ? 7200000 : 0;
  const monthlySaving = noIncome ? 148000 : 0;

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
    totalPriorityScore: 8,
    paymentStatus: "UNPAID",
    aiQuestionLimit: 10,
    aiQuestionUsedCount: 0,
    aiQuestionRemaining: 10,
    createdAt,
    benefitSummary: {
      totalReceiveAmount: receiveAmount,
      totalMonthlySaving: monthlySaving,
      receiveItemCount: unemployed ? 1 : 0,
      hasVariable: true,
      estimated: true,
      basisNote: "데모 계산값입니다. 실제 자격과 금액은 관할 기관에서 확인해야 합니다.",
    },
    items: [
      {
        itemId: 1,
        procedureType: "UNEMPLOYMENT_BENEFIT",
        procedureName: "실업급여",
        eligibilityLevel: unemployed ? "HIGH" : "NEEDS_CHECK",
        priorityLevel: "HIGH",
        title: "고용24에서 실업급여 수급 자격을 먼저 확인하세요",
        reason:
          "계약 만료·권고사직·폐업 등 비자발적 퇴사에 가까울수록 신청 가능성이 높습니다.",
        deadlineText: "퇴사 후 가능한 빨리 워크넷 구직등록과 수급자격 신청을 진행하세요.",
        officialUrl: "https://www.work24.go.kr",
        sortOrder: 1,
        estimate: {
          kind: "RECEIVE",
          amount: receiveAmount,
          amountLabel: receiveAmount ? "약 720만원" : null,
          headline: receiveAmount ? "예상 수령액이 있어요" : "자격 확인이 필요해요",
          detail: "월 평균임금과 가입기간에 따라 실제 금액은 달라집니다.",
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
      {
        itemId: 2,
        procedureType: "HEALTH_INSURANCE_CONTINUATION",
        procedureName: "건강보험 임의계속가입",
        eligibilityLevel: "NEEDS_CHECK",
        priorityLevel: "MEDIUM",
        title: "건강보험료가 오르면 임의계속가입을 비교하세요",
        reason: "직장가입자에서 지역가입자로 바뀌면 보험료가 달라질 수 있습니다.",
        deadlineText: "지역가입자 보험료 고지 후 신청 가능 기간을 확인하세요.",
        officialUrl: "https://www.nhis.or.kr",
        sortOrder: 2,
        estimate: {
          kind: "SAVE_MONTHLY",
          amount: monthlySaving,
          amountLabel: monthlySaving ? "월 약 14.8만원" : null,
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
        itemId: 3,
        procedureType: "NATIONAL_PENSION_EXCEPTION",
        procedureName: "국민연금 납부예외",
        eligibilityLevel: noIncome ? "HIGH" : "NEEDS_CHECK",
        priorityLevel: "LOW",
        title: "소득 공백이 있으면 국민연금 납부예외를 검토하세요",
        reason: "현재 소득이 없다면 납부예외 신청으로 현금 유출을 줄일 수 있습니다.",
        deadlineText: null,
        officialUrl: "https://www.nps.or.kr",
        sortOrder: 3,
        estimate: {
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
    ],
    publicBenefits: [
      {
        title: "긴급복지 생계지원",
        summary: "갑작스러운 실직으로 생계가 어려운 가구를 위한 지원 제도입니다.",
        provider: "보건복지부",
        category: "생계",
        applicationUrl: "https://www.gov.kr",
        sourceId: "demo-benefit-1",
        matchedKeyword: "실직",
        reason: "소득 공백과 가구 상황이 연결될 수 있어요.",
        sourceLabel: "정부24 데모",
        fitLevel: "NEEDS_CHECK",
        priorityGroup: "TOP_MONEY",
        supportTarget: "위기 상황에 처한 저소득 가구",
        selectionCriteria: "소득·재산 기준 확인 필요",
        supportContent: "생계비 등 단기 지원",
        applicationMethod: "주민센터 문의",
        applicationDeadline: null,
        contact: "129",
        requiredDocuments: [],
        missingInputs: ["정확한 소득", "재산"],
        aiSummary: "현재 정보만으로는 확인 필요지만, 실직 직후라면 우선 상담해볼 가치가 있어요.",
        relevanceScore: 78,
      },
    ],
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
      nextStep: "ONBOARDING",
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
      basicLivelihoodRecipient:
        payload.basicLivelihoodRecipient ?? current.basicLivelihoodRecipient,
      nearPoverty: payload.nearPoverty ?? current.nearPoverty,
      singleParent: payload.singleParent ?? current.singleParent,
      disabledPerson: payload.disabledPerson ?? current.disabledPerson,
    });
    const report = saveReport(reportFromAssessment(payload));
    return Promise.resolve({
      assessmentId: report.assessmentId,
      eventType: payload.eventType,
      status: "DRAFT",
      createdAt: report.createdAt,
    });
  },

  analyze(_assessmentId: number): Promise<ReportPreview> {
    const report = saveReport({ ...requireReport(), paymentStatus: "UNPAID" });
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
      available: report?.paymentStatus === "PAID",
      reportId: report?.paymentStatus === "PAID" ? report.reportId : null,
    });
  },

  completePayment(_reportId: number): Promise<PaymentResponse> {
    const report = saveReport({ ...requireReport(), paymentStatus: "PAID" });
    return Promise.resolve({
      reportId: report.reportId,
      paymentStatus: "PAID",
      assessmentStatus: "PAID",
    });
  },

  confirmTossPayment(reportId: number): Promise<PaymentResponse> {
    return this.completePayment(reportId);
  },

  getReport(_reportId: number): Promise<ReportDetail> {
    return Promise.resolve(requireReport());
  },

  getPdfReport(_reportId: number, _payload: ReportPdfEstimateRequest): Promise<ReportDetail> {
    return Promise.resolve(requireReport());
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
    const messages = readJson<ChatMessage[]>(CHAT_KEY, []);
    return Promise.resolve({
      messages,
      aiQuestionLimit: 10,
      aiQuestionUsedCount: Math.floor(messages.length / 2),
      aiQuestionRemaining: Math.max(0, 10 - Math.floor(messages.length / 2)),
    });
  },

  sendChatMessage(_reportId: number, content: string): Promise<ChatMessageCreateResponse> {
    const messages = readJson<ChatMessage[]>(CHAT_KEY, []);
    const used = Math.floor(messages.length / 2) + 1;
    const userMessage: ChatMessage = {
      messageId: Date.now(),
      senderType: "USER",
      content,
      createdAt: now(),
    };
    const aiMessage: ChatMessage = {
      messageId: Date.now() + 1,
      senderType: "AI",
      content:
        "데모 답변입니다. 리포트의 우선순위가 높은 항목부터 공식 사이트에서 자격과 마감일을 확인하세요.",
      createdAt: now(),
    };
    writeJson(CHAT_KEY, [...messages, userMessage, aiMessage]);
    return Promise.resolve({
      userMessage,
      aiMessage,
      aiQuestionLimit: 10,
      aiQuestionUsedCount: used,
      aiQuestionRemaining: Math.max(0, 10 - used),
    });
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
