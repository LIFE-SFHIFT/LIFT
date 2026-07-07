package com.lift.domain.lifetransition.model;

import com.lift.domain.lifetransition.enumtype.AssessmentStatus;
import com.lift.domain.lifetransition.enumtype.AnnualIncomeRange;
import com.lift.domain.lifetransition.enumtype.AssetRange;
import com.lift.domain.lifetransition.enumtype.CurrentIncomeStatus;
import com.lift.domain.lifetransition.enumtype.HouseholdType;
import com.lift.domain.lifetransition.enumtype.HousingType;
import com.lift.domain.lifetransition.enumtype.LifeEventType;
import com.lift.domain.lifetransition.enumtype.NextJobStatus;
import com.lift.domain.lifetransition.enumtype.ResignationReason;
import com.lift.domain.user.model.UserAccount;
import com.lift.global.common.entity.BaseCreatedUpdatedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 생애 전환 진단. 사용자가 입력한 이벤트/상황 정보를 담고, 룰 엔진 분석의 입력이 된다.
 */
@Entity
@Getter
@Table(name = "life_assessments")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LifeAssessment extends BaseCreatedUpdatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount userAccount;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private LifeEventType eventType;

    @Column(name = "retirement_date")
    private LocalDate retirementDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "resignation_reason", length = 30)
    private ResignationReason resignationReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "next_job_status", length = 20)
    private NextJobStatus nextJobStatus;

    @Column(name = "employment_insurance_months")
    private Integer employmentInsuranceMonths;

    @Enumerated(EnumType.STRING)
    @Column(name = "current_income_status", length = 20)
    private CurrentIncomeStatus currentIncomeStatus;

    @Column(name = "region_sido", length = 50)
    private String regionSido;

    @Column(name = "region_sigungu", length = 50)
    private String regionSigungu;

    /** 월 평균임금(세전, 원). 실업급여/퇴직금 등 예상 금액 계산의 기준값. */
    @Column(name = "monthly_average_wage")
    private Integer monthlyAverageWage;

    /** 만 나이. 실업급여 소정급여일수(50세 이상 우대) 판단에 사용. */
    @Column(name = "age")
    private Integer age;

    /** 근속연수(년). 퇴직금 계산에 사용. */
    @Column(name = "tenure_years")
    private Integer tenureYears;

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

    @Column(name = "basic_livelihood_recipient")
    private Boolean basicLivelihoodRecipient;

    @Column(name = "near_poverty")
    private Boolean nearPoverty;

    @Column(name = "single_parent")
    private Boolean singleParent;

    @Column(name = "disabled_person")
    private Boolean disabledPerson;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private AssessmentStatus status;

    @Builder
    private LifeAssessment(
            UserAccount userAccount,
            LifeEventType eventType,
            LocalDate retirementDate,
            ResignationReason resignationReason,
            NextJobStatus nextJobStatus,
            Integer employmentInsuranceMonths,
            CurrentIncomeStatus currentIncomeStatus,
            String regionSido,
            String regionSigungu,
            Integer monthlyAverageWage,
            Integer age,
            Integer tenureYears,
            HouseholdType householdType,
            AnnualIncomeRange annualIncomeRange,
            AssetRange assetRange,
            HousingType housingType,
            Boolean hasDependentChildren,
            Boolean basicLivelihoodRecipient,
            Boolean nearPoverty,
            Boolean singleParent,
            Boolean disabledPerson
    ) {
        this.userAccount = userAccount;
        this.eventType = eventType;
        this.retirementDate = retirementDate;
        this.resignationReason = resignationReason;
        this.nextJobStatus = nextJobStatus;
        this.employmentInsuranceMonths = employmentInsuranceMonths;
        this.currentIncomeStatus = currentIncomeStatus;
        this.regionSido = regionSido;
        this.regionSigungu = regionSigungu;
        this.monthlyAverageWage = monthlyAverageWage;
        this.age = age;
        this.tenureYears = tenureYears;
        this.householdType = householdType;
        this.annualIncomeRange = annualIncomeRange;
        this.assetRange = assetRange;
        this.housingType = housingType;
        this.hasDependentChildren = hasDependentChildren;
        this.basicLivelihoodRecipient = basicLivelihoodRecipient;
        this.nearPoverty = nearPoverty;
        this.singleParent = singleParent;
        this.disabledPerson = disabledPerson;
        this.status = AssessmentStatus.DRAFT;
    }

    /**
     * 진단 보완 입력. 값이 전달된 필드만 갱신하고(null은 무시), 나머지 필드는 그대로 둔다.
     */
    public void updatePartial(Integer nextAge, Integer nextTenureYears) {
        if (nextAge != null) {
            this.age = nextAge;
        }
        if (nextTenureYears != null) {
            this.tenureYears = nextTenureYears;
        }
    }

    public void markAnalyzed() {
        if (this.status == AssessmentStatus.DRAFT) {
            this.status = AssessmentStatus.ANALYZED;
        }
    }

    public void markPaid() {
        this.status = AssessmentStatus.PAID;
    }

    public boolean isOwnedBy(Long userId) {
        return userAccount != null && userAccount.getId() != null && userAccount.getId().equals(userId);
    }
}
