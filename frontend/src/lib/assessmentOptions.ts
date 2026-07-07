import type { Option } from "@/components/OptionSelector";
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

// 진단(/assessment/new)과 내 정보(/my)의 새 로드맵 폼이 동일한 선택지·값을 쓰도록
// 모든 옵션 상수를 이 파일 한 곳에서만 정의한다.

export const EVENT_OPTIONS: Option<LifeEventType>[] = [
  { value: "JOB_CHANGE", label: "이직", desc: "다음 일자리로 이동 중", icon: "→" },
  { value: "RETIREMENT", label: "퇴직", desc: "퇴직 후 정산과 신청 준비", icon: "✓" },
];

export const RESIGNATION_OPTIONS: Option<ResignationReason>[] = [
  { value: "CONTRACT_EXPIRED", label: "계약 만료", icon: "종료" },
  { value: "MANDATORY_RETIREMENT", label: "정년퇴직", icon: "정년" },
  { value: "COMPANY_CLOSURE", label: "회사 폐업", icon: "폐업" },
  { value: "PERSONAL_REASON", label: "개인 사정", icon: "개인" },
  { value: "FIRED", label: "해고", icon: "해고" },
  { value: "UNKNOWN", label: "기타", icon: "기타" },
];

export const NEXT_JOB_OPTIONS: Option<NextJobStatus>[] = [
  { value: "NOT_CONFIRMED", label: "아직 미정" },
  { value: "CONFIRMED", label: "확정됨" },
  { value: "UNKNOWN", label: "모름" },
];

export const INCOME_OPTIONS: Option<CurrentIncomeStatus>[] = [
  { value: "NONE", label: "소득 없음" },
  { value: "HAS_INCOME", label: "소득 있음" },
  { value: "UNKNOWN", label: "모름" },
];

// 가구 형태: 단일 선택. 자녀/부양가족은 별도의 '가구원 정보'에서 관리한다.
export const HOUSEHOLD_OPTIONS: Option<HouseholdType>[] = [
  { value: "UNKNOWN", label: "모름" },
  { value: "SINGLE", label: "1인 가구" },
  { value: "COUPLE", label: "부부 가구" },
  { value: "OTHER", label: "기타 가구" },
];

// 연소득 범위: 서로 겹치지 않는 구간(단일 선택). enum 코드는 기존 값을 유지하고 라벨만 구간형으로 바꿨다.
// 경계 해석: NONE=0원, UNDER_22M=0 초과~2,200만, UNDER_32M=2,200만 초과~3,200만,
// UNDER_44M=3,200만 초과~4,400만, UNDER_50M=4,400만 초과~5,000만, OVER_50M=5,000만 초과.
export const INCOME_RANGE_OPTIONS: Option<AnnualIncomeRange>[] = [
  { value: "UNKNOWN", label: "모름" },
  { value: "NONE", label: "소득 없음" },
  { value: "UNDER_22M", label: "2,200만 원 이하" },
  { value: "UNDER_32M", label: "2,200만 원 초과~3,200만 원 이하" },
  { value: "UNDER_44M", label: "3,200만 원 초과~4,400만 원 이하" },
  { value: "UNDER_50M", label: "4,400만 원 초과~5,000만 원 이하" },
  { value: "OVER_50M", label: "5,000만 원 초과" },
];

export const ASSET_OPTIONS: Option<AssetRange>[] = [
  { value: "UNKNOWN", label: "모름" },
  { value: "UNDER_240M", label: "2.4억원 이하" },
  { value: "OVER_240M", label: "2.4억원 초과" },
];

export const HOUSING_OPTIONS: Option<HousingType>[] = [
  { value: "UNKNOWN", label: "모름" },
  { value: "MONTHLY_RENT", label: "월세" },
  { value: "JEONSE", label: "전세" },
  { value: "OWNED", label: "자가" },
  { value: "FAMILY", label: "가족 거주" },
];

const HOUSEHOLD_VALUES = new Set<string>(HOUSEHOLD_OPTIONS.map((o) => o.value));

/**
 * 기존 저장 데이터 호환: 예전에는 자녀/부양가족이 householdType 값(WITH_CHILDREN /
 * SUPPORTING_FAMILY)으로 저장됐다. 이를 새 구조(가구 형태 + 가구원 boolean)로 변환한다.
 * 알 수 없는 값은 UNKNOWN으로 안전하게 되돌린다.
 */
export function normalizeHouseholdSelection(
  rawHouseholdType: string | null | undefined,
  hasDependentChildren: boolean,
  hasSupportingFamily: boolean,
): {
  householdType: HouseholdType;
  hasDependentChildren: boolean;
  hasSupportingFamily: boolean;
} {
  let householdType: HouseholdType = "UNKNOWN";
  let children = hasDependentChildren;
  let supporting = hasSupportingFamily;

  if (rawHouseholdType === "WITH_CHILDREN") {
    children = true;
    householdType = "OTHER";
  } else if (rawHouseholdType === "SUPPORTING_FAMILY") {
    supporting = true;
    householdType = "OTHER";
  } else if (rawHouseholdType && HOUSEHOLD_VALUES.has(rawHouseholdType)) {
    householdType = rawHouseholdType as HouseholdType;
  }

  return { householdType, hasDependentChildren: children, hasSupportingFamily: supporting };
}
