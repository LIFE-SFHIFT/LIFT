# PRD — LIFT 구축 명세서 (Build Specification)

- 문서 버전: v3 (2026-07-09, 구축 명세형 전환)
- 대상: LIFT (생애전환 행정 준비 서비스)
- 문서 성격: **이 문서만으로 프로젝트를 처음부터 재구축할 수 있게 하는 구현 명세.** "무엇이 있는지"를 설명하는 문서가 아니라, "무엇을 어떻게 만들어야 하는지"를 지시하는 요구사항 명세다.

## 0. 문서 사용법 (AI 구현자를 위한 안내)

이 PRD는 코드가 존재하지 않는 상태에서 LIFT를 그대로 구현하기 위한 지시서다. 다음 규칙을 지켜 구현한다.

1. 모든 요구사항은 `REQ-*` / `AC-*`(수용 기준) ID로 식별한다. 각 기능 절은 목적 → 동작 요구사항 → API 계약 → 비즈니스 규칙 → UI 요구 → 수용 기준 순서로 기술한다.
2. §2 "스코프 경계"의 **제외(Out of Scope)** 항목은 의도적으로 구현하지 않는다. 모의(mock)로 지정된 항목은 실제 외부 연동 없이 명세된 모의 동작만 구현한다.
3. §4 기술 스택의 버전을 그대로 사용한다. 임의 상향/하향 금지.
4. §6 데이터 모델, §7 공통 규약(응답/에러/보안), §8 기능 명세의 상수·문자열·산식은 **명시된 값 그대로** 구현한다. 특히 룰 엔진 판정, 금액 산식 상수, 공공혜택 점수표는 임의 변경 금지.
5. §14 수용 기준(테스트)을 만족해야 완료로 간주한다.

## 1. 제품 개요

LIFT는 **퇴직 또는 이직** 상황의 사용자가 확인해야 할 행정 절차(실업급여, 건강보험, 국민연금, 세금, 퇴직금), 예상 수령·절감 금액, 필요 서류, 공식 신청 링크, 추가 공공혜택 후보를 한 번의 진단으로 정리해 주는 웹 서비스다.

- **핵심 가치**: "자동 신청"이 아니라, 사용자의 입력을 근거로 *지금 무엇을 먼저 확인해야 하는지*를 설명 가능한 유료 리포트로 제공한다.
- **판정 철학**: 시스템은 법적 수급 자격을 **확정하지 않는다.** 룰 엔진이 "신청 가능성/우선순위"를 결정적으로 계산하고, AI(OpenAI)는 켜졌을 때만 요약·재정렬·설명을 **보조**한다(꺼져도 전 기능이 규칙 기반 폴백으로 동작).
- **수익 모델**: 진단 후 결제 게이팅. BASIC(6,900원)·PLUS(13,900원) 2개 플랜.

### 1.1 목표 사용자

- 퇴직 예정/직후, 계약 만료·폐업·해고로 구직급여 가능성을 확인하려는 사용자
- 이직 중 건강보험/국민연금/세금 공백을 확인하려는 사용자
- **심사자/평가자**: 데모 로그인만으로 진단→미리보기→결제→상세→PDF→AI 질문 전 과정을 외부 연동 없이 체험

### 1.2 문제 정의

퇴직·계약만료·이직 직후 사용자는 실업급여, 건강보험 임의계속가입, 국민연금 납부예외, 세금 정산, 퇴직금을 동시에 확인해야 하지만 제도마다 조건·기한·서류·신청 채널이 흩어져 우선순위 판단이 어렵다. LIFT는 짧은 진단 → 규칙 기반 리포트 → 결제 후 전체 로드맵 + 공공혜택 후보로 이를 한 화면에 정리한다.

## 2. 스코프 경계

### 2.1 반드시 구현 (In Scope)

- 데모용 브라우저 로컬 세션 로그인(백엔드 미연동, localStorage 기반)
- 카카오/네이버 OAuth 시작·콜백·JWT 발급·리프레시 회전 **코드**(단, 기능 플래그로 기본 차단 — REQ-AUTH)
- 퇴직/이직 생애 이벤트 선택 + 진단 입력
- 룰 엔진 기반 리포트 생성(최대 5종 절차, 조건부)
- 예상 수령/절감액 계산(실업급여·퇴직금·건강보험·국민연금)
- 결제 전 미리보기, BASIC/PLUS 플랜, 데모 결제 + 토스페이먼츠 **테스트** 결제 승인
- 공공혜택 캐시 DB 기반 추천(키워드·지역·나이·특성·소득 매칭·점수화)
- OpenAI 활성 시 공공혜택 재랭킹/요약 + 리포트 기반 AI 질문(비활성 시 폴백)
- 정부24 카탈로그 자동 동기화 + AI 자격조건 구조화 추출(기본 비활성 스케줄러)
- PDF 저장 화면(브라우저 인쇄 기반, 인앱 브라우저 감지·외부 이동 안내)
- 필요 서류 모의 조회(본인인증 모달 데모 포함)
- 퇴직/이직 커뮤니티(목록/작성/상세/댓글/좋아요/삭제)
- 내 정보(프로필 조회·수정·탈퇴), 약관 열람·동의

### 2.2 의도적 제외 / 모의 (Out of Scope) — 구현 금지 또는 모의만

| # | 항목 | 처리 |
|---|------|------|
| 1 | 실제 행정기관 신청 대행 | 구현 안 함. 공식 신청 URL 링크만 제공 |
| 2 | 실제 공공 마이데이터/전자문서지갑 서류 발급 | 모의 로직만 |
| 3 | 실제 본인인증(PASS/아이핀 등) | 프론트 모달 UI 데모만 |
| 4 | 운영(실돈) 결제·정산·환불·영수증·구독 | 없음. 데모 결제 + 토스 **테스트 키** 결제만 |
| 5 | AI에 의한 법적 수급 자격 확정 | 금지. 룰 엔진이 가능성/우선순위만 계산 |
| 6 | 카카오/네이버 실제 소셜 로그인 개방 | 코드는 구현하되 기본 플래그로 서버·프론트 양쪽 차단(403) |
| 7 | 결혼/출산휴가/육아휴직 리포트 | 온보딩에 "준비 중" 비활성 표시만 |
| 8 | 알림(이메일/푸시/카톡), 게시글 검색·신고·관리자 화면 | 없음 |
| 9 | 서버 사이드 PDF 파일 생성/업로드 | 없음. 브라우저 `window.print()` 기반 |
| 10 | 정기 배치 상시 가동 | 스케줄러 코드는 구현하되 기본 비활성(빈 미등록) |
| 11 | 아이디/비밀번호 회원가입 | 없음(소셜·데모만) |
| 12 | 리포트 이력 목록 화면, 다국어, 접근성 인증, 오프라인 | 없음(최신 리포트 1건 중심) |

## 3. 사용자 흐름

### 3.1 데모 체험 흐름 (기본 경로)

1. `/login` → "데모용 로그인으로 바로 체험하기" (소셜 버튼은 눌러도 데모 안내만)
2. `/onboarding/life-event` → 퇴직/이직 선택 + 약관 동의
3. `/assessment/new` → 필수 항목 입력(사유·다음 일자리·고용보험 기간·소득 상태·나이·지역)
4. `/report/{id}/preview` → 요약·예상 범위·핵심 항목 2개 미리보기
5. `/checkout?reportId=` → BASIC/PLUS 선택 → 데모 결제(또는 토스 테스트 결제)
6. `/report/{id}` → 전체 로드맵 + 입력 기반 공공혜택 후보 캐러셀
7. `/report/{id}/pdf` → 월급 입력/미입력 선택 → 브라우저 인쇄로 저장
8. (PLUS) `/report/{id}/chat` → AI 질문 최대 10회
9. `/community` → 공유 게시판 읽기/쓰기

### 3.2 소셜 로그인 흐름 (기본 비활성)

`OAUTH_SOCIAL_ENABLED=true` + 제공자 자격증명 설정 시에만: 버튼 → 서버 리다이렉트 → OAuth 콜백 → JWT 발급 → 이후 동일. 기본 설정에서는 서버가 403으로 차단.

## 4. 기술 스택 & 아키텍처

### 4.1 스택 (버전 고정)

| 영역 | 기술 | 버전 |
|------|------|------|
| 백엔드 | Spring Boot | 4.1.0 |
| 언어 | Java (toolchain) | 21 |
| 빌드 | Gradle + `io.spring.dependency-management` | 1.1.7 |
| ORM | Spring Data JPA (Hibernate) | Boot 관리 |
| 보안 | spring-boot-starter-security-oauth2-client | Boot 관리 |
| JWT | io.jsonwebtoken jjwt (api/impl/jackson) | 0.12.6 |
| API 문서 | springdoc-openapi-starter-webmvc-ui / -api | 3.0.1 |
| Validation | spring-boot-starter-validation | Boot 관리 |
| DB (로컬/테스트) | H2 (in-memory) | runtime |
| DB (운영) | PostgreSQL | runtime |
| 프론트 | Next.js (App Router) | 15.5.20 |
| UI 런타임 | React / React-DOM | 19.0.0 |
| 프론트 언어 | TypeScript | 5.7.3 |
| 프론트 배포 | Netlify (`@netlify/plugin-nextjs` 5.x) | — |

- Lombok 사용(compileOnly + annotationProcessor). 테스트는 JUnit5(`useJUnitPlatform`).
- 배포 파일: 백엔드 `Dockerfile` + `render.yaml`, 프론트 `netlify.toml`.

### 4.2 백엔드 패키지 구조

```
com.lift
├── LiftApplication.java              // @SpringBootApplication + @EnableScheduling + @EnableJpaAuditing
├── global
│   ├── apiPayload
│   │   ├── ApiResponse.java          // 공통 응답 래퍼
│   │   ├── code/ (BaseSuccessCode, GeneralSuccessCode, BaseErrorCode, GeneralErrorCode)
│   │   ├── exception/ProjectException.java
│   │   └── handler/GeneralExceptionAdvice.java   // @RestControllerAdvice
│   ├── auth/ (BearerTokenAuthenticationFilter, AuthUserPrincipal, ApiAccessDeniedHandler, ApiAuthenticationEntryPoint)
│   ├── config/ (SecurityConfig, JpaAuditingConfig)
│   └── common/entity/ (BaseCreatedEntity, BaseCreatedUpdatedEntity, BaseCreatedDeletedEntity, BaseCreatedUpdatedDeletedEntity)
└── domain
    ├── auth/         (controller, service, model, dto, enumtype)
    ├── user/         (controller, service, model, dto)
    ├── term/         (controller, service, enumtype, dto)
    ├── onboarding/   (controller, service, dto)
    ├── community/    (controller, service, model, repository, dto)
    └── lifetransition/
        ├── controller/ (LifeAssessmentController, LifeReportController, DemoReportChatController)
        ├── service/    (LifeAssessmentService, LifeReportService, LifeReportAccessManager, LifeReportChatService,
        │                BenefitEstimationService, Gov24PublicBenefitService, PublicBenefitRecommendationService,
        │                Gov24BenefitSyncService, Gov24CatalogClient, BenefitCriteriaExtractionService,
        │                TossPaymentClient, OpenAiLifeReportAiService, MockLifeReportAiService, RetirementReportChatComposer)
        ├── rule/        (RuleEngineService, RuleContext, LifeTransitionRule, RuleItemResult, RuleDocument, RuleEngineResult, rules/*)
        ├── model/       (LifeAssessment, LifeReport, ReportItem, RequiredDocument, ReportChatMessage, Gov24BenefitCache)
        ├── enumtype/    (§6.3 참조)
        └── dto/         (request, response)
```

- 모든 컨트롤러 응답은 `ApiResponse<T>`로 통일한다(예외: OAuth 로그인 시작은 302 리다이렉트).
- 도메인 서비스는 트랜잭션 경계를 서비스 계층에 둔다.

### 4.3 프론트 구조 (`frontend/src/`)

```
app/                       // App Router. 대부분 "use client"
  layout.tsx, globals.css  // Pretendard 폰트, 디자인 토큰, @media print
  page.tsx                 // "/" 라우팅 허브
  login/, login/callback/[provider]/
  onboarding/life-event/
  assessment/new/
  report/[id]/, report/[id]/preview/, report/[id]/chat/, report/[id]/pdf/
  checkout/, checkout/toss/success/, checkout/toss/fail/
  community/, community/[id]/
  my/, documents/mock/, chat/, terms/, privacy/
components/                // AppShell, AuthGuard, Badges, DateField, MonthStepper,
                           // OptionSelector, RegionField, TogglePill, IdentityVerifyModal,
                           // ReportPdfDocument, Icons
lib/                       // api.ts, auth.ts, demo.ts, types.ts, labels.ts,
                           // assessmentOptions.ts, regions.ts
```

- 모바일 셸 480px / wide 셸 1120px(`/my`, `/community`). 공공혜택 카드는 가로 스크롤 캐러셀.
- 데이터 흐름: `sessionStorage.lift.eventType`(온보딩→진단), `localStorage.lift.identityVerified`(본인인증→서류조회).

## 5. 시스템 처리 흐름 (리포트 생성 파이프라인)

```
진단 입력(LifeAssessment)
  → RuleContext.from(assessment)         // 룰 입력 7필드 파생
  → RuleEngineService.analyze(context)   // 4개 룰 평가 → 정렬 → RuleEngineResult
  → LifeReport + ReportItem[] 영속화      // 진단 1건당 리포트 1건(1:1)
  → BenefitEstimationService.estimate()  // 항목별 예상 금액
  → Gov24PublicBenefitService.findBenefits(report)  // 캐시 DB 매칭·점수화
      → PublicBenefitRecommendationService.recommend()  // (OpenAI on) 재랭킹/요약 / (off) 점수순
```

- 룰 엔진과 금액 산식은 **결정적**(AI 미사용). OpenAI는 공공혜택 재랭킹/요약과 리포트 AI 챗에만 보조 사용.
- 정부24 실시간 API는 리포트 조회 시 호출하지 않는다. 오직 캐시 테이블(`gov24_benefit_cache`)만 읽는다. 캐시는 별도 스케줄러(기본 off)가 채운다.

## 6. 데이터 모델

- 스키마 생성: Hibernate `ddl-auto=update`(로컬), 마이그레이션 도구 없음. **Enum은 전부 `@Enumerated(EnumType.STRING)`.**
- JPA Auditing 활성(`@EnableJpaAuditing`). Base 상속 엔티티에 `created_at`/`updated_at` 자동 주입.
- `Gov24BenefitCache.raw_json`은 `@JdbcTypeCode(SqlTypes.JSON)` (Postgres `jsonb`, H2 `JSON`).

### 6.1 Base 엔티티(@MappedSuperclass)

| Base | 공통 컬럼 |
|------|-----------|
| `BaseCreatedEntity` | `created_at` (NOT NULL, updatable=false, `@CreatedDate`) |
| `BaseCreatedUpdatedEntity` extends 위 | `+ updated_at` (`@LastModifiedDate`) |
| `BaseCreatedDeletedEntity` extends CreatedEntity | `+ deleted_at` (nullable, soft delete) — 정의만, 현재 미사용 |
| `BaseCreatedUpdatedDeletedEntity` extends UpdatedEntity | `+ deleted_at` — 정의만, 현재 미사용 |

### 6.2 엔티티 & 테이블 (14개 테이블)

**`user_accounts`** (UserAccount, Base 미상속·`@PrePersist`로 `authSubject`(UUID)/`created_at` 설정)
- UNIQUE(`provider`,`provider_user_id`), UNIQUE(`auth_subject`)
- 핵심 컬럼: `id`(PK), `provider`(SocialProvider,NN), `provider_user_id`(NN,128), `auth_subject`(NN,36), `email`, `nickname`, 약관 3종 `service_terms_agreed`/`privacy_policy_agreed`/`marketing_agreed`(boolean NN) + `agreement_agreed_at`, 자녀 `child_name`/`child_birth_year`/`child_birth_month`, `sido`/`sigungu`, `household_type`/`annual_income_range`/`asset_range`/`housing_type`(enum), 특성 `has_dependent_children`/`has_supporting_family`/`basic_livelihood_recipient`/`near_poverty`/`single_parent`/`disabled_person`(Boolean nullable), `guardian_nickname`/`guardian_type`/`community_role_type`, `withdrawn`(boolean NN)
- ElementCollection: `user_care_areas`(user_id FK, `care_area`), `user_interests`(user_id FK, `interest`)
- **약관 동의는 별도 엔티티 없이 UserAccount 필드로 저장.**

**`life_assessments`** (LifeAssessment, `BaseCreatedUpdatedEntity`)
- `id`, `user_id`(ManyToOne UserAccount, NN), `event_type`(LifeEventType, NN), `retirement_date`(LocalDate), `resignation_reason`, `next_job_status`, `next_job_start_date`, `employment_insurance_months`(Integer), `current_income_status`, `region_sido`/`region_sigungu`, `monthly_average_wage`(Integer, 원 세전), `age`(Integer 만), `tenure_years`(Integer), 가구/소득/자산/주거 enum, 특성 Boolean 6종, `status`(AssessmentStatus, NN, 기본 `DRAFT`)

**`life_reports`** (LifeReport, `BaseCreatedEntity`)
- `id`, `assessment_id`(OneToOne, NN, **UNIQUE**), `summary_title`(NN,150), `summary_message`(NN,500), `total_priority_score`(int NN), `payment_status`(PaymentStatus NN, 기본 `UNPAID`), `payment_plan`(ReportPlanType nullable), `payment_amount`(Integer), `ai_question_limit`(int NN 기본 0), `ai_question_used_count`(int NN 기본 0), `payment_provider`/`payment_order_id`/`payment_key`/`paid_at`
- `items`: OneToMany ReportItem, CASCADE ALL + orphanRemoval, `@OrderBy sort_order ASC`

**`life_report_items`** (ReportItem, Base 미상속)
- `id`, `report_id`(ManyToOne NN), `procedure_type`(ProcedureType NN), `eligibility_level`(EligibilityLevel NN), `priority_level`(PriorityLevel NN), `title`(NN,150), `reason`(NN,1000), `deadline_text`(200), `official_url`(500), `sort_order`(int NN)
- `requiredDocuments`: OneToMany RequiredDocument, CASCADE ALL + orphanRemoval

**`life_required_documents`** (RequiredDocument, Base 미상속)
- `id`, `report_item_id`(ManyToOne NN), `document_name`(NN,150), `description`(500), `issuer`(150), `is_required`(boolean NN)

**`life_report_chat_messages`** (ReportChatMessage, `BaseCreatedEntity`)
- `id`, `report_id`(ManyToOne NN), `sender_type`(ChatSenderType NN: USER/AI), `content`(NN,2000)

**`gov24_benefit_cache`** (Gov24BenefitCache, Base 미상속)
- `id`, `external_id`(정부24 서비스ID), `title`, `raw_json`(JSON), `content_hash`, `fetched_at`(Instant), `criteria_extracted_at`(Instant)
- 구조화 자격조건: `min_age`/`max_age`(Integer), `min_insurance_months`(Integer), `min_tenure_years`(Integer), `is_involuntary_sub`(Boolean), `max_annual_income_won`(Long), 전용특성 `requires_basic_livelihood`/`requires_near_poverty`/`requires_single_parent`/`requires_disabled`(Boolean)

**`auth_refresh_token_sessions`** (RefreshTokenSession, Base 미상속)
- `token_hash`(PK,64 — refresh 토큰 SHA-256 hex), `user_id`(Long NN, JPA 관계 없음), `expires_at`(Instant NN), index(user_id)

**`oauth_states`** (OAuthState, Base 미상속)
- `state`(PK,64), `provider`(SocialProvider NN), `expires_at`(Instant NN)

**`community_posts`** (CommunityPost, `BaseCreatedUpdatedEntity`)
- `id`, `author_id`(ManyToOne NN), `category`(LifeEventType NN), `title`(NN,120), `content`(NN,3000), `like_count`(int NN 0), `comment_count`(int NN 0)
- `comments`: OneToMany, CASCADE ALL + orphanRemoval, `@OrderBy id ASC`

**`community_comments`** (CommunityComment, `BaseCreatedUpdatedEntity`)
- `id`, `post_id`(ManyToOne NN), `author_id`(ManyToOne NN), `content`(NN,1000)

**`community_post_likes`** (CommunityPostLike, `BaseCreatedEntity`)
- `id`, `post_id`(ManyToOne NN), `user_id`(ManyToOne NN), UNIQUE(`post_id`,`user_id`)

### 6.3 Enum 카탈로그

| Enum | 값 | 비고 |
|------|-----|------|
| `LifeEventType` | RETIREMENT, JOB_CHANGE, UNEMPLOYMENT | 프론트 온보딩은 앞 2개만 노출 |
| `ProcedureType` | UNEMPLOYMENT_BENEFIT(work24), HEALTH_INSURANCE_CONTINUATION(nhis), NATIONAL_PENSION_EXCEPTION(nps), TAX_CHECK(hometax), SEVERANCE_PAY(moel) | 각 상수에 displayName·defaultOfficialUrl 필드 |
| `ReportPlanType` | BASIC(price 6900, aiLimit 0, pdf true), PLUS(price 13900, aiLimit 10, pdf true) | 가격·AI한도·PDF여부 필드 포함 |
| `PaymentStatus` | UNPAID, PAID | |
| `AssessmentStatus` | DRAFT, ANALYZED, PAID | |
| `EligibilityLevel` | HIGH, NEEDS_CHECK, LOW | |
| `PriorityLevel` | HIGH(weight 3), MEDIUM(2), LOW(1) | |
| `ChatSenderType` | USER, AI | |
| `ResignationReason` | CONTRACT_EXPIRED, RECOMMENDED_RESIGNATION, MANDATORY_RETIREMENT, PERSONAL_REASON, FIRED, COMPANY_CLOSURE, UNKNOWN | |
| `NextJobStatus` | CONFIRMED, NOT_CONFIRMED, UNKNOWN | |
| `CurrentIncomeStatus` | NONE, HAS_INCOME, UNKNOWN | |
| `HouseholdType` | UNKNOWN, SINGLE, COUPLE, OTHER, (WITH_CHILDREN†, SUPPORTING_FAMILY† @Deprecated) | 자녀/부양은 Boolean 별도 |
| `AnnualIncomeRange` | UNKNOWN, NONE, UNDER_22M, UNDER_32M, UNDER_44M, UNDER_50M, OVER_50M | |
| `AssetRange` | UNKNOWN, UNDER_240M, OVER_240M | |
| `HousingType` | UNKNOWN, MONTHLY_RENT, JEONSE, OWNED, FAMILY | |
| `PublicBenefitFitLevel` | HIGH, NEEDS_CHECK, LOW | |
| `PublicBenefitPriorityGroup` | TOP_MONEY, DEADLINE, LOCAL, NEEDS_INFO, LOW | |
| `PublicBenefitSourceType` | DB, GOV24_API | |
| `BenefitEstimateKind` | RECEIVE, SAVE_MONTHLY, VARIABLE, NOT_ESTIMATED | 라벨 필드 |
| `DocumentFetchStatus` | FETCHED, ACTION_REQUIRED, UNAVAILABLE | 서류 모의조회 |
| `SocialProvider` | KAKAO(path kakao), NAVER(path naver, clientSecretRequired) | authorize/token/userInfo URI 필드 |
| `AuthNextStep` | TERMS, ONBOARDING, HOME | |
| `TermType` | SERVICE(service/terms/service-terms), PRIVACY(privacy/privacy-policy) | DB 미저장, 조회 API용 |

## 7. 공통 규약 (응답 · 에러 · 보안 · 토큰)

### 7.1 응답 래퍼 `ApiResponse<T>`

```json
{ "isSuccess": true, "code": "COMMON200_1", "message": "성공으로 요청을 처리했습니다.", "result": { } }
```

- 필드: `isSuccess`(Boolean), `code`(String 비즈니스 코드), `message`(String), `result`(T, 실패 시 대부분 null).
- 팩토리: `ApiResponse.of(SuccessCode, result)` / `ApiResponse.onFailure(ErrorCode, result)`.
- **모든 정상 응답의 실제 HTTP는 200.** 컨트롤러가 `ResponseEntity` 없이 `ApiResponse`만 반환하므로 `CREATED`(COMMON201_1)도 HTTP 200 + code만 201로 표기. (예외: OAuth 로그인 시작 302)

### 7.2 성공 코드 (`GeneralSuccessCode`)

| enum | code | message |
|------|------|---------|
| OK | COMMON200_1 | 성공으로 요청을 처리했습니다. |
| CREATED | COMMON201_1 | 리소스가 생성되었습니다. |
| NO_CONTENT | COMMON204_1 | 성공으로 요청을 처리했습니다. |

### 7.3 에러 코드 카탈로그

**`GeneralErrorCode`** (공통)

| enum | HTTP | code | message |
|------|------|------|---------|
| INTERNAL_SERVER_ERROR | 500 | COMMON500_1 | 서버 에러입니다. |
| BAD_REQUEST | 400 | COMMON400_1 | 잘못된 요청입니다. |
| UNAUTHORIZED | 401 | COMMON401_1 | 인증되지 않았습니다. |
| FORBIDDEN | 403 | COMMON403_1 | 접근이 금지되었습니다. |
| NOT_FOUND | 404 | COMMON404_1 | 해당 리소스를 찾을 수 없습니다 |

**`LifeTransitionErrorCode`** (도메인)

| enum | HTTP | code | 용도 |
|------|------|------|------|
| ASSESSMENT_NOT_FOUND | 404 | LIFE404_1 | 진단 없음 |
| REPORT_NOT_FOUND | 404 | LIFE404_2 | 리포트 없음 |
| REPORT_ACCESS_DENIED | 403 | LIFE403_1 | 타인 리포트 |
| PAYMENT_REQUIRED | 403 | LIFE403_2 | 미결제 상세/서류 |
| AI_QUESTION_LIMIT_EXCEEDED | 403 | LIFE403_3 | AI 질문 한도 초과 |
| PLAN_UPGRADE_REQUIRED | 403 | LIFE403_4 | BASIC이 AI/PDF 등 상위기능 접근 |
| ASSESSMENT_ALREADY_PAID | 400 | LIFE400_1 | (정의만) |
| TOSS_PAYMENT_INVALID_REQUEST | 400 | LIFE400_2 | 토스 금액/주문번호 불일치 |
| PAYMENT_PLAN_INVALID_REQUEST | 400 | LIFE400_3 | mock 결제 플랜/금액 검증 |
| TOSS_PAYMENT_CONFIRM_FAILED | 502 | LIFE502_1 | 토스 API 실패 |
| TOSS_PAYMENT_DISABLED | 503 | LIFE503_1 | 토스 설정 off |

- 인증/커뮤니티 전용 ErrorCode enum은 **만들지 않고** `GeneralErrorCode`를 재사용.
- `GeneralExceptionAdvice`(@RestControllerAdvice): `ProjectException`→errorCode.status, `MethodArgumentNotValidException`→400 COMMON400_1(`result`에 "field: msg" 결합), `HttpMessageNotReadableException`→400, 기타→500(로그).

### 7.4 보안 (`SecurityConfig`)

- CSRF/HTTP Basic/Form Login/Logout 비활성, 세션 STATELESS.
- `BearerTokenAuthenticationFilter`를 `UsernamePasswordAuthenticationFilter` 앞에 등록. 토큰이 유효하면 `UsernamePasswordAuthenticationToken(principal=AuthUserPrincipal, authorities=[ROLE_USER])` 설정. **무효/만료 토큰은 예외 없이 통과**시키고, protected 경로는 Security가 401 처리.
- 예외 처리: `ApiAuthenticationEntryPoint`→401(COMMON401_1), `ApiAccessDeniedHandler`→403(COMMON403_1).
- 기본 정책 `anyRequest().authenticated()`.

**permitAll 경로 (정확히 이 목록):**
```
/swagger-ui/**, /swagger-resources/**, /v3/api-docs/**
/api/auth/login/**, /api/auth/callback/**, /api/auth/refresh, /api/auth/logout
/api/terms/**
/api/ai/report-chat
/api/community/**
```
→ 인증 필수 영역: `/api/users/**`, `/api/onboarding/**`, `/api/life/**`.

**CORS**: `lift.cors.allowed-origins`(기본 `http://localhost:3000,http://127.0.0.1:3000`), methods GET/POST/PUT/PATCH/DELETE/OPTIONS, headers `*`, exposed `Authorization`, allowCredentials true, maxAge 3600, `/**`.

**`AuthUserPrincipal`**: record(userId, provider:SocialProvider, nickname, email).

### 7.5 JWT / 토큰

| 프로퍼티 | 기본값 | env |
|----------|--------|-----|
| `lift.auth.jwt-secret` | (빈 값 → 기동 실패) | JWT_SECRET |
| `lift.auth.access-token-ttl` | 1h | AUTH_ACCESS_TOKEN_TTL |
| `lift.auth.refresh-token-ttl` | 14d | AUTH_REFRESH_TOKEN_TTL |

- Access: HS256 JWT. claims `jti`(UUID), `sub`(=UserAccount.authSubject UUID), `iat`, `exp`. 시크릿 **32바이트(256bit) 이상 필수**, 비면 `IllegalStateException`으로 기동 중단.
- Refresh: 32바이트 SecureRandom → URL-safe Base64(no padding). 서버에는 SHA-256 hex를 `auth_refresh_token_sessions`에 저장. `/refresh`는 기존 세션 삭제 후 access+refresh **회전** 발급. `/logout`은 해시로 세션 삭제.

## 8. 기능 명세

각 기능은 요구사항(REQ)과 수용 기준(AC)으로 기술한다. 명시된 상수·문자열·산식은 그대로 구현한다.

### 8.1 REQ-AUTH — 인증

**목적**: 데모 세션(백엔드 미연동)으로 전 기능 체험을 개방하고, 소셜 로그인은 코드를 갖추되 기본 차단한다.

- **REQ-AUTH-1 (데모 로그인)**: 프론트 `startDemoSession()`이 기존 `lift.demo.*` 전부 삭제 후 `localStorage.lift.demoSession="1"`, `lift.accessToken="demo-local-session"`을 설정. 데모 토큰은 JWT가 아니며 API 클라이언트는 이 세션에서 `Authorization` 헤더를 붙이지 않는다.
- **REQ-AUTH-2 (소셜 차단)**: `lift.oauth.social-enabled`(env `OAUTH_SOCIAL_ENABLED`, **기본 false**)가 false면 `GET /api/auth/login/{provider}`, `GET /api/auth/callback/{provider}`가 서비스 진입 즉시 `GeneralErrorCode.FORBIDDEN`(HTTP 403, COMMON403_1)을 던진다. 프론트 소셜 버튼은 실제 이동 없이 안내 문구만 표시: `"지금은 데모 기간이에요. 아래 '데모용 로그인'으로 모든 기능을 체험해 주세요."`
- **REQ-AUTH-3 (소셜 정상 경로)**: `social-enabled=true` + 제공자 client-id/secret/redirect 설정 시에만: `login/{provider}` → OAuth authorize URL로 **302** 리다이렉트(state를 `oauth_states`에 저장), `callback/{provider}?code=&state=` → 코드 교환 → UserAccount upsert → access/refresh JWT 발급(`AuthLoginResDTO`). client-id가 비었고 `lift.oauth.mock-enabled=true`면 개발용 mock 콜백 허용(단, social-enabled 필요).
- **REQ-AUTH-4 (토큰)**: `POST /api/auth/refresh`(회전), `POST /api/auth/logout`(세션 삭제). 둘 다 permitAll.
- **REQ-AUTH-5 (약관)**: `GET /api/terms/{type}` 조회, `POST /api/users/me/agreement` 동의 저장(서비스·개인정보 약관 둘 다 true 필수, 마케팅 선택).

**AC-AUTH-1**: `GET /api/auth/login/kakao` 직접 호출 시 기본 설정에서 HTTP 403(COMMON403_1). (회귀 테스트로 고정)
**AC-AUTH-2**: 소셜 버튼 클릭 시 외부 이동 없이 데모 안내 문구 노출.

### 8.2 REQ-ONBOARDING — 온보딩 / 생애 이벤트

**목적**: 진단 대상 이벤트를 선택하고 약관에 동의한다.

- **REQ-ONB-1**: 선택 가능 이벤트는 `RETIREMENT`, `JOB_CHANGE` 2종만 활성. 결혼/출산휴가는 "준비 중" 배지와 함께 비활성(선택 불가) 카드로 표시. (백엔드 enum에는 `UNEMPLOYMENT`도 존재하나 온보딩에는 미노출)
- **REQ-ONB-2**: 약관 동의 체크 후 다음 단계 진입. 선택 이벤트는 `sessionStorage.lift.eventType`으로 진단 화면에 전달.
- **REQ-ONB-3 (보조 API)**: `POST /api/onboarding/child-profile|interest-region|guardian-profile`를 프로필 보조 저장용으로 구현(핵심 시연 플로우에는 미사용). 각 요청 DTO 검증: child(birthYear 2000–2026, birthMonth 1–12, careAreas @NotEmpty), interest(interests @NotEmpty·최대3, sido/sigungu @NotBlank), guardian(3필드 @NotBlank).

### 8.3 REQ-ASSESSMENT — 진단 입력

**목적**: 리포트 생성에 필요한 상황을 최소 입력으로 수집한다.

- **REQ-ASSESS-1 (입력 필드)**: `POST /api/life/assessments`(`LifeAssessmentCreateReqDTO`).

| 항목 | 필드 | 필수 | 검증 |
|------|------|------|------|
| 생애 이벤트 | `eventType` | 필수 | @NotNull |
| 퇴사(이직) 사유 | `resignationReason` | 필수(UI) | enum |
| 다음 일자리 상태 (+확정 시작일) | `nextJobStatus`(+`nextJobStartDate`) | 필수(UI) | enum |
| 고용보험 가입 개월 | `employmentInsuranceMonths` | 필수(UI) | 0–600 |
| 현재 소득 상태 | `currentIncomeStatus` | 필수(UI) | enum |
| 나이(만) | `age` | 필수(UI) | 0–120 |
| 거주 지역 | `regionSido`/`regionSigungu` | 필수(UI) | 17개 시·도, max 50 |
| 퇴직일 | `retirementDate` | 선택 | LocalDate |
| 근속연수 | `tenureYears` | 선택 | 0–60 |
| 가구/연소득/재산/주거 | 각 enum | 선택 | |
| 특성 토글 6종 | `hasDependentChildren`/`hasSupportingFamily`/`basicLivelihoodRecipient`/`nearPoverty`/`singleParent`/`disabledPerson` | 선택 | Boolean |
| 월 평균임금 | `monthlyAverageWage` | **진단 단계 미수집** | 0–100,000,000 |

- **REQ-ASSESS-2**: 필수 항목이 모두 채워져야 프론트 제출 버튼 활성.
- **REQ-ASSESS-3 (민감정보 분리)**: 월 평균임금은 진단에서 받지 않고 PDF 저장 시점에만 별도 입력(REQ-PDF).
- **REQ-ASSESS-4 (자동 채움)**: 기존 프로필이 있으면 지역·가구·소득·특성 값을 폼에 프리필.
- **REQ-ASSESS-5 (분석)**: `POST /api/life/assessments/{id}/analyze` → 룰 엔진 실행 → 리포트 최초 1회 생성(재실행해도 재생성 안 함) → `ReportPreviewResDTO` 반환. `PATCH /api/life/assessments/{id}`로 `age`/`tenureYears` 보정 가능(공공혜택 재매칭 용도).

생성/응답 DTO: `LifeAssessmentResDTO`(assessmentId, eventType, status, createdAt). status는 DRAFT→ANALYZED→PAID.

### 8.4 REQ-RULE — 룰 엔진 (리포트 절차 판정)

**목적**: AI 없이 결정적으로 절차별 신청 가능성·우선순위를 판정한다. 결과는 최종 수급 판정이 아니며 화면/PDF에 "참고용" 고지를 붙인다.

**REQ-RULE-1 (RuleContext)**: `LifeAssessment`에서 다음 7필드만 파생한다: `eventType`, `resignationReason`, `nextJobStatus`, `employmentInsuranceMonths`, `currentIncomeStatus`, `regionSido`, `regionSigungu`. 파생 메서드: `employmentInsuranceMonthsOrZero()`(null→0), `involvesEmploymentEnd()`(RETIREMENT/UNEMPLOYMENT/JOB_CHANGE 모두 true). age·tenure·소득·월급은 룰 입력에 **미포함**.

**REQ-RULE-2 (엔진)**: `RuleEngineService`는 주입된 4개 룰의 `evaluate(context)`를 모두 수집 → 정렬 → 점수 합산 → `RuleEngineResult(summaryTitle, summaryMessage, totalPriorityScore, items)` 반환. 항목 수는 조건에 따라 **2~5개**(항상 5개 아님).

- **정렬**: ① `priorityLevel.weight` 내림차순 → ② 동점 시 eligibility 순위 오름차순(HIGH=0, NEEDS_CHECK=1, LOW=2).
- **항목 점수**: `priorityLevel.weight + eligibilityBonus`(HIGH +2, NEEDS_CHECK +1, LOW +0). `totalPriorityScore` = 항목 점수 합.
- **eventLabel**: RETIREMENT="퇴직", JOB_CHANGE="이직", UNEMPLOYMENT="실직".
- **summaryTitle**: `"{eventLabel} 후 챙겨야 할 행정 절차 {items.size()}가지"`.
- **summaryMessage**: items 비면 `"입력하신 정보로는 지금 바로 안내드릴 필수 절차가 확인되지 않았습니다. 상황이 바뀌면 다시 진단해 보세요."`; 아니면 `"{eventLabel} 상황에서 놓치기 쉬운 절차 {N}가지를 정리했어요. "` + (eligibility==HIGH 개수>0이면 `"이 중 {H}가지는 신청 가능성이 높으니 마감일을 꼭 확인하세요. "`) + `"가장 급한 항목부터 순서대로 안내해 드립니다."`.

**REQ-RULE-3 (룰 1: 실업급여)** — `UnemploymentBenefitRule`
- 상수: `MIN_INSURANCE_MONTHS=6`, `QUALIFYING_REASONS={CONTRACT_EXPIRED, RECOMMENDED_RESIGNATION, COMPANY_CLOSURE, MANDATORY_RETIREMENT}`.
- 생성 조건: `eventType==RETIREMENT || UNEMPLOYMENT`일 때만 1항목 생성(**JOB_CHANGE는 생성 안 함**).
- eligibility: `insuranceOk = months>=6`, `reasonOk = reason∈QUALIFYING`. `insuranceOk && reasonOk`→HIGH, `insuranceOk`→NEEDS_CHECK, else→LOW.
- priority: **항상 HIGH**. title `"실업급여(구직급여) 신청 검토"`. url work24.
- deadlineText: `"퇴사(이직) 다음 날부터 12개월 이내에 소정급여일수를 모두 받아야 하므로 최대한 빨리 신청하세요."`
- reason(HIGH/NEEDS_CHECK/LOW 3종, LOW는 `"고용보험 가입기간(현재 {months}개월)이 부족해..."`).
- 필요서류 4건(모두 required): 이직확인서(이전 직장/고용센터), 고용보험 피보험자격 이력(근로복지공단), 신분증(본인), 본인 명의 통장(본인).
- `isInvoluntaryReason(reason)`은 공공혜택 매칭에서 재사용(REQ-BENEFIT).

**REQ-RULE-4 (룰 2: 건강보험)** — `HealthInsuranceContinuationRule`
- 생성 조건: `nextJobStatus==NOT_CONFIRMED`일 때만. eligibility 항상 NEEDS_CHECK, priority 항상 MEDIUM. url nhis.
- title `"건강보험 임의계속가입 검토"`, deadline `"지역가입자 최초 보험료 납부기한이 지난 날부터 2개월 이내에 신청해야 합니다."`, 서류 2건(임의계속(가입) 신청서·신분증).

**REQ-RULE-5 (룰 3: 국민연금)** — `NationalPensionExceptionRule`
- 생성 조건: `currentIncomeStatus==NONE`일 때만. eligibility NEEDS_CHECK, priority MEDIUM. url nps.
- title `"국민연금 납부예외 검토"`, 서류 2건(납부예외 신청서·신분증).

**REQ-RULE-6 (룰 4: 퇴직금+세금)** — `TaxAndSeverancePayRule`
- 생성 조건: `involvesEmploymentEnd()`이면 **2항목**(퇴직금, 세금) 생성 → 사실상 모든 이벤트에서 2항목.
- 퇴직금(SEVERANCE_PAY): NEEDS_CHECK, MEDIUM, url moel, deadline `"퇴직일로부터 14일 이내 지급이 원칙..."`, 서류 2건(required=false).
- 세금(TAX_CHECK): NEEDS_CHECK, **LOW**, url hometax, 서류 2건(required=false). 반환 순서 `[퇴직금, 세금]`.

**REQ-RULE-7 (영속화)**: 정렬된 items를 `sort_order` 0,1,2…로 `ReportItem`에 저장, `RuleDocument`→`RequiredDocument` 변환.

**AC-RULE-1**: RETIREMENT + 고용보험 6개월↑ + 비자발 사유 → 실업급여 항목 eligibility HIGH·priority HIGH로 최상단. JOB_CHANGE에는 실업급여 항목 없음.

### 8.5 REQ-ESTIMATE — 예상 금액 계산

**목적**: 항목별 예상 수령/절감액을 범위 또는 정확값으로 산출한다. 항상 "예상치" 고지를 붙인다. `BenefitEstimationService`.

**상수 (그대로 사용)**: `BASIS_YEAR="2026"`, `UNEMPLOYMENT_DAILY_UPPER=68_100`, `UNEMPLOYMENT_DAILY_LOWER=66_048`, `WAGE_REPLACEMENT_RATE=0.60`, `PENSION_RATE=0.09`, `PENSION_MONTHLY_INCOME_CAP=6_370_000`, `HEALTH_EMPLOYEE_RATE=0.03545`, `DAYS_PER_MONTH=30.0`, 범위 반올림 단위 100,000원. `BASIS_NOTE="2026년 기준으로 계산한 예상치예요. 실제 금액은 개인 상황과 관할 기관 판단에 따라 달라질 수 있어요."`

**REQ-EST-1 (소정급여일수 `paymentDays(insuranceMonths, age)`)**: `years=months/12`(정수), `senior=age>=50`.

| 가입 | 일반 | 50세+ |
|------|------|-------|
| <1년 | 120 | 120 |
| 1~<3 | 150 | 180 |
| 3~<5 | 180 | 210 |
| 5~<10 | 210 | 240 |
| ≥10 | 240 | 270 |

**REQ-EST-2 (구직급여일액 클램프)**: `v=round(wage/30.0*0.60)`, `[66048, 68100]`으로 클램프. 총액 = `dailyBenefit × paymentDays`. 실업급여 eligibility==LOW면 금액 미산정(NOT_ESTIMATED). 월급 없으면 `[66048×days ~ 68100×days]` 범위(10만 반올림), kind RECEIVE.

**REQ-EST-3 (퇴직금)**: 월급>0이면 `dailyAvg=round(wage/30)`, `total=dailyAvg×30×tenureYears`. tenure==null 또는 <1 → NOT_ESTIMATED. 월급 없고 `annualIncomeRange` 유효하면 구간 근사(`bounds/12×tenure` 범위). 구간표:

| range | [하한, 상한] 원/년 |
|-------|-------------------|
| UNDER_22M | 12,000,000 ~ 22,000,000 |
| UNDER_32M | 22,000,000 ~ 32,000,000 |
| UNDER_44M | 32,000,000 ~ 44,000,000 |
| UNDER_50M | 44,000,000 ~ 50,000,000 |
| OVER_50M | 50,000,000 ~ 70,000,000 |
| UNKNOWN/NONE | null(미산정) |

**REQ-EST-4 (국민연금 절감, SAVE_MONTHLY)**: wage 없으면 NOT_ESTIMATED. `base=min(wage, 6_370_000)`, `monthly=round(base×0.09)`.
**REQ-EST-5 (건강보험 절감, SAVE_MONTHLY)**: wage 없으면 NOT_ESTIMATED. `monthly=round(wage×0.03545)`.
**REQ-EST-6 (세금, VARIABLE)**: amount null, 환급 안내 문구만.

**REQ-EST-7 (합계·표시)**: RECEIVE→totalReceive, SAVE_MONTHLY→totalMonthlySaving, VARIABLE→hasVariable, NOT_ESTIMATED→미반영. 미리보기 범위(`previewRangeLabel`)는 실업급여·퇴직금만 합산해 `"약 {lo} ~ {hi}"`(같으면 `"약 {hi}"`). 금액 포맷 `won()`: 1만 미만은 콤마+"원", 이상은 "N억 M만원".

**진입점**: `estimate(report)`(진단 월급), `estimateWithMonthlyWage(report, wage)`(PDF 임시), `estimateWithoutMonthlyWage(report)`(월급 무시).

### 8.6 REQ-PREVIEW — 결제 전 미리보기

**목적**: 결제를 유도하되 핵심만 노출한다. `GET /api/life/reports/{id}/preview`(소유 리포트).

- **REQ-PREV-1**: 응답 `ReportPreviewResDTO`: `reportId`, `summaryTitle/Message`, `totalItemCount`, `actionableItemCount`, `expectedAmountRangeLabel`, `paymentStatus`, `locked`(=paymentStatus!=PAID), `highlightItems`(최대 2개: procedureType, procedureName, title, eligibilityLevel, priorityLevel), `ctaMessage`.
- **REQ-PREV-2**: 상세 사유·전체 서류·공식 링크는 결제 후에만 공개.
- **REQ-PREV-3**: 이미 PAID 리포트의 preview URL 접근 시 프론트는 상세 리포트로 리다이렉트.

### 8.7 REQ-PAYMENT — 결제 & 플랜

**목적**: 실돈 없이 게이팅을 구현한다. 운영 PG·정산·환불·영수증·구독은 **구현 금지**.

**플랜(ReportPlanType)**: BASIC(6,900원 / PDF O / AI 0회), PLUS(13,900원 / PDF O / AI 10회). PDF는 BASIC부터, AI 질문만 PLUS 전용.

- **REQ-PAY-1 (데모 결제)**: `POST /api/life/reports/{id}/payments/mock-complete`(`ReportPaymentCompleteReqDTO{plan?, amount?}`). plan null이면 amount로 역추론, 둘 다 없으면 PLUS. 검증 통과 시 즉시 PAID 처리(`markPaid(plan, amount)`), aiQuestionLimit=plan.aiLimit 반영. 플랜/금액 불일치 시 LIFE400_3.
- **REQ-PAY-2 (토스 테스트 결제)**: `POST /api/life/reports/{id}/payments/toss/confirm`(`TossPaymentConfirmReqDTO{paymentKey @NotBlank, orderId @NotBlank, amount @NotNull @Positive}`). orderId는 `LIFT-{reportId}-` 접두사, amount는 플랜 가격과 일치해야 함(불일치 LIFE400_2). 서버가 `TossPaymentClient.confirm()`으로 `{TOSS_BASE_URL}/payments/confirm` 호출 → 승인 응답 재검증 → PAID. `TOSS_PAYMENTS_ENABLED=false`거나 secret 없으면 LIFE503_1. 토스 API 실패 LIFE502_1. **테스트 키이므로 실제 결제 안 됨.**
- **REQ-PAY-3 (게이팅)**: 신청 가능 항목(`actionableItemCount`)이 0이면 프론트 결제 버튼 비활성. 프론트 토스 버튼은 `NEXT_PUBLIC_TOSS_CLIENT_KEY`가 `test_ck_` 접두사일 때만 활성.
- 응답 `ReportPaymentResDTO`: reportId, paymentStatus, assessmentStatus, paymentPlan, paymentAmount, `aiChatAvailable`, `pdfAvailable`.

### 8.8 REQ-REPORT — 상세 리포트 & 접근 게이팅

**목적**: 결제 완료 + 본인 소유만 전체 로드맵을 연다. `GET /api/life/reports/{id}`.

- **REQ-REP-1 (접근 관리자)**: `LifeReportAccessManager`가 4단계를 분리 검증한다.
  - 소유 아님 → LIFE403_1(REPORT_ACCESS_DENIED)
  - 미결제 상세/서류 → LIFE403_2(PAYMENT_REQUIRED)
  - AI 챗: `getAiChatCapableOwnedReport` — `canUseAiChat()`(aiQuestionLimit>0) 실패 시 LIFE403_4(PLAN_UPGRADE_REQUIRED)
  - PDF: `getPdfCapableOwnedReport` — `canUsePdfEstimate()`(pdfAvailable) 검증
- **REQ-REP-2 (응답)**: `LifeReportResDTO`: reportId, assessmentId, summary, totalPriorityScore, paymentStatus/Plan/Amount, `aiChatAvailable`/`pdfAvailable`, `aiQuestionLimit`/`Used`/`Remaining`, `benefitSummary`(totalReceiveAmount, totalMonthlySaving, receiveItemCount, hasVariable, estimated, basisNote), `items[]`(procedure/eligibility/priority/title/reason/deadline/officialUrl/sortOrder/estimate/requiredDocuments), `publicBenefits[]`, `pendingBenefits[]`, `requiredForMatching[]`.
- **REQ-REP-3 (UI)**: 예상 총 수령/월 절감 요약, "지금 바로 시작하세요" 최우선 항목 강조, 우선순위별 절차 카드, 공공혜택 가로 캐러셀, 하단 AI/PDF CTA. BASIC이면 AI 버튼 "확장 리포트에서 이용 가능" 비활성.

**AC-REP-1**: BASIC 결제 후 상세·PDF 열림, AI 챗 POST는 403(LIFE403_4). PLUS 결제 후 AI 가능.

### 8.9 REQ-PDF — PDF 저장 (브라우저 인쇄)

**목적**: 서버 PDF 생성 없이 브라우저 인쇄로 저장한다. `POST /api/life/reports/{id}/pdf-estimate`(`ReportPdfEstimateReqDTO{monthlyAverageWage?}`, 소유+결제+PDF 권한).

- **REQ-PDF-1**: 두 경로 — ① 월 평균임금 입력 저장(실업급여·퇴직금·보험료를 정확값으로 재계산, `estimateWithMonthlyWage`) / ② 월급 없이 저장(범위·산식 중심, `estimateWithoutMonthlyWage`). wage는 저장하지 않음(임시 계산).
- **REQ-PDF-2**: A4 인쇄 전용 CSS(`@page{size:A4;margin:14mm 12mm}`, `.no-print`·앱 셸 숨김, `.pdf-doc`만 표시, `print-color-adjust:exact`)로 화면 UI를 제거하고 `ReportPdfDocument`만 출력. 저장은 `window.print()` → 사용자가 "PDF로 저장" 선택.
- **REQ-PDF-3 (인앱 브라우저)**: 카카오톡/네이버앱/인스타/페이스북/라인 등 WebView를 User-Agent로 감지 → `window.print()` 불가 경고 배너 + "브라우저로 열어 PDF 저장" 버튼(카카오톡 `kakaotalk://web/openExternal`, 안드로이드 Chrome intent, iOS URL 클립보드 복사).

### 8.10 REQ-BENEFIT — 공공혜택 추천 (정부24 캐시)

**목적**: `gov24_benefit_cache`에서 후보를 규칙 기반 매칭·점수화한다(리포트 조회 시 정부24 API 미호출). `Gov24PublicBenefitService.findBenefits(report)`. `GOV24_PUBLIC_SERVICE_ENABLED=false`면 빈 결과.

**REQ-BEN-1 (파이프라인)**:
1. `isAvailable()` 아니면 empty.
2. `isInvoluntary = UnemploymentBenefitRule.isInvoluntaryReason(reason)`.
3. `keywords = buildKeywords(report)`, 상한 `max(1, maxKeywords=5)`.
4. 각 캐시 행: rawJson null skip → `findMatchedKeyword`(없으면 skip) → `regionMismatch` skip → `excludedByStructuredCriteria` skip → 후보화(title 없으면 skip) → `missingStructuredFields` 비면 confirmed(dedupe·고점수 우선), 아니면 pending + requiredForMatching.
5. confirmed를 score 내림차순, `max(15, maxResults)` 상한, 긴 필드 1200자 트림 → preRanked.
6. `recommend(report, preRanked)` → `max(1, maxResults=6)` 상한.
7. `BenefitRecommendationResult(ranked, pending, requiredForMatching)`.

**REQ-BEN-2 (키워드)**: eventType 기본(RETIREMENT: 실업급여·구직급여·퇴직·재취업·직업훈련·생활안정 / UNEMPLOYMENT: 실업·구직·국민취업지원·직업훈련·긴급복지·생활안정 / JOB_CHANGE: 이직·재취업·취업·직업훈련·내일배움·고용) + procedureType별 추가(실업급여→구직·고용보험, 건강보험→건강보험·보험료, 국민연금→국민연금·납부예외, 세금→근로장려금·소득세, 퇴직금→체불·임금) + regionSigungu/regionSido. LinkedHashSet(중복제거·순서유지).

**REQ-BEN-3 (지역 판정)**: 소관기관명이 `SIDO_NAMES`(17개 시·도 정식명칭) 중 하나로 시작하면 지역 전용으로 보고 사용자 시/도와 대조(startsWith 양방향). 시/군/구까지 명시되면 추가 대조. 기관명 없거나 중앙부처·공단은 전국으로 간주(제외 안 함). 사용자 시/도 미입력이면 제외 안 함.

**REQ-BEN-4 (구조화 필터)**: 사용자 값이 있을 때만 배제(null은 통과=pending 가능). age<minAge / age>maxAge / tenure<minTenure / insuranceMonths<minInsurance / (isInvoluntarySub && !isInvoluntary) / 연소득하한>maxAnnualIncome / requires* 특성을 사용자가 명시적 false로 답한 경우(near_poverty는 near_poverty=false AND basic=false). **차상위 전용은 기초수급자도 포함.**

**REQ-BEN-5 (점수 `score()`)**: verifiedMatch +50, title에 키워드 +40, merged에 키워드 +20, sigungu +24 / (아니면) sido +14, applicationUrl +6, 취업군 키워드 +10, 소득상태+저소득텍스트 +8, 자녀+자녀텍스트 +10, 기초/차상위/한부모/장애 매칭 각 +14/+12/+12/+12, 소득상한 여유 +8, 주거텍스트 +8, 마감(상시/수시 아님) +8 (상시/수시 +4). `hasVerifiedStructuredMatch`가 하나라도 참이면 verifiedMatch(+50).

**REQ-BEN-6 (fitLevel/priorityGroup)**: fitLevel: 제외성 키워드+score<70→NEEDS_CHECK, score≥78→HIGH, ≥42→NEEDS_CHECK, else LOW. priorityGroup: LOW면 LOW / 마감 있음→DEADLINE / 금전 키워드→TOP_MONEY / 지역 매칭→LOCAL / else NEEDS_INFO.

**REQ-BEN-7 (pending)**: `missingStructuredFields`는 오직 2필드 검사 — (minAge||maxAge 존재 && age null)→"age", (minTenure>0 && tenure null)→"tenureYears". 부족 시 배제하지 않고 pendingBenefits + requiredForMatching으로 분리.

**응답 `PublicBenefitResDTO`**: title, summary, provider, category, applicationUrl, sourceId, matchedKeyword, reason, sourceLabel, sourceType, fitLevel, priorityGroup, supportTarget, selectionCriteria, supportContent, applicationMethod, applicationDeadline, contact, requiredDocuments[], missingInputs[], aiSummary, relevanceScore.

### 8.10.1 REQ-BENEFIT-AI — AI 재랭킹/요약

**목적**: OpenAI 활성 시에만 후보를 재정렬·요약한다(비활성/실패 시 점수순 폴백). `PublicBenefitRecommendationService.recommend()`.

- **REQ-BENAI-1**: `!openAi.isAvailable()` 또는 fallback 비면 heuristic(relevanceScore 내림차순) 반환.
- **REQ-BENAI-2**: 활성 시 `{OPENAI_BASE_URL}/responses`(connect 15s/read 90s, model 기본 `gpt-5.4-mini`, reasoning effort low)에 `{assessment, candidates}` 전송, 구조화 JSON 스키마(recommendations maxItems 8: sourceId, title, fitLevel, priorityGroup, reason≤120, aiSummary≤180, missingInputs≤5, relevanceScore 0–200)만 허용. system 프롬프트: 수급 확정 금지·후보 JSON 범위 내에서만·금액/조건 신규 생성 금지.
- **REQ-BENAI-3**: AI 결과를 sourceId(우선)/title로 원본에 매핑해 필드 갱신(relevanceScore≤0이면 원본 유지), AI에 없던 항목은 뒤에 append. 실패·예외 시 heuristic 폴백(aiSummary 없음).

### 8.10.2 REQ-BENEFIT-SYNC — 정부24 자동 동기화 (기본 off)

**목적**: 캐시 테이블을 채우는 스케줄러. `GOV24_SYNC_ENABLED=true`일 때만 빈 등록(`@ConditionalOnProperty`).

- **REQ-SYNC-1**: `LiftApplication`에 `@EnableScheduling`. 켜지면 cron(기본 `0 0 9 * * *`)에: ① 정부24 serviceList 조회(`Gov24CatalogClient`) → ② 원문(서비스명·지원대상·선정기준·지원내용) MD5 `content_hash` → ③ externalId 기준 UPSERT(신규 INSERT / 해시 변경 UPDATE / 동일 skip) → ④ `criteria_extracted_at IS NULL` 행만 AI로 자격조건(나이·가입기간·근속·비자발성·소득상한·전용특성 4종) 구조화 추출.
- **REQ-SYNC-2**: AI 추출은 신규/변경 건에만, 배치 상한 `GOV24_SYNC_EXTRACT_BATCH_SIZE=200`, 시스템적 실패(크레딧 부족 등) 시 첫 실패에서 중단해 과금 방지.
- 기본 off이므로 그대로 실행 시 스케줄러 미동작, 추천은 시드/기존 캐시만 사용.

### 8.11 REQ-AICHAT — 리포트 기반 AI 질문 (PLUS 전용)

**목적**: PLUS 결제 리포트에서 리포트 근거 Q&A. `POST|GET /api/life/reports/{id}/chat/messages`. `LifeReportChatService`.

- **REQ-CHAT-1**: PLUS만 사용(BASIC → LIFE403_4). 한도 10회, 질문 1건당 1회 차감, 초과 시 LIFE403_3(AI_QUESTION_LIMIT_EXCEEDED). 메시지는 리포트별로 `ReportChatMessage`에 저장(USER/AI).
- **REQ-CHAT-2**: OpenAI 활성 시 `OpenAiLifeReportAiService`, 비활성 시 `MockLifeReportAiService`(리포트 내용·예상 금액 근거 결정적 폴백). 요청 `ReportChatMessageCreateReqDTO{content @NotBlank max 2000}`.
- **REQ-CHAT-3**: 응답에 남은 횟수(aiQuestionLimit/Used/Remaining) 포함. AI 답변은 법률·노무 자문을 대체하지 않는다는 고지.
- 진입 보조: `GET /api/life/reports/latest-chat-target`(최신 PLUS 리포트), `latest-route-target`(라우팅).

**AC-CHAT-1**: PLUS에서 10회까지 허용, 11번째 403(LIFE403_3).

### 8.12 REQ-DEMO — 데모 모드 (프론트 로컬 구현)

**목적**: 백엔드 없이 진단→결제→리포트→PDF 전 과정을 localStorage로 재현한다. 백엔드 규칙과 **동일한 매칭 로직**을 프론트에 미러링. `frontend/src/lib/demo.ts`.

- **REQ-DEMO-1 (분기)**: `isDemoSession()`이면 진단/분석/미리보기/결제/리포트/PDF/서류/프로필 API가 `demoApi`(localStorage)로 분기. localStorage 키: `lift.demo.profile`, `lift.demo.assessment`(PDF 재계산용 원본), `lift.demo.assessmentInputs`(매칭용), `lift.demo.report`(최신 1건), `lift.demo.chat`.
- **REQ-DEMO-2 (예외 — 항상 백엔드)**: 커뮤니티 전체와 데모 AI 챗은 데모 세션에서도 백엔드 호출(인증 헤더 없이). 데모 AI 질문은 `POST /api/ai/report-chat`(permitAll)에 `{question, report}` 전송 → 서버 OpenAI(키 서버 보관), 꺼지면 리포트 요약 폴백. 질문 최대 2000자(`DemoReportChatReqDTO @Size`). 응답 `{answer, aiPowered}`.
- **REQ-DEMO-3 (게이팅 동일)**: BASIC→PDF O·AI X, PLUS→AI 10회.
- **REQ-DEMO-4 (데모 카탈로그)**: 목업 15건 고정 + 사용자 시/도로 지역 전용 2건 즉석 생성. 매칭 순서(키워드→지역→전용특성→고용보험기간→비자발→나이→점수정렬)를 백엔드와 동일하게 재현. 나이 범위 있는데 age null이면 pending.
  - 15건: 실업급여, 국민취업지원(15~69), 국민내일배움카드(15~75), 조기재취업수당, 청년 일자리 도약장려금(15~34), 긴급복지 생계지원, 노인 일자리(60+), 노인 보청기(65+·near_poverty), 신중년 경력형 일자리(50~64), 중장년내일센터(40+), 주거급여(near_poverty), 장애인 취업성공패키지(18~69·disabled), 저소득 한부모가족 생활안정(single_parent), 기초생활 생계급여(basic_livelihood), 자활근로(near_poverty).
  - 지역 2건: `{shortName} 긴급복지지원`(baseScore 79), `{shortName} 지역맞춤 일자리사업`(baseScore 71). `shortName`=시/도 접미사 제거.
- **REQ-DEMO-5 (한계 고지)**: 데모 카탈로그는 시연용 축약본(백엔드 캐시 100여 건과 데이터량 다름), 지역 항목은 템플릿 삽입 예시(실제 제도명과 다를 수 있음) → 카드에 "데모" 출처 라벨.

**AC-DEMO-1**: 진단 입력(지역·나이·특성)을 바꾸면 후보 개수·구성이 달라진다(예: 지역 변경 시 해당 시·도명 지역 항목 노출, 30세↔55세에 청년/중장년 교체).

### 8.13 REQ-DOCS — 필요 서류 모의 조회

**목적**: 실제 발급 없이 서류 조회 UX를 재현. `POST /api/life/reports/{id}/documents/fetch`(소유+결제), `LifeDocumentFetchService`.

- **REQ-DOCS-1**: 프론트 본인인증 모달(`IdentityVerifyModal`, 데모 UI: 통신사→SMS(데모 코드 123456, 180s)→동의→완료, 실제 통신 없음) 완료 후 서류 조회 트리거(`localStorage.lift.identityVerified`).
- **REQ-DOCS-2**: 서버가 발급기관 문자열 기준으로 자동조회 가능/직접 준비를 분류(`DocumentFetchStatus`), 자동조회 가능 서류에 모의 다운로드 링크 제공. 응답 `DocumentFetchResDTO`(totalCount, autoFetchedCount, items[]). `/documents/mock` 페이지가 목업 서류 HTML 미리보기.
- 실제 본인인증·마이데이터·전자문서지갑 연동은 **구현 금지**.

### 8.14 REQ-COMMUNITY — 커뮤니티 (공유 게시판)

**목적**: 데모 세션에서도 실제 백엔드를 공유하는 퇴직/이직 게시판. `/api/community/**`(permitAll, 인증 선택).

- **REQ-COMM-1**: 비로그인/데모 요청은 서버가 공유 데모 계정으로 귀속(`resolveUser`). 작성자 표시는 항상 "익명".
- **REQ-COMM-2 (엔드포인트)**: 목록 `GET /posts`(category? LifeEventType, size? 기본30 max50), 인기 `GET /posts/popular`, 상세 `GET /posts/{id}`, 작성 `POST /posts`(category @NotNull, title ≤120, content ≤3000), 삭제 `DELETE /posts/{id}`(본인만, 아니면 403), 좋아요 `POST|DELETE /posts/{id}/likes`(UNIQUE 제약), 댓글 `POST /posts/{id}/comments`(content ≤1000)·`DELETE /posts/{id}/comments/{commentId}`(본인만).
- 응답: summary(postId, category, title, contentPreview, authorName="익명", likeCount, commentCount, liked, mine, createdAt), detail(+content+comments).
- 검색·신고·차단·관리자·알림·이미지 첨부는 **구현 금지**.

### 8.15 REQ-USER — 내 정보

**목적**: 프로필 조회·수정·탈퇴. `/api/users/me/**`(인증 필수).

- **REQ-USER-1**: `GET /summary`(userId, nickname, email, provider, agreementCompleted, onboardingCompleted), `GET /profile`·`PATCH /profile`(닉네임/지역/가구·소득·자산·주거/특성 6종, null=미변경), `GET /onboarding-status`, `POST /agreement`, `DELETE /`(탈퇴 → withdrawn).
- **REQ-USER-2**: 프로필은 진단 폼 자동 채움에 사용. 데모 세션에서는 localStorage로 처리.

## 9. API 전체 목록

**인증/약관/사용자**
- `GET /api/auth/login/{provider}`(302, 기본 403) · `GET /api/auth/callback/{provider}`(기본 403) · `POST /api/auth/refresh` · `POST /api/auth/logout`
- `GET /api/terms/{type}`
- `GET /api/users/me/summary` · `GET|PATCH /api/users/me/profile` · `GET /api/users/me/onboarding-status` · `POST /api/users/me/agreement` · `DELETE /api/users/me`
- `POST /api/onboarding/child-profile|interest-region|guardian-profile`

**진단/리포트**
- `POST /api/life/assessments` · `POST /api/life/assessments/{id}/analyze` · `PATCH /api/life/assessments/{id}`
- `GET /api/life/reports/{id}/preview` · `GET /api/life/reports/{id}`
- `POST /api/life/reports/{id}/payments/mock-complete` · `POST /api/life/reports/{id}/payments/toss/confirm`
- `POST /api/life/reports/{id}/pdf-estimate` · `POST /api/life/reports/{id}/documents/fetch`
- `POST|GET /api/life/reports/{id}/chat/messages`
- `GET /api/life/reports/latest-chat-target` · `GET /api/life/reports/latest-route-target`

**데모 AI 챗(무인증)**: `POST /api/ai/report-chat`

**커뮤니티**: `GET /api/community/posts` · `/posts/popular` · `GET /posts/{id}` · `POST /posts` · `DELETE /posts/{id}` · `POST|DELETE /posts/{id}/likes` · `POST /posts/{id}/comments` · `DELETE /posts/{id}/comments/{commentId}`

## 10. 환경변수 & 기능 플래그 (기본값)

| 키 | 기본값 | 효과 |
|----|--------|------|
| `JWT_SECRET` | (빈 값→기동 실패) | HS256 시크릿, 32바이트 이상 필수 |
| `AUTH_ACCESS_TOKEN_TTL` / `AUTH_REFRESH_TOKEN_TTL` | 1h / 14d | 토큰 수명 |
| `OAUTH_SOCIAL_ENABLED` | **false** | false면 소셜 로그인·콜백 403. 데모만 |
| `OAUTH_MOCK_ENABLED` | false (로컬 프로파일은 true) | 개발용 mock 콜백(social-enabled 필요) |
| `KAKAO_*` / `NAVER_*` | 빈 값 | 소셜 자격증명 |
| `GOV24_PUBLIC_SERVICE_ENABLED` | false | true면 리포트에 공공혜택 캐시 추천 포함 |
| `GOV24_PUBLIC_SERVICE_KEY` / `_BASE_URL` / `_PER_PAGE`(1000) / `_MAX_PAGES`(2) / `_MAX_KEYWORDS`(5) / `_MAX_RESULTS`(6) | — | 정부24 조회·매칭 파라미터 |
| `GOV24_SYNC_ENABLED` | **false** | true일 때만 동기화 스케줄러 빈 등록 |
| `GOV24_SYNC_CRON` / `GOV24_SYNC_EXTRACT_BATCH_SIZE` | `0 0 9 * * *` / 200 | 동기화 시각·AI 추출 배치 상한 |
| `OPENAI_ENABLED` + `OPENAI_API_KEY` | false | true면 실 LLM(챗·재랭킹·추출). false여도 전 기능 폴백 |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | api.openai.com/v1 / `gpt-5.4-mini` | |
| `TOSS_PAYMENTS_ENABLED` + `TOSS_SECRET_KEY` | false | 토스 테스트 승인 API 활성 |
| `TOSS_BASE_URL` | api.tosspayments.com/v1 | |
| `LIFT_BASE_URL` / `LIFT_FRONTEND_BASE_URL` / `LIFT_CORS_ALLOWED_ORIGINS` | localhost 기본 | |
| `SPRING_DATASOURCE_URL` 등 | — | 운영 PostgreSQL 연결(설정 시 시드 자동 실행 안 됨) |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | 프론트 API base |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 빈 값 | `test_ck_` 접두사일 때만 프론트 토스 버튼 활성 |

- 로컬 프로파일(`application-local.properties`)은 H2 인메모리 + `data.sql` 시드를 쓰고, `jwt-secret`·`mock-enabled=true`를 설정한다. `spring.jpa.defer-datasource-initialization=true`로 테이블 생성 후 시드 주입.

## 11. 프론트 화면 명세 (19개 page.tsx)

| 경로 | 역할 | 주요 API |
|------|------|----------|
| `/` | 로그인/리포트 상태 라우팅 허브 | `latest-route-target` |
| `/login` | 랜딩·데모 로그인(소셜 UI만) | `startDemoSession()` 로컬 |
| `/login/callback/{provider}` | OAuth 콜백 코드 교환 | `callback/{provider}`, `latest-route-target` |
| `/onboarding/life-event` | 퇴직/이직 선택·약관 | `POST /users/me/agreement` |
| `/assessment/new` | 진단 입력→분석 | `GET /users/me/profile`, `POST /assessments`, `.../analyze` |
| `/report/{id}/preview` | 잠금 미리보기·결제 CTA | `GET .../preview` |
| `/checkout` | 플랜 선택·결제 | `GET .../preview`, `mock-complete`, 토스 SDK |
| `/checkout/toss/success` | 토스 승인 | `toss/confirm` |
| `/checkout/toss/fail` | 토스 실패 안내 | — |
| `/report/{id}` | 유료 로드맵·공공혜택·서류 | `GET .../reports/{id}`, `PATCH assessment`, `documents/fetch` |
| `/report/{id}/chat` | AI Q&A(PLUS) | `GET|POST .../chat/messages` |
| `/report/{id}/pdf` | PDF 저장 화면 | `pdf-estimate` |
| `/chat` | AI 챗 진입 | `latest-chat-target` |
| `/community` | 목록·글쓰기·좋아요 | community posts/likes |
| `/community/{id}` | 상세·댓글 | posts/{id}, comments, likes |
| `/my` | 프로필·로드맵 재생성(wide) | `GET|PATCH /users/me/profile`, assessments |
| `/documents/mock` | 목업 서류 HTML | 쿼리만 |
| `/terms` · `/privacy` | 정적 약관/개인정보 | — |

- 컴포넌트: `AppShell`(모바일 480/wide 1120), `AuthGuard`, `Badges`, `DateField`, `MonthStepper`, `OptionSelector`, `RegionField`, `TogglePill`, `IdentityVerifyModal`, `ReportPdfDocument`, `Icons`.
- `lib`: `api.ts`(REST·데모 분기·401→`/login?expired=1`), `auth.ts`, `demo.ts`, `types.ts`(백엔드 1:1), `labels.ts`, `assessmentOptions.ts`, `regions.ts`(17시도 하위 시군구).

## 12. 시드 데이터

- `src/main/resources/data.sql`: H2 로컬 전용. `gov24_benefit_cache` **INSERT 101건**(정부24 원문 + 일부 구조화 자격조건 UPDATE 포함). 운영 PostgreSQL에서는 자동 실행되지 않는다(`defer-datasource-initialization` + 임베디드 DB 조건).
- 약관 콘텐츠는 정적(`TermType`/`TermsService`), DB 미저장.

## 13. 배포

- 백엔드: `Dockerfile` + `render.yaml`(Render). 운영 DB는 `SPRING_DATASOURCE_*`로 PostgreSQL(Supabase 등).
- 프론트: `netlify.toml` + `@netlify/plugin-nextjs`.
- 운영 필수 env: `JWT_SECRET`(32B+), DB 접속 정보, (선택) `OPENAI_*`/`TOSS_*`/`GOV24_*`.

## 14. 수용 기준 (완료 판정)

**AC-E2E-1**: 데모 로그인 → 퇴직 선택 → 필수 입력 → 미리보기 → 데모 결제 → 상세 리포트가 로그인부터 3분 내 가능.
**AC-E2E-2**: 소셜 버튼 클릭 시 외부 이동 없이 데모 안내. `GET /api/auth/login/kakao` 직접 호출 시 403.
**AC-E2E-3**: BASIC(6,900) 결제 후 PDF 화면 열림, AI 챗 API 403(LIFE403_4).
**AC-E2E-4**: PLUS(13,900) 결제 후 AI 질문 가능, 10회 초과 시 403(LIFE403_3).
**AC-E2E-5**: 진단 입력(지역·나이·특성) 변경 시 데모 공공혜택 후보 개수·구성 변화.
**AC-E2E-6**: PDF 화면 월급 입력/미입력 두 경로 동작, 인앱 브라우저 UA에서 외부 브라우저 안내.
**AC-E2E-7**: 커뮤니티 글 작성·댓글·좋아요·본인 글 삭제 동작.
**AC-E2E-8**: `OPENAI_ENABLED=false`에서도 AC-E2E-1~7 전부 동작(AI 답변은 폴백).

**테스트 요구**: 백엔드 통합/단위 테스트 **43개** 이상 통과(`./gradlew test`) — 소셜 차단 403, 진단→리포트, 플랜 게이팅(BASIC PDF 허용·AI 차단), AI 질문 10회 제한, 토스 금액 검증, 커뮤니티 흐름, 룰 엔진, 사용자 프로필. 프론트 `next build`(타입체크) 통과. 대표 테스트명: `기본리포트는_상세와_PDF가_열리고_AI는_확장리포트에서만_가능하다`, `AI질문은_10회까지만_허용되고_초과시_403이다`.

## 15. 향후 확장 (현재 스코프 밖)

- 정부24 동기화 상시 가동 + 관리자 검수 화면
- 실제 본인인증·공공 마이데이터 서류 발급 연동
- 결혼·출산휴가 등 생애 이벤트 확대, 신청 기한 캘린더/알림
- 운영 결제(승인·취소·환불·영수증) 및 플랜 만료 정책
- 커뮤니티 검색·신고·관리 도구

## 16. 표현 가이드 (심사·발표)

권장: "퇴직/이직 시 놓치기 쉬운 절차를 우선순위 리포트로 정리", "자격을 확정하지 않고 신청 가능성/확인 항목 안내", "공공혜택은 캐시 DB를 규칙 엔진으로 매칭하고 OpenAI가 켜진 환경에서만 재랭킹·요약 보조", "서류 조회·본인인증은 모의 구현(실연동 교체 가능하게 분리)", "데모 기간 소셜 로그인은 서버 차원 차단".

금지(코드와 불일치): "AI가 수급 여부 확정", "정부24 실시간 신청/조회", "공공 서류 실제 발급", "운영 결제 완성", "모든 생애 이벤트 지원".










