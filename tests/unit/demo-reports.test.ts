import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { extractReport } from "../../src/lib/demo/reports";
import { factsFor } from "../../src/lib/demo/clinical";
import { scenarios } from "../../src/lib/demo/fixtures";
import { readBoundedBody } from "../../src/lib/demo/request-body";
import { readAISettings } from "../../src/lib/ai/settings";
import { completeJSON } from "../../src/lib/ai/provider";
vi.mock("../../src/lib/ai/provider", () => ({
  completeJSON: vi.fn(async (_settings, messages) => {
    const text = messages[1].content;
    return {
      fields:
        typeof text === "string" && text.includes("10.4")
          ? [
              {
                label: "Haemoglobin",
                value: "10.4",
                unit: "g/dL",
                sourceText: "10.4",
                date: "",
                referenceRange: "",
                reportType: "blood-test",
              },
            ]
          : [],
      issues: [],
    };
  }),
}));

describe("Synthetic report evidence boundary", () => {
  it("rejects a fabricated value even when its source quote exists on the page", async () => {
    vi.mocked(completeJSON).mockResolvedValueOnce({
      fields: [
        {
          label: "Haemoglobin",
          value: "999",
          unit: "g/dL",
          sourceText: "10.4",
          date: "",
          referenceRange: "",
          reportType: "blood-test",
        },
      ],
      issues: [],
    });
    const result = await extractReport(
      readFileSync("public/demo-assets/synthetic-whole-body-report.pdf"),
      "application/pdf",
      readAISettings({ AI_PROVIDER: "local" }),
    );
    expect(result.fields.some((field) => field.value === "999")).toBe(false);
    expect(result.quality).toContain("No readable findings");
  });
  it("uses embedded text even with vision enabled and publishes page counts without source text", async () => {
    vi.mocked(completeJSON).mockClear();
    const progress = vi.fn(async () => {});
    const result = await extractReport(
      readFileSync("public/demo-assets/synthetic-whole-body-report.pdf"),
      "application/pdf",
      readAISettings({ AI_PROVIDER: "local", LOCAL_AI_VISION: "true" }),
      progress,
    );
    expect(result.fields.length).toBeGreaterThan(0);
    expect(
      result.fields.every((field) => field.confidence === "text-extracted"),
    ).toBe(true);
    expect(
      vi
        .mocked(completeJSON)
        .mock.calls.every((call) => typeof call[1][1].content === "string"),
    ).toBe(true);
    expect(progress.mock.calls).toEqual([
      [{ pagesDone: 0, totalPages: 3 }],
      [{ pagesDone: 1, totalPages: 3 }],
      [{ pagesDone: 2, totalPages: 3 }],
      [{ pagesDone: 3, totalPages: 3 }],
    ]);
  });
  it("retries malformed extraction once, then returns a safe error code", async () => {
    vi.mocked(completeJSON)
      .mockClear()
      .mockResolvedValueOnce({ bad: "untrusted" })
      .mockResolvedValueOnce({ fields: null });
    await expect(
      extractReport(
        new Uint8Array(
          readFileSync("public/demo-assets/synthetic-whole-body-report.pdf"),
        ),
        "application/pdf",
        readAISettings({ AI_PROVIDER: "local", LOCAL_AI_VISION: "true" }),
      ),
    ).rejects.toThrow("invalid_output");
    expect(completeJSON).toHaveBeenCalledTimes(2);
  });
  it("automatically includes extracted proposals without claiming staff verification", async () => {
    const result = await extractReport(
      new Uint8Array(
        readFileSync("public/demo-assets/synthetic-whole-body-report.pdf"),
      ),
      "application/pdf",
      readAISettings({ AI_PROVIDER: "local", LOCAL_AI_VISION: "false" }),
    );
    expect(result.fields.length).toBeGreaterThanOrEqual(1);
    expect(
      result.fields.every(
        (f) =>
          !f.verified && f.sourceText.length > 0 && f.page >= 1 && f.page <= 3,
      ),
    ).toBe(true);
    expect(
      factsFor(scenarios[0].intake, [
        { id: "synthetic-report", fields: result.fields },
      ]).filter((f) => f.id.startsWith("report:")),
    ).toHaveLength(result.fields.length);
    const checked = result.fields.find((f) => f.sourceText.includes("10.4"))!;
    const facts = factsFor(scenarios[0].intake, [
      { id: "synthetic-report", fields: [{ ...checked, verified: true }] },
    ]);
    expect(
      facts.some(
        (f) =>
          f.id.startsWith("report:") &&
          f.value.includes("10.4") &&
          f.source.includes("page 1"),
      ),
    ).toBe(true);
  });
  it("rejects low resolution photos before accepting report findings", async () => {
    const bytes = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(extractReport(bytes, "image/png")).rejects.toThrow(
      "image_too_small",
    );
  });
  it("rejects blank photos rather than claiming readable evidence", async () => {
    const bytes = await sharp({
      create: { width: 800, height: 800, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(extractReport(bytes, "image/png")).rejects.toThrow(
      "image_low_contrast",
    );
  });
  it("rejects malformed PDFs without returning invented rows", async () => {
    await expect(
      extractReport(
        new TextEncoder().encode("%PDF-not-a-report"),
        "application/pdf",
      ),
    ).rejects.toThrow();
  });
  it("stops an oversized chunked upload even without content-length", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      body: new ReadableStream({
        start(c) {
          c.enqueue(new Uint8Array(8));
          c.enqueue(new Uint8Array(8));
          c.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
    await expect(readBoundedBody(request, 10)).rejects.toThrow();
  });
});
