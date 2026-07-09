package com.lift.domain.community.repository;

import com.lift.domain.community.model.CommunityComment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityCommentRepository extends JpaRepository<CommunityComment, Long> {

    List<CommunityComment> findByPost_IdOrderByIdAsc(Long postId);

    void deleteByPost_Id(Long postId);
}
