import { describe, expect, it } from "vitest";
import { readRuntimeConfig } from "../../src/lib/config";
const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_fixture",
  SUPABASE_EXPECTED_PROJECT_REF: "abcdefghijklmnopqrst",
  SUPABASE_VERIFIED_REGION: "ap-south-1",
  SUPABASE_REGION_VERIFIED_AT: "2026-09-13",
  APP_ENVIRONMENT: "demo",
  APP_ORIGIN: "http://localhost:3000",
};
describe("Cloud deployment boundary", () => {
  it("accepts an explicitly designated synthetic India project", () => {
    expect(readRuntimeConfig(valid).ok).toBe(true);
  });
  it.each([
    { NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://wrongproject.supabase.co" },
    { SUPABASE_VERIFIED_REGION: "us-east-1" },
    { SUPABASE_REGION_VERIFIED_AT: "" },
    { APP_ENVIRONMENT: "pilot" },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_do_not_expose" },
  ])(
    "refuses an unapproved target or privileged runtime key: %j",
    (override) => {
      const result = readRuntimeConfig({ ...valid, ...override });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain("sb_secret_do_not_expose");
    },
  );
  it("fails closed without credentials and names only missing settings", () => {
    const result = readRuntimeConfig({});
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.settings).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });
});
