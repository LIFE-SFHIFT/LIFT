"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { DateField } from "@/components/DateField";
import { MonthStepper } from "@/components/MonthStepper";
import { OptionSelector } from "@/components/OptionSelector";
import { RegionField } from "@/components/RegionField";
import { TogglePill } from "@/components/TogglePill";
import { api, ApiError } from "@/lib/api";
import { eventTypeLabel } from "@/lib/labels";
import {
  ASSET_OPTIONS,
  HOUSEHOLD_OPTIONS,
  HOUSING_OPTIONS,
  INCOME_OPTIONS,
  INCOME_RANGE_OPTIONS,
  NEXT_JOB_OPTIONS,
  RESIGNATION_OPTIONS,
  normalizeHouseholdSelection,
} from "@/lib/assessmentOptions";
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

function AssessmentInner() {
  const router = useRouter();
  const [eventType, setEventType] = useState<LifeEventType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [retirementDate, setRetirementDate] = useState("");
  const [resignationReason, setResignationReason] =
    useState<ResignationReason | null>(null);
  const [nextJobStatus, setNextJobStatus] = useState<NextJobStatus | null>(null);
  const [nextJobStartDate, setNextJobStartDate] = useState("");
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
  const [hasSupportingFamily, setHasSupportingFamily] = useState(false);
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
      // 예전에 householdType으로 저장된 자녀/부양가족 값을 새 구조로 변환해 채운다.
      const household = normalizeHouseholdSelection(
        profile.householdType,
        Boolean(profile.hasDependentChildren),
        Boolean(profile.hasSupportingFamily),
      );
      setHouseholdType(household.householdType);
      setHasDependentChildren(household.hasDependentChildren);
      setHasSupportingFamily(household.hasSupportingFamily);
      setAnnualIncomeRange(profile.annualIncomeRange ?? "UNKNOWN");
      setAssetRange(profile.assetRange ?? "UNKNOWN");
      setHousingType(profile.housingType ?? "UNKNOWN");
      setBasicLivelihoodRecipient(Boolean(profile.basicLivelihoodRecipient));
      setNearPoverty(Boolean(profile.nearPoverty));
      setSingleParent(Boolean(profile.singleParent));
      setDisabledPerson(Boolean(profile.disabledPerson));
    }).catch(() => {
      // 프로필 자동 채우기는 보조 기능이므로 실패해도 진단 입력을 막지 않는다.
    });
  }, []);

  useEffect(() => {
    if (nextJobStatus !== "CONFIRMED") {
      setNextJobStartDate("");
    }
  }, [nextJobStatus]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventType) return;
    if (!resignationReason || !nextJobStatus || insuranceMonths === null || !incomeStatus || !age) {
      setError("필수 항목을 모두 선택해 주세요.");
      return;
    }
    if (!regionSido || !regionSigungu) {
      setError("거주 지역(시/도와 시/군/구)을 모두 선택해 주세요.");
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
        nextJobStartDate: nextJobStatus === "CONFIRMED" ? nextJobStartDate || null : null,
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
        hasSupportingFamily,
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
    Boolean(age) &&
    Boolean(regionSido) &&
    Boolean(regionSigungu);

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

      {nextJobStatus === "CONFIRMED" && (
        <div className="form-block">
          <label className="form-label">다음 일자리 시작일</label>
          <p className="form-help">입사일이나 첫 출근 예정일을 선택해 주세요.</p>
          <DateField value={nextJobStartDate} onChange={setNextJobStartDate} />
        </div>
      )}

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
            매칭의 핵심 기준이라 필수로 입력해 주세요. 월급은 민감한 정보라 PDF 저장
            단계에서만 따로 입력받습니다.
          </p>
        </div>

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
      </div>

      <div className="form-block">
        <label className="form-label">
          근속연수 <span className="label-hint">· 선택</span>
        </label>
        <p className="form-help">
          이전 직장에서 일한 총 햇수예요. 입력하면 퇴직금·장기근속 관련 판단이 더
          정확해져요.
        </p>
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

      <div className="form-block">
        <label className="form-label">
          거주 지역 <span className="wage-badge">필수</span>
        </label>
        <p className="form-help">
          시/도를 고르면 해당 시·군·구가 나타나요. 지역 맞춤 혜택 안내에 사용돼요.
        </p>
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
            columns={2}
          />
        </div>

        <div className="form-block compact">
          <label className="form-label">
            가구원 정보 <span className="label-hint">· 복수 선택 가능</span>
          </label>
          <div className="toggle-grid">
            <TogglePill
              checked={hasDependentChildren}
              onChange={setHasDependentChildren}
              label="자녀 있음"
            />
            <TogglePill
              checked={hasSupportingFamily}
              onChange={setHasSupportingFamily}
              label="부양가족 있음"
            />
          </div>
        </div>

        <div className="form-block compact income-range-select">
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
