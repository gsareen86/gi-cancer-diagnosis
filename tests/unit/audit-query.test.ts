import { describe, it, expect } from "vitest";
import { auditQuery } from "../../src/lib/audit-query";
describe("Bounded audit filters", () => {
  it("rejects reversed or excessive date ranges", () => {
    expect(auditQuery({ from: "2026-09-14", to: "2026-09-01" }).valid).toBe(
      false,
    );
    expect(auditQuery({ from: "2026-01-01", to: "2026-09-14" }).valid).toBe(
      false,
    );
  });
  it("safely defaults malformed dates and pagination", () => {
    const result = auditQuery(
      { from: "2026-99-99", to: "2026-02-31", page: "-1", members: "9999" },
      Date.parse("2026-09-14"),
    );
    expect(result.valid).toBe(true);
    expect(result.startDay).toBe("2026-09-07");
    expect(result.page).toBe(0);
    expect(result.memberPage).toBe(2000);
  });
  it("uses explicit India day boundaries", () => {
    expect(auditQuery({ from: "2026-09-01", to: "2026-09-02" }).start).toBe(
      "2026-09-01T00:00:00+05:30",
    );
  });
});
