import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { runtimeConfig } from "../config";
import { boundedFetch } from "../bounded-fetch";
import type { Database } from "../database.types";
export async function supabaseServer() {
  const settings = runtimeConfig();
  if (!settings.ok) return null;
  const jar = await cookies();
  return createServerClient<Database, "api">(settings.config.url, settings.config.publicKey, {
    db: { schema: "api" },
    global: { fetch: boundedFetch },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, {
              ...options,
              secure: settings.config.origin.startsWith("https:"),
              sameSite: "lax",
            }),
          );
        } catch {
          /* Server components cannot write; proxy refreshes cookies. */
        }
      },
    },
  });
}
