"use client";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/**
 * 복수 선택용 체크 칩. 누를 때마다 선택/해제가 토글된다.
 * 가구원 정보, 해당되는 항목 등 여러 boolean 항목에 공통으로 쓴다.
 */
export function TogglePill({ checked, onChange, label }: Props) {
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
