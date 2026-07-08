package com.lift.domain.lifetransition.exception;

import com.lift.global.apiPayload.code.BaseErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * 놓치면손해(생애 전환) 도메인 전용 에러 코드.
 * 공통 응답 포맷은 기존 ApiResponse / BaseErrorCode 패턴을 그대로 따른다.
 */
@Getter
@RequiredArgsConstructor
public enum LifeTransitionErrorCode implements BaseErrorCode {

    ASSESSMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "LIFE404_1", "진단 정보를 찾을 수 없습니다."),
    REPORT_NOT_FOUND(HttpStatus.NOT_FOUND, "LIFE404_2", "리포트를 찾을 수 없습니다."),
    REPORT_ACCESS_DENIED(HttpStatus.FORBIDDEN, "LIFE403_1", "해당 리포트에 접근할 수 없습니다."),
    PAYMENT_REQUIRED(HttpStatus.FORBIDDEN, "LIFE403_2", "결제 완료 후 이용할 수 있습니다."),
    AI_QUESTION_LIMIT_EXCEEDED(HttpStatus.FORBIDDEN, "LIFE403_3", "AI 질문 가능 횟수를 모두 사용했습니다."),
    PLAN_UPGRADE_REQUIRED(HttpStatus.FORBIDDEN, "LIFE403_4", "확장 리포트 결제 후 이용할 수 있습니다."),
    ASSESSMENT_ALREADY_PAID(HttpStatus.BAD_REQUEST, "LIFE400_1", "이미 결제가 완료된 리포트입니다."),
    TOSS_PAYMENT_INVALID_REQUEST(HttpStatus.BAD_REQUEST, "LIFE400_2", "토스 결제 요청 정보가 올바르지 않습니다."),
    PAYMENT_PLAN_INVALID_REQUEST(HttpStatus.BAD_REQUEST, "LIFE400_3", "리포트 플랜과 결제 금액이 올바르지 않습니다."),
    TOSS_PAYMENT_CONFIRM_FAILED(HttpStatus.BAD_GATEWAY, "LIFE502_1", "토스 결제 승인에 실패했습니다."),
    TOSS_PAYMENT_DISABLED(HttpStatus.SERVICE_UNAVAILABLE, "LIFE503_1", "토스 테스트 결제 설정이 꺼져 있습니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
