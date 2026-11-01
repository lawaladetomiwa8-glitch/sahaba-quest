
"use client";

import { useRef } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Sends readers to the quiz that belongs to their current account.
 *
 * School students use the platform's separate student-session token,
 * while Individual and Family users use Supabase authentication and
 * the account_type stored in their profiles row.
 */
export default function SahabahQuizLink() {
  const router = useRouter();
  const navigationInProgress = useRef(false);

  async function handleQuizClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    if (navigationInProgress.current) return;
    navigationInProgress.current = true;

    try {
      // School students do not use the regular Supabase user session.
      // Their existing student session is stored separately.
      const schoolStudentToken = sessionStorage.getItem(
        "school_student_session_token",
      );

      if (schoolStudentToken) {
        router.push("/schools/student-quest");
        return;
      }

      // Check the currently authenticated Supabase user.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      // Send visitors who are not signed in to the sign-up page.
      if (!user) {
        router.push("/signup");
        return;
      }

      // Retrieve the authenticated user's account type.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

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
