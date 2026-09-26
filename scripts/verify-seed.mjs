// Repeat-setup verification runs only against the designated synthetic test project.
import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { resolve, relative } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { TOTP, Secret } from "otpauth";
import { connectCloud, verifyLedger, isAuthAdminKey } from "./cloud.mjs";
import { currentCommit, implementationHash } from "./invariant-lib.mjs";

async function run() {
  rmSync("var/test-results/operator-evidence.json", { force: true });
  for (const file of [".env", ".env.operator", ".env.test"])
    if (existsSync(file)) process.loadEnvFile(file);
  const file = resolve(process.argv[2] ?? "");
  const scoped = relative(resolve("var/credentials"), file);
  if (!scoped || scoped.startsWith("..") || !scoped.endsWith(".json"))
    throw new Error("SEED_CREDENTIAL_FILE_REQUIRED");
  const entry = JSON.parse(readFileSync(file, "utf8")).find(
    (e) => e.syntheticKey === "SYN-CLINIC-clinician",
  );
  if (!entry) throw new Error("SEED_CREDENTIAL_FILE_REQUIRED");
  const identity = {
    commit: currentCommit(),
    artifactHash: implementationHash(),
  };
  const { client: db, settings } = await connectCloud("test");
  let factorId, staff, admin;
  const sentinelId = randomUUID();
  try {
    await verifyLedger(db);
    if (!isAuthAdminKey(settings.admin, settings.ref))
      throw new Error("AUTH_ADMIN_KEY_REQUIRED");
    const registered = await db.query(
      "select user_id from app.staff_accounts where synthetic_key='SYN-CLINIC-clinician'",
    );
    assert.equal(
      registered.rows[0]?.user_id,
      entry.userId,
      "credential belongs to test seed",
    );
    admin = createClient(settings.url, settings.admin, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    staff = createClient(settings.url, settings.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    assert.equal(
      Boolean(
        (
          await staff.auth.signInWithPassword({
            email: entry.email,
            password: entry.password,
          })
        ).error,
      ),
      false,
      "original password signs in",
    );
    const enrolled = await staff.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `seed-check-${sentinelId}`,
    });
    assert.equal(Boolean(enrolled.error), false, "test factor enrols");
    factorId = enrolled.data.id;
    const otp = new TOTP({
      secret: Secret.fromBase32(enrolled.data.totp.secret),
    });
    assert.equal(
      Boolean(
        (
          await staff.auth.mfa.challengeAndVerify({
            factorId,
            code: otp.generate(),
          })
        ).error,
      ),
      false,
      "test factor verifies",
    );
    const snapshot = async () => ({
      users: (
        await db.query(
          "select a.user_id,a.synthetic_key,a.active,u.encrypted_password from app.staff_accounts a join auth.users u on u.id=a.user_id order by a.user_id",
        )
      ).rows,
      factors: (
        await db.query(
          "select f.id,f.user_id,f.status,f.factor_type from auth.mfa_factors f join app.staff_accounts a on a.user_id=f.user_id order by f.id",
        )
      ).rows,
      memberships: (
        await db.query(
          "select user_id,site_id,role,active from app.site_memberships order by user_id,site_id,role",
        )
      ).rows,
    });
    await db.query(
      "insert into app.sites(id,name) values($1,'SYN unrelated seed verification')",
      [sentinelId],
    );
    const before = await snapshot();
    // Deliberately conflict with the fixed site identity; restore it even when
    // the real operator process fails. This runs only in the synthetic test DB.
    const fixedSite = "11111111-1111-4111-8111-111111111111";
    const fixedName = (
      await db.query("select name from app.sites where id=$1", [fixedSite])
    ).rows[0]?.name;
    assert.equal(fixedName, "Demo Clinic", "fixed test site exists");
    try {
      await db.query(
        "update app.sites set name='SYN conflicting seed fixture' where id=$1",
        [fixedSite],
      );
      let conflictRefused = false;
      try {
        await promisify(execFile)(
          process.execPath,
          [
            "scripts/operator.mjs",
            "seed",
            "--test",
            "--reason",
            "SEED_CONFLICT_VERIFICATION",
          ],
          { timeout: 60000, maxBuffer: 100000, windowsHide: true },
        );
      } catch (error) {
        conflictRefused =
          error.code === 1 && error.stderr?.includes("SEED_CONFLICT");
      }
      assert.equal(
        conflictRefused,
        true,
        "seed refuses a conflicting fixed site",
      );
      assert.equal(
        (await db.query("select name from app.sites where id=$1", [fixedSite]))
          .rows[0].name,
        "SYN conflicting seed fixture",
        "seed does not overwrite conflicting data",
      );
    } finally {
      await db.query(
        "update app.sites set name=$2 where id=$1 and name='SYN conflicting seed fixture'",
        [fixedSite, fixedName],
      );
    }
    await promisify(execFile)(
      process.execPath,
      [
        "scripts/operator.mjs",
        "seed",
        "--test",
        "--reason",
        "REPEAT_SETUP_VERIFICATION",
      ],
      { timeout: 60000, maxBuffer: 100000 },
    );
    assert.deepEqual(
      await snapshot(),
      before,
      "repeat setup preserves identities, passwords, factors and memberships",
    );
    assert.equal(
      (await db.query("select name from app.sites where id=$1", [sentinelId]))
        .rows[0]?.name,
      "SYN unrelated seed verification",
      "unrelated site preserved",
    );
    const writes = await db.query(
      "select record_ids from audit.operator_events where reason_code='REPEAT_SETUP_VERIFICATION' and action='seed_write'",
    );
    assert.ok(
      writes.rows.length >= 6 &&
        writes.rows.every((row) => row.record_ids.length === 0),
      "repeat setup does not insert duplicate patients",
    );
    assert.equal(
      identity.artifactHash,
      implementationHash(),
      "source snapshot unchanged",
    );
  } finally {
    try {
      if (factorId && admin) {
        const removed = await admin.auth.admin.mfa.deleteFactor({
          userId: entry.userId,
          id: factorId,
        });
        if (removed.error) throw new Error("TEST_FACTOR_CLEANUP_FAILED");
      }
      if (staff && (await staff.auth.signOut()).error)
        throw new Error("TEST_SESSION_CLEANUP_FAILED");
      await db.query(
        "delete from app.sites where id=$1 and name='SYN unrelated seed verification'",
        [sentinelId],
      );
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
    "var/test-results/operator-evidence.json",
    JSON.stringify(
      {
        ...identity,
        tests: [
          "repeat setup preserves identities, passwords, factors and memberships",
          "unrelated site preserved",
          "repeat setup does not insert duplicate patients",
          "seed refuses a conflicting fixed site",
          "seed does not overwrite conflicting data",
        ].map((id) => ({ id: `Seed verification: ${id}`, status: "passed" })),
      },
      null,
      2,
    ),
  );
  console.log(
    "Repeat setup passed: existing password, verified MFA factor, memberships and unrelated site preserved; no duplicate patient inserts. Temporary factor and session cleaned up.",
  );
}
run().catch((error) => {
  console.error(
    error.code === "ERR_ASSERTION"
      ? `Seed verification failed: ${error.message.split("\n")[0]}`
      : /^[A-Z_]+$/.test(error.message)
        ? error.message
        : "SEED_VERIFICATION_FAILED",
  );
  process.exitCode = 1;
});
