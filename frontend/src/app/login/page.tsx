"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { startDemoSession } from "@/lib/auth";

const FEATURES = [
  {
    cls: "c1",
    icon: "🧭",
    title: "놓치기 쉬운 절차만 콕",
    sub: "내 상황에 맞는 행정 절차를 자동 정리",
  },
  {
    cls: "c2",
    icon: "⏰",
    title: "마감일 우선 로드맵",
    sub: "지금 당장 할 일부터 순서대로",
  },
  {
    cls: "c3",
    icon: "🪪",
    title: "필요 서류 한 번에",
    sub: "공공 서류는 자동 조회로 준비 끝",
  },
];

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState<"kakao" | "naver" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("expired")) {
      setError("세션이 만료되었어요. 다시 로그인해 주세요.");
    }
  }, [params]);

  async function handleLogin(provider: "kakao" | "naver") {
    setLoading(provider);
    setError(null);
    api.startSocialLogin(provider);
  }

  function handleDemoLogin() {
    startDemoSession();
    router.replace("/onboarding/life-event");
  }

  return (
    <>
      <div className="landing-hero">
        <span className="landing-badge">✨ 생애전환 행정 도우미</span>
        <h1>
          퇴직·이직·실직,
          <br />
          LIFT로 딱
        </h1>
        <p>
          챙겨야 할 행정 절차와 마감일, 필요 서류, 공식 신청 링크를 3분 만에 로드맵으로
          정리해 드려요.
        </p>
      </div>

      <div className="feature-list">
        {FEATURES.map((f) => (
          <div className="feature" key={f.title}>
            <div className={`fico ${f.cls}`}>{f.icon}</div>
            <div className="ftext">
              <div className="ft-title">{f.title}</div>
              <div className="ft-sub">{f.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="sticky-cta" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          className="btn kakao"
          disabled={loading !== null}
          onClick={() => handleLogin("kakao")}
        >
          <span className="btn-ico">💬</span>
          {loading === "kakao" ? "로그인 중…" : "카카오로 시작하기"}
        </button>
        <button
          type="button"
          className="btn naver"
          disabled={loading !== null}
          onClick={() => handleLogin("naver")}
        >
          <span className="btn-ico">Ⓝ</span>
          {loading === "naver" ? "로그인 중…" : "네이버로 시작하기"}
        </button>
        <button
          type="button"
          className="btn demo"
          disabled={loading !== null}
          onClick={handleDemoLogin}
        >
          <span className="btn-ico">▶</span>
          데모용 로그인으로 바로 체험하기
        </button>
        <p className="quota" style={{ marginTop: 4 }}>
          데모용 로그인은 이 브라우저 안에만 저장되고 DB에는 저장되지 않습니다.
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="center-state">불러오는 중…</div>}>
        <LoginInner />
      </Suspense>
    </AppShell>
  );
}
