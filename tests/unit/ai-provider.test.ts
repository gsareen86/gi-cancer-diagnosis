import { afterEach, describe, expect, it, vi } from "vitest";
import { readAISettings } from "../../src/lib/ai/settings";
import { completeJSON } from "../../src/lib/ai/provider";
import { assessWithProvider } from "../../src/lib/ai/assessment";
import { scenarios } from "../../src/lib/demo/fixtures";
import { content, validateAssessment } from "../../src/lib/demo/clinical";
afterEach(() => vi.unstubAllGlobals());
const settings = readAISettings({
  AI_PROVIDER: "gemini",
  GEMINI_API_KEY: "test-key",
});
describe("AI provider contracts", () => {
  it("rejects unknown connectors and unverified real-data routing", () => {
    expect(() => readAISettings({ AI_PROVIDER: "missing" })).toThrow(
      "provider_not_configured",
    );
    expect(() =>
      readAISettings({ AI_PROVIDER: "gemini", AI_DATA_MODE: "real" }),
    ).toThrow("provider_residency_unverified");
    expect(() =>
      readAISettings({
        AI_PROVIDER: "compatible",
        COMPATIBLE_ENDPOINT: "http://outside.invalid",
        COMPATIBLE_MODEL: "model",
      }),
    ).toThrow("provider_endpoint_invalid");
  });
  it("uses Gemini authentication headers, counts context and parses structured output", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        calls.push([url, init]);
        return Response.json(
          String(url).endsWith(":countTokens")
            ? { totalTokens: 10 }
            : {
                candidates: [
                  {
                    finishReason: "STOP",
                    content: { parts: [{ text: '{"ok":true}' }] },
                  },
                ],
              },
        );
      }),
    );
    expect(
      await completeJSON(
        settings,
        [{ role: "user", content: "hello" }],
        {
          type: "object",
          properties: {
            fields: {
              type: "array",
              maxItems: 60,
              items: { type: "string", maxLength: 120, enum: ["allowed"] },
            },
          },
          required: ["fields"],
          additionalProperties: false,
        },
        "test",
      ),
    ).toEqual({ ok: true });
    expect(calls[1][1]?.headers).toMatchObject({
      "x-goog-api-key": "test-key",
    });
    expect(calls[1][0]).not.toContain("test-key");
    const decoder = JSON.parse(String(calls[1][1]?.body)).generationConfig
      .responseJsonSchema;
    expect(decoder.properties.fields).toEqual({
      type: "array",
      items: { type: "string", enum: ["allowed"] },
    });
    expect(decoder.required).toEqual(["fields"]);
    expect(decoder.additionalProperties).toBe(false);
  });
  it("rejects oversized input without silently dropping facts or invoking generation", async () => {
    const fetch = vi.fn(async () => Response.json({ totalTokens: 1048576 }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      completeJSON(settings, [{ role: "user", content: "facts" }], {}, "test"),
    ).rejects.toThrow("context_limit");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves refusals and never falls back to another endpoint", async () => {
    const fetch = vi.fn(async (url) =>
      Response.json(
        String(url).endsWith(":countTokens")
          ? { totalTokens: 10 }
          : { candidates: [{ finishReason: "SAFETY" }] },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      completeJSON(settings, [{ role: "user", content: "facts" }], {}, "test"),
    ).rejects.toThrow("provider_refused");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("redacts provider error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("secret patient payload", { status: 401 }),
      ),
    );
    await expect(completeJSON(settings, [], {}, "test")).rejects.toThrow(
      "provider_auth_failed",
    );
  });
  it("repairs truncation and excessive evidence citations with specific safe feedback", async () => {
    const requests: string[] = [];
    let generations = 0;
    const assessment = {
      summary: "The reported symptoms need clinical review.",
      specialty: "Gastroenterology",
      specialtyReason:
        "The reported digestive symptoms need specialist assessment.",
      urgency: "review",
      possibilities: [
        {
          name: "Bowel inflammation",
          reason: "Reported bowel symptoms need investigation.",
          evidenceIds: ["F1"],
          uncertainty: "Clinical examination is missing.",
        },
      ],
      missingInformation: ["Clinical examination"],
      nextSteps: [
        {
          name: "Discuss the symptoms",
          why: "A clinician can evaluate the available information.",
        },
        {
          name: "Review existing reports",
          why: "The clinician can decide which investigations are needed.",
        },
      ],
      regionalConsideration: {
        condition: "Abdominal tuberculosis",
        comment: "Supporting evidence is unknown.",
        evidenceIds: [],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        if (String(url).endsWith(":countTokens"))
          return Response.json({ totalTokens: 100 });
        const body = String(init.body);
        requests.push(body);
        const check = body.includes('"supported"');
        if (!check && generations++ === 0)
          return Response.json({
            candidates: [{ finishReason: "MAX_TOKENS" }],
          });
        return Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify(
                      check
                        ? { supported: true, reason: "supported" }
                        : generations === 2
                          ? {
                              ...assessment,
                              possibilities: [
                                {
                                  ...assessment.possibilities[0],
                                  evidenceIds: Array(9).fill("F1"),
                                },
                              ],
                            }
                          : assessment,
                    ),
                  },
                ],
              },
            },
          ],
        });
      }),
    );
    const result = await assessWithProvider(settings, {
      intake: scenarios[0].intake,
      reports: [],
      version: 1,
      contentVersion: content.version,
    });
    expect(requests[1]).toContain("output_truncated");
    expect(requests[2]).toContain(
      "possibilities.0.evidenceIds: too_big; maximum 8",
    );
    expect(result.possibilities[0].evidenceIds).toEqual(["age"]);
    expect(result.urgency).toBe("prompt");
    expect(result.promptVersion).toBeTruthy();
  });
  it("allows a faithfully reported dose without allowing a prescription", () => {
    const sample = {
      summary:
        "Patient reports taking Pan 40 mg; medication history requires review.",
      urgency: "review",
      specialty: "Gastroenterology",
      possibilities: [
        {
          name: "Gastritis",
          reason: "Discomfort is reported.",
          evidenceIds: ["meds"],
          uncertainty: "An examination is needed.",
        },
      ],
      missingInformation: ["Examination"],
      nextSteps: ["Arrange medical assessment."],
      regionalConsideration: {
        condition: "Abdominal tuberculosis",
        comment: "Evidence unknown.",
        evidenceIds: [],
      },
    };
    const facts = [
      {
        id: "meds",
        label: "Medicines",
        value: "Pan 40 mg",
        source: "Patient-reported",
      },
    ];
    expect(validateAssessment(sample, facts, "review")).toBeTruthy();
    expect(() =>
      validateAssessment(
        {
          ...sample,
          summary: "Tuberculosis is less common than IBD in this case.",
        },
        facts,
        "review",
      ),
    ).toThrow("output_boundary");
    const laboratory = {
      id: "meds",
      label: "HbA1c",
      value: "7.2%",
      source: "Verified report · Page 1",
    };
    expect(
      validateAssessment(
        {
          ...sample,
          summary:
            "The report records HbA1c 7.2%; review the result with a clinician.",
        },
        [laboratory],
        "review",
      ),
    ).toBeTruthy();
    expect(() =>
      validateAssessment(
        { ...sample, summary: "There is an 80% chance of cancer." },
        [laboratory],
        "review",
      ),
    ).toThrow("output_boundary");
    expect(() =>
      validateAssessment(
        { ...sample, summary: "Take omeprazole 20 mg daily." },
        facts,
        "review",
      ),
    ).toThrow("output_boundary");
  });
});
