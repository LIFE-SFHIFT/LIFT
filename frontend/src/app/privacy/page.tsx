import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function PrivacyPage() {
  return (
    <AppShell>
      <main className="legal-page">
        <p className="step-hint">LIFT</p>
        <h1 className="page-title">개인정보처리방침</h1>
        <p className="page-sub">시행일: 2026년 7월 4일 · 버전 1.0</p>

        <section className="legal-section">
          <h2>수집하는 개인정보</h2>
          <p>
            LIFT는 소셜 로그인 제공자 식별값, 이메일, 닉네임, 서비스 이용 과정에서
            사용자가 입력한 퇴직일, 퇴사 사유, 고용보험 가입기간, 지역, 소득·가구·주거
            관련 선택 정보를 수집할 수 있습니다.
          </p>
        </section>

        <section className="legal-section">
          <h2>이용 목적</h2>
          <p>
            수집한 정보는 회원 식별, 로그인 유지, 리포트 생성, 행정 절차·필요
            서류·마감일 안내, 고객 문의 대응, 서비스 부정 이용 방지를 위해 사용합니다.
          </p>
        </section>

        <section className="legal-section">
          <h2>보관 기간</h2>
          <p>
            개인정보는 회원 탈퇴 또는 개인정보 처리 목적 달성 시까지 보관합니다. 관계
            법령에 따라 보존이 필요한 정보는 해당 기간 동안 분리 보관합니다.
          </p>
        </section>

        <section className="legal-section">
          <h2>제3자 제공</h2>
          <p>
            LIFT는 사용자의 개인정보를 동의 없이 제3자에게 제공하지 않습니다. 최종
            신청은 공식 기관 사이트에서 사용자가 직접 진행합니다.
          </p>
        </section>

        <section className="legal-section">
          <h2>문의</h2>
          <p>
            개인정보와 서비스 이용 관련 문의는 서비스 운영자가 지정한 고객 문의 채널을
            통해 접수합니다.
          </p>
        </section>

        <div className="legal-actions">
          <Link href="/terms">서비스 이용약관 보기</Link>
          <Link href="/login">로그인으로 돌아가기</Link>
        </div>
      </main>
    </AppShell>
  );
}
