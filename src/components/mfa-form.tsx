"use client";
import { rpc } from "@/lib/rpc";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { authQrDataUrl } from "@/lib/auth-qr";
export function MfaForm() {
  const router = useRouter();
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [enrol, setEnrol] = useState(false);
  useEffect(() => {
    let active = true;
    supabaseBrowser()
      .auth.mfa.listFactors()
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setError(
            "Authenticator details are unavailable. Sign in again or contact your operator.",
          );
        else if (data.totp.length) setFactor(data.totp[0].id);
        else setEnrol(true);
        setBusy(false);
      })
      .catch(() => {
        if (active) {
          setError(
            "Authenticator details are unavailable. Sign in again or contact your operator.",
          );
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function setup() {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabaseBrowser().auth.mfa.enroll({
        factorType: "totp",
        issuer: "GI Compass",
      });
      if (error || !data)
        setError(
          "Setup could not be started. Contact your operator if a previous setup was interrupted.",
        );
      else {
        setFactor(data.id);
        setQr(authQrDataUrl(data.totp.qr_code));
        setEnrol(false);
      }
    } catch {
      setError("Authenticator setup is unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const client = supabaseBrowser();
      const code = String(new FormData(event.currentTarget).get("code"));
      const result = await client.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (result.error) {
        setError(
          "That code could not be verified. Try the current code from your authenticator.",
        );
        return;
      }
      const { data, error } = await rpc(client, "begin_staff_session");
      if (error || !data?.ok)
        setError(
          "This session cannot be activated. Sign in again or contact your operator.",
        );
      else {
        router.replace("/staff");
        router.refresh();
      }
    } catch {
      setError("Verification is unavailable. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {busy && !factor && <p role="status">Checking authenticator…</p>}
      {enrol && (
        <>
          <p>Add GI Compass to your authenticator app.</p>
          <button onClick={setup} disabled={busy}>
            Set up authenticator
          </button>
        </>
      )}
      {qr && (
        <>
          <p>Scan this QR code using your authenticator. Keep it private.</p>
          <Image
            className="mfa-image"
            src={qr}
            alt="Authenticator enrolment QR code"
            width={240}
            height={240}
            unoptimized
          />
        </>
      )}
      {factor && (
        <form onSubmit={verify}>
          <label htmlFor="code">Authenticator code</label>
          <input
            id="code"
            className="auth-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
          <button disabled={busy}>
            {busy ? "Verifying…" : "Verify and continue"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
