import type { AISettings } from "./settings";
export type Message = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};
// Bounded repetitions can exceed llama.cpp or Gemini's structured decoder limits.
// Keep types, required keys and enums; callers still enforce the complete Zod schema.
function decoderSchema(schema: object): object {
  return JSON.parse(
    JSON.stringify(schema, (key, value) =>
      ["$schema", "minLength", "maxLength", "minItems", "maxItems"].includes(
        key,
      )
        ? undefined
        : value,
    ),
  );
}
export async function providerRequest(
  settings: AISettings,
  path: string,
  body?: unknown,
  timeout = 20000,
) {
  if (settings.provider !== "local" && !settings.apiKey)
    throw new Error("provider_not_configured");
  let response: Response;
  try {
    response = await fetch(settings.endpoint + path, {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(settings.provider === "gemini"
          ? { "x-goog-api-key": settings.apiKey }
          : settings.apiKey
            ? { Authorization: `Bearer ${settings.apiKey}` }
            : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("model_unavailable");
  }
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "provider_rate_limited"
        : response.status === 401 || response.status === 403
          ? "provider_auth_failed"
          : "model_unavailable",
    );
  try {
    return await response.json();
  } catch {
    throw new Error("invalid_output");
  }
}
function geminiMessages(messages: Message[]) {
  return {
    systemInstruction: {
      parts: messages
        .filter((m) => m.role === "system")
        .map((m) => ({ text: m.content })),
    },
    contents: messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts:
          typeof m.content === "string"
            ? [{ text: m.content }]
            : m.content.map((p) => {
                if (p.type === "text") return { text: p.text };
                const match =
                  /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(
                    p.image_url.url,
                  );
                if (!match) throw new Error("image_format_invalid");
                return { inlineData: { mimeType: match[1], data: match[2] } };
              }),
      })),
  };
}
export async function assertProviderContext(
  settings: AISettings,
  messages: Message[],
  outputTokens: number,
) {
  let tokens: number;
  if (settings.provider === "gemini") {
    const result = await providerRequest(
      settings,
      `/models/${settings.model}:countTokens`,
      {
        generateContentRequest: {
          model: `models/${settings.model}`,
          ...geminiMessages(messages),
        },
      },
    );
    tokens = result.totalTokens;
  } else if (settings.provider === "local") {
    // llama.cpp accounts for image embeddings during inference. Page limits and a bounded
    // resolution are enforced by the extraction caller; reject context exhaustion explicitly.
    if (messages.some((m) => Array.isArray(m.content))) return;
    const template = await providerRequest(settings, "/apply-template", {
      messages,
      add_generation_prompt: true,
    });
    const counted = await providerRequest(settings, "/tokenize", {
      content: template.prompt,
      add_special: true,
    });
    tokens = Array.isArray(counted.tokens) ? counted.tokens.length : NaN;
  } else {
    // An OpenAI-compatible connector must expose a verified tokenizer; character estimates
    // are not accepted as evidence that patient input fits the deployed model.
    const counted = await providerRequest(settings, "/tokenize", { messages });
    tokens = counted.total_tokens ?? counted.tokens?.length;
  }
  if (
    !Number.isFinite(tokens) ||
    tokens + outputTokens + 256 > settings.context
  )
    throw new Error("context_limit");
}
export async function completeJSON(
  settings: AISettings,
  messages: Message[],
  schema: object,
  name: string,
  maxTokens = settings.outputTokens,
): Promise<unknown> {
  await assertProviderContext(settings, messages, maxTokens);
  if (settings.provider === "gemini") {
    const result = await providerRequest(
      settings,
      `/models/${settings.model}:generateContent`,
      {
        ...geminiMessages(messages),
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
          responseJsonSchema: decoderSchema(schema),
          thinkingConfig: { thinkingLevel: "low" },
        },
      },
      600000,
    );
    const candidate = result.candidates?.[0];
    if (candidate?.finishReason !== "STOP")
      throw new Error(
        candidate?.finishReason === "MAX_TOKENS"
          ? "output_truncated"
          : "provider_refused",
      );
    const text = candidate.content?.parts
      ?.filter((p: { thought?: boolean; text?: string }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("invalid_output");
    }
  }
  const result = await providerRequest(
    settings,
    "/v1/chat/completions",
    {
      model: settings.model,
      messages,
      temperature: 0.1,
      max_tokens: maxTokens,
      stream: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name,
          strict: true,
          schema:
            settings.provider === "local" ? decoderSchema(schema) : schema,
        },
      },
    },
    600000,
  );
  const choice = result.choices?.[0];
  if (choice?.message?.refusal || choice?.finish_reason === "content_filter")
    throw new Error("provider_refused");
  if (choice?.finish_reason !== "stop")
    throw new Error(
      choice?.finish_reason === "length"
        ? "output_truncated"
        : "invalid_output",
    );
  try {
    return JSON.parse(choice.message.content);
  } catch {
    throw new Error("invalid_output");
  }
}
