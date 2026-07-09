# PRD — LIFT 구현 기반 제품 요구사항

- 작성일: 2026-07-09 (v2, 전면 갱신)
- 대상 프로젝트: LIFT (생애전환 행정 준비 서비스)
- 작성 기준: **이 문서는 저장소에 실제로 존재하는 코드만을 근거로 작성되었다.** 각 기능마다 구현 상태(구현됨 / 데모·모의 구현 / 기본 비활성 / 미구현)를 구분하고, 근거가 되는 소스 파일 경로와 설정 키를 함께 명시한다. 이 문서에 "구현되어 있지 않다"라고 적힌 항목은 실제로 코드가 없거나 의도적으로 범위에서 제외한 것이다.

## 0. 정직성 선언 (심사 안내)

이 PRD는 다음 주장을 **하지 않는다.** 아래 항목은 이 저장소에 구현되어 있지 않다.

1. **실제 행정기관 신청 대행** — 구현되어 있지 않다. LIFT는 공식 신청 URL 링크만 제공한다.
2. **실제 공공 마이데이터/전자문서지갑 서류 발급** — 구현되어 있지 않다. 서류 조회는 서버의 모의(mock) 로직이다.
3. **실제 본인인증(PASS, 아이핀 등) 연동** — 구현되어 있지 않다. 본인인증은 프론트 모달 UI 데모다(`frontend/src/components/IdentityVerifyModal.tsx`).
4. **운영(실돈) 결제** — 구현되어 있지 않다. 결제는 "데모 결제(즉시 완료 처리)"와 "토스페이먼츠 **테스트 키** 결제(돈이 나가지 않음)" 두 가지다. 정산·환불·영수증 관리는 없다.
5. **AI에 의한 법적 수급 자격 확정** — 하지 않는다. 룰 엔진은 "신청 가능성/우선순위"를 계산하고, AI는 요약·재정렬·설명만 보조한다.
6. **카카오/네이버 실제 소셜 로그인 개방** — 코드 자체는 존재하지만, **데모 기간 동안 서버·프론트 양쪽에서 의도적으로 차단되어 있다**(기본값 `lift.oauth.social-enabled=false` → HTTP 403). 사용자는 데모 로그인만 사용할 수 있다.
7. **결혼·출산휴가·육아휴직 리포트** — 구현되어 있지 않다. 온보딩 화면에 "준비 중"으로 표시되며 선택할 수 없다.
8. **알림(이메일/푸시/카카오톡), 게시글 검색, 신고, 관리자 화면** — 구현되어 있지 않다.
9. **서버 사이드 PDF 파일 생성/저장소 업로드** — 구현되어 있지 않다. PDF 저장은 브라우저 인쇄(`window.print()`) 기반이다.
10. **정기 배치의 상시 가동** — 정부24 자동 동기화 스케줄러 코드는 존재하지만 **기본 비활성**(`GOV24_SYNC_ENABLED=false`)이며, 켜지 않으면 빈(Bean) 자체가 등록되지 않는다.

## 1. 제품 개요

LIFT는 **퇴직 또는 이직** 상황의 사용자가 확인해야 할 행정 절차(실업급여, 건강보험, 국민연금, 세금, 퇴직금), 예상 수령·절감 금액, 필요 서류, 공식 신청 링크, 추가 공공혜택 후보를 한 번의 진단으로 정리해 주는 웹 서비스다.

핵심 가치는 "자동 신청"이 아니라, 사용자의 입력을 바탕으로 **지금 무엇을 먼저 확인해야 하는지**를 설명 가능한 유료 리포트로 제공하는 것이다.

- 프론트엔드: Next.js 15 (App Router), `frontend/`
- 백엔드: Spring Boot(Java 21) REST API, `src/main/java/com/lift/`
- DB: 로컬 H2 인메모리(`application-local.properties`) / 운영은 JDBC 환경변수로 PostgreSQL(Supabase 등) 연결 가능
- 배포 구성 파일: `Dockerfile`, `render.yaml`(백엔드), `netlify.toml`(프론트)

## 2. 문제 정의

퇴직·계약만료·이직 직후 사용자는 실업급여, 건강보험 임의계속가입, 국민연금 납부예외, 세금 정산, 퇴직금을 동시에 확인해야 하지만, 제도마다 조건·기한·서류·신청 채널이 흩어져 있어 우선순위 판단이 어렵다.

LIFT의 해결 방식:

1. 짧은 진단 폼으로 상황 수집 (`frontend/src/app/assessment/new/page.tsx`)
2. 서버 룰 엔진이 절차별 신청 가능성·우선순위·필요 서류 계산 (`src/main/java/com/lift/domain/lifetransition/rule/`)
3. 결제 전 미리보기 → 결제 후 전체 로드맵 공개
4. 공공혜택 캐시 DB(`gov24_benefit_cache`)에서 추가 혜택 후보를 규칙 기반 매칭·점수화
5. OpenAI 활성화 환경에서만 후보 재랭킹·쉬운 요약을 보조 생성 (실패 시 규칙 기반 결과로 폴백)

## 3. 대상 사용자

- 퇴직 예정자·퇴직 직후 사용자, 계약 만료·폐업·해고로 구직급여 가능성을 확인하려는 사용자
- 이직 중 건강보험/국민연금/세금 공백을 확인하려는 사용자
- **심사자**: 데모 로그인만으로 진단→미리보기→결제→상세 리포트→PDF→AI 질문 전 과정을 체험하는 평가자

## 4. MVP 범위

### 4.1 포함 (구현되어 있음)

- 데모용 브라우저 로컬 세션 로그인 (백엔드 미연동, localStorage)
- 카카오/네이버 OAuth 시작·콜백·JWT 발급 **코드** (단, 데모 기간 스위치로 차단됨 — §5.1)
- 퇴직/이직 생애 이벤트 선택, 진단 입력
- 룰 엔진 기반 리포트 생성 (5개 절차)
- 예상 수령액/절감액 계산 (실업급여·퇴직금·건강보험·국민연금)
- 결제 전 미리보기, BASIC/PLUS 플랜, 데모 결제, 토스 테스트 결제 승인 API
- **BASIC(6,900원): 상세 리포트 + PDF 저장** / **PLUS(13,900원): BASIC + AI 질문 10회**
- 공공혜택 캐시 DB 기반 추천 (키워드·지역·나이·특성·소득 정밀 매칭)
- OpenAI 활성화 시 공공혜택 AI 재랭킹/요약, 리포트 AI 질문
- 정부24 카탈로그 자동 동기화 + AI 자격조건 구조화 추출 (기본 비활성 스케줄러)
- PDF 저장 화면 (브라우저 인쇄 기반, 모바일 인앱 브라우저 감지·안내 포함)
- 필요 서류 목록 + 모의 서류 조회
- 퇴직/이직 커뮤니티 (목록/작성/상세/댓글/좋아요/삭제)
- 내 정보(프로필 조회·수정), 약관 열람·동의

### 4.2 제외 (구현되어 있지 않음)

- §0 정직성 선언의 1~10 전부
- 회원 아이디/비밀번호 가입 (소셜·데모 로그인 외 가입 수단 없음)
- 리포트 이력 목록 화면 (최신 리포트 1건 중심 흐름)
- 다국어, 웹 접근성 인증, 오프라인 지원

## 5. 기능 요구사항

각 기능에 [구현 상태]와 근거 파일을 명시한다.

### 5.1 인증

**[구현 상태: 데모 로그인만 개방. 소셜 로그인은 코드 존재하나 기본 차단]**

근거: `AuthController.java`, `AuthService.java`, `OAuthProperties.java`, `frontend/src/app/login/page.tsx`, `frontend/src/lib/auth.ts`

- 로그인 화면에는 카카오/네이버/데모 버튼 3개가 모두 보이지만, **카카오/네이버 버튼을 누르면 실제 OAuth로 이동하지 않고 "지금은 데모 기간이에요. 아래 '데모용 로그인'으로 모든 기능을 체험해 주세요." 안내만 표시된다.**
- 서버도 이중으로 방어한다: `lift.oauth.social-enabled`(환경변수 `OAUTH_SOCIAL_ENABLED`, **기본 false**)가 꺼져 있으면 `GET /api/auth/login/{provider}`와 `GET /api/auth/callback/{provider}`가 **HTTP 403 (`COMMON403_1`)** 을 반환한다. 프론트 버튼을 우회한 URL 직접 접근도 차단된다. (회귀 테스트: `AuthSocialLoginDisabledTest.java`)
- **데모 로그인**은 백엔드를 거치지 않는다. `startDemoSession()`이 localStorage에 `lift.demoSession=1`과 로컬 토큰을 기록하고, 이후 대부분의 API 호출이 프론트 데모 구현(`frontend/src/lib/demo.ts`)으로 분기된다(§5.11). 데모 세션은 실제 JWT가 아니다.
- 소셜 로그인 스위치를 켜는 경우(`OAUTH_SOCIAL_ENABLED=true` + 제공자 client id/secret/redirect URI)에 한해: 인가 리다이렉트 → 콜백 코드 교환 → access/refresh JWT 발급(`POST /api/auth/refresh`, `POST /api/auth/logout` 포함)이 동작한다. client-id가 비어 있으면 개발용 mock 콜백(`lift.oauth.mock-enabled`)도 있으나 이 역시 social-enabled가 켜져야 접근 가능하다.
- 약관: `GET /api/terms/{type}` 열람, `POST /api/users/me/agreement` 동의 저장.

### 5.2 온보딩 및 생애 이벤트 선택

**[구현 상태: 구현됨 — 퇴직/이직만 선택 가능]**

근거: `frontend/src/app/onboarding/life-event/page.tsx`

- 선택 가능: **퇴직(RETIREMENT), 이직(JOB_CHANGE)** 2종.
- 결혼, 출산휴가는 화면에 "준비 중" 배지와 함께 **비활성(선택 불가)** 카드로 표시된다. 해당 리포트 기능은 구현되어 있지 않다.
- 백엔드 enum(`LifeEventType`)에는 UNEMPLOYMENT(실직)도 존재하지만 프론트 진단 플로우는 퇴직/이직 중심이다.
- 약관 동의 체크 후 다음 단계로 진행한다.

### 5.3 진단 입력

**[구현 상태: 구현됨]**

근거: `frontend/src/app/assessment/new/page.tsx`, `POST /api/life/assessments`

입력 항목:

| 항목 | 필수 여부 |
|---|---|
| 퇴직(퇴사)일 / 마지막 근무일 | 선택 |
| 퇴사(이직) 사유 — 계약 만료/정년퇴직/회사 폐업/개인 사정/해고/기타 | **필수** |
| 다음 일자리 상태(아직 미정/확정됨/모름) + 확정 시 시작일 | **필수** |
| 고용보험 가입 기간(개월, 스테퍼+빠른 선택) | **필수** |
| 현재 소득 상태(없음/있음/모름) | **필수** |
| 나이(만) | **필수** |
| 거주 지역 — 시/도 + 시/군/구 (17개 시·도 전체 선택 가능) | **필수** |
| 근속연수 | 선택 |
| 가구 형태, 연소득 구간, 재산 구간, 주거 형태 | 선택 |
| 자녀/부양가족/기초생활수급/차상위·저소득/한부모/장애 관련 여부 (토글) | 선택 |

- 필수 항목이 모두 채워져야 제출 버튼이 활성화된다.
- **월 평균임금은 진단 단계에서 받지 않는다.** 민감 정보이므로 PDF 저장 시점에만 별도 입력받는다 (§5.9).
- 기존 프로필이 있으면 지역·가구·소득·특성 값을 폼에 자동 채운다.

### 5.4 룰 엔진 기반 리포트 생성

**[구현 상태: 구현됨]**

근거: `RuleEngineService.java` + `rule/rules/` 4개 룰 클래스 (`UnemploymentBenefitRule`, `HealthInsuranceContinuationRule`, `NationalPensionExceptionRule`, `TaxAndSeverancePayRule`)

- 진단 제출(`POST /api/life/assessments/{id}/analyze`) 시 서버 룰 엔진이 리포트를 생성한다.
- 생성 절차는 정확히 다음 **5종**이다(`ProcedureType`): 실업급여(구직급여), 건강보험 임의계속가입, 국민연금 납부예외, 세금 정산 체크(연말정산/종합소득세), 퇴직금 정산 확인.
- 각 항목은 신청 가능성(eligibility: HIGH/NEEDS_CHECK/LOW), 우선순위, 판단 사유, 기한, 필요 서류, 공식 신청 링크(work24, nhis, nps, hometax, moel 도메인)를 포함하고 우선순위순으로 정렬된다.
- **제한**: 룰 엔진 결과는 행정기관의 최종 수급 판정이 아니며, 화면과 PDF에 "참고용" 고지가 포함된다.

### 5.5 예상 금액 계산

**[구현 상태: 구현됨]**

근거: `BenefitEstimationService.java` (서버), `frontend/src/lib/demo.ts`의 동일 취지 산식 (데모)

- 실업급여: 소정급여일수(고용보험 가입기간 + 50세 이상 우대) × 구직급여일액. 월급이 없으면 **법정 1일 하한액 66,048원 ~ 상한액 68,100원** 범위로, 월급이 있으면 `월급/30 × 60%`를 하한~상한으로 클램프해 계산한다.
- 퇴직금: 월급이 있으면 `1일 평균임금 × 30 × 근속연수`, 없으면 연소득 구간 근사값으로 범위 추정.
- 건강보험/국민연금: 월 소득 기준 예상 절감액(국민연금 기준소득월액 상한 반영).
- 미리보기·리포트에는 범위(예: "약 1,190만원 ~ 1,230만원")로, 요약 헤드라인에는 범위의 중간값을 표시한다.
- 정책 상수는 코드 주석에 기준 연도와 함께 하드코딩되어 있으며 "예상치" 고지가 항상 붙는다.

### 5.6 결제 전 미리보기

**[구현 상태: 구현됨]**

근거: `GET /api/life/reports/{id}/preview`, `frontend/src/app/report/[id]/preview/page.tsx`

- 결제 전: 요약 제목·메시지, 발견 항목 수, 핵심 항목 2개(이름/적합도/우선순위 배지), 예상 수령액 범위를 보여준다.
- 상세 사유, 전체 서류, 공식 링크는 결제 후에만 공개된다.
- 이미 결제된 리포트의 미리보기 URL 접근 시 상세 리포트로 리다이렉트한다.

### 5.7 결제 및 플랜

**[구현 상태: 구현됨 — 단, 데모 결제와 토스 "테스트" 결제만. 실돈 결제 없음]**

근거: `ReportPlanType.java`, `LifeReportService.java`, `frontend/src/app/checkout/page.tsx`, `checkout/toss/success|fail`

플랜 정의 (백엔드 enum과 프론트 카드가 동일 값):

| 플랜 | 가격 | 상세 리포트 | PDF 저장 | AI 질문 |
|---|---|---|---|---|
| BASIC (기본 리포트) | 6,900원 | O | **O** | **X (0회)** |
| PLUS (확장 리포트) | 13,900원 | O | O | **10회** |

- **PDF 저장은 BASIC부터 제공**되고, **AI 질문만 PLUS 전용**이다. 서버 게이팅은 `LifeReportAccessManager`가 PDF용(`getPdfCapableOwnedReport`)과 AI용(`getAiChatCapableOwnedReport`)을 분리해 검증하며, 통합 테스트(`LifeAssessmentControllerTest.기본리포트는_상세와_PDF가_열리고_AI는_확장리포트에서만_가능하다`)로 고정되어 있다.
- 결제 수단 2종: ① **데모 결제**(`POST .../payments/mock-complete`) — 외부 결제창 없이 즉시 PAID 처리. ② **토스 테스트 결제**(`POST .../payments/toss/confirm`) — `test_ck_` 클라이언트 키가 설정된 경우에만 버튼이 활성화되고, 서버는 금액·주문번호를 검증 후 토스 테스트 승인 API를 호출한다. 테스트 키이므로 실제 돈이 결제되지 않는다.
- 신청 가능 항목이 0개면 결제 버튼이 비활성화된다.
- **구현되어 있지 않은 것**: 운영 PG 계약, 정산, 환불, 결제 취소, 영수증, 구독.

### 5.8 상세 리포트

**[구현 상태: 구현됨]**

근거: `GET /api/life/reports/{id}`, `frontend/src/app/report/[id]/page.tsx`

- 결제 완료(PAID) + 본인 소유 리포트만 열람 가능. 미결제 접근은 403 → 결제 흐름 유도.
- 구성: 예상 총 수령액/월 절감액 요약, "지금 바로 시작하세요" 최우선 항목 강조, 우선순위별 절차 카드(사유·기한·필요 서류·공식 링크), 공공혜택 후보 가로 캐러셀(§5.10), 하단 AI 질문/PDF 저장 CTA.
- BASIC 결제 시 AI 버튼은 "AI 질문은 확장 리포트에서 이용 가능"으로 비활성 표시된다.

### 5.9 PDF 저장

**[구현 상태: 구현됨 — 브라우저 인쇄 기반. 서버 PDF 생성 아님]**

근거: `frontend/src/app/report/[id]/pdf/page.tsx`, `ReportPdfDocument.tsx`, `POST /api/life/reports/{id}/pdf-estimate`, `globals.css`의 `@media print`

- 결제(BASIC 이상) 사용자는 PDF 저장 화면을 열 수 있다.
- 두 경로: **월 평균임금 입력 저장**(실업급여·퇴직금·보험료를 정확값으로 재계산) / **월급 없이 저장**(범위·산식 중심).
- A4 인쇄 전용 CSS로 화면 UI를 제거하고 문서만 출력한다. 저장 자체는 `window.print()` → 사용자가 "PDF로 저장"을 선택하는 방식이다.
- **모바일 인앱 브라우저 대응**: 카카오톡/네이버앱/인스타그램/페이스북/라인 등의 인앱 브라우저(WebView)에서는 `window.print()`가 동작하지 않으므로, User-Agent로 감지해 경고 배너를 띄우고 "브라우저로 열어 PDF 저장" 버튼을 제공한다 — 카카오톡은 공식 스킴(`kakaotalk://web/openExternal`), 안드로이드는 Chrome intent, iOS는 URL 클립보드 복사로 외부 브라우저 이동을 안내한다.
- **구현되어 있지 않은 것**: 서버에서 PDF 파일을 생성해 저장소에 올리거나 이메일로 보내는 기능.

### 5.10 공공혜택 추천 (정부24 데이터)

**[구현 상태: 구현됨 — DB 캐시 조회 방식. 리포트 조회 시 정부24 API를 실시간 호출하지 않음]**

근거: `Gov24PublicBenefitService.java`, `Gov24BenefitCache.java`, `Gov24BenefitCacheRepository.java`, `src/main/resources/data.sql`(로컬 시드 101건), 설정 키 `GOV24_PUBLIC_SERVICE_ENABLED`

- 서버는 `gov24_benefit_cache` 테이블(정부24 공공서비스 원문 + AI가 추출한 구조화 자격조건 컬럼)에서 후보를 읽는다. 로컬 H2에는 `data.sql`로 100여 건이 시드된다(운영 Postgres에는 자동 실행되지 않음).
- 매칭 파이프라인 (모두 서버 규칙, AI 비용 0원):
  1. 상황 키워드 매칭 (이벤트 유형·리포트 절차 기반)
  2. **지역 필터** — 소관기관명이 광역시·도로 시작하면 지역 전용으로 보고 사용자 시/도와 대조(시/군/구까지 명시 시 추가 대조). 중앙부처·공단은 전국으로 간주.
  3. **전용 특성 필터** — `requires_basic_livelihood / requires_near_poverty / requires_single_parent / requires_disabled` 플래그가 true인 혜택은 사용자가 **명시적으로 아니라고 답한 경우에만** 제외(미응답 null은 제외하지 않음). 차상위 전용은 기초수급자도 포함.
  4. **연소득 상한 필터** — 사용자 소득구간 하한이 혜택의 `max_annual_income_won`을 넘으면 제외.
  5. 나이/근속연수/고용보험 기간 조건 미달 제외. 나이 조건이 있는데 나이 미입력이면 제외하지 않고 `pendingBenefits` + `requiredForMatching`(부족 입력 목록)으로 분리 반환.
  6. 관련도 점수 계산 → 내림차순 정렬.
- 응답 필드: `relevanceScore`, `fitLevel`(HIGH/NEEDS_CHECK/LOW), `priorityGroup`, `matchedKeyword`, `sourceLabel`, `supportTarget`, `applicationDeadline`, `requiredDocuments` 등.
- `GOV24_PUBLIC_SERVICE_ENABLED=false`면 상세 리포트의 공공혜택 목록은 비어 있을 수 있다.

### 5.10.1 공공혜택 AI 재랭킹·요약

**[구현 상태: 구현됨 — OPENAI_ENABLED=true 환경에서만 동작, 실패 시 규칙 기반 폴백]**

근거: `PublicBenefitRecommendationService.java`, 설정 키 `OPENAI_ENABLED`, `OPENAI_API_KEY`, `OPENAI_MODEL`

- OpenAI가 켜진 환경에서는 서버가 계산한 후보 목록을 OpenAI에 보내 우선순위 재정렬과 쉬운 한 줄 요약(`aiSummary`)을 받는다. 구조화된 JSON 스키마 응답만 허용하며, AI가 새로운 금액·수급 조건을 만들어내지 않도록 후보 JSON 범위 안에서만 요약한다.
- OpenAI 호출 실패·비활성 시 서버 점수순 결과가 그대로 반환된다(기능 저하 없음, `aiSummary`만 비어 있음).

### 5.10.2 정부24 자동 동기화 + AI 자격조건 구조화 추출

**[구현 상태: 코드 구현됨 — 기본 비활성. `GOV24_SYNC_ENABLED=true`일 때만 빈이 등록됨]**

근거: `Gov24BenefitSyncService.java`(`@ConditionalOnProperty(sync-enabled)`), `Gov24CatalogClient.java`, `BenefitCriteriaExtractionService.java`, `LiftApplication.java`의 `@EnableScheduling`

- 켜진 경우 매일 지정 cron(기본 09:00, `GOV24_SYNC_CRON`)에: ① 정부24 serviceList 조회 → ② 원문(서비스명·지원대상·선정기준·지원내용) MD5 `content_hash` 계산 → ③ 서비스ID 기준 UPSERT(신규 INSERT / 해시 변경 시 UPDATE / 동일 시 스킵) → ④ 미추출 행(`criteria_extracted_at IS NULL`)만 AI로 자격조건(나이·가입기간·근속·비자발성·소득상한·전용특성 4종)을 구조화 추출해 채운다.
- AI 호출은 신규/변경 건에만 발생하고 배치 상한(기본 200건, `GOV24_SYNC_EXTRACT_BATCH_SIZE`)이 있으며, 시스템적 실패(크레딧 부족 등) 시 첫 실패에서 중단해 불필요한 과금을 막는다.
- **기본값은 꺼져 있으므로**, 이 저장소를 그대로 실행하면 스케줄러는 동작하지 않고 리포트 추천은 기존 캐시 데이터만 사용한다.

### 5.11 데모 모드 (심사 체험 경로)

**[구현 상태: 구현됨 — 프론트 로컬 구현. 백엔드 DB에 저장되지 않음(커뮤니티·데모 AI챗 제외)]**

근거: `frontend/src/lib/demo.ts`(약 1,400줄), `frontend/src/lib/api.ts`의 `isDemoSession()` 분기(18개 API), `DemoReportChatController.java`

- 데모 로그인 시 진단/분석/미리보기/결제/리포트/PDF/서류 API가 전부 `demoApi`(프론트 목업)로 분기되고 결과는 localStorage(`lift.demo.*`)에 저장된다.
- **데모 공공혜택 매칭은 입력값에 따라 동적으로 달라진다.** 백엔드와 동일한 규칙(키워드 → 지역 → 전용 특성 → 가입기간 → 비자발성 → 나이 → 점수 정렬)을 프론트에 재현했다:
  - 목업 카탈로그 **15건**(실업급여, 국민취업지원, 내일배움카드, 조기재취업수당, 청년 도약장려금(15~34세), 긴급복지 생계지원, 노인 일자리(60+), 노인 보청기(65+·차상위), 신중년 경력형 일자리(50~64세), 중장년내일센터(40+), 주거급여(차상위), 장애인 취업성공패키지, 한부모 생활안정, 기초생활 생계급여, 자활근로).
  - 여기에 사용자가 고른 시/도명으로 지역 전용 항목 2건("○○ 긴급복지지원", "○○ 지역맞춤 일자리사업")을 **즉석 생성**해 함께 매칭한다. 17개 시·도 어느 지역을 골라도 해당 지역 혜택이 노출된다.
  - 검증된 예: 서울/45세 → 6건, 부산/68세 → 7건(노인 항목 포함), 대구/55세 → 9건(중장년 2종 포함), 인천/30세 → 8건(청년 항목 포함, 중장년 없음).
- 데모 결제도 플랜 게이팅을 동일 적용한다: BASIC → PDF 가능·AI 불가, PLUS → AI 10회.
- **데모 AI 질문은 실제 백엔드를 호출한다**: 인증 없이 허용된 `POST /api/ai/report-chat`(SecurityConfig 허용 목록)에 프론트가 리포트 JSON을 보내고, 서버가 OpenAI(키는 서버 보관)로 답한다. OpenAI가 꺼져 있으면 리포트 요약 기반 폴백 답변을 준다. 남용 방지를 위해 질문 길이를 최대 2,000자로 제한한다(`DemoReportChatReqDTO`의 `@Size`).
- **주의(정직한 한계)**: 데모 카탈로그 15건+지역 2건은 시연용 축약본이며, 백엔드 경로의 캐시 DB(100여 건)와 데이터 양이 다르다. 데모 지역 항목은 지역명을 템플릿에 삽입해 생성한 예시로, 해당 지자체의 실제 제도명과 다를 수 있다(카드에 "데모" 출처 라벨 표기).

### 5.12 리포트 기반 AI 질문 (PLUS 전용)

**[구현 상태: 구현됨 — OpenAI 활성 시 실제 LLM, 비활성 시 서버 폴백]**

근거: `LifeReportChatService.java`, `OpenAiLifeReportAiService.java`, `MockLifeReportAiService.java`, `POST|GET /api/life/reports/{id}/chat/messages`

- PLUS 결제 리포트에서만 사용 가능(서버 403 게이팅). 질문 한도 **10회**, 질문 1건당 1회 차감, 사용자/AI 메시지는 리포트별로 저장된다.
- 10회 초과 시 `AI_QUESTION_LIMIT_EXCEEDED` 에러. (테스트: `AI질문은_10회까지만_허용되고_초과시_403이다`)
- OpenAI 비활성 환경에서는 리포트 내용·예상 금액을 근거로 한 결정적 폴백 답변을 생성한다.
- AI 답변은 보조 설명이며 법률·노무 자문을 대체하지 않는다는 고지가 있다.

### 5.13 필요 서류 모의 조회

**[구현 상태: 데모/모의 구현 — 실제 발급 연동 없음]**

근거: `LifeDocumentFetchService.java`, `POST /api/life/reports/{id}/documents/fetch`, `IdentityVerifyModal.tsx`, `frontend/src/app/documents/mock/page.tsx`

- 상세 리포트의 절차별 필요 서류에 대해, 프론트 본인인증 **모달(데모 UI)** 완료 후 서류 조회 API를 호출한다.
- 서버는 발급 기관 문자열 기준으로 "자동 조회 가능/직접 준비 필요"를 분류하고, 자동 조회 가능 서류에는 **모의 다운로드 링크**를 제공한다.
- 실제 본인인증 기관·공공 마이데이터·전자문서지갑 연동은 구현되어 있지 않다.

### 5.14 커뮤니티

**[구현 상태: 구현됨 — 데모 로그인도 실제 백엔드 공유 게시판 사용]**

근거: `CommunityController.java`, `CommunityService.java`, `frontend/src/app/community/`, 테스트 `CommunityControllerTest`

- 커뮤니티는 데모 세션에서도 **항상 백엔드 API를 호출**한다(데모 사용자 간 글이 공유되도록). 데모 세션은 인증 헤더 없이 요청하며 서버가 공유 데모 계정으로 귀속 처리한다.
- 기능: 게시글 목록(최신순 `GET /api/community/posts` / 인기순 `/posts/popular`, 카테고리 필터), 작성, 상세 조회, 본인 글 삭제, 좋아요/취소(`POST|DELETE /posts/{id}/likes`), 댓글 작성/본인 댓글 삭제.
- 카테고리는 퇴직/이직 중심이다.
- **구현되어 있지 않은 것**: 검색, 신고, 차단, 관리자 검수, 알림, 이미지 첨부.

### 5.15 내 정보

**[구현 상태: 구현됨]**

근거: `UserController.java` — `GET /api/users/me/summary`, `GET|PATCH /api/users/me/profile`, `GET /api/users/me/onboarding-status`, `DELETE /api/users/me`(탈퇴)

- 닉네임/지역/가구·소득·자산·주거/특성(수급·차상위·한부모·장애) 프로필 조회·수정. 진단 폼 자동 채움에 사용된다.
- 데모 세션에서는 프로필도 localStorage 데모 구현으로 처리된다.

## 6. 사용자 흐름 (실제 동작 기준)

### 6.1 데모 체험 흐름 (심사 기본 경로)

1. `/login` → **"데모용 로그인으로 바로 체험하기"** (카카오/네이버 버튼은 눌러도 데모 안내만 표시)
2. `/onboarding/life-event` → 퇴직 또는 이직 선택 + 약관 동의
3. `/assessment/new` → 필수 항목 입력 (사유·다음 일자리·고용보험 기간·소득 상태·나이·지역)
4. `/report/{id}/preview` → 요약·예상 범위·핵심 항목 미리보기
5. `/checkout` → BASIC(6,900) 또는 PLUS(13,900) 선택 → **데모 결제** (또는 토스 테스트 키 설정 시 토스 테스트 결제)
6. `/report/{id}` → 전체 로드맵 + 입력 기반 공공혜택 후보 캐러셀
7. PDF 저장(BASIC부터) → 월급 입력/미입력 선택 → 브라우저 인쇄로 저장
8. PLUS라면 `/report/{id}/chat` → AI 질문 10회
9. `/community` → 공유 게시판 읽기/쓰기

### 6.2 소셜 로그인 흐름 (현재 비활성)

`OAUTH_SOCIAL_ENABLED=true` + 제공자 자격증명이 설정된 환경에서만: 버튼 → 서버 리다이렉트 → OAuth 콜백 → JWT 발급 → 이후 동일 흐름. **현재 기본 설정에서는 서버가 403으로 차단하므로 이 흐름은 동작하지 않는다.**

## 7. 기술 구조

### 7.1 프론트엔드 화면 (19개 page.tsx 전체)

`/`(랜딩→로그인), `/login`, `/login/callback/{provider}`, `/terms`, `/privacy`, `/onboarding/life-event`, `/assessment/new`, `/report/{id}/preview`, `/checkout`, `/checkout/toss/success`, `/checkout/toss/fail`, `/report/{id}`, `/report/{id}/chat`, `/report/{id}/pdf`, `/documents/mock`, `/community`, `/community/{id}`, `/my`, `/chat`(최신 PLUS 리포트 이어 질문 진입점)

- 모바일(375px) 대응 반응형. 공공혜택 카드는 가로 스크롤 캐러셀.

### 7.2 백엔드 API 전체 목록

인증/약관/사용자:
- `GET /api/auth/login/{provider}` · `GET /api/auth/callback/{provider}` (기본 403 — 소셜 차단)
- `POST /api/auth/refresh` · `POST /api/auth/logout`
- `GET /api/terms/{type}`
- `GET /api/users/me/summary` · `GET|PATCH /api/users/me/profile` · `GET /api/users/me/onboarding-status` · `POST /api/users/me/agreement` · `DELETE /api/users/me`

진단/리포트:
- `POST /api/life/assessments` · `POST /api/life/assessments/{id}/analyze` · `PATCH /api/life/assessments/{id}`
- `GET /api/life/reports/{id}/preview` · `GET /api/life/reports/{id}`
- `POST /api/life/reports/{id}/payments/mock-complete` · `POST /api/life/reports/{id}/payments/toss/confirm`
- `POST /api/life/reports/{id}/pdf-estimate` · `POST /api/life/reports/{id}/documents/fetch`
- `POST|GET /api/life/reports/{id}/chat/messages`
- `GET /api/life/reports/latest-chat-target` · `GET /api/life/reports/latest-route-target`

데모 AI챗(무인증 허용): `POST /api/ai/report-chat`

커뮤니티:
- `GET /api/community/posts` · `GET /api/community/posts/popular` · `GET /api/community/posts/{id}` · `POST /api/community/posts` · `DELETE /api/community/posts/{id}` · `POST|DELETE /api/community/posts/{id}/likes` · `POST /api/community/posts/{id}/comments` · `DELETE /api/community/posts/{id}/comments/{commentId}`

온보딩(보조): `POST /api/onboarding/child-profile` · `POST /api/onboarding/interest-region` · `POST /api/onboarding/guardian-profile` — 프로필 보조 저장용 API로 존재하며, 핵심 시연 플로우에는 사용되지 않는다.

### 7.3 데이터

- `gov24_benefit_cache`: 정부24 원문(raw_json JSON 컬럼) + 구조화 자격조건(min/max age, 가입기간, 근속, 비자발성, 연소득 상한, 전용 특성 4종) + 동기화 메타(content_hash, fetched_at, criteria_extracted_at)
- `LifeAssessment`, `LifeReport`(플랜·결제 상태·AI 사용 횟수), `ReportChatMessage`, 커뮤니티(post/comment/like), 사용자/약관 동의
- 로컬: H2 인메모리 + `data.sql` 시드(공공혜택 101건 + 자격조건 UPDATE). 운영: `SPRING_DATASOURCE_URL` 등으로 PostgreSQL 연결(시드 자동 실행 안 됨)

### 7.4 테스트

- 백엔드 통합/단위 테스트 **43개, 전부 통과** (`./gradlew test`): 인증(소셜 차단 403 포함), 진단→리포트, 플랜 게이팅(BASIC PDF 허용·AI 차단), AI 질문 10회 제한, 토스 금액 검증, 커뮤니티 흐름, 룰 엔진, 사용자 프로필 등
- 프론트: `next build` 통과 (타입체크 포함)

## 8. 환경변수 및 기능 플래그 (기본값 명시)

| 키 | 기본값 | 효과 |
|---|---|---|
| `OAUTH_SOCIAL_ENABLED` | **false** | false면 카카오/네이버 로그인·콜백이 403. 데모 로그인만 가능 |
| `OAUTH_MOCK_ENABLED` | false | 개발용 mock 콜백 (social-enabled와 함께 켜야 동작) |
| `GOV24_PUBLIC_SERVICE_ENABLED` | false | true면 리포트에 공공혜택 캐시 추천 포함 |
| `GOV24_SYNC_ENABLED` | **false** | true일 때만 정부24 일일 동기화 스케줄러 빈 등록 |
| `GOV24_SYNC_CRON` / `GOV24_SYNC_EXTRACT_BATCH_SIZE` | 09:00 / 200 | 동기화 시각·AI 추출 배치 상한 |
| `OPENAI_ENABLED` + `OPENAI_API_KEY` | false | true면 AI 질문 실 LLM, 공공혜택 재랭킹/요약, 동기화 구조화 추출에 사용. false여도 전 기능이 폴백으로 동작 |
| `TOSS_PAYMENTS_ENABLED` + `TOSS_SECRET_KEY` | false | 토스 테스트 결제 승인 API 활성화 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 없음 | `test_ck_` 접두사일 때만 프론트 토스 버튼 활성화 |

## 9. 수용 기준 (현재 코드로 검증 가능한 항목)

1. 데모 로그인 → 퇴직 선택 → 필수 입력 완료 → 미리보기 생성 → 데모 결제 → 상세 리포트 열람이 로그인부터 3분 내에 가능하다.
2. 카카오/네이버 버튼 클릭 시 외부 이동 없이 데모 안내 문구가 표시된다. `GET /api/auth/login/kakao` 직접 호출 시 403이 반환된다.
3. BASIC(6,900원) 결제 후: PDF 저장 화면이 열리고, AI 질문 API는 403(`LIFE403_4`)이다.
4. PLUS(13,900원) 결제 후: AI 질문이 가능하고 10회 초과 시 차단된다.
5. 진단 입력(지역·나이·특성)을 바꾸면 데모 공공혜택 후보의 개수와 구성이 달라진다 (예: 지역을 바꾸면 해당 시·도 이름의 지역 항목이 뜨고, 30세↔55세에 따라 청년/중장년 항목이 교체된다).
6. PDF 저장 화면에서 월급 입력/미입력 두 경로 모두 동작하며, 인앱 브라우저 UA에서는 외부 브라우저 안내가 표시된다.
7. 커뮤니티에서 글 작성·댓글·좋아요·본인 글 삭제가 동작한다.
8. `OPENAI_ENABLED=false` 환경에서도 위 1~7이 모두 동작한다(AI 답변은 폴백 문구).

## 10. 현재 한계 및 리스크 (미구현 명세)

- 실제 공공 마이데이터/전자문서지갑/본인인증 연동 **없음** (모의 구현)
- 운영 결제(실돈)·정산·환불 **없음** (데모/테스트 결제만)
- 실제 소셜 로그인 **기본 차단** (스위치+자격증명 필요)
- 결혼/출산휴가/육아휴직 리포트 **없음** ("준비 중" 표시만)
- 알림·검색·신고·관리자 화면 **없음**
- 정부24 동기화 스케줄러 **기본 꺼짐** — 켜지 않으면 혜택 데이터는 시드/기존 캐시로 고정
- 데모 모드 데이터는 브라우저 localStorage에만 저장되어 기기 간 공유되지 않음 (커뮤니티 제외)
- 룰 엔진·금액 산식의 정책 상수는 코드에 하드코딩되어 있어 제도 개정 시 수동 갱신 필요
- OpenAI 활성 시 상세 리포트 조회·AI 질문에 API 비용과 지연이 발생할 수 있음

## 11. 추후 확장 방향 (현재는 미구현임을 재확인)

- 정부24 동기화 상시 가동 + 관리자 검수 화면
- 실제 본인인증·공공 마이데이터 서류 발급 연동
- 결혼·출산휴가 등 생애 이벤트 확대, 신청 기한 캘린더/알림
- 운영 결제(승인·취소·환불·영수증) 및 플랜 만료 정책
- 커뮤니티 검색·신고·관리 도구

## 12. 심사·발표 표현 가이드

권장 표현:
- "LIFT는 퇴직/이직 상황에서 놓치기 쉬운 행정 절차를 우선순위 리포트로 정리합니다."
- "자격을 확정하지 않습니다. 신청 가능성과 확인 필요 항목을 안내합니다."
- "공공혜택은 캐시 DB 후보를 서버 규칙 엔진으로 매칭하고, OpenAI가 켜진 환경에서만 재랭킹·요약을 보조합니다."
- "서류 조회와 본인인증은 모의 구현이며, 실제 연동으로 교체 가능하도록 분리했습니다."
- "데모 기간에는 소셜 로그인을 서버 차원에서 차단하고 데모 로그인으로 전 기능을 개방했습니다."

금지 표현 (코드와 불일치):
- "AI가 실업급여 수급 여부를 확정합니다" (X)
- "정부24에 실시간으로 신청/조회합니다" (X — DB 캐시 조회)
- "공공 서류를 실제 발급합니다" (X — 모의)
- "운영 결제가 완성되어 있습니다" (X — 테스트 결제)
- "모든 생애 이벤트를 지원합니다" (X — 퇴직/이직만)
