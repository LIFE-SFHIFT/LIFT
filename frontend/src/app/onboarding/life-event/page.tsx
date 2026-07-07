"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { api, ApiError } from "@/lib/api";
import { eventTypeDescription, eventTypeLabel } from "@/lib/labels";
import type { LifeEventType } from "@/lib/types";

const EVENTS: LifeEventType[] = ["RETIREMENT", "JOB_CHANGE"];

const EVENT_ICON: Record<LifeEventType, string> = {
  RETIREMENT: "🧳",
  JOB_CHANGE: "🔄",
  UNEMPLOYMENT: "🌧️",
};

const LOCKED_EVENTS = [
  {
    key: "marriage",
    label: "결혼",
    description: "신혼·주거·가구 변화 지원은 준비 중이에요.",
    icon: "💍",
  },
  {
    key: "parental-leave",
    label: "출산휴가",
    description: "출산휴가·육아휴직 지원 안내는 곧 열릴 예정이에요.",
    icon: "🍼",
  },
];

function LifeEventInner() {
  const router = useRouter();
  const [selected, setSelected] = useState<LifeEventType | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNext() {
    if (!selected || !agreed) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.agreeTerms({
        serviceTermsAgreed: true,
        privacyPolicyAgreed: true,
        marketingAgreed: false,
      });
      sessionStorage.setItem("lift.eventType", selected);
      router.push("/assessment/new");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "동의 정보를 저장하지 못했어요.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="step-hint">STEP 1 · 상황 선택</p>
      <h1 className="page-title">지금 어떤 상황에 가까우세요?</h1>
      <p className="page-sub">선택한 상황에 맞춰 꼭 챙겨야 할 절차를 안내해 드릴게요.</p>

      {error && <div className="error-box">{error}</div>}

      <div>
        {EVENTS.map((event) => (
          <button
            key={event}
            type="button"
            className={`card selectable ${selected === event ? "selected" : ""}`}
            onClick={() => setSelected(event)}
            style={{ marginBottom: 12 }}
          >
            <div className="opt-head-row">
              <span className="ev-ico">{EVENT_ICON[event]}</span>
              <span className="title">{eventTypeLabel[event]}</span>
              <span className="ev-check">{selected === event ? "✓" : ""}</span>
            </div>
            <div className="ev-desc">{eventTypeDescription[event]}</div>
          </button>
        ))}
        {LOCKED_EVENTS.map((event) => (
          <button
            key={event.key}
            type="button"
            className="card selectable locked"
            disabled
            style={{ marginBottom: 12 }}
          >
            <div className="opt-head-row">
              <span className="ev-ico">{event.icon}</span>
              <span className="title">{event.label}</span>
              <span className="ev-lock">준비 중</span>
            </div>
            <div className="ev-desc">{event.description}</div>
          </button>
        ))}
      </div>

      <label
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          fontSize: 14,
          color: "var(--text-sub)",
          margin: "20px 2px 0",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          <Link href="/terms">서비스 이용약관</Link> 및{" "}
          <Link href="/privacy">개인정보 처리방침</Link>에 동의합니다. 진단 결과는
          참고용이며 정확한 자격은 관할 기관에서 확인해야 합니다.
        </span>
      </label>

      <div className="sticky-cta">
        <button
          type="button"
          className="btn"
          disabled={!selected || !agreed || submitting}
          onClick={handleNext}
        >
          {submitting ? "저장 중…" : "다음"}
        </button>
      </div>
    </>
  );
}

export default function LifeEventPage() {
  return (
    <AppShell showLogout>
      <AuthGuard>
        <LifeEventInner />
      </AuthGuard>
    </AppShell>
  );
}
