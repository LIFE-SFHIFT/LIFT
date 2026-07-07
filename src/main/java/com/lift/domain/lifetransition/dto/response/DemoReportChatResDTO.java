package com.lift.domain.lifetransition.dto.response;

/**
 * 데모 챗봇 응답.
 *
 * @param answer    챗봇 답변 본문
 * @param aiPowered true면 실제 OpenAI가 생성한 답변, false면 키 미설정/실패로 규칙 기반 폴백
 */
public record DemoReportChatResDTO(
        String answer,
        boolean aiPowered
) {
}
