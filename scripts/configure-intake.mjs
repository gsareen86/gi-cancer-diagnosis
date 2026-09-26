import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { connectCloud, verifyLedger } from "./cloud.mjs";
for (const f of [".env", ".env.operator", ".env.test"])
  if (existsSync(f)) process.loadEnvFile(f);
const args = process.argv.slice(2),
  arg = (name) => args[args.indexOf(name) + 1];
const { client, settings } = await connectCloud(
  args.includes("--test") ? "test" : "demo",
);
try {
  await verifyLedger(client);
  if (args.includes("--list")) {
    const { rows } = await client.query(
      "select s.id,s.name from app.sites s where private.demo_reviewer(s.id) is not null order by s.name",
    );
    console.log(rows);
  } else {
    const site = arg("--site"),
      slug = arg("--slug"),
      mode = arg("--mode");
    if (
      !args.includes("--site") ||
      !args.includes("--slug") ||
      !args.includes("--mode") ||
      !/^[a-f0-9-]{36}$/.test(site) ||
      !/^[a-z0-9-]{3,60}$/.test(slug) ||
      !["synthetic", "real"].includes(mode)
    )
      throw new Error(
        "Use --site <UUID> --slug <clinic-slug> --mode synthetic|real",
      );
    if (settings.kind === "test" && mode !== "synthetic")
      throw new Error("Test clinics use synthetic data only");
    if (
      !(await client.query("select private.demo_reviewer($1) as id", [site]))
        .rows[0]?.id
    )
      throw new Error("An active clinician must be assigned to this clinic");
    await client.query(
      "insert into app.intake_sites(site_id,slug,enabled,data_mode) values($1,$2,true,$3) on conflict(site_id) do update set slug=excluded.slug,enabled=true,data_mode=excluded.data_mode",
      [site, slug, mode],
    );
    if (!args.includes("--test")) {
      const file = existsSync(".env.local")
        ? readFileSync(".env.local", "utf8")
        : "";
      writeFileSync(
        ".env.local",
        file.replace(/^PATIENT_ENTRY_SLUG=.*\r?\n?/gm, "").trimEnd() +
          `\nPATIENT_ENTRY_SLUG=${slug}\n`,
      );
    }
    console.log(
      `Patient entry configured at /start/${slug}. Restart or rebuild the app to update the default /start link.`,
    );
  }
} finally {
  await client.end();
}
