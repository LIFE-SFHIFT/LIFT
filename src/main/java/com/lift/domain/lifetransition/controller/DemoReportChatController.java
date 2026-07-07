package com.lift.domain.lifetransition.controller;

import com.lift.domain.lifetransition.dto.request.DemoReportChatReqDTO;
import com.lift.domain.lifetransition.dto.response.DemoReportChatResDTO;
import com.lift.domain.lifetransition.service.DemoReportChatService;
import com.lift.global.apiPayload.ApiResponse;
import com.lift.global.apiPayload.code.GeneralSuccessCode;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 데모 체험용 퇴직 챗봇 API. 로그인/결제 없이 브라우저 데모에서 호출하며, 프론트가 보낸 리포트 JSON을
 * 근거로 서버에서 OpenAI(키는 서버 보관)에 질문한다. 보안상 인증 없이 접근할 수 있으므로
 * (SecurityConfig 허용 목록) 남용 방지를 위해 질문 길이를 제한한다.
 */
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class DemoReportChatController {

    private final DemoReportChatService demoReportChatService;

    @PostMapping("/report-chat")
    public ApiResponse<DemoReportChatResDTO> chat(@Valid @RequestBody DemoReportChatReqDTO request) {
        return ApiResponse.of(
                GeneralSuccessCode.OK,
                demoReportChatService.answer(request.question(), request.report())
        );
    }
}
