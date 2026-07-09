package com.lift.domain.community.service;

import com.lift.domain.community.dto.request.CommunityCommentCreateReqDTO;
import com.lift.domain.community.dto.request.CommunityPostCreateReqDTO;
import com.lift.domain.community.dto.response.CommunityCommentResDTO;
import com.lift.domain.community.dto.response.CommunityPostDetailResDTO;
import com.lift.domain.community.dto.response.CommunityPostLikeResDTO;
import com.lift.domain.community.dto.response.CommunityPostSummaryResDTO;
import com.lift.domain.community.model.CommunityComment;
import com.lift.domain.community.model.CommunityPost;
import com.lift.domain.community.model.CommunityPostLike;
import com.lift.domain.community.repository.CommunityCommentRepository;
import com.lift.domain.community.repository.CommunityPostLikeRepository;
import com.lift.domain.community.repository.CommunityPostRepository;
import com.lift.domain.lifetransition.enumtype.LifeEventType;
import com.lift.domain.user.model.UserAccount;
import com.lift.domain.user.service.UserAccountStore;
import com.lift.domain.user.service.UserService;
import com.lift.global.apiPayload.code.GeneralErrorCode;
import com.lift.global.apiPayload.exception.ProjectException;
import com.lift.global.auth.AuthUserPrincipal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CommunityService {

    private static final int DEFAULT_SIZE = 30;
    private static final int MAX_SIZE = 50;

    private final CommunityPostRepository communityPostRepository;
    private final CommunityCommentRepository communityCommentRepository;
    private final CommunityPostLikeRepository communityPostLikeRepository;
    private final UserService userService;
    private final UserAccountStore userAccountStore;

    /**
     * 요청 사용자를 해석한다. 로그인 사용자는 본인 계정, 비로그인(데모) 요청은
     * 공유 데모 계정으로 귀속해 글이 PostgreSQL에 함께 저장되도록 한다.
     */
    private UserAccount resolveUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof AuthUserPrincipal) {
            return userService.getCurrentUser(authentication);
        }
        return userAccountStore.getOrCreateDemoUser();
    }

    @Transactional(readOnly = true)
    public List<CommunityPostSummaryResDTO> getPosts(
            Authentication authentication,
            LifeEventType category,
            Integer size
    ) {
        UserAccount user = resolveUser(authentication);
        Pageable pageable = PageRequest.of(0, normalizeSize(size));
        List<CommunityPost> posts = category == null
                ? communityPostRepository.findAllByOrderByIdDesc(pageable)
                : communityPostRepository.findByCategoryOrderByIdDesc(category, pageable);

        return posts.stream()
                .map(post -> CommunityPostSummaryResDTO.from(
                        post,
                        user.getId(),
                        communityPostLikeRepository.existsByPost_IdAndUser_Id(post.getId(), user.getId())
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CommunityPostSummaryResDTO> getPopularPosts(
            Authentication authentication,
            LifeEventType category,
            Integer size
    ) {
        UserAccount user = resolveUser(authentication);
        Pageable pageable = PageRequest.of(0, normalizeSize(size));
        List<CommunityPost> posts = category == null
                ? communityPostRepository.findAllByOrderByLikeCountDescIdDesc(pageable)
                : communityPostRepository.findByCategoryOrderByLikeCountDescIdDesc(category, pageable);

        return posts.stream()
                .map(post -> CommunityPostSummaryResDTO.from(
                        post,
                        user.getId(),
                        communityPostLikeRepository.existsByPost_IdAndUser_Id(post.getId(), user.getId())
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public CommunityPostDetailResDTO getPost(Authentication authentication, Long postId) {
        UserAccount user = resolveUser(authentication);
        CommunityPost post = findPost(postId);
        boolean liked = communityPostLikeRepository.existsByPost_IdAndUser_Id(post.getId(), user.getId());
        List<CommunityCommentResDTO> comments = communityCommentRepository.findByPost_IdOrderByIdAsc(post.getId())
                .stream()
                .map(comment -> CommunityCommentResDTO.from(comment, user.getId()))
                .toList();

        return CommunityPostDetailResDTO.from(post, user.getId(), liked, comments);
    }

    @Transactional
    public CommunityPostDetailResDTO createPost(
            Authentication authentication,
            CommunityPostCreateReqDTO request
    ) {
        UserAccount user = resolveUser(authentication);
        CommunityPost post = CommunityPost.create(
                user,
                request.category(),
                request.title().trim(),
                request.content().trim()
        );
        CommunityPost saved = communityPostRepository.save(post);
        return CommunityPostDetailResDTO.from(saved, user.getId(), false, List.of());
    }

    @Transactional
    public boolean deletePost(Authentication authentication, Long postId) {
        UserAccount user = resolveUser(authentication);
        CommunityPost post = findPost(postId);
        if (!post.isAuthoredBy(user.getId())) {
            throw new ProjectException(GeneralErrorCode.FORBIDDEN);
        }

        Long deletePostId = post.getId();
        communityPostLikeRepository.deleteByPost_Id(deletePostId);
        communityCommentRepository.deleteByPost_Id(deletePostId);
        communityPostRepository.delete(post);
        return true;
    }

    @Transactional
    public CommunityPostLikeResDTO likePost(Authentication authentication, Long postId) {
        UserAccount user = resolveUser(authentication);
        CommunityPost post = findPost(postId);

        if (!communityPostLikeRepository.existsByPost_IdAndUser_Id(post.getId(), user.getId())) {
            communityPostLikeRepository.save(CommunityPostLike.create(post, user));
            post.increaseLikeCount();
        }

        return new CommunityPostLikeResDTO(post.getId(), post.getLikeCount(), true);
    }

    @Transactional
    public CommunityPostLikeResDTO unlikePost(Authentication authentication, Long postId) {
        UserAccount user = resolveUser(authentication);
        CommunityPost post = findPost(postId);

        communityPostLikeRepository.findByPost_IdAndUser_Id(post.getId(), user.getId())
                .ifPresent(like -> {
                    communityPostLikeRepository.delete(like);
                    post.decreaseLikeCount();
                });

        return new CommunityPostLikeResDTO(post.getId(), post.getLikeCount(), false);
    }

    @Transactional
    public CommunityCommentResDTO createComment(
            Authentication authentication,
            Long postId,
            CommunityCommentCreateReqDTO request
    ) {
        UserAccount user = resolveUser(authentication);
        CommunityPost post = findPost(postId);
        CommunityComment comment = communityCommentRepository.save(
                CommunityComment.create(post, user, request.content().trim())
        );
        post.increaseCommentCount();

        return CommunityCommentResDTO.from(comment, user.getId());
    }

    @Transactional
    public boolean deleteComment(Authentication authentication, Long postId, Long commentId) {
        UserAccount user = resolveUser(authentication);
        CommunityPost post = findPost(postId);
        CommunityComment comment = communityCommentRepository.findById(commentId)
                .orElseThrow(() -> new ProjectException(GeneralErrorCode.NOT_FOUND));

        if (!comment.getPost().getId().equals(post.getId())) {
            throw new ProjectException(GeneralErrorCode.NOT_FOUND);
        }
        if (!comment.isAuthoredBy(user.getId())) {
            throw new ProjectException(GeneralErrorCode.FORBIDDEN);
        }

        communityCommentRepository.delete(comment);
        post.decreaseCommentCount();
        return true;
    }

    private CommunityPost findPost(Long postId) {
        return communityPostRepository.findById(postId)
                .orElseThrow(() -> new ProjectException(GeneralErrorCode.NOT_FOUND));
    }

    private int normalizeSize(Integer size) {
        if (size == null) {
            return DEFAULT_SIZE;
        }
        return Math.min(Math.max(size, 1), MAX_SIZE);
    }
}
