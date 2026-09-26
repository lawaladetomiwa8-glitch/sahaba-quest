 "use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  challenge_type: string | null;
  question_count: number;
  time_per_question: number;
  is_premium: boolean;

  // Number of published questions actually linked to this challenge.
  // This is what determines whether the challenge is available.
  available_question_count: number;
};

type Attempt = {
  id: string;
  challenge_id: string;
  questions_answered: number;
  correct_answers: number;
  score: number;
  status: "in_progress" | "completed" | "abandoned";
  passed: boolean | null;
};

const SESSION_KEY = "sahabaquest_family_member_session";

export default function FamilyMemberChallengesPage() {
  const router = useRouter();

  const [memberName, setMemberName] = useState("Family Member");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem(SESSION_KEY);

      if (!token) {
        router.replace("/family-member-login");
        return;
      }

      // ------------------------------------------------------------
      // VERIFY FAMILY MEMBER SESSION
      // ------------------------------------------------------------

      const { data: sessionData, error: sessionError } =
        await supabase.rpc("get_family_member_session", {
          p_session_token: token,
        });

      if (sessionError) throw sessionError;

      if (
        !sessionData ||
        !Array.isArray(sessionData) ||
        sessionData.length === 0
      ) {
        sessionStorage.removeItem(SESSION_KEY);
        router.replace("/family-member-login");
        return;
      }

      const session = sessionData[0];

      setMemberName(session.display_name || "Family Member");

      // ------------------------------------------------------------
      // LOAD ACTIVE CHALLENGES
      // ------------------------------------------------------------

      const { data: challengeData, error: challengeError } =
        await supabase
          .from("challenges")
          .select(
            "id,title,description,icon,challenge_type,question_count,time_per_question,is_premium"
          )
          .eq("is_active", true)
          .order("created_at", { ascending: true });

      if (challengeError) throw challengeError;

      const activeChallenges = (challengeData || []) as Omit<
        Challenge,
        "available_question_count"
      >[];

      // ------------------------------------------------------------
      // DETERMINE WHICH CHALLENGES ACTUALLY HAVE QUESTIONS
      //
      // IMPORTANT:
      // We do NOT use challenges.is_active alone to decide whether
      // a Family Member can open a challenge.
      //
      // A challenge is OPEN only when it has at least one linked
      // published question.
      //
      // A challenge with zero published linked questions becomes
      // COMING SOON and cannot be opened.
      // ------------------------------------------------------------

      const availableQuestionCounts: Record<string, number> = {};

      if (activeChallenges.length > 0) {
        const challengeIds = activeChallenges.map(
          (challenge) => challenge.id
        );

        const {
          data: linkedQuestionRows,
          error: linkedQuestionError,
        } = await supabase
          .from("challenge_questions")
          .select(
            `
              challenge_id,
              questions!inner (
                id,
                is_published
              )
            `
          )
          .in("challenge_id", challengeIds)
          .eq("questions.is_published", true);

        if (linkedQuestionError) {
          throw linkedQuestionError;
        }

        for (const row of linkedQuestionRows || []) {
          const challengeId = row.challenge_id;

          availableQuestionCounts[challengeId] =
            (availableQuestionCounts[challengeId] || 0) + 1;
        }
      }

      const challengesWithAvailability: Challenge[] =
        activeChallenges.map((challenge) => ({
          ...challenge,
          available_question_count:
            availableQuestionCounts[challenge.id] || 0,
        }));

      // ------------------------------------------------------------
      // LOAD MEMBER ATTEMPTS
      // ------------------------------------------------------------

      const { data: attemptData, error: attemptError } =
        await supabase.rpc("get_family_member_challenge_attempts", {
          p_session_token: token,
        });

      if (attemptError) throw attemptError;

      const attemptMap: Record<string, Attempt> = {};

      for (const row of attemptData || []) {
        if (!attemptMap[row.challenge_id]) {
          attemptMap[row.challenge_id] = row as Attempt;
        }
      }

      setChallenges(challengesWithAvailability);
      setAttempts(attemptMap);
    } catch (err) {
      console.error("Family Member Challenge library error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "We could not load the Family Challenge Arena."
      );
    } finally {
      setLoading(false);
    }
  }

  async function startChallenge(challenge: Challenge) {
    // ------------------------------------------------------------
    // NEVER OPEN A CHALLENGE THAT HAS NO QUESTIONS.
    // ------------------------------------------------------------

    if (challenge.available_question_count <= 0) {
      return;
    }

    const token = sessionStorage.getItem(SESSION_KEY);

    if (!token) {
      router.replace("/family-member-login");
      return;
    }

    try {
      setStartingId(challenge.id);
      setError("");

      const { data, error: startError } = await supabase.rpc(
        "start_family_member_challenge",
        {
          p_session_token: token,
          p_challenge_id: challenge.id,
        }
      );

      if (startError) throw startError;

      if (!data?.success) {
        throw new Error("The challenge could not be started.");
      }

      if (data.status === "completed") {
        router.push(
          `/family-member-challenges/${challenge.id}/result?attempt=${data.attempt_id}`
        );
        return;
      }

      router.push(
        `/family-member-challenges/${challenge.id}?attempt=${data.attempt_id}`
      );
    } catch (err) {
      console.error("Family Member Challenge start error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "We could not start this challenge."
      );
    } finally {
      setStartingId(null);
    }
  }

  function progressPercent(attempt: Attempt, challenge: Challenge) {
    if (!challenge.question_count) return 0;

    return Math.min(
      100,
      Math.round(
        (attempt.questions_answered / challenge.question_count) * 100
      )
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center max-w-md w-full">
          <div className="text-4xl mb-4">🏆</div>

          <h1 className="text-xl font-bold text-slate-900">
            Loading Challenge Arena
          </h1>

          <p className="text-slate-500 mt-2">
            Preparing your Family Member challenges...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-semibold text-emerald-600">
              FAMILY MEMBER MODE
            </p>

            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-1">
              Challenge Arena
            </h1>

            <p className="text-slate-500 mt-2">
              Welcome, <strong>{memberName}</strong>. Test your Sahaba
              knowledge.
            </p>
          </div>

          <Link
            href="/family-member-dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
          >
            ← Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <strong>Something went wrong.</strong>

            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {challenges.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
            <div className="text-5xl mb-4">🏆</div>

            <h2 className="text-2xl font-bold text-slate-900">
              No challenges available
            </h2>

            <p className="text-slate-500 mt-2">
              New Family Member challenges will appear here when they are
              published.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {challenges.map((challenge) => {
              const attempt = attempts[challenge.id];

              const isComingSoon =
                challenge.available_question_count <= 0;

              const isInProgress =
                !isComingSoon && attempt?.status === "in_progress";

              const isCompleted =
                !isComingSoon && attempt?.status === "completed";

              const percent =
                attempt && isInProgress
                  ? progressPercent(attempt, challenge)
                  : 0;

              return (
                <article
                  key={challenge.id}
                  className={`bg-white rounded-3xl border shadow-sm p-6 flex flex-col ${
                    isComingSoon
                      ? "border-slate-200 opacity-90"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
                        isComingSoon
                          ? "bg-slate-100"
                          : "bg-emerald-50"
                      }`}
                    >
                      {challenge.icon || "🏆"}
                    </div>

                    {isComingSoon ? (
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500">
                        COMING SOON
                      </span>
                    ) : isCompleted ? (
                      <span
                        className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                          attempt?.passed
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {attempt?.passed ? "PASSED" : "NOT PASSED"}
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700">
                        OPEN
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-slate-900 mt-5">
                    {challenge.title}
                  </h2>

                  <p className="text-sm text-slate-500 mt-2 flex-1">
                    {challenge.description ||
                      "Test your knowledge with this Sahaba Quest challenge."}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mt-5">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-400">
                        Questions
                      </div>

                      <div className="font-bold text-slate-800 mt-1">
                        {challenge.question_count}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-400">
                        Time
                      </div>

                      <div className="font-bold text-slate-800 mt-1">
                        {challenge.time_per_question}s
                      </div>
                    </div>
                  </div>

                  {isComingSoon && (
                    <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-100 p-3">
                      <p className="text-xs text-slate-500 text-center">
                        Questions are currently being prepared for this
                        challenge.
                      </p>
                    </div>
                  )}

                  {isInProgress && attempt && (
                    <div className="mt-5">
                      <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                        <span>Progress</span>

                        <span>
                          {attempt.questions_answered}/
                          {challenge.question_count}
                        </span>
                      </div>

                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={
                      isComingSoon ||
                      startingId === challenge.id
                    }
                    onClick={() => void startChallenge(challenge)}
                    className={`mt-6 w-full rounded-2xl py-3.5 font-bold transition ${
                      isComingSoon
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                    }`}
                  >
                    {isComingSoon
                      ? "Coming Soon"
                      : startingId === challenge.id
                        ? "Opening..."
                        : isInProgress
                          ? "Resume Challenge →"
                          : isCompleted
                            ? "View Result →"
                            : "Open Challenge →"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
