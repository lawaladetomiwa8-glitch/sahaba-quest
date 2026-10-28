"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ArticleLike = { id: string; user_id: string };
type ArticleComment = {
  id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

type Props = {
  articleId: string;
  articleTitle: string;
  articleUrl: string;
};

const cardStyle: React.CSSProperties = {
  marginTop: 36,
  paddingTop: 28,
  borderTop: "1px solid var(--border)",
};

const actionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontWeight: 700,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  font: "inherit",
};

export default function SahabahArticleEngagement({
  articleId,
  articleTitle,
  articleUrl,
}: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadEngagement = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [{ data: authData }, { count, error: likesError }, { data: commentsData, error: commentsError }] =
        await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("sahabah_article_likes")
            .select("id", { count: "exact", head: true })
            .eq("article_id", articleId),
          supabase
            .from("sahabah_article_comments")
            .select("id, user_id, author_name, content, created_at")
            .eq("article_id", articleId)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

      if (likesError) throw likesError;
      if (commentsError) throw commentsError;

      const currentUserId = authData.user?.id ?? null;
      setUserId(currentUserId);
      setLikes(count ?? 0);
      setComments((commentsData ?? []) as ArticleComment[]);

      if (currentUserId) {
        const { data: ownLike, error: ownLikeError } = await supabase
          .from("sahabah_article_likes")
          .select("id")
          .eq("article_id", articleId)
          .eq("user_id", currentUserId)
          .maybeSingle();

        if (ownLikeError) throw ownLikeError;
        setLiked(Boolean(ownLike));
      } else {
        setLiked(false);
      }
    } catch (err) {
      console.error("Failed to load article engagement:", err);
      setError("We couldn't load likes and comments. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    void loadEngagement();
  }, [loadEngagement]);

  async function toggleLike() {
    setNotice("");
    setError("");

    if (!userId) {
      setNotice("Please sign in to like this article.");
      return;
    }

    setLikeBusy(true);
    try {
      if (liked) {
        const { error: deleteError } = await supabase
          .from("sahabah_article_likes")
          .delete()
          .eq("article_id", articleId)
          .eq("user_id", userId);
        if (deleteError) throw deleteError;
        setLiked(false);
        setLikes((current) => Math.max(0, current - 1));
      } else {
        const { error: insertError } = await supabase
          .from("sahabah_article_likes")
          .insert({ article_id: articleId, user_id: userId });
        if (insertError) throw insertError;
        setLiked(true);
        setLikes((current) => current + 1);
      }
    } catch (err) {
      console.error("Failed to update article like:", err);
      setError("Your like couldn't be updated. Please try again.");
    } finally {
      setLikeBusy(false);
    }
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");

    const content = commentText.trim();
    if (!content) {
      setError("Please write a comment first.");
      return;
    }
    if (!userId) {
      setNotice("Please sign in to comment on this article.");
      return;
    }

    setCommentBusy(true);
    try {
      const { error: insertError } = await supabase
        .from("sahabah_article_comments")
        .insert({
          article_id: articleId,
          user_id: userId,
          content,
        });

      if (insertError) throw insertError;
      setCommentText("");
      setNotice("Your comment has been added.");
      await loadEngagement();
    } catch (err) {
      console.error("Failed to post article comment:", err);
      setError("Your comment couldn't be posted. Please try again.");
    } finally {
      setCommentBusy(false);
    }
  }

  async function copyLink() {
    setNotice("");
    setError("");
    try {
      await navigator.clipboard.writeText(articleUrl);
      setNotice("Article link copied. Share it with your friends and family.");
    } catch {
      setError("We couldn't copy the link automatically. You can copy the article URL from your browser.");
    }
  }

  async function shareArticle() {
    setNotice("");
    setError("");
    const absoluteUrl =
      typeof window !== "undefined" && articleUrl.startsWith("/")
        ? `${window.location.origin}${articleUrl}`
        : articleUrl;

    if (navigator.share) {
      try {
        await navigator.share({
          title: articleTitle,
          text: `Read this Sahaba Quest article: ${articleTitle}`,
          url: absoluteUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    await copyLink();
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `Read this Sahaba Quest article: ${articleTitle} ${typeof window !== "undefined" && articleUrl.startsWith("/") ? `${window.location.origin}${articleUrl}` : articleUrl}`,
  )}`;

  return (
    <section style={cardStyle} aria-labelledby="article-engagement-title">
      <div style={{ marginBottom: 20 }}>
        <h2
          id="article-engagement-title"
          style={{ margin: 0, fontSize: 24, fontWeight: 900 }}
        >
          Enjoyed this article?
        </h2>
        <p className="sq-subtitle" style={{ marginTop: 8 }}>
          Share what you've learned and help others discover the lives of the Sahabah.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button
          type="button"
          onClick={() => void toggleLike()}
          disabled={loading || likeBusy}
          aria-pressed={liked}
          style={{
            ...actionStyle,
            borderColor: liked ? "var(--primary)" : "var(--border)",
            background: liked ? "var(--primary-light)" : "var(--background)",
          }}
        >
          <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
          {liked ? "Liked" : "Like"} · {likes}
        </button>
        <button type="button" onClick={() => void shareArticle()} style={actionStyle}>
          <span aria-hidden="true">↗</span> Share
        </button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...actionStyle, textDecoration: "none" }}
        >
          Share on WhatsApp
        </a>
        <button type="button" onClick={() => void copyLink()} style={actionStyle}>
          Copy link
        </button>
      </div>

      {!userId && !loading && (
        <p className="sq-subtitle" style={{ marginTop: 12 }}>
          Sign in to like or comment. Everyone can read and share this article.
          {" "}
          <a href="/login" style={{ color: "var(--primary)", fontWeight: 800 }}>
            Sign in
          </a>
        </p>
      )}

      {notice && (
        <p role="status" style={{ color: "var(--primary)", marginTop: 12 }}>
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: "#b91c1c", marginTop: 12 }}>
          {error}
        </p>
      )}

      <div style={{ marginTop: 30 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 900 }}>
          Comments ({comments.length})
        </h3>

        <form onSubmit={submitComment} style={{ display: "grid", gap: 10 }}>
          <label htmlFor={`article-comment-${articleId}`} style={{ fontWeight: 700, fontSize: 14 }}>
            Add your reflection or comment
          </label>
          <textarea
            id={`article-comment-${articleId}`}
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder={userId ? "What did you learn from this article?" : "Sign in to join the discussion."}
            maxLength={2000}
            rows={4}
            disabled={!userId || commentBusy}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="submit"
              className="sq-button-primary"
              disabled={!userId || commentBusy || !commentText.trim()}
              style={{ border: 0, cursor: !userId || commentBusy ? "not-allowed" : "pointer" }}
            >
              {commentBusy ? "Posting..." : "Post comment"}
            </button>
            <span className="sq-subtitle" style={{ fontSize: 12 }}>
              Maximum 2,000 characters.
            </span>
          </div>
        </form>

        <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
          {loading ? (
            <p className="sq-subtitle">Loading discussion...</p>
          ) : comments.length === 0 ? (
            <p className="sq-subtitle">No comments yet. Be the first to share a reflection.</p>
          ) : (
            comments.map((comment) => (
              <article
                key={comment.id}
                style={{
                  padding: 16,
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "var(--background)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong>{comment.author_name || "Sahaba Quest member"}</strong>
                  <time dateTime={comment.created_at} className="sq-subtitle" style={{ fontSize: 12 }}>
                    {new Date(comment.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
                <p style={{ margin: "10px 0 0", lineHeight: 1.75, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {comment.content}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}