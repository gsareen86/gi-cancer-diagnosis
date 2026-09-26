import Link from "next/link";
import { Brand, Compass, Icon } from "./ui";
export function AuthShell({
  title,
  description,
  children,
  centered = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <main id="main" className="auth-shell">
      <header className="auth-header">
        <Link href="/" className="brand auth-brand">
          <Brand />
        </Link>
        <span className="secure-label">
          <Icon name="lock" size={16} /> Secure staff access
        </span>
      </header>
      <div className={`auth-grid${centered ? " auth-centered" : ""}`}>
        {!centered && (
          <section className="auth-intro" aria-label="Your workspace">
            <Compass size={64} />
            <h2>{title}</h2>
            <p className="lead">{description}</p>
            <div className="auth-rule" />
            <p className="muted">
              Your account and site membership determine which records you can
              open.
            </p>
          </section>
        )}
        <section className="panel form auth-panel">
          {children}
          <p id="account-help" className="auth-help">
            Need account help? Contact your clinic administrator or the operator
            who invited you.
          </p>
        </section>
      </div>
      <footer className="auth-footer">
        <span>GI Compass · Thoughtful care, clear direction</span>
        <span>Need urgent medical assistance? Speak to clinic staff.</span>
      </footer>
    </main>
  );
}
