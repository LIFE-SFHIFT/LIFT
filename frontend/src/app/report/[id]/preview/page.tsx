"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { EligibilityBadge, PriorityBadge } from "@/components/Badges";
import { api, ApiError } from "@/lib/api";
import type { ReportPreview } from "@/lib/types";

function PreviewInner({ reportId }: { reportId: number }) {
  const router = useRouter();
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPreview(reportId)
      .then((data) => {
        // 이미 결제된 리포트라면 바로 상세로 보낸다.
        if (data.paymentStatus === "PAID") {
          router.replace(`/report/${reportId}`);
          return;
        }
        setPreview(data);
      })
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "미리보기를 불러오지 못했어요."),
      );
  }, [reportId, router]);

  if (error) return <div className="error-box">{error}</div>;
  if (!preview) return <div className="center-state">불러오는 중…</div>;

  const hiddenCount = Math.max(0, preview.totalItemCount - preview.highlightItems.length);

  return (
    <>
      <p className="step-hint">STEP 3 · 무료 미리보기</p>

      <div className="summary-hero">
        <h2>{preview.summaryTitle}</h2>
        <p>{preview.summaryMessage}</p>
        {preview.expectedAmountRangeLabel && (
          <div className="hero-benefit">
            <span className="hero-benefit-label">💰 예상 환급·지원 금액</span>
            <strong className="hero-benefit-amount">
              {preview.expectedAmountRangeLabel}
            </strong>
            <span className="hero-benefit-note">
              입력한 상황 기준 추정치 · 항목별 금액은 상세 리포트에서 확인
            </span>
          </div>
        )}
        <div className="score-pill">총 {preview.totalItemCount}개 항목 발견</div>
      </div>

      <div style={{ marginTop: 18 }}>
        <p className="step-hint" style={{ marginBottom: 10 }}>
          가장 중요한 항목 미리보기
        </p>
        {preview.highlightItems.map((item) => (
          <div className="card" key={item.procedureType} style={{ marginBottom: 12 }}>
            <div className="item-title">{item.title}</div>
            <div className="badge-row">
              <EligibilityBadge level={item.eligibilityLevel} />
              <PriorityBadge level={item.priorityLevel} />
            </div>
          </div>
        ))}

        {hiddenCount > 0 && (
          <div className="card locked-veil">
            <div className="locked-note">
              🔒 나머지 <b>{hiddenCount}개 항목</b>의 상세 사유, 필요 서류, 공식 신청 링크는
              결제 후 확인할 수 있어요.
            </div>
          </div>
        )}
      </div>

      <p className="quota" style={{ marginTop: 16 }}>
        {preview.ctaMessage}
      </p>

      <div className="sticky-cta">
        <button
          type="button"
          className="btn"
          onClick={() => router.push(`/checkout?reportId=${reportId}`)}
        >
          상세 리포트 결제하고 전부 보기
        </button>
      </div>
    </>
  );
}

export default function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AppShell showLogout>
      <AuthGuard>
        <PreviewInner reportId={Number(id)} />
      </AuthGuard>
    </AppShell>
  );
}
