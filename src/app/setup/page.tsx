import Link from "next/link";
import { runtimeConfig } from "@/lib/config";
export const dynamic = "force-dynamic";
export default function Setup() {
  const settings = runtimeConfig();
  return (
    <main id="main" className="container">
      <Link href="/" className="brand">
        GI Compass
      </Link>
      <section className="panel form">
        <p className="eyebrow">Operator setup</p>
        <h1 style={{ fontSize: "2rem" }}>Connect the demo project</h1>
        <p>
          Configure the designated India-region Supabase Cloud project using the
          repository’s .env.example. Contact the application administrator to finish configuration.
        </p>
        {!settings.ok && (
          <>
            <h2>Settings to check</h2>
            <ul>
              {settings.settings.map((name) => (
                <li className="code" key={name}>
                  {name}
                </li>
              ))}
            </ul>
          </>
        )}
        <p>
          Project identity, hosted settings and migrations must be verified
          before staff access. No local database fallback is used.
        </p>
        <Link href="/sign-in">Return to sign in</Link>
      </section>
    </main>
  );
}
