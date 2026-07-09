"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { api, ApiError } from "@/lib/api";

function ChatEntryInner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .getLatestChatReport()
      .then((target) => {
        if (target.available && target.reportId) {
          router.replace(`/report/${target.reportId}/chat`);
          return;
        }
        setReady(true);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "AI챗봇을 불러오지 못했어요.");
        setReady(true);
      });
  }, [router]);

  if (!ready) {
    return <div className="center-state">AI챗봇을 준비하는 중…</div>;
  }

  return (
    <main className="section-page">
      <section className="section-card">
        <div className="section-card-head">
          <div>
            <span className="page-eyebrow">AI챗봇</span>
            <h2>먼저 로드맵이 필요해요</h2>
          </div>
        </div>
        {error && <div className="error-box">{error}</div>}
        <p className="page-sub" style={{ marginTop: 0 }}>
          AI챗봇은 확장 리포트(13,900원) 결제가 완료된 로드맵을 기준으로 답변합니다. 로드맵을
          만들고 확장 리포트로 결제하면 상단 메뉴에서 바로 이어서 질문할 수 있어요.
        </p>
        <div className="sticky-cta" style={{ position: "static", padding: 0, marginTop: 18 }}>
          <button type="button" className="btn" onClick={() => router.push("/onboarding/life-event")}>
            로드맵 만들기
          </button>
        </div>
      </section>
    </main>
  );
}

export default function ChatEntryPage() {
  return (
    <AppShell showLogout>
      <AuthGuard>
        <ChatEntryInner />
      </AuthGuard>
    </AppShell>
  );
}
