# [PRD] LIFT 프로젝트 로컬 개발 환경 구축 및 구동 요구사항 정의서

- 문서 버전: v1.1
- 작성일: 2026-07-07 (v1.1 갱신: 2026-07-07, 실제 E2E 구동 테스트 완료)
- 대상 OS: Windows 11 (PowerShell 기준)
- 검증 환경: 작성 시점에 실제 로컬 머신에서 아래 절차를 1회 실행하여 확인함

## 1. 목적 (Purpose)

외부 저장소(`https://github.com/GyeungUk/LIFT.git`)로부터 클론 받은 LIFT 프로젝트 모노레포(Java Spring Boot 백엔드 + Next.js 프론트엔드)를 개발자의 로컬 Windows 시스템에서, 운영 환경(Supabase/PostgreSQL 등 실제 DB·외부 API)을 건드리지 않고 독립적으로 빌드·구동하기 위한 기술 요구사항과 실행 절차를 정의한다.

## 2. 시스템 요구사항 (System Requirements)

### 2.1. 개발 스택 및 버전 (실제 저장소 기준 확인값)

| 항목 | 버전/값 | 근거 |
|---|---|---|
| Backend 언어 | Java 21 (toolchain 고정) | `build.gradle`의 `JavaLanguageVersion.of(21)` |
| Backend 프레임워크 | Spring Boot 4.1.0 | `build.gradle` |
| 빌드 도구 | Gradle 9.5.1 (Wrapper로 자동 다운로드) | `gradle/wrapper/gradle-wrapper.properties` |
| Frontend 프레임워크 | Next.js 15.5.20 / React 19 | `frontend/package.json` |
| Node.js / npm | 로컬 확인값 v24.18.0 / 11.16.0 | 로컬 머신 실측 |
| 로컬 DB | H2 인메모리 (`local` 프로파일 시 자동 적용) | `application-local.properties` |
| 영구 DB(운영용, 로컬 미사용) | PostgreSQL | `build.gradle`의 `runtimeOnly 'org.postgresql:postgresql'` |

### 2.2. 사전 준비 체크리스트

- [ ] JDK 21 확보 — 별도 설치가 필요 없을 수 있음. `JAVA_HOME`이 JDK 21을 가리키면 Gradle Wrapper가 이를 그대로 사용한다(`gradlew.bat`는 `java`가 PATH에 없어도 `JAVA_HOME`만으로 동작 확인됨). 확인 명령:
  ```powershell
  $env:JAVA_HOME
  & "$env:JAVA_HOME\bin\java.exe" -version
  ```
  `JAVA_HOME`이 비어있거나 21 미만이면 JDK 21(Temurin 등)을 설치하고 `JAVA_HOME`을 갱신한다.
- [ ] Node.js 18.18+ (권장 20+) 및 npm 설치 확인: `node -v`, `npm -v`
- [ ] Git 설치 확인 및 저장소 클론 완료 여부

### 2.3. 백엔드 환경 변수 (선택/보강 성격)

`local` 프로파일 사용 시 아래 값은 `src/main/resources/application-local.properties`에 이미 기본값으로 박혀 있다. 따라서 환경 변수 주입은 **필수가 아니라 명시적 재확인용**이며, CI나 다른 셸에서 재현성을 보장하고 싶을 때 선언한다.

| 변수명 | 권장 값 | 설명 |
|---|---|---|
| `OAUTH_MOCK_ENABLED` | `true` | 카카오/네이버 실제 API 호출 대신 모의 로그인 사용 (local 프로파일 기본값도 `true`) |
| `JWT_SECRET` | `local-development-jwt-secret-32-bytes-minimum` | 최소 32바이트 더미 시크릿 (local 프로파일 기본값과 동일) |

**외부 연동 키 (선택, 실 사용 시에만 필요)**

`application.properties`가 `OPENAI_API_KEY`, `GOV24_PUBLIC_SERVICE_KEY` 등을 OS 환경변수에서 직접 읽는다. **Spring Boot는 루트 `.env` 파일을 자동 로드하지 않으므로**, 루트 `.env`에 값을 적어두는 것만으로는 동작하지 않고 반드시 실행 전에 프로세스 환경변수로 주입해야 한다. 이 저장소에서는 [scripts/run-backend.ps1](../scripts/run-backend.ps1)이 `.env`를 파싱해 환경변수로 주입한 뒤 `gradlew.bat bootRun`을 실행하도록 만들어져 있다.

| 변수명 | 설명 |
|---|---|
| `OPENAI_ENABLED` / `OPENAI_API_KEY` | AI 챗봇(`/api/life/reports/{id}/chat/messages`) 응답 생성에 사용. `false`/빈 값이면 해당 기능은 500 에러 없이 아예 호출하지 않는 흐름(챗봇 UI 노출 안 함) |
| `GOV24_PUBLIC_SERVICE_ENABLED` / `GOV24_PUBLIC_SERVICE_KEY` | 공공데이터포털 gov24 혜택 후보 조회에 사용 |

`.env`는 `.gitignore`에 의해 커밋되지 않는다 (`.env`, `.env.*` 패턴, `.env.example`만 예외).

## 3. 기능적 요구사항 및 실행 절차 (Functional Requirements)

### 3.1. [요구사항 01] 소스코드 위치

이미 `C:\Users\7jaem\LIFT`에 클론이 완료된 상태이므로 재클론은 불필요하다. 신규로 진행할 경우:

```powershell
git clone https://github.com/GyeungUk/LIFT.git C:\Users\7jaem\LIFT
```

### 3.2. [요구사항 02] 백엔드(Spring Boot) 서버 가동

기본 `application.properties`는 `SPRING_DATASOURCE_URL` 등이 비어 있는 운영/기본 프로파일이므로, 반드시 `local` 프로파일을 지정해 H2 인메모리 DB로 기동해야 한다.

```powershell
cd C:\Users\7jaem\LIFT
$env:OAUTH_MOCK_ENABLED = "true"
$env:JWT_SECRET = "local-development-jwt-secret-32-bytes-minimum"
.\gradlew.bat bootRun --args="--spring.profiles.active=local"
```

- **완료 조건**: 콘솔에 `Started ...Application` (Tomcat, port 8080) 로그 출력
- **부가 확인**: Swagger UI `http://localhost:8080/swagger-ui/index.html` 접속 가능

### 3.3. [요구사항 03] 프론트엔드(Next.js) 서버 가동

백엔드와 별도의 터미널 세션에서 실행한다.

```powershell
cd C:\Users\7jaem\LIFT\frontend
npm install
npm run dev
```

- **완료 조건**: `http://localhost:3000` 접속 성공, 로그인 화면에서 모의(mock) 로그인 동작
- **참고**: 현재 저장소에는 `.env.local.example` 파일이 존재하지 않는다. `frontend/src/lib/api.ts`의 `NEXT_PUBLIC_API_BASE_URL` 기본값이 `http://localhost:8080`이므로 별도 `.env.local` 없이도 기본 동작에는 문제가 없다. 토스페이먼츠 테스트 결제 등 선택 기능을 쓸 경우에만 `frontend/.env.local`에 `NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...`를 추가한다.

### 3.4. [요구사항 04] 종료 절차

```powershell
# 각 터미널에서 Ctrl + C
# 또는 포트로 강제 종료
Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

## 4. 제약 사항 및 보안 가드레일 (Constraints & Security)

- **운영 DB 격리**: `local` 프로파일 사용 시 `spring.datasource.url`이 `jdbc:h2:mem:lift`로 강제 오버라이드되므로, 루트 `.env`에 실제 Supabase/PostgreSQL 접속 정보가 설정되어 있어도 로컬 실행에는 영향을 주지 않는다. 데이터는 프로세스 종료 시 휘발된다.
- **외부 연동 기본 비활성화**: 공공데이터(Gov24), 토스페이먼츠, OpenAI 연동은 모두 `enabled=false`가 기본값이라 별도 키 없이도 로컬 MVP 흐름(회원가입~진단~리포트) 실행에 지장이 없다.
- **형상 관리 가이드**: `main` 브랜치 직접 수정 금지. 로컬 작업은 `feature/작업명` 브랜치에서 진행 후 GitHub PR을 거쳐 병합한다.

```powershell
git checkout -b feature/작업명
```

## 5. 검증 완료 항목 (Verified on this machine)

| 항목 | 결과 |
|---|---|
| `JAVA_HOME` → JDK 21 인식 | OK (Microsoft OpenJDK 21.0.10) |
| `gradlew.bat -v` 실행 | OK (Gradle 9.5.1, Launcher JVM 21.0.10) |
| Node/npm 버전 | v24.18.0 / 11.16.0, 요구사항 충족 |
| 저장소 클론 위치 | `C:\Users\7jaem\LIFT` (완료) |
| `gradlew.bat bootRun --args="--spring.profiles.active=local"` 전체 기동 | OK — `Started LiftApplication`, Tomcat 8080, H2(`jdbc:h2:mem:lift`) 연결 확인, 에러 없음 |
| `npm install` / `npm run dev` | OK — 44초 내 설치 완료, `Ready in 3.4s`로 3000 포트 기동 |
| 프론트 랜딩 → 데모 로그인 → 진단 폼 → 로드맵 리포트 | OK — 브라우저 자동화로 실제 클릭/입력 진행, 콘솔 에러 없음 |
| 실 API E2E: 모의 로그인 → 약관동의 → 진단 생성 → 분석 → mock 결제 → AI 챗 | OK — curl로 전 구간 200 응답 확인 (`docs/PRD-로컬-실행-환경-구축.md` 작성 시점 기준 assessmentId=1, reportId=1) |
| OpenAI 키 유효성 | OK — `GET https://api.openai.com/v1/models` 200, 백엔드를 통한 실제 챗 응답 생성도 확인. 단 **첫 호출에서 `SocketTimeoutException`으로 1회 실패**했고 재시도 시 정상 응답(약 5초) — JDK 기본 `HttpURLConnection` 기반 클라이언트의 콜드스타트 특성으로 추정, 재현되면 재시도 또는 커넥션 타임아웃 설정 상향 검토 필요 |
| GOV24 공공데이터 키 유효성 | OK — 직접 호출 200 OK, 백엔드를 통한 실사용도 확인. `Gov24PublicBenefitService.findBenefits`는 `POST /analyze`가 아니라 **결제 후 `GET /api/life/reports/{id}` 상세 조회 시점**에 호출됨(`LifeReportService.getDetail`) — 실제로 이 엔드포인트를 호출해 gov24 외부 API 연동 및 응답 파싱까지 정상 동작 확인 |

## 6. 미해결/추가 확인 필요 항목 (Open Items)

- [x] ~~`.\gradlew.bat bootRun` 실제 전체 기동 성공 여부~~ → 완료, 5번 표 참고
- [x] ~~`npm install` / `npm run dev` 실제 구동 성공 여부~~ → 완료, 5번 표 참고
- [ ] 기존 `docs/실행-가이드.md`(macOS 기준)와 본 문서(Windows 기준)의 경로/명령어 차이를 팀에 공지
- [x] ~~OpenAI 챗 첫 호출 타임아웃이 재현되는지 확인~~ → 재현됨(2회 관찰: 챗 첫 호출, `PublicBenefitRecommendationService.callOpenAi` 1회). 두 경우 모두 예외가 발생해도 API 응답 자체는 실패하지 않거나(추천 랭킹은 자동 fallback) 재시도 시 정상 동작함. JDK 기본 `HttpURLConnection` 기반 `RestClient`의 커넥션 재사용/콜드스타트 특성으로 추정 — 운영 배포 전에는 `RestClient`에 명시적 커넥션 풀(Apache HttpComponents 등)과 타임아웃 값을 설정하는 것을 권장
- [x] ~~GOV24 실제 조회가 어떤 입력 조건에서 트리거되는지 확인~~ → `POST /analyze`가 아니라 결제 후 `GET /api/life/reports/{id}` 호출 시 트리거됨. 확인 완료
