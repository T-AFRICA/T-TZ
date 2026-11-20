import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { COUNTRY_ADMIN_API_PREFIX, DELIVERY_PROOF_MAX_BYTES, KeyFormatError, PRODUCT_IMAGE_MAX_BYTES } from "@tronic/api-contracts";
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
/**
 * A rider's "delivered" step carries the photo and the signature (each at
 * most DELIVERY_PROOF_MAX_BYTES, base64 in JSON). Only that endpoint may
 * send this much; Vercel's own request limit is 4.5 MB.
 */
const DELIVER_PATH = new RegExp(`^${COUNTRY_ADMIN_API_PREFIX}/deliveries/[A-Za-z0-9-]{1,40}/deliver$`);
const MAX_DELIVER_BODY_BYTES = Math.ceil((2 * Math.ceil(DELIVERY_PROOF_MAX_BYTES / 3) * 4) * 1.05) + 16 * 1024;
/** A product photo (at most PRODUCT_IMAGE_MAX_BYTES, base64 in JSON). */
const PRODUCT_IMAGE_PATH = new RegExp(`^${COUNTRY_ADMIN_API_PREFIX}/products/[a-z0-9-]{1,80}/images$`);
const MAX_PRODUCT_IMAGE_BODY_BYTES = Math.ceil(PRODUCT_IMAGE_MAX_BYTES / 3) * 4 + 16 * 1024;
/** A category's banner photo: the same size as a product photo. */
const CATEGORY_BANNER_PATH = new RegExp(`^${COUNTRY_ADMIN_API_PREFIX}/categories/[0-9a-fA-F-]{36}/banner$`);
/** A product's details: description, specifications and lists fit well within this. */
const PRODUCT_PATH = new RegExp(`^${COUNTRY_ADMIN_API_PREFIX}/products(?:/|$)`);
const MAX_PRODUCT_BODY_BYTES = 64 * 1024;
/** Changes the website's catalogue (products, categories, brands): it is read again after one is accepted. */
const CATALOGUE_PATH = new RegExp(`^${COUNTRY_ADMIN_API_PREFIX}/(?:products|categories|brands)(?:/|$)`);

function bodyLimit(pathname: string): number {
  if (DELIVER_PATH.test(pathname)) return MAX_DELIVER_BODY_BYTES;
  if (PRODUCT_IMAGE_PATH.test(pathname) || CATEGORY_BANNER_PATH.test(pathname)) return MAX_PRODUCT_IMAGE_BODY_BYTES;
  if (PRODUCT_PATH.test(pathname)) return MAX_PRODUCT_BODY_BYTES;
  return MAX_BODY_BYTES;
}
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
    const limit = bodyLimit(request.nextUrl.pathname);
    if (Number(request.headers.get("content-length") ?? 0) > limit) return json({ ok: false, code: "too_large" }, 413);
    body = await request.text();
    if (Buffer.byteLength(body, "utf8") > limit) return json({ ok: false, code: "too_large" }, 413);
  }

  try {
    const response = await handleCountryAdminRequest(await pending, {
      method: request.method,
      path: `${request.nextUrl.pathname}${request.nextUrl.search}`,
      authorization: request.headers.get("authorization"),
      body,
    });
    // A catalogue change the country accepted: the storefront's shared
    // catalogue is read again on the next visit instead of after its minute.
    if (request.method === "POST" && CATALOGUE_PATH.test(request.nextUrl.pathname) && response.status === 200 && (response.body as { ok?: unknown } | null)?.ok === true) {
      revalidateTag("catalogue", { expire: 0 });
    }
    return json(response.body, response.status);
  } catch (error) {
    // The Central Admin's public key as configured here cannot be used. Say
    // which way it is wrong (never the value), so an owner can fix it: the
    // answer names the fault, and nothing is verified or read until it is.
    if (error instanceof KeyFormatError) {
      console.error("country admin API: CENTRAL_ADMIN_VERIFY_KEY cannot be used", { reason: error.reason });
      return json({ ok: false, code: `verify_key_${error.reason}` }, 503);
    }
    // The data source of this deployment is set up wrongly (features/data/source.ts raises it; the text is ours and holds no value).
    if (error instanceof Error && error.message.includes("DATA_SOURCE")) {
      console.error("country admin API: the data source is not set up", { error: error.message });
      return json({ ok: false, code: "data_source_misconfigured" }, 503);
    }
    console.error("country admin API: not available", { error: error instanceof Error ? error.name : "unknown" });
    return json({ ok: false, code: "server_error" }, 500);
  }
}

export const GET = handle;
export const POST = handle;
