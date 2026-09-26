import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { cloudSettings } from "./cloud.mjs";
import { generateAssessment, modelHealth } from "../src/lib/demo/model-gateway";
import { extractReport } from "../src/lib/demo/reports";
import { readAISettings } from "../src/lib/ai/settings";
import {
  newWorkerHealth,
  recordWorkerAccess,
  type WorkerChannel,
} from "./worker-health";
for (const file of [".env", ".env.operator", ".env.test"])
  if (existsSync(file)) process.loadEnvFile(file);
const kind = process.argv.includes("--test") ? "test" : "demo";
const targetedReport = process.argv.includes("--report-id")
  ? process.argv[process.argv.indexOf("--report-id") + 1]
  : undefined;
if (targetedReport && !/^[0-9a-f-]{36}$/i.test(targetedReport))
  throw new Error("REPORT_ID_INVALID");
mkdirSync("var/demo-runtime", { recursive: true });
const backend = newWorkerHealth();
let currentState = "starting";
function signalStatus(state: string) {
  currentState = state;
  writeFileSync(
    `var/demo-runtime/worker-${kind}.json`,
    JSON.stringify({
      pid: process.pid,
      state,
      environment: kind,
      updatedAt: new Date().toISOString(),
      backend,
    }),
  );
}
const settings = cloudSettings(kind);
if (!settings.admin?.startsWith("sb_secret_"))
  throw new Error("WORKER_KEY_REQUIRED");
const client = createClient(settings.url, settings.admin, {
  db: { schema: "api" },
  auth: { persistSession: false, autoRefreshToken: false },
});
async function workerRpc(
  name: "report_worker" | "demo_worker",
  args: Record<string, unknown>,
) {
  const channel: WorkerChannel =
    name === "report_worker" ? "reports" : "assessments";
  try {
    const result = await client.rpc(name, args);
    recordWorkerAccess(backend, channel, result.error);
    signalStatus(currentState);
    if (result.error)
      console.log(
        `Worker backend unavailable: ${channel} ${backend[channel].errorCode}`,
      );
    return result;
  } catch (error) {
    recordWorkerAccess(backend, channel, error);
    signalStatus(currentState);
    console.log(
      `Worker backend unavailable: ${channel} ${backend[channel].errorCode}`,
    );
    return { data: null, error: { code: "rpc_unavailable" } };
  }
}
const metadata = await createClient(settings.url, settings.key, {
  db: { schema: "api" },
}).rpc("environment");
if (
  metadata.error ||
  metadata.data?.project_ref !== settings.ref ||
  metadata.data?.environment !== kind
)
  throw new Error("WORKER_TARGET_MISMATCH");
console.log(
  `Synthetic ${kind} worker ready; clinical payloads are never logged.`,
);
let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));
while (!stopping) {
  signalStatus("polling");
  const claimedReport = await workerRpc("report_worker", {
    p_action: "claim",
    ...(targetedReport ? { p_id: targetedReport } : {}),
  });
  if (claimedReport.error) {
    if (process.argv.includes("--once")) {
      process.exitCode = 1;
      break;
    }
    await sleep(5000);
    continue;
  }
  const report = claimedReport.data?.data;
  if (report) {
    const heartbeat = setInterval(() => {
      void workerRpc("report_worker", {
        p_action: "heartbeat",
        p_id: report.id,
        p_lease: report.lease,
      }).then(
        (response) => {
          if (response.error || !response.data?.ok)
            console.log("Report lease no longer active");
        },
        () => console.log("Report heartbeat unavailable"),
      );
      signalStatus("extracting-report");
    }, 25000);
    try {
      const provider = readAISettings(
        report.synthetic === false
          ? { ...process.env, AI_DATA_MODE: "real" }
          : process.env,
      );
      await modelHealth(provider);
      const extracted = await extractReport(
        Buffer.from(report.body, "base64"),
        report.mime,
        provider,
        async (progress) => {
          signalStatus("extracting-report");
          const response = await workerRpc("report_worker", {
            p_action: "heartbeat",
            p_id: report.id,
            p_lease: report.lease,
            p_result: progress,
          });
          if (response.error || !response.data?.ok)
            throw new Error("report_lease_lost");
        },
      );
      const published = await workerRpc("report_worker", {
        p_action: "complete",
        p_id: report.id,
        p_lease: report.lease,
        p_result: extracted,
      });
      console.log(
        published.data?.ok
          ? "Report processing completed"
          : "Report publication rejected",
      );
    } catch (e) {
      const safeCode =
        e instanceof Error && /^[a-z_]{3,50}$/.test(e.message)
          ? e.message
          : "extraction_unavailable";
      await workerRpc("report_worker", {
        p_action: "fail",
        p_id: report.id,
        p_lease: report.lease,
        p_error: safeCode,
      });
      console.log(`Report extraction unavailable: ${safeCode}`);
    } finally {
      clearInterval(heartbeat);
    }
  }
  if (targetedReport && process.argv.includes("--once")) break;
  const { data, error } = await workerRpc("demo_worker", {
    p_action: "claim",
  });
  if (error) {
    if (process.argv.includes("--once")) {
      process.exitCode = 1;
      break;
    }
    await sleep(5000);
    continue;
  }
  const job = data?.data;
  if (!job) {
    if (process.argv.includes("--once")) break;
    await sleep(3000);
    continue;
  }
  const heartbeat = setInterval(() => {
    signalStatus("analysing");
    void workerRpc("demo_worker", {
      p_action: "heartbeat",
      p_id: job.id,
      p_lease: job.lease,
    }).then((r) => {
      if (r.error || !r.data?.ok) console.log("Worker lease no longer active");
    });
  }, 25000);
  try {
    await modelHealth();
    const result = await generateAssessment(job);
    const completed = await workerRpc("demo_worker", {
      p_action: "complete",
      p_id: job.id,
      p_lease: job.lease,
      p_result: result,
    });
    console.log(
      completed.data?.ok
        ? "Assessment completed"
        : "Assessment publication rejected",
    );
  } catch (e) {
    const code =
      e instanceof Error &&
      [
        "model_unavailable",
        "model_identity_mismatch",
        "context_limit",
        "invalid_output",
        "unsupported_evidence",
        "output_boundary",
        "provider_auth_failed",
        "provider_rate_limited",
        "provider_not_configured",
        "provider_residency_unverified",
        "provider_refused",
        "output_truncated",
        "content_version_unavailable",
        "vision_unavailable",
      ].includes(e.message)
        ? e.message
        : "analysis_unavailable";
    await workerRpc("demo_worker", {
      p_action: "fail",
      p_id: job.id,
      p_lease: job.lease,
      p_error: code,
    });
    console.log(`Assessment unavailable: ${code}`);
  } finally {
    clearInterval(heartbeat);
  }
  if (process.argv.includes("--once")) break;
}
signalStatus("stopped");
