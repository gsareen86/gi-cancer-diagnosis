import { describe, it, expect } from "vitest";
import {
  newWorkerHealth,
  recordWorkerAccess,
  safeRpcCode,
  workerIsHealthy,
} from "../../scripts/worker-health";

describe("Worker backend health", () => {
  const now = new Date("2026-09-26T02:00:00Z");
  const status = () => ({
    environment: "demo",
    state: "polling",
    updatedAt: now.toISOString(),
    backend: newWorkerHealth(),
  });
  it("requires successful access to both RPC channels", () => {
    const s = status();
    expect(workerIsHealthy(s, +now)).toBe(false);
    recordWorkerAccess(s.backend, "reports", null, now);
    expect(workerIsHealthy(s, +now)).toBe(false);
    recordWorkerAccess(s.backend, "assessments", null, now);
    expect(workerIsHealthy(s, +now)).toBe(true);
  });
  it("fails despite a fresh heartbeat when an RPC cannot reach the backend, and recovers", () => {
    const s = status();
    for (const channel of ["reports", "assessments"] as const)
      recordWorkerAccess(s.backend, channel, null, now);
    recordWorkerAccess(
      s.backend,
      "reports",
      { code: "PGRST002", message: "never log this" },
      now,
    );
    expect(workerIsHealthy(s, +now)).toBe(false);
    expect(JSON.stringify(s)).not.toContain("never log");
    recordWorkerAccess(s.backend, "reports", null, now);
    expect(workerIsHealthy(s, +now)).toBe(true);
    expect(workerIsHealthy(s, +now + 91000)).toBe(false);
  });
  it("allows a long job with current successful report heartbeats", () => {
    const s = status();
    recordWorkerAccess(s.backend, "assessments", null, new Date(+now - 300000));
    recordWorkerAccess(s.backend, "reports", null, now);
    expect(workerIsHealthy(s, +now)).toBe(true);
  });
  it("never stores arbitrary error text as a code", () => {
    expect(safeRpcCode({ code: "arbitrary patient information" })).toBe(
      "rpc_unavailable",
    );
    expect(safeRpcCode(new Error("private data"))).toBe("rpc_unavailable");
    expect(safeRpcCode({ code: "42501" })).toBe("42501");
  });
});
