export type RuntimeConfig = {
  url: string;
  publicKey: string;
  projectRef: string;
  region: string;
  verifiedAt: string;
  environment: "demo" | "test";
  origin: string;
};
type Environment = Record<string, string | undefined>;
export type ConfigResult =
  { ok: true; config: RuntimeConfig } | { ok: false; settings: string[] };
export function readRuntimeConfig(env: Environment): ConfigResult {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_EXPECTED_PROJECT_REF",
    "SUPABASE_VERIFIED_REGION",
    "SUPABASE_REGION_VERIFIED_AT",
    "APP_ENVIRONMENT",
    "APP_ORIGIN",
  ];
  const settings = required.filter((key) => !env[key]?.trim());
  const projectRef = env.SUPABASE_EXPECTED_PROJECT_REF ?? "";
  if (!/^[a-z0-9]{20}$/.test(projectRef))
    settings.push("SUPABASE_EXPECTED_PROJECT_REF");
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (url !== `https://${projectRef}.supabase.co`)
    settings.push("NEXT_PUBLIC_SUPABASE_URL");
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!publicKey.startsWith("sb_publishable_"))
    settings.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (env.SUPABASE_VERIFIED_REGION !== "ap-south-1")
    settings.push("SUPABASE_VERIFIED_REGION");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(env.SUPABASE_REGION_VERIFIED_AT ?? "") ||
    !Number.isFinite(Date.parse(env.SUPABASE_REGION_VERIFIED_AT ?? ""))
  )
    settings.push("SUPABASE_REGION_VERIFIED_AT");
  if (!["demo", "test"].includes(env.APP_ENVIRONMENT ?? ""))
    settings.push("APP_ENVIRONMENT");
  try {
    const origin = new URL(env.APP_ORIGIN ?? "");
    if (
      origin.origin !== env.APP_ORIGIN ||
      !(
        origin.protocol === "https:" ||
        (origin.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(origin.hostname))
      )
    )
      settings.push("APP_ORIGIN");
  } catch {
    settings.push("APP_ORIGIN");
  }
  if (settings.length) return { ok: false, settings: [...new Set(settings)] };
  return {
    ok: true,
    config: {
      url,
      publicKey,
      projectRef,
      region: env.SUPABASE_VERIFIED_REGION!,
      verifiedAt: env.SUPABASE_REGION_VERIFIED_AT!,
      environment: env.APP_ENVIRONMENT as "demo" | "test",
      origin: env.APP_ORIGIN!,
    },
  };
}
export function runtimeConfig() {
  return readRuntimeConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_EXPECTED_PROJECT_REF: process.env.SUPABASE_EXPECTED_PROJECT_REF,
    SUPABASE_VERIFIED_REGION: process.env.SUPABASE_VERIFIED_REGION,
    SUPABASE_REGION_VERIFIED_AT: process.env.SUPABASE_REGION_VERIFIED_AT,
    APP_ENVIRONMENT: process.env.APP_ENVIRONMENT,
    APP_ORIGIN: process.env.APP_ORIGIN,
  });
}
