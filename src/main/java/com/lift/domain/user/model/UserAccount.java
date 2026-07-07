package com.lift.domain.user.model;

import com.lift.domain.auth.enumtype.SocialProvider;
import com.lift.domain.lifetransition.enumtype.AnnualIncomeRange;
import com.lift.domain.lifetransition.enumtype.AssetRange;
import com.lift.domain.lifetransition.enumtype.HouseholdType;
import com.lift.domain.lifetransition.enumtype.HousingType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
        name = "user_accounts",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_accounts_provider_user", columnNames = {"provider", "provider_user_id"}),
                @UniqueConstraint(name = "uk_user_accounts_auth_subject", columnNames = "auth_subject")
        }
)
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SocialProvider provider;

    @Column(name = "provider_user_id", nullable = false, length = 128)
    private String providerUserId;

    @Column(name = "auth_subject", nullable = false, length = 36)
    private String authSubject;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(length = 255)
    private String email;

    @Column(length = 100)
    private String nickname;

    @Column(name = "service_terms_agreed", nullable = false)
    private boolean serviceTermsAgreed;

    @Column(name = "privacy_policy_agreed", nullable = false)
    private boolean privacyPolicyAgreed;

    @Column(name = "marketing_agreed", nullable = false)
    private boolean marketingAgreed;

    @Column(name = "agreement_agreed_at")
    private LocalDateTime agreementAgreedAt;

    @Column(name = "child_name", length = 20)
    private String childName;

    @Column(name = "child_birth_year")
    private Integer childBirthYear;

    @Column(name = "child_birth_month")
    private Integer childBirthMonth;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_care_areas", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "care_area", nullable = false, length = 100)
    private List<String> careAreas = new ArrayList<>();

    @Column(name = "characteristic_keyword", length = 100)
    private String characteristicKeyword;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_interests", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "interest", nullable = false, length = 100)
    private List<String> interests = new ArrayList<>();

    @Column(length = 50)
    private String sido;

    @Column(length = 50)
    private String sigungu;

    @Enumerated(EnumType.STRING)
    @Column(name = "household_type", length = 30)
    private HouseholdType householdType;

    @Enumerated(EnumType.STRING)
    @Column(name = "annual_income_range", length = 30)
    private AnnualIncomeRange annualIncomeRange;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_range", length = 30)
    private AssetRange assetRange;

    @Enumerated(EnumType.STRING)
    @Column(name = "housing_type", length = 30)
    private HousingType housingType;

    @Column(name = "has_dependent_children")
    private Boolean hasDependentChildren;

    @Column(name = "has_supporting_family")
    private Boolean hasSupportingFamily;

    @Column(name = "basic_livelihood_recipient")
    private Boolean basicLivelihoodRecipient;

    @Column(name = "near_poverty")
    private Boolean nearPoverty;

    @Column(name = "single_parent")
    private Boolean singleParent;

    @Column(name = "disabled_person")
    private Boolean disabledPerson;

    @Column(name = "guardian_nickname", length = 20)
    private String guardianNickname;

    @Column(name = "guardian_type", length = 50)
    private String guardianType;

    @Column(name = "community_role_type", length = 50)
    private String communityRoleType;

    @Column(nullable = false)
    private boolean withdrawn;

    protected UserAccount() {
    }

    private UserAccount(
            SocialProvider provider,
            String providerUserId,
            String email,
            String nickname
    ) {
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.authSubject = UUID.randomUUID().toString();
        this.email = email;
        this.nickname = nickname;
        this.createdAt = LocalDateTime.now();
    }

    public static UserAccount createSocialUser(
            SocialProvider provider,
            String providerUserId,
            String email,
            String nickname
    ) {
        return new UserAccount(provider, providerUserId, email, nickname);
    }

    @PrePersist
    void prePersist() {
        if (authSubject == null) {
            authSubject = UUID.randomUUID().toString();
        }

        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public void agreeTerms(boolean serviceTermsAgreed, boolean privacyPolicyAgreed, boolean marketingAgreed) {
        this.serviceTermsAgreed = serviceTermsAgreed;
        this.privacyPolicyAgreed = privacyPolicyAgreed;
        this.marketingAgreed = marketingAgreed;
        this.agreementAgreedAt = LocalDateTime.now();
    }

    public void updateChildProfile(
            String childName,
            Integer childBirthYear,
            Integer childBirthMonth,
            List<String> careAreas,
            String characteristicKeyword
    ) {
        this.childName = childName;
        this.childBirthYear = childBirthYear;
        this.childBirthMonth = childBirthMonth;
        this.careAreas = new ArrayList<>(careAreas);
        this.characteristicKeyword = characteristicKeyword;
    }

    public void updateInterestRegion(List<String> interests, String sido, String sigungu) {
        this.interests = new ArrayList<>(interests);
        this.sido = sido;
        this.sigungu = sigungu;
    }

    public void updateGuardianProfile(String guardianNickname, String guardianType, String communityRoleType) {
        this.guardianNickname = guardianNickname;
        this.guardianType = guardianType;
        this.communityRoleType = communityRoleType;
        this.nickname = guardianNickname;
    }

    public void updateProfile(
            String nickname,
            String childName,
            String guardianType,
            String sido,
            String sigungu,
            HouseholdType householdType,
            AnnualIncomeRange annualIncomeRange,
            AssetRange assetRange,
            HousingType housingType,
            Boolean hasDependentChildren,
            Boolean hasSupportingFamily,
            Boolean basicLivelihoodRecipient,
            Boolean nearPoverty,
            Boolean singleParent,
            Boolean disabledPerson
    ) {
        if (nickname != null && !nickname.isBlank()) {
            this.nickname = nickname;
            this.guardianNickname = nickname;
        }

        if (childName != null && !childName.isBlank()) {
            this.childName = childName;
        }

        if (guardianType != null && !guardianType.isBlank()) {
            this.guardianType = guardianType;
        }

        if (sido != null) {
            this.sido = blankToNull(sido);
        }
        if (sigungu != null) {
            this.sigungu = blankToNull(sigungu);
        }
        if (householdType != null) {
            this.householdType = householdType;
        }
        if (annualIncomeRange != null) {
            this.annualIncomeRange = annualIncomeRange;
        }
        if (assetRange != null) {
            this.assetRange = assetRange;
        }
        if (housingType != null) {
            this.housingType = housingType;
        }
        if (hasDependentChildren != null) {
            this.hasDependentChildren = hasDependentChildren;
        }
        if (hasSupportingFamily != null) {
            this.hasSupportingFamily = hasSupportingFamily;
        }
        if (basicLivelihoodRecipient != null) {
            this.basicLivelihoodRecipient = basicLivelihoodRecipient;
        }
        if (nearPoverty != null) {
            this.nearPoverty = nearPoverty;
        }
        if (singleParent != null) {
            this.singleParent = singleParent;
        }
        if (disabledPerson != null) {
            this.disabledPerson = disabledPerson;
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    public void withdraw() {
        this.withdrawn = true;
    }

    public boolean isAgreementCompleted() {
        return serviceTermsAgreed && privacyPolicyAgreed;
    }

    public boolean isChildProfileRegistered() {
        return childBirthYear != null && childBirthMonth != null && !careAreas.isEmpty();
    }

    public boolean isInterestRegionRegistered() {
        return !interests.isEmpty() && sido != null && sigungu != null;
    }

    public boolean isGuardianProfileRegistered() {
        return guardianNickname != null && guardianType != null && communityRoleType != null;
    }

    public boolean isOnboardingCompleted() {
        return isChildProfileRegistered() && isInterestRegionRegistered() && isGuardianProfileRegistered();
    }

    public Long getId() {
        return id;
    }

    public SocialProvider getProvider() {
        return provider;
    }

    public String getProviderUserId() {
        return providerUserId;
    }

    public String getAuthSubject() {
        return authSubject;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getEmail() {
        return email;
    }

    public String getNickname() {
        return nickname;
    }

    public boolean isServiceTermsAgreed() {
        return serviceTermsAgreed;
    }

    public boolean isPrivacyPolicyAgreed() {
        return privacyPolicyAgreed;
    }

    public boolean isMarketingAgreed() {
        return marketingAgreed;
    }

    public LocalDateTime getAgreementAgreedAt() {
        return agreementAgreedAt;
    }

    public String getChildName() {
        return childName;
    }

    public Integer getChildBirthYear() {
        return childBirthYear;
    }

    public Integer getChildBirthMonth() {
        return childBirthMonth;
    }

    public List<String> getCareAreas() {
        return List.copyOf(careAreas);
    }

    public String getCharacteristicKeyword() {
        return characteristicKeyword;
    }

    public List<String> getInterests() {
        return List.copyOf(interests);
    }

    public String getSido() {
        return sido;
    }

    public String getSigungu() {
        return sigungu;
    }

    public HouseholdType getHouseholdType() {
        return householdType;
    }

    public AnnualIncomeRange getAnnualIncomeRange() {
        return annualIncomeRange;
    }

    public AssetRange getAssetRange() {
        return assetRange;
    }

    public HousingType getHousingType() {
        return housingType;
    }

    public Boolean getHasDependentChildren() {
        return hasDependentChildren;
    }

    public Boolean getHasSupportingFamily() {
        return hasSupportingFamily;
    }

    public Boolean getBasicLivelihoodRecipient() {
        return basicLivelihoodRecipient;
    }

    public Boolean getNearPoverty() {
        return nearPoverty;
    }

    public Boolean getSingleParent() {
        return singleParent;
    }

    public Boolean getDisabledPerson() {
        return disabledPerson;
    }

    public String getGuardianNickname() {
        return guardianNickname;
    }

    public String getGuardianType() {
        return guardianType;
    }

    public String getCommunityRoleType() {
        return communityRoleType;
    }

    public boolean isWithdrawn() {
        return withdrawn;
    }
}
