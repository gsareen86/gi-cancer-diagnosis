import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { runtimeConfig } from "./lib/config";
import { boundedFetch } from "./lib/bounded-fetch";
import { securityEvent } from "./lib/security-event";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (request.nextUrl.pathname === "/sign-in") {
    // Selection cookies are HttpOnly, so browser-side logout cannot remove them.
    // Also covers reconnecting after an offline sign-out.
    response.cookies.delete("gi-patient");
    response.cookies.delete("gi-site");
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  }
  if (request.nextUrl.pathname.startsWith("/staff")) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    const settings = runtimeConfig();
    if (!settings.ok)
      return NextResponse.redirect(new URL("/setup", request.url));
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.get("origin") !== settings.config.origin
    ) {
      const requestId = securityEvent("origin_rejected");
      return NextResponse.json(
        { error: "Request unavailable", requestId },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    const client = createServerClient(
      settings.config.url,
      settings.config.publicKey,
      {
        global: { fetch: boundedFetch },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(items) {
            items.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            items.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
            response.headers.set(
              "Cache-Control",
              "private, no-store, max-age=0",
            );
          },
        },
      },
    );
    const { data } = await client.auth
      .getClaims()
      .catch(() => ({ data: null }));
    if (!data?.claims) {
      securityEvent("session_rejected");
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }
  return response;
}
export const config = { matcher: ["/staff/:path*", "/sign-in"] };
