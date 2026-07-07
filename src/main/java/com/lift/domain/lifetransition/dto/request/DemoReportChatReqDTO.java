package com.lift.domain.lifetransition.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 데모(브라우저 로컬) 챗봇 요청.
 *
 * <p>데모 모드에는 서버에 저장된 리포트가 없으므로, 프론트가 localStorage의 리포트 JSON을 함께 보낸다.
 * 서버는 이 리포트를 근거로 OpenAI에 질문한다(키는 서버에만 둔다).
 *
 * <p>{@code report}는 임의 구조의 JSON이라 Jackson 버전에 얽매이지 않도록 {@link Object}로 받는다.
 * (JSON object는 Map, array는 List로 역직렬화된다.)
 */
public record DemoReportChatReqDTO(
        @NotBlank(message = "질문 내용을 입력해주세요.")
        @Size(max = 2000, message = "질문은 최대 2000자까지 입력 가능합니다.")
        String question,

        Object report
) {
}
