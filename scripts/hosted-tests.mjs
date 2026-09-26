import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { currentCommit, implementationHash } from "./invariant-lib.mjs";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { TOTP, Secret } from "otpauth";
import { connectCloud, verifyLedger, isAuthAdminKey } from "./cloud.mjs";
const executed = [];
const check = {
  equal(actual, expected, label) {
    assert.equal(actual, expected, label);
    executed.push({ id: `Hosted: ${label}`, status: "passed" });
  },
  deepEqual(actual, expected, label) {
    assert.deepEqual(actual, expected, label);
    executed.push({ id: `Hosted: ${label}`, status: "passed" });
  },
};
async function run() {
  rmSync("var/test-results/hosted-evidence.json", { force: true });
  const identity = {
    commit: currentCommit(),
    artifactHash: implementationHash(),
  };
  if (existsSync(".env")) process.loadEnvFile(".env");
  if (existsSync(".env.operator")) process.loadEnvFile(".env.operator");
  if (existsSync(".env.test")) process.loadEnvFile(".env.test");
  const { client: db, settings, present } = await connectCloud("test");
  const runId = randomUUID();
  let userId;
  let signupUserId;
  const siteA = randomUUID(),
    siteB = randomUUID(),
    patientA = randomUUID(),
    patientB = randomUUID();
  let admin;
  try {
    if (!present || !settings.admin)
      throw new Error("HOSTED_CONFIGURATION_REQUIRED");
    if (!isAuthAdminKey(settings.admin, settings.ref))
      throw new Error("AUTH_ADMIN_KEY_REQUIRED");
    await verifyLedger(db);
    admin = createClient(settings.url, settings.admin, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `test-${runId}@demo.invalid`,
      password = randomBytes(24).toString("base64url");
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { gi_compass_synthetic: true, test_run: runId },
    });
    check.equal(Boolean(created.error), false, "synthetic Auth provisioning");
    userId = created.data.user.id;
    await db.query("insert into app.sites(id,name) values($1,$2),($3,$4)", [
      siteA,
      `SYN test ${runId} A`,
      siteB,
      `SYN test ${runId} B`,
    ]);
    await db.query(
      "insert into app.staff_accounts(user_id,synthetic_key) values($1,$2)",
      [userId, `SYN-TEST-${runId}`],
    );
    await db.query(
      "insert into app.site_memberships(user_id,site_id,role) values($1,$2,'clinician'),($1,$2,'site_admin')",
      [userId, siteA],
    );
    await db.query(
      "insert into phi.patients(id,site_id,synthetic_identifier,display_name,year_of_birth,is_synthetic) values($1,$2,$3,'Synthetic test A',1980,true),($4,$5,$6,'Synthetic test B',1980,true)",
      [patientA, siteA, `SYN-${runId}-A`, patientB, siteB, `SYN-${runId}-B`],
    );
    const staff = createClient(settings.url, settings.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signup = await staff.auth.signUp({
      email: `uninvited-${runId}@demo.invalid`,
      password,
    });
    signupUserId = signup.data?.user?.id;
    check.equal(Boolean(signup.error), true, "hosted self-signup disabled");
    check.equal(
      Boolean((await staff.auth.signInWithPassword({ email, password })).error),
      false,
      "password sign-in",
    );
    let result = await staff
      .schema("api")
      .rpc("list_patients", { p_site: siteA, p_purpose: "direct_care" });
    check.equal(result.data?.ok, false, "password-only PHI denied");
    const enrolled = await staff.auth.mfa.enroll({ factorType: "totp" });
    check.equal(Boolean(enrolled.error), false, "MFA enrolment");
    const otp = new TOTP({
      secret: Secret.fromBase32(enrolled.data.totp.secret),
    });
    check.equal(
      Boolean(
        (
          await staff.auth.mfa.challengeAndVerify({
            factorId: enrolled.data.id,
            code: otp.generate(),
          })
        ).error,
      ),
      false,
      "MFA challenge",
    );
    result = await staff.schema("api").rpc("begin_staff_session");
    check.equal(result.data?.ok, true, "fresh app session");
    const activeBefore = await db.query(
      "select last_activity_at from app.staff_sessions where user_id=$1",
      [userId],
    );
    await staff.schema("api").rpc("session_status");
    const activeAfter = await db.query(
      "select last_activity_at from app.staff_sessions where user_id=$1",
      [userId],
    );
    check.equal(
      activeBefore.rows[0].last_activity_at.toISOString(),
      activeAfter.rows[0].last_activity_at.toISOString(),
      "background status does not extend activity",
    );
    result = await staff
      .schema("api")
      .rpc("list_patients", { p_site: siteA, p_purpose: "direct_care" });
    check.equal(result.data?.ok, true, "own-site list");
    check.equal(result.data.data.length, 1, "isolated patient count");
    const allowed = await db.query(
      "select record_ids from audit.audit_events where request_id=$1",
      [result.data.requestId],
    );
    check.deepEqual(
      allowed.rows[0].record_ids,
      [patientA],
      "allowed audit has exactly returned patient IDs",
    );
    const missingPurpose = await staff
      .schema("api")
      .rpc("list_patients", { p_site: siteA });
    check.equal(
      missingPurpose.data?.ok,
      false,
      "omitted purpose reaches committed denial",
    );
    check.equal(
      (
        await db.query(
          "select count(*)::int as count from audit.audit_events where request_id=$1",
          [missingPurpose.data.requestId],
        )
      ).rows[0].count,
      1,
      "omitted purpose denial persists",
    );
    const readUsingGet = await staff
      .schema("api")
      .rpc(
        "list_patients",
        { p_site: siteA, p_purpose: "direct_care" },
        { get: true },
      );
    check.equal(
      Boolean(readUsingGet.error),
      true,
      "audited reads cannot run in GET read-only transactions",
    );
    await db.query(
      "update app.site_memberships set active=false where user_id=$1 and role='clinician'",
      [userId],
    );
    check.equal(
      (
        await staff
          .schema("api")
          .rpc("list_patients", { p_site: siteA, p_purpose: "direct_care" })
      ).data?.ok,
      false,
      "site admin alone cannot read patients after clinician role revocation",
    );
    await db.query(
      "update app.site_memberships set active=true where user_id=$1 and role='clinician'",
      [userId],
    );
    result = await staff.schema("api").rpc("get_patient", {
      p_site: siteA,
      p_purpose: "direct_care",
      p_id: patientB,
    });
    check.equal(result.data?.ok, false, "foreign identifier refused");
    const deniedId = result.data.requestId;
    const persisted = await db.query(
      "select outcome,record_ids from audit.audit_events where request_id=$1",
      [deniedId],
    );
    check.equal(
      persisted.rows[0]?.outcome,
      "denied_or_not_found",
      "denial committed across connections",
    );
    check.equal(
      persisted.rows[0].record_ids.length,
      0,
      "denial has no foreign ID",
    );
    const audit = await staff.schema("api").rpc("list_audit_events", {
      p_site: siteA,
      p_from: new Date(Date.now() - 3600000).toISOString(),
      p_to: new Date(Date.now() + 60000).toISOString(),
    });
    check.equal(audit.data?.ok, true, "functional admin audit read");
    check.equal(
      JSON.stringify(audit.data).includes(patientB),
      false,
      "audit does not expose foreign existence",
    );
    const direct = await staff.schema("phi").from("patients").select("id");
    check.equal(Boolean(direct.error), true, "direct Data API read denied");
    const privateWriter = await staff.schema("private").rpc("record_access");
    check.equal(
      Boolean(privateWriter.error),
      true,
      "private writer unreachable",
    );
    // Simulate the committed first half of operator disable/recovery, before Auth completes.
    await db.query(
      "update app.staff_accounts set active=false where user_id=$1",
      [userId],
    );
    check.equal(
      (await staff.schema("api").rpc("session_status")).data?.ok,
      false,
      "disabled staff token immediately blocked",
    );
    await db.query(
      "update app.staff_accounts set active=true,revoked_before=clock_timestamp() where user_id=$1",
      [userId],
    );
    check.equal(
      (await staff.schema("api").rpc("begin_staff_session")).data?.ok,
      false,
      "recovery epoch blocks old Auth session even if provider operation is pending",
    );
    // Test-fixture restoration only; operator scripts never restore this epoch.
    await db.query(
      "update app.staff_accounts set revoked_before='-infinity' where user_id=$1",
      [userId],
    );
    await db.query(
      "update app.staff_sessions set last_activity_at=clock_timestamp()-interval '2 hours' where user_id=$1",
      [userId],
    );
    check.equal(
      (await staff.schema("api").rpc("touch_staff_session")).data?.ok,
      false,
      "expired touch cannot resurrect",
    );
    check.equal(
      (await staff.schema("api").rpc("begin_staff_session")).data?.ok,
      false,
      "bootstrap cannot resurrect",
    );
    result = await staff
      .schema("api")
      .rpc("list_patients", { p_site: siteA, p_purpose: "direct_care" });
    check.equal(result.data?.ok, false, "valid JWT blocked after app expiry");
    await db.query(
      "update app.staff_sessions set last_activity_at=clock_timestamp(),expires_at=clock_timestamp()-interval '1 second' where user_id=$1",
      [userId],
    );
    check.equal(
      (await staff.schema("api").rpc("touch_staff_session")).data?.ok,
      false,
      "absolute expiry cannot be extended",
    );
    await db.query(
      "update app.staff_sessions set expires_at=clock_timestamp()+interval '1 hour' where user_id=$1",
      [userId],
    );
    // Exercise renewal waiting behind a committed expiry, not only sequential calls.
    let renewal;
    await db.query("begin");
    try {
      await db.query(
        "select session_id from app.staff_sessions where user_id=$1 for update",
        [userId],
      );
      const pid = (await db.query("select pg_backend_pid() as pid")).rows[0]
        .pid;
      renewal = Promise.resolve(staff.schema("api").rpc("touch_staff_session"));
      let waiting = false;
      for (let attempt = 0; attempt < 30 && !waiting; attempt++) {
        await delay(200);
        await db.query("select pg_stat_clear_snapshot()");
        waiting = (
          await db.query(
            "select exists(select 1 from pg_stat_activity where $1=any(pg_blocking_pids(pid))) as waiting",
            [pid],
          )
        ).rows[0].waiting;
      }
      check.equal(waiting, true, "renewal waits behind the session row lock");
      await db.query(
        "update app.staff_sessions set expires_at=clock_timestamp()-interval '1 second' where user_id=$1",
        [userId],
      );
      await db.query("commit");
    } finally {
      await db.query("rollback");
    }
    check.equal(
      (await renewal).data?.ok,
      false,
      "waiting renewal cannot revive a concurrently expired session",
    );
    await db.query(
      "update app.staff_sessions set expires_at=clock_timestamp()+interval '1 hour' where user_id=$1",
      [userId],
    );
    const token = (await staff.auth.getSession()).data.session.access_token;
    // Keep the real claims but invalidate the signature. The gateway must reject
    // this before an audited record operation is entered.
    const jwtParts = token.split(".");
    jwtParts[2] = `${jwtParts[2][0] === "A" ? "B" : "A"}${jwtParts[2].slice(1)}`;
    const beforeForged = await db.query(
      "select count(*)::int as count from audit.audit_events where actor_user_id=$1",
      [userId],
    );
    const forged = await fetch(`${settings.url}/rest/v1/rpc/list_patients`, {
      method: "POST",
      headers: {
        apikey: settings.key,
        Authorization: `Bearer ${jwtParts.join(".")}`,
        "Content-Type": "application/json",
        "Content-Profile": "api",
      },
      body: JSON.stringify({ p_site: siteA, p_purpose: "direct_care" }),
      signal: AbortSignal.timeout(10000),
    });
    check.equal(forged.status, 401, "forged JWT is rejected by the hosted API");
    check.equal(
      (await forged.text()).includes(patientA),
      false,
      "forged JWT response contains no patient identifier",
    );
    check.equal(
      (
        await db.query(
          "select count(*)::int as count from audit.audit_events where actor_user_id=$1",
          [userId],
        )
      ).rows[0].count,
      beforeForged.rows[0].count,
      "pre-RPC token rejection does not fabricate a record audit",
    );
    const captured = createClient(settings.url, settings.key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    check.equal(
      (await staff.schema("api").rpc("end_staff_session")).data?.ok,
      true,
      "app signout",
    );
    check.equal(
      (await captured.schema("api").rpc("session_status")).data?.ok,
      false,
      "captured JWT rejected after signout",
    );
  } finally {
    try {
      if (signupUserId && admin) {
        const uninvited = await admin.auth.admin.getUserById(signupUserId);
        if (
          uninvited.error ||
          uninvited.data.user.email !== `uninvited-${runId}@demo.invalid`
        )
          throw new Error("TEST_CLEANUP_IDENTITY_MISMATCH");
        if ((await admin.auth.admin.deleteUser(signupUserId)).error)
          throw new Error("TEST_AUTH_CLEANUP_FAILED");
      }
      if (userId && admin) {
        // Only this run's generated IDs; retain append-only audit history.
        const current = await admin.auth.admin.getUserById(userId);
        if (current.error || current.data.user.app_metadata.test_run !== runId)
          throw new Error("TEST_CLEANUP_IDENTITY_MISMATCH");
        {
          await db.query(
            "delete from phi.patients where id=any($1::uuid[]) and synthetic_identifier like $2",
            [[patientA, patientB], `SYN-${runId}-%`],
          );
          await db.query(
            "delete from app.site_memberships where user_id=$1 and site_id=any($2::uuid[])",
            [userId, [siteA, siteB]],
          );
          await db.query("delete from app.staff_sessions where user_id=$1", [
            userId,
          ]);
          await db.query(
            "delete from app.staff_accounts where user_id=$1 and synthetic_key=$2",
            [userId, `SYN-TEST-${runId}`],
          );
          await db.query("delete from app.sites where id=any($1::uuid[])", [
            [siteA, siteB],
          ]);
          if ((await admin.auth.admin.deleteUser(userId)).error)
            throw new Error("TEST_AUTH_CLEANUP_FAILED");
        }
      }
    } finally {
      await db.end();
    }
  }
  if (
    identity.commit !== currentCommit() ||
    identity.artifactHash !== implementationHash()
  )
    throw new Error("TEST_SOURCE_CHANGED");
  mkdirSync("var/test-results", { recursive: true });
  writeFileSync(
    "var/test-results/hosted-evidence.json",
    JSON.stringify({ ...identity, tests: executed }, null, 2),
  );
  console.log(
    `Hosted checks passed: ${executed.length} assertions; temporary fixtures cleaned up, audit retained.`,
  );
}
run().catch((error) => {
  if (error.code === "ERR_ASSERTION")
    console.error(`Assertion: ${error.message.split("\n")[0]}`);
  else if (/^[A-Z_]+$/.test(error.message)) console.error(error.message);
  console.error(
    `${["CONFIGURATION_REQUIRED", "TEST_TARGET_NOT_ISOLATED", "HOSTED_CONFIGURATION_REQUIRED"].includes(error?.message) ? "NOT RUN: configuration is incomplete" : "FAILED: a hosted verification step failed"}. No credentials or provider payloads are printed.`,
  );
  process.exitCode = 1;
});
