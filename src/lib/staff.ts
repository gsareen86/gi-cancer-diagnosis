import { rpc } from "@/lib/rpc";
import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import { runtimeConfig } from "./config";
import { securityEvent } from "./security-event";
export async function verifiedDeployment() {
  const settings = runtimeConfig();
  const client = await supabaseServer();
  if (!settings.ok || !client) return null;
  try {
    const { data, error } = await rpc(client, "environment");
    if (
      error ||
      data?.project_ref !== settings.config.projectRef ||
      data?.environment !== settings.config.environment ||
      data?.schema_version !== 1
    )
      return null;
    return client;
  } catch {
    securityEvent("deployment_unavailable");
    return null;
  }
}
export async function requireStaff() {
  const client = await verifiedDeployment();
  if (!client) redirect("/setup");
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims) {
    securityEvent("session_rejected");
    redirect("/sign-in");
  }
  if (data.claims.aal !== "aal2") redirect("/mfa");
  const result = await rpc(client, "session_status");
  if (result.error || result.data?.ok !== true) redirect("/sign-in?expired=1");
  return client;
}
