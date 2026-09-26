"use client";
import { createBrowserClient } from "@supabase/ssr";
import { boundedFetch } from "../bounded-fetch";
import type { Database } from "../database.types";
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith("sb_publishable_"))
    throw new Error("Cloud configuration unavailable");
  return createBrowserClient<Database, "api">(url, key, { db: { schema: "api" }, global: { fetch: boundedFetch } });
}
