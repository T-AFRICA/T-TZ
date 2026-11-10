import { NextResponse, type NextRequest } from "next/server";
import type { SearchResponse } from "@tronic/types";
import { normalizeSearchText } from "@tronic/api-client";
import { ACTIVE_COUNTRY } from "@tronic/country-config";
import { catalogClient } from "@/features/catalog/catalog";
import { clientKey, createRateLimiter } from "@/features/search/rate-limit";
import {
  AUTOCOMPLETE_LIMIT,
  AUTOCOMPLETE_MAX_LIMIT,
  RAW_QUERY_LIMIT,
  toSearchHit,
} from "@/features/search/search";

/**
 * GET /api/search?q=…&limit=… — header autocomplete (SRS FR-006).
 *
 * Public and read-only. The country is the deployment's active country,
 * never a request parameter, so another country's products and prices are
 * unreachable. Only visible products are searched (the catalogue adapter
 * filters inactive and other-country records) and each hit carries just the
 * fields the dropdown shows. Errors return a generic body; details stay in
 * the server log.
 */
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

function json(body: unknown, status: number, cache = "no-store") {
  return NextResponse.json(body, { status, headers: { "Cache-Control": cache } });
}

export async function GET(request: NextRequest) {
  if (!limiter.allow(clientKey(request.headers))) {
    return NextResponse.json(
      { error: "Too many searches. Please wait a moment." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }

  const raw = request.nextUrl.searchParams.get("q") ?? "";
  if (raw.length > RAW_QUERY_LIMIT) {
    return json({ error: "Search text is too long." }, 400);
  }
  const query = normalizeSearchText(raw);
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? AUTOCOMPLETE_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), AUTOCOMPLETE_MAX_LIMIT)
    : AUTOCOMPLETE_LIMIT;

  if (query.length === 0) {
    const empty: SearchResponse = { query, results: [], total: 0, simulated: true };
    return json(empty, 200);
  }

  try {
    const page = await catalogClient.searchProducts({
      country: ACTIVE_COUNTRY.code,
      text: query,
      pageSize: limit,
    });
    const body: SearchResponse = {
      query: page.query,
      results: page.items.map(toSearchHit),
      total: page.total,
      simulated: true,
    };
    // Short shared cache: identical queries within a minute are served
    // without re-querying; prices and stock are never more than ~1 min stale.
    return json(body, 200, "public, max-age=30, s-maxage=60, stale-while-revalidate=60");
  } catch (error) {
    console.error("search route failed", error);
    return json({ error: "Search is unavailable right now." }, 500);
  }
}
