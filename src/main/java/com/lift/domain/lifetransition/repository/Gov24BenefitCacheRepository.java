package com.lift.domain.lifetransition.repository;

import com.lift.domain.lifetransition.model.Gov24BenefitCache;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface Gov24BenefitCacheRepository extends JpaRepository<Gov24BenefitCache, Long> {

    /** 동기화 시 정부24 서비스ID(external_id)로 기존 행을 찾아 UPSERT 판단에 쓴다. */
    Optional<Gov24BenefitCache> findByExternalId(String externalId);

    /** 아직 AI 구조화 추출이 안 된(criteria_extracted_at IS NULL) 행 목록. 추출 배치 대상. */
    List<Gov24BenefitCache> findByCriteriaExtractedAtIsNull();
}
