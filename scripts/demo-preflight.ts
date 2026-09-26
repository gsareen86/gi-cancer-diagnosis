import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { runtimeConfig } from "../src/lib/config";
import { modelHealth } from "../src/lib/demo/model-gateway";
import { workerIsHealthy } from "./worker-health";
for (const f of [".env"]) if (existsSync(f)) process.loadEnvFile(f);
let failed = false;
const checks = [
  [
    "Runtime configuration",
    async () => {
      const c = runtimeConfig();
      if (!c.ok) throw new Error();
    },
  ],
  [
    "Cloud demo identity",
    async () => {
      const c = runtimeConfig();
      if (!c.ok) throw new Error();
      const r = await createClient(c.config.url, c.config.publicKey, {
        db: { schema: "api" },
      }).rpc("environment");
      if (
        r.error ||
        r.data?.environment !== "demo" ||
        r.data?.project_ref !== c.config.projectRef
      )
        throw new Error();
    },
  ],
  [
    "Selected AI provider, identity and context",
    async () => {
      await modelHealth();
    },
  ],
  [
    "Synthetic report fixture",
    async () => {
      if (!existsSync("public/demo-assets/synthetic-whole-body-report.pdf"))
        throw new Error();
    },
  ],
  [
    "Local app",
    async () => {
      const c = runtimeConfig();
      if (!c.ok) throw new Error();
      const r = await fetch(c.config.origin + "/sign-in", {
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error();
    },
  ],
  [
    "Independent report and assessment worker",
    async () => {
      const status = JSON.parse(
        readFileSync("var/demo-runtime/worker-demo.json", "utf8"),
      );
      if (!workerIsHealthy(status)) throw new Error();
      process.kill(status.pid, 0);
    },
  ],
] as const;
for (const [name, run] of checks) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch {
    console.log(`FAIL ${name}`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
