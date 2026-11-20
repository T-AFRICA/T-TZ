import type { ReactNode } from "react";
import Link from "next/link";
import type { OrderStatus, OrdersReport, ProductsReport, SalesReport, StockReport } from "@tronic/api-contracts";
import { STOCK_REASON_LABEL } from "@/features/inventory/labels";
import { ORDER_STATUS_LABEL, formatMinor, isOrderStatus, paymentMethodLabel } from "@/features/orders/labels";
import { bucketName, salesBuckets } from "@/features/reports/load";
import { ColumnChart, RankedBars, ShareBar, TableView } from "./report-charts";
import { Cell, DataTable, EmptyRow, Panel, StatCard } from "./ui";

/**
 * The four reports of the Reports page, from figures the country counted.
 * A sale is a paid order (Cash on Delivery: once delivered), counted on the
 * day it was placed. Links appear only where the administrator may follow
 * them; the pages behind them check again.
 */

type Money = { currency: string; currencyExponent: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%");

/** "TZS 1.2M": short amounts for an axis. */
function compactMinor(minor: number, { currency, currencyExponent }: Money): string {
  const major = minor / 10 ** currencyExponent;
  return `${currency} ${new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(major)}`;
}
const compactCount = (n: number) => new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function Tiles({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

// ------------------------------------------------------------------- sales --

export function SalesReportView({ report }: { report: SalesReport }) {
  const money = (minor: number) => formatMinor(minor, report.currency, report.currencyExponent);
  const { totals } = report;
  const { unit, buckets } = salesBuckets(report.days);
  const per = unit === "day" ? "day" : "week";
  const average = totals.paidOrders > 0 ? Math.round(totals.paidMinor / totals.paidOrders) : null;

  return (
    <>
      <Tiles>
        <StatCard label="Sales" value={money(totals.paidMinor)} hint={`From ${plural(totals.paidOrders, "paid order", "paid orders")}`} />
        <StatCard label="Average paid order" value={average === null ? "None yet" : money(average)} hint="Sales divided by paid orders" />
        <StatCard label="Orders placed" value={totals.placed} hint={`${totals.open} still open · ${totals.cancelled} cancelled`} />
        <StatCard label="Paid" value={percent(totals.paidOrders, totals.placed)} hint="Of the orders placed in the period" />
      </Tiles>

      <Panel title={`Sales by ${per}`} description={`Paid orders, by the ${per} they were placed. Point at a column for its figures.`}>
        {totals.paidMinor === 0 ? (
          <p className="text-sm text-muted">No paid orders in this period yet. Cash on Delivery orders count once they are delivered.</p>
        ) : (
          <ColumnChart
            label={`Sales by ${per}`}
            formatTick={(value) => compactMinor(value, report)}
            points={buckets.map((b) => ({
              key: b.from,
              label: b.label,
              value: b.paidMinor,
              tip: `${bucketName(b)}: ${money(b.paidMinor)} from ${plural(b.paidOrders, "paid order", "paid orders")}`,
            }))}
          />
        )}
        <TableView>
          <DataTable caption={`Sales by ${per}`} head={[unit === "day" ? "Day" : "Week", "Placed", "Paid", "Sales", "Cancelled"]}>
            {buckets.map((b) => (
              <tr key={b.from}>
                <Cell className="whitespace-nowrap text-ink">{bucketName(b)}</Cell>
                <Cell className="tabular-nums">{b.placed}</Cell>
                <Cell className="tabular-nums">{b.paidOrders}</Cell>
                <Cell className="whitespace-nowrap font-semibold tabular-nums text-ink">{money(b.paidMinor)}</Cell>
                <Cell className="tabular-nums">{b.cancelled}</Cell>
              </tr>
            ))}
          </DataTable>
        </TableView>
      </Panel>

      <Panel title={`Orders placed by ${per}`} description="Every order placed, paid or not.">
        {totals.placed === 0 ? (
          <p className="text-sm text-muted">No orders were placed in this period.</p>
        ) : (
          <ColumnChart
            label={`Orders placed by ${per}`}
            formatTick={(value) => (Number.isInteger(value) ? compactCount(value) : "")}
            points={buckets.map((b) => ({
              key: b.from,
              label: b.label,
              value: b.placed,
              tip: `${bucketName(b)}: ${plural(b.placed, "order", "orders")} placed, ${b.paidOrders} paid, ${b.cancelled} cancelled`,
            }))}
          />
        )}
      </Panel>

      <Panel title="By payment method" flush>
        {report.byPayment.length === 0 ? (
          <EmptyRow title="No paid orders yet" />
        ) : (
          <DataTable caption="Sales by payment method" head={["Payment method", "Paid orders", "Sales", "Share"]}>
            {report.byPayment.map((p) => (
              <tr key={p.method}>
                <Cell className="text-ink">{paymentMethodLabel(p.method)}</Cell>
                <Cell className="tabular-nums">{p.paidOrders}</Cell>
                <Cell className="font-semibold tabular-nums text-ink">{money(p.paidMinor)}</Cell>
                <Cell className="tabular-nums text-muted">{percent(p.paidMinor, totals.paidMinor)}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- products --

export function ProductsReportView({ report, productsHref }: { report: ProductsReport; productsHref: string | null }) {
  const money = (minor: number) => formatMinor(minor, report.currency, report.currencyExponent);
  const best = report.products[0];

  return (
    <>
      <Tiles>
        <StatCard label="Sales" value={money(report.paidMinor)} hint="Paid orders placed in the period" />
        <StatCard label="Units sold" value={report.units} hint="In paid orders" />
        <StatCard label="Best seller" value={best ? best.name : "None yet"} hint={best ? `${money(best.amountMinor)} · ${plural(best.units, "unit", "units")}` : undefined} />
        <StatCard label="Categories selling" value={report.categories.length} hint="With at least one paid sale" />
      </Tiles>

      {report.paidMinor === 0 ? (
        <Panel>
          <EmptyRow title="No paid orders in this period yet" description="Cash on Delivery orders count once they are delivered." />
        </Panel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title={`Top ${report.products.length} products`} description="By sales from paid orders.">
            <RankedBars
              label="Top products by sales"
              rows={report.products.map((p) => ({
                key: p.slug,
                label: productsHref ? (
                  <Link href={`${productsHref}/${p.slug}`} className="underline-offset-4 hover:underline">
                    {p.name}
                  </Link>
                ) : (
                  p.name
                ),
                value: p.amountMinor,
                display: money(p.amountMinor),
                sub: `${plural(p.units, "unit", "units")} · ${p.sku} · ${percent(p.amountMinor, report.paidMinor)} of sales`,
                tip: `${p.name}: ${money(p.amountMinor)}, ${plural(p.units, "unit", "units")}`,
              }))}
            />
            <TableView>
              <DataTable caption="Top products" head={["#", "Product", "SKU", "Units", "Sales"]}>
                {report.products.map((p, index) => (
                  <tr key={p.slug}>
                    <Cell className="tabular-nums text-muted">{index + 1}</Cell>
                    <Cell className="text-ink">{p.name}</Cell>
                    <Cell className="font-mono text-xs">{p.sku}</Cell>
                    <Cell className="tabular-nums">{p.units}</Cell>
                    <Cell className="whitespace-nowrap font-semibold tabular-nums text-ink">{money(p.amountMinor)}</Cell>
                  </tr>
                ))}
              </DataTable>
            </TableView>
          </Panel>

          <Panel title="Sales by category" description="Each category's share of the sales. Largest first.">
            <ShareBar
              label="Share of sales by category"
              otherDisplay={money}
              parts={report.categories.map((c) => ({ key: c.slug, label: c.name, value: c.amountMinor, display: money(c.amountMinor) }))}
            />
            <TableView>
              <DataTable caption="Sales by category" head={["Category", "Units", "Sales", "Share"]}>
                {report.categories.map((c) => (
                  <tr key={c.slug}>
                    <Cell className="text-ink">{c.name}</Cell>
                    <Cell className="tabular-nums">{c.units}</Cell>
                    <Cell className="whitespace-nowrap font-semibold tabular-nums text-ink">{money(c.amountMinor)}</Cell>
                    <Cell className="tabular-nums text-muted">{percent(c.amountMinor, report.paidMinor)}</Cell>
                  </tr>
                ))}
              </DataTable>
            </TableView>
          </Panel>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ orders --

/** Order statuses in four fixed groups, so each group keeps its colour. */
const STATUS_GROUPS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "underway", label: "Confirmed, on the way", statuses: ["confirmed", "processing", "packed", "dispatched", "in_transit"] },
  { key: "awaiting", label: "Awaiting confirmation", statuses: ["pending_payment"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

export function OrdersReportView({ report, ridersHref }: { report: OrdersReport; ridersHref: string | null }) {
  const money = (minor: number) => formatMinor(minor, report.currency, report.currencyExponent);
  const count = (status: OrderStatus) => report.byStatus[status] ?? 0;
  const delivered = count("delivered");
  const cancelled = count("cancelled");
  const statuses = Object.entries(report.byStatus).filter((entry): entry is [OrderStatus, number] => isOrderStatus(entry[0]) && (entry[1] ?? 0) > 0);

  return (
    <>
      <Tiles>
        <StatCard label="Orders placed" value={report.placed} hint="In the period" />
        <StatCard label="Delivered" value={delivered} hint={`${percent(delivered, report.placed)} of the orders placed`} />
        <StatCard label="Cancelled" value={cancelled} hint={`${percent(cancelled, report.placed)} of the orders placed`} />
        <StatCard label="Riders" value={report.riders.length} hint="Given deliveries in the period" />
      </Tiles>

      {report.placed === 0 ? (
        <Panel>
          <EmptyRow title="No orders were placed in this period" />
        </Panel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Where the orders stand now" description="Orders placed in the period, by their status today.">
            <ShareBar
              label="Orders by status"
              parts={STATUS_GROUPS.map((group) => {
                const n = group.statuses.reduce((sum, status) => sum + count(status), 0);
                return { key: group.key, label: group.label, value: n, display: plural(n, "order", "orders") };
              })}
            />
            <TableView>
              <DataTable caption="Orders by status" head={["Status", "Orders", "Share"]}>
                {statuses.map(([status, n]) => (
                  <tr key={status}>
                    <Cell className="text-ink">{ORDER_STATUS_LABEL[status]}</Cell>
                    <Cell className="tabular-nums">{n}</Cell>
                    <Cell className="tabular-nums text-muted">{percent(n, report.placed)}</Cell>
                  </tr>
                ))}
              </DataTable>
            </TableView>
          </Panel>

          <Panel title="Orders by region" description="Where the orders were delivered to. Most orders first.">
            <RankedBars
              label="Orders by region"
              rows={report.byRegion.map((r) => ({
                key: r.region,
                label: r.region,
                value: r.orders,
                display: plural(r.orders, "order", "orders"),
                sub: r.paidMinor > 0 ? `${money(r.paidMinor)} paid` : "Nothing paid yet",
                tip: `${r.region}: ${plural(r.orders, "order", "orders")}, ${money(r.paidMinor)} paid`,
              }))}
            />
            <TableView>
              <DataTable caption="Orders by region" head={["Region", "Orders", "Paid"]}>
                {report.byRegion.map((r) => (
                  <tr key={r.region}>
                    <Cell className="text-ink">{r.region}</Cell>
                    <Cell className="tabular-nums">{r.orders}</Cell>
                    <Cell className="whitespace-nowrap tabular-nums">{money(r.paidMinor)}</Cell>
                  </tr>
                ))}
              </DataTable>
            </TableView>
          </Panel>
        </div>
      )}

      <Panel title="Riders" description="Deliveries given to each rider in the period, what came of them, and the cash collected." flush>
        {report.riders.length === 0 ? (
          <EmptyRow title="No deliveries were given to riders in this period" />
        ) : (
          <DataTable caption="Riders" head={["Rider", "Given", "Delivered", "Failed attempts", "Cash collected"]}>
            {report.riders.map((r) => (
              <tr key={r.riderId}>
                <Cell>
                  {ridersHref ? (
                    <Link href={`${ridersHref}/${r.riderId}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                      {r.riderName}
                    </Link>
                  ) : (
                    <span className="font-semibold text-ink">{r.riderName}</span>
                  )}
                </Cell>
                <Cell className="tabular-nums">{r.given}</Cell>
                <Cell className="tabular-nums">
                  {r.delivered} <span className="text-muted">({percent(r.delivered, r.given)})</span>
                </Cell>
                <Cell className="tabular-nums">{r.failedAttempts}</Cell>
                <Cell className="whitespace-nowrap font-semibold tabular-nums text-ink">{money(r.cashMinor)}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}

// ------------------------------------------------------------------- stock --

export function StockReportView({ report, inventoryHref }: { report: StockReport; inventoryHref: string | null }) {
  const money = (minor: number) => formatMinor(minor, report.currency, report.currencyExponent);
  const side = (pick: (m: StockReport["movements"][number]) => number) =>
    report.movements
      .filter((m) => pick(m) > 0)
      .sort((a, b) => pick(b) - pick(a))
      .map((m) => ({
        key: m.reason,
        label: STOCK_REASON_LABEL[m.reason],
        value: pick(m),
        display: plural(pick(m), "unit", "units"),
        tip: `${STOCK_REASON_LABEL[m.reason]}: ${plural(pick(m), "unit", "units")}`,
      }));
  const unitsIn = side((m) => m.unitsIn);
  const unitsOut = side((m) => m.unitsOut);

  return (
    <>
      <Tiles>
        <StatCard label="Units in stock" value={report.units} hint={`Across ${plural(report.products, "product", "products")}, now`} />
        <StatCard label="Stock value" value={money(report.valueMinor)} hint="Units in stock at today's prices" />
        <StatCard label="Out of stock" value={report.out} hint="Products, now" {...(inventoryHref ? { href: `${inventoryHref}?filter=out` } : {})} />
        <StatCard label="Low" value={report.low} hint="At or under their own low level, now" {...(inventoryHref ? { href: `${inventoryHref}?filter=low` } : {})} />
      </Tiles>

      <Panel title="Stock changes in the period" description="Units that came in and went out, by reason. Orders take units; cancellations give them back.">
        {report.movements.length === 0 ? (
          <p className="text-sm text-muted">No stock changed in this period.</p>
        ) : (
          <>
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink">Units in</h3>
                {unitsIn.length ? <RankedBars label="Units in, by reason" rows={unitsIn} /> : <p className="text-sm text-muted">None.</p>}
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink">Units out</h3>
                {unitsOut.length ? <RankedBars label="Units out, by reason" rows={unitsOut} /> : <p className="text-sm text-muted">None.</p>}
              </div>
            </div>
            <TableView>
              <DataTable caption="Stock changes by reason" head={["Reason", "Units in", "Units out", "Changes"]}>
                {report.movements.map((m) => (
                  <tr key={m.reason}>
                    <Cell className="text-ink">{STOCK_REASON_LABEL[m.reason]}</Cell>
                    <Cell className="tabular-nums">{m.unitsIn}</Cell>
                    <Cell className="tabular-nums">{m.unitsOut}</Cell>
                    <Cell className="tabular-nums text-muted">{m.changes}</Cell>
                  </tr>
                ))}
              </DataTable>
            </TableView>
          </>
        )}
      </Panel>

      <Panel title="Needs attention now" description="Out of stock or at their low level, fewest first." flush>
        {report.attention.length === 0 ? (
          <EmptyRow title="Nothing is low or out of stock" />
        ) : (
          <DataTable caption="Products that need stock" head={["Product", "In stock", "Low at", "On the website"]}>
            {report.attention.map((a) => (
              <tr key={a.slug}>
                <Cell>
                  {inventoryHref ? (
                    <Link href={`${inventoryHref}/${a.slug}`} className="font-semibold text-ink underline-offset-4 hover:underline [overflow-wrap:anywhere]">
                      {a.name}
                    </Link>
                  ) : (
                    <span className="font-semibold text-ink">{a.name}</span>
                  )}
                  <p className="font-mono text-xs text-muted">{a.sku}</p>
                </Cell>
                <Cell className={`text-base font-semibold tabular-nums ${a.available === 0 ? "text-danger" : "text-ink"}`}>{a.available}</Cell>
                <Cell className="tabular-nums text-muted">{a.lowStockAt}</Cell>
                <Cell className="text-muted">{a.live ? "Yes" : "No"}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
