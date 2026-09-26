import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { demoRpc } from "@/lib/demo/server";
import {
  content,
  evaluate,
  intakeShape,
  intakeSchemaFor,
  reviewSchema,
  evidenceSchema,
  type Intake,
} from "@/lib/demo/clinical";
import { runtimeConfig } from "@/lib/config";
import { supabaseServer } from "@/lib/supabase/server";
import { rpc } from "@/lib/rpc";
import type { Encounter } from "@/lib/demo/types";
import { readBoundedBody } from "@/lib/demo/request-body";
import { reviewFieldErrors } from "@/lib/demo/review-form";
import { acceptedNoticeVersions } from "@/lib/demo/consent";
export const dynamic = "force-dynamic";
const envelope = z
  .object({
    action: z.string(),
    id: z.uuid().nullable().optional(),
    patient: z.boolean().optional(),
    payload: z.unknown().optional(),
  })
  .strict();
export async function POST(request: Request) {
  const config = runtimeConfig();
  const respond = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  if (!config.ok || request.headers.get("origin") !== config.config.origin)
    return respond({ error: "Request unavailable" }, 403);
  try {
    const text = new TextDecoder().decode(
      await readBoundedBody(request, 750000),
    );
    if (text.length > 750000)
      return respond({ error: "Request too large" }, 413);
    const input = envelope.parse(JSON.parse(text));
    const { action, patient = false } = input;
    if (patient && action !== "get" && !input.id)
      return respond({ error: "Encounter session required" }, 400);
    const allowed = patient
      ? [
          "get",
          "consent",
          "save",
          "submit",
          "reopen",
          "reset",
          "withdraw",
          "report_remove",
          "message",
        ]
      : [
          "create",
          "for_patient",
          "get",
          "queue",
          "handoff",
          "draft",
          "independent",
          "reveal",
          "release",
          "retry",
          "refresh_ai",
          "message",
          "review_partial",
          "report_verify",
          "report_retry",
          "feedback",
        ];
    if (!allowed.includes(action))
      return respond({ error: "Request unavailable" }, 403);
    let payload = input.payload ?? {};
    if (action === "refresh_ai")
      payload = z
        .object({ sourceVersion: z.number().int().nonnegative() })
        .strict()
        .parse(payload);
    if (action === "feedback")
      payload = z
        .object({
          sourceVersion: z.number().int().nonnegative(),
          overall: z.enum([
            "Accept",
            "Needs changes",
            "Disagree",
            "Unable to assess",
          ]),
          dimensions: z.record(
            z.enum([
              "Possible causes",
              "Evidence used",
              "Urgency",
              "Doctor type",
              "Suggested investigations",
              "Patient explanation",
            ]),
            z.enum([
              "Appropriate",
              "Needs changes",
              "Incorrect",
              "Unable to assess",
            ]),
          ),
          issue: z.string().max(100),
          source: z.string().max(200),
          notes: z.string().max(1500),
        })
        .strict()
        .parse(payload);
    if (action === "message")
      payload = z
        .object({ text: z.string().trim().min(1).max(1500) })
        .strict()
        .parse(payload);
    if (action === "draft")
      payload = z
        .object({
          sourceVersion: z.number().int().nonnegative(),
          review: reviewSchema.extend({
            impression: z.string().max(2000),
            plan: z.string().max(3000),
          }),
        })
        .strict()
        .parse(payload);
    if (action === "save") {
      const p = z
        .object({ version: z.number().int(), intake: intakeShape })
        .strict()
        .parse(payload);
      const encounter = (await demoRpc(
        "get",
        input.id ?? null,
        {},
        patient,
      )) as unknown as Encounter;
      payload = {
        ...p,
        intake: intakeSchemaFor(encounter.contentVersion).parse(p.intake),
      };
    }
    if (action === "consent")
      payload = z
        .object({
          accepted: z.literal(true),
          noticeVersion: z.enum(acceptedNoticeVersions),
        })
        .strict()
        .parse(payload);
    if (action === "report_verify")
      payload = z
        .object({
          reportId: z.uuid(),
          sourceVersion: z.number().int().nonnegative(),
          fields: z.array(evidenceSchema).max(100),
        })
        .strict()
        .parse(payload);
    if (action === "report_remove" || action === "report_retry")
      payload = z.object({ reportId: z.uuid() }).strict().parse(payload);
    if (action === "independent" || action === "release") {
      const inputReview = z
        .object({
          review: reviewSchema,
          sourceVersion: z.number().int().nonnegative(),
        })
        .strict()
        .parse(payload);
      const review = inputReview.review;
      const encounter = (await demoRpc(
        "get",
        input.id ?? null,
      )) as unknown as Encounter;
      if (encounter.version !== inputReview.sourceVersion)
        return respond(
          {
            error:
              "The intake changed while you were reviewing. Reload the workspace and review the current facts.",
          },
          409,
        );
      const floor = evaluate(
        (encounter.intake as Intake).answers ?? {},
        encounter.contentVersion,
      ).urgency;
      if (
        content.urgencies.indexOf(review.urgency) <
        content.urgencies.indexOf(floor)
      )
        return respond(
          {
            error:
              "Choose urgency at least as high as the matched-rule minimum.",
          },
          422,
        );
      payload = inputReview;
    }
    const data = await demoRpc(action, input.id ?? null, payload, patient);
    if (action === "handoff") {
      const cap = z
        .object({ id: z.uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(data);
      const client = await supabaseServer();
      if (!client) throw new Error("session_unavailable");
      const ended = await rpc(client, "end_staff_session");
      if (!ended.data?.ok) throw new Error("session_unavailable");
      await client.auth.signOut({ scope: "local" });
      const jar = await cookies();
      for (const cookie of jar.getAll())
        if (
          cookie.name.startsWith("sb-") ||
          ["gi-site", "gi-patient", "gi-encounter"].includes(cookie.name)
        )
          jar.delete(cookie.name);
      jar.set("gi-encounter", JSON.stringify(cap), {
        httpOnly: true,
        sameSite: "strict",
        secure: config.config.origin.startsWith("https:"),
        path: "/",
        maxAge: 7200,
      });
      return respond({ ok: true, data: { next: "/patient" } });
    }
    if (action === "reset" || action === "withdraw")
      (await cookies()).delete("gi-encounter");
    return respond({ ok: true, data });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (error instanceof z.ZodError) {
      const fields = reviewFieldErrors(error.issues);
      return respond(
        {
          error: Object.keys(fields).length
            ? Object.values(fields).join(" ")
            : "Some fields are missing or invalid. Check your entries and try again.",
          fieldErrors: fields,
          requestId: randomUUID(),
        },
        422,
      );
    }
    return respond(
      {
        error:
          code === "version_conflict"
            ? "Another save changed this encounter. Refresh before continuing."
            : code === "session_unavailable"
              ? "Session ended. Ask staff to start a new handoff."
              : "This action could not be saved. Please try again.",
        requestId: randomUUID(),
      },
      error instanceof z.ZodError ? 422 : 400,
    );
  }
}
