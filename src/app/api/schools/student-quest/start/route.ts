import { NextRequest, NextResponse } from "next/server";


import { supabaseServer } from "@/lib/supabase-server";

import { getStudentContext } from "../auth";


const QUESTIONS_PER_QUEST = 50;


export async function POST(request: NextRequest) {

  try {

    /*

     * ---------------------------------------------------------

     * 1. Verify the student's authenticated learning session

     * ---------------------------------------------------------

     */


    const context = await getStudentContext(request);


    if ("error" in context) {

      return context.error;

    }


    const {

      student,

      progress,

    } = context;


    /*

     * ---------------------------------------------------------

     * 2. Validate the student's current level

     * ---------------------------------------------------------

     */


    const currentLevel = Number(progress.current_level ?? 1);


    if (

      !Number.isInteger(currentLevel) ||

      currentLevel < 1

    ) {

      console.error(

        "Invalid school student current level:",

        {

          studentId: student.id,

          currentLevel,

        }

      );


      return NextResponse.json(

        {

          success: false,

          message:

            "Your learning level could not be verified. Please contact your school administrator.",

        },

        { status: 500 }

      );

    }


    /*

     * ---------------------------------------------------------

     * 3. Look for an existing active Quest session

     * ---------------------------------------------------------

     *

     * There should only ever be one active session per student.

     *

     * However, we still explicitly verify that the active

     * session belongs to the student's CURRENT level.

     */


    const {

      data: activeSession,

      error: activeSessionError,

    } = await supabaseServer

      .from("school_student_game_sessions")

      .select(

        `

        id,

        student_id,

        level,

        score,

        questions_answered,

        correct_answers,

        status,

        current_question_id,

        current_question_started_at,

        started_at,

        created_at

        `

      )

      .eq("student_id", student.id)

      .eq("status", "active")

      .order("created_at", {

        ascending: false,

      })

      .limit(1)

      .maybeSingle();


    if (activeSessionError) {

      console.error(

        "School Quest active session lookup error:",

        activeSessionError

      );


      return NextResponse.json(

        {

          success: false,

          message:

            "We could not check your current Quest session.",

        },

        { status: 500 }

      );

    }


    /*

     * ---------------------------------------------------------

     * 4. Resume only if the active session is for the

     *    student's current level

     * ---------------------------------------------------------

     */


    if (

      activeSession &&

      Number(activeSession.level) === currentLevel

    ) {

      return NextResponse.json({

        success: true,

        resumed: true,

        session: {

          id: activeSession.id,

          student_id: activeSession.student_id,

          level: activeSession.level,

          score: activeSession.score,

          questions_answered:

            activeSession.questions_answered,

          correct_answers:

            activeSession.correct_answers,

          status: activeSession.status,

          current_question_id:

            activeSession.current_question_id,

          current_question_started_at:

            activeSession.current_question_started_at,

          started_at: activeSession.started_at,

        },

        current_level: currentLevel,

        questions_required: QUESTIONS_PER_QUEST,

      });

    }


    /*

     * ---------------------------------------------------------

     * 5. If an active session belongs to an OLD level,

     *    it is obsolete.

     * ---------------------------------------------------------

     *

     * Example:

     *

     * progress.current_level = 2

     * active session.level   = 1

     *

     * The student has already passed Level 1.

     * Therefore Level 1 must NEVER be resumed.

     */


    if (

      activeSession &&

      Number(activeSession.level) !== currentLevel

    ) {

      const { error: obsoleteSessionError } =

        await supabaseServer

          .from("school_student_game_sessions")

          .update({

            status: "abandoned",

            current_question_id: null,

            current_question_started_at: null,

            completed_at: new Date().toISOString(),

          })

          .eq("id", activeSession.id)

          .eq("student_id", student.id)

          .eq("status", "active");


      if (obsoleteSessionError) {

        console.error(

          "School Quest obsolete session cleanup error:",

          obsoleteSessionError

        );


        return NextResponse.json(

          {

            success: false,

            message:

              "We could not prepare your next Quest level.",

          },

          { status: 500 }

        );

      }

    }


    /*

     * ---------------------------------------------------------

     * 6. Create a NEW Quest session at the student's

     *    CURRENT level

     * ---------------------------------------------------------

     */


    const {

      data: newSession,

      error: newSessionError,

    } = await supabaseServer

      .from("school_student_game_sessions")

      .insert({

        student_id: student.id,

        level: currentLevel,

        score: 0,

        questions_answered: 0,

        correct_answers: 0,

        status: "active",

        current_question_id: null,

        current_question_started_at: null,

        track: "shared",

      })

      .select(

        `

        id,

        student_id,

        level,

        score,

        questions_answered,

        correct_answers,

        status,

        current_question_id,

        current_question_started_at,

        started_at,

        created_at

        `

      )

      .single();


    /*

     * ---------------------------------------------------------

     * 7. Handle database-level duplicate protection

     * ---------------------------------------------------------

     *

     * The unique partial index protects us against two

     * simultaneous start requests.

     */


    if (newSessionError) {

      console.error(

        "School Quest session creation error:",

        newSessionError

      );


      /*

       * PostgreSQL unique violation.

       *

       * Another request may have created the active session

       * milliseconds before this request.

       *

       * Re-read the active session and resume it if it is

       * for the student's current level.

       */


      if (newSessionError.code === "23505") {

        const {

          data: concurrentSession,

          error: concurrentSessionError,

        } = await supabaseServer

          .from("school_student_game_sessions")

          .select(

            `

            id,

            student_id,

            level,

            score,

            questions_answered,

            correct_answers,

            status,

            current_question_id,

            current_question_started_at,

            started_at,

            created_at

            `

          )

          .eq("student_id", student.id)

          .eq("status", "active")

          .eq("level", currentLevel)

          .order("created_at", {

            ascending: false,

          })

          .limit(1)

          .maybeSingle();


        if (

          concurrentSessionError ||

          !concurrentSession

        ) {

          console.error(

            "School Quest concurrent session lookup error:",

            concurrentSessionError

          );


          return NextResponse.json(

            {

              success: false,

              message:

                "Your Quest is already being started. Please try again.",

            },

            { status: 409 }

          );

        }


        return NextResponse.json({

          success: true,

          resumed: true,

          session: concurrentSession,

          current_level: currentLevel,

          questions_required: QUESTIONS_PER_QUEST,

        });

      }


      return NextResponse.json(

        {

          success: false,

          message:

            "We could not start your Quest. Please try again.",

        },

        { status: 500 }

      );

    }


    /*

     * ---------------------------------------------------------

     * 8. Return the newly-created Quest session

     * ---------------------------------------------------------

     */


    return NextResponse.json({

      success: true,

      resumed: false,

      session: newSession,

      current_level: currentLevel,

      questions_required: QUESTIONS_PER_QUEST,

    });

  } catch (error) {

    console.error(

      "School Student Quest start error:",

      error

    );


    return NextResponse.json(

      {

        success: false,

        message:

          "Something went wrong while starting your Quest.",

      },

      { status: 500 }

    );

  }

}