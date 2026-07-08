"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { api, ApiError } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

function ChatInner({ reportId }: { reportId: number }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [limit, setLimit] = useState(10);
  const [used, setUsed] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getChatMessages(reportId)
      .then((data) => {
        setMessages(data.messages);
        setLimit(data.aiQuestionLimit);
        setUsed(data.aiQuestionUsedCount);
        setLoaded(true);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.code === "LIFE403_2") {
          router.replace(`/report/${reportId}/preview`);
          return;
        }
        if (e instanceof ApiError && e.code === "LIFE403_4") {
          setError("AI 질문은 확장 리포트 결제 후 이용할 수 있어요.");
          setLoaded(true);
          return;
        }
        setError(e instanceof ApiError ? e.message : "채팅을 불러오지 못했어요.");
        setLoaded(true);
      });
  }, [reportId, router]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const remaining = Math.max(0, limit - used);
  const limitReached = remaining <= 0;

  async function handleSend() {
    const content = input.trim();
    if (!content || sending || limitReached) return;
    setSending(true);
    setError(null);

    // 사용자 메시지를 낙관적으로 먼저 표시
    const optimistic: ChatMessage = {
      messageId: -Date.now(),
      senderType: "USER",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const res = await api.sendChatMessage(reportId, content);
      setMessages((prev) => [
        ...prev.filter((m) => m.messageId !== optimistic.messageId),
        res.userMessage,
        res.aiMessage,
      ]);
      setUsed(res.aiQuestionUsedCount);
      setLimit(res.aiQuestionLimit);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.messageId !== optimistic.messageId));
      setInput(content);
      if (e instanceof ApiError && e.code === "LIFE403_3") {
        setUsed(limit);
        setError("AI 질문 가능 횟수(10회)를 모두 사용했어요.");
      } else {
        setError(e instanceof ApiError ? e.message : "메시지 전송에 실패했어요.");
      }
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <button type="button" className="link-btn" onClick={() => router.push(`/report/${reportId}`)}>
          ← 리포트로
        </button>
        <p className="step-hint" style={{ margin: 0, marginLeft: "auto" }}>
          STEP 6 · AI 질문
        </p>
      </div>
      <h1 className="page-title" style={{ fontSize: 20 }}>
        리포트 기반 AI 질문
      </h1>
      <p className="quota">
        남은 질문 {remaining}회 / 총 {limit}회
      </p>

      {error && <div className="error-box">{error}</div>}

      <div className="chat-log" ref={logRef} style={{ flex: 1, overflowY: "auto" }}>
        {!loaded && <div className="center-state">불러오는 중…</div>}
        {loaded && messages.length === 0 && (
          <div className="center-state">
            리포트 내용에 대해 궁금한 점을 물어보세요.
            <br />
            예: &ldquo;실업급여는 언제까지 신청해야 하나요?&rdquo;
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.messageId}
            className={`bubble ${m.senderType === "USER" ? "user" : "ai"}`}
          >
            {m.content}
          </div>
        ))}
      </div>

      <div className="sticky-cta">
        <div className="chat-input-row">
          <textarea
            rows={2}
            placeholder={limitReached ? "질문 횟수를 모두 사용했어요" : "질문을 입력하세요"}
            value={input}
            disabled={limitReached || sending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="btn"
            disabled={limitReached || sending || !input.trim()}
            onClick={handleSend}
          >
            {sending ? "전송 중" : "전송"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function ReportChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AppShell showLogout>
      <AuthGuard>
        <ChatInner reportId={Number(id)} />
      </AuthGuard>
    </AppShell>
  );
}
