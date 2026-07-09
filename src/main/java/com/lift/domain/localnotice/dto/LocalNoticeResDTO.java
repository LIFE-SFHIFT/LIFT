package com.lift.domain.localnotice.dto;

import java.time.Instant;

/**
 * 지자체 RSS 파이프라인이 실제 지원사업/장려금으로 확정한(ai_verdict=true) 공고를 외부로 노출하기 위한 응답.
 *
 * <p>link/publishedAt이 함께 나가므로 각 항목은 원문 공고로 추적 가능하다(하드코딩 목업이 아님).
 */
public record LocalNoticeResDTO(
        Long id,
        String regionSido,
        String regionSigungu,
        String title,
        String link,
        String summary,
        Instant publishedAt,
        String matchedKeyword,
        String category,
        String targetGroupSummary,
        String supportContentSummary,
        String reason
) {
}
