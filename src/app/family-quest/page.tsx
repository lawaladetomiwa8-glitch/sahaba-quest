"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type Question = {
  id: string;
  level: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  explanation?: string | null;
};

type GameSession = {
  id: string;
  level: number;
  status: string;
  current_question_id: string | null;
  current_question_started_at: string | null;
};

type FamilyProgress = {
  current_level: number;
  total_xp: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
};

type AnswerResult = {
  success?: boolean;
  is_correct: boolean;
  correct_answer?: string | null;
  explanation?: string | null;
  xp_earned: number;
  current_streak: number;
  total_xp: number;
  questions_answered: number;
  correct_answers: number;
  questions_remaining: number;
  session_complete: boolean;
  passed: boolean;
  new_level: number;
  total_questions?: number;
  pass_mark?: number;
};

type DisplayOption = {
  key: "A" | "B" | "C" | "D";
  value: string;
};

/*
 * Family Quest settings
 */
const QUESTION_TIME = 15;
const TOTAL_QUESTIONS = 50;

/*
 * IMPORTANT:
 *
 * This function ONLY shuffles the frontend answer buttons.
 *
 * It does NOT modify:
 * - question.id
 * - question.option_a
 * - question.option_b
 * - question.option_c
 * - question.option_d
 *
 * The actual answer text remains unchanged.
 */
function createShuffledOptions(
  question: Question
): DisplayOption[] {
  const values = [
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d,
  ];

  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [values[i], values[j]] = [
      values[j],
      values[i],
    ];
  }

  return values.map((value, index) => ({
    key: ["A", "B", "C", "D"][index] as
      | "A"
      | "B"
      | "C"
      | "D",
    value,
  }));
}

export default function FamilyQuestPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [starting, setStarting] =
    useState(false);

  const [question, setQuestion] =
    useState<Question | null>(null);

  /*
   * This is separate from `question`.
   *
   * `question` remains exactly as Supabase
   * returned it.
   *
   * `displayOptions` is only the visual
   * A/B/C/D order.
   */
  const [displayOptions, setDisplayOptions] =
    useState<DisplayOption[]>([]);

  const [session, setSession] =
    useState<GameSession | null>(null);

  const [progress, setProgress] =
    useState<FamilyProgress | null>(null);

  /*
   * IMPORTANT:
   * selectedAnswer stores the FULL ANSWER TEXT,
   * not A/B/C/D.
   *
   * This matches the database's
   * questions.correct_answer value.
   */
  const [selectedAnswer, setSelectedAnswer] =
    useState<string | null>(null);

  const [submitting, setSubmitting] =
    useState(false);

  const [timeLeft, setTimeLeft] =
    useState(QUESTION_TIME);

  const [questionNumber, setQuestionNumber] =
    useState(1);

  const [correctCount, setCorrectCount] =
    useState(0);

  const [sessionXp, setSessionXp] =
    useState(0);

  const [showResult, setShowResult] =
    useState(false);

  const [result, setResult] =
    useState<AnswerResult | null>(null);

  const [error, setError] =
    useState("");

  const timerRef =
    useRef<NodeJS.Timeout | null>(null);

  /*
   * Prevent React development mode from
   * accidentally initializing the quest twice.
   */
  const initializedRef =
    useRef(false);

  /*
   * -------------------------------------------------------
   * TIMER
   * -------------------------------------------------------
   */

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /*
   * -------------------------------------------------------
   * LOAD FAMILY PROGRESS
   * -------------------------------------------------------
   */

  const loadFamilyProgress =
    useCallback(
      async (userId: string) => {
        const {
          data,
          error,
        } = await supabase
          .from(
            "family_player_progress"
          )
          .select(
            `
              current_level,
              total_xp,
              questions_answered,
              correct_answers,
              current_streak,
              best_streak
            `
          )
          .eq(
            "user_id",
            userId
          )
          .maybeSingle();

        if (error) {
          throw new Error(
            error.message
          );
        }

        if (!data) {
          const {
            data: created,
            error: createError,
          } = await supabase.rpc(
            "create_family_player_progress",
            {
              p_user_id: userId,
            }
          );

          if (createError) {
            throw new Error(
              createError.message
            );
          }

          return created as FamilyProgress;
        }

        return data as FamilyProgress;
      },
      []
    );

  /*
   * -------------------------------------------------------
   * LOAD NEXT QUESTION
   * -------------------------------------------------------
   *
   * IMPORTANT:
   *
   * The RPC remains responsible for selecting
   * the next question.
   *
   * We do NOT change the question itself.
   *
   * We ONLY shuffle the four displayed buttons.
   * -------------------------------------------------------
   */

  const loadQuestion =
    useCallback(
      async (
        sessionId: string,
        userId: string
      ) => {
        setError("");

        const {
          data,
          error,
        } = await supabase.rpc(
          "get_next_family_quest_question",
          {
            p_user_id: userId,
            p_session_id: sessionId,
          }
        );

        if (error) {
          throw new Error(
            error.message
          );
        }

        if (
          !data ||
          (Array.isArray(data) &&
            data.length === 0)
        ) {
          throw new Error(
            "No Family Quest questions are available for this level yet."
          );
        }

        const nextQuestion =
          (Array.isArray(data)
            ? data[0]
            : data) as Question;

        /*
         * Keep the question EXACTLY as
         * returned by Supabase.
         */
        setQuestion(
          nextQuestion
        );

        /*
         * Shuffle ONLY the displayed options.
         */
        setDisplayOptions(
          createShuffledOptions(
            nextQuestion
          )
        );

        setSelectedAnswer(null);
        setResult(null);
        setTimeLeft(
          QUESTION_TIME
        );

        /*
         * Tell the database which question
         * is currently active.
         */
        const now =
          new Date().toISOString();

        const {
          error: sessionError,
        } = await supabase
          .from(
            "game_sessions"
          )
          .update({
            current_question_id:
              nextQuestion.id,
            current_question_started_at:
              now,
          })
          .eq(
            "id",
            sessionId
          )
          .eq(
            "track",
            "family"
          )
          .eq(
            "status",
            "in_progress"
          );

        if (sessionError) {
          throw new Error(
            sessionError.message
          );
        }

        setSession(
          (current) =>
            current
              ? {
                  ...current,
                  current_question_id:
                    nextQuestion.id,
                  current_question_started_at:
                    now,
                }
              : current
        );
      },
      []
    );

  /*
   * -------------------------------------------------------
   * START NEW QUEST
   * -------------------------------------------------------
   */

  const startNewQuest =
    useCallback(
      async (
        level: number,
        userId: string
      ) => {
        setStarting(true);
        setError("");

        try {
          const {
            data,
            error,
          } = await supabase.rpc(
            "start_family_quest",
            {
              p_level: level,
            }
          );

          if (error) {
            throw new Error(
              error.message
            );
          }

          if (!data) {
            throw new Error(
              "Unable to create Family Quest session."
            );
          }

          const sessionId =
            data as string;

          const newSession:
            GameSession = {
            id: sessionId,
            level,
            status: "in_progress",
            current_question_id:
              null,
            current_question_started_at:
              null,
          };

          setSession(
            newSession
          );

          setQuestionNumber(1);
          setCorrectCount(0);
          setSessionXp(0);

          setQuestion(null);
          setDisplayOptions([]);
          setSelectedAnswer(null);
          setResult(null);
          setShowResult(false);

          await loadQuestion(
            sessionId,
            userId
          );
        } finally {
          setStarting(false);
        }
      },
      [loadQuestion]
    );

  /*
   * -------------------------------------------------------
   * RESUME EXISTING QUEST
   * -------------------------------------------------------
   */

  const resumeQuest =
    useCallback(
      async (
        existingSession: GameSession,
        userId: string
      ) => {
        setSession(
          existingSession
        );

        /*
         * Load attempts so we know where
         * the player is in the 50-question quest.
         */
        const {
          data: attempts,
          error: attemptsError,
        } = await supabase
          .from(
            "family_question_attempts"
          )
          .select(
            "question_id, is_correct, xp_earned"
          )
          .eq(
            "session_id",
            existingSession.id
          )
          .eq(
            "user_id",
            userId
          )
          .order(
            "answered_at",
            {
              ascending: true,
            }
          );

        if (attemptsError) {
          throw new Error(
            attemptsError.message
          );
        }

        const attemptRows =
          attempts || [];

        setQuestionNumber(
          attemptRows.length + 1
        );

        setCorrectCount(
          attemptRows.filter(
            (attempt) =>
              attempt.is_correct
          ).length
        );

        setSessionXp(
          attemptRows.reduce(
            (
              total,
              attempt
            ) =>
              total +
              Number(
                attempt.xp_earned ||
                  0
              ),
            0
          )
        );

        /*
         * If there is already an active
         * question, resume that question.
         */
        if (
          existingSession.current_question_id
        ) {
          const {
            data:
              currentQuestion,
            error:
              questionError,
          } =
            await supabase
              .from(
                "questions"
              )
              .select(
                `
                  id,
                  level,
                  question,
                  option_a,
                  option_b,
                  option_c,
                  option_d,
                  explanation
                `
              )
              .eq(
                "id",
                existingSession.current_question_id
              )
              .eq(
                "level",
                existingSession.level
              )
              .in(
                "track",
                [
                  "family",
                  "shared",
                ]
              )
              .eq(
                "is_published",
                true
              )
              .maybeSingle();

          if (questionError) {
            throw new Error(
              questionError.message
            );
          }

          if (
            currentQuestion
          ) {
            const normalizedQuestion:
              Question = {
              id:
                currentQuestion.id,
              level:
                Number(
                  currentQuestion.level
                ),
              question:
                currentQuestion.question ??
                "",
              option_a:
                currentQuestion.option_a ??
                "",
              option_b:
                currentQuestion.option_b ??
                "",
              option_c:
                currentQuestion.option_c ??
                "",
              option_d:
                currentQuestion.option_d ??
                "",
              explanation:
                currentQuestion.explanation ??
                null,
            };

            /*
             * Keep question unchanged.
             */
            setQuestion(
              normalizedQuestion
            );

            /*
             * Shuffle ONLY the buttons.
             */
            setDisplayOptions(
              createShuffledOptions(
                normalizedQuestion
              )
            );

            setSelectedAnswer(null);
            setResult(null);

            /*
             * Resume the remaining timer.
             */
            if (
              existingSession.current_question_started_at
            ) {
              const startedAt =
                new Date(
                  existingSession.current_question_started_at
                ).getTime();

              const elapsed =
                Math.floor(
                  (Date.now() -
                    startedAt) /
                    1000
                );

              const remaining =
                Math.max(
                  0,
                  QUESTION_TIME -
                    elapsed
                );

              setTimeLeft(
                remaining
              );

              /*
               * Do not overwrite the
               * database timestamp here.
               */
              if (
                remaining === 0
              ) {
                return;
              }
            } else {
              setTimeLeft(
                QUESTION_TIME
              );
            }

            return;
          }
        }

        /*
         * No active question.
         * Get a new one.
         */
        await loadQuestion(
          existingSession.id,
          userId
        );
      },
      [loadQuestion]
    );

  /*
   * -------------------------------------------------------
   * INITIALIZE
   * -------------------------------------------------------
   */

  const initialize =
    useCallback(
      async () => {
        if (
          initializedRef.current
        ) {
          return;
        }

        initializedRef.current =
          true;

        try {
          setLoading(true);
          setError("");

          const {
            data: {
              user,
            },
          } =
            await supabase.auth.getUser();

          if (!user) {
            router.push(
              "/login"
            );
            return;
          }

          /*
           * Confirm Family account.
           */
          const {
            data: profile,
            error:
              profileError,
          } =
            await supabase
              .from("profiles")
              .select(
                "account_type"
              )
              .eq(
                "id",
                user.id
              )
              .single();

          if (profileError) {
            throw new Error(
              profileError.message
            );
          }

          if (
            profile?.account_type !==
            "family"
          ) {
            router.push(
              "/dashboard"
            );
            return;
          }

          /*
           * Load Family progress.
           */
          const familyProgress =
            await loadFamilyProgress(
              user.id
            );

          setProgress(
            familyProgress
          );

          /*
           * Look for an existing
           * in-progress Family Quest.
           */
          const {
            data:
              existingSession,
            error:
              sessionError,
          } =
            await supabase
              .from(
                "game_sessions"
              )
              .select(
                `
                  id,
                  level,
                  status,
                  current_question_id,
                  current_question_started_at
                `
              )
              .eq(
                "user_id",
                user.id
              )
              .eq(
                "track",
                "family"
              )
              .eq(
                "status",
                "in_progress"
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                }
              )
              .limit(1)
              .maybeSingle();

          if (sessionError) {
            throw new Error(
              sessionError.message
            );
          }

          if (
            existingSession
          ) {
            await resumeQuest(
              existingSession as GameSession,
              user.id
            );
          } else {
            await startNewQuest(
              familyProgress.current_level,
              user.id
            );
          }
        } catch (err) {
          console.error(
            "Family Quest initialization error:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong loading Family Quest."
          );

          initializedRef.current =
            false;
        } finally {
          setLoading(false);
        }
      },
      [
        loadFamilyProgress,
        resumeQuest,
        router,
        startNewQuest,
      ]
    );

  useEffect(() => {
    void initialize();

    return () => {
      clearTimer();
    };
  }, [
    initialize,
    clearTimer,
  ]);

  /*
   * -------------------------------------------------------
   * PROCESS ANSWER RESULT
   * -------------------------------------------------------
   */

  const processAnswerResult =
    useCallback(
      async (
        rawResult: AnswerResult | AnswerResult[]
      ) => {
        const answerResult =
          Array.isArray(
            rawResult
          )
            ? rawResult[0]
            : rawResult;

        if (!answerResult) {
          throw new Error(
            "The server returned no answer result."
          );
        }

        /*
         * Show feedback for the CURRENT
         * question only.
         */
        setResult(
          answerResult
        );

        /*
         * Update correct count.
         */
        if (
          answerResult.is_correct
        ) {
          setCorrectCount(
            (current) =>
              current + 1
          );
        }

        /*
         * Session XP.
         */
        setSessionXp(
          (current) =>
            current +
            Number(
              answerResult.xp_earned ||
                0
            )
        );

        /*
         * Update Family progress.
         */
        setProgress(
          (current) =>
            current
              ? {
                  ...current,
                  total_xp:
                    answerResult.total_xp,
                  current_streak:
                    answerResult.current_streak,
                  questions_answered:
                    answerResult.questions_answered,
                  correct_answers:
                    answerResult.correct_answers,
                }
              : current
        );

        /*
         * If the 50-question session is complete,
         * finish the game.
         */
        if (
          answerResult.session_complete
        ) {
          clearTimer();

          if (session) {
            const {
              error:
                completeError,
            } =
              await supabase
                .from(
                  "game_sessions"
                )
                .update({
                  status:
                    "completed",
                  completed_at:
                    new Date().toISOString(),
                  current_question_id:
                    null,
                  current_question_started_at:
                    null,
                })
                .eq(
                  "id",
                  session.id
                )
                .eq(
                  "track",
                  "family"
                );

            if (completeError) {
              throw new Error(
                completeError.message
              );
            }
          }

          setShowResult(
            true
          );
        }
      },
      [
        clearTimer,
        session,
      ]
    );

  /*
   * -------------------------------------------------------
   * TIMEOUT
   * -------------------------------------------------------
   */

  const handleTimeout =
    useCallback(
      async () => {
        if (
          !session ||
          !question ||
          submitting ||
          result
        ) {
          return;
        }

        clearTimer();
        setSubmitting(true);

        try {
          const {
            data,
            error,
          } =
            await supabase.rpc(
              "submit_family_quest_answer",
              {
                p_session_id:
                  session.id,
                p_question_id:
                  question.id,
                p_selected_answer:
                  null,
                p_response_time_ms:
                  QUESTION_TIME *
                  1000,
              }
            );

          if (error) {
            throw new Error(
              error.message
            );
          }

          await processAnswerResult(
            data as AnswerResult
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to submit your answer."
          );
        } finally {
          setSubmitting(false);
        }
      },
      [
        clearTimer,
        question,
        result,
        session,
        submitting,
        processAnswerResult,
      ]
    );

  /*
   * -------------------------------------------------------
   * HANDLE ANSWER
   * -------------------------------------------------------
   *
   * IMPORTANT:
   *
   * `answer` is the FULL TEXT of the selected
   * answer, NOT "A", "B", "C", or "D".
   *
   * This is what your database stores in
   * questions.correct_answer.
   * -------------------------------------------------------
   */

  const handleAnswer =
    async (
      answer: string
    ) => {
      if (
        !session ||
        !question ||
        submitting ||
        selectedAnswer ||
        result
      ) {
        return;
      }

      clearTimer();

      /*
       * Store the actual answer text.
       */
      setSelectedAnswer(
        answer
      );

      setSubmitting(true);

      try {
        const elapsed =
          QUESTION_TIME -
          timeLeft;

        const {
          data,
          error,
        } =
          await supabase.rpc(
            "submit_family_quest_answer",
            {
              p_session_id:
                session.id,

              /*
               * This is the ID of the
               * exact question being displayed.
               */
              p_question_id:
                question.id,

              /*
               * This is the full answer text.
               */
              p_selected_answer:
                answer,

              p_response_time_ms:
                Math.max(
                  0,
                  elapsed
                ) * 1000,
            }
          );

        if (error) {
          throw new Error(
            error.message
          );
        }

        await processAnswerResult(
          data as AnswerResult
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to submit your answer."
        );

        setSelectedAnswer(
          null
        );
      } finally {
        setSubmitting(false);
      }
    };

  /*
   * -------------------------------------------------------
   * TIMER EFFECT
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (
      !question ||
      showResult ||
      submitting ||
      result
    ) {
      clearTimer();
      return;
    }

    if (
      timeLeft <= 0
    ) {
      void handleTimeout();
      return;
    }

    timerRef.current =
      setInterval(() => {
        setTimeLeft(
          (current) =>
            Math.max(
              0,
              current - 1
            )
        );
      }, 1000);

    return () => {
      clearTimer();
    };
  }, [
    question,
    showResult,
    submitting,
    result,
    timeLeft,
    handleTimeout,
    clearTimer,
  ]);

  /*
   * -------------------------------------------------------
   * NEXT QUESTION
   * -------------------------------------------------------
   */

  const continueQuest =
    async () => {
      setError("");
      setResult(null);
      setSelectedAnswer(null);

      if (!session) {
        return;
      }

      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.push(
          "/login"
        );
        return;
      }

      try {
        setQuestion(null);
        setDisplayOptions([]);

        await loadQuestion(
          session.id,
          user.id
        );

        setQuestionNumber(
          (current) =>
            Math.min(
              TOTAL_QUESTIONS,
              current + 1
            )
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the next question."
        );
      }
    };

  /*
   * -------------------------------------------------------
   * ABANDON QUEST
   * -------------------------------------------------------
   */

  const abandonQuest =
    async () => {
      if (!session) {
        router.push(
          "/dashboard"
        );
        return;
      }

      const confirmed =
        window.confirm(
          "Are you sure you want to leave Family Quest? Your progress in this quest will be forfeited."
        );

      if (!confirmed) {
        return;
      }

      try {
        clearTimer();

        const {
          error,
        } =
          await supabase.rpc(
            "abandon_family_quest",
            {
              p_session_id:
                session.id,
            }
          );

        if (error) {
          throw new Error(
            error.message
          );
        }

        router.push(
          "/dashboard"
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to leave Family Quest."
        );
      }
    };

  /*
   * -------------------------------------------------------
   * LOADING SCREEN
   * -------------------------------------------------------
   */

  if (
    loading ||
    starting
  ) {
    return (
      <>
        <AppNavbar />

        <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="text-4xl mb-4">
              👨‍👩‍👧‍👦
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Loading Family Quest...
            </h1>

            <p className="text-slate-500 mt-2">
              Preparing your family learning journey.
            </p>
          </div>
        </main>
      </>
    );
  }

  /*
   * -------------------------------------------------------
   * ERROR SCREEN
   * -------------------------------------------------------
   */

  if (
    error &&
    !question
  ) {
    return (
      <>
        <AppNavbar />

        <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
            <div className="text-4xl mb-4">
              ⚠️
            </div>

            <h1 className="text-xl font-bold text-slate-900">
              Family Quest unavailable
            </h1>

            <p className="text-slate-600 mt-3">
              {error}
            </p>

            <button
              onClick={() =>
                router.push(
                  "/dashboard"
                )
              }
              className="mt-6 w-full rounded-xl bg-slate-900 text-white py-3 font-semibold"
            >
              Back to Dashboard
            </button>
          </div>
        </main>
      </>
    );
  }

  /*
   * -------------------------------------------------------
   * FINAL RESULT SCREEN
   * -------------------------------------------------------
   */

  if (
    showResult &&
    result
  ) {
    return (
      <>
        <AppNavbar />

        <main className="min-h-screen bg-slate-50 px-4 py-10">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="text-6xl mb-5">
                {result.passed
                  ? "🎉"
                  : "📚"}
              </div>

              <h1 className="text-3xl font-bold text-slate-900">
                {result.passed
                  ? "Family Quest Complete!"
                  : "Quest Complete"}
              </h1>

              <p className="text-slate-500 mt-3">
                {result.passed
                  ? "MashaAllah! Your Family Quest level has been completed."
                  : "Keep learning and try again to pass this level."}
              </p>

              <div className="grid grid-cols-3 gap-3 mt-8">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-slate-900">
                    {
                      result.correct_answers
                    }
                  </div>

                  <div className="text-xs text-slate-500 mt-1">
                    Correct
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-slate-900">
                    {
                      sessionXp
                    }
                  </div>

                  <div className="text-xs text-slate-500 mt-1">
                    Family XP
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-slate-900">
                    {
                      result.new_level
                    }
                  </div>

                  <div className="text-xs text-slate-500 mt-1">
                    Level
                  </div>
                </div>
              </div>

              <button
                onClick={() =>
                  router.push(
                    "/dashboard"
                  )
                }
                className="mt-8 w-full rounded-xl bg-slate-900 text-white py-3.5 font-semibold"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  /*
   * -------------------------------------------------------
   * MAIN QUEST SCREEN
   * -------------------------------------------------------
   */

  return (
    <>
      <AppNavbar />

      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="max-w-3xl mx-auto">

          {/* HEADER */}

          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <p className="text-sm font-semibold text-emerald-600">
                FAMILY QUEST
              </p>

              <h1 className="text-2xl font-bold text-slate-900">
                Level{" "}
                {session?.level}
              </h1>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500">
                Family XP
              </div>

              <div className="font-bold text-slate-900">
                {
                  progress?.total_xp ??
                  0
                }{" "}
                XP
              </div>
            </div>
          </div>

          {/* PROGRESS */}

          <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-slate-700">
                Question{" "}
                {Math.min(
                  questionNumber,
                  TOTAL_QUESTIONS
                )}{" "}
                of{" "}
                {TOTAL_QUESTIONS}
              </span>

              <span className="font-semibold text-slate-900">
                {
                  correctCount
                }{" "}
                correct
              </span>
            </div>

            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (questionNumber /
                      TOTAL_QUESTIONS) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* TIMER */}

          <div className="flex justify-center mb-5">
            <div
              className={`px-5 py-2 rounded-full font-bold ${
                timeLeft <= 5
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              ⏱ {timeLeft}s
            </div>
          </div>

          {/* QUESTION */}

          {question && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">

              <div className="text-sm font-semibold text-slate-400 mb-3">
                FAMILY QUEST
              </div>

              <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-relaxed">
                {
                  question.question
                }
              </h2>

              {/* ANSWER OPTIONS */}

              <div className="grid gap-3 mt-7">
                {displayOptions.map(
                  (option) => {
                    /*
                     * selectedAnswer contains
                     * the FULL answer text.
                     */
                    const isSelected =
                      selectedAnswer ===
                      option.value;

                    /*
                     * The server sends the
                     * actual correct answer text.
                     */
                    const isCorrect =
                      result?.correct_answer ===
                      option.value;

                    /*
                     * If this option was
                     * selected and the server
                     * says it was wrong.
                     */
                    const isWrongSelected =
                      Boolean(
                        result &&
                        isSelected &&
                        !result.is_correct
                      );

                    return (
                      <button
                        key={
                          `${question.id}-${option.key}-${option.value}`
                        }
                        onClick={() =>
                          handleAnswer(
                            option.value
                          )
                        }
                        disabled={
                          submitting ||
                          !!selectedAnswer ||
                          !!result
                        }
                        className={`w-full text-left rounded-2xl border p-4 transition ${
                          isCorrect
                            ? "border-emerald-500 bg-emerald-50"
                            : isWrongSelected
                            ? "border-red-500 bg-red-50"
                            : isSelected
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/40"
                        }`}
                      >
                        <div className="flex items-start gap-3">

                          <span
                            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                              isCorrect
                                ? "bg-emerald-200 text-emerald-800"
                                : isWrongSelected
                                ? "bg-red-200 text-red-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {
                              option.key
                            }
                          </span>

                          <span className="pt-1 text-slate-800 font-medium">
                            {
                              option.value
                            }
                          </span>

                        </div>
                      </button>
                    );
                  }
                )}
              </div>

              {/* FEEDBACK */}

              {result && (
                <div
                  className={`mt-6 rounded-2xl border p-5 ${
                    result.is_correct
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="font-bold text-lg">
                    {result.is_correct
                      ? "Correct! 🎉"
                      : "Not quite."}
                  </div>

                  {result.correct_answer && (
                    <div className="mt-2 text-sm text-slate-700">
                      <strong>
                        Correct answer:
                      </strong>{" "}
                      {
                        result.correct_answer
                      }
                    </div>
                  )}

                  {result.explanation && (
                    <div className="mt-3 text-sm text-slate-700 leading-relaxed">
                      <strong>
                        Explanation:
                      </strong>{" "}
                      {
                        result.explanation
                      }
                    </div>
                  )}

                  <div className="mt-3 text-sm font-semibold text-emerald-700">
                    {result.xp_earned >
                    0
                      ? `+${result.xp_earned} Family XP`
                      : "0 Family XP"}
                  </div>

                  {!result.session_complete && (
                    <button
                      onClick={
                        continueQuest
                      }
                      className="mt-5 w-full rounded-xl bg-slate-900 text-white py-3.5 font-semibold hover:bg-slate-800 transition"
                    >
                      Next Question →
                    </button>
                  )}
                </div>
              )}

              {/* ERROR */}

              {error && (
                <div className="mt-5 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {
                    error
                  }
                </div>
              )}
            </div>
          )}

          {/* LEAVE QUEST */}

          <div className="flex justify-center mt-6">
            <button
              onClick={
                abandonQuest
              }
              disabled={
                submitting
              }
              className="text-sm text-slate-500 hover:text-red-600"
            >
              Leave Family Quest
            </button>
          </div>

        </div>
      </main>
    </>
  );
}