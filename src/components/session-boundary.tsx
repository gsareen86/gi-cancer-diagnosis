"use client";
import { rpc } from "@/lib/rpc";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand, Icon } from "./ui";
export function SessionBoundary({
  children,
  expiresAt,
}: {
  children: React.ReactNode;
  expiresAt: string;
}) {
  const [cleared, setCleared] = useState(false);
  const [revocationPending, setRevocationPending] = useState(false);
  const [warning, setWarning] = useState(false);
  const pathname = usePathname();
  const deadline = useRef(Date.parse(expiresAt));
  const touched = useRef(0);
  const closing = useRef(false);
  const logout = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    setCleared(true);
    const channel = new BroadcastChannel("gi-staff-session");
    channel.postMessage("logout");
    channel.close();
    const client = supabaseBrowser();
    let revoked = false;
    try {
      const result = await rpc(
        client,
        "end_staff_session",
        undefined,
        AbortSignal.timeout(5000),
      );
      revoked = !result.error && result.data?.ok === true;
    } catch {
      /* Cleared locally; do not claim remote success. */
    }
    try {
      const result = await client.auth.signOut({ scope: "local" });
      if (result.error) revoked = false;
    } catch {
      revoked = false;
    }
    // Supabase may retain its cookie on a failed remote logout. Clear only its
    // project-scoped cookies; never persist protected page content as a fallback.
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(
      ".",
    )[0];
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.trim().split("=")[0];
      if (name.startsWith(`sb-${ref}-`))
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    }
    if (revoked) window.location.replace("/sign-in?signedout=1");
    else setRevocationPending(true);
  }, []);
  useEffect(() => {
    const client = supabaseBrowser();
    let initialUser: string | undefined;
    const { data: authListener } = client.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") initialUser = session?.user.id;
        if (
          !closing.current &&
          (event === "SIGNED_OUT" ||
            (initialUser &&
              session?.user.id &&
              session.user.id !== initialUser))
        ) {
          setCleared(true);
          window.location.replace("/sign-in");
        }
      },
    );
    const channel = new BroadcastChannel("gi-staff-session");
    channel.onmessage = (event) => {
      if (event.data === "logout") {
        // A late activity request in another tab may also initiate logout.
        // Do not let that echo abort this tab's in-flight server revocation.
        if (closing.current) return;
        closing.current = true;
        setCleared(true);
        setRevocationPending(true);
        window.location.replace("/sign-in");
      } else if (
        event.data?.type === "activity" &&
        Number.isFinite(event.data.deadline)
      ) {
        deadline.current = event.data.deadline;
      }
    };
    async function activity(event: Event) {
      if (
        !event.isTrusted ||
        closing.current ||
        Date.now() - touched.current < 60000
      )
        return;
      touched.current = Date.now();
      if (Date.now() >= deadline.current) {
        void logout();
        return;
      }
      try {
        const { data, error } = await rpc(
          supabaseBrowser(),
          "touch_staff_session",
        );
        if (error || !data?.ok) {
          void logout();
          return;
        }
        deadline.current = Math.min(
          Date.parse(data.data.idleExpiresAt),
          Date.parse(data.data.absoluteExpiresAt),
        );
        channel.postMessage({ type: "activity", deadline: deadline.current });
      } catch {
        void logout();
      }
    }
    const timer = setInterval(() => {
      const left = deadline.current - Date.now();
      setWarning(left <= 60000);
      if (!Number.isFinite(left) || left <= 0) void logout();
    }, 1000);
    const pageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", pageShow);
    ["pointerdown", "keydown", "scroll"].forEach((name) =>
      window.addEventListener(name, activity, { passive: true }),
    );
    return () => {
      clearInterval(timer);
      authListener.subscription.unsubscribe();
      channel.close();
      window.removeEventListener("pageshow", pageShow);
      ["pointerdown", "keydown", "scroll"].forEach((name) =>
        window.removeEventListener(name, activity),
      );
    };
  }, [logout]);
  if (cleared)
    return (
      <main id="main" className="container">
        {revocationPending ? (
          <section className="panel form">
            <h1 style={{ fontSize: "2rem" }}>Content cleared on this device</h1>
            <p role="status" className="notice">
              Server sign-out could not be confirmed. Reconnect and contact your
              operator if this device may be compromised. Your session will
              expire automatically.
            </p>
            <a className="button" href="/sign-in?revocation=pending">
              Return to sign in
            </a>
          </section>
        ) : (
          <p role="status">Protected content cleared. Completing sign-out…</p>
        )}
      </main>
    );
  return (
    <div className="staff-shell">
      <aside className="staff-sidebar" aria-label="Clinic navigation">
        <Link className="brand" href="/staff">
          <Brand />
        </Link>
        <div className="sidebar-caption">
          <Icon name="clinic" /> Clinical workspace
        </div>
        <nav>
          <Link
            className={
              pathname === "/staff" || pathname.startsWith("/staff/demo")
                ? "active"
                : ""
            }
            href="/staff"
          >
            <Icon name="document" /> Review queue
          </Link>
          <Link href="/staff?view=reviewed">
            <Icon name="check" /> Reviewed visits
          </Link>
          <Link href="/staff#patient-directory">
            <Icon name="person" /> Patient directory
          </Link>
          <Link href="/staff/ai">
            <Icon name="spark" /> AI settings
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="staff-identity">
            <span className="avatar">
              <Icon name="person" />
            </span>
            <span>
              Clinic team<small>Secure workspace</small>
            </span>
          </div>
          <button className="sidebar-logout" onClick={() => void logout()}>
            <Icon name="logout" /> Sign out
          </button>
        </div>
      </aside>
      <div className="staff-content">
        {warning && (
          <p role="status" className="notice">
            Your session is about to expire. Continue interacting to stay signed
            in.
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
