import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function TermsPage() {
  return (
    <AppShell>
      <main className="legal-page">
        <p className="step-hint">LIFT</p>
        <h1 className="page-title">서비스 이용약관</h1>
        <p className="page-sub">시행일: 2026년 7월 4일 · 버전 1.0</p>

        <section className="legal-section">
          <h2>서비스 목적</h2>
          <p>
            LIFT는 퇴직, 이직, 실직 등 생애전환 상황에서 사용자가 놓치기 쉬운 행정
            절차, 필요 서류, 마감일, 공식 신청 링크를 정리해주는 행정 준비 지원
            서비스입니다.
          </p>
        </section>

        <section className="legal-section">
          <h2>정보의 성격</h2>
          <p>
            LIFT가 제공하는 리포트와 AI 설명은 사용자가 절차를 이해하고 준비하도록
            돕기 위한 참고 정보입니다. 실업급여, 건강보험, 국민연금, 세금, 퇴직금 등
            각 제도의 최종 자격 판단과 승인 여부는 관할 기관의 심사 기준에 따릅니다.
          </p>
        </section>

        <section className="legal-section">
          <h2>사용자의 책임</h2>
          <p>
            사용자는 본인이 입력한 정보가 정확한지 확인해야 하며, 공식 신청과 서류
            제출은 정부24, 고용24, 국민건강보험공단, 국민연금공단 등 각 기관의 공식
            채널에서 직접 진행해야 합니다.
          </p>
        </section>

        <section className="legal-section">
          <h2>전문 업무 아님</h2>
          <p>
            LIFT는 법률, 노무, 세무 대리 행위를 제공하지 않으며, 전문가 상담이나
            기관 심사를 대체하지 않습니다.
          </p>
        </section>

        <div className="legal-actions">
          <Link href="/privacy">개인정보처리방침 보기</Link>
          <Link href="/login">로그인으로 돌아가기</Link>
        </div>
      </main>
    </AppShell>
  );
}
