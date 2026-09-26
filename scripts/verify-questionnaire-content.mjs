// Read-only version parity check on an explicitly verified existing Cloud target.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { connectCloud } from "./cloud.mjs";
for (const path of [".env", ".env.operator", ".env.test"])
  if (existsSync(path)) process.loadEnvFile(path);
const kind = process.argv.includes("--test") ? "test" : "demo";
const { client } = await connectCloud(kind);
try {
  for (const name of readdirSync("src/lib/demo").filter((n) =>
    /^content(?:-[\d.-]+)?\.json$/.test(n),
  )) {
    const doc = JSON.parse(readFileSync("src/lib/demo/" + name, "utf8"));
    const { rows } = await client.query(
      "select document from app.demo_content where version=$1",
      [doc.version],
    );
    if (!isDeepStrictEqual(rows[0]?.document, doc)) {
      const keys = [
        ...new Set([
          ...Object.keys(doc),
          ...Object.keys(rows[0]?.document ?? {}),
        ]),
      ].filter((key) => !isDeepStrictEqual(rows[0]?.document?.[key], doc[key]));
      throw new Error(`CONTENT_DRIFT ${doc.version}: ${keys.join(", ")}`);
    }
    console.log(
      `PASS ${doc.version}: bundled and stored documents are identical.`,
    );
  }
} finally {
  await client.end();
}
