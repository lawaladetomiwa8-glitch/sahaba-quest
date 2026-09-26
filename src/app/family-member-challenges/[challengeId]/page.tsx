"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type ChallengeInfo = {
  challenge_id: string;
  title: string;
  description: string | null;
  icon: string | null;
  challenge_type: string | null;
  question_count: number;
  time_per_question: number;
  questions_answered: number;
  correct_answers: number;
  score: number;
  passing_score: number;
  member_id: string;
  display_name: string;
  status: string;
};

type Question = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  question_number: number;
  total_questions: number;
  time_per_question: number;
  question_started_at: string;
};

type AnswerResult = {
  member_id: string;
  is_correct: boolean;
  correct_answer: string;
  explanation: string | null;
  xp_earned: number;
  score: number;
  questions_answered: number;
  correct_answers: number;
  total_questions: number;
  questions_remaining: number;
  session_complete: boolean;
  passed: boolean;
  pass_mark: number;
};

const SESSION_KEY = "sahabaquest_family_member_session";

export default function FamilyMemberChallengePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const challengeId = params.challengeId as string;
  const attemptId = searchParams.get("attempt");

  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [timeLeft, setTimeLeft] = useState(0);

  const [activeAttemptId, setActiveAttemptId] = useState(attemptId);

  const startedRef = useRef(false);
  const submittingRef = useRef(false);
  const currentQuestionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    /*
     * IMPORTANT:
     * Never run the timer while the next question is being loaded.
     *
     * Without this guard, clicking "Next Question" briefly keeps the
     * previous question in state while the new question is fetched.
     * The old question's timer can therefore reach 0 and automatically
     * submit the old question again.
     */
    if (
      !question ||
      loadingQuestion ||
      answerResult ||
      submitting
    ) {
      return;
    }

    const questionId = question.id;
    const startedAt = new Date(
      question.question_started_at
    ).getTime();

    const limitMs =
      question.time_per_question * 1000;

    let hasExpired = false;

    const update = () => {
      /*
       * Make absolutely sure this timer still belongs to the
       * question currently displayed.
       */
      if (
        currentQuestionIdRef.current !==
        questionId
      ) {
        return;
      }

      const elapsed =
        Date.now() - startedAt;

      const remaining = Math.max(
        0,
        Math.ceil(
          (limitMs - elapsed) / 1000
        )
      );

      setTimeLeft(remaining);

      if (
        remaining <= 0 &&
        !hasExpired &&
        !submittingRef.current
      ) {
        hasExpired = true;
        void submitAnswer("");
      }
    };

    update();

    const interval =
      window.setInterval(update, 250);

    return () =>
      window.clearInterval(interval);
  }, [
    question,
    loadingQuestion,
    answerResult,
    submitting,
  ]);

  async function start() {
    try {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem(SESSION_KEY);

      if (!token) {
        router.replace("/family-member-login");
        return;
      }

      if (!attemptId || !challengeId) {
        throw new Error("This challenge session is missing its attempt information.");
      }

      const { data, error: startError } = await supabase.rpc(
        "start_family_member_challenge",
        {
          p_session_token: token,
          p_challenge_id: challengeId,
        }
      );

      if (startError) throw startError;

      if (!data?.success) {
        throw new Error("The challenge could not be started.");
      }

      const resolvedAttemptId =
        data.attempt_id || attemptId;

      if (!resolvedAttemptId) {
        throw new Error(
          "The challenge started, but no attempt ID was returned."
        );
      }

      setChallenge(data as ChallengeInfo);
      setActiveAttemptId(resolvedAttemptId);

      if (data.status === "completed") {
        router.replace(
          `/family-member-challenges/${challengeId}/result?attempt=${resolvedAttemptId}`
        );
        return;
      }

      await loadQuestion(resolvedAttemptId);
    } catch (err) {
      console.error("Family Member Challenge start error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We could not start this challenge."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadQuestion(currentAttemptId: string) {
    try {
      setLoadingQuestion(true);
      setError("");
      setSelectedAnswer("");
      setAnswerResult(null);

      /*
       * Clear the old question immediately.
       * This prevents the previous question's timer from
       * running while the next question is being fetched.
       */
      currentQuestionIdRef.current = null;
      setQuestion(null);
      setTimeLeft(0);

      const token = sessionStorage.getItem(SESSION_KEY);

      if (!token) {
        router.replace("/family-member-login");
        return;
      }

      const { data, error: questionError } = await supabase.rpc(
        "get_next_family_member_challenge_question",
        {
          p_session_token: token,
          p_attempt_id: currentAttemptId,
        }
      );

      if (questionError) {
        console.error(
          "FULL FAMILY MEMBER CHALLENGE QUESTION ERROR:",
          {
            message: questionError.message,
            details: questionError.details,
            hint: questionError.hint,
            code: questionError.code,
            name: questionError.name,
            error: questionError,
            errorJson: JSON.stringify(questionError),
          }
        );

        throw new Error(
          [
            "Failed to load challenge question.",
            `Code: ${questionError.code || "unknown"}`,
            `Message: ${questionError.message || "unknown"}`,
            `Details: ${questionError.details || "none"}`,
            `Hint: ${questionError.hint || "none"}`,
          ].join("\n")
        );
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error("No question is available for this challenge.");
      }

      const nextQuestion =
        data[0] as Question;

      /*
       * The RPC returns the server timestamp for the new question.
       * Only now do we activate this question's timer.
       */
      currentQuestionIdRef.current =
        nextQuestion.id;

      setTimeLeft(
        Math.max(
          0,
          Math.ceil(
            nextQuestion.time_per_question -
              (
                Date.now() -
                new Date(
                  nextQuestion.question_started_at
                ).getTime()
              ) /
                1000
          )
        )
      );

      setQuestion(nextQuestion);
    } catch (err) {
      console.error("Family Member Challenge question error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We could not load the next challenge question."
      );
    } finally {
      setLoadingQuestion(false);
    }
  }

  async function submitAnswer(answer: string) {
    if (!question || submitting || answerResult || !activeAttemptId) return;
    if (submittingRef.current) return;

    const submittedQuestionId = question.id;

    submittingRef.current = true;

    try {
      setSubmitting(true);
      setSelectedAnswer(answer);

      const token = sessionStorage.getItem(SESSION_KEY);

      if (!token) {
        router.replace("/family-member-login");
        return;
      }

      const responseTimeMs = Math.max(
        0,
        Date.now() - new Date(question.question_started_at).getTime()
      );

      const { data, error: submitError } = await supabase.rpc(
        "submit_family_member_challenge_answer",
        {
          p_session_token: token,
          p_attempt_id: activeAttemptId,
          p_question_id: question.id,
          p_selected_answer: answer || null,
          p_response_time_ms: responseTimeMs,
        }
      );

      if (submitError) {
        console.error(
          "FULL FAMILY MEMBER CHALLENGE ANSWER ERROR:",
          {
            message: submitError.message,
            details: submitError.details,
            hint: submitError.hint,
            code: submitError.code,
            name: submitError.name,
            error: submitError,
            errorJson: JSON.stringify(submitError),
          }
        );

        throw new Error(
          [
            "Failed to submit challenge answer.",
            `Code: ${submitError.code || "unknown"}`,
            `Message: ${submitError.message || "unknown"}`,
            `Details: ${submitError.details || "none"}`,
            `Hint: ${submitError.hint || "none"}`,
          ].join("\n")
        );
      }

      if (!data) {
        throw new Error("The challenge answer returned no result.");
      }

      /*
       * The answer request may have been started for a previous
       * question while the UI has already moved to the next one.
       * Never allow a stale response to overwrite the new question.
       */
      if (
        currentQuestionIdRef.current !== submittedQuestionId
      ) {
        return;
      }

      const result = data as AnswerResult;
      setAnswerResult(result);

      setChallenge((current) =>
        current
          ? {
              ...current,
              questions_answered: result.questions_answered,
              correct_answers: result.correct_answers,
              score: result.score,
            }
          : current
      );

      if (result.session_complete) {
        window.setTimeout(() => {
          router.replace(
            `/family-member-challenges/${challengeId}/result?attempt=${activeAttemptId}`
          );
        }, 900);
      }
    } catch (err) {
      console.error(
        "FULL FAMILY MEMBER CHALLENGE ANSWER CATCH ERROR:",
        {
          error: err,
          message: err instanceof Error ? err.message : "unknown",
          errorJson: JSON.stringify(err),
        }
      );

      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "We could not submit your answer.";

      setError(errorMessage);
      setSelectedAnswer("");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function nextQuestion() {
    if (
      !challenge ||
      !activeAttemptId ||
      answerResult?.session_complete ||
      submittingRef.current
    ) {
      return;
    }

    /*
     * loadQuestion clears the old question before asking the
     * server for the next one. This is critical for the timer.
     */
    await loadQuestion(activeAttemptId);
  }

  async function abandonChallenge() {
    if (!activeAttemptId) return;

    const confirmed = window.confirm(
      "Leave this challenge? Your answered questions and XP will be saved. You can return later and continue from where you stopped."
    );

    if (!confirmed) return;

    try {
      const token = sessionStorage.getItem(SESSION_KEY);

      if (!token) {
        router.replace("/family-member-login");
        return;
      }

      const { error: abandonError } = await supabase.rpc(
        "abandon_family_member_challenge",
        {
          p_session_token: token,
          p_attempt_id: activeAttemptId,
        }
      );

      if (abandonError) throw abandonError;

      router.replace("/family-member-challenges");
    } catch (err) {
      console.error("Family Member Challenge abandon error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We could not save your challenge progress."
      );
    }
  }

  const options = question
    ? [
        { key: "A", value: question.option_a },
        { key: "B", value: question.option_b },
        { key: "C", value: question.option_c },
        { key: "D", value: question.option_d },
      ]
    : [];

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center max-w-md w-full">
          <div className="text-4xl mb-4">🏆</div>
          <h1 className="text-xl font-bold text-slate-900">
            Opening Challenge
          </h1>
          <p className="text-slate-500 mt-2">Preparing your challenge...</p>
        </div>
      </main>
    );
  }

  if (error && !question) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-red-200 p-8 max-w-lg w-full">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-900">
            Challenge unavailable
          </h1>
          <p className="text-red-600 mt-3">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/family-member-challenges")}
            className="mt-6 rounded-xl bg-slate-900 text-white px-5 py-3 font-bold"
          >
            Back to Challenges
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">
        {/* FAMILY MEMBER NAVIGATION */}
        <nav
          aria-label="Family Member navigation"
          className="sticky top-3 z-50 mb-5 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-sm p-2"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
                SQ
              </div>
              <div>
                <div className="font-black text-slate-900">
                  Family Member Mode
                </div>
                <div className="text-xs text-slate-500">
                  {challenge?.title || "Challenge"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => router.push("/family-member-dashboard")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
              >
                Dashboard
              </button>

              <button
                type="button"
                onClick={() => router.push("/family-dashboard")}
                className="rounded-xl bg-emerald-600 text-white px-4 py-2.5 font-bold hover:bg-emerald-700"
              >
                ← Family Dashboard
              </button>
            </div>
          </div>
        </nav>


        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-sm font-bold text-emerald-600">
              FAMILY MEMBER MODE
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
              {challenge?.title || "Challenge"}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => void abandonChallenge()}
            className="text-sm font-semibold text-slate-500 hover:text-red-600"
          >
            Leave & Save
          </button>
        </div>

        {challenge && (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 mb-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">
                  Question {question?.question_number || 0} of{" "}
                  {challenge.question_count}
                </p>
                <p className="font-bold text-slate-800 mt-1">
                  {challenge.correct_answers} correct · {challenge.score} XP
                </p>
              </div>

              <div
                className={`rounded-full px-5 py-2.5 font-black ${
                  timeLeft <= 5
                    ? "bg-red-100 text-red-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                ⏱ {timeLeft}s
              </div>
            </div>

            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-4">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    ((question?.question_number || 0) /
                      challenge.question_count) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">
              {error}
            </pre>
          </div>
        )}

        {loadingQuestion ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="font-bold text-slate-900">Loading question...</h2>
          </div>
        ) : question ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
            <p className="text-xs font-black tracking-widest text-slate-400">
              CHALLENGE QUESTION
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-relaxed mt-3">
              {question.question}
            </h2>

            <div className="grid gap-3 mt-7">
              {options.map((option) => {
                const isSelected = selectedAnswer === option.value;
                const isCorrect =
                  answerResult?.correct_answer === option.value;
                const isWrong =
                  Boolean(
                    answerResult &&
                      isSelected &&
                      !answerResult.is_correct
                  );

                return (
                  <button
                    key={`${question.id}-${option.key}`}
                    type="button"
                    disabled={submitting || !!answerResult}
                    onClick={() => void submitAnswer(option.value)}
                    className={`w-full text-left rounded-2xl border p-4 transition ${
                      isCorrect
                        ? "border-emerald-500 bg-emerald-50"
                        : isWrong
                          ? "border-red-500 bg-red-50"
                          : "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-700">
                        {option.key}
                      </span>
                      <span className="pt-1 font-medium text-slate-800">
                        {option.value}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {answerResult && (
              <div
                className={`mt-6 rounded-2xl border p-5 ${
                  answerResult.is_correct
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <div className="font-black text-lg">
                  {answerResult.is_correct ? "Correct! 🎉" : "Not quite."}
                </div>

                <p className="text-sm text-slate-700 mt-2">
                  <strong>Correct answer:</strong>{" "}
                  {answerResult.correct_answer}
                </p>

                {answerResult.explanation && (
                  <p className="text-sm text-slate-700 mt-3 leading-relaxed">
                    <strong>Explanation:</strong> {answerResult.explanation}
                  </p>
                )}

                <p className="text-sm font-black text-emerald-700 mt-3">
                  +{answerResult.xp_earned} XP
                </p>

                {answerResult.session_complete ? (
                  <p className="mt-4 font-bold text-slate-800">
                    Challenge complete. Opening your result...
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void nextQuestion()}
                    className="mt-5 w-full rounded-xl bg-slate-900 text-white py-3.5 font-bold hover:bg-slate-800"
                  >
                    Next Question →
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
