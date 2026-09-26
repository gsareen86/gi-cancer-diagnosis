// Test-only process preload: fail precisely one synthetic user's Auth mutation.
// There is no application/production fault-injection switch.
const ref = process.env.TEST_SUPABASE_EXPECTED_PROJECT_REF;
const target = process.env.GI_OPERATOR_TEST_USER;
const mode = process.env.GI_OPERATOR_TEST_FAULT;
if (
  !/^[a-z0-9]{20}$/.test(ref ?? "") ||
  ref === process.env.SUPABASE_EXPECTED_PROJECT_REF ||
  !/^[a-f0-9-]{36}$/.test(target ?? "") ||
  !["fail", "interrupt"].includes(mode)
)
  throw new Error("INVALID_TEST_FAULT_SCOPE");
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  const method = (init?.method ?? input.method ?? "GET").toUpperCase();
  if (
    url.hostname === `${ref}.supabase.co` &&
    ["DELETE", "PUT"].includes(method) &&
    (url.pathname === `/auth/v1/admin/users/${target}` ||
      url.pathname.startsWith(`/auth/v1/admin/users/${target}/factors/`))
  ) {
    if (mode === "interrupt") process.exit(86);
    return new Response(
      JSON.stringify({ message: "Synthetic operator failure" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
  return original(input, init);
};
