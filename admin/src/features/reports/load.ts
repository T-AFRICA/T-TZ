import type { CountryAdminApi, CountryApiResult, ReportPeriod, SalesReport } from "@tronic/api-contracts";
import type { AnyReport } from "./csv";
import { formatShortDay, type ReportTab } from "./period";

/** One report from the country, for the page or its CSV file. */
export async function loadReport(api: CountryAdminApi, actorId: string, tab: ReportTab, period: ReportPeriod): Promise<CountryApiResult<AnyReport>> {
  switch (tab) {
    case "sales": {
      const result = await api.salesReport(actorId, period);
      return result.available ? { ...result, data: { tab, data: result.data } } : result;
    }
    case "products": {
      const result = await api.productsReport(actorId, period);
      return result.available ? { ...result, data: { tab, data: result.data } } : result;
    }
    case "orders": {
      const result = await api.ordersReport(actorId, period);
      return result.available ? { ...result, data: { tab, data: result.data } } : result;
    }
    case "stock": {
      const result = await api.stockReport(actorId, period);
      return result.available ? { ...result, data: { tab, data: result.data } } : result;
    }
  }
}

export interface SalesBucket {
  from: string;
  to: string;
  label: string;
  placed: number;
  paidOrders: number;
  paidMinor: number;
  cancelled: number;
}

/** Up to this many days are drawn a column a day; longer periods a column a week. */
export const DAILY_COLUMNS_MAX = 62;

/** The sales days as columns: one a day, or one a week (from the first day) for long periods. */
export function salesBuckets(days: SalesReport["days"]): { unit: "day" | "week"; buckets: SalesBucket[] } {
  const unit = days.length > DAILY_COLUMNS_MAX ? "week" : "day";
  const size = unit === "week" ? 7 : 1;
  const buckets: SalesBucket[] = [];
  for (let start = 0; start < days.length; start += size) {
    const slice = days.slice(start, start + size);
    const from = slice[0]!.day;
    const to = slice[slice.length - 1]!.day;
    buckets.push({
      from,
      to,
      label: formatShortDay(from),
      placed: slice.reduce((sum, d) => sum + d.placed, 0),
      paidOrders: slice.reduce((sum, d) => sum + d.paidOrders, 0),
      paidMinor: slice.reduce((sum, d) => sum + d.paidMinor, 0),
      cancelled: slice.reduce((sum, d) => sum + d.cancelled, 0),
    });
  }
  return { unit, buckets };
}

/** "3 Nov – 9 Nov" or "3 Nov". */
export function bucketName(bucket: Pick<SalesBucket, "from" | "to">): string {
  return bucket.from === bucket.to ? formatShortDay(bucket.from) : `${formatShortDay(bucket.from)} – ${formatShortDay(bucket.to)}`;
}
