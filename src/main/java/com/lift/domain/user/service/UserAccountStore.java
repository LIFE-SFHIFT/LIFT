package com.lift.domain.user.service;

import com.lift.domain.auth.enumtype.SocialProvider;
import com.lift.domain.user.model.UserAccount;
import com.lift.domain.user.repository.UserAccountRepository;
import com.lift.global.apiPayload.code.GeneralErrorCode;
import com.lift.global.apiPayload.exception.ProjectException;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class UserAccountStore {

    private final UserAccountRepository userAccountRepository;

    /**
     * 동시 첫 로그인 복구를 위해 호출자의 트랜잭션에 참여하지 않는다.
     * unique 제약 위반이 발생해도 바깥 트랜잭션을 rollback-only로 만들지 않고,
     * 각 repository 호출의 독립 트랜잭션 안에서 생성 또는 재조회가 끝나도록 한다.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public UserCreationResult getOrCreateSocialUser(
            SocialProvider provider,
            String providerUserId,
            String email,
            String nickname
    ) {
        Optional<UserAccount> existingUser = userAccountRepository.findByProviderAndProviderUserId(provider, providerUserId);
        if (existingUser.isPresent()) {
            return new UserCreationResult(requireActive(existingUser.get()), false);
        }

        try {
            UserAccount userAccount = UserAccount.createSocialUser(provider, providerUserId, email, nickname);
            return new UserCreationResult(userAccountRepository.saveAndFlush(userAccount), true);
        } catch (DataIntegrityViolationException e) {
            return userAccountRepository.findByProviderAndProviderUserId(provider, providerUserId)
                    .map(userAccount -> new UserCreationResult(requireActive(userAccount), false))
                    .orElseThrow(() -> e);
        }
    }

    // 데모(비로그인) 사용자가 공유하는 단일 커뮤니티 계정 식별자.
    // 게시판은 완전 익명이라 이 계정 정보는 화면에 드러나지 않는다.
    private static final String DEMO_PROVIDER_USER_ID = "__lift_demo_shared__";

    /**
     * 데모 로그인 사용자가 공유하는 커뮤니티 계정을 조회하거나 만든다.
     * 소셜 사용자 생성과 동일하게 unique 제약 위반을 재조회로 복구한다.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public UserAccount getOrCreateDemoUser() {
        Optional<UserAccount> existingUser =
                userAccountRepository.findByProviderAndProviderUserId(SocialProvider.KAKAO, DEMO_PROVIDER_USER_ID);
        if (existingUser.isPresent()) {
            return requireActive(existingUser.get());
        }

        try {
            UserAccount demoUser = UserAccount.createSocialUser(
                    SocialProvider.KAKAO, DEMO_PROVIDER_USER_ID, null, "데모");
            return userAccountRepository.saveAndFlush(demoUser);
        } catch (DataIntegrityViolationException e) {
            return userAccountRepository.findByProviderAndProviderUserId(SocialProvider.KAKAO, DEMO_PROVIDER_USER_ID)
                    .map(this::requireActive)
                    .orElseThrow(() -> e);
        }
    }

    @Transactional(readOnly = true)
    public UserAccount getUserById(Long userId) {
        return findActiveUser(userId)
                .orElseThrow(() -> new ProjectException(GeneralErrorCode.UNAUTHORIZED));
    }

    @Transactional(readOnly = true)
    public Optional<UserAccount> findActiveUser(Long userId) {
        return userAccountRepository.findById(userId)
                .filter(userAccount -> !userAccount.isWithdrawn());
    }

    @Transactional(readOnly = true)
    public Optional<UserAccount> findActiveUserByAuthSubject(String authSubject) {
        return userAccountRepository.findByAuthSubject(authSubject)
                .filter(userAccount -> !userAccount.isWithdrawn());
    }

    private UserAccount requireActive(UserAccount userAccount) {
        if (userAccount.isWithdrawn()) {
            throw new ProjectException(GeneralErrorCode.UNAUTHORIZED);
        }

        return userAccount;
    }

    public record UserCreationResult(
            UserAccount userAccount,
            boolean created
    ) {
    }
}
