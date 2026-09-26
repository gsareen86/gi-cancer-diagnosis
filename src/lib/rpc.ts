import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const refusal = z.object({
  ok: z.literal(false),
  data: z.null(),
  error: z.object({ code: z.string() }),
  requestId: z.uuid().optional(),
});
const response = <T extends z.ZodType>(data: T) =>
  z.union([
    z.object({ ok: z.literal(true), data, requestId: z.uuid().optional() }),
    refusal,
  ]);
const deadlines = response(
  z.object({
    idleExpiresAt: z.iso.datetime({ offset: true }),
    absoluteExpiresAt: z.iso.datetime({ offset: true }),
  }),
);
const patients = response(
  z.array(
    z.object({
      id: z.uuid(),
      synthetic_identifier: z.string().regex(/^(SYN-|VISIT-)[A-Za-z0-9-]+$/),
      display_name: z.string(),
      year_of_birth: z.number().int().nullable(),
    }),
  ),
);
const role = z.enum(["clinician", "coordinator", "site_admin"]);
const outputs = {
  environment: z.object({
    project_ref: z.string(),
    environment: z.enum(["demo", "test"]),
    schema_version: z.literal(1),
  }),
  begin_staff_session: deadlines,
  touch_staff_session: deadlines,
  session_status: deadlines,
  end_staff_session: z.union([z.object({ ok: z.literal(true) }), refusal]),
  my_memberships: response(
    z.array(z.object({ site_id: z.uuid(), site_name: z.string(), role })),
  ),
  list_patients: patients,
  get_patient: patients,
  list_site_memberships: response(
    z.array(z.object({ user_id: z.uuid(), role, active: z.boolean() })),
  ),
  list_audit_events: response(
    z.array(
      z.object({
        id: z.uuid(),
        occurred_at: z.iso.datetime({ offset: true }),
        action: z.string(),
        outcome: z.enum(["allowed", "denied_or_not_found"]),
        actor_role: role.nullable(),
        actor_user_id: z.uuid().nullable(),
        request_id: z.uuid(),
        purpose: z.string(),
        record_ids: z.array(z.uuid()),
      }),
    ),
  ),
} satisfies Partial<Record<keyof Database["api"]["Functions"], z.ZodType>>;
type Operation = keyof typeof outputs;
type Parsed<K extends Operation> = z.infer<(typeof outputs)[K]>;

export function decodeRpc<K extends Operation>(
  name: K,
  value: unknown,
): { data: Parsed<K> | null; error: string | null } {
  const result = outputs[name].safeParse(value);
  // The selected validator determines the generic output; malformed responses
  // fail closed without returning validation input or upstream error payloads.
  return result.success
    ? { data: result.data as Parsed<K>, error: null }
    : { data: null, error: "invalid_response" };
}
export async function rpc<K extends Operation>(
  client: SupabaseClient<Database, "api">,
  name: K,
  ...parameters: Database["api"]["Functions"][K]["Args"] extends never
    ? [args?: undefined, signal?: AbortSignal]
    : [args: Database["api"]["Functions"][K]["Args"], signal?: AbortSignal]
): Promise<{ data: Parsed<K> | null; error: string | null }> {
  try {
    const request = client.schema("api").rpc(name, parameters[0] as never);
    if (parameters[1]) request.abortSignal(parameters[1]);
    const result = await request;
    return result.error
      ? { data: null, error: "request_unavailable" }
      : decodeRpc(name, result.data);
  } catch {
    return { data: null, error: "request_unavailable" };
  }
}
