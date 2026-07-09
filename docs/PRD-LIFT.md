# LIFT 제품 요구사항 명세서 (PRD)

## 1. 제품 개요

**LIFT**는 퇴직·이직·실직 등 **생애 전환기**를 맞은 사용자가 놓치기 쉬운 행정 절차와 공공 혜택(실업급여, 건강보험 임의계속가입, 국민연금 납부예외, 퇴직금·세금 처리 등)을 진단 설문 기반으로 안내하는 웹 서비스다.

핵심 가치 흐름: **진단 입력 → 룰 엔진 분석 → 리포트 생성 → (결제 후) 상세 리포트·예상 금액·필요 서류·AI 질문 채팅 제공**.

부가 기능으로 커뮤니티(글/댓글/좋아요)와 마이페이지를 제공한다.

"선택 구현" 표시가 없는 항목은 모두 필수다. "선택 구현" 항목은 미구현이어도 감점 대상이 아니다.

---

## 2. 기술 스택 (고정)

### 백엔드
- Java 21, **Spring Boot 4.1.0** (Gradle 9.5 빌드 — Boot 4 계열의 신규 스타터 명명 규칙 사용: `spring-boot-starter-webmvc`, `spring-boot-starter-security-oauth2-client` 등)
- Spring Web MVC, Spring Data JPA, Spring Security
- DB: 로컬/테스트는 **H2(인메모리)**, 배포는 PostgreSQL (`SPRING_DATASOURCE_URL` 환경변수로 전환)
- 인증: JWT (jjwt 0.12.x), Access Token + Refresh Token
- API 문서: springdoc 3.x (Swagger UI)
- RSS 파싱: Rome 2.x
- 공통 응답 포맷: 모든 API는 `ApiResponse` 래퍼(JSON)로 성공/에러 코드를 감싸서 반환
- 검증: spring-boot-starter-validation (`@Valid`)

### 프론트엔드
- Next.js 15 (App Router) + React 19 + TypeScript 5.7
- 스타일: 일반 CSS (별도 UI 라이브러리 없음)
- PDF 저장: 클라이언트 사이드에서 `html2canvas` + `jspdf`(동적 import)로 화면을 캡처하여 PDF 다운로드 (서버 PDF 생성 없음)
- 포트: 프론트 3000, 백엔드 8080 (기본)

---

## 3. 인증 및 세션 (필수)

### 3.1 데모 로그인 (핵심, 필수)
- 로그인 페이지(`/login`)에 **"데모용 로그인" 버튼**이 있다.
- 데모 로그인은 백엔드 소셜 로그인을 거치지 않고, **프론트엔드 브라우저 로컬(localStorage)에 데모 세션을 만들어** 즉시 서비스 전체를 체험할 수 있게 한다.
- 데모 세션 상태에서는 프론트의 API 레이어가 서버 호출 대신 **클라이언트 내장 데모 구현(demoApi)** 으로 분기한다. 진단 생성, 분석, 리포트 조회, 결제 완료 처리, 채팅, 커뮤니티 CRUD 등 주요 화면 흐름이 서버 없이도 프론트 단독으로 동작한다.
- 단, 데모 채팅은 백엔드 `/api/ai/report-chat`가 살아 있으면 그 답을 우선 사용하고, 호출 실패 시 클라이언트 내장 폴백 답변을 사용한다.
- 카카오/네이버 버튼도 화면에 존재하지만, 데모 기간에는 클릭 시 "데모 기간이므로 데모 로그인을 사용하라"는 안내 문구를 표시하고 실제 로그인으로 진행하지 않는다.

### 3.2 JWT 기반 서버 인증 (필수)
- 로그인 성공 시 서버는 **Access Token(기본 1시간) + Refresh Token(기본 14일)** 을 발급한다.
- Refresh Token은 서버 DB에 세션(`RefreshTokenSession`)으로 저장·관리한다.
- `POST /api/auth/refresh` : refreshToken으로 새 토큰 발급.
- `POST /api/auth/logout` : refreshToken 세션 무효화.
- 보호된 API는 `Authorization: Bearer <accessToken>` 헤더로 인증한다. 인증 실패 시 401, 권한 없음 시 403을 공통 JSON 에러 포맷으로 반환한다.
- `JWT_SECRET`(32바이트 이상)이 비어 있으면 애플리케이션 기동을 중단한다.

### 3.3 소셜 로그인 구조 (구조만 필수, 실 연동은 선택)
- `GET /api/auth/login/{provider}` (provider: kakao | naver): 소셜 인가 URL로 302 리다이렉트.
- `GET /api/auth/callback/{provider}?code=...&state=...` : 콜백 처리 후 토큰 발급. state는 서버 저장(`OAuthState`)으로 검증한다.
- **환경변수 `OAUTH_SOCIAL_ENABLED=false`(기본값)** 이면 실제 카카오/네이버 로그인은 서버에서 차단된다.
- **환경변수 `OAUTH_MOCK_ENABLED=true`(로컬 프로필 기본; 전역 기본값은 false)** 이면 client-id가 비어 있는 provider에 한해 실제 소셜 API 호출 없이 mock 코드로 로그인 흐름을 통과시킨다. → **실제 카카오/네이버 API 키 없이 로그인 플로우가 동작하는 것이 필수 요구사항이다.**
- 실제 카카오/네이버 연동(클라이언트 ID/시크릿 사용)은 **선택 구현**이다.

---

## 4. 온보딩 및 약관 (필수)

- `GET /api/terms/{type}` : 약관 본문 조회. type은 `service`(별칭 `terms`, `service-terms`)와 `privacy`(별칭 `privacy-policy`) 2종.
- `POST /api/users/me/agreement` : 약관 동의 저장.
- `GET /api/users/me/onboarding-status` : 온보딩 완료 여부 조회.
- 온보딩 보조 API (서버에 존재, 각각 단순 저장):
  - `POST /api/onboarding/child-profile`
  - `POST /api/onboarding/interest-region`
  - `POST /api/onboarding/guardian-profile`
- 프론트 페이지: `/terms`, `/privacy`(개인정보 처리방침 정적 페이지), `/onboarding/life-event`(생애 이벤트 선택 화면).
- 독립적인 `/onboarding` 인덱스 페이지는 **만들지 않는다**. 온보딩 진입점은 `/onboarding/life-event` 하나다.

---

## 5. 생애 전환 진단 (필수)

### 5.1 진단 입력
- 프론트 페이지 `/assessment/new` 에서 설문 형태로 입력받는다.
- `POST /api/life/assessments` : 진단 생성.
- `PATCH /api/life/assessments/{assessmentId}` : 진단 항목 부분 수정.
- 진단 입력 항목(엔티티 필드 기준, 모두 이 범위 안에서만 구현):
  - `eventType` (필수): `RETIREMENT`(퇴직) | `JOB_CHANGE`(이직) | `UNEMPLOYMENT`(실직) — 3종만 지원
  - `retirementDate` (퇴직일, 날짜)
  - `resignationReason` (이직/퇴직 사유): 계약만료, 권고사직, 폐업, 정년퇴직, 자발적 퇴사 등 enum
  - `nextJobStatus` (다음 직장 상태), `nextJobStartDate`
  - `employmentInsuranceMonths` (고용보험 가입 개월 수, 정수)
  - `currentIncomeStatus` (현재 소득 상태)
  - `monthlyAverageWage` (월 평균임금, 세전, 원 단위 정수 — 실업급여/퇴직금 예상액 계산 기준)
  - `regionSido`, `regionSigungu` (거주 지역 시/도, 시/군/구 문자열)
  - 연소득 범위, 자산 범위, 가구 유형, 주거 형태 등 enum 필드

### 5.2 룰 엔진 분석 (필수, 핵심)
- `POST /api/life/assessments/{assessmentId}/analyze` : 진단을 룰 엔진으로 분석하여 **리포트(LifeReport)를 생성**한다.
- 룰 엔진은 **AI가 아니라 순수 자바 코드의 규칙 목록**이다. 다음 **4개 규칙만** 구현한다.

| 규칙 | 판단 로직(요약) |
|---|---|
| ① 실업급여(구직급여) | eventType이 RETIREMENT 또는 UNEMPLOYMENT이고, 고용보험 가입 ≥ 6개월이고, 사유가 계약만료/권고사직/폐업/정년퇴직 중 하나면 적격 HIGH. 가입기간은 충족하나 사유가 자발적/불명확이면 NEEDS_CHECK("확인 필요"), 가입기간 미달이면 LOW |
| ② 건강보험 임의계속가입 | 퇴직 후 직장가입자 자격 상실 상황에 대한 안내 규칙 |
| ③ 국민연금 납부예외 | 소득 중단 상황에서 납부예외 신청 안내 규칙 |
| ④ 퇴직금·세금 | 퇴직금 수령(SEVERANCE_PAY) 및 퇴직소득세(TAX_CHECK) 관련 안내 규칙 — 이 규칙 하나가 항목 2개를 생성한다 |

- 각 규칙 결과는 항목(ReportItem)으로 저장되며, 항목마다 **적격 수준(EligibilityLevel), 우선순위(PriorityLevel), 절차 안내, 공식 안내 URL, 필요 서류(RequiredDocument) 목록**을 가진다.
- 리포트는 요약 제목(`summaryTitle`)/요약 메시지(`summaryMessage`)/우선순위 총점(`totalPriorityScore`)을 가진다.

---

## 6. 리포트·결제·PDF·서류 (필수)

### 6.1 리포트 미리보기 (무료)
- `GET /api/life/reports/{reportId}/preview` : 결제 전 미리보기. 항목 개수·요약과 **예상 금액의 "범위 라벨"**(`expectedAmountRangeLabel`) 정도만 노출한다(상세 금액은 결제 후).
- 프론트 페이지 `/report/[id]/preview`.

### 6.2 결제 (mock이 기본, 필수)
- 요금제 2종 (서버 enum `ReportPlanType`으로 고정):
  - **BASIC — 6,900원**: 리포트 상세 열람만
  - **PLUS — 13,900원**: 리포트 열람 + **PDF 저장** + **AI 질문 하루 10회**
- `POST /api/life/reports/{reportId}/payments/mock-complete` : **결제 없이 결제 완료 상태로 전환하는 mock 결제 API. 이것이 기본 결제 수단이며 필수 구현이다.**
- mock 결제의 플랜 결정 규칙은 다음과 같다:
  1. 요청 본문에 `plan` 필드가 있으면 그 값을 사용한다.
  2. `plan`이 없고 `amount`만 있으면 금액(6,900/13,900)으로 플랜을 역산한다. 일치하는 플랜이 없으면 `PAYMENT_PLAN_INVALID_REQUEST` 에러.
  3. `plan`과 `amount`가 둘 다 있는데 서로 불일치하면 에러.
  4. 요청 본문이 아예 없으면 **PLUS를 기본값**으로 적용한다(데모 편의 목적의 의도된 동작).
- `POST /api/life/reports/{reportId}/payments/toss/confirm` : 토스페이먼츠 결제 승인 연동. **환경변수 `TOSS_PAYMENTS_ENABLED=false`(기본)** 이면 `TOSS_PAYMENT_DISABLED` 에러를 반환한다. 실 토스 연동(테스트 키)은 **선택 구현**. 프론트에는 `/checkout`, `/checkout/toss/success`, `/checkout/toss/fail` 페이지가 존재한다.
- 리포트는 결제 상태(PaymentStatus), 플랜, 결제 금액, 결제 시각, AI 질문 한도/사용 횟수를 저장한다.

### 6.3 리포트 상세 (결제 후)
- `GET /api/life/reports/{reportId}` : 결제 완료된 리포트의 상세(항목별 안내, 예상 금액, 필요 서류 목록, 공공 혜택 추천 포함). 본인 소유 리포트만 접근 가능(소유권 검증 필수).
- 접근 검증은 공통 컴포넌트(`LifeReportAccessManager`)로 3단계 게이트를 강제한다: **소유권(남의 리포트 403) → 결제 완료(미결제 403 PAYMENT_REQUIRED) → 플랜 권한(PLUS 전용 기능은 PLAN_UPGRADE_REQUIRED)**.
- `GET /api/life/reports/latest-route-target` : 사용자의 최신 리포트 진행 상태에 따라 프론트가 어느 화면으로 보낼지 알려주는 라우팅용 API. 프론트 루트(`/`)는 로그인 여부 확인 후 이 API 결과에 따라 이동한다.
- `GET /api/life/reports/latest-chat-target` : AI 채팅이 가능한(결제 완료 + 채팅 권한 있는) 최신 리포트 조회.

### 6.4 예상 금액 및 PDF (필수)
- `POST /api/life/reports/{reportId}/pdf-estimate` : PDF 출력용 상세 데이터 조회. 요청에 월 평균임금이 포함되면 해당 값으로 금액을 계산하고, 없으면 금액 범위/산식 중심으로 반환한다(이원 산식).
- 이 API는 서버에서 **PLUS 플랜 여부까지 검증**한다(소유권·결제·플랜 3단 게이트).
- **PDF 생성은 서버가 하지 않는다.** 프론트 페이지 `/report/[id]/pdf` 에서 리포트 화면을 `html2canvas`로 캡처해 `jspdf`로 PDF 파일을 다운로드한다.
- PDF 저장은 PLUS 플랜에서만 허용한다(서버 게이트 + 프론트 `pdfAvailable` 플래그 이중 차단).

### 6.5 필요 서류 조회 (mock, 필수)
- `POST /api/life/reports/{reportId}/documents/fetch` : 리포트 항목에 연결된 필요 서류 목록의 "발급 조회"를 **mock으로** 처리해 상태를 반환한다. 실제 정부 서류 발급 연동은 하지 않는다.
- 프론트에 `/documents/mock` 데모 페이지가 존재한다.

---

## 7. AI 채팅 (필수 — 단, 폴백 방식으로)

### 7.1 리포트 기반 AI 채팅 (결제 사용자용)
- `POST /api/life/reports/{reportId}/chat/messages` : 질문 전송. PLUS 플랜의 **하루 10회 한도**를 서버에서 카운트·차단한다.
- 한도 카운터는 리포트 엔티티에 사용 횟수와 기준 날짜를 저장하고, **서버 로컬 날짜(LocalDate) 기준으로 날짜가 바뀌면 0으로 리셋**한다.
- *(알려진 한계, 허용됨)* 카운터 증가는 원자적 연산이 아니므로 극단적 동시 요청 시 한도를 1회 초과할 수 있고, 리셋 기준은 서버 타임존을 따른다(UTC 배포 시 한국 자정과 어긋남). MVP 범위에서는 수용하며, 개선 시 낙관적 락 또는 조건부 UPDATE를 권장한다.
- `GET /api/life/reports/{reportId}/chat/messages` : 채팅 이력 조회 (메시지는 DB에 저장).
- 답변 생성기는 2가지 구현을 두고 환경변수로 전환한다 (`@ConditionalOnProperty`):
  - **`OPENAI_ENABLED=false`(기본): Mock 답변 서비스** — 룰 엔진이 계산한 리포트 항목과 예상 금액 산식을 근거로 결정적(deterministic) 답변을 조립해 반환. **이것이 필수 구현이다.**
  - `OPENAI_ENABLED=true`: OpenAI Responses API 호출(퇴직 특화 시스템 프롬프트 사용). **선택 구현.**
- 프론트 페이지: `/report/[id]/chat`, `/chat`.

### 7.2 데모 체험용 채팅
- `POST /api/ai/report-chat` : 데모 흐름에서, 프론트가 보낸 리포트 JSON + 질문을 받아 답변을 반환한다.
- OpenAI가 꺼져 있거나 호출이 실패하면 **리포트 요약 기반 폴백 답변을 반드시 반환**한다(에러로 끝나면 안 됨). 응답에는 AI 사용 여부 플래그가 포함된다.

---

## 8. 공공 혜택 추천 (조건부 — 폴백 필수)

- 행정안전부 "대한민국 공공서비스(혜택)" 공공데이터 API 데이터를 `gov24_benefit_cache` 테이블에 캐시하고, 진단/리포트와 매칭하여 혜택을 추천에 활용한다.
- **환경변수 `GOV24_PUBLIC_SERVICE_ENABLED=false`(기본)** 이면 외부 API 동기화는 하지 않는다.
- 대신 **로컬(H2) 실행 시 `data.sql` 시드 데이터(국민내일배움카드, 국민취업지원제도 등 105건)를 캐시 테이블에 적재**하여, 외부 키 없이도 추천이 동작한다. → 시드 기반 동작이 필수, 실 API 동기화는 선택 구현.
- **(선택 구현)** 일일 동기화 스케줄러: `GOV24_SYNC_ENABLED=true`일 때 매일 지정 cron(`GOV24_SYNC_CRON`, 기본 09:00)에 정부24 API를 조회해 캐시를 UPSERT하고, 신규/변경 건만 AI로 구조화 추출(`BenefitCriteriaExtractionService`)한다. 기본은 OFF.

---

## 9. 지역 공고 (조건부 — 미설정 시 조용히 꺼짐)

지자체 게시판 RSS에서 수집·확정한 지역 지원사업/장려금 공고를 사용자에게 노출하는 기능이다. **조회(9.1)와 수집 파이프라인(9.2)은 별개**로, 조회는 팀원이 운영하는 외부 Supabase Postgres의 확정 데이터를 읽기만 하고, 수집 파이프라인은 이 앱 자체 DB에서 동작하는 선택 구현이다.

### 9.1 확정 공고 조회 (읽기 전용)

- `GET /api/local-notices?regionSido=&regionSigungu=` : AI가 실제 지원사업/장려금으로 확정한(`ai_verdict=true`) 공고만 조회한다. 지역 파라미터는 둘 다 선택이며, 시/도만 주면 그 시/도 전체, 시/군/구까지 주면 그 구만 반환한다.
- **정렬·중복 제거 규칙**: 같은 지원사업이 여러 번 수집·확정될 수 있으므로(재공고 등) **(시/도, 시/군/구, 제목) 기준으로 하나로 묶고**, 확정된 횟수(true_count)가 많은 순 → 동점이면 게시일 최신순으로 정렬한다. 제목만이 아니라 지역을 묶음 키에 포함하는 이유: "출산장려금 지원"처럼 여러 시군구가 동일 제목을 쓰는 경우 지역별로 하나씩 남기기 위함이다. 1회 조회 최대 100행으로 SQL 단에서 상한을 건다.
- **응답 필드**: id, 지역(시/도·시/군/구), 제목, **원문 링크(link)**, 요약, 게시일, 매칭 키워드, AI 분류 카테고리, 대상군 요약, 지원내용 요약, AI 판단 근거. link/게시일이 함께 나가므로 각 항목은 원문 공고로 추적 가능하다(하드코딩 목업이 아님).
- **외부 DB 접속 방식**: 이 앱의 주 데이터소스와 완전히 분리된 **자체 관리 읽기 전용 JDBC 커넥션 풀(최대 2개 커넥션)** 을 내부에서만 생성해 쓴다. Spring Bean으로 두 번째 DataSource를 등록하면 주 데이터소스 자동설정이 깨지기 때문이다. 외부 DB 스키마는 절대 변경하지 않는다(읽기 전용).
- **캐시**: 지역 조합별 조회 결과를 서버 메모리에 **5분 TTL**로 캐시한다(리포트 화면이 열릴 때마다 외부 DB에 윈도우 함수 쿼리를 날리지 않기 위함).
- **장애 격리 (필수 동작)**: 외부 DB 조회가 실패해도 리포트 화면 등 다른 기능이 막히면 안 된다. 만료된 캐시라도 있으면 그것을 반환하고, 없으면 빈 목록을 반환한다. 실패한 결과는 캐시하지 않아 다음 요청에서 곧바로 재시도된다.
- **조용히 꺼짐 (필수 동작)**: `LOCAL_NOTICE_DATASOURCE_URL`이 비어 있으면 기동 시점에 이 기능 전체가 에러 없이 비활성화되고, 조회 API는 빈 목록만 반환한다. 기동 직후 `SELECT 1` 접속 프로브를 1회 수행해 접속 가능 여부를 로그로 명확히 남긴다(조회 실패가 빈 목록으로 조용히 삼켜지므로, "꺼진 것"과 "안 붙는 것"을 로그로 구분하기 위함). 외부 Supabase 실연동 자체는 선택 구현.
- **데이터 정화**: 일부 지자체 RSS의 description 파싱 실패로 저장된 원문 찌꺼기(`Description.value=...` 형태)는 화면에 노출되지 않도록 요약을 버린다(AI 요약 필드가 별도로 나가므로 정보 손실 없음).

### 9.2 자체 수집 파이프라인 (선택 구현 — `LOCAL_NOTICE_SYNC_ENABLED=true`일 때만)

기본값 OFF이며, OFF 상태에서는 **스케줄러·서비스·내부 관리 컨트롤러가 빈(Bean)으로 아예 등록되지 않는다**(`@ConditionalOnProperty`).

- **RSS 소스 레지스트리**: 지자체마다 게시판 시스템이 달라 RSS 주소 형태가 제각각이므로, 피드 목록을 코드/설정이 아닌 **DB 테이블(`local_notice_source`)** 로 관리한다(기관명, 게시판명, 피드 URL, 지역, 활성 여부, 마지막 수집 상태). 지자체 추가·URL 변경·장애 지자체 비활성화를 배포 없이 운영하기 위함이다.
- **수집(폴링)**: 기본 매시 정각 cron으로 활성 소스를 전부 조회한다(Rome 라이브러리, 소스당 최대 50건). 각 항목은 (소스, guid) 기준으로 UPSERT하고, 원문(guid|제목|링크|요약|게시일)의 MD5 해시로 변경을 감지해 신규/변경/유지 건수를 집계한다. 소스 조회 실패는 해당 소스에 실패 상태로 기록하고 다음 소스로 계속 진행한다.
- **1차 필터 (순수 코드, 비용 0)**: 공고 "제목"만 보고 키워드 포함 여부를 판별한다. 키워드는 세 축 — 대상군(청년/노인/장애인/한부모/다문화 등), 지원형태(지원금/장려금/바우처/수당 등), 생애전환 상황(퇴직/실직/이직/구직/재취업/직업훈련/고용보험 등) — 으로 구성되며 설정으로 교체 가능하다. 공백·대소문자를 정규화한 부분 문자열 매칭만 수행한다(형태소 분석 없음 — 1차는 재현율 우선, 정밀 판단은 2차가 담당).
- **2차 AI 판단 (참/거짓 분류)**: 1차를 통과했고 아직 판단되지 않은(`ai_judged_at IS NULL`) 건만 OpenAI Responses API로 "실제 생애주기 지원사업/장려금인지" 참/거짓 판단한다. 7장의 `lift.openai` 설정을 그대로 재사용하므로 **신규 API 키가 필요 없고**, `OPENAI_ENABLED=false`면 2차 판단을 건너뛰고 1차 후보를 대기 상태로 남긴다. 판단 결과로 참/거짓, 카테고리, 대상군 요약, 지원내용 요약, 판단 근거를 저장한다(근거는 참/거짓과 무관하게 항상 기록 — 운영 QA용).
- **비용 안전장치 2중 상한 (필수 동작, 파이프라인을 켠 경우)**: ① 1회 실행당 판단 시도 상한(기본 20건), ② **전 기간 누적 호출 상한(기본 200건)** — 누적치는 DB의 판단 완료 행 수로 계산하므로 스케줄러가 몇 번을 돌든 총 호출 수가 이 값을 넘지 않는다. 또한 API 오류/크레딧 부족으로 판단이 실패하면 그 행을 미판단으로 남겨 재시도 대상으로 두고, 시스템 장애 가능성이 높으므로 **첫 실패 시점에 이번 실행의 추가 호출을 즉시 중단**한다.
- **트랜잭션 경계**: RSS 폴링과 AI 호출 같은 네트워크 I/O는 트랜잭션 밖에서 수행하고, DB 반영만 짧은 트랜잭션 단위로 분리한다(긴 외부 호출이 DB 커넥션을 붙잡지 않도록).
- **내부 관리용 API** (파이프라인 활성 시에만 존재):
  - `POST /api/internal/local-notices/sync` : 수집→1차 필터→2차 판단을 즉시 1회 실행하고 결과 요약(소스 수, 수집/신규/변경/유지, 후보 수, 판단 수, 예산 잔여) 반환.
  - `GET /api/internal/local-notices/verified` : 확정(`ai_verdict=true`) 공고 목록.
  - `GET /api/internal/local-notices/items` : 수집된 전체 캐시(필터/판단 상태 디버깅용).

---

## 10. 커뮤니티 (필수)

베이스 경로 `/api/community`, 프론트 페이지 `/community`, `/community/[id]`.

| 기능 | API |
|---|---|
| 글 목록 (카테고리 필터) | `GET /posts` |
| 인기글 목록 | `GET /posts/popular` |
| 글 상세 | `GET /posts/{postId}` |
| 글 작성 | `POST /posts` |
| 글 삭제 (작성자 본인만) | `DELETE /posts/{postId}` |
| 좋아요 등록 / 취소 | `POST /posts/{postId}/likes` / `DELETE /posts/{postId}/likes` |
| 댓글 작성 / 삭제 | `POST /posts/{postId}/comments` / `DELETE /posts/{postId}/comments/{commentId}` |

- **글/댓글 수정(UPDATE) 기능은 없다. 구현하지 않는다.**
- 이미지 업로드 기능은 없다. 텍스트만 지원한다.

---

## 11. 마이페이지 / 사용자 (필수)

베이스 경로 `/api/users/me`, 프론트 페이지 `/my`.

- `GET /summary` : 사용자 요약(닉네임 등).
- `GET /profile` / `PATCH /profile` : 프로필 조회/부분 수정.
- `GET /onboarding-status`, `POST /agreement` (4장 참조).
- `DELETE /api/users/me` : 회원 탈퇴. 물리 삭제가 아닌 **소프트 삭제**(엔티티 `withdrawn` 플래그) 방식.

---

## 12. 프론트엔드 화면 목록 (이 목록 밖의 화면은 만들지 않는다)

`/`(라우팅 분기), `/login`, `/login/callback/[provider]`, `/onboarding/life-event`, `/terms`, `/privacy`, `/assessment/new`, `/report/[id]`, `/report/[id]/preview`, `/report/[id]/chat`, `/report/[id]/pdf`, `/chat`, `/checkout`, `/checkout/toss/success`, `/checkout/toss/fail`, `/community`, `/community/[id]`, `/my`, `/documents/mock`


---

## 13. 공통 규칙 (필수)

1. 모든 API 응답은 공통 `ApiResponse` JSON 포맷(성공코드/에러코드/데이터)으로 감싼다. 전역 예외 핸들러(@RestControllerAdvice)로 에러를 일관 처리한다.
2. 엔티티는 생성/수정/삭제 시각 공통 필드(BaseEntity 계열 상속 — Created / CreatedUpdated / CreatedDeleted / CreatedUpdatedDeleted 4종)를 가진다. JPA Auditing 사용.
3. 리포트·진단·채팅 등 사용자 데이터는 반드시 **본인 소유 검증** 후 접근을 허용한다.
4. Swagger UI로 API 문서가 노출되어야 한다.
5. CORS 허용 오리진은 환경변수로 설정한다. 로컬 프로필에서는 localhost/127.0.0.1의 모든 포트를 허용한다.

---

## 14. 명시적 제외 범위 (Out of Scope — 절대 구현하지 않는다)

- 실시간 알림/푸시, 이메일 발송
- 관리자 웹 화면 (내부 API만 존재)
- 실제 정부 서류 자동 발급/제출 연동 (mock만)
- 서버 사이드 PDF 렌더링
- 커뮤니티 글/댓글 수정, 이미지 업로드, 검색
- 모바일 네이티브 앱
- 다국어 지원 (한국어 단일)
- 추천 알고리즘의 ML/AI 학습 (룰 엔진은 하드코딩된 규칙 4개가 전부. 9장의 AI "관련성 판단"은 분류 호출일 뿐 학습이 아니다)

---

## 15. 환경변수 요약 (기본값 기준으로 동작해야 함)

| 변수 | 기본값 | 의미 |
|---|---|---|
| `JWT_SECRET` | (필수 입력) | 32바이트 이상 시크릿. 비어 있으면 기동 중단 |
| `AUTH_ACCESS_TOKEN_TTL` / `AUTH_REFRESH_TOKEN_TTL` | 1h / 14d | 토큰 수명 |
| `OAUTH_MOCK_ENABLED` | false (로컬 프로필 true) | mock 소셜 로그인 |
| `OAUTH_SOCIAL_ENABLED` | false | 실제 카카오/네이버 로그인 차단 |
| `TOSS_PAYMENTS_ENABLED` | false | 토스 실결제 (기본은 mock 결제) |
| `OPENAI_ENABLED` | false | OpenAI 챗 (기본은 폴백/Mock 답변) |
| `GOV24_PUBLIC_SERVICE_ENABLED` | false | 공공혜택 외부 API 사용 (기본은 시드 데이터) |
| `GOV24_SYNC_ENABLED` | false | 공공혜택 일일 동기화 스케줄러 (선택) |
| `LOCAL_NOTICE_SYNC_ENABLED` | false | 지역 공고 자체 수집 스케줄러 (선택) |
| `LOCAL_NOTICE_DATASOURCE_URL` | 빈 값 | 미설정 시 지역 공고 기능 조용히 OFF |
| `SPRING_DATASOURCE_URL` | 빈 값(H2) | 설정 시 PostgreSQL 사용 |

**검수 기준: 위 표의 기본값 상태(외부 키 전무)에서 3~12장의 모든 필수 기능이 정상 동작하면 이 PRD는 충족된 것이다.**
