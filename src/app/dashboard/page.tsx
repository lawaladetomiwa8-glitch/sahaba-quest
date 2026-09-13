"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = {
  username: string | null;
  display_name: string | null;
};

type Progress = {
  current_level: number;
  total_xp: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState("Loading your dashboard...");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You are not logged in.");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    const { data: progressData, error: progressError } = await supabase
      .from("player_progress")
      .select(
        "current_level, total_xp, questions_answered, correct_answers, current_streak, best_streak"
      )
      .eq("user_id", user.id)
      .single();

    if (progressError) {
      setMessage(progressError.message);
      return;
    }

    setProfile(profileData);
    setProgress(progressData);
    setMessage("");
  }

  if (!profile || !progress) {
    return (
      <main style={{ padding: "40px" }}>
        <h1>Sahaba Quest</h1>
        <p>{message}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "40px" }}>
      <h1>Sahaba Quest</h1>

      <h2>
        Welcome, {profile.display_name || profile.username || "Player"}!
      </h2>

      <p>
        Username: {profile.username || "Not set"}
      </p>

      <hr />

      <h2>Your Progress</h2>

      <p>
        <strong>Level:</strong> {progress.current_level}
      </p>

      <p>
        <strong>XP:</strong> {progress.total_xp}
      </p>

      <p>
        <strong>Questions Answered:</strong>{" "}
        {progress.questions_answered}
      </p>

      <p>
        <strong>Correct Answers:</strong>{" "}
        {progress.correct_answers}
      </p>

      <p>
        <strong>Current Streak:</strong>{" "}
        {progress.current_streak}
      </p>

      <p>
        <strong>Best Streak:</strong>{" "}
        {progress.best_streak}
      </p>
    </main>
  );
}
