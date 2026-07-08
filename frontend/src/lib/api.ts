import { clearToken, getToken, isDemoSession } from "./auth";
import { demoApi } from "./demo";
import type {
  ApiResponse,
  AssessmentCreateRequest,
  AssessmentResponse,
  AuthLoginResponse,
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
  ReportPdfEstimateRequest,
  ReportDetail,
  ReportPreview,
  TossPaymentConfirmRequest,
  UserAgreementRequest,
  UserAgreementResponse,
  UserProfile,
  UserProfileUpdateRequest,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  // 데모 세션 토큰은 실제 JWT가 아니므로 보내지 않는다. 백엔드는 비로그인으로 보고
  // 공유 데모 계정으로 처리한다(커뮤니티 등 permitAll 엔드포인트에서만 도달).
  if (token && !isDemoSession()) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    // 본문이 없는 경우(예: 302 등)
  }

  if (!res.ok || !body || !body.isSuccess) {
    // 토큰이 만료됐거나 (백엔드 재시작으로) 세션이 무효화된 경우: 토큰을 비우고 로그인으로 유도한다.
    if (res.status === 401 && typeof window !== "undefined") {
      clearToken();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login?expired=1";
      }
    }
    throw new ApiError(
      res.status,
      body?.code ?? "UNKNOWN",
      body?.message ?? `요청에 실패했습니다. (HTTP ${res.status})`,
    );
  }

  return body.result;
}

export const api = {
  baseUrl: API_BASE_URL,

  /** 실제 소셜 로그인 리다이렉트 시작. 브라우저를 백엔드의 인가 엔드포인트로 이동시킨다. */
  startSocialLogin(provider: "kakao" | "naver"): void {
    window.location.href = `${API_BASE_URL}/api/auth/login/${provider}`;
  },

  /** 소셜 로그인 콜백 페이지에서 인가 코드를 백엔드에 전달해 토큰을 교환한다. */
  async socialLoginCallback(
    provider: string,
    code: string,
    state: string | null,
  ): Promise<AuthLoginResponse> {
    const query = new URLSearchParams({ code, ...(state ? { state } : {}) });
    const res = await fetch(
      `${API_BASE_URL}/api/auth/callback/${provider}?${query.toString()}`,
    );
    const body = (await res.json()) as ApiResponse<AuthLoginResponse>;
    if (!res.ok || !body.isSuccess) {
      throw new ApiError(res.status, body.code ?? "UNKNOWN", body.message);
    }
    return body.result;
  },

  createAssessment(payload: AssessmentCreateRequest): Promise<AssessmentResponse> {
    if (isDemoSession()) return demoApi.createAssessment(payload);
    return request<AssessmentResponse>("/api/life/assessments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getMyProfile(): Promise<UserProfile> {
    if (isDemoSession()) return demoApi.getMyProfile();
    return request<UserProfile>("/api/users/me/profile");
  },

  updateMyProfile(payload: UserProfileUpdateRequest): Promise<UserProfile> {
    if (isDemoSession()) return demoApi.updateMyProfile(payload);
    return request<UserProfile>("/api/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  agreeTerms(payload: UserAgreementRequest): Promise<UserAgreementResponse> {
    if (isDemoSession()) return demoApi.agreeTerms(payload);
    return request<UserAgreementResponse>("/api/users/me/agreement", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  analyze(assessmentId: number): Promise<ReportPreview> {
    if (isDemoSession()) return demoApi.analyze(assessmentId);
    return request<ReportPreview>(
      `/api/life/assessments/${assessmentId}/analyze`,
      { method: "POST" },
    );
  },

  getPreview(reportId: number): Promise<ReportPreview> {
    if (isDemoSession()) return demoApi.getPreview(reportId);
    return request<ReportPreview>(`/api/life/reports/${reportId}/preview`);
  },

  getLatestChatReport(): Promise<LatestChatReport> {
    if (isDemoSession()) return demoApi.getLatestChatReport();
    return request<LatestChatReport>("/api/life/reports/latest-chat-target");
  },

  getLatestReportRoute(): Promise<LatestReportRoute> {
    if (isDemoSession()) return demoApi.getLatestReportRoute();
    return request<LatestReportRoute>("/api/life/reports/latest-route-target");
  },

  completePayment(reportId: number): Promise<PaymentResponse> {
    if (isDemoSession()) return demoApi.completePayment(reportId);
    return request<PaymentResponse>(
      `/api/life/reports/${reportId}/payments/mock-complete`,
      { method: "POST" },
    );
  },

  confirmTossPayment(
    reportId: number,
    payload: TossPaymentConfirmRequest,
  ): Promise<PaymentResponse> {
    if (isDemoSession()) return demoApi.confirmTossPayment(reportId);
    return request<PaymentResponse>(
      `/api/life/reports/${reportId}/payments/toss/confirm`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },

  getReport(reportId: number): Promise<ReportDetail> {
    if (isDemoSession()) return demoApi.getReport(reportId);
    return request<ReportDetail>(`/api/life/reports/${reportId}`);
  },

  getPdfReport(
    reportId: number,
    payload: ReportPdfEstimateRequest,
  ): Promise<ReportDetail> {
    if (isDemoSession()) return demoApi.getPdfReport(reportId, payload);
    return request<ReportDetail>(`/api/life/reports/${reportId}/pdf-estimate`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  fetchDocuments(reportId: number): Promise<DocumentFetchResponse> {
    if (isDemoSession()) return demoApi.fetchDocuments(reportId);
    return request<DocumentFetchResponse>(
      `/api/life/reports/${reportId}/documents/fetch`,
      { method: "POST" },
    );
  },

  sendChatMessage(
    reportId: number,
    content: string,
  ): Promise<ChatMessageCreateResponse> {
    if (isDemoSession()) return demoApi.sendChatMessage(reportId, content);
    return request<ChatMessageCreateResponse>(
      `/api/life/reports/${reportId}/chat/messages`,
      { method: "POST", body: JSON.stringify({ content }) },
    );
  },

  getChatMessages(reportId: number): Promise<ChatMessagesResponse> {
    if (isDemoSession()) return demoApi.getChatMessages(reportId);
    return request<ChatMessagesResponse>(
      `/api/life/reports/${reportId}/chat/messages`,
    );
  },

  // 커뮤니티는 데모 로그인도 공유 게시판(PostgreSQL)에 저장되도록 항상 백엔드를 사용한다.
  // 데모 세션은 인증 헤더 없이 요청하고, 백엔드가 공유 데모 계정으로 처리한다.
  getCommunityPosts(
    category?: CommunityCategory | "ALL",
    mode: "latest" | "popular" = "latest",
  ): Promise<CommunityPostSummary[]> {
    const params = new URLSearchParams({ size: "50" });
    if (category && category !== "ALL") params.set("category", category);
    const path =
      mode === "popular" ? "/api/community/posts/popular" : "/api/community/posts";
    return request<CommunityPostSummary[]>(`${path}?${params.toString()}`);
  },

  createCommunityPost(
    payload: CommunityPostCreateRequest,
  ): Promise<CommunityPostDetail> {
    return request<CommunityPostDetail>("/api/community/posts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getCommunityPost(postId: number): Promise<CommunityPostDetail> {
    return request<CommunityPostDetail>(`/api/community/posts/${postId}`);
  },

  deleteCommunityPost(postId: number): Promise<boolean> {
    return request<boolean>(`/api/community/posts/${postId}`, {
      method: "DELETE",
    });
  },

  likeCommunityPost(postId: number): Promise<CommunityLikeResponse> {
    return request<CommunityLikeResponse>(`/api/community/posts/${postId}/likes`, {
      method: "POST",
    });
  },

  unlikeCommunityPost(postId: number): Promise<CommunityLikeResponse> {
    return request<CommunityLikeResponse>(`/api/community/posts/${postId}/likes`, {
      method: "DELETE",
    });
  },

  createCommunityComment(
    postId: number,
    payload: CommunityCommentCreateRequest,
  ): Promise<CommunityComment> {
    return request<CommunityComment>(`/api/community/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteCommunityComment(postId: number, commentId: number): Promise<boolean> {
    return request<boolean>(
      `/api/community/posts/${postId}/comments/${commentId}`,
      { method: "DELETE" },
    );
  },
};
