"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { openPdfFallbackWindow, safePdfFilename, savePdfBlob } from "@/lib/pdfExport";

const DOC_PROFILES: Record<
  string,
  {
    title: string;
    issuer: string;
    rows: Array<[string, string]>;
    notes: string[];
  }
> = {
  "이직확인서": {
    title: "이직확인서",
    issuer: "서울고용복지플러스센터",
    rows: [
      ["성명", "김리프트"],
      ["생년월일", "1991.04.18"],
      ["사업장명", "주식회사 넥스트워크"],
      ["이직일", "2026.06.30"],
      ["이직 사유", "계약기간 만료"],
      ["피보험 단위기간", "238일"],
      ["평균임금 산정기간", "2026.04.01 - 2026.06.30"],
      ["처리 상태", "사업주 제출 완료"],
    ],
    notes: [
      "본 문서는 고용보험 신고자료를 기준으로 자동 조회된 모의 발급본입니다.",
      "실업급여 신청 전 고용센터에서 최종 처리 여부를 확인하세요.",
    ],
  },
  "고용보험 피보험자격 이력": {
    title: "고용보험 피보험자격 이력내역서",
    issuer: "근로복지공단",
    rows: [
      ["성명", "김리프트"],
      ["생년월일", "1991.04.18"],
      ["최근 사업장", "주식회사 넥스트워크"],
      ["자격 취득일", "2024.03.01"],
      ["자격 상실일", "2026.06.30"],
      ["총 가입기간", "28개월"],
      ["상실 사유", "계약기간 만료"],
      ["발급 용도", "구직급여 수급자격 확인"],
    ],
    notes: [
      "고용보험 피보험 이력은 수급자격 판단의 핵심 자료입니다.",
      "사업장 신고 정정이 있는 경우 실제 내역과 달라질 수 있습니다.",
    ],
  },
  "임의계속(가입) 신청서": {
    title: "건강보험 임의계속가입 신청서",
    issuer: "국민건강보험공단",
    rows: [
      ["신청인", "김리프트"],
      ["주민등록번호", "910418-1******"],
      ["전 직장명", "주식회사 넥스트워크"],
      ["자격 상실일", "2026.06.30"],
      ["최근 직장보험료", "126,400원"],
      ["예상 지역보험료", "184,700원"],
      ["신청 가능 기한", "지역가입자 최초 고지 납부기한부터 2개월 이내"],
      ["처리 상태", "신청서 작성 가능"],
    ],
    notes: [
      "지역가입자 보험료와 임의계속가입 보험료를 비교한 뒤 신청하세요.",
      "실제 보험료는 공단 산정 기준과 재산·소득 자료에 따라 달라질 수 있습니다.",
    ],
  },
  "납부예외 신청서": {
    title: "국민연금 납부예외 신청서",
    issuer: "국민연금공단",
    rows: [
      ["가입자명", "김리프트"],
      ["생년월일", "1991.04.18"],
      ["신청 사유", "퇴직 후 소득활동 중단"],
      ["소득 중단일", "2026.07.01"],
      ["예외 신청 기간", "2026.07 - 2026.12"],
      ["관할 지사", "국민연금공단 서울북부지사"],
      ["처리 상태", "신청 전 검토"],
    ],
    notes: [
      "납부예외 기간은 가입기간에 포함되지 않습니다.",
      "추후 소득이 발생하면 납부재개 신고가 필요합니다.",
    ],
  },
  "원천징수영수증": {
    title: "근로소득 원천징수영수증",
    issuer: "국세청 홈택스",
    rows: [
      ["귀속연도", "2026년"],
      ["근로자명", "김리프트"],
      ["근무처", "주식회사 넥스트워크"],
      ["총급여", "24,800,000원"],
      ["근로소득공제", "8,920,000원"],
      ["결정세액", "312,400원"],
      ["기납부세액", "428,000원"],
      ["예상 환급세액", "115,600원"],
    ],
    notes: [
      "중도퇴사자는 연말정산 누락 여부를 반드시 확인하세요.",
      "최종 세액은 다음 해 5월 종합소득세 신고 결과에 따라 달라질 수 있습니다.",
    ],
  },
};

function fallbackProfile(name: string, issuer: string) {
  return {
    title: name,
    issuer: issuer || "공공기관",
    rows: [
      ["성명", "김리프트"],
      ["발급번호", `LIFT-${new Date().getFullYear()}-482917`],
      ["문서명", name],
      ["발급기관", issuer || "공공기관"],
      ["조회 방식", "공공 마이데이터 모의 연동"],
      ["처리 상태", "자동 조회 완료"],
    ],
    notes: [
      "LIFT에서 자동 조회된 서류의 모의 발급본입니다.",
      "실제 제출 전 기관 원본과 정보가 일치하는지 확인하세요.",
    ],
  };
}

function today() {
  return new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}

function filenameDate() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Canvas export failed."));
    }, type, quality);
  });
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = next;
    }
  }

  if (line) ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

function makePdfFromImage(imageBytes: Uint8Array, width: number, height: number) {
  const encoder = new TextEncoder();
  const chunks: Array<string | Uint8Array> = [];
  const offsets: number[] = [0];
  let position = 0;

  function push(chunk: string | Uint8Array) {
    chunks.push(chunk);
    position += typeof chunk === "string" ? encoder.encode(chunk).length : chunk.length;
  }

  function object(id: number, body: () => void) {
    offsets[id] = position;
    push(`${id} 0 obj\n`);
    body();
    push("\nendobj\n");
  }

  push("%PDF-1.4\n");
  object(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  object(2, () => push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
  object(3, () =>
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    ),
  );
  object(4, () => {
    push(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
    );
    push(imageBytes);
    push("\nendstream");
  });

  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ`;
  object(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));

  const xref = position;
  push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i += 1) {
    push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

async function downloadMockPdf({
  profile,
  displayIssuer,
  source,
  reportId,
}: {
  profile: ReturnType<typeof fallbackProfile>;
  displayIssuer: string;
  source: string;
  reportId: string;
}) {
  const fallbackWindow = openPdfFallbackWindow();
  const width = 1240;
  const height = 1754;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    fallbackWindow?.close();
    throw new Error("Canvas context is unavailable.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#2563eb";
  ctx.fillRect(0, 0, width, 18);

  ctx.fillStyle = "#2563eb";
  ctx.font = "700 26px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
  ctx.fillText("LIFT 공공 마이데이터", 86, 108);

  ctx.fillStyle = "#111827";
  ctx.font = "800 54px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
  ctx.fillText(profile.title, 86, 188);

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(86, 235);
  ctx.lineTo(1154, 235);
  ctx.stroke();

  ctx.save();
  ctx.translate(1040, 148);
  ctx.rotate(-0.14);
  ctx.strokeStyle = "#1d4ed8";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#1d4ed8";
  ctx.textAlign = "center";
  ctx.font = "800 22px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
  ctx.fillText("자동조회", 0, -10);
  ctx.font = "900 38px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
  ctx.fillText("확인", 0, 34);
  ctx.restore();

  const meta = [
    ["발급기관", displayIssuer],
    ["조회출처", source],
    ["발급일자", today()],
    ["리포트 번호", `#${reportId}`],
  ];
  const metaY = 290;
  const metaW = 250;
  meta.forEach(([label, value], index) => {
    const x = 86 + index * 270;
    ctx.fillStyle = "#f4f7ff";
    ctx.fillRect(x, metaY, metaW, 96);
    ctx.fillStyle = "#667085";
    ctx.font = "700 20px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
    ctx.fillText(label, x + 18, metaY + 34);
    ctx.fillStyle = "#172033";
    ctx.font = "800 21px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
    wrapCanvasText(ctx, value, x + 18, metaY + 68, metaW - 36, 25);
  });

  let y = 450;
  const labelW = 270;
  const rowH = 72;
  profile.rows.forEach(([label, value]) => {
    ctx.strokeStyle = "#d9e2f2";
    ctx.lineWidth = 2;
    ctx.strokeRect(86, y, 1068, rowH);
    ctx.fillStyle = "#f8fbff";
    ctx.fillRect(86, y, labelW, rowH);
    ctx.fillStyle = "#475467";
    ctx.font = "800 24px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
    ctx.fillText(label, 112, y + 45);
    ctx.fillStyle = "#101828";
    ctx.font = "800 25px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
    ctx.fillText(value, 386, y + 45);
    y += rowH;
  });

  y += 40;
  ctx.fillStyle = "#f8fbff";
  ctx.fillRect(86, y, 1068, 190);
  ctx.strokeStyle = "#e4ebf7";
  ctx.strokeRect(86, y, 1068, 190);
  ctx.fillStyle = "#111827";
  ctx.font = "800 25px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
  ctx.fillText("확인 사항", 116, y + 48);
  ctx.fillStyle = "#475467";
  ctx.font = "500 22px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
  let noteY = y + 88;
  profile.notes.forEach((note) => {
    noteY = wrapCanvasText(ctx, `- ${note}`, 116, noteY, 1000, 31);
  });

  ctx.strokeStyle = "#d9e2f2";
  ctx.beginPath();
  ctx.moveTo(86, 1630);
  ctx.lineTo(1154, 1630);
  ctx.stroke();
  ctx.fillStyle = "#667085";
  ctx.font = "500 19px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
  ctx.fillText("이 문서는 LIFT 데모 환경에서 생성된 더미 데이터입니다.", 86, 1676);
  ctx.fillStyle = "#2563eb";
  ctx.font = "900 24px Apple SD Gothic Neo, Malgun Gothic, sans-serif";
  ctx.fillText("LIFT", 1090, 1676);

  try {
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.96);
    const buffer = await blob.arrayBuffer();
    const pdf = makePdfFromImage(new Uint8Array(buffer), width, height);
    await savePdfBlob(
      pdf,
      `${safePdfFilename(safeFilename(profile.title), "LIFT_document")}_${filenameDate()}.pdf`,
      fallbackWindow,
    );
  } catch (error) {
    fallbackWindow?.close();
    throw error;
  }
}

function MockDocumentInner() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "자동 조회 서류";
  const issuer = searchParams.get("issuer") ?? "";
  const source = searchParams.get("source") ?? "공공 마이데이터(모의 연동)";
  const reportId = searchParams.get("reportId") ?? "-";
  const profile = DOC_PROFILES[name] ?? fallbackProfile(name, issuer);
  const displayIssuer = issuer || profile.issuer;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSavePdf() {
    setSaving(true);
    setSaveError(null);
    try {
      await downloadMockPdf({ profile, displayIssuer, source, reportId });
    } catch {
      setSaveError("PDF 파일 저장에 실패했어요. Safari나 Chrome에서 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell showLogout wide>
      <AuthGuard>
        <main className="doc-preview-page">
          <div className="doc-preview-toolbar">
            <div>
              <span className="page-eyebrow">서류 미리보기</span>
              <h1>{profile.title}</h1>
            </div>
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={handleSavePdf}
            >
              {saving ? "PDF 준비 중…" : "PDF로 저장"}
            </button>
          </div>
          {saveError && <div className="error-box">{saveError}</div>}

          <article className="mock-doc-sheet">
            <header className="mock-doc-head">
              <div>
                <div className="mock-doc-kicker">LIFT 공공 마이데이터</div>
                <h2>{profile.title}</h2>
              </div>
              <div className="mock-doc-stamp">
                <span>자동조회</span>
                <b>확인</b>
              </div>
            </header>

            <section className="mock-doc-meta">
              <div>
                <span>발급기관</span>
                <b>{displayIssuer}</b>
              </div>
              <div>
                <span>조회출처</span>
                <b>{source}</b>
              </div>
              <div>
                <span>발급일자</span>
                <b>{today()}</b>
              </div>
              <div>
                <span>리포트 번호</span>
                <b>#{reportId}</b>
              </div>
            </section>

            <section className="mock-doc-table">
              {profile.rows.map(([label, value]) => (
                <div className="mock-doc-row" key={label}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </section>

            <section className="mock-doc-note">
              <h3>확인 사항</h3>
              {profile.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </section>

            <footer className="mock-doc-foot">
              <span>이 문서는 LIFT 데모 환경에서 생성된 더미 데이터입니다.</span>
              <strong>LIFT</strong>
            </footer>
          </article>
        </main>
      </AuthGuard>
    </AppShell>
  );
}

export default function MockDocumentPage() {
  return (
    <Suspense fallback={<div className="center-state">서류를 불러오는 중…</div>}>
      <MockDocumentInner />
    </Suspense>
  );
}
