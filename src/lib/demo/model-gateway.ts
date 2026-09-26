import type { Evidence } from "./clinical";
import { readFileSync } from "node:fs";
import { checkModelIdentity } from "./model-identity";
import { readAISettings, type AISettings } from "../ai/settings";
import { providerRequest } from "../ai/provider";
import { assessWithProvider } from "../ai/assessment";
async function verifyLocalFiles(servedPath: string) {
  try {
    const settings = Object.fromEntries(
      readFileSync(".env.model", "utf8")
        .split(/\r?\n/)
        .filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l))
        .map((l) => {
          const i = l.indexOf("=");
          return [
            l.slice(0, i),
            l
              .slice(i + 1)
              .trim()
              .replace(/^"|"$/g, ""),
          ];
        }),
    );
    const identity = JSON.parse(
      readFileSync("var/model/identity.json", "utf8"),
    );
    checkModelIdentity(settings, identity, servedPath);
  } catch {
    throw new Error("model_identity_mismatch");
  }
}
async function local(
  settings: AISettings,
  path: string,
  body?: unknown,
  timeout = 15_000,
) {
  const started = Date.now();
  const response = await fetch(settings.endpoint + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  }).catch(() => {
    console.log(
      `Local model request unavailable: ${path}, elapsed ${Date.now() - started} ms`,
    );
    throw new Error("model_unavailable");
  });
  if (!response.ok) {
    console.log(
      `Local model request rejected: ${path}, HTTP ${response.status}`,
    );
    throw new Error("model_unavailable");
  }
  return response.json();
}
export async function modelHealth(settings: AISettings = readAISettings()) {
  if (settings.provider !== "local") {
    if (settings.provider === "gemini")
      await providerRequest(settings, `/models/${settings.model}`);
    else {
      const models = await providerRequest(settings, "/v1/models");
      if (!models.data?.some((m: { id: string }) => m.id === settings.model))
        throw new Error("model_identity_mismatch");
    }
    return { model: settings.model, context: settings.context };
  }
  const [health, models, props] = await Promise.all([
    local(settings, "/health"),
    local(settings, "/v1/models"),
    local(settings, "/props"),
  ]);
  if (
    health.status !== "ok" ||
    !models.data?.some((m: { id: string }) => m.id === settings.model) ||
    props.total_slots !== 1 ||
    props.default_generation_settings?.n_ctx !== settings.context
  )
    throw new Error("model_unavailable");
  await verifyLocalFiles(props.model_path);
  if (settings.vision && props.modalities?.vision !== true)
    throw new Error("vision_unavailable");
  return { model: settings.model, context: settings.context };
}
export async function generateAssessment(
  job: {
    intake: unknown;
    reports: Array<{ id: string; fields: Evidence[] }>;
    version: number;
    contentVersion: string;
    synthetic?: boolean;
  },
  inspectSyntheticOutput?: (raw: unknown) => void,
) {
  const settings = readAISettings(
    job.synthetic === false
      ? { ...process.env, AI_DATA_MODE: "real" }
      : process.env,
  );
  await modelHealth(settings);
  return assessWithProvider(
    settings,
    job,
    job.synthetic === true ? inspectSyntheticOutput : undefined,
  );
}
