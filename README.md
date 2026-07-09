# LIFT

**퇴직·이직·실직 등 생애 전환기에 놓치기 쉬운 행정 절차와 공공 혜택을 진단 설문 기반으로 안내하는 웹 서비스**

퇴직·이직·실직 직후에는 실업급여, 건강보험 임의계속가입, 국민연금 납부예외, 퇴직금·세금 처리를 동시에 챙겨야 하지만 제도마다 조건·기한·서류·신청 채널이 흩어져 있어 우선순위 판단이 어렵습니다. LIFT는 짧은 진단 설문을 바탕으로 지금 무엇을 먼저 확인해야 하는지를 리포트로 정리해 줍니다.

**핵심 가치 흐름:** 진단 입력 → 룰 엔진 분석 → 리포트 생성 → (결제 후) 상세 리포트·예상 금액·필요 서류·AI 질문 채팅

## 설계 원칙 — 외부 API 키 없이 완전 동작

외부 서비스(카카오/네이버 실 로그인, 토스페이먼츠, OpenAI, 공공데이터포털)는 **환경변수로 기본 비활성(OFF)** 이며, 비활성 상태에서도 폴백(mock) 동작으로 앱 전체가 정상 동작합니다. 즉, **외부 API 키가 하나도 없어도 진단 → 리포트 → 결제 → AI 채팅 전 과정을 체험할 수 있습니다.**

## 주요 기능

### 인증
- **데모 로그인** — 백엔드 소셜 로그인 없이 브라우저 localStorage 데모 세션으로 즉시 전체 서비스 체험. 데모 세션에서는 프론트 API 레이어가 클라이언트 내장 데모 구현(demoApi)으로 분기
- **JWT 서버 인증** — Access Token(1시간) + Refresh Token(14일, DB 세션 관리), 토큰 갱신·로그아웃 API
- **소셜 로그인 구조** — 카카오/네이버 인가 리다이렉트·콜백·state 검증 구현. 실 연동은 `OAUTH_SOCIAL_ENABLED`(기본 false)로 차단되며, mock 콜백(`OAUTH_MOCK_ENABLED`)으로 키 없이 로그인 플로우 동작

### 생애 전환 진단 + 룰 엔진
- 생애 이벤트 3종 지원: **퇴직(RETIREMENT) · 이직(JOB_CHANGE) · 실직(UNEMPLOYMENT)**
- 퇴직일, 이직 사유, 고용보험 가입 개월, 월 평균임금, 거주 지역, 소득·자산·가구 유형 등을 설문으로 수집
- 룰 엔진은 AI가 아닌 **순수 자바 규칙 4개**로 리포트를 생성:

| 규칙 | 내용 |
|---|---|
| ① 실업급여(구직급여) | 이벤트 유형·고용보험 가입기간·이직 사유로 적격 수준(HIGH/NEEDS_CHECK/LOW) 판단 |
| ② 건강보험 임의계속가입 | 직장가입자 자격 상실 상황 안내 |
| ③ 국민연금 납부예외 | 소득 중단 시 납부예외 신청 안내 |
| ④ 퇴직금·세금 | 퇴직금 수령 + 퇴직소득세 확인 (항목 2개 생성) |

- 각 항목은 적격 수준, 우선순위, 절차 안내, 공식 안내 URL, 필요 서류 목록을 포함

### 리포트 · 결제 · PDF
- **미리보기(무료)** — 항목 개수·요약·예상 금액 범위 라벨만 노출
- **결제 플랜** — BASIC 6,900원(리포트 상세 열람) / PLUS 13,900원(열람 + PDF 저장 + AI 질문 하루 10회)
- **mock 결제가 기본** — 결제 없이 완료 처리하는 데모 결제 API. 토스페이먼츠 테스트 결제는 선택(`TOSS_PAYMENTS_ENABLED`)
- **접근 제어 3단 게이트** — 소유권 → 결제 완료 → 플랜 권한을 서버에서 순차 검증
- **PDF 저장** — 서버 렌더링 없이 클라이언트에서 `html2canvas` + `jspdf`로 화면 캡처 다운로드 (PLUS 전용)
- **필요 서류 조회** — 리포트 항목별 서류 발급 조회를 mock으로 처리

### AI 채팅 (폴백 필수 구조)
- 결제 사용자용 리포트 기반 질문 채팅 — PLUS 플랜 **하루 10회 한도**를 서버에서 카운트·차단, 이력 DB 저장
- `OPENAI_ENABLED=false`(기본): 룰 엔진 결과와 예상 금액 산식 기반 **결정적 Mock 답변**
- `OPENAI_ENABLED=true`: OpenAI Responses API 호출 (퇴직 특화 시스템 프롬프트), 실패 시 폴백 답변 보장

### 공공 혜택 추천
- 행정안전부 공공서비스(혜택) 데이터를 `gov24_benefit_cache` 테이블에 캐시하고 진단·리포트와 매칭
- 기본은 **시드 데이터(국민내일배움카드, 국민취업지원제도 등 105건)** 로 동작 — 외부 키 불필요
- 선택: 정부24 API 일일 동기화 스케줄러 + AI 자격조건 구조화 추출 (`GOV24_SYNC_ENABLED`)

### 지역 공고 (지자체 지원사업·장려금)
- 지자체 RSS 파이프라인이 확정한 지역 공고를 읽기 전용으로 조회 (외부 Supabase Postgres, TTL 캐시)
- 데이터소스 미설정 시 **에러 없이 조용히 비활성화**(빈 목록) — 다른 기능에 영향 없음
- 선택: 매시 RSS 수집 → 1차 키워드 필터 → 2차 **AI 관련성 판단**(호출 예산 상한 내장) 파이프라인 (`LOCAL_NOTICE_SYNC_ENABLED`)

### 커뮤니티 · 마이페이지
- 커뮤니티: 글 목록(카테고리 필터)·인기글·상세·작성·삭제, 좋아요, 댓글 (수정·이미지 업로드는 미지원)
- 마이페이지: 사용자 요약, 프로필 조회·수정, 약관 동의, 회원 탈퇴(소프트 삭제)

## 기술 스택

| 구분 | 스택 |
|---|---|
| 백엔드 | Java 21, Spring Boot 4.1.0 (Gradle 9.5), Spring Web MVC, Spring Data JPA, Spring Security, jjwt 0.12.x, springdoc 3.x (Swagger UI), Rome 2.x (RSS) |
| 프론트엔드 | Next.js 15 (App Router), React 19, TypeScript 5.7, 일반 CSS, html2canvas + jspdf (클라이언트 PDF) |
| DB | 로컬/테스트: H2 인메모리 · 배포: PostgreSQL (`SPRING_DATASOURCE_URL`로 전환) |
| 공통 | 모든 API는 `ApiResponse` 래퍼로 응답, 전역 예외 핸들러, JPA Auditing(BaseEntity 4종), 본인 소유 검증 |

## 프로젝트 구조

```
LIFT/
├── src/main/java/com/lift/        # Spring Boot 백엔드 (포트 8080)
│   ├── domain/
│   │   ├── auth/                  # 데모·소셜 로그인, JWT, 리프레시 세션
│   │   ├── lifetransition/        # 진단·룰 엔진·리포트·결제·AI 채팅·공공혜택
│   │   ├── localnotice/           # 지자체 RSS 지역 공고 수집·조회
│   │   ├── community/             # 커뮤니티 (글·댓글·좋아요)
│   │   ├── onboarding/            # 온보딩 보조 API
│   │   ├── term/                  # 약관
│   │   └── user/                  # 프로필·탈퇴
│   └── global/                    # ApiResponse, 예외 처리, 인증 필터, 설정
├── frontend/                      # Next.js 프론트엔드 (포트 3000)
│   └── src/
│       ├── app/                   # 화면 라우트 (아래 화면 목록 참조)
│       ├── components/            # 공용 컴포넌트
│       └── lib/                   # API 클라이언트, demoApi, PDF 내보내기
├── docs/                          # PRD, 실행·배포 가이드
├── scripts/                       # 백엔드 로컬 실행 스크립트
├── Dockerfile / render.yaml       # 백엔드 배포 (Render)
└── netlify.toml                   # 프론트엔드 배포 (Netlify)
```

**화면 목록:** `/`(라우팅 분기) · `/login` · `/login/callback/[provider]` · `/onboarding/life-event` · `/terms` · `/privacy` · `/assessment/new` · `/report/[id]` (+ `/preview`, `/chat`, `/pdf`) · `/chat` · `/checkout` (+ `/toss/success`, `/toss/fail`) · `/community`, `/community/[id]` · `/my` · `/documents/mock`

## 시작하기

### 요구 사항

- Java 21, Node.js 18+ / npm
- 외부 API 키 불필요 (전부 mock/폴백으로 동작)

### 1. 백엔드 실행 (포트 8080)

```bash
OAUTH_MOCK_ENABLED=true JWT_SECRET=local-development-jwt-secret-32-bytes-minimum \
  ./gradlew bootRun --args='--spring.profiles.active=local'
```

- `Started ...Application` 로그가 뜨면 준비 완료
- Swagger API 문서: http://localhost:8080/swagger-ui/index.html
- 로컬 프로필은 H2 인메모리 DB + 공공혜택 시드 데이터(`data.sql`)로 기동

### 2. 프론트엔드 실행 (포트 3000)

```bash
cd frontend
cp -n .env.local.example .env.local   # 최초 1회
npm install                           # 최초 1회
npm run dev
```

http://localhost:3000 접속 후 **"데모용 로그인"** 버튼으로 진단 → 미리보기 → 결제 → 상세 리포트 → PDF → AI 질문 전 과정을 체험할 수 있습니다.

자세한 실행·종료 방법은 [docs/실행-가이드.md](docs/실행-가이드.md)를 참고하세요.

## 환경변수

기본값 상태(외부 키 전무)에서 모든 필수 기능이 동작합니다.

| 변수 | 기본값 | 의미 |
|---|---|---|
| `JWT_SECRET` | (필수 입력) | 32바이트 이상 시크릿. 비어 있으면 기동 중단 |
| `AUTH_ACCESS_TOKEN_TTL` / `AUTH_REFRESH_TOKEN_TTL` | 1h / 14d | 토큰 수명 |
| `OAUTH_MOCK_ENABLED` | false (로컬 프로필 true) | mock 소셜 로그인 |
| `OAUTH_SOCIAL_ENABLED` | false | 실제 카카오/네이버 로그인 개방 여부 |
| `TOSS_PAYMENTS_ENABLED` | false | 토스 결제 (기본은 mock 결제) |
| `OPENAI_ENABLED` | false | OpenAI 챗 (기본은 폴백/Mock 답변) |
| `GOV24_PUBLIC_SERVICE_ENABLED` | false | 공공혜택 외부 API 사용 (기본은 시드 데이터) |
| `GOV24_SYNC_ENABLED` | false | 공공혜택 일일 동기화 스케줄러 (선택) |
| `LOCAL_NOTICE_SYNC_ENABLED` | false | 지역 공고 자체 수집 스케줄러 (선택) |
| `LOCAL_NOTICE_DATASOURCE_URL` | 빈 값 | 미설정 시 지역 공고 기능 조용히 OFF |
| `SPRING_DATASOURCE_URL` | 빈 값(H2) | 설정 시 PostgreSQL 사용 |

## 배포

- **백엔드**: Render Web Service (Docker) — [render.yaml](render.yaml), [Dockerfile](Dockerfile)
- **프론트엔드**: Netlify Next.js — [netlify.toml](netlify.toml)
- **DB**: PostgreSQL 권장 (미연결 시 H2 임시 DB로 기동되어 재배포 시 데이터가 사라집니다)

자세한 내용은 [docs/배포-가이드.md](docs/배포-가이드.md)를 참고하세요.

## 범위 밖 (Out of Scope)

다음은 의도적으로 구현하지 않았습니다.

- 실시간 알림/푸시, 이메일 발송, 관리자 웹 화면
- 실제 정부 서류 자동 발급·제출 연동 (mock만), 서버 사이드 PDF 렌더링
- 커뮤니티 글/댓글 수정, 이미지 업로드, 검색
- 모바일 네이티브 앱, 다국어 지원
- 추천 알고리즘의 ML/AI 학습 (룰 엔진은 하드코딩 규칙 4개, AI는 요약·분류 보조만)

## 문서

- [PRD — 제품 요구사항 명세서 (v2, 구현 검증 반영)](docs/PRD-LIFT.md)
- [실행 가이드 (로컬)](docs/실행-가이드.md)
- [배포 가이드 (Render + Netlify)](docs/배포-가이드.md)
- [지자체 RSS 지원사업 수집 현황](docs/지자체-RSS-지원사업-수집-현황정리.md)
