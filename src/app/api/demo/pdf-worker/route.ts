import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const runtime = "nodejs";
export async function GET() {
  const source = await readFile(
    join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
    "utf8",
  );
  return new Response(source, {
    headers: {
      "Content-Type": "text/javascript",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
