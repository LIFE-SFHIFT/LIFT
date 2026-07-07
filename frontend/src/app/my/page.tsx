"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { DateField } from "@/components/DateField";
import { MonthStepper } from "@/components/MonthStepper";
import { OptionSelector, type Option } from "@/components/OptionSelector";
import { RegionField } from "@/components/RegionField";
import { TogglePill } from "@/components/TogglePill";
import { api, ApiError } from "@/lib/api";
import { eventTypeLabel } from "@/lib/labels";
import {
  ASSET_OPTIONS,
  EVENT_OPTIONS,
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
  UserProfile,
} from "@/lib/types";

const DEFAULT_PROFILE = {
  householdType: "UNKNOWN" as HouseholdType,
  annualIncomeRange: "UNKNOWN" as AnnualIncomeRange,
  assetRange: "UNKNOWN" as AssetRange,
  housingType: "UNKNOWN" as HousingType,
};

const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function toNum(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function optionLabel<T extends string>(options: Option<T>[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function completionScore({
  regionSido,
  regionSigungu,
  householdType,
  annualIncomeRange,
  assetRange,
  housingType,
}: {
  regionSido: string;
  regionSigungu: string;
  householdType: HouseholdType;
  annualIncomeRange: AnnualIncomeRange;
  assetRange: AssetRange;
  housingType: HousingType;
}) {
  const checks = [
    Boolean(regionSido && regionSigungu),
    householdType !== "UNKNOWN",
    annualIncomeRange !== "UNKNOWN",
    assetRange !== "UNKNOWN",
    housingType !== "UNKNOWN",
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function MyPageInner() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [nickname, setNickname] = useState("");
  const [regionSido, setRegionSido] = useState("");
  const [regionSigungu, setRegionSigungu] = useState("");
  const [householdType, setHouseholdType] =
    useState<HouseholdType>(DEFAULT_PROFILE.householdType);
  const [annualIncomeRange, setAnnualIncomeRange] =
    useState<AnnualIncomeRange>(DEFAULT_PROFILE.annualIncomeRange);
  const [assetRange, setAssetRange] = useState<AssetRange>(DEFAULT_PROFILE.assetRange);
  const [housingType, setHousingType] = useState<HousingType>(DEFAULT_PROFILE.housingType);
  const [hasDependentChildren, setHasDependentChildren] = useState(false);
  const [hasSupportingFamily, setHasSupportingFamily] = useState(false);
  const [basicLivelihoodRecipient, setBasicLivelihoodRecipient] = useState(false);
  const [nearPoverty, setNearPoverty] = useState(false);
  const [singleParent, setSingleParent] = useState(false);
  const [disabledPerson, setDisabledPerson] = useState(false);

  const [ringReady, setRingReady] = useState(false);
  const [eventType, setEventType] = useState<LifeEventType>("RETIREMENT");
  const [retirementDate, setRetirementDate] = useState("");
  const [resignationReason, setResignationReason] =
    useState<ResignationReason>("CONTRACT_EXPIRED");
  const [nextJobStatus, setNextJobStatus] = useState<NextJobStatus>("NOT_CONFIRMED");
  const [nextJobStartDate, setNextJobStartDate] = useState("");
  const [insuranceMonths, setInsuranceMonths] = useState<number | null>(12);
  const [incomeStatus, setIncomeStatus] = useState<CurrentIncomeStatus>("NONE");
  const [age, setAge] = useState("");
  const [tenureYears, setTenureYears] = useState("");

  useEffect(() => {
    api
      .getMyProfile()
      .then((data) => {
        setProfile(data);
        setNickname(data.nickname ?? "");
        setRegionSido(data.sido ?? "");
        setRegionSigungu(data.sigungu ?? "");
        // 예전에 householdType으로 저장된 자녀/부양가족 값을 새 구조로 변환해 채운다.
        const household = normalizeHouseholdSelection(
          data.householdType,
          Boolean(data.hasDependentChildren),
          Boolean(data.hasSupportingFamily),
        );
        setHouseholdType(household.householdType);
        setHasDependentChildren(household.hasDependentChildren);
        setHasSupportingFamily(household.hasSupportingFamily);
        setAnnualIncomeRange(
          data.annualIncomeRange ?? DEFAULT_PROFILE.annualIncomeRange,
        );
        setAssetRange(data.assetRange ?? DEFAULT_PROFILE.assetRange);
        setHousingType(data.housingType ?? DEFAULT_PROFILE.housingType);
        setBasicLivelihoodRecipient(Boolean(data.basicLivelihoodRecipient));
        setNearPoverty(Boolean(data.nearPoverty));
        setSingleParent(Boolean(data.singleParent));
        setDisabledPerson(Boolean(data.disabledPerson));
      })
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "내 정보를 불러오지 못했어요."),
      )
      .finally(() => setLoading(false));
  }, []);

  // 링 게이지가 0에서 현재 완성도까지 차오르는 마운트 애니메이션.
  useEffect(() => {
    if (loading) return;
    const frame = requestAnimationFrame(() => setRingReady(true));
    return () => cancelAnimationFrame(frame);
  }, [loading]);

  useEffect(() => {
    if (nextJobStatus !== "CONFIRMED") {
      setNextJobStartDate("");
    }
  }, [nextJobStatus]);

  const score = useMemo(
    () =>
      completionScore({
        regionSido,
        regionSigungu,
        householdType,
        annualIncomeRange,
        assetRange,
        housingType,
      }),
    [regionSido, regionSigungu, householdType, annualIncomeRange, assetRange, housingType],
  );

  async function handleSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const updated = await api.updateMyProfile({
        nickname: nickname.trim() || null,
        sido: regionSido || null,
        sigungu: regionSigungu || null,
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
      setProfile(updated);
      setSavedMessage("기본 정보가 저장됐어요.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "내 정보 저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRoadmap(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSavedMessage(null);
    try {
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "새 로드맵 생성에 실패했어요.");
      setCreating(false);
    }
  }

  if (loading) return <div className="center-state">내 정보를 불러오는 중…</div>;

  const provider = profile?.provider?.toUpperCase() ?? "";
  const dateLabel = eventType === "JOB_CHANGE" ? "마지막 근무일" : "퇴직(퇴사)일";
  const regionLabel =
    regionSido && regionSigungu ? `${regionSido} ${regionSigungu}` : "미입력";
  const householdLabel = optionLabel(HOUSEHOLD_OPTIONS, householdType);
  const housingLabel = optionLabel(HOUSING_OPTIONS, housingType);
  const incomeLabel = optionLabel(INCOME_RANGE_OPTIONS, annualIncomeRange);
  const ringOffset = ringReady
    ? RING_CIRCUMFERENCE * (1 - score / 100)
    : RING_CIRCUMFERENCE;

  return (
    <main className="section-page">
      <section className="profile-hero">
        <div className="profile-id">
          <div className="profile-avatar">{(nickname || "내").slice(0, 1)}</div>
          <div className="profile-hero-name">
            <span className="page-eyebrow">내 정보</span>
            <h1>{nickname || "프로필 설정"}</h1>
            <p>{profile?.email || `${provider} 로그인 계정`}</p>
          </div>
        </div>

        <div className="profile-hero-right">
          <div className="progress-ring" aria-label={`프로필 완성도 ${score}%`}>
            <svg viewBox="0 0 72 72" width="72" height="72">
              <defs>
                <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5b8bff" />
                  <stop offset="100%" stopColor="#2f5fe0" />
                </linearGradient>
              </defs>
              <circle className="progress-ring-track" cx="36" cy="36" r={RING_RADIUS} />
              <circle
                className="progress-ring-fill"
                cx="36"
                cy="36"
                r={RING_RADIUS}
                stroke="url(#ring-grad)"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
              />
            </svg>
            <div className="progress-ring-label">{score}%</div>
          </div>
          <div className="hero-info-list">
            <div className="hero-info-row">
              <span>지역</span>
              <b>{regionLabel}</b>
            </div>
            <div className="hero-info-row">
              <span>가구</span>
              <b>{householdLabel}</b>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {savedMessage && <div className="success-box">{savedMessage}</div>}

      <div className="my-grid">
        <section className="section-card">
          <form onSubmit={handleSaveProfile}>
            <div className="section-card-head">
              <div>
                <span className="page-eyebrow">기본 프로필</span>
                <h2>저장되는 정보</h2>
              </div>
              <button type="submit" className="save-btn" disabled={saving}>
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>

            <div className="info-tags">
              <span className="info-tag">
                <i>주거</i>
                {housingLabel}
              </span>
              <span className="info-tag">
                <i>연소득</i>
                {incomeLabel}
              </span>
              <span className="info-tag">
                <i>지역</i>
                {regionLabel}
              </span>
            </div>

            <div className="field">
              <label>닉네임</label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                placeholder="표시 이름"
              />
            </div>

            <div className="form-block">
              <label className="form-label">거주 지역</label>
              <RegionField
                sido={regionSido}
                sigungu={regionSigungu}
                onSidoChange={setRegionSido}
                onSigunguChange={setRegionSigungu}
              />
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

            <div className="two-col">
              <div className="form-block compact income-range-select">
                <label className="form-label">연소득 범위</label>
                <OptionSelector
                  options={INCOME_RANGE_OPTIONS}
                  value={annualIncomeRange}
                  onChange={setAnnualIncomeRange}
                  variant="chip"
                  columns={1}
                />
              </div>
              <div className="form-block compact">
                <label className="form-label">재산 범위</label>
                <OptionSelector
                  options={ASSET_OPTIONS}
                  value={assetRange}
                  onChange={setAssetRange}
                  variant="chip"
                  columns={1}
                />
              </div>
            </div>

            <div className="form-block compact">
              <label className="form-label">주거 형태</label>
              <OptionSelector
                options={HOUSING_OPTIONS}
                value={housingType}
                onChange={setHousingType}
                variant="chip"
                columns={2}
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
          </form>
        </section>

        <aside className="section-card roadmap-card">
          <div className="roadmap-band">
            <div className="roadmap-band-top">
              <h2>새 로드맵 만들기</h2>
              <span className="roadmap-badge">기존 리포트 보관</span>
            </div>
            <p>지금 상황을 알려주시면 맞춤 로드맵을 새로 만들어 드려요.</p>
          </div>

          <form className="roadmap-form" onSubmit={handleCreateRoadmap}>
            <div className="form-block roadmap-event-block">
              <label className="form-label">분류</label>
              <OptionSelector
                options={EVENT_OPTIONS}
                value={eventType}
                onChange={setEventType}
                variant="chip"
                columns={2}
              />
            </div>

            <div className="two-col">
              <div className="form-block">
                <label className="form-label">{dateLabel}</label>
                <DateField value={retirementDate} onChange={setRetirementDate} />
              </div>
              <div className="form-block">
                <label className="form-label">고용보험</label>
                <MonthStepper value={insuranceMonths} onChange={setInsuranceMonths} />
              </div>
            </div>

            <div className="form-block resignation-options">
              <label className="form-label">퇴사(이직) 사유</label>
              <OptionSelector
                options={RESIGNATION_OPTIONS}
                value={resignationReason}
                onChange={setResignationReason}
                columns={2}
              />
            </div>

            <div className="two-col">
              <div className="form-block compact">
                <label className="form-label">다음 일자리</label>
                <OptionSelector
                  options={NEXT_JOB_OPTIONS}
                  value={nextJobStatus}
                  onChange={setNextJobStatus}
                  variant="chip"
                  columns={3}
                />
              </div>
              <div className="form-block compact">
                <label className="form-label">현재 소득</label>
                <OptionSelector
                  options={INCOME_OPTIONS}
                  value={incomeStatus}
                  onChange={setIncomeStatus}
                  variant="chip"
                  columns={3}
                />
              </div>
            </div>

            {nextJobStatus === "CONFIRMED" && (
              <div className="form-block roadmap-date-followup">
                <label className="form-label">다음 일자리 시작일</label>
                <DateField value={nextJobStartDate} onChange={setNextJobStartDate} />
              </div>
            )}

            <div className="wage-row">
              <div className="form-block">
                <label className="form-label">나이 (만)</label>
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
                <label className="form-label">근속연수</label>
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

            <button type="submit" className="btn grad" disabled={creating}>
              {creating ? "생성 중…" : `${eventTypeLabel[eventType]} 로드맵 만들기`}
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}

export default function MyPage() {
  return (
    <AppShell showLogout wide>
      <AuthGuard>
        <MyPageInner />
      </AuthGuard>
    </AppShell>
  );
}
