"use client";
import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { Icon } from "./ui";
export function AuthForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await supabaseBrowser().auth.signInWithPassword({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (result.error)
        setError(
          "Sign-in was unsuccessful. Check your details or contact your operator.",
        );
      else {
        router.replace("/mfa");
        router.refresh();
      }
    } catch {
      setError("Sign-in is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="email">Staff email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="name@clinic.example"
        required
      />
      <label htmlFor="password">Password</label>
      <div className="password-field">
        <input
          id="password"
          name="password"
          type={revealed ? "text" : "password"}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={revealed ? "Hide password" : "Show password"}
          aria-pressed={revealed}
          onClick={() => setRevealed(!revealed)}
        >
          <Icon name="eye" />
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button disabled={busy}>{busy ? "Signing in…" : "Continue"}</button>
      <p className="secure-label auth-security">
        <Icon name="lock" size={17} /> You’ll verify your sign-in with an
        authenticator code.
      </p>
    </form>
  );
}
