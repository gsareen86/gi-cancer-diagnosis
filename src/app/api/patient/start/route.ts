import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { z } from "zod";
import { runtimeConfig } from "@/lib/config";
import { readBoundedBody } from "@/lib/demo/request-body";
import { demoRpc } from "@/lib/demo/server";
export async function POST(request: Request) {
  const config = runtimeConfig();
  const headers = { "Cache-Control": "private, no-store" };
  if (!config.ok || request.headers.get("origin") !== config.config.origin)
    return NextResponse.json(
      { error: "Request unavailable" },
      { status: 403, headers },
    );
  try {
    const { slug } = z
      .object({ slug: z.string().regex(/^[a-z0-9-]{3,60}$/) })
      .strict()
      .parse(
        JSON.parse(
          new TextDecoder().decode(await readBoundedBody(request, 1024)),
        ),
      );
    const jar = await cookies();
    // Resume the current capability instead of silently replacing another open visit.
    if (jar.get("gi-encounter")) {
      try {
        await demoRpc("get", null, {}, true);
        return NextResponse.json({ next: "/patient" }, { headers });
      } catch {
        jar.delete("gi-encounter");
      }
    }
    const operator = existsSync(".env.operator")
      ? parseEnv(readFileSync(".env.operator", "utf8"))
      : {};
    const key =
      process.env.SUPABASE_AUTH_ADMIN_KEY || operator.SUPABASE_AUTH_ADMIN_KEY;
    if (!key) throw new Error("configuration");
    const client = createClient(config.config.url, key, {
      db: { schema: "api" },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc("patient_start", { p_slug: slug });
    if (error || !data?.ok)
      return NextResponse.json(
        {
          error:
            data?.error === "try_later"
              ? "The clinic is receiving many requests. Please ask the reception team to help."
              : "This clinic link is not available. Please check the link with reception.",
        },
        { status: 429, headers },
      );
    const cap = z
      .object({ id: z.uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(data.data);
    jar.set("gi-encounter", JSON.stringify(cap), {
      httpOnly: true,
      sameSite: "strict",
      secure: config.config.origin.startsWith("https:"),
      path: "/",
      maxAge: 7200,
    });
    return NextResponse.json({ next: "/patient" }, { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "We could not start your visit. Please ask clinic reception for assistance.",
      },
      { status: 503, headers },
    );
  }
}
