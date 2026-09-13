"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUserEmail(user?.email ?? null);
  }

  async function handleSignup() {
    setMessage("Creating account...");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Signup successful! Check your email to confirm your account."
    );
  }

  async function handleLogin() {
    setMessage("Logging in...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Login successful! 🎉");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setMessage("You have been logged out.");
  }

  return (
    <main style={{ padding: "40px" }}>
      <h1>Sahaba Quest</h1>

      {userEmail ? (
        <>
          <h2>You are logged in 🎉</h2>
          <p>Account: {userEmail}</p>

          <button onClick={handleLogout}>
            Logout
          </button>
        </>
      ) : (
        <>
          <h2>Authentication Test</h2>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <br />
          <br />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <br />
          <br />

          <button onClick={handleSignup}>
            Create Account
          </button>

          <br />
          <br />

          <button onClick={handleLogin}>
            Login
          </button>

          <p>{message}</p>
        </>
      )}
    </main>
  );
}