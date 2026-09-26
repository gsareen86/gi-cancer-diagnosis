import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
export type AISettings = {
  provider: "local" | "gemini" | "compatible";
  model: string;
  endpoint: string;
  apiKey: string;
  context: number;
  outputTokens: number;
  vision: boolean;
  region: string;
  dataMode: "synthetic" | "real";
};
export function readAISettings(
  env: Record<string, string | undefined> = process.env,
): AISettings {
  const file = existsSync(".env.ai")
    ? parseEnv(readFileSync(".env.ai", "utf8"))
    : {};
  const values = { ...file, ...env };
  const modelConfig = existsSync(".env.model")
    ? parseEnv(readFileSync(".env.model", "utf8"))
    : {};
  let provider = values.AI_PROVIDER || "local";
  if (!env.AI_PROVIDER && existsSync("var/ai/selection.json"))
    provider = JSON.parse(
      readFileSync("var/ai/selection.json", "utf8"),
    ).provider;
  if (!["local", "gemini", "compatible"].includes(provider))
    throw new Error("provider_not_configured");
  const prefix =
    provider === "gemini"
      ? "GEMINI"
      : provider === "compatible"
        ? "COMPATIBLE"
        : "LOCAL_AI";
  const endpoint = (
    values[`${prefix}_ENDPOINT`] ||
    (provider === "local"
      ? "http://127.0.0.1:8081"
      : provider === "gemini"
        ? "https://generativelanguage.googleapis.com/v1beta"
        : "")
  ).replace(/\/$/, "");
  const url = new URL(endpoint);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (provider === "local"
      ? !["127.0.0.1", "localhost"].includes(url.hostname)
      : url.protocol !== "https:")
  )
    throw new Error("provider_endpoint_invalid");
  const dataMode = values.AI_DATA_MODE === "real" ? "real" : "synthetic";
  const region =
    provider === "local"
      ? "local-india"
      : values[`${prefix}_VERIFIED_REGION`] || "unverified";
  // Actual processing residency is an operator-verified deployment property, not a UI toggle.
  if (
    dataMode === "real" &&
    provider !== "local" &&
    (!/^india:/.test(region) || !values[`${prefix}_REGION_VERIFICATION`])
  )
    throw new Error("provider_residency_unverified");
  const context = Number(
    values[`${prefix}_CONTEXT`] ||
      (provider === "gemini"
        ? 1048576
        : provider === "local"
          ? modelConfig.LLAMA_CONTEXT || 16384
          : 16384),
  );
  const outputTokens = Number(values.AI_OUTPUT_TOKENS || 4096);
  if (
    !Number.isInteger(context) ||
    context < 4096 ||
    !Number.isInteger(outputTokens) ||
    outputTokens < 1024 ||
    outputTokens >= context
  )
    throw new Error("provider_budget_invalid");
  const model =
    values[`${prefix}_MODEL`] ||
    (provider === "local"
      ? "gi-compass-local"
      : provider === "gemini"
        ? "gemini-3.8-flash"
        : "");
  if (!model || !/^[a-zA-Z0-9._:/-]+$/.test(model))
    throw new Error("provider_not_configured");
  const vision =
    values[`${prefix}_VISION`] !== undefined
      ? values[`${prefix}_VISION`] === "true"
      : provider === "gemini" ||
        (provider === "local" && !!modelConfig.LLAMA_MMPROJ);
  return {
    provider: provider as AISettings["provider"],
    endpoint,
    model,
    apiKey: values[`${prefix}_API_KEY`] || "",
    context,
    outputTokens,
    vision,
    region,
    dataMode,
  };
}
