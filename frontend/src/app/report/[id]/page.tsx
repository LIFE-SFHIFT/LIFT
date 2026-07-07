"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { EligibilityBadge } from "@/components/Badges";
import { IdentityVerifyModal } from "@/components/IdentityVerifyModal";
import { ReportPdfDocument } from "@/components/ReportPdfDocument";
import { api, ApiError } from "@/lib/api";
import { priorityLabel } from "@/lib/labels";
import type {
  FetchedDocument,
  PriorityLevel,
  PublicBenefit,
  ReportDetail,
  ReportItem,
} from "@/lib/types";

function toneClass(level: PriorityLevel): "high" | "mid" | "low" {
  return level === "HIGH" ? "high" : level === "MEDIUM" ? "mid" : "low";
}

/** 원 단위 금액을 "1,200만원" / "1억 2,000만원" 형태로 변환. */
function formatWon(amount: number): string {
  if (amount < 10000) return `${amount.toLocaleString()}원`;
  const eok = Math.floor(amount / 100000000);
  const man = Math.floor((amount % 100000000) / 10000);
  let s = "";
  if (eok > 0) s += `${eok.toLocaleString()}억${man > 0 ? " " : ""}`;
  if (man > 0 || eok === 0) s += `${man.toLocaleString()}만`;
  return `${s}원`;
}

function formatMoneyInput(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits).toLocaleString() : "";
}

function parseMoneyInput(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function EstimateChip({ estimate }: { estimate: ReportItem["estimate"] }) {
  if (!estimate || estimate.kind === "NOT_ESTIMATED") return null;
  const cls =
    estimate.kind === "SAVE_MONTHLY"
      ? "save"
      : estimate.kind === "VARIABLE"
        ? "variable"
        : "";
  const ico =
    estimate.kind === "RECEIVE"
      ? "💰"
      : estimate.kind === "SAVE_MONTHLY"
        ? "🪙"
        : "🧾";
  return (
    <div className={`item-estimate ${cls}`}>
      <span className="ie-ico">{ico}</span>
      <div className="ie-body">
        {estimate.amountLabel && <div className="ie-amount">{estimate.amountLabel}</div>}
        <div className="ie-headline">{estimate.headline}</div>
        <div className="ie-detail">{estimate.detail}</div>
      </div>
    </div>
  );
}

const GROUP_META: Record<PriorityLevel, { title: string }> = {
  HIGH: { title: "지금 바로 시작하세요" },
  MEDIUM: { title: "곧 챙기세요" },
  LOW: { title: "여유 있을 때" },
};

const GROUP_ORDER: PriorityLevel[] = ["HIGH", "MEDIUM", "LOW"];

const PUBLIC_FIT_LABEL: Record<PublicBenefit["fitLevel"], string> = {
  HIGH: "가능성 높음",
  NEEDS_CHECK: "확인 필요",
  LOW: "가능성 낮음",
};

const PUBLIC_GROUP_LABEL: Record<PublicBenefit["priorityGroup"], string> = {
  TOP_MONEY: "큰돈 혜택",
  DEADLINE: "마감 확인",
  LOCAL: "지역 혜택",
  NEEDS_INFO: "추가 확인",
  LOW: "후순위",
};

const REQUIRED_FIELD_LABEL: Record<string, string> = {
  age: "나이",
  tenureYears: "근속연수",
};

function docKey(itemId: number, documentName: string) {
  return `${itemId}::${documentName}`;
}

function verifiedStorageKey() {
  return "lift.identityVerified";
}

function documentPreviewHref(reportId: number, itemId: number, documentName: string, fetched: FetchedDocument) {
  const params = new URLSearchParams({
    reportId: String(reportId),
    itemId: String(itemId),
    name: documentName,
    issuer: fetched.issuer ?? "",
    source: fetched.source,
  });
  return `/documents/mock?${params.toString()}`;
}

function DocRow({
  reportId,
  itemId,
  documentName,
  fetched,
}: {
  reportId: number;
  itemId: number;
  documentName: string;
  fetched?: FetchedDocument;
}) {
  const done = fetched?.status === "FETCHED";
  return (
    <li>
      <span className={`doc-box ${done ? "done" : fetched ? "action" : ""}`}>
        {done ? "✓" : ""}
      </span>
      <span>
        <span className="doc-name">{documentName}</span>
        {fetched && (
          <span className={`doc-source ${done ? "fetched" : "action"}`}>
            {done ? `✓ ${fetched.source}` : fetched.statusLabel}
          </span>
        )}
        {fetched?.message && <span className="doc-meta"> — {fetched.message}</span>}
        {done && (
          <Link
            href={documentPreviewHref(reportId, itemId, documentName, fetched)}
            className="doc-download"
          >
            다운로드
          </Link>
        )}
      </span>
    </li>
  );
}

function StepCard({
  reportId,
  item,
  index,
  isNow,
  fetchedMap,
}: {
  reportId: number;
  item: ReportItem;
  index: number;
  isNow: boolean;
  fetchedMap: Map<string, FetchedDocument>;
}) {
  const tone = toneClass(item.priorityLevel);
  return (
    <div className="step">
      <div className="step-rail">
        <div className={`step-node ${tone}`}>{index}</div>
      </div>
      <div className="step-card">
        {isNow && <span className="now-tag">가장 먼저</span>}
        <div className="item-title">{item.title}</div>
        <div className="badge-row">
          <EligibilityBadge level={item.eligibilityLevel} />
          <span className={`badge tone-${tone === "mid" ? "mid" : tone}`}>
            {priorityLabel[item.priorityLevel]}
          </span>
        </div>
        <p className="item-reason">{item.reason}</p>

        <EstimateChip estimate={item.estimate} />

        {item.deadlineText && (
          <div className="deadline-chip">⏰ {item.deadlineText}</div>
        )}

        {item.requiredDocuments.length > 0 && (
          <ul className="doc-check">
            <li className="doc-head" style={{ display: "flex" }}>
              📎 필요 서류 {item.requiredDocuments.length}가지
            </li>
            {item.requiredDocuments.map((doc) => (
              <DocRow
                key={doc.documentName}
                reportId={reportId}
                itemId={item.itemId}
                documentName={doc.documentName}
                fetched={fetchedMap.get(docKey(item.itemId, doc.documentName))}
              />
            ))}
          </ul>
        )}

        {item.officialUrl && (
          <a
            className="apply-btn"
            href={item.officialUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {item.procedureName} 공식 사이트에서 신청하기 ↗
          </a>
        )}
      </div>
    </div>
  );
}

function PublicBenefitSection({ benefits }: { benefits: PublicBenefit[] }) {
  if (!benefits.length) return null;

  return (
    <section className="public-benefits">
      <div className="pb-head">
        <div>
          <span className="pb-kicker">공공데이터 연동</span>
          <h2>추가로 확인할 혜택 후보</h2>
        </div>
        <p>
          정부24 공공서비스 데이터를 함께 조회해, 지금 상황과 연결될 수 있는 혜택을 더
          넓게 찾았어요.
        </p>
      </div>
      <span className="pb-swipe-hint">← 옆으로 넘겨서 더 보기 →</span>

      <div className="pb-grid">
        {benefits.map((benefit, index) => (
          <article className="pb-card" key={`${benefit.sourceId ?? benefit.title}-${index}`}>
            <div className="pb-card-top">
              <span className="pb-rank">{index + 1}</span>
              <span className="pb-source">{benefit.sourceLabel}</span>
            </div>
            <div className="pb-tag-row">
              <span className={`pb-fit ${benefit.fitLevel.toLowerCase()}`}>
                {PUBLIC_FIT_LABEL[benefit.fitLevel]}
              </span>
              <span className="pb-group">{PUBLIC_GROUP_LABEL[benefit.priorityGroup]}</span>
              <span className="pb-score">{benefit.relevanceScore}점</span>
            </div>
            <h3>{benefit.title}</h3>
            <p className="pb-reason">{benefit.aiSummary || benefit.reason}</p>
            {benefit.summary && <p className="pb-summary">{benefit.summary}</p>}

            {(benefit.applicationDeadline || benefit.applicationMethod) && (
              <div className="pb-action-meta">
                {benefit.applicationDeadline && (
                  <span>기한: {benefit.applicationDeadline}</span>
                )}
                {benefit.applicationMethod && <span>방법: {benefit.applicationMethod}</span>}
              </div>
            )}

            {benefit.requiredDocuments.length > 0 && (
              <div className="pb-docs">
                <b>필요 서류</b>
                <ul>
                  {benefit.requiredDocuments.slice(0, 4).map((doc) => (
                    <li key={`${benefit.sourceId}-${doc.documentName}`}>{doc.documentName}</li>
                  ))}
                </ul>
              </div>
            )}

            {benefit.missingInputs.length > 0 && (
              <div className="pb-missing">
                더 정확히 보려면 {benefit.missingInputs.join(", ")} 확인이 필요해요.
              </div>
            )}

            <div className="pb-meta">
              {benefit.provider && <span>{benefit.provider}</span>}
              {benefit.category && <span>{benefit.category}</span>}
              <span>검색어 {benefit.matchedKeyword}</span>
            </div>
            {benefit.applicationUrl ? (
              <a
                className="pb-link"
                href={benefit.applicationUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                공식 신청/상세 보기 ↗
              </a>
            ) : (
              <span className="pb-no-link">공식 페이지에서 조건 확인 필요</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function PendingBenefitSection({
  benefits,
  onSupplementClick,
}: {
  benefits: PublicBenefit[];
  onSupplementClick: () => void;
}) {
  if (!benefits.length) return null;

  return (
    <section className="public-benefits pending-benefits">
      <div className="pb-head">
        <div>
          <span className="pb-kicker">정보 입력 시 확인 가능</span>
          <h2>추가 정보를 입력하면 확인 가능한 혜택</h2>
        </div>
        <p>
          나이·근속연수 조건이 있는 혜택이에요. 정보를 입력하면 자격을 확정해 최종
          목록에 포함해 드려요.
        </p>
      </div>
      <span className="pb-swipe-hint">← 옆으로 넘겨서 더 보기 →</span>

      <div className="pb-grid">
        {benefits.map((benefit, index) => (
          <article className="pb-card pending" key={`${benefit.sourceId ?? benefit.title}-${index}`}>
            <h3>{benefit.title}</h3>
            <p className="pb-reason">{benefit.reason}</p>
            {benefit.missingInputs.length > 0 && (
              <div className="pb-missing">
                {benefit.missingInputs.map((f) => REQUIRED_FIELD_LABEL[f] ?? f).join(", ")}을(를)
                입력하면 확인할 수 있어요.
              </div>
            )}
          </article>
        ))}
      </div>

      <button type="button" className="btn secondary" onClick={onSupplementClick}>
        정보 입력하고 확인하기
      </button>
    </section>
  );
}

function SupplementInputModal({
  requiredForMatching,
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: {
  requiredForMatching: string[];
  submitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (age: string, tenureYears: string) => void;
}) {
  const [age, setAge] = useState("");
  const [tenureYears, setTenureYears] = useState("");
  const needsAge = requiredForMatching.includes("age");
  const needsTenure = requiredForMatching.includes("tenureYears");

  return (
    <div className="idv-overlay" onClick={onClose}>
      <div className="idv-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="idv-grip" />
        <div className="idv-head">
          <div className="idv-brand">
            <span className="idv-shield">🪪</span>
            <div>
              <div className="idv-brand-title">추가 정보 입력</div>
              <div className="idv-brand-sub">더 정확한 혜택 매칭을 위해 필요해요</div>
            </div>
          </div>
          <button type="button" className="idv-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {needsAge && (
          <>
            <label className="idv-label">
              나이 (만) <span className="wage-badge">필수</span>
            </label>
            <div className="won-input">
              <input
                className="text-input"
                inputMode="numeric"
                placeholder="예) 35"
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              />
              <span className="won-suffix">세</span>
            </div>
          </>
        )}

        {needsTenure && (
          <>
            <label className="idv-label">
              근속연수 <span className="wage-badge">필수</span>
            </label>
            <div className="won-input">
              <input
                className="text-input"
                inputMode="numeric"
                placeholder="예) 5"
                value={tenureYears}
                onChange={(e) =>
                  setTenureYears(e.target.value.replace(/[^\d]/g, "").slice(0, 2))
                }
              />
              <span className="won-suffix">년</span>
            </div>
          </>
        )}

        {errorMessage && <div className="error-box">{errorMessage}</div>}

        <button
          type="button"
          className="btn"
          disabled={submitting}
          onClick={() => onSubmit(age, tenureYears)}
        >
          {submitting ? "확인 중…" : "입력하고 혜택 확인하기"}
        </button>
      </div>
    </div>
  );
}

function ReportInner({ reportId }: { reportId: number }) {
  const router = useRouter();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedMap, setFetchedMap] = useState<Map<string, FetchedDocument>>(new Map());
  const [fetching, setFetching] = useState(false);
  const [fetchDone, setFetchDone] = useState(false);
  const [autoCount, setAutoCount] = useState(0);
  const [showVerify, setShowVerify] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [pdfReport, setPdfReport] = useState<ReportDetail | null>(null);
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [pdfWage, setPdfWage] = useState("");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<"with-wage" | "without-wage" | null>(null);
  const [showSupplement, setShowSupplement] = useState(false);
  const [supplementSubmitting, setSupplementSubmitting] = useState(false);
  const [supplementError, setSupplementError] = useState<string | null>(null);

  async function submitSupplement(age: string, tenureYears: string) {
    if (!report) return;
    setSupplementSubmitting(true);
    setSupplementError(null);
    try {
      const toNum = (v: string): number | null => (v ? Number(v) : null);
      await api.patchAssessment(report.assessmentId, {
        age: toNum(age),
        tenureYears: toNum(tenureYears),
      });
      const refreshed = await api.getReport(reportId);
      setReport(refreshed);
      setShowSupplement(false);
    } catch (e) {
      setSupplementError(
        e instanceof ApiError ? e.message : "정보를 저장하지 못했어요. 다시 시도해주세요.",
      );
    } finally {
      setSupplementSubmitting(false);
    }
  }

  async function fetchDocuments() {
    setFetching(true);
    try {
      const res = await api.fetchDocuments(reportId);
      const map = new Map<string, FetchedDocument>();
      for (const item of res.items) {
        for (const doc of item.documents) {
          map.set(docKey(item.itemId, doc.documentName), doc);
        }
      }
      setFetchedMap(map);
      setAutoCount(res.autoFetchedCount);
      setFetchDone(true);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "자료를 불러오지 못했어요.");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    api
      .getReport(reportId)
      .catch((e) => {
        if (e instanceof ApiError) {
          if (e.code === "LIFE403_2") {
            router.replace(`/report/${reportId}/preview`);
            return null;
          }
          setError(e.message);
          return null;
        }
        setError("리포트를 불러오지 못했어요.");
        return null;
      })
      .then((data) => {
        if (data) setReport(data);
      });
  }, [reportId, router]);

  useEffect(() => {
    const stored = localStorage.getItem(verifiedStorageKey());
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { name?: string };
      setVerifiedName(parsed.name || "인증 회원");
      fetchDocuments();
    } catch {
      localStorage.removeItem(verifiedStorageKey());
    }
  }, [reportId]);

  async function handleVerified(name: string) {
    setVerifiedName(name);
    localStorage.setItem(
      verifiedStorageKey(),
      JSON.stringify({ name, verifiedAt: new Date().toISOString() }),
    );
    setShowVerify(false);
    fetchDocuments();
  }

  async function printPdfVersion(monthlyAverageWage: number | null) {
    setPdfError(null);
    setPdfLoading(monthlyAverageWage == null ? "without-wage" : "with-wage");
    try {
      const nextReport = await api.getPdfReport(
        reportId,
        monthlyAverageWage == null ? {} : { monthlyAverageWage },
      );
      setPdfReport(nextReport);
      setShowPdfOptions(false);
      window.setTimeout(() => window.print(), 80);
    } catch (e) {
      setPdfError(e instanceof ApiError ? e.message : "PDF 금액을 계산하지 못했어요.");
    } finally {
      setPdfLoading(null);
    }
  }

  function handlePrintWithWage() {
    const monthlyAverageWage = parseMoneyInput(pdfWage);
    if (!monthlyAverageWage || monthlyAverageWage <= 0) {
      setPdfError("월 평균임금을 입력해 주세요.");
      return;
    }
    void printPdfVersion(monthlyAverageWage);
  }

  if (error) return <div className="error-box">{error}</div>;
  if (!report) return <div className="center-state">불러오는 중…</div>;

  const now = report.items[0];
  const grouped = GROUP_ORDER.map((level) => ({
    level,
    items: report.items.filter((i) => i.priorityLevel === level),
  })).filter((g) => g.items.length > 0);

  // 스텝 전역 번호 부여
  let stepNo = 0;

  const summary = report.benefitSummary;

  return (
    <>
      <p className="step-hint">STEP 5 · 나의 행정 로드맵</p>

      {summary?.estimated ? (
        <div className="benefit-hero">
          <span className="bh-kicker">💰 이 로드맵으로 받을 수 있는 돈</span>
          <div className="bh-amount">
            약 {formatWon(summary.totalReceiveAmount)}
          </div>
          <div className="bh-sub">
            지금 신청 가능한 {summary.receiveItemCount}가지 혜택의 예상 수령액을 합친
            금액이에요. 아래에서 항목별 금액을 확인하세요.
          </div>
          {summary.totalMonthlySaving > 0 && (
            <div className="bh-saving">
              여기에 더해 매달 <b>약 {formatWon(summary.totalMonthlySaving)}</b>씩 아낄 수
              있어요
            </div>
          )}
        </div>
      ) : (
        <div className="benefit-empty">
          <div className="be-title">💰 예상 수령액을 계산하려면</div>
          <div className="be-sub">
            PDF 저장 시 월 평균임금을 입력하면 실업급여·퇴직금·보험료 절감액을 실제
            숫자로 계산해 드려요. 월급 없이 저장하면 예상 범위와 계산 기준으로 보여드려요.
          </div>
        </div>
      )}

      {now && (
        <div className="now-hero">
          <span className="kicker">🚩 지금 당장 해야 할 일</span>
          <h2>{now.title}</h2>
          <p className="now-reason">{now.reason}</p>
          {now.deadlineText && <div className="now-deadline">⏰ {now.deadlineText}</div>}
          {now.officialUrl && (
            <a
              className="now-cta"
              href={now.officialUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {now.procedureName} 바로 신청하러 가기 ↗
            </a>
          )}
        </div>
      )}

      <div className={`fetch-banner ${fetchDone ? "done" : ""}`}>
        <span className="fb-ico">{fetchDone ? "✅" : "🪪"}</span>
        <div className="fb-text">
          <div className="fb-title">
            {fetchDone
              ? `${verifiedName ? `${verifiedName}님 ` : ""}서류 ${autoCount}건 자동 조회 완료`
              : "필요 서류 한 번에 불러오기"}
          </div>
          <div className="fb-sub">
            {fetchDone
              ? "공공기관 발급 서류는 자동 첨부, 나머지는 직접 준비 안내로 표시했어요."
              : "본인인증 후 공공 마이데이터로 발급 가능한 서류를 자동으로 조회합니다."}
          </div>
        </div>
        {!fetchDone && (
          <button
            type="button"
            onClick={() => setShowVerify(true)}
            disabled={fetching}
          >
            {fetching ? "조회 중…" : "본인인증"}
          </button>
        )}
      </div>

      {showVerify && (
        <IdentityVerifyModal
          onClose={() => setShowVerify(false)}
          onComplete={handleVerified}
        />
      )}

      {(report.requiredForMatching?.length ?? 0) > 0 && (
        <div className="fetch-banner">
          <span className="fb-ico">🔎</span>
          <div className="fb-text">
            <div className="fb-title">
              {report.requiredForMatching.map((f) => REQUIRED_FIELD_LABEL[f] ?? f).join(", ")}
              을(를) 입력하면 추가 혜택을 확인할 수 있어요
            </div>
            <div className="fb-sub">아래 정보 입력 후 자격이 확정되는 대로 목록에 반영돼요.</div>
          </div>
          <button type="button" onClick={() => setShowSupplement(true)}>
            입력하기
          </button>
        </div>
      )}

      {showSupplement && (
        <SupplementInputModal
          requiredForMatching={report.requiredForMatching ?? []}
          submitting={supplementSubmitting}
          errorMessage={supplementError}
          onClose={() => setShowSupplement(false)}
          onSubmit={submitSupplement}
        />
      )}

      <PublicBenefitSection benefits={report.publicBenefits ?? []} />
      <PendingBenefitSection
        benefits={report.pendingBenefits ?? []}
        onSupplementClick={() => setShowSupplement(true)}
      />

      {showPdfOptions && (
        <div className="idv-overlay pdf-choice-overlay" onClick={() => setShowPdfOptions(false)}>
          <div
            className="idv-sheet pdf-choice-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="idv-grip" />

            <div className="idv-head">
              <div className="idv-brand">
                <span className="idv-shield">₩</span>
                <div>
                  <div className="idv-brand-title">PDF 저장 방식 선택</div>
                  <div className="idv-brand-sub">월급 입력 여부에 따라 금액 표시가 달라져요</div>
                </div>
              </div>
              <button
                type="button"
                className="idv-close"
                onClick={() => setShowPdfOptions(false)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="pdf-choice-cards">
              <button
                type="button"
                className="pdf-choice-card strong"
                onClick={() => {
                  setPdfError(null);
                  const input = document.querySelector<HTMLInputElement>(".pdf-choice-sheet input");
                  input?.focus();
                }}
              >
                <div className="pdf-choice-label">추천</div>
                <div className="pdf-choice-title">월급 입력 PDF</div>
                <p>실업급여, 국민연금, 건강보험, 퇴직금 금액을 실제 숫자로 계산합니다.</p>
              </button>
              <button
                type="button"
                className="pdf-choice-card"
                disabled={pdfLoading !== null}
                onClick={() => printPdfVersion(null)}
              >
                <div className="pdf-choice-label">기본</div>
                <div className="pdf-choice-title">월급 없이 PDF</div>
                <p>개인 급여 정보 없이 예상 범위와 계산 기준 중심으로 저장합니다.</p>
              </button>
            </div>

            <label className="idv-label">월 평균임금(세전)</label>
            <div className="won-input">
              <input
                className="text-input"
                inputMode="numeric"
                placeholder="예) 3,000,000"
                value={pdfWage}
                onChange={(e) => {
                  setPdfWage(formatMoneyInput(e.target.value));
                  setPdfError(null);
                }}
              />
              <span className="won-suffix">원</span>
            </div>

            {pdfError && <div className="error-box pdf-choice-error">{pdfError}</div>}

            <div className="pdf-choice-actions">
              <button
                type="button"
                className="btn"
                disabled={pdfLoading !== null}
                onClick={handlePrintWithWage}
              >
                {pdfLoading === "with-wage" ? "계산 중…" : "월급 입력해서 저장"}
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={pdfLoading !== null}
                onClick={() => printPdfVersion(null)}
              >
                {pdfLoading === "without-wage" ? "준비 중…" : "월급 없이 저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="rm-section-title">전체 로드맵</h2>
      <p className="rm-section-sub">
        급한 순서대로 {report.items.length}단계로 정리했어요. 위에서부터 처리하세요.
      </p>

      {grouped.map((group) => (
        <div className="rm-group" key={group.level}>
          <div className="rm-group-head">
            <span className={`rm-dot ${toneClass(group.level)}`} />
            {GROUP_META[group.level].title}
          </div>
          {group.items.map((item) => {
            stepNo += 1;
            return (
              <StepCard
                key={item.itemId}
                reportId={reportId}
                item={item}
                index={stepNo}
                isNow={now?.itemId === item.itemId}
                fetchedMap={fetchedMap}
              />
            );
          })}
        </div>
      ))}

      {summary?.estimated && (
        <p className="benefit-disclaimer">※ {summary.basisNote}</p>
      )}

      <div className="sticky-cta no-print" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          className="btn"
          onClick={() => router.push(`/report/${reportId}/chat`)}
        >
          이 로드맵으로 AI에게 질문하기 (남은 {report.aiQuestionRemaining}회)
        </button>
        <button type="button" className="btn secondary" onClick={() => setShowPdfOptions(true)}>
          예상 수령액 리포트 PDF로 저장
        </button>
      </div>

      <ReportPdfDocument report={pdfReport ?? report} />
    </>
  );
}

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AppShell showLogout>
      <AuthGuard>
        <ReportInner reportId={Number(id)} />
      </AuthGuard>
    </AppShell>
  );
}
