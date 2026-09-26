import { describe, it, expect } from "vitest";
import {
  cloudSettings,
  validateTap,
  isAuthAdminKey,
} from "../../scripts/cloud.mjs";
const env = {
  SUPABASE_EXPECTED_PROJECT_REF: "aaaaaaaaaaaaaaaaaaaa",
  TEST_SUPABASE_EXPECTED_PROJECT_REF: "bbbbbbbbbbbbbbbbbbbb",
  TEST_SUPABASE_URL: "https://bbbbbbbbbbbbbbbbbbbb.supabase.co",
  TEST_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  TEST_SUPABASE_VERIFIED_REGION: "ap-south-1",
  TEST_SUPABASE_REGION_VERIFIED_AT: "2026-09-13",
  TEST_SUPABASE_DATABASE_URL:
    "postgresql://postgres:synthetic@db.bbbbbbbbbbbbbbbbbbbb.supabase.co:5432/postgres",
};
describe("Hosted command boundaries", () => {
  it("rejects publishable and management tokens as Auth-admin credentials", () => {
    expect(
      isAuthAdminKey(
        "sb_publishable_synthetic_fixture",
        "bbbbbbbbbbbbbbbbbbbb",
      ),
    ).toBe(false);
    expect(
      isAuthAdminKey("sbp_synthetic_management_token", "bbbbbbbbbbbbbbbbbbbb"),
    ).toBe(false);
  });
  it("accepts only the explicitly isolated Cloud target", () => {
    expect(cloudSettings("test", env).ref).toBe("bbbbbbbbbbbbbbbbbbbb");
  });
  it("refuses the demo as a test target", () => {
    expect(() =>
      cloudSettings("test", {
        ...env,
        SUPABASE_EXPECTED_PROJECT_REF: env.TEST_SUPABASE_EXPECTED_PROJECT_REF,
      }),
    ).toThrow("TEST_TARGET_NOT_ISOLATED");
  });
  it("does not fall back to the demo URL", () => {
    expect(() =>
      cloudSettings("test", {
        ...env,
        TEST_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_URL: env.TEST_SUPABASE_URL,
      }),
    ).toThrow("CONFIGURATION_REQUIRED");
  });
  it("refuses a mismatched database host without printing its password", () => {
    expect(() =>
      cloudSettings("test", {
        ...env,
        TEST_SUPABASE_DATABASE_URL:
          "postgresql://postgres:do-not-print@localhost:5432/postgres",
      }),
    ).toThrow("DATABASE_TARGET_MISMATCH");
  });
  it("accepts valid TAP", async () => {
    await expect(validateTap("1..1\nok 1 - checked\n")).resolves.toBe(1);
  });
  it.each([
    "1..1\nnot ok 1 - deliberate failure\n",
    "1..2\nok 1 - missing assertion\n",
    "1..1\nok 1 - pending # SKIP unavailable\n",
    "1..0\n",
    "1..1\nnot ok 1 - deferred # TODO later\n",
  ])("rejects failed, skipped, incomplete or empty TAP: %s", async (tap) => {
    await expect(validateTap(tap)).rejects.toThrow("DATABASE_ASSERTION_FAILED");
  });
});
