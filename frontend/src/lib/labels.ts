import type {
  CurrentIncomeStatus,
  EligibilityLevel,
  LifeEventType,
  NextJobStatus,
  PriorityLevel,
  ResignationReason,
} from "./types";

export const eventTypeLabel: Record<LifeEventType, string> = {
  RETIREMENT: "퇴직",
  JOB_CHANGE: "이직",
  UNEMPLOYMENT: "실직",
};

export const eventTypeDescription: Record<LifeEventType, string> = {
  RETIREMENT: "회사를 그만두고 새 시작을 준비 중이에요.",
  JOB_CHANGE: "다른 회사로 옮기는 중이에요.",
  UNEMPLOYMENT: "예기치 않게 일을 그만두게 됐어요.",
};

export const resignationReasonLabel: Record<ResignationReason, string> = {
  CONTRACT_EXPIRED: "계약 만료",
  RECOMMENDED_RESIGNATION: "권고사직",
  MANDATORY_RETIREMENT: "정년퇴직",
  PERSONAL_REASON: "개인 사정",
  FIRED: "해고",
  COMPANY_CLOSURE: "회사 폐업",
  UNKNOWN: "기타",
};

export const nextJobStatusLabel: Record<NextJobStatus, string> = {
  CONFIRMED: "다음 일자리 확정됨",
  NOT_CONFIRMED: "아직 미정",
  UNKNOWN: "잘 모르겠어요",
};

export const incomeStatusLabel: Record<CurrentIncomeStatus, string> = {
  NONE: "현재 소득 없음",
  HAS_INCOME: "소득 있음",
  UNKNOWN: "잘 모르겠어요",
};

export const eligibilityLabel: Record<EligibilityLevel, string> = {
  HIGH: "신청 가능성 높음",
  NEEDS_CHECK: "확인 필요",
  LOW: "가능성 낮음",
};

export const priorityLabel: Record<PriorityLevel, string> = {
  HIGH: "매우 급함",
  MEDIUM: "챙기면 좋음",
  LOW: "여유 있을 때",
};

export function eligibilityTone(level: EligibilityLevel): string {
  return level === "HIGH" ? "tone-high" : level === "NEEDS_CHECK" ? "tone-mid" : "tone-low";
}

export function priorityTone(level: PriorityLevel): string {
  return level === "HIGH" ? "tone-high" : level === "MEDIUM" ? "tone-mid" : "tone-low";
}
