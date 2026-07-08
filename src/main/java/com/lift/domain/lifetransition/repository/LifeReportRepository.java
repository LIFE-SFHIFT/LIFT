package com.lift.domain.lifetransition.repository;

import com.lift.domain.lifetransition.enumtype.PaymentStatus;
import com.lift.domain.lifetransition.model.LifeReport;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LifeReportRepository extends JpaRepository<LifeReport, Long> {

    Optional<LifeReport> findByAssessment_Id(Long assessmentId);

    Optional<LifeReport> findFirstByAssessment_UserAccount_IdAndPaymentStatusOrderByPaidAtDescIdDesc(
            Long userId,
            PaymentStatus paymentStatus
    );

    List<LifeReport> findByAssessment_UserAccount_IdAndPaymentStatusOrderByPaidAtDescIdDesc(
            Long userId,
            PaymentStatus paymentStatus
    );

    Optional<LifeReport> findFirstByAssessment_UserAccount_IdOrderByIdDesc(Long userId);
}
