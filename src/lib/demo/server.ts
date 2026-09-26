import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { runtimeConfig } from "../config";
import { supabaseServer } from "../supabase/server";
import type { Json } from "../database.types";
import { projectAssessmentState } from "./assessment-state";
export async function demoRpc(
  action: string,
  id: string | null,
  payload: unknown = {},
  patient = false,
) {
  const config = runtimeConfig();
  if (!config.ok) throw new Error("configuration_unavailable");
  const jar = await cookies();
  let token: string | null = null;
  let encounterId = id;
  if (patient) {
    const value = jar.get("gi-encounter")?.value;
    if (!value) throw new Error("session_unavailable");
    try {
      const cap = JSON.parse(value);
      if (!/^[a-f0-9]{64}$/.test(cap.token) || typeof cap.id !== "string")
        throw new Error();
      token = cap.token;
      // Keep the page's encounter ID when supplied. An old tab must not apply
      // its answers to a newly handed-off encounter sharing the same cookie.
      encounterId = id ?? cap.id;
    } catch {
      throw new Error("session_unavailable");
    }
  }
  const client = patient
    ? createClient(config.config.url, config.config.publicKey, {
        db: { schema: "api" },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await supabaseServer();
  if (!client) throw new Error("session_unavailable");
  // This capability is never passed in a URL or exposed to browser JavaScript.
  const { data, error } = await client.schema("api").rpc("demo_action", {
    p_action: action,
    p_id: encounterId ?? undefined,
    p_token: token ?? undefined,
    p_payload: payload as Json,
  });
  if (
    error ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !("ok" in data)
  )
    throw new Error("request_unavailable");
  if (!data.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : "request_unavailable",
    );
  return projectAssessmentState(data.data);
}
