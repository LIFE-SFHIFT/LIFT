# LIFT — 프론트엔드 (Next.js)

생애전환(퇴직·이직·실직) 행정 준비 플랫폼의 웹 프론트엔드입니다.
백엔드(Spring Boot, `../`)의 `com.lift.domain.lifetransition` API를 사용합니다.

## 실행

1. 백엔드를 먼저 실행합니다(포트 8080, mock 로그인 활성화):
   ```bash
   cd ..
   OAUTH_MOCK_ENABLED=true JWT_SECRET=local-development-jwt-secret-32-bytes-minimum \
     ./gradlew bootRun --args='--spring.profiles.active=local'
   ```
2. 프론트엔드 환경변수와 의존성:
   ```bash
   cp .env.local.example .env.local   # 기본값: NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
   npm install
   npm run dev                        # http://localhost:3000
   ```

> 백엔드 `SecurityConfig`에 CORS 허용 오리진이 설정되어 있습니다
> (`lift.cors.allowed-origins`, 기본 `http://localhost:3000`).

## 화면 흐름

| 순서 | 경로 | 설명 |
| --- | --- | --- |
| 1 | `/login` | 카카오/네이버 mock 소셜 로그인 → 액세스 토큰 저장 |
| 2 | `/onboarding/life-event` | 약관 동의 + 생애 이벤트 선택(RETIREMENT/JOB_CHANGE/UNEMPLOYMENT) |
| 3 | `/assessment/new` | 이벤트별 진단 입력 → 진단 생성 + 룰 엔진 분석 |
| 4 | `/report/[id]/preview` | 무료 미리보기(하이라이트 1~2개 + 결제 유도) |
| 5 | `/checkout` | 빠른 데모 결제 또는 토스 테스트 결제 |
| 6 | `/report/[id]` | 결제 후 상세 리포트(사유·마감일·필요 서류·공식 링크, PDF 인쇄) |
| 7 | `/report/[id]/chat` | 리포트 기반 AI 질문(최대 10회) |

## 구조

- `src/lib/api.ts` — 백엔드 API 클라이언트(Bearer 토큰 자동 첨부, `ApiError` 매핑)
- `src/lib/auth.ts` — 액세스 토큰 저장(localStorage, MVP용)
- `src/lib/types.ts` / `labels.ts` — 백엔드 도메인 타입 및 한글 라벨
- `src/components/` — AppShell, AuthGuard, 배지
- `src/app/**` — App Router 페이지(모바일 우선, 480px 셸)

## 결제 모드

- 빠른 데모 결제: 기존 mock API로 즉시 결제 완료 처리합니다.
- 토스 테스트 결제: `NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...`, 백엔드 `TOSS_PAYMENTS_ENABLED=true`, `TOSS_SECRET_KEY=test_sk_...` 설정 후 토스 결제창과 승인 API를 거칩니다.

## MVP 참고

- 소셜 로그인은 로컬에서 mock OAuth로 동작합니다. 실제 OpenAI 챗봇을 테스트하려면 백엔드 `.env`에 `OPENAI_ENABLED=true`, `OPENAI_API_KEY=...`를 넣고 데모용 로그인, 카카오, 네이버 시작 버튼 중 하나로 로그인하세요.
- `데모용 로그인으로 바로 체험하기`도 백엔드 mock OAuth 토큰을 받아 실제 API와 OpenAI 챗봇 경로를 사용합니다. 결제는 데모 mock과 토스 테스트 결제 모드를 함께 제공합니다.
- 토큰을 localStorage에 보관하므로, 실서비스 전환 시 httpOnly 쿠키 등으로 교체하세요.
