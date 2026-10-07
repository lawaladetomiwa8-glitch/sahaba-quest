"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";
import {
  useSearchParams,
  useRouter,
} from "next/navigation";

function QuestResultContent() {
  const params = useSearchParams();
  const router = useRouter();

  const [result, setResult] = useState({
    passed: false,
    level: 1,
    xp: 0,
    correct: 0,
  });

  useEffect(() => {
    setResult({
      passed:
        params.get("passed") === "1",

      level: Number(
        params.get("level") || 1
      ),

      xp: Number(
        params.get("xp") || 0
      ),

      correct: Number(
        params.get("correct") || 0
      ),
    });
  }, [params]);

  const {
    passed,
    level,
    xp,
    correct,
  } = result;

  return (
    <main className="sq-result-page">
      <section className="sq-result-card">

        <div className="sq-result-icon">
          {passed ? "🏆" : "📚"}
        </div>

        <p className="sq-result-eyebrow">
          QUEST COMPLETE
        </p>

        <h1>
          {passed
            ? "MashaAllah!"
            : "Keep Learning"}
        </h1>

        <p className="sq-result-message">
          {passed
            ? `You passed Level ${level}. May Allah increase you in beneficial knowledge.`
            : `You completed the Level ${level} Quest, but you need at least 25 correct answers to pass.`}
        </p>

        <div className="sq-result-stats">

          <div className="sq-result-stat correct">
            <strong>
              {correct}/50
            </strong>

            <span>
              Correct
            </span>
          </div>

          <div className="sq-result-stat xp">
            <strong>
              {xp}
            </strong>

            <span>
              XP Earned
            </span>
          </div>

        </div>

        {passed && level < 10 && (
          <div className="sq-next-level">
            <span className="sq-next-level-icon">
              ✨
            </span>

            <div>
              <strong>
                Level {level + 1} unlocked
              </strong>

              <p>
                Keep going and continue your
                journey of beneficial knowledge.
              </p>
            </div>
          </div>
        )}

        {!passed && (
          <div className="sq-encouragement">
            <strong>
              Keep going, in shaa Allah.
            </strong>

            <p>
              Review what you have learned and
              try the Quest again when you're ready.
            </p>
          </div>
        )}

        <button
          className="sq-result-button"
          onClick={() =>
            router.push(
              "/schools/student-dashboard"
            )
          }
        >
          Back to Dashboard
        </button>

      </section>

      <style jsx>{`
        .sq-result-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at top left,
              rgba(204, 251, 241, 0.65),
              transparent 32%
            ),
            radial-gradient(
              circle at bottom right,
              rgba(254, 243, 199, 0.6),
              transparent 30%
            ),
            #f7f9f8;

          display: grid;
          place-items: center;

          padding: 24px;

          color: #17221d;
        }

        .sq-result-card {
          width: min(620px, 100%);

          background: #ffffff;

          border:
            1px solid #e2e8e5;

          border-radius: 28px;

          padding:
            44px 32px;

          text-align: center;

          box-shadow:
            0 24px 60px
            rgba(15, 118, 110, 0.1);
        }

        .sq-result-icon {
          width: 76px;
          height: 76px;

          margin:
            0 auto 18px;

          display: grid;
          place-items: center;

          border-radius: 22px;

          background:
            linear-gradient(
              135deg,
              #ccfbf1,
              #fef3c7
            );

          font-size: 40px;
        }

        .sq-result-eyebrow {
          margin: 0;

          color: #0f766e;

          font-size: 11px;

          font-weight: 900;

          letter-spacing:
            0.12em;
        }

        .sq-result-card h1 {
          margin:
            8px 0 10px;

          font-size:
            clamp(30px, 5vw, 42px);

          line-height: 1.1;

          letter-spacing:
            -0.035em;

          color: #115e59;
        }

        .sq-result-message {
          max-width: 500px;

          margin:
            0 auto;

          color: #64746d;

          font-size: 15px;

          line-height: 1.7;
        }

        .sq-result-stats {
          display: grid;

          grid-template-columns:
            repeat(2, 1fr);

          gap: 12px;

          margin:
            28px 0 18px;
        }

        .sq-result-stat {
          padding: 20px;

          border-radius: 18px;
        }

        .sq-result-stat.correct {
          background: #f0fdfa;

          border:
            1px solid #ccfbf1;
        }

        .sq-result-stat.xp {
          background: #fffbeb;

          border:
            1px solid #fef3c7;
        }

        .sq-result-stat strong {
          display: block;

          font-size: 28px;

          line-height: 1;

          margin-bottom: 7px;

          color: #17221d;
        }

        .sq-result-stat span {
          color: #64746d;

          font-size: 12px;

          font-weight: 700;
        }

        .sq-next-level {
          display: flex;

          align-items: center;

          gap: 12px;

          text-align: left;

          padding: 15px 16px;

          margin-top: 16px;

          border-radius: 16px;

          background: #f0fdf4;

          border:
            1px solid #bbf7d0;
        }

        .sq-next-level-icon {
          width: 38px;
          height: 38px;

          flex:
            0 0 auto;

          display: grid;
          place-items: center;

          border-radius: 11px;

          background: #ffffff;
        }

        .sq-next-level strong {
          display: block;

          color: #166534;

          font-size: 14px;
        }

        .sq-next-level p {
          margin:
            3px 0 0;

          color: #64746d;

          font-size: 12px;

          line-height: 1.5;
        }

        .sq-encouragement {
          margin-top: 16px;

          padding: 16px;

          border-radius: 16px;

          background: #fff7ed;

          border:
            1px solid #fed7aa;

          text-align: left;
        }

        .sq-encouragement strong {
          color: #9a3412;

          font-size: 14px;
        }

        .sq-encouragement p {
          margin:
            4px 0 0;

          color: #64746d;

          font-size: 12px;

          line-height: 1.5;
        }

        .sq-result-button {
          width: 100%;

          margin-top: 24px;

          border: 0;

          border-radius: 14px;

          padding:
            14px 20px;

          background: #0f766e;

          color: #ffffff;

          font-size: 14px;

          font-weight: 800;

          cursor: pointer;

          transition:
            transform 0.18s ease,
            background 0.18s ease;
        }

        .sq-result-button:hover {
          background: #115e59;

          transform:
            translateY(-1px);
        }

        @media (max-width: 520px) {
          .sq-result-page {
            padding: 16px;
          }

          .sq-result-card {
            padding:
              32px 20px;

            border-radius: 22px;
          }

          .sq-result-stats {
            grid-template-columns:
              1fr 1fr;
          }

          .sq-result-stat {
            padding: 16px 10px;
          }

          .sq-result-stat strong {
            font-size: 24px;
          }
        }
      `}</style>
    </main>
  );
}

function QuestResultLoading() {
  return (
    <main className="sq-result-loading">
      <div className="sq-result-loading-card">
        <div className="sq-loading-icon">
          SQ
        </div>

        <p>
          Preparing your result...
        </p>
      </div>

      <style jsx>{`
        .sq-result-loading {
          min-height: 100vh;

          display: grid;

          place-items: center;

          background: #f7f9f8;

          padding: 20px;
        }

        .sq-result-loading-card {
          text-align: center;

          color: #64746d;
        }

        .sq-loading-icon {
          width: 58px;
          height: 58px;

          margin:
            0 auto 12px;

          display: grid;
          place-items: center;

          border-radius: 17px;

          background: #0f766e;

          color: #ffffff;

          font-weight: 900;
        }
      `}</style>
    </main>
  );
}

export default function SchoolStudentQuestResultPage() {
  return (
    <Suspense
      fallback={
        <QuestResultLoading />
      }
    >
      <QuestResultContent />
    </Suspense>
  );
}