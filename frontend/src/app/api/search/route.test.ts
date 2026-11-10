// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { SearchResponse } from "@tronic/types";
import { GET } from "./route";

function get(query: string, ip = "198.51.100.7") {
  return GET(new NextRequest(`http://localhost/api/search?${query}`, { headers: { "x-forwarded-for": ip } }));
}

describe("GET /api/search", () => {
  it("returns at most six slim Tanzania hits, exact SKU first", async () => {
    const response = await get("q=sample-led-panel");
    expect(response.status).toBe(200);
    const body = (await response.json()) as SearchResponse;
    expect(body.results[0]?.sku).toBe("SAMPLE-LED-PANEL");
    expect(body.results.length).toBeLessThanOrEqual(6);
    expect(body.results.every((hit) => hit.currency === "TZS")).toBe(true);
    expect(body.results[0]).not.toHaveProperty("countries");
    expect(response.headers.get("cache-control")).toContain("max-age=30");
  });

  it("caps the limit and returns nothing for blank input", async () => {
    const capped = (await (await get("q=fan&limit=500")).json()) as SearchResponse;
    expect(capped.results.length).toBeLessThanOrEqual(8);
    const blank = (await (await get("q=%20%20")).json()) as SearchResponse;
    expect(blank).toEqual({ query: "", results: [], total: 0, simulated: true });
  });

  it("rejects oversized input without echoing it", async () => {
    const response = await get(`q=${"a".repeat(201)}`);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("aaaa");
  });

  it("rate-limits one client after 60 requests a minute", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 61; i += 1) {
      statuses.push((await get("q=led", "192.0.2.99")).status);
    }
    expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
});
