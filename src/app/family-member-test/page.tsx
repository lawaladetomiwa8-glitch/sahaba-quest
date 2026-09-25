"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

const TEST_MEMBER_ID =
  "bc4e1945-2b3f-4a47-bd9a-40ed96d3ad9c";

const TEST_MEMBER_PIN = "2468";

type MemberSession = {
  member_id: string;
  family_id: string;
  owner_user_id: string;
  display_name: string;
  expires_at: string;
};

type GameSession = {
  session_id: string;
  member_id: string;
  family_id: string;
  display_name: string;
  level: number;
  track: string;
  started_at: string;
};

type QuizQuestion = {
  id: string;
  level: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
};

type AnswerResult = {
  member_id: string;
  display_name: string;
  family_id: string;
  is_correct: boolean;
  correct_answer: string;
  xp_earned: number;
  current_streak: number;
  best_streak: number;
  level_completed: boolean;
  level_passed: boolean;
  current_level: number;
  questions_answered_in_level: number;
  correct_answers_in_attempt: number;
  questions_required: number;
  correct_required_to_pass: number;
};

export default function FamilyMemberTestPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [step, setStep] = useState("");

  const [memberSession, setMemberSession] =
    useState<MemberSession | null>(null);

  const [gameSession, setGameSession] =
    useState<GameSession | null>(null);

  const [question, setQuestion] =
    useState<QuizQuestion | null>(null);

  const [selectedAnswer, setSelectedAnswer] =
    useState("");

  const [answerResult, setAnswerResult] =
    useState<AnswerResult | null>(null);

  async function runTest() {
    setLoading(true);
    setError("");
    setStep("");

    setMemberSession(null);
    setGameSession(null);
    setQuestion(null);
    setSelectedAnswer("");
    setAnswerResult(null);

    try {
      // ============================================================
      // STEP 1 — CHECK AUTHENTICATED FAMILY OWNER
      // ============================================================

      setStep("Checking authenticated Family Owner...");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(
          `Authentication check failed: ${userError.message}`
        );
      }

      if (!user) {
        throw new Error(
          "No authenticated user found. Please sign in as the Family Owner."
        );
      }

      console.log(
        "Authenticated Family Owner:",
        user.id
      );

      // ============================================================
      // STEP 2 — VERIFY FAMILY MEMBER PIN
      // ============================================================

      setStep("Verifying Family Member PIN...");

      const {
        data: verifyData,
        error: verifyError,
      } = await supabase.rpc(
        "verify_family_member_pin",
        {
          p_member_id: TEST_MEMBER_ID,
          p_pin: TEST_MEMBER_PIN,
        }
      );

      if (verifyError) {
        console.error(
          "verify_family_member_pin error:",
          verifyError
        );

        throw new Error(
          `Family Member PIN verification failed: ${verifyError.message}`
        );
      }

      console.log(
        "verify_family_member_pin result:",
        verifyData
      );

      if (
        !verifyData ||
        !Array.isArray(verifyData) ||
        verifyData.length === 0
      ) {
        throw new Error(
          "Family Member PIN verification returned no session."
        );
      }

      const token =
        verifyData[0]?.session_token;

      if (!token) {
        throw new Error(
          "Family Member verification succeeded, but no session token was returned."
        );
      }

      console.log(
        "Family Member session token received."
      );

      // Save the active Family Member session for the dashboard.
      sessionStorage.setItem(
        "sahabaquest_family_member_session",
        token
      );

      // ============================================================
      // STEP 3 — RESOLVE FAMILY MEMBER SESSION
      // ============================================================

      setStep(
        "Resolving Family Member session..."
      );

      const {
        data: resolvedData,
        error: resolvedError,
      } = await supabase.rpc(
        "get_family_member_session",
        {
          p_session_token: token,
        }
      );

      if (resolvedError) {
        console.error(
          "get_family_member_session error:",
          resolvedError
        );

        throw new Error(
          `Getting Family Member session failed: ${resolvedError.message}`
        );
      }

      console.log(
        "get_family_member_session result:",
        resolvedData
      );

      if (
        !resolvedData ||
        !Array.isArray(resolvedData) ||
        resolvedData.length === 0
      ) {
        throw new Error(
          "Family Member session could not be resolved."
        );
      }

      const resolvedMember =
        resolvedData[0] as MemberSession;

      setMemberSession(resolvedMember);

      // ============================================================
      // STEP 4 — START FAMILY MEMBER QUIZ
      // ============================================================

      setStep(
        "Starting Family Member quiz..."
      );

      const {
        data: quizData,
        error: quizError,
      } = await supabase.rpc(
        "start_family_member_quiz",
        {
          p_session_token: token,
          p_level: 1,
          p_track: "individual",
        }
      );

      if (quizError) {
        console.error(
          "start_family_member_quiz error:",
          quizError
        );

        throw new Error(
          `Starting Family Member quiz failed: ${quizError.message}`
        );
      }

      console.log(
        "start_family_member_quiz result:",
        quizData
      );

      if (
        !quizData ||
        !Array.isArray(quizData) ||
        quizData.length === 0
      ) {
        throw new Error(
          "start_family_member_quiz returned no game session."
        );
      }

      const startedGameSession =
        quizData[0] as GameSession;

      if (
        !startedGameSession ||
        !startedGameSession.session_id
      ) {
        throw new Error(
          "The Family Member game session did not return a session_id."
        );
      }

      setGameSession(
        startedGameSession
      );

      // ============================================================
      // STEP 5 — GET QUESTION
      // ============================================================

      setStep(
        "Getting Family Member question..."
      );

      const {
        data: questionData,
        error: questionError,
      } = await supabase.rpc(
        "get_next_family_member_quiz_question",
        {
          p_session_token: token,
          p_session_id:
            startedGameSession.session_id,
        }
      );

      if (questionError) {
        console.error(
          "get_next_family_member_quiz_question error:",
          questionError
        );

        throw new Error(
          `Getting Family Member question failed: ${questionError.message}`
        );
      }

      console.log(
        "get_next_family_member_quiz_question result:",
        questionData
      );

      if (
        !questionData ||
        !Array.isArray(questionData) ||
        questionData.length === 0
      ) {
        throw new Error(
          "No Family Member question was returned."
        );
      }

      const nextQuestion =
        questionData[0] as QuizQuestion;

      setQuestion(nextQuestion);

      setStep(
        "SUCCESS — Family Member received Question 1."
      );
    } catch (err) {
      console.error(
        "Family Member test error:",
        err
      );

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "An unknown error occurred."
        );
      }

      setStep("");
    } finally {
      setLoading(false);
    }
  }

  // ================================================================
  // SUBMIT FAMILY MEMBER ANSWER
  // ================================================================

  async function submitAnswer(answer: string) {
    if (!question) {
      setError(
        "There is no active question."
      );
      return;
    }

    if (!gameSession) {
      setError(
        "There is no active Family Member game session."
      );
      return;
    }

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");
    setStep(
      "Submitting Family Member answer..."
    );

    try {
      // ------------------------------------------------------------
      // Get the active Family Member session again.
      // ------------------------------------------------------------

      const {
        data: verifyData,
        error: verifyError,
      } = await supabase.rpc(
        "verify_family_member_pin",
        {
          p_member_id: TEST_MEMBER_ID,
          p_pin: TEST_MEMBER_PIN,
        }
      );

      if (verifyError) {
        throw new Error(
          `Family Member session verification failed: ${verifyError.message}`
        );
      }

      if (
        !verifyData ||
        !Array.isArray(verifyData) ||
        verifyData.length === 0
      ) {
        throw new Error(
          "Could not create a Family Member session for answer submission."
        );
      }

      const token =
        verifyData[0]?.session_token;

      if (!token) {
        throw new Error(
          "No Family Member session token was returned."
        );
      }

      console.log(
        "Submitting Family Member answer:",
        {
          session_id:
            gameSession.session_id,
          question_id: question.id,
          selected_answer: answer,
        }
      );

      // ------------------------------------------------------------
      // SUBMIT ANSWER
      // ------------------------------------------------------------

      const {
        data: resultData,
        error: resultError,
      } = await supabase.rpc(
        "submit_family_member_quiz_answer",
        {
          p_session_token: token,
          p_session_id:
            gameSession.session_id,
          p_question_id: question.id,
          p_selected_answer: answer,
          p_response_time_ms: null,
        }
      );

      if (resultError) {
        console.error(
          "submit_family_member_quiz_answer error:",
          resultError
        );

        throw new Error(
          `Submitting Family Member answer failed: ${resultError.message}`
        );
      }

      console.log(
        "submit_family_member_quiz_answer result:",
        resultData
      );

      if (
        !resultData ||
        !Array.isArray(resultData) ||
        resultData.length === 0
      ) {
        throw new Error(
          "The answer submission returned no result."
        );
      }

      const result =
        resultData[0] as AnswerResult;

      setSelectedAnswer(answer);
      setAnswerResult(result);

      setStep(
        "SUCCESS — Family Member answer submitted."
      );
    } catch (err) {
      console.error(
        "Family Member answer submission error:",
        err
      );

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "An unknown error occurred while submitting the answer."
        );
      }

      setStep("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 20px",
        background: "#f5f7fb",
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        {/* ========================================================
            HEADER
        ======================================================== */}

        <h1
          style={{
            fontSize: "32px",
            fontWeight: 700,
            marginBottom: "10px",
          }}
        >
          Family Member Gameplay Test
        </h1>

        <p
          style={{
            color: "#6b7280",
            marginBottom: "30px",
          }}
        >
          Testing Family Member authentication,
          quiz session creation, question retrieval,
          and answer submission.
        </p>

        {/* ========================================================
            START TEST BUTTON
        ======================================================== */}

        <button
          type="button"
          onClick={runTest}
          disabled={loading || submitting}
          style={{
            padding: "12px 20px",
            borderRadius: "8px",
            border: "none",
            background:
              loading || submitting
                ? "#9ca3af"
                : "#111827",
            color: "#ffffff",
            fontWeight: 600,
            cursor:
              loading || submitting
                ? "not-allowed"
                : "pointer",
            marginBottom: "25px",
          }}
        >
          {loading
            ? "Starting Test..."
            : "Run Family Member Test"}
        </button>

        <button
          type="button"
          onClick={() => {
            window.location.href = "/family-member-dashboard";
          }}
          style={{
            padding: "12px 20px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            background: "#ffffff",
            color: "#111827",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "25px",
            marginLeft: "10px",
          }}
        >
          Open Family Member Dashboard
        </button>

        {/* ========================================================
            STATUS
        ======================================================== */}

        {step && (
          <div
            style={{
              padding: "15px",
              background: "#e0f2fe",
              border: "1px solid #7dd3fc",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <strong>Status:</strong>{" "}
            {step}
          </div>
        )}

        {/* ========================================================
            ERROR
        ======================================================== */}

        {error && (
          <div
            style={{
              padding: "15px",
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: "8px",
              marginBottom: "20px",
              color: "#991b1b",
            }}
          >
            <strong>Error:</strong>

            <div
              style={{
                marginTop: "5px",
                whiteSpace: "pre-wrap",
              }}
            >
              {error}
            </div>
          </div>
        )}

        {/* ========================================================
            FAMILY MEMBER SESSION
        ======================================================== */}

        {memberSession && (
          <section
            style={{
              background: "#ffffff",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "20px",
              boxShadow:
                "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                marginBottom: "15px",
              }}
            >
              Family Member Session
            </h2>

            <p>
              <strong>
                Family Member Name:
              </strong>{" "}
              {memberSession.display_name}
            </p>

            <p>
              <strong>Member ID:</strong>{" "}
              {memberSession.member_id}
            </p>

            <p>
              <strong>Family ID:</strong>{" "}
              {memberSession.family_id}
            </p>

            <p>
              <strong>Owner ID:</strong>{" "}
              {memberSession.owner_user_id}
            </p>

            <p>
              <strong>
                Session expires:
              </strong>{" "}
              {memberSession.expires_at}
            </p>
          </section>
        )}

        {/* ========================================================
            GAME SESSION
        ======================================================== */}

        {gameSession && (
          <section
            style={{
              background: "#ffffff",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "20px",
              boxShadow:
                "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                marginBottom: "15px",
              }}
            >
              Game Session
            </h2>

            <p>
              <strong>Session ID:</strong>{" "}
              {gameSession.session_id}
            </p>

            <p>
              <strong>Member ID:</strong>{" "}
              {gameSession.member_id}
            </p>

            <p>
              <strong>Family ID:</strong>{" "}
              {gameSession.family_id}
            </p>

            <p>
              <strong>
                Family Member:
              </strong>{" "}
              {gameSession.display_name}
            </p>

            <p>
              <strong>Level:</strong>{" "}
              {gameSession.level}
            </p>

            <p>
              <strong>Track:</strong>{" "}
              {gameSession.track}
            </p>

            <p>
              <strong>
                Started At:
              </strong>{" "}
              {gameSession.started_at}
            </p>
          </section>
        )}

        {/* ========================================================
            QUESTION
        ======================================================== */}

        {question && (
          <section
            style={{
              background: "#ffffff",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "20px",
              boxShadow:
                "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                marginBottom: "15px",
              }}
            >
              Question 1
            </h2>

            <p
              style={{
                fontSize: "18px",
                fontWeight: 600,
                marginBottom: "20px",
              }}
            >
              {question.question}
            </p>

            {/* OPTION A */}

            <button
              type="button"
              disabled={
                submitting || !!answerResult
              }
              onClick={() =>
                submitAnswer(
                  question.option_a
                )
              }
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "14px",
                marginBottom: "10px",
                border:
                  selectedAnswer ===
                  question.option_a
                    ? "2px solid #111827"
                    : "1px solid #d1d5db",
                borderRadius: "8px",
                background:
                  selectedAnswer ===
                  question.option_a
                    ? "#f3f4f6"
                    : "#ffffff",
                cursor:
                  submitting || answerResult
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  submitting || answerResult
                    ? 0.7
                    : 1,
              }}
            >
              <strong>A.</strong>{" "}
              {question.option_a}
            </button>

            {/* OPTION B */}

            <button
              type="button"
              disabled={
                submitting || !!answerResult
              }
              onClick={() =>
                submitAnswer(
                  question.option_b
                )
              }
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "14px",
                marginBottom: "10px",
                border:
                  selectedAnswer ===
                  question.option_b
                    ? "2px solid #111827"
                    : "1px solid #d1d5db",
                borderRadius: "8px",
                background:
                  selectedAnswer ===
                  question.option_b
                    ? "#f3f4f6"
                    : "#ffffff",
                cursor:
                  submitting || answerResult
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  submitting || answerResult
                    ? 0.7
                    : 1,
              }}
            >
              <strong>B.</strong>{" "}
              {question.option_b}
            </button>

            {/* OPTION C */}

            <button
              type="button"
              disabled={
                submitting || !!answerResult
              }
              onClick={() =>
                submitAnswer(
                  question.option_c
                )
              }
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "14px",
                marginBottom: "10px",
                border:
                  selectedAnswer ===
                  question.option_c
                    ? "2px solid #111827"
                    : "1px solid #d1d5db",
                borderRadius: "8px",
                background:
                  selectedAnswer ===
                  question.option_c
                    ? "#f3f4f6"
                    : "#ffffff",
                cursor:
                  submitting || answerResult
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  submitting || answerResult
                    ? 0.7
                    : 1,
              }}
            >
              <strong>C.</strong>{" "}
              {question.option_c}
            </button>

            {/* OPTION D */}

            <button
              type="button"
              disabled={
                submitting || !!answerResult
              }
              onClick={() =>
                submitAnswer(
                  question.option_d
                )
              }
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "14px",
                marginBottom: "10px",
                border:
                  selectedAnswer ===
                  question.option_d
                    ? "2px solid #111827"
                    : "1px solid #d1d5db",
                borderRadius: "8px",
                background:
                  selectedAnswer ===
                  question.option_d
                    ? "#f3f4f6"
                    : "#ffffff",
                cursor:
                  submitting || answerResult
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  submitting || answerResult
                    ? 0.7
                    : 1,
              }}
            >
              <strong>D.</strong>{" "}
              {question.option_d}
            </button>

            {/* ======================================================
                SUBMISSION STATUS
            ====================================================== */}

            {submitting && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "15px",
                  background: "#f3f4f6",
                  borderRadius: "8px",
                }}
              >
                Submitting answer...
              </div>
            )}

            {/* ======================================================
                ANSWER RESULT
            ====================================================== */}

            {answerResult && (
              <div
                style={{
                  marginTop: "25px",
                  padding: "20px",
                  background:
                    answerResult.is_correct
                      ? "#ecfdf5"
                      : "#fef2f2",
                  border:
                    answerResult.is_correct
                      ? "1px solid #86efac"
                      : "1px solid #fca5a5",
                  borderRadius: "10px",
                }}
              >
                <h3
                  style={{
                    fontSize: "22px",
                    fontWeight: 700,
                    marginBottom: "15px",
                  }}
                >
                  {answerResult.is_correct
                    ? "Correct Answer!"
                    : "Incorrect Answer"}
                </h3>

                <p>
                  <strong>
                    Family Member:
                  </strong>{" "}
                  {answerResult.display_name}
                </p>

                <p>
                  <strong>XP Earned:</strong>{" "}
                  {answerResult.xp_earned}
                </p>

                <p>
                  <strong>
                    Current Streak:
                  </strong>{" "}
                  {answerResult.current_streak}
                </p>

                <p>
                  <strong>
                    Best Streak:
                  </strong>{" "}
                  {answerResult.best_streak}
                </p>

                <p>
                  <strong>
                    Questions Answered:
                  </strong>{" "}
                  {
                    answerResult.questions_answered_in_level
                  }
                  {" / "}
                  {answerResult.questions_required}
                </p>

                <p>
                  <strong>
                    Correct Answers:
                  </strong>{" "}
                  {
                    answerResult.correct_answers_in_attempt
                  }
                  {" / "}
                  {answerResult.correct_required_to_pass}
                </p>

                <p>
                  <strong>
                    Current Level:
                  </strong>{" "}
                  {answerResult.current_level}
                </p>

                <p>
                  <strong>
                    Level Completed:
                  </strong>{" "}
                  {answerResult.level_completed
                    ? "Yes"
                    : "No"}
                </p>

                <p>
                  <strong>
                    Level Passed:
                  </strong>{" "}
                  {answerResult.level_passed
                    ? "Yes"
                    : "No"}
                </p>

                {/* DEVELOPMENT ONLY */}

                <div
                  style={{
                    marginTop: "20px",
                    padding: "12px",
                    background: "#fef3c7",
                    border:
                      "1px solid #f59e0b",
                    borderRadius: "8px",
                  }}
                >
                  <strong>
                    Development only — Correct
                    Answer:
                  </strong>{" "}
                  {answerResult.correct_answer}
                </div>
              </div>
            )}

            {/* ======================================================
                QUESTION EXPLANATION
            ====================================================== */}

            {question.explanation && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "15px",
                  background: "#f3f4f6",
                  borderRadius: "8px",
                }}
              >
                <strong>
                  Explanation:
                </strong>{" "}
                {question.explanation}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}