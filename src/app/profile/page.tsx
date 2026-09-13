"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You are not logged in.");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setUsername(data?.username ?? "");
    setDisplayName(data?.display_name ?? "");
  }

  async function saveProfile() {
    setMessage("Saving...");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You are not logged in.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username,
        display_name: displayName,
      })
      .eq("id", user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Profile saved successfully! ??");
  }

  return (
    <main style={{ padding: "40px" }}>
      <h1>Sahaba Quest</h1>

      <h2>Your Profile</h2>

      <label>Display Name</label>
      <br />
      <input
        type="text"
        placeholder="Your name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />

      <br />
      <br />

      <label>Username</label>
      <br />
      <input
        type="text"
        placeholder="Choose a username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <br />
      <br />

      <button onClick={saveProfile}>
        Save Profile
      </button>

      <p>{message}</p>
    </main>
  );
}
