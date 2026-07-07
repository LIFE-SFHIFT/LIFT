"use client";

import { Suspense, use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { ReportPdfDocument } from "@/components/ReportPdfDocument";
import { api, ApiError } from "@/lib/api";
import type { ReportDetail } from "@/lib/types";

function parseWage(value: string | null): number | null {
  if (!value) return null;
  const amount = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function ReportPdfInner({ reportId }: { reportId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const monthlyAverageWage = parseWage(searchParams.get("monthlyAverageWage"));

  useEffect(() => {
    let mounted = true;
    setError(null);
    setReport(null);
    api
      .getPdfReport(
        reportId,
        monthlyAverageWage == null ? {} : { monthlyAverageWage },
      )
      .then((data) => {
        if (mounted) setReport(data);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof ApiError ? e.message : "PDF 리포트를 준비하지 못했어요.");
      });

    return () => {
      mounted = false;
    };
  }, [monthlyAverageWage, reportId]);

  function handlePrint() {
    setPrinting(true);
    window.print();
    window.setTimeout(() => setPrinting(false), 250);
  }

  if (error) {
    return (
      <main className="pdf-preview-page">
        <div className="error-box">{error}</div>
        <button type="button" className="btn secondary" onClick={() => router.back()}>
          이전으로
        </button>
      </main>
    );
  }

  if (!report) {
    return <div className="center-state">PDF 리포트를 준비하는 중…</div>;
  }

  return (
    <main className="pdf-preview-page">
      <div className="pdf-preview-toolbar no-print">
        <button type="button" className="btn secondary" onClick={() => router.back()}>
          이전으로
        </button>
        <button type="button" className="btn" disabled={printing} onClick={handlePrint}>
          {printing ? "준비 중…" : "PDF 저장하기"}
        </button>
      </div>
      <div className="pdf-preview-shell">
        <ReportPdfDocument report={report} />
      </div>
    </main>
  );
}

export default function ReportPdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard>
      <Suspense fallback={<div className="center-state">PDF 리포트를 준비하는 중…</div>}>
        <ReportPdfInner reportId={Number(id)} />
      </Suspense>
    </AuthGuard>
  );
}
