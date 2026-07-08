"use client";

import { PROVINCES, sigunguListOf } from "@/lib/regions";

interface Props {
  sido: string;
  sigungu: string;
  onSidoChange: (value: string) => void;
  onSigunguChange: (value: string) => void;
}

/**
 * 거주 지역 입력. 시/도를 고르면 해당 시/군/구가 드롭다운으로 채워지는 2단 연동 셀렉트.
 * 시/도를 바꾸면 시/군/구 선택은 초기화한다. 예전에 자유 입력으로 저장된 값이 목록에
 * 없더라도 선택 상태를 잃지 않도록, 현재 값을 옵션에 함께 넣는다.
 */
export function RegionField({ sido, sigungu, onSidoChange, onSigunguChange }: Props) {
  const sigunguOptions = sigunguListOf(sido);
  const showLegacyValue = Boolean(sigungu) && !sigunguOptions.includes(sigungu);

  return (
    <div className="region-row">
      <div className="field-icon-wrap select-wrap">
        <span className="lead-ico">📍</span>
        <select
          className={`select-field ${sido ? "" : "placeholder"}`}
          value={sido}
          onChange={(e) => {
            onSidoChange(e.target.value);
            // 시/도가 바뀌면 이전 시/군/구는 더 이상 유효하지 않으므로 비운다.
            onSigunguChange("");
          }}
        >
          <option value="">시 / 도 선택</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="select-caret">▾</span>
      </div>

      <div className="field-icon-wrap select-wrap">
        <span className="lead-ico">🏘️</span>
        <select
          className={`select-field ${sigungu ? "" : "placeholder"}`}
          value={sigungu}
          onChange={(e) => onSigunguChange(e.target.value)}
          disabled={!sido}
        >
          <option value="">{sido ? "시 / 군 / 구 선택" : "시 / 도 먼저 선택"}</option>
          {showLegacyValue && <option value={sigungu}>{sigungu}</option>}
          {sigunguOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <span className="select-caret">▾</span>
      </div>
    </div>
  );
}
