package com.lift.domain.localnotice.controller;

import com.lift.domain.localnotice.dto.LocalNoticeResDTO;
import com.lift.domain.localnotice.service.LocalNoticeSupabaseReader;
import com.lift.global.apiPayload.ApiResponse;
import com.lift.global.apiPayload.code.GeneralSuccessCode;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 지자체 RSS 파이프라인이 확정한 지역 지원사업/장려금을 사용자에게 노출하는 공개 조회 API.
 *
 * <p>수집(RSS) → 1차 키워드 필터 → 2차 AI 판단 → DB 저장은 팀원이 별도로 운영하는 Supabase에서
 * 지금도 계속 진행 중이다. 이 컨트롤러는 {@link LocalNoticeSupabaseReader}로 그 결과(ai_verdict=true)를
 * 매 요청마다 직접 조회해 내보내기만 한다 — 특정 시점의 값을 복사해 둔 것이 아니라 항상 최신 값이다.
 * 로그인이 필요 없어 데모(비로그인) 사용자도 커뮤니티 조회처럼 그대로 호출할 수 있다(SecurityConfig permitAll).
 *
 * <p>내부 검증용 {@code LocalNoticeAdminController}(sync-enabled=true일 때만 존재, 이 앱 자체 primary DB의
 * 원문 캐시를 노출)와 달리, 이 엔드포인트는 항상 존재하고 팀원 Supabase의 확정 공고만 정제된 DTO로 돌려준다.
 */
@RestController
@RequestMapping("/api/local-notices")
@RequiredArgsConstructor
public class LocalNoticeController {

    private final LocalNoticeSupabaseReader supabaseReader;

    /**
     * 실제 지원사업/장려금으로 확정된 지역 공고 목록. regionSido/regionSigungu(둘 다 선택)로 지역을 좁히며,
     * 구까지 지정하면 그 구의 공고만 반환한다. 같은 지원사업은 하나로 묶여, DB에서 TRUE로 확정된 횟수가
     * 많은 것부터(동점이면 최신순) 정렬돼 나온다.
     */
    @GetMapping
    public ApiResponse<List<LocalNoticeResDTO>> list(
            @RequestParam(required = false) String regionSido,
            @RequestParam(required = false) String regionSigungu
    ) {
        return ApiResponse.of(
                GeneralSuccessCode.OK,
                supabaseReader.findConfirmed(regionSido, regionSigungu)
        );
    }
}
