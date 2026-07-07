package com.lift.domain.user.service;

import com.lift.domain.user.dto.request.UserAgreementReqDTO;
import com.lift.domain.user.dto.request.UserProfileUpdateReqDTO;
import com.lift.domain.user.dto.response.UserAgreementResDTO;
import com.lift.domain.user.dto.response.UserProfileResDTO;
import com.lift.domain.user.dto.response.UserSummaryResDTO;
import com.lift.domain.user.model.UserAccount;
import com.lift.global.apiPayload.code.GeneralErrorCode;
import com.lift.global.apiPayload.exception.ProjectException;
import com.lift.global.auth.AuthUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserAccountStore userAccountStore;

    @Transactional(readOnly = true)
    public UserSummaryResDTO getSummary(Authentication authentication) {
        return UserSummaryResDTO.from(getCurrentUser(authentication));
    }

    @Transactional(readOnly = true)
    public UserProfileResDTO getProfile(Authentication authentication) {
        return UserProfileResDTO.from(getCurrentUser(authentication));
    }

    @Transactional
    public UserProfileResDTO updateProfile(Authentication authentication, UserProfileUpdateReqDTO request) {
        UserAccount userAccount = getCurrentUser(authentication);
        userAccount.updateProfile(
                request.nickname(),
                request.childName(),
                request.guardianType(),
                request.sido(),
                request.sigungu(),
                request.householdType(),
                request.annualIncomeRange(),
                request.assetRange(),
                request.housingType(),
                request.hasDependentChildren(),
                request.hasSupportingFamily(),
                request.basicLivelihoodRecipient(),
                request.nearPoverty(),
                request.singleParent(),
                request.disabledPerson()
        );

        return UserProfileResDTO.from(userAccount);
    }

    @Transactional
    public UserAgreementResDTO agreeTerms(Authentication authentication, UserAgreementReqDTO request) {
        UserAccount userAccount = getCurrentUser(authentication);
        userAccount.agreeTerms(
                request.serviceTermsAgreed(),
                request.privacyPolicyAgreed(),
                request.isMarketingAgreedValue()
        );

        return UserAgreementResDTO.from(userAccount);
    }

    @Transactional
    public void withdraw(Authentication authentication) {
        getCurrentUser(authentication).withdraw();
    }

    public UserAccount getCurrentUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ProjectException(GeneralErrorCode.UNAUTHORIZED);
        }

        return userAccountStore.getUserById(principal.userId());
    }
}
