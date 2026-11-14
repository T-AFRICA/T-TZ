import { describe, expect, it } from "vitest";
import { filterParams, parseOrderFilters, toOrderQuery } from "./orderQuery";

describe("order list filters", () => {
  it("defaults to all orders, newest first, page one", () => {
    expect(parseOrderFilters({})).toEqual({ tab: "all", q: "", sort: "newest", from: "", to: "", page: 1 });
    expect(toOrderQuery(parseOrderFilters({}))).toMatchObject({ statuses: [], search: "", sort: "newest", from: undefined, to: undefined, page: 1 });
  });

  it("maps a tab to its order statuses", () => {
    expect(toOrderQuery(parseOrderFilters({ status: "processing" })).statuses).toEqual(["confirmed", "processing", "packed"]);
    expect(toOrderQuery(parseOrderFilters({ status: "shipped" })).statuses).toEqual(["dispatched", "in_transit"]);
  });

  it("drops anything it does not recognise", () => {
    const filters = parseOrderFilters({
      status: "__proto__",
      sort: "drop table",
      q: "tz-2611'; --",
      from: "2026-02-31",
      to: "yesterday",
      page: "-4",
    });
    expect(filters).toEqual({ tab: "all", q: "tz-2611--", sort: "newest", from: "", to: "", page: 1 });
  });

  it("reads dates as East Africa days, with an inclusive end", () => {
    const query = toOrderQuery(parseOrderFilters({ from: "2026-11-01", to: "2026-11-14" }));
    expect(query.from).toBe("2026-11-01T00:00:00+03:00");
    expect(query.to).toBe("2026-11-15T00:00:00+03:00");
  });

  it("reads a reversed date range the way it was meant", () => {
    expect(parseOrderFilters({ from: "2026-11-14", to: "2026-11-01" })).toMatchObject({ from: "2026-11-01", to: "2026-11-14" });
  });

  it("keeps the filters, not the page, in links", () => {
    const filters = parseOrderFilters({ status: "delivered", q: "TZ-26", sort: "oldest", page: "3" });
    expect(filterParams(filters).toString()).toBe("status=delivered&q=TZ-26&sort=oldest");
    expect(filters.page).toBe(3);
  });
});
