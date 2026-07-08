"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { api, ApiError } from "@/lib/api";
import {
  eligibilityLabel,
  eligibilityTone,
  priorityLabel,
  priorityTone,
} from "@/lib/labels";
import type { ReportPlanType, ReportPreview } from "@/lib/types";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";
const TOSS_SDK_URL = "https://js.tosspayments.com/v2/standard";

const REPORT_PLANS = [
  {
    id: "basic",
    backendPlan: "BASIC",
    name: "기본 리포트",
    price: 6900,
    summary: "신청 가능 항목, 우선순위, 필요 서류와 공식 링크를 확인해요.",
  },
  {
    id: "plus",
    backendPlan: "PLUS",
    name: "확장 리포트",
    price: 13900,
    summary: "기본 리포트에 AI 질문 10회와 PDF 저장용 금액 계산까지 함께 봐요.",
  },
] as const satisfies readonly {
  id: string;
  backendPlan: ReportPlanType;
  name: string;
  price: number;
  summary: string;
}[];

type ReportPlan = (typeof REPORT_PLANS)[number];
type PlanId = ReportPlan["id"];

type TossPaymentRequest = {
  method: "CARD";
  amount: {
    currency: "KRW";
    value: number;
  };
  orderId: string;
  orderName: string;
  successUrl: string;
  failUrl: string;
};

type TossPayment = {
  requestPayment(params: TossPaymentRequest): Promise<void>;
};

type TossPaymentsSdk = {
  payment(params: { customerKey: string }): TossPayment;
};

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossPaymentsSdk;
  }
}

function randomToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}${Math.random().toString(36).slice(2)}`;
}

function createOrderId(reportId: number) {
  return `LIFT-${reportId}-${Date.now()}-${randomToken().slice(0, 12)}`;
}

function loadTossSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저에서만 결제할 수 있어요."));
  if (window.TossPayments) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TOSS_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("토스 결제 SDK를 불러오지 못했어요.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = TOSS_SDK_URL;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("토스 결제 SDK를 불러오지 못했어요.")), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const reportId = Number(params.get("reportId"));
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>("basic");
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [processing, setProcessing] = useState<"mock" | "toss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tossReady = TOSS_CLIENT_KEY.startsWith("test_ck_");
  const selectedPlan = useMemo(
    () => REPORT_PLANS.find((plan) => plan.id === selectedPlanId) ?? REPORT_PLANS[0],
    [selectedPlanId],
  );
  const payable = Boolean(preview && preview.actionableItemCount > 0);

  useEffect(() => {
    if (!reportId) {
      setLoadingPreview(false);
      setError("리포트 정보가 없습니다. 미리보기 화면에서 다시 시도해주세요.");
      return;
    }

    let mounted = true;
    setLoadingPreview(true);
    api
      .getPreview(reportId)
      .then((data) => {
        if (!mounted) return;
        if (data.paymentStatus === "PAID") {
          router.replace(`/report/${reportId}`);
          return;
        }
        setPreview(data);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof ApiError ? e.message : "신청 가능 항목을 불러오지 못했어요.");
      })
      .finally(() => {
        if (mounted) setLoadingPreview(false);
      });

    return () => {
      mounted = false;
    };
  }, [reportId, router]);

  async function handleMockPay() {
    if (!reportId) {
      setError("리포트 정보가 없습니다. 미리보기 화면에서 다시 시도해주세요.");
      return;
    }
    if (!payable) {
      setError("신청 가능 항목이 확인된 뒤 결제할 수 있어요.");
      return;
    }
    setProcessing("mock");
    setError(null);
    try {
      await api.completePayment(reportId, {
        plan: selectedPlan.backendPlan,
        amount: selectedPlan.price,
      });
      router.replace(`/report/${reportId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "결제 처리 중 문제가 발생했어요.");
      setProcessing(null);
    }
  }

  async function handleTossPay() {
    if (!reportId) {
      setError("리포트 정보가 없습니다. 미리보기 화면에서 다시 시도해주세요.");
      return;
    }
    if (!payable) {
      setError("신청 가능 항목이 확인된 뒤 결제할 수 있어요.");
      return;
    }
    if (!tossReady) {
      setError("토스 테스트 결제를 쓰려면 NEXT_PUBLIC_TOSS_CLIENT_KEY에 test_ck_ 키를 넣어주세요.");
      return;
    }

    setProcessing("toss");
    setError(null);
    try {
      await loadTossSdk();
      if (!window.TossPayments) {
        throw new Error("토스 결제 SDK를 초기화하지 못했어요.");
      }

      const tossPayments = window.TossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({
        customerKey: `LIFT-CUSTOMER-${randomToken().slice(0, 20)}`,
      });
      const orderId = createOrderId(reportId);
      const origin = window.location.origin;

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: selectedPlan.price },
        orderId,
        orderName: `생애전환 맞춤 ${selectedPlan.name}`,
        successUrl: `${origin}/checkout/toss/success?reportId=${reportId}`,
        failUrl: `${origin}/checkout/toss/fail?reportId=${reportId}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "토스 결제창을 여는 중 문제가 발생했어요.");
      setProcessing(null);
    }
  }

  return (
    <>
      <p className="step-hint">STEP 4 · 결제</p>
      <h1 className="page-title">상세 리포트 결제</h1>
      <p className="page-sub">
        결제 전에 신청 가능 항목을 먼저 확인하고, 원하는 리포트 플랜을 선택해 주세요.
      </p>

      {error && <div className="error-box">{error}</div>}

      <div className="card checkout-apply-card">
        <div className="checkout-section-head">
          <div>
            <p className="checkout-eyebrow">결제 전 확인</p>
            <h2>지금 신청 검토할 수 있는 항목</h2>
          </div>
          {preview && <span className="checkout-count">{preview.actionableItemCount}개</span>}
        </div>

        {loadingPreview ? (
          <p className="quota" style={{ marginTop: 12 }}>
            신청 가능 항목을 확인하고 있어요.
          </p>
        ) : preview && preview.actionableItemCount > 0 ? (
          <>
            <p className="quota" style={{ marginTop: 8 }}>
              {preview.summaryMessage}
            </p>
            <div className="checkout-highlight-list">
              {preview.highlightItems.map((item) => (
                <div key={item.procedureType} className="checkout-highlight">
                  <div className="checkout-highlight-title">
                    <span>{item.procedureName}</span>
                    <b>{item.title}</b>
                  </div>
                  <div className="badge-row">
                    <span className={`badge ${eligibilityTone(item.eligibilityLevel)}`}>
                      {eligibilityLabel[item.eligibilityLevel]}
                    </span>
                    <span className={`badge ${priorityTone(item.priorityLevel)}`}>
                      {priorityLabel[item.priorityLevel]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {preview.totalItemCount > preview.highlightItems.length && (
              <p className="quota" style={{ marginTop: 10 }}>
                외 {preview.totalItemCount - preview.highlightItems.length}개 항목도 결제 후 함께 열립니다.
              </p>
            )}
          </>
        ) : (
          <div className="warning-box">
            입력하신 정보로는 현재 신청 가능성이 높거나 확인 필요한 항목이 없습니다. 결제 전에
            정보를 다시 확인해 주세요.
          </div>
        )}
      </div>

      <div className="checkout-plan-grid">
        {REPORT_PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            className={`card checkout-plan ${selectedPlanId === plan.id ? "selected" : ""}`}
            onClick={() => setSelectedPlanId(plan.id)}
            disabled={processing !== null}
          >
            <span className="checkout-plan-name">{plan.name}</span>
            <strong>{plan.price.toLocaleString()}원</strong>
            <span className="checkout-plan-summary">{plan.summary}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="checkout-price-row">
          <span>선택한 플랜</span>
          <b>{selectedPlan.name}</b>
        </div>
        <div className="divider" />
        <div className="checkout-price-row total">
          <span>결제 금액</span>
          <span>{selectedPlan.price.toLocaleString()}원</span>
        </div>
      </div>

      <p className="quota" style={{ marginTop: 16 }}>
        데모 발표 중에는 빠른 데모 결제를 쓰고, 실제 PG 흐름 확인이 필요할 때만 토스 테스트
        결제를 열어주세요.
      </p>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="item-title">빠른 데모 결제</div>
        <p className="quota" style={{ marginTop: 8 }}>
          외부 창 없이 즉시 결제 완료 처리합니다.
        </p>
        <button
          type="button"
          className="btn"
          disabled={processing !== null || loadingPreview || !payable}
          onClick={handleMockPay}
          style={{ marginTop: 12 }}
        >
          {processing === "mock" ? "완료 처리 중…" : "데모 결제로 바로 열기"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="item-title">토스 테스트 결제</div>
        <p className="quota" style={{ marginTop: 8 }}>
          토스 결제창을 실제로 거치지만 테스트 키에서는 돈이 나가지 않습니다.
        </p>
        <button
          type="button"
          className="btn secondary"
          disabled={processing !== null || !tossReady || loadingPreview || !payable}
          onClick={handleTossPay}
          style={{ marginTop: 12 }}
        >
          {processing === "toss" ? "토스 결제창 여는 중…" : "토스 테스트 결제하기"}
        </button>
        {!tossReady && (
          <p className="quota" style={{ marginTop: 8 }}>
            테스트 클라이언트 키가 설정되면 버튼이 활성화됩니다.
          </p>
        )}
      </div>

      <div className="sticky-cta" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          className="btn secondary"
          disabled={processing !== null}
          onClick={() => router.back()}
        >
          이전으로
        </button>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <AppShell showLogout>
      <AuthGuard>
        <Suspense fallback={<div className="center-state">불러오는 중…</div>}>
          <CheckoutInner />
        </Suspense>
      </AuthGuard>
    </AppShell>
  );
}
