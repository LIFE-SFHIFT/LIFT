"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { EligibilityBadge } from "@/components/Badges";
import { IdentityVerifyModal } from "@/components/IdentityVerifyModal";
import { api, ApiError } from "@/lib/api";
import { priorityLabel } from "@/lib/labels";
import type {
  FetchedDocument,
  LocalNotice,
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

/** 리포트에 함께 노출할 지역 공고 최대 개수. 한 시/도에 확정 공고가 많아도 리포트가 이걸로 도배되지 않게 한다. */
const LOCAL_NOTICE_DISPLAY_LIMIT = 6;

/**
 * 진단 입력 시 저장해 둔 사용자 시/도·시군구. 지역 공고를 사용자 지역으로 좁히는 데 쓴다.
 * 실제 로그인 사용자·데모 사용자 모두 지역이 남도록, 진단 생성 시 저장하는 범용 키(lift.assessmentRegion)를
 * 먼저 보고, 없으면 데모 저장소(lift.demo.assessmentInputs)로 폴백한다. (예전엔 데모 키만 봐서 실사용자는
 * 지역 필터가 아예 안 걸리고 전국 공고가 노출됐다.)
 */
function readAssessmentRegion(): { sido?: string; sigungu?: string } {
  const pick = (key: string): { sido?: string; sigungu?: string } | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const v = JSON.parse(raw) as { regionSido?: string | null; regionSigungu?: string | null };
      if (!v.regionSido && !v.regionSigungu) return null;
      return { sido: v.regionSido ?? undefined, sigungu: v.regionSigungu ?? undefined };
    } catch {
      return null;
    }
  };
  return pick("lift.assessmentRegion") ?? pick("lift.demo.assessmentInputs") ?? {};
}

/** 지역 공고 본문에 노출할 원문 길이 상한. 화면에선 3줄로 접히고(더보기), 펼쳐도 이 길이까지만 보여준다. */
const LOCAL_NOTICE_BODY_MAX = 300;

/** 너무 긴 텍스트를 max 근처의 단어 경계에서 자르고 말줄임표를 붙인다. */
function clampText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trimEnd()}…`;
}

/**
 * 지역 공고 카드의 회색 본문. 원문(summary)이 있으면 너무 길지 않게 다듬어 그대로 쓰고(길면 카드에서 3줄로
 * 접힌 뒤 더보기로 펼침), 원문이 업스트림 정제로 비어 있으면 AI가 뽑은 신청 대상 → 판단 근거 순으로 채운다.
 * (예전엔 원문이 null인 공고에서 본문이 통째로 사라져 카드에 제목/지원 내용만 남았다.)
 */
function localNoticeBody(notice: LocalNotice): string | null {
  const raw = notice.summary?.trim();
  if (raw) return clampText(raw, LOCAL_NOTICE_BODY_MAX);
  return notice.targetGroupSummary?.trim() || notice.reason?.trim() || null;
}

/**
 * 지자체 RSS 파이프라인이 확정한 지역 공고(LocalNotice)를 화면 공용 혜택 카드(PublicBenefit) 형태로 변환한다.
 * 값은 백엔드(/api/local-notices)에서 받은 것을 그대로 매핑할 뿐이며 프론트에서 지어내지 않는다.
 */
function toLocalNoticeBenefit(notice: LocalNotice): PublicBenefit {
  const regionLabel = [notice.regionSido, notice.regionSigungu].filter(Boolean).join(" ");
  return {
    title: notice.title,
    summary: localNoticeBody(notice),
    provider: regionLabel || "지자체",
    category: notice.category,
    applicationUrl: notice.link,
    sourceId: `local-notice-${notice.id}`,
    matchedKeyword: notice.matchedKeyword ?? "",
    reason: notice.reason ?? "지자체 게시판에서 수집·확정된 지역 지원사업/장려금입니다.",
    sourceLabel: `${regionLabel || "지자체"} · 지자체 RSS`,
    sourceType: "DB",
    fitLevel: "NEEDS_CHECK",
    priorityGroup: "LOCAL",
    supportTarget: notice.targetGroupSummary,
    selectionCriteria: null,
    supportContent: notice.supportContentSummary,
    applicationMethod: null,
    applicationDeadline: null,
    contact: null,
    requiredDocuments: [],
    missingInputs: [],
    aiSummary: notice.supportContentSummary ?? notice.reason,
    // 지역 공고는 정부24처럼 점수화된 매칭이 아니라 지역 필터로만 붙은 것이라 관련도 점수가 없다.
    // 0(미채점)으로 두고, 아래 카드 렌더에서 점수 배지 자체를 숨긴다(근거 없는 "50점"을 표시하지 않기 위해).
    relevanceScore: 0,
  };
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

/**
 * 혜택 카드의 본문 요약. 기본은 3줄로 접어두고, 실제로 넘칠 때만 "더보기/접기" 버튼을 보여준다.
 * 공공데이터 API 카드처럼 짧은 요약은 버튼이 뜨지 않고, 지자체 RSS 원문처럼 긴 설명만 접힌다.
 */
function ClampSummary({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clampable, setClampable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 접힌(3줄 클램프) 상태에서 실제 내용이 넘치는지로 "더보기" 노출 여부를 판단한다.
    setClampable(el.scrollHeight - el.clientHeight > 4);
  }, [text]);

  return (
    <div className="pb-summary-wrap">
      <p ref={ref} className={`pb-summary ${expanded ? "" : "clamp"}`}>
        {text}
      </p>
      {(clampable || expanded) && (
        <button type="button" className="pb-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "접기" : "더보기"}
        </button>
      )}
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
              {/* 지역 공고(local-notice-*)는 관련도 점수가 없어 배지를 숨긴다. 정부24 혜택만 실제 점수를 표시. */}
              {!benefit.sourceId?.startsWith("local-notice-") && (
                <span className="pb-score">{benefit.relevanceScore}점</span>
              )}
            </div>
            <h3>{benefit.title}</h3>
            <p className="pb-reason">{benefit.aiSummary || benefit.reason}</p>
            {benefit.summary && <ClampSummary text={benefit.summary} />}

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

  const fetchDocuments = useCallback(async () => {
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
  }, [reportId]);

  useEffect(() => {
    let cancelled = false;
    api
      .getReport(reportId)
      .catch((e) => {
        if (cancelled) return null;
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
      .then(async (data) => {
        if (!data || cancelled) return;
        // 지자체 RSS 파이프라인이 확정한 지역 지원사업/장려금을 실제 백엔드에서 받아와 함께 노출한다.
        // 사용자 시/도에 해당하는 것만, 최신순으로 일부만 붙인다(관련 없는 타 지역 공고가 리포트를 뒤덮지 않게).
        // 공개(permitAll) 엔드포인트라 데모(비로그인)에서도 동일하게 동작하며, 조회 실패는 리포트 표시를 막지 않는다.
        try {
          const region = readAssessmentRegion();
          const notices = await api.listLocalNotices(region.sido, region.sigungu);
          if (notices.length) {
            data = {
              ...data,
              publicBenefits: [
                ...(data.publicBenefits ?? []),
                ...notices.slice(0, LOCAL_NOTICE_DISPLAY_LIMIT).map(toLocalNoticeBenefit),
              ],
            };
          }
        } catch {
          // 지역 공고 조회 실패는 무시(리포트 본문은 그대로 표시).
        }
        if (!cancelled) setReport(data);
      });
    return () => {
      cancelled = true;
    };
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
  }, [fetchDocuments, reportId]);

  async function handleVerified(name: string) {
    setVerifiedName(name);
    localStorage.setItem(
      verifiedStorageKey(),
      JSON.stringify({ name, verifiedAt: new Date().toISOString() }),
    );
    setShowVerify(false);
    fetchDocuments();
  }

  function openPdfVersion(monthlyAverageWage: number | null) {
    if (!report?.pdfAvailable) {
      setPdfError("PDF 저장은 확장 리포트 결제 후 이용할 수 있어요.");
      return;
    }
    setPdfError(null);
    setPdfLoading(monthlyAverageWage == null ? "without-wage" : "with-wage");
    const query =
      monthlyAverageWage == null
        ? ""
        : `?monthlyAverageWage=${encodeURIComponent(String(monthlyAverageWage))}`;
    setShowPdfOptions(false);
    router.push(`/report/${reportId}/pdf${query}`);
  }

  function handlePrintWithWage() {
    const monthlyAverageWage = parseMoneyInput(pdfWage);
    if (!monthlyAverageWage || monthlyAverageWage <= 0) {
      setPdfError("월 평균임금을 입력해 주세요.");
      return;
    }
    openPdfVersion(monthlyAverageWage);
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

      {summary?.estimated &&
      (summary.totalReceiveAmount > 0 || summary.totalMonthlySaving > 0) ? (
        <div className="benefit-hero">
          <span className="bh-kicker">
            💰 이 로드맵으로 {summary.totalReceiveAmount > 0 ? "한 번에 받을 수 있는 돈" : "매달 아낄 수 있는 돈"}
          </span>
          {summary.totalReceiveAmount > 0 ? (
            <>
              <div className="bh-amount">
                약 {formatWon(summary.totalReceiveAmount)}
              </div>
              <div className="bh-sub">
                지금 신청 가능한 {summary.receiveItemCount}가지 혜택(실업급여·퇴직금 등)의
                예상 수령액을 <b>한 번에 합친 금액</b>이에요. 아래에서 항목별 금액을 확인하세요.
              </div>
            </>
          ) : (
            <div className="bh-amount">매달 약 {formatWon(summary.totalMonthlySaving)}</div>
          )}
          {summary.totalReceiveAmount > 0 && summary.totalMonthlySaving > 0 && (
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
                onClick={() => openPdfVersion(null)}
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
        {report.aiChatAvailable ? (
          <button
            type="button"
            className="btn"
            onClick={() => router.push(`/report/${reportId}/chat`)}
          >
            이 로드맵으로 AI에게 질문하기 (남은 {report.aiQuestionRemaining}회)
          </button>
        ) : (
          <button type="button" className="btn" disabled>
            AI 질문은 확장 리포트에서 이용 가능
          </button>
        )}
        <button
          type="button"
          className="btn secondary"
          disabled={!report.pdfAvailable}
          onClick={() => {
            if (report.pdfAvailable) setShowPdfOptions(true);
          }}
        >
          {report.pdfAvailable ? "예상 수령액 리포트 PDF로 저장" : "PDF 저장은 확장 리포트에서 이용 가능"}
        </button>
      </div>
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
