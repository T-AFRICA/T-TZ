import { NextResponse, type NextRequest } from "next/server";
import { handleCountryAdminRequest } from "@tronic/database/country-admin";
import { countryAdminService } from "@/features/admin-api/service";
import { clientKey, createRateLimiter } from "@/features/search/rate-limit";

/**
 * /api/admin/v1/* — this country's admin API for the TRONIC Central Admin.
 * Server to server only: there is no page, form or script on this site that
 * calls it, and it sets no CORS header, so a browser on another origin
 * cannot read it.
 *
 * Every request must carry a token signed by the Central Admin for this
 * country, for the one permission the endpoint needs, and for this exact
 * method, path and body. The checks, the endpoints and the database work
 * are in @tronic/database/country-admin; this file is only the transport.
 * While the Central Admin's public key is not configured the API does not
 * exist: 404 for everything.
 */
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const limiter = createRateLimiter({ limit: 240, windowMs: 60_000 });

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

async function handle(request: NextRequest) {
  const pending = countryAdminService();
  if (!pending) return json({ ok: false, code: "not_found" }, 404);
  if (!limiter.allow(clientKey(request.headers))) return json({ ok: false, code: "rate_limited" }, 429);

  let body = "";
  if (request.method === "POST") {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ ok: false, code: "too_large" }, 413);
    body = await request.text();
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) return json({ ok: false, code: "too_large" }, 413);
  }

  try {
    const response = await handleCountryAdminRequest(await pending, {
      method: request.method,
      path: `${request.nextUrl.pathname}${request.nextUrl.search}`,
      authorization: request.headers.get("authorization"),
      body,
    });
    return json(response.body, response.status);
  } catch (error) {
    // Configuration that cannot be used (an unreadable key, a missing database address).
    console.error("country admin API: not available", { error: error instanceof Error ? error.name : "unknown" });
    return json({ ok: false, code: "server_error" }, 500);
  }
}

export const GET = handle;
export const POST = handle;
