import type { ProcedureType, ReportDetail } from "@/lib/types";
import { eligibilityLabel, priorityLabel } from "@/lib/labels";

type ReportItem = ReportDetail["items"][number];

type MoneyInsight = {
  label: string;
  note: string;
  badge: string;
  tone: "strong" | "save" | "range" | "muted";
};

const BENEFIT_GUIDE: Record<
  ProcedureType,
  {
    valueLabel: string;
    valueNote: string;
    why: string;
    action: string;
  }
> = {
  UNEMPLOYMENT_BENEFIT: {
    valueLabel: "총 약 790만~1,840만원 가능",
    valueNote: "2026년 구직급여 일액 66,048~68,100원, 고용보험 기간과 나이에 따라 120~270일 적용",
    why: "퇴사 다음 날부터 12개월 안에 소정급여일수를 모두 받아야 해서 늦게 신청하면 받을 수 있는 일수가 줄어들 수 있습니다.",
    action: "워크넷 구직 등록 후 고용24에서 수급자격 신청",
  },
  HEALTH_INSURANCE_CONTINUATION: {
    valueLabel: "월급의 약 3.545% 수준",
    valueNote: "직장가입자 본인부담 보험료율 기준. 예: 월급 300만원이면 월 약 10.6만원",
    why: "퇴직 후 지역가입자로 전환되면 재산과 소득이 함께 반영되어 보험료가 갑자기 오를 수 있습니다.",
    action: "퇴직 후 지역가입자 고지 전 국민건강보험공단에 임의계속가입 가능 여부 확인",
  },
  NATIONAL_PENSION_EXCEPTION: {
    valueLabel: "월급의 약 9%, 최대 월 약 57만원 유예",
    valueNote: "2026년 기준소득월액 상한 637만원 기준. 소득이 없으면 납부예외 신청 가능",
    why: "소득이 끊긴 기간에도 보험료가 계속 고지될 수 있어, 납부예외를 놓치면 현금흐름 부담이 커집니다.",
    action: "국민연금공단에서 소득 없음 상태와 납부예외 신청 가능 기간 확인",
  },
  TAX_CHECK: {
    valueLabel: "환급 가능성 확인 필요",
    valueNote: "원천징수 내역, 공제 항목, 중도퇴사 정산 여부에 따라 수만원~수십만원 이상 차이 가능",
    why: "중도퇴사자는 연말정산이 누락되기 쉬워 종합소득세 신고 기간을 놓치면 환급 기회를 잃을 수 있습니다.",
    action: "홈택스에서 원천징수영수증과 공제자료 확인 후 5월 종합소득세 신고",
  },
  SEVERANCE_PAY: {
    valueLabel: "월 평균임금 × 근속연수",
    valueNote: "예: 월급 300만원, 3년 근속이면 약 900만원. 1년 이상 근속 여부가 핵심",
    why: "퇴직금은 퇴직일로부터 14일 이내 지급이 원칙이며, 미지급 시 고용노동부 진정 대상입니다.",
    action: "퇴직 전 3개월 임금, 상여, 연차수당, 근속기간을 기준으로 회사 계산액 대조",
  },
};

/** 원 단위 금액을 "1,225만원" / "1억 2,000만원" 형태로 변환. */
function formatWon(amount: number): string {
  if (amount < 10000) return `${amount.toLocaleString()}원`;
  const eok = Math.floor(amount / 100000000);
  const man = Math.floor((amount % 100000000) / 10000);
  let s = "";
  if (eok > 0) s += `${eok.toLocaleString()}억${man > 0 ? " " : ""}`;
  if (man > 0 || eok === 0) s += `${man.toLocaleString()}만`;
  return `${s}원`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function moneyInsight(item: ReportItem): MoneyInsight {
  const guide = BENEFIT_GUIDE[item.procedureType];
  const estimate = item.estimate;

  if (item.eligibilityLevel === "LOW") {
    return {
      label: "현재 조건에서는 금액 발생 가능성 낮음",
      note: estimate?.detail ?? guide.valueNote,
      badge: "가능성 낮음",
      tone: "muted",
    };
  }

  if (estimate?.amountLabel) {
    return {
      label: estimate.amountLabel,
      note: estimate.detail || guide.valueNote,
      badge: estimate.kind === "SAVE_MONTHLY" ? "월 절감 산정" : "예상액 산정",
      tone: estimate.kind === "SAVE_MONTHLY" ? "save" : "strong",
    };
  }

  if (typeof estimate?.amount === "number") {
    const prefix = estimate.kind === "SAVE_MONTHLY" ? "월 약 " : "약 ";
    return {
      label: `${prefix}${formatWon(estimate.amount)}`,
      note: estimate.detail || guide.valueNote,
      badge: estimate.kind === "SAVE_MONTHLY" ? "월 절감 산정" : "예상액 산정",
      tone: estimate.kind === "SAVE_MONTHLY" ? "save" : "strong",
    };
  }

  if (estimate?.kind === "VARIABLE") {
    return {
      label: guide.valueLabel,
      note: estimate.detail || guide.valueNote,
      badge: "환급 변동",
      tone: "range",
    };
  }

  return {
    label: guide.valueLabel,
    note: `${estimate?.detail ?? "월 평균임금, 나이, 근속연수 입력 시 개인 예상액으로 확정됩니다."} ${guide.valueNote}`,
    badge: "예상 범위",
    tone: "range",
  };
}

function summaryReceive(report: ReportDetail): { label: string; value: string; note: string } {
  const s = report.benefitSummary;
  if (s.estimated && s.totalReceiveAmount > 0) {
    return {
      label: "계산된 예상 수령액",
      value: `약 ${formatWon(s.totalReceiveAmount)}`,
      note: `${s.receiveItemCount}개 수령 항목 합계`,
    };
  }

  return {
    label: "큰돈이 걸린 항목",
    value: "실업급여·퇴직금 우선 확인",
    note: "월 평균임금과 근속연수 입력 시 개인 금액으로 확정",
  };
}

function summarySaving(report: ReportDetail): { label: string; value: string; note: string } {
  const s = report.benefitSummary;
  if (s.estimated && s.totalMonthlySaving > 0) {
    return {
      label: "계산된 월 절감액",
      value: `월 약 ${formatWon(s.totalMonthlySaving)}`,
      note: "국민연금·건강보험 등 매월 현금흐름 영향",
    };
  }

  return {
    label: "매월 새는 돈 방지",
    value: "보험료·연금 고지 확인",
    note: "소득 없음 상태라면 납부예외와 임의계속가입을 먼저 검토",
  };
}

function uniqueDocuments(items: ReportItem[]) {
  const seen = new Set<string>();
  return items
    .flatMap((item) =>
      item.requiredDocuments.map((doc) => ({
        ...doc,
        procedureName: item.procedureName,
      })),
    )
    .filter((doc) => {
      const key = `${doc.documentName}-${doc.procedureName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * 인쇄(PDF 저장) 전용 리포트 문서.
 * 화면에서는 숨겨지고( .pdf-doc display:none ), 인쇄 시에만 노출된다.
 */
export function ReportPdfDocument({ report }: { report: ReportDetail }) {
  const receive = summaryReceive(report);
  const saving = summarySaving(report);
  const topItems = report.items.slice(0, 3);
  const documents = uniqueDocuments(report.items).slice(0, 12);
  const publicBenefits = (report.publicBenefits ?? []).slice(0, 4);
  const hasPublicBenefits = publicBenefits.length > 0;

  return (
    <div className="pdf-doc">
      <article className="pdf-page">
        <header className="pdf-cover">
          <div className="pdf-cover-top">
            <div className="pdf-brand">
              LIFT
            </div>
            <div className="pdf-head-meta">
              생애전환 유료 리포트
              <br />
              발급일 {formatDate(report.createdAt)}
            </div>
          </div>

          <div className="pdf-cover-body">
            <p className="pdf-kicker">퇴직 후 돈과 마감일을 함께 보는 액션 리포트</p>
            <h1 className="pdf-title">{report.summaryTitle}</h1>
            <p className="pdf-summary-msg">{report.summaryMessage}</p>
          </div>

          <section className="pdf-metrics" aria-label="핵심 요약">
            <div className="pdf-metric primary">
              <span>{receive.label}</span>
              <strong>{receive.value}</strong>
              <small>{receive.note}</small>
            </div>
            <div className="pdf-metric">
              <span>{saving.label}</span>
              <strong>{saving.value}</strong>
              <small>{saving.note}</small>
            </div>
            <div className="pdf-metric">
              <span>놓치면 안 되는 절차</span>
              <strong>{report.items.length}가지</strong>
              <small>급한 순서대로 정리</small>
            </div>
          </section>
        </header>

        <section className="pdf-section-block pdf-keep">
          <div className="pdf-section-head">
            <span>01</span>
            <h2>LIFT TOP {topItems.length}</h2>
          </div>
          <div className="pdf-top-grid">
            {topItems.map((item, index) => {
              const money = moneyInsight(item);
              return (
                <div className="pdf-top-card" key={item.itemId}>
                  <div className="pdf-top-rank">{index + 1}</div>
                  <div className="pdf-top-content">
                    <div className="pdf-card-title">{item.title}</div>
                    <div className="pdf-chip-row">
                      <span className={`pdf-chip priority-${item.priorityLevel.toLowerCase()}`}>
                        {priorityLabel[item.priorityLevel]}
                      </span>
                      <span className={`pdf-chip eligibility-${item.eligibilityLevel.toLowerCase()}`}>
                        {eligibilityLabel[item.eligibilityLevel]}
                      </span>
                    </div>
                    <p>{BENEFIT_GUIDE[item.procedureType].why}</p>
                    {item.deadlineText && (
                      <div className="pdf-deadline">마감 포인트: {item.deadlineText}</div>
                    )}
                    <div className={`pdf-money-line ${money.tone}`}>
                      <b>{money.label}</b>
                      <span>{money.badge}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="pdf-section-block">
          <div className="pdf-section-head">
            <span>02</span>
            <h2>혜택별 금액 진단</h2>
          </div>
          <table className="pdf-table pdf-money-table">
            <thead>
              <tr>
                <th>혜택</th>
                <th>신청 판단</th>
                <th>예상 금액 / 산식</th>
                <th>바로 할 일</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((item) => {
                const money = moneyInsight(item);
                return (
                  <tr key={item.itemId}>
                    <td data-label="혜택">
                      <div className="pdf-td-name">{item.procedureName}</div>
                      <div className="pdf-td-detail">{item.reason}</div>
                    </td>
                    <td data-label="신청 판단">
                      <span className={`pdf-mini-pill eligibility-${item.eligibilityLevel.toLowerCase()}`}>
                        {eligibilityLabel[item.eligibilityLevel]}
                      </span>
                    </td>
                    <td data-label="예상 금액 / 산식">
                      <div className={`pdf-amount ${money.tone}`}>{money.label}</div>
                      <div className="pdf-td-detail">{money.note}</div>
                    </td>
                    <td data-label="바로 할 일">
                      <div className="pdf-action-text">
                        {BENEFIT_GUIDE[item.procedureType].action}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {hasPublicBenefits && (
          <section className="pdf-section-block pdf-public-benefits pdf-keep">
            <div className="pdf-section-head">
              <span>03</span>
              <h2>공공데이터 추가 혜택 후보</h2>
            </div>
            <div className="pdf-public-grid">
              {publicBenefits.map((benefit, index) => (
                <div
                  className="pdf-public-card"
                  key={`${benefit.sourceId ?? benefit.title}-${index}`}
                >
                  <div className="pdf-public-top">
                    <b>{index + 1}</b>
                    <span>{benefit.sourceLabel}</span>
                  </div>
                  <div className="pdf-public-title">{benefit.title}</div>
                  <p>{benefit.aiSummary || benefit.reason}</p>
                  {benefit.summary && <small>{benefit.summary}</small>}
                  <div className="pdf-public-meta">
                    {benefit.provider && <span>{benefit.provider}</span>}
                    {benefit.applicationDeadline && <span>{benefit.applicationDeadline}</span>}
                    {benefit.requiredDocuments.length > 0 && (
                      <span>서류 {benefit.requiredDocuments.length}개</span>
                    )}
                    <span>검색어 {benefit.matchedKeyword}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="pdf-section-block pdf-two-col">
          <div className="pdf-panel">
            <div className="pdf-section-head compact">
              <span>{hasPublicBenefits ? "04" : "03"}</span>
              <h2>신청 우선순위 로드맵</h2>
            </div>
            <ol className="pdf-roadmap">
              {report.items.map((item, index) => (
                <li key={item.itemId}>
                  <div className="pdf-rm-index">{index + 1}</div>
                  <div>
                    <div className="pdf-rm-main">
                      <span className="pdf-rm-title">{item.title}</span>
                      <span className={`pdf-rm-tag ${item.priorityLevel.toLowerCase()}`}>
                        {priorityLabel[item.priorityLevel]}
                      </span>
                    </div>
                    {item.deadlineText && (
                      <div className="pdf-rm-deadline">{item.deadlineText}</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="pdf-panel">
            <div className="pdf-section-head compact">
              <span>{hasPublicBenefits ? "05" : "04"}</span>
              <h2>준비서류 체크리스트</h2>
            </div>
            {documents.length > 0 ? (
              <ul className="pdf-doc-list">
                {documents.map((doc) => (
                  <li key={`${doc.procedureName}-${doc.documentName}`}>
                    <span className="pdf-check-box" />
                    <div>
                      <b>{doc.documentName}</b>
                      <small>
                        {doc.procedureName}
                        {doc.issuer ? ` · ${doc.issuer}` : ""}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pdf-empty">현재 항목에는 필수 서류가 등록되어 있지 않습니다.</p>
            )}
          </div>
        </section>

        <section className="pdf-section-block pdf-formula pdf-keep">
          <div className="pdf-section-head compact">
            <span>{hasPublicBenefits ? "06" : "05"}</span>
            <h2>금액 계산 기준</h2>
          </div>
          <div className="pdf-formula-grid">
            <div>
              <b>실업급여</b>
              <span>1일 66,048~68,100원 × 120~270일</span>
            </div>
            <div>
              <b>퇴직금</b>
              <span>1일 평균임금 × 30일 × 근속연수</span>
            </div>
            <div>
              <b>국민연금</b>
              <span>기준소득월액 × 9%, 2026년 상한 637만원</span>
            </div>
            <div>
              <b>건강보험</b>
              <span>직장가입자 본인부담 기준 월 보수 × 3.545%</span>
            </div>
          </div>
        </section>

        <footer className="pdf-foot">
          <p>
            {report.benefitSummary.basisNote} 입력값이 부족한 항목은 법정 산식과 2026년
            기준 요율로 예상 범위를 함께 표시했습니다. 실제 지급액과 환급액은 관할 기관
            판단, 급여 내역, 공제 자료에 따라 달라질 수 있습니다.
          </p>
          <p className="pdf-foot-brand">LIFT · 생애전환 행정 준비 도우미</p>
        </footer>
      </article>
    </div>
  );
}
