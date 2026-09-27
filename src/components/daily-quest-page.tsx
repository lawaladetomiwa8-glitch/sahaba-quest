"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { AppNavbar } from "./ui";

type DailyQuestStatus = {
  quest_id: string;
  quest_date: string;
  title: string;
  description: string | null;
  question_count: number;
  time_per_question: number;
  status: "not_started" | "in_progress" | "completed";
  attempt_id: string | null;
  questions_answered: number;
  correct_answers: number;
  score: number;
  daily_streak: number;
  best_daily_streak: number;
};

type DailyQuestion = {
  id: string;
  question_number: number;
  total_questions: number;
  level: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  time_per_question: number;
};

type AnswerResult = {
  is_correct: boolean;
  correct_answer: string;
  xp_earned: number;
  questions_answered: number;
  correct_answers: number;
  questions_remaining: number;
  completed: boolean;
  daily_streak: number | null;
  best_daily_streak: number | null;
  current_streak: number;
  best_streak: number;
};

const MEMBER_SESSION_KEY = "sahabaquest_family_member_session";

function getMemberToken(memberMode: boolean) {
  if (!memberMode || typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem(MEMBER_SESSION_KEY);
}

export default function DailyQuestPage({
  memberMode = false,
}: {
  memberMode?: boolean;
}) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutHandledRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<DailyQuestStatus | null>(null);
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(15);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState(false);
  const [earnedToday, setEarnedToday] = useState(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = getMemberToken(memberMode);

      if (memberMode && !token) {
        setMessage(
          "Your Family Member session has ended. Please sign in again."
        );
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("get_daily_quest_status", {
        p_session_token: token,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error("Daily Quest status could not be loaded.");
      }

      const nextStatus = data as DailyQuestStatus;
      setStatus(nextStatus);
      setEarnedToday(nextStatus.score || 0);

      if (nextStatus.status === "completed") {
        setFinished(true);
      }
    } catch (error) {
      console.error("Daily Quest status error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load today's Daily Quest."
      );
    } finally {
      setLoading(false);
    }
  }, [memberMode]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const loadNextQuestion = useCallback(
    async (attemptId: string) => {
      const token = getMemberToken(memberMode);

      const { data, error } = await supabase.rpc(
        "get_next_daily_quest_question",
        {
          p_attempt_id: attemptId,
          p_session_token: token,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        throw new Error("No Daily Quest question is available.");
      }

      const nextQuestion = (Array.isArray(data) ? data[0] : data) as DailyQuestion;

      setQuestion(nextQuestion);
      setSelectedAnswer("");
      setResult(null);
      setTimedOut(false);
      setTimeLeft(nextQuestion.time_per_question);
      timeoutHandledRef.current = null;
    },
    [memberMode]
  );

  const startQuest = useCallback(async () => {
    setStarting(true);
    setMessage("");
    setFinished(false);

    try {
      const token = getMemberToken(memberMode);

      if (memberMode && !token) {
        throw new Error("Your Family Member session has ended. Please sign in again.");
      }

      const { data, error } = await supabase.rpc("start_daily_quest", {
        p_session_token: token,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        throw new Error("Unable to start today's Daily Quest.");
      }

      const attempt = (Array.isArray(data) ? data[0] : data) as {
        attempt_id: string;
        questions_answered: number;
        score: number;
        status: string;
      };

      setStatus((current) =>
        current
          ? {
              ...current,
              attempt_id: attempt.attempt_id,
              questions_answered: attempt.questions_answered,
              score: attempt.score,
              status: attempt.status as DailyQuestStatus["status"],
            }
          : current
      );

      if (attempt.status === "completed") {
        setFinished(true);
        return;
      }

      await loadNextQuestion(attempt.attempt_id);
    } catch (error) {
      console.error("Daily Quest start error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to start today's Daily Quest."
      );
    } finally {
      setStarting(false);
    }
  }, [loadNextQuestion, memberMode]);

  useEffect(() => {
    stopTimer();

    if (!question || result || submitting || finished) {
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return stopTimer;
  }, [question, result, submitting, finished, stopTimer]);

  useEffect(() => {
    if (!question || result || submitting || finished || timeLeft > 0) {
      return;
    }

    if (timeoutHandledRef.current === question.id) {
      return;
    }

    timeoutHandledRef.current = question.id;
    setTimedOut(true);
    void submitAnswer("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, result, submitting, finished, timeLeft]);

  async function submitAnswer(answer: string) {
    if (!question || !status?.attempt_id || submitting || result) {
      return;
    }

    stopTimer();
    setSubmitting(true);
    setMessage("");

    try {
      const token = getMemberToken(memberMode);
      const responseTime = Math.max(
        0,
        (question.time_per_question - timeLeft) * 1000
      );

      const { data, error } = await supabase.rpc(
        "submit_daily_quest_answer",
        {
          p_attempt_id: status.attempt_id,
          p_question_id: question.id,
          p_selected_answer: answer || null,
          p_response_time_ms: responseTime,
          p_session_token: token,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error("No answer result was returned.");
      }

      const answerResult = data as AnswerResult;
      setResult(answerResult);
      setEarnedToday((current) => current + answerResult.xp_earned);

      setStatus((current) =>
        current
          ? {
              ...current,
              questions_answered: answerResult.questions_answered,
              correct_answers: answerResult.correct_answers,
              score: current.score + answerResult.xp_earned,
              status: answerResult.completed ? "completed" : "in_progress",
              daily_streak:
                answerResult.daily_streak ?? current.daily_streak,
              best_daily_streak:
                answerResult.best_daily_streak ?? current.best_daily_streak,
            }
          : current
      );

      if (answerResult.completed) {
        setFinished(true);
      }
    } catch (error) {
      console.error("Daily Quest answer error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit your answer."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function continueToNextQuestion() {
    if (!status?.attempt_id) return;

    try {
      await loadNextQuestion(status.attempt_id);
    } catch (error) {
      console.error("Next Daily Quest question error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the next question."
      );
    }
  }

  const options = question
    ? [
        question.option_a,
        question.option_b,
        question.option_c,
        question.option_d,
      ]
    : [];

  const dateLabel = status?.quest_date
    ? new Date(`${status.quest_date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Today";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7faf9",
        color: "#123b38",
      }}
    >
      <AppNavbar />

      <div
        style={{
          maxWidth: "980px",
          margin: "0 auto",
          padding: "34px 18px 60px",
        }}
      >
        {loading ? (
          <div style={cardStyle}>
            <p style={mutedStyle}>Loading today&apos;s Daily Quest...</p>
          </div>
        ) : message ? (
          <div style={cardStyle}>
            <h1 style={titleStyle}>Daily Quest</h1>
            <p style={{ ...mutedStyle, color: "#a54141" }}>{message}</p>
            {memberMode && (
              <button
                type="button"
                onClick={() => router.push("/family-member-login")}
                style={buttonStyle}
              >
                Return to Family Member Login
              </button>
            )}
          </div>
        ) : finished ? (
          <div style={cardStyle}>
            <div style={badgeStyle}>DAILY QUEST COMPLETE</div>

            <h1 style={titleStyle}>
              Well done! 🎉
            </h1>

            <p style={mutedStyle}>
              You have completed today&apos;s Daily Quest.
            </p>

            <div style={statsGridStyle}>
              <Stat
                label="Correct"
                value={`${status?.correct_answers ?? 0}/${status?.question_count ?? 10}`}
              />
              <Stat
                label="XP Earned"
                value={`+${earnedToday}`}
              />
              <Stat
                label="Daily Streak"
                value={`🔥 ${status?.daily_streak ?? 0}`}
              />
            </div>

            <p style={noteStyle}>
              Your Daily Quest XP has been added to your normal Sahaba Quest
              progress. There is no separate Daily Quest leaderboard.
            </p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    memberMode
                      ? "/family-member-dashboard"
                      : status
                        ? status.status === "completed" && memberMode
                          ? "/family-member-dashboard"
                          : "/dashboard"
                        : "/dashboard"
                  )
                }
                style={buttonStyle}
              >
                Back to Dashboard
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    memberMode
                      ? "/family-member-quiz"
                      : "/quiz"
                  )
                }
                style={secondaryButtonStyle}
              >
                Continue Learning
              </button>
            </div>
          </div>
        ) : !question ? (
          <>
            <section style={heroStyle}>
              <div style={badgeStyle}>DAILY QUEST</div>

              <h1 style={heroTitleStyle}>
                A fresh challenge. Every day.
              </h1>

              <p style={heroTextStyle}>
                Test your knowledge of the Sahabah, earn normal Sahaba Quest XP,
                and keep your daily learning streak alive.
              </p>

              <div style={statsGridStyle}>
                <Stat
                  label="Questions"
                  value={`${status?.question_count ?? 10}`}
                />

                <Stat
                  label="Time / Question"
                  value={`${status?.time_per_question ?? 15}s`}
                />

                <Stat
                  label="Daily Streak"
                  value={`🔥 ${status?.daily_streak ?? 0}`}
                />
              </div>

              <button
                type="button"
                onClick={() => void startQuest()}
                disabled={starting}
                style={buttonStyle}
              >
                {starting
                  ? "Starting..."
                  : status?.status === "in_progress"
                    ? "Resume Daily Quest"
                    : "Start Today's Quest"}
              </button>

              <p style={noteStyle}>
                {status?.status === "in_progress"
                  ? `${status.questions_answered} of ${status.question_count} questions already answered.`
                  : "One completed Daily Quest per day. Your XP goes directly to your normal progress."}
              </p>
            </section>
          </>
        ) : (
          <section>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "18px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={badgeStyle}>DAILY QUEST</div>

                <h1
                  style={{
                    ...titleStyle,
                    marginBottom: "4px",
                  }}
                >
                  Question {question.question_number} of{" "}
                  {question.total_questions}
                </h1>
              </div>

              <div
                style={{
                  minWidth: "72px",
                  textAlign: "center",
                  padding: "10px 12px",
                  borderRadius: "14px",
                  background:
                    timeLeft <= 5
                      ? "#fff2f2"
                      : "#e8f4f2",
                  color:
                    timeLeft <= 5
                      ? "#a54141"
                      : "#08766d",
                  fontWeight: 900,
                }}
              >
                {timeLeft}s
              </div>
            </div>

            <div style={questionCardStyle}>
              

              <h2 style={questionTitleStyle}>
                {question.question}
              </h2>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                }}
              >
                {options.map((option, index) => {
                  const selected =
                    selectedAnswer === option;

                  const letter =
                    ["A", "B", "C", "D"][index];

                  return (
                    <button
                      key={`${question.id}-${index}`}
                      type="button"
                      disabled={submitting || !!result}
                      onClick={() => {
                        setSelectedAnswer(option);
                        void submitAnswer(option);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "16px",
                        borderRadius: "14px",
                        border: selected
                          ? "2px solid #08766d"
                          : "1px solid #d7e4e2",
                        background: selected
                          ? "#edf8f6"
                          : "#ffffff",
                        color: "#183f3b",
                        cursor:
                          submitting || !!result
                            ? "default"
                            : "pointer",
                        fontFamily: "inherit",
                        fontSize: "14px",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong
                        style={{
                          color: "#08766d",
                          marginRight: "10px",
                        }}
                      >
                        {letter}.
                      </strong>

                      {option}
                    </button>
                  );
                })}
              </div>

              {result && (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "16px",
                    borderRadius: "14px",
                    background: result.is_correct
                      ? "#edf8f6"
                      : "#fff2f2",
                    border: result.is_correct
                      ? "1px solid #cde9e4"
                      : "1px solid #f0d3d3",
                  }}
                >
                  <strong
                    style={{
                      color: result.is_correct
                        ? "#08766d"
                        : "#a54141",
                    }}
                  >
                    {timedOut
                      ? "Time's up!"
                      : result.is_correct
                        ? "Correct!"
                        : "Not quite."}
                  </strong>

                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "13px",
                      lineHeight: 1.6,
                    }}
                  >
                    Correct answer:{" "}
                    <strong>
                      {result.correct_answer}
                    </strong>
                  </p>

                  {timedOut && (
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: "13px",
                      }}
                    >
                      No answer was submitted. This question counts as
                      unanswered/incorrect and earned 0 XP.
                    </p>
                  )}

                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: "13px",
                    }}
                  >
                    +{result.xp_earned} XP
                  </p>

                  {!result.completed && (
                    <button
                      type="button"
                      onClick={() =>
                        void continueToNextQuestion()
                      }
                      style={{
                        ...buttonStyle,
                        marginTop: "14px",
                      }}
                    >
                      Next Question
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.78)",
        border: "1px solid rgba(255,255,255,0.6)",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          fontWeight: 800,
          color: "#71817f",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontSize: "20px",
          fontWeight: 900,
          color: "#123b38",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dfe9e7",
  borderRadius: "22px",
  padding: "30px",
  boxShadow: "0 10px 35px rgba(6, 63, 59, 0.06)",
};

const heroStyle: React.CSSProperties = {
  ...cardStyle,
  background:
    "linear-gradient(145deg, #063f3b 0%, #075b55 55%, #08766d 100%)",
  color: "#ffffff",
  overflow: "hidden",
};

const questionCardStyle: React.CSSProperties = {
  ...cardStyle,
  maxWidth: "760px",
  margin: "0 auto",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "7px 12px",
  borderRadius: "999px",
  background: "#e8f4f2",
  color: "#08766d",
  border: "1px solid #cce7e3",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "1.2px",
};

const heroTitleStyle: React.CSSProperties = {
  margin: "18px 0 12px",
  fontSize: "clamp(34px, 5vw, 54px)",
  lineHeight: 1,
  letterSpacing: "-1.8px",
  fontWeight: 900,
};

const heroTextStyle: React.CSSProperties = {
  maxWidth: "680px",
  margin: 0,
  color: "rgba(255,255,255,0.82)",
  fontSize: "15px",
  lineHeight: 1.7,
};

const titleStyle: React.CSSProperties = {
  margin: "16px 0 8px",
  fontSize: "32px",
  lineHeight: 1.1,
  letterSpacing: "-1px",
  fontWeight: 900,
};

const questionTitleStyle: React.CSSProperties = {
  margin: "10px 0 24px",
  fontSize: "clamp(22px, 3vw, 30px)",
  lineHeight: 1.35,
  fontWeight: 850,
};

const levelStyle: React.CSSProperties = {
  margin: 0,
  color: "#08766d",
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "1px",
};

const mutedStyle: React.CSSProperties = {
  color: "#6b7c7a",
  fontSize: "14px",
  lineHeight: 1.7,
};

const noteStyle: React.CSSProperties = {
  marginTop: "18px",
  color: "#7b8987",
  fontSize: "11px",
  lineHeight: 1.6,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
  margin: "26px 0",
};

const buttonStyle: React.CSSProperties = {
  minHeight: "48px",
  padding: "0 20px",
  border: "none",
  borderRadius: "12px",
  background: "#08766d",
  color: "#ffffff",
  fontFamily: "inherit",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#e8f4f2",
  color: "#08766d",
};