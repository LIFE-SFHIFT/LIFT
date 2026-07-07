"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { DateField } from "@/components/DateField";
import { MonthStepper } from "@/components/MonthStepper";
import { OptionSelector, type Option } from "@/components/OptionSelector";
import { RegionField } from "@/components/RegionField";
import { api, ApiError } from "@/lib/api";
import { eventTypeLabel } from "@/lib/labels";
import type {
  AnnualIncomeRange,
  AssetRange,
  CurrentIncomeStatus,
  HouseholdType,
  HousingType,
  LifeEventType,
  NextJobStatus,
  ResignationReason,
} from "@/lib/types";

const RESIGNATION_OPTIONS: Option<ResignationReason>[] = [
  { value: "CONTRACT_EXPIRED", label: "계약 만료", icon: "종료" },
  { value: "RECOMMENDED_RESIGNATION", label: "권고사직", icon: "권유" },
  { value: "COMPANY_CLOSURE", label: "회사 폐업", icon: "폐업" },
  { value: "PERSONAL_REASON", label: "개인 사정", icon: "개인" },
  { value: "FIRED", label: "해고", icon: "해고" },
  { value: "UNKNOWN", label: "기타", icon: "기타" },
];

const NEXT_JOB_OPTIONS: Option<NextJobStatus>[] = [
  { value: "NOT_CONFIRMED", label: "아직 미정" },
  { value: "CONFIRMED", label: "확정됨" },
  { value: "UNKNOWN", label: "모름" },
];

const INCOME_OPTIONS: Option<CurrentIncomeStatus>[] = [
  { value: "NONE", label: "소득 없음" },
  { value: "HAS_INCOME", label: "소득 있음" },
  { value: "UNKNOWN", label: "모름" },
];

const HOUSEHOLD_OPTIONS: Option<HouseholdType>[] = [
  { value: "UNKNOWN", label: "모름" },
  { value: "SINGLE", label: "1인 가구" },
  { value: "COUPLE", label: "부부" },
  { value: "WITH_CHILDREN", label: "자녀 있음" },
  { value: "SUPPORTING_FAMILY", label: "부양가족 있음" },
];

const INCOME_RANGE_OPTIONS: Option<AnnualIncomeRange>[] = [
  { value: "UNKNOWN", label: "모름" },
  { value: "NONE", label: "없음" },
  { value: "UNDER_22M", label: "2,200만원 이하" },
  { value: "UNDER_32M", label: "3,200만원 이하" },
  { value: "UNDER_44M", label: "4,400만원 이하" },
  { value: "UNDER_50M", label: "5,000만원 이하" },
  { value: "OVER_50M", label: "5,000만원 초과" },
];

const ASSET_OPTIONS: Option<AssetRange>[] = [
  { value: "UNKNOWN", label: "모름" },
  { value: "UNDER_240M", label: "2.4억원 이하" },
  { value: "OVER_240M", label: "2.4억원 초과" },
];

const HOUSING_OPTIONS: Option<HousingType>[] = [
  { value: "UNKNOWN", label: "모름" },
  { value: "MONTHLY_RENT", label: "월세" },
  { value: "JEONSE", label: "전세" },
  { value: "OWNED", label: "자가" },
  { value: "FAMILY", label: "가족 거주" },
];

function TogglePill({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`toggle-pill ${checked ? "on" : ""}`}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-dot">{checked ? "✓" : ""}</span>
      {label}
    </button>
  );
}

function AssessmentInner() {
  const router = useRouter();
  const [eventType, setEventType] = useState<LifeEventType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [retirementDate, setRetirementDate] = useState("");
  const [resignationReason, setResignationReason] =
    useState<ResignationReason | null>(null);
  const [nextJobStatus, setNextJobStatus] = useState<NextJobStatus | null>(null);
  const [insuranceMonths, setInsuranceMonths] = useState<number | null>(null);
  const [incomeStatus, setIncomeStatus] = useState<CurrentIncomeStatus | null>(null);
  const [regionSido, setRegionSido] = useState("");
  const [regionSigungu, setRegionSigungu] = useState("");
  const [age, setAge] = useState("");
  const [tenureYears, setTenureYears] = useState("");
  const [householdType, setHouseholdType] = useState<HouseholdType>("UNKNOWN");
  const [annualIncomeRange, setAnnualIncomeRange] =
    useState<AnnualIncomeRange>("UNKNOWN");
  const [assetRange, setAssetRange] = useState<AssetRange>("UNKNOWN");
  const [housingType, setHousingType] = useState<HousingType>("UNKNOWN");
  const [hasDependentChildren, setHasDependentChildren] = useState(false);
  const [basicLivelihoodRecipient, setBasicLivelihoodRecipient] = useState(false);
  const [nearPoverty, setNearPoverty] = useState(false);
  const [singleParent, setSingleParent] = useState(false);
  const [disabledPerson, setDisabledPerson] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("lift.eventType") as LifeEventType | null;
    if (!stored) {
      router.replace("/onboarding/life-event");
      return;
    }
    setEventType(stored);
  }, [router]);

  useEffect(() => {
    api.getMyProfile().then((profile) => {
      setRegionSido(profile.sido ?? "");
      setRegionSigungu(profile.sigungu ?? "");
      setHouseholdType(profile.householdType ?? "UNKNOWN");
      setAnnualIncomeRange(profile.annualIncomeRange ?? "UNKNOWN");
      setAssetRange(profile.assetRange ?? "UNKNOWN");
      setHousingType(profile.housingType ?? "UNKNOWN");
      setHasDependentChildren(Boolean(profile.hasDependentChildren));
      setBasicLivelihoodRecipient(Boolean(profile.basicLivelihoodRecipient));
      setNearPoverty(Boolean(profile.nearPoverty));
      setSingleParent(Boolean(profile.singleParent));
      setDisabledPerson(Boolean(profile.disabledPerson));
    }).catch(() => {
      // 프로필 자동 채우기는 보조 기능이므로 실패해도 진단 입력을 막지 않는다.
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventType) return;
    if (!resignationReason || !nextJobStatus || insuranceMonths === null || !incomeStatus || !age) {
      setError("필수 항목을 모두 선택해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const toNum = (v: string): number | null => {
        const digits = v.replace(/[^\d]/g, "");
        return digits ? Number(digits) : null;
      };
      const assessment = await api.createAssessment({
        eventType,
        retirementDate: retirementDate || null,
        resignationReason,
        nextJobStatus,
        employmentInsuranceMonths: insuranceMonths,
        currentIncomeStatus: incomeStatus,
        regionSido: regionSido || null,
        regionSigungu: regionSigungu || null,
        monthlyAverageWage: null,
        age: toNum(age),
        tenureYears: toNum(tenureYears),
        householdType,
        annualIncomeRange,
        assetRange,
        housingType,
        hasDependentChildren,
        basicLivelihoodRecipient,
        nearPoverty,
        singleParent,
        disabledPerson,
      });
      const preview = await api.analyze(assessment.assessmentId);
      router.push(`/report/${preview.reportId}/preview`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "분석 중 문제가 발생했어요. 다시 시도해주세요.",
      );
      setSubmitting(false);
    }
  }

  if (!eventType) {
    return <div className="center-state">불러오는 중…</div>;
  }

  const dateLabel = eventType === "JOB_CHANGE" ? "마지막 근무일" : "퇴직(퇴사)일";
  const requiredCompleted =
    Boolean(resignationReason) &&
    Boolean(nextJobStatus) &&
    insuranceMonths !== null &&
    Boolean(incomeStatus) &&
    Boolean(age);

  return (
    <form onSubmit={handleSubmit}>
      <p className="step-hint">STEP 2 · {eventTypeLabel[eventType]} 상황 입력</p>
      <h1 className="page-title">몇 가지만 확인할게요</h1>
      <p className="page-sub">
        입력하신 정보로 룰 엔진이 신청 가능성과 우선순위를 계산합니다. 필수 항목만 먼저
        고르고, 모르는 세부 항목은 그대로 두어도 괜찮아요.
      </p>

      {error && <div className="error-box">{error}</div>}

      <div className="form-block">
        <label className="form-label">{dateLabel}</label>
        <p className="form-help">아직 정해지지 않았다면 비워두세요.</p>
        <DateField value={retirementDate} onChange={setRetirementDate} />
      </div>

      <div className="form-block resignation-options">
        <label className="form-label">퇴사(이직) 사유 <span className="wage-badge">필수</span></label>
        <p className="form-help">실업급여 신청 가능성을 판단하는 가장 중요한 정보예요.</p>
        <OptionSelector
          options={RESIGNATION_OPTIONS}
          value={resignationReason}
          onChange={setResignationReason}
          columns={2}
        />
      </div>

      <div className="form-block">
        <label className="form-label">다음 일자리 상태 <span className="wage-badge">필수</span></label>
        <OptionSelector
          options={NEXT_JOB_OPTIONS}
          value={nextJobStatus}
          onChange={setNextJobStatus}
          variant="chip"
          columns={3}
        />
      </div>

      <div className="form-block">
        <label className="form-label">고용보험 가입 기간 <span className="wage-badge">필수</span></label>
        <p className="form-help">이전 직장들을 합쳐 대략적인 개월 수를 알려주세요.</p>
        <MonthStepper value={insuranceMonths} onChange={setInsuranceMonths} />
      </div>

      <div className="form-block">
        <label className="form-label">현재 소득 상태 <span className="wage-badge">필수</span></label>
        <OptionSelector
          options={INCOME_OPTIONS}
          value={incomeStatus}
          onChange={setIncomeStatus}
          variant="chip"
          columns={3}
        />
      </div>

      <div className="wage-section">
        <div className="wage-head">
          <span className="wage-badge">📌 리포트 정확도 높이기</span>
          <p className="wage-help">
            나이는 실업급여 기간·퇴직금 판단은 물론, 나이 조건이 있는 공공서비스 혜택
            매칭을 확인하기 위해 필수로 입력해 주세요. 근속연수와 월급은 선택이며, 월급은
            민감한 정보라 PDF 저장 단계에서만 따로 입력받습니다.
          </p>
        </div>

        <div className="wage-row">
          <div className="form-block">
            <label className="form-label">
              나이 (만) <span className="wage-badge">필수</span>
            </label>
            <div className="won-input">
              <input
                className="text-input"
                inputMode="numeric"
                placeholder="예) 35"
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              />
              <span className="won-suffix">세</span>
            </div>
          </div>
          <div className="form-block">
            <label className="form-label">근속연수 (선택)</label>
            <div className="won-input">
              <input
                className="text-input"
                inputMode="numeric"
                placeholder="예) 5"
                value={tenureYears}
                onChange={(e) =>
                  setTenureYears(e.target.value.replace(/[^\d]/g, "").slice(0, 2))
                }
              />
              <span className="won-suffix">년</span>
            </div>
          </div>
        </div>
      </div>

      <div className="form-block">
        <label className="form-label">거주 지역 (선택)</label>
        <p className="form-help">지역 맞춤 안내를 위해 사용돼요.</p>
        <RegionField
          sido={regionSido}
          sigungu={regionSigungu}
          onSidoChange={setRegionSido}
          onSigunguChange={setRegionSigungu}
        />
      </div>

      <div className="benefit-match-section">
        <div className="wage-head">
          <span className="wage-badge">선택 · 공공데이터 혜택 매칭</span>
          <p className="wage-help">
            아래 정보가 있으면 정부24 공공서비스 후보를 더 정확히 줄일 수 있어요. 모르는
            항목은 “모름”으로 두어도 됩니다.
          </p>
        </div>

        <div className="form-block compact">
          <label className="form-label">가구 형태</label>
          <OptionSelector
            options={HOUSEHOLD_OPTIONS}
            value={householdType}
            onChange={setHouseholdType}
            variant="chip"
            columns={3}
          />
        </div>

        <div className="form-block compact">
          <label className="form-label">연소득 범위</label>
          <OptionSelector
            options={INCOME_RANGE_OPTIONS}
            value={annualIncomeRange}
            onChange={setAnnualIncomeRange}
            variant="chip"
            columns={2}
          />
        </div>

        <div className="form-block compact">
          <label className="form-label">재산 범위</label>
          <OptionSelector
            options={ASSET_OPTIONS}
            value={assetRange}
            onChange={setAssetRange}
            variant="chip"
            columns={3}
          />
        </div>

        <div className="form-block compact">
          <label className="form-label">주거 형태</label>
          <OptionSelector
            options={HOUSING_OPTIONS}
            value={housingType}
            onChange={setHousingType}
            variant="chip"
            columns={3}
          />
        </div>

        <div className="form-block compact">
          <label className="form-label">해당되는 항목</label>
          <div className="toggle-grid">
            <TogglePill
              checked={hasDependentChildren}
              onChange={setHasDependentChildren}
              label="부양자녀 있음"
            />
            <TogglePill
              checked={basicLivelihoodRecipient}
              onChange={setBasicLivelihoodRecipient}
              label="기초생활수급"
            />
            <TogglePill checked={nearPoverty} onChange={setNearPoverty} label="차상위/저소득" />
            <TogglePill checked={singleParent} onChange={setSingleParent} label="한부모" />
            <TogglePill checked={disabledPerson} onChange={setDisabledPerson} label="장애 관련" />
          </div>
        </div>
      </div>

      <div className="sticky-cta">
        <button type="submit" className="btn" disabled={submitting || !requiredCompleted}>
          {submitting ? "분석 중…" : "내 로드맵 만들기"}
        </button>
      </div>
    </form>
  );
}

export default function AssessmentNewPage() {
  return (
    <AppShell showLogout>
      <AuthGuard>
        <AssessmentInner />
      </AuthGuard>
    </AppShell>
  );
}
