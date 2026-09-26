import "server-only";
import { randomUUID } from "node:crypto";

// No URLs, cookies, input values, patient IDs or upstream exception objects.
export function securityEvent(
  code: "session_rejected" | "origin_rejected" | "deployment_unavailable",
) {
  const requestId = randomUUID();
  console.warn(
    JSON.stringify({
      kind: "security_boundary",
      code,
      requestId,
      at: new Date().toISOString(),
    }),
  );
  return requestId;
}
