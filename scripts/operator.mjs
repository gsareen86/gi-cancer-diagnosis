import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { connectCloud, verifyLedger, isAuthAdminKey } from "./cloud.mjs";
const option = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? null : process.argv[i + 1];
};
const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
async function run() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  if (existsSync(".env.operator")) process.loadEnvFile(".env.operator");
  if (existsSync(".env.test")) process.loadEnvFile(".env.test");
  const action = process.argv[2],
    kind = process.argv.includes("--test") ? "test" : "demo";
  if (
    !["seed", "disable", "grant", "revoke", "recover-mfa"].includes(action) ||
    !process.env.OPERATOR_ID ||
    !option("reason")
  )
    throw new Error("OPERATOR_INPUT_REQUIRED");
  if (!/^[A-Z_]{3,60}$/.test(option("reason")))
    throw new Error("CODED_REASON_REQUIRED");
  const { client, settings, present } = await connectCloud(kind);
  const request = randomUUID();
  let started = false;
  try {
    if (!present || !settings.admin)
      throw new Error("OPERATOR_CONFIGURATION_REQUIRED");
    if (!isAuthAdminKey(settings.admin, settings.ref))
      throw new Error("AUTH_ADMIN_KEY_REQUIRED");
    await verifyLedger(client);
    const auth = createClient(settings.url, settings.admin, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth.admin;
    const target = option("user");
    if (action !== "seed" && !uuid(target))
      throw new Error("SYNTHETIC_USER_REQUIRED");
    if (action !== "seed") {
      const known = await client.query(
        "select synthetic_key from app.staff_accounts where user_id=$1",
        [target],
      );
      const user = await auth.getUserById(target);
      if (
        !known.rows[0]?.synthetic_key?.startsWith("SYN-") ||
        user.error ||
        user.data.user.app_metadata.gi_compass_synthetic !== true
      )
        throw new Error("SYNTHETIC_USER_REQUIRED");
    }
    const event = async (outcome) =>
      client.query(
        "insert into audit.operator_events(operator_id,reason_code,action,target_user_id,request_id,outcome) values($1,$2,$3,$4,$5,$6)",
        [
          process.env.OPERATOR_ID,
          option("reason"),
          action,
          target,
          request,
          outcome,
        ],
      );
    await event("intent");
    started = true;
    console.log(`Operator request: ${request}`);
    async function patientOperation(actionCode, siteId, sql, params) {
      await client.query("begin");
      try {
        const result = await client.query(sql, params);
        await client.query(
          "insert into audit.operator_events(operator_id,reason_code,action,request_id,outcome,site_id,record_ids,resource_type) values($1,$2,$3,$4,'completed',$5,$6,'patient')",
          [
            process.env.OPERATOR_ID,
            option("reason"),
            actionCode,
            request,
            siteId,
            result.rows.map((row) => row.id),
          ],
        );
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
    if (action === "seed") {
      await client.query(
        "select pg_advisory_lock(hashtext('gi_compass_synthetic_seed'))",
      );
      const folder = resolve("var/credentials");
      mkdirSync(folder, { recursive: true });
      const file = resolve(folder, `${request}.json`);
      const credentials = [];
      writeFileSync(file, "[]", { flag: "wx", mode: 0o600 });
      if (process.platform === "win32") {
        const identity = execFileSync("whoami", [], {
          encoding: "utf8",
        }).trim();
        execFileSync(
          "icacls.exe",
          [file, "/inheritance:r", "/grant:r", `${identity}:F`],
          { stdio: "ignore" },
        );
      }
      const sites = [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Demo Clinic",
          key: "CLINIC",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Demo Hospital OPD",
          key: "HOSPITAL",
        },
      ];
      for (const site of sites) {
        const priorSite = await client.query(
          "select name from app.sites where id=$1",
          [site.id],
        );
        if (priorSite.rows.length && priorSite.rows[0].name !== site.name)
          throw new Error("SEED_CONFLICT");
        await client.query(
          "insert into app.sites(id,name) values($1,$2) on conflict do nothing",
          [site.id, site.name],
        );
      }
      for (const site of sites) {
        for (const role of ["clinician", "coordinator", "site_admin"]) {
          const key = `SYN-${site.key}-${role}`;
          let userId;
          const existing = await client.query(
            "select user_id,active from app.staff_accounts where synthetic_key=$1",
            [key],
          );
          if (existing.rows.length) {
            userId = existing.rows[0].user_id;
            const existingAuth = await auth.getUserById(userId);
            if (
              existingAuth.error ||
              existingAuth.data.user.app_metadata.gi_compass_synthetic !== true
            )
              throw new Error("SEED_CONFLICT");
          } else {
            // Recover a completed Auth write after an interrupted database registration.
            const matches = [];
            for (let page = 1; ; page++) {
              const listed = await auth.listUsers({ page, perPage: 200 });
              if (listed.error) throw new Error("AUTH_LOOKUP_FAILED");
              matches.push(
                ...listed.data.users.filter(
                  (user) =>
                    user.app_metadata.gi_compass_synthetic === true &&
                    user.app_metadata.synthetic_key === key,
                ),
              );
              if (listed.data.users.length < 200) break;
            }
            if (matches.length > 1)
              throw new Error("DUPLICATE_SYNTHETIC_IDENTITY");
            if (matches.length) userId = matches[0].id;
            else {
              const email = `${key.toLowerCase()}-${randomUUID().slice(0, 8)}@demo.invalid`;
              const password = randomBytes(24).toString("base64url");
              const entry = {
                email,
                password,
                userId: null,
                syntheticKey: key,
                role,
                site: site.name,
              };
              credentials.push(entry);
              writeFileSync(file, JSON.stringify(credentials, null, 2));
              const created = await auth.createUser({
                email,
                password,
                email_confirm: true,
                app_metadata: {
                  gi_compass_synthetic: true,
                  synthetic_key: key,
                },
              });
              if (created.error || !created.data.user)
                throw new Error("PROVISION_FAILED");
              userId = created.data.user.id;
              entry.userId = userId;
              writeFileSync(file, JSON.stringify(credentials, null, 2));
            }
            await client.query(
              "insert into app.staff_accounts(user_id,synthetic_key) values($1,$2)",
              [userId, key],
            );
          }
          await client.query(
            "insert into app.site_memberships(user_id,site_id,role) values($1,$2,$3) on conflict do nothing",
            [userId, site.id, role],
          );
          if (site.key === "CLINIC" && role === "clinician")
            await client.query(
              "insert into app.site_memberships(user_id,site_id,role) values($1,$2,$3) on conflict do nothing",
              [userId, sites[1].id, role],
            );
        }
        for (let i = 1; i <= 3; i++) {
          const identifier = `SYN-${site.key}-${String(i).padStart(3, "0")}`;
          const name = `Synthetic patient ${i}`;
          const year = 1970 + i * 5;
          const prior = await patientOperation(
            "seed_read",
            site.id,
            "select id,site_id,display_name,year_of_birth,is_synthetic from phi.patients where synthetic_identifier=$1",
            [identifier],
          );
          if (
            prior.rows.length &&
            (prior.rows[0].site_id !== site.id ||
              prior.rows[0].display_name !== name ||
              prior.rows[0].year_of_birth !== year ||
              !prior.rows[0].is_synthetic)
          )
            throw new Error("SEED_CONFLICT");
          await patientOperation(
            "seed_write",
            site.id,
            "insert into phi.patients(site_id,synthetic_identifier,display_name,year_of_birth,is_synthetic) values($1,$2,$3,$4,true) on conflict(synthetic_identifier) do nothing returning id",
            [site.id, identifier, name, year],
          );
        }
      }
      console.log(
        `Synthetic setup completed. Newly generated credentials are in the owner-restricted local file ${file}. Existing passwords and factors were preserved.`,
      );
    } else if (action === "grant" || action === "revoke") {
      const site = option("site"),
        role = option("role");
      if (
        !uuid(site) ||
        !["clinician", "coordinator", "site_admin"].includes(role)
      )
        throw new Error("MEMBERSHIP_INPUT_REQUIRED");
      const knownSite = await client.query(
        "select 1 from app.sites where id=$1 and name in('Demo Clinic','Demo Hospital OPD')",
        [site],
      );
      if (!knownSite.rows.length) throw new Error("SITE_NOT_APPROVED");
      await client.query(
        "insert into app.site_memberships(user_id,site_id,role,active) values($1,$2,$3,$4) on conflict(user_id,site_id,role) do update set active=excluded.active",
        [target, site, role, action === "grant"],
      );
    } else {
      if (
        action === "recover-mfa" &&
        !process.argv.includes("--identity-verified")
      )
        throw new Error("IDENTITY_VERIFICATION_REQUIRED");
      await client.query("begin");
      await client.query(
        "update app.staff_accounts set revoked_before=clock_timestamp(),active=case when $2 then false else active end where user_id=$1",
        [target, action === "disable"],
      );
      await client.query(
        "update app.staff_sessions set revoked_at=coalesce(revoked_at,clock_timestamp()) where user_id=$1",
        [target],
      );
      await client.query("commit");
      if (action === "disable") {
        const result = await auth.updateUserById(target, {
          ban_duration: "876000h",
        });
        if (result.error) throw new Error("AUTH_UPDATE_FAILED");
      } else {
        const factors = await auth.mfa.listFactors({ userId: target });
        if (factors.error) throw new Error("FACTOR_LOOKUP_FAILED");
        for (const factor of factors.data.factors) {
          const result = await auth.mfa.deleteFactor({
            userId: target,
            id: factor.id,
          });
          if (result.error) throw new Error("FACTOR_DELETE_FAILED");
        }
      }
    }
    await event("completed");
    console.log("Operator action recorded.");
  } catch (error) {
    try {
      await client.query("rollback");
      if (started)
        await client.query(
          "insert into audit.operator_events(operator_id,reason_code,action,target_user_id,request_id,outcome) values($1,$2,$3,$4,$5,'failed')",
          [
            process.env.OPERATOR_ID,
            option("reason"),
            action,
            uuid(option("user")) ? option("user") : null,
            request,
          ],
        );
    } catch {
      /* Durable intent remains; do not expose provider output. */
    }
    throw error;
  } finally {
    await client.end();
  }
}
run().catch((error) => {
  console.error(
    `Operator action refused or failed (${typeof error.message === "string" && /^[A-Z_]{3,60}$/.test(error.message) ? error.message : typeof error.code === "string" && /^[A-Z0-9_]{2,40}$/.test(error.code) ? error.code : "OPERATOR_ERROR"}). Inspect the restricted operator event by request ID and reconcile before retrying. No credentials were printed.`,
  );
  process.exitCode = 1;
});
