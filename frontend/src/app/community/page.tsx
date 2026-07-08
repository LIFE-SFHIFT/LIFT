"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { ChatIcon, HeartIcon, PencilIcon, TrashIcon } from "@/components/Icons";
import { api, ApiError } from "@/lib/api";
import { eventTypeLabel } from "@/lib/labels";
import type {
  CommunityCategory,
  CommunityPostCreateRequest,
  CommunityPostSummary,
} from "@/lib/types";

type CategoryFilter = "ALL" | CommunityCategory;
type CommunityMode = "latest" | "popular";

const CATEGORY_TABS: { value: CategoryFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "JOB_CHANGE", label: "이직" },
  { value: "RETIREMENT", label: "퇴직" },
];

// 아직 개발 중이라 선택할 수 없는(비활성) 분야
const LOCKED_CATEGORY_TABS: { key: string; label: string }[] = [
  { key: "marriage", label: "결혼" },
  { key: "parental-leave", label: "육아휴직" },
];

const POST_CATEGORIES: CommunityCategory[] = ["JOB_CHANGE", "RETIREMENT"];

const MODE_LABEL: Record<CommunityMode, string> = {
  latest: "최신글",
  popular: "인기글",
};

const CATEGORY_TAG_CLASS: Record<CommunityCategory, string> = {
  JOB_CHANGE: "job-change",
  RETIREMENT: "retirement",
  UNEMPLOYMENT: "unemployment",
};

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;

  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function CommunityPostCard({
  post,
  index,
  mode,
  onLike,
  onDelete,
}: {
  post: CommunityPostSummary;
  index: number;
  mode: CommunityMode;
  onLike: (post: CommunityPostSummary) => void;
  onDelete: (post: CommunityPostSummary) => void;
}) {
  return (
    <article className="post-card">
      <Link href={`/community/${post.postId}`} className="post-card-link">
        <div className="post-top">
          {mode === "popular" && (
            <span className={`post-rank ${index < 3 ? `r${index + 1}` : ""}`}>
              {index + 1}위
            </span>
          )}
          <span className={`post-tag ${CATEGORY_TAG_CLASS[post.category]}`}>
            {eventTypeLabel[post.category]}
          </span>
          <span className="post-time">{post.authorName}</span>
          <span className="post-time">{formatRelativeTime(post.createdAt)}</span>
        </div>
        <h2 className="post-title">{post.title}</h2>
        <p className="post-excerpt">{post.contentPreview}</p>
      </Link>

      <div className="post-actions">
        <button
          type="button"
          className={`pill-btn ${post.liked ? "liked" : ""}`}
          onClick={() => onLike(post)}
          aria-label={post.liked ? "좋아요 취소" : "좋아요"}
        >
          <HeartIcon filled={post.liked} /> {post.likeCount}
        </button>
        <Link href={`/community/${post.postId}`} className="pill-btn">
          <ChatIcon /> {post.commentCount}
        </Link>
        {post.mine && (
          <button
            type="button"
            className="pill-btn danger"
            onClick={() => onDelete(post)}
            aria-label="글 삭제"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </article>
  );
}

function CommunityInner() {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [mode, setMode] = useState<CommunityMode>("latest");
  const [posts, setPosts] = useState<CommunityPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [formCategory, setFormCategory] = useState<CommunityCategory>("JOB_CHANGE");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);

    api
      .getCommunityPosts(category, mode)
      .then((data) => {
        if (!ignore) setPosts(data);
      })
      .catch((e) => {
        if (!ignore) {
          setError(e instanceof ApiError ? e.message : "커뮤니티 글을 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [category, mode]);

  useEffect(() => {
    if (category !== "ALL") {
      setFormCategory(category);
    }
  }, [category]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload: CommunityPostCreateRequest = {
      category: formCategory,
      title: title.trim(),
      content: content.trim(),
    };
    if (!payload.title || !payload.content) {
      setError("제목과 내용을 모두 입력해 주세요.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const created = await api.createCommunityPost(payload);
      setTitle("");
      setContent("");
      router.push(`/community/${created.postId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "글 작성에 실패했어요.");
    } finally {
      setCreating(false);
    }
  }

  async function handleLike(post: CommunityPostSummary) {
    try {
      const result = post.liked
        ? await api.unlikeCommunityPost(post.postId)
        : await api.likeCommunityPost(post.postId);
      setPosts((prev) =>
        prev.map((item) =>
          item.postId === post.postId
            ? { ...item, liked: result.liked, likeCount: result.likeCount }
            : item,
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "좋아요 처리에 실패했어요.");
    }
  }

  async function handleDelete(post: CommunityPostSummary) {
    if (!window.confirm("이 글을 삭제할까요?")) return;
    try {
      await api.deleteCommunityPost(post.postId);
      setPosts((prev) => prev.filter((item) => item.postId !== post.postId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "글 삭제에 실패했어요.");
    }
  }

  const totalLikes = posts.reduce((sum, post) => sum + post.likeCount, 0);
  const totalComments = posts.reduce((sum, post) => sum + post.commentCount, 0);

  return (
    <main className="content-narrow section-page">
      <div className="page-head">
        <div className="page-head-copy">
          <span className="page-eyebrow">커뮤니티</span>
          <h1>상황별 익명 게시판</h1>
          <p className="page-head-sub">같은 상황을 겪는 사람들과 정보를 나눠보세요.</p>
        </div>
        <div className="stat-row">
          <div className="stat-chip">
            <b>{posts.length}</b>
            <span>{MODE_LABEL[mode]}</span>
          </div>
          <div className="stat-chip">
            <b>{totalLikes}</b>
            <span>좋아요</span>
          </div>
          <div className="stat-chip">
            <b>{totalComments}</b>
            <span>댓글</span>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="chip-row" aria-label="커뮤니티 분야 선택">
          {CATEGORY_TABS.map((tab) => (
            <button
              type="button"
              key={tab.value}
              className={`chip-filter ${category === tab.value ? "active" : ""}`}
              onClick={() => setCategory(tab.value)}
            >
              {tab.label}
            </button>
          ))}
          {LOCKED_CATEGORY_TABS.map((tab) => (
            <button
              type="button"
              key={tab.key}
              className="chip-filter locked"
              disabled
              aria-disabled="true"
              title="아직 준비 중인 분야예요"
            >
              {tab.label} 🔒
            </button>
          ))}
        </div>

        <div className="segment" aria-label="글 보기 방식">
          <button
            type="button"
            className={mode === "latest" ? "active" : ""}
            onClick={() => setMode("latest")}
          >
            최신글
          </button>
          <button
            type="button"
            className={mode === "popular" ? "active" : ""}
            onClick={() => setMode("popular")}
          >
            인기글
          </button>
        </div>

        <button
          type="button"
          className={`write-btn ${composerOpen ? "ghost" : ""}`}
          onClick={() => setComposerOpen((open) => !open)}
        >
          {composerOpen ? (
            "닫기"
          ) : (
            <>
              <PencilIcon /> 글쓰기
            </>
          )}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {composerOpen && (
        <form className="composer-card" onSubmit={handleCreate}>
          <div className="composer-head">
            <div>
              <h2>익명으로 글쓰기</h2>
              <p>닉네임 대신 ‘익명’으로 표시돼요.</p>
            </div>
          </div>
          <div className="cat-pick" role="radiogroup" aria-label="글 분야">
            {POST_CATEGORIES.map((item) => (
              <button
                type="button"
                key={item}
                className={formCategory === item ? "on" : ""}
                aria-pressed={formCategory === item}
                onClick={() => setFormCategory(item)}
              >
                {eventTypeLabel[item]}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="제목"
            aria-label="글 제목"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={3000}
            rows={5}
            placeholder="상황, 궁금한 점, 확인한 정보를 적어주세요."
            aria-label="글 내용"
          />
          <div className="composer-foot">
            <span className="char-count">
              {content.length.toLocaleString()} / 3,000
            </span>
            <div className="composer-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setComposerOpen(false)}
              >
                취소
              </button>
              <button type="submit" className="btn" disabled={creating}>
                {creating ? "작성 중…" : "올리기"}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="post-list">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-panel">
          <div className="empty-ico">
            <ChatIcon size={22} />
          </div>
          <b>아직 글이 없어요</b>
          <span>첫 글을 남기면 같은 상황의 사람들이 볼 수 있어요.</span>
        </div>
      ) : (
        <div className="post-list">
          {posts.map((post, index) => (
            <CommunityPostCard
              key={post.postId}
              post={post}
              index={index}
              mode={mode}
              onLike={handleLike}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default function CommunityPage() {
  return (
    <AppShell showLogout wide>
      <AuthGuard>
        <CommunityInner />
      </AuthGuard>
    </AppShell>
  );
}
