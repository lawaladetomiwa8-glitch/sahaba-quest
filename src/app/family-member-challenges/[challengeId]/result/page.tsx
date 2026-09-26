"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

type Result = {
  attempt_id: string;
  challenge_id: string;
  member_id: string;
  display_name: string;
  title: string;
  description: string | null;
  icon: string | null;
  challenge_type: string | null;
  question_count: number;
  time_per_question: number;
  score: number;
  questions_answered: number;
  correct_answers: number;
  status: string;
  passed: boolean | null;
  passing_score: number;
  started_at: string;
  completed_at: string | null;
};

const SESSION_KEY = "sahabaquest_family_member_session";

export default function FamilyMemberChallengeResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const challengeId = params.challengeId as string;
  const attemptId = searchParams.get("attempt");

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId, attemptId]);

  async function loadResult() {
    try {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem(SESSION_KEY);

      if (!token) {
        router.replace("/family-member-login");
        return;
      }

      if (!attemptId || !challengeId) {
        throw new Error("The challenge result is missing its attempt information.");
      }

      const { data, error: resultError } = await supabase.rpc(
        "get_family_member_challenge_result",
        {
          p_session_token: token,
          p_attempt_id: attemptId,
        }
      );

      if (resultError) throw resultError;

      if (!data) {
        throw new Error("No result was found for this challenge.");
      }

      const parsed = data as Result;

      if (parsed.challenge_id !== challengeId) {
        throw new Error("This result does not belong to the requested challenge.");
      }

      if (parsed.status !== "completed") {
        router.replace(
          `/family-member-challenges/${challengeId}?attempt=${attemptId}`
        );
        return;
      }

      setResult(parsed);
    } catch (err) {
      console.error("Family Member Challenge result error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We could not load your challenge result."
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center max-w-md w-full">
          <div className="text-4xl mb-4">🏆</div>
          <h1 className="text-xl font-bold text-slate-900">
            Loading your result
          </h1>
        </div>
      </main>
    );
  }

  if (error || !result) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-red-200 p-8 max-w-lg w-full">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-900">
            Result unavailable
          </h1>
          <p className="text-red-600 mt-3">
            {error || "No result was found."}
          </p>
          <Link
            href="/family-member-challenges"
            className="inline-block mt-6 rounded-xl bg-slate-900 text-white px-5 py-3 font-bold"
          >
            Back to Challenges
          </Link>
        </div>
      </main>
    );
  }

  const accuracy =
    result.questions_answered > 0
      ? Math.round(
          (result.correct_answers / result.questions_answered) * 100
        )
      : 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="text-center">
          <div className="text-6xl">{result.icon || "🏆"}</div>

          <p className="text-sm font-black text-emerald-600 mt-5">
            FAMILY MEMBER CHALLENGE
          </p>

          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-2">
            {result.title}
          </h1>

          <div
            className={`inline-flex mt-5 rounded-full px-5 py-2.5 font-black ${
              result.passed
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {result.passed ? "Challenge Passed 🎉" : "Challenge Not Passed"}
          </div>
        </div>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <div className="text-2xl font-black text-slate-900">
              {result.score}
            </div>
            <div className="text-xs text-slate-500 mt-1">XP</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <div className="text-2xl font-black text-slate-900">
              {result.correct_answers}/{result.questions_answered}
            </div>
            <div className="text-xs text-slate-500 mt-1">Correct</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <div className="text-2xl font-black text-slate-900">
              {accuracy}%
            </div>
            <div className="text-xs text-slate-500 mt-1">Accuracy</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <div className="text-2xl font-black text-slate-900">
              {result.passing_score}
            </div>
            <div className="text-xs text-slate-500 mt-1">Pass Mark</div>
          </div>
        </section>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-7 mt-6 text-center">
          <h2 className="text-xl font-black text-slate-900">
            Well done, {result.display_name}!
          </h2>

          <p className="text-slate-500 mt-2">
            Your challenge performance has been saved to your Family Member
            progress.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
            <Link
              href="/family-member-challenges"
              className="rounded-xl bg-slate-900 text-white px-6 py-3.5 font-bold hover:bg-slate-800"
            >
              Back to Challenges
            </Link>

            <Link
              href="/family-member-dashboard"
              className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-bold text-slate-700 hover:bg-slate-50"
            >
              Member Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
