import { NextResponse } from "next/server";
import { z } from "zod";
import { demoRpc } from "@/lib/demo/server";
import { validateReport } from "@/lib/demo/reports";
import { runtimeConfig } from "@/lib/config";
import { readBoundedBody } from "@/lib/demo/request-body";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const config = runtimeConfig();
  const headers = { "Cache-Control": "private, no-store" };
  if (!config.ok || request.headers.get("origin") !== config.config.origin)
    return NextResponse.json(
      { error: "Request unavailable" },
      { status: 403, headers },
    );
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = z
        .object({
          id: z.uuid().nullable(),
          reportId: z.uuid(),
          patient: z.boolean(),
        })
        .strict()
        .parse(
          JSON.parse(
            new TextDecoder().decode(await readBoundedBody(request, 4096)),
          ),
        );
      const result = await demoRpc(
        "report_get",
        body.id,
        { reportId: body.reportId },
        body.patient,
      );
      const doc = z
        .object({
          body: z.string(),
          mime: z.enum(["application/pdf", "image/png", "image/jpeg"]),
          name: z.string(),
        })
        .parse(result);
      return new NextResponse(Buffer.from(doc.body, "base64"), {
        headers: {
          ...headers,
          "Content-Type": doc.mime,
          "Content-Disposition": 'inline; filename="report"',
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox; default-src 'none'",
        },
      });
    }
    const bounded = await readBoundedBody(request, 5_100_000);
    const form = await new Response(bounded as BodyInit, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const encounterId = z.uuid().parse(form.get("encounterId"));
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 5_000_000 || file.size < 32)
      throw new Error("file_size");
    // Audit/authorize before parsing or processing document bytes.
    await demoRpc("get", encounterId, {}, true);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime =
      Buffer.from(bytes.slice(0, 5)).toString() === "%PDF-"
        ? "application/pdf"
        : bytes[0] === 0xff && bytes[1] === 0xd8
          ? "image/jpeg"
          : bytes[0] === 0x89 &&
              bytes[1] === 0x50 &&
              bytes[2] === 0x4e &&
              bytes[3] === 0x47
            ? "image/png"
            : null;
    if (!mime) throw new Error("unsupported_file");
    await validateReport(bytes, mime);
    const data = await demoRpc(
      "report_add",
      encounterId,
      {
        name: file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120),
        mime,
        body: Buffer.from(bytes).toString("base64"),
        fields: [],
        quality: "Processing report. You can continue your questionnaire.",
      },
      true,
    );
    return NextResponse.json({ ok: true, data }, { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "Report could not be added or opened. Use a clean PDF, PNG or JPEG up to 5 MB / 30 pages. You can continue without a report.",
      },
      { status: 400, headers },
    );
  }
}
