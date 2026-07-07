package com.lift.domain.term.service;

import com.lift.domain.term.dto.response.TermsResDTO;
import com.lift.domain.term.enumtype.TermType;
import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TermsService {

    @Transactional(readOnly = true)
    public TermsResDTO getTerms(TermType type) {
        if (type == TermType.PRIVACY) {
            return TermsResDTO.of(
                    type,
                    "1.0",
                    LocalDate.of(2026, 7, 4),
                    """
                            LIFT는 생애전환 행정 준비 리포트 제공을 위해 필요한 최소한의 개인정보를 수집하고 안전하게 관리합니다.

                            수집 항목: 소셜 로그인 제공자 식별값, 이메일, 닉네임, 서비스 이용 과정에서 사용자가 입력한 퇴직일, 퇴사 사유, 고용보험 가입기간, 지역, 소득·가구·주거 관련 선택 정보.

                            이용 목적: 회원 식별, 로그인 유지, 리포트 생성, 행정 절차·필요 서류·마감일 안내, 고객 문의 대응, 서비스 부정 이용 방지.

                            보관 기간: 회원 탈퇴 또는 개인정보 처리 목적 달성 시까지 보관하며, 관계 법령에 따라 보존이 필요한 정보는 해당 기간 동안 분리 보관합니다.

                            제3자 제공: LIFT는 사용자의 개인정보를 동의 없이 제3자에게 제공하지 않습니다. 최종 신청은 정부24, 고용24, 국민건강보험공단, 국민연금공단 등 공식 기관 사이트에서 사용자가 직접 진행합니다.
                            """
            );
        }

        return TermsResDTO.of(
                type,
                "1.0",
                LocalDate.of(2026, 7, 4),
                """
                        LIFT는 퇴직, 이직, 실직 등 생애전환 상황에서 사용자가 놓치기 쉬운 행정 절차, 필요 서류, 마감일, 공식 신청 링크를 정리해주는 행정 준비 지원 서비스입니다.

                        LIFT가 제공하는 리포트와 AI 설명은 사용자가 절차를 이해하고 준비하도록 돕기 위한 참고 정보입니다. 실업급여, 건강보험, 국민연금, 세금, 퇴직금 등 각 제도의 최종 자격 판단과 승인 여부는 관할 기관의 심사 기준에 따릅니다.

                        사용자는 본인의 입력 정보가 정확한지 확인해야 하며, 공식 신청과 서류 제출은 각 기관의 공식 채널에서 직접 진행해야 합니다.

                        LIFT는 법률, 노무, 세무 대리 행위를 제공하지 않으며, 전문가 상담이나 기관 심사를 대체하지 않습니다.
                        """
        );
    }
}
