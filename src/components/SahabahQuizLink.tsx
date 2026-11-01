
"use client";

import { useRef } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SahabahQuizLink() {
  const router = useRouter();
  const navigationInProgress = useRef(false);

  async function handleQuizClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    if (navigationInProgress.current) return;
    navigationInProgress.current = true;

    try {
      // 1. Check whether this is an authenticated school student.
      const schoolStudentToken = sessionStorage.getItem(
        "school_student_session_token",
      );

      if (schoolStudentToken) {
        router.push("/schools/student-quest");
        return;
      }

      // 2. Check the existing Supabase session.
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      // 3. Visitors without an account or active session go to signup.
      if (!session) {
        router.push("/signup");
        return;
      }

      // 4. Retrieve the user's account type.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      // 5. Direct the user to the appropriate quiz.
      switch (profile?.account_type) {
        case "family":
          router.push("/family-quest");
          return;

        case "individual":
        case "free":
          router.push("/quiz");
          return;

        default:
          throw new Error(
            "Your Sahaba Quest account type could not be identified.",
          );
      }
    } catch (error) {
      console.error("Sahabah quiz redirection failed:", error);

      navigationInProgress.current = false;

      window.alert(
        "We couldn't verify your account right now. Please refresh the page and try again.",
      );
    }
  }

  return (
    <Link
      href="/signup"
      onClick={handleQuizClick}
      className="sq-button-primary"
    >
      Test Your Knowledge →
    </Link>
  );
}
