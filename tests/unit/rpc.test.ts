import { describe, expect, it } from "vitest";
import { decodeRpc } from "../../src/lib/rpc";
describe("Generated API response boundary", () => {
  it("accepts a new public visit without invented demographics", () => {
    expect(decodeRpc("list_patients", {ok:true,data:[{id:"11111111-1111-4111-8111-111111111111",synthetic_identifier:"VISIT-TEST",display_name:"New visit",year_of_birth:null}]}).data?.ok).toBe(true);
  });
  it("accepts a data-free denial", () => {
    expect(
      decodeRpc("list_patients", {
        ok: false,
        data: null,
        error: { code: "unavailable" },
      }).data?.ok,
    ).toBe(false);
  });
  it("refuses patient data hidden in a denial", () => {
    const value = {
      ok: false,
      data: [{ display_name: "Do not release" }],
      error: { code: "unavailable" },
    };
    const result = decodeRpc("list_patients", value);
    expect(result.data).toBeNull();
    expect(JSON.stringify(result)).not.toContain("Do not release");
  });
  it("refuses invalid deadlines instead of creating an unbounded session", () => {
    expect(
      decodeRpc("session_status", {
        ok: true,
        data: { idleExpiresAt: "invalid", absoluteExpiresAt: "never" },
      }).error,
    ).toBe("invalid_response");
  });
  it("validates patient fields and removes unrequested fields", () => {
    const result = decodeRpc("get_patient", {
      ok: true,
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          synthetic_identifier: "SYN-TEST",
          display_name: "Synthetic test",
          year_of_birth: 1980,
          unexpected: "internal data",
        },
      ],
    });
    expect(result.data?.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("internal data");
  });
});
