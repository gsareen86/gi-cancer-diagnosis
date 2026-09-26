export type WorkerChannel = "reports" | "assessments";
export type AccessHealth = {
  lastSuccessAt?: string;
  lastFailureAt?: string;
  errorCode?: string;
  consecutiveFailures: number;
};
export type WorkerHealth = Record<WorkerChannel, AccessHealth>;

export function newWorkerHealth(): WorkerHealth {
  return {
    reports: { consecutiveFailures: 0 },
    assessments: { consecutiveFailures: 0 },
  };
}

// Keep structured provider/SQL codes only. Messages/details may contain clinical text.
export function safeRpcCode(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error ? error.code : null;
  return typeof code === "string" && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(code)
    ? code
    : "rpc_unavailable";
}

export function recordWorkerAccess(
  health: WorkerHealth,
  channel: WorkerChannel,
  error: unknown,
  now = new Date(),
): void {
  const previous = health[channel];
  health[channel] = error
    ? {
        ...previous,
        lastFailureAt: now.toISOString(),
        errorCode: safeRpcCode(error),
        consecutiveFailures: previous.consecutiveFailures + 1,
      }
    : {
        ...previous,
        lastSuccessAt: now.toISOString(),
        errorCode: undefined,
        consecutiveFailures: 0,
      };
}

export function workerIsHealthy(
  status: {
    environment?: string;
    state?: string;
    updatedAt?: string;
    backend?: WorkerHealth;
  },
  now = Date.now(),
): boolean {
  const recent = (value?: string) =>
    !!value &&
    Number.isFinite(Date.parse(value)) &&
    now - Date.parse(value) >= -5000 &&
    now - Date.parse(value) <= 90000;
  if (
    status.environment !== "demo" ||
    status.state === "stopped" ||
    !recent(status.updatedAt) ||
    !status.backend
  )
    return false;
  const channels = [status.backend.reports, status.backend.assessments];
  // A long extraction can keep the database reachable through report heartbeats.
  // Both channels must have succeeded and neither may have an unresolved RPC failure.
  return (
    channels.every(
      (c) => c && !!c.lastSuccessAt && c.consecutiveFailures === 0,
    ) && channels.some((c) => recent(c.lastSuccessAt))
  );
}
