import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCT_SLUG_PATTERN } from "@tronic/api-contracts";
import { listAdministrators } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { AdjustStockForm, LowStockForm } from "@/components/inventory";
import { Cell, DataTable, EmptyRow, Notice, PageHeader, Panel, StatusPill, buttonClass } from "@/components/ui";
import { adjustStockAction, setLowStockAction } from "@/features/inventory/actions";
import { STOCK_LEVEL_LABEL, STOCK_LEVEL_TONE, STOCK_REASON_LABEL, signedChange } from "@/features/inventory/labels";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { PRODUCT_STATUS_LABEL } from "@/features/products/labels";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Stock" };

/** One product's stock: how many, its low-stock level, a change with its reason, and the history. */
export default async function StockPage({ params }: { params: Promise<{ country: string; slug: string }> }) {
  const { country: countryId, slug: raw } = await params;
  const { admin, country } = await requireCountry(countryId, "inventory.read");
  const slug = decodeURIComponent(raw).toLowerCase();
  if (!PRODUCT_SLUG_PATTERN.test(slug)) notFound();

  const api = await countryApiFor(admin, country);
  const result = await api.getInventory(admin.actor.userId, slug);
  const back = `/c/${country.id}/inventory`;
  if (!result.available) {
    return (
      <>
        <PageHeader eyebrow={`${country.name} · Inventory`} title="Stock" />
        <Notice tone="warn" title="This stock cannot be shown right now">
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
        <div>
          <Link href={back} className={buttonClass.secondary}>
            All stock
          </Link>
        </div>
      </>
    );
  }
  if (!result.data.ok) notFound();
  const item = result.data.item;
  const mayAdjust = can(admin.actor, "inventory.adjust", country.id);
  const mayReadProduct = can(admin.actor, "products.read", country.id);
  const mayReadOrders = can(admin.actor, "orders.read", country.id);
  const level = item.available === 0 ? "out" : item.available <= item.lowStockAt ? "low" : "ok";
  const people = await listAdministrators(getAdminDb(), admin.access, { countryId: country.id });
  const who = (actorId: string | null) =>
    actorId === null ? "Storefront" : actorId === admin.actor.userId ? "You" : (people.find((person) => person.userId === actorId)?.email ?? "Another administrator");

  return (
    <>
      <PageHeader
        eyebrow={`${country.name} · Inventory`}
        title={item.name}
        description={`SKU ${item.sku}${item.status !== "live" ? ` · ${PRODUCT_STATUS_LABEL[item.status]}` : ""}`}
        actions={
          <>
            {mayReadProduct ? (
              <Link href={`/c/${country.id}/products/${item.slug}`} className={buttonClass.secondary}>
                Product
              </Link>
            ) : null}
            <Link href={back} className={buttonClass.secondary}>
              All stock
            </Link>
          </>
        }
      />

      <Panel title="In stock">
        <div className="flex flex-wrap items-center gap-4">
          {item.image && mayReadProduct ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by this console from the country
            <img
              src={`/c/${country.id}/products/${item.slug}/images/${item.image.id}`}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-md border border-line bg-raised object-contain"
            />
          ) : null}
          <p className="text-4xl font-bold tabular-nums text-ink" aria-label={`${item.available} units in stock`}>
            {item.available}
          </p>
          <StatusPill tone={STOCK_LEVEL_TONE[level]}>{STOCK_LEVEL_LABEL[level]}</StatusPill>
          <p className="text-sm text-muted">{item.lowStockAt === 0 ? "Never counted as low." : `Low at ${item.lowStockAt} or fewer.`}</p>
        </div>
      </Panel>

      {mayAdjust ? (
        <>
          <Panel title="Change the stock" description="Add or remove units with the reason, or set the total you counted. Each change is kept in the history.">
            <AdjustStockForm action={adjustStockAction} countryId={country.id} slug={item.slug} available={item.available} />
          </Panel>
          <Panel title="Low-stock level" description="This product counts as low at this many units or fewer (0: never). Each product has its own.">
            <LowStockForm action={setLowStockAction} countryId={country.id} slug={item.slug} level={item.lowStockAt} />
          </Panel>
        </>
      ) : (
        <Notice tone="neutral">Changing stock needs the inventory.adjust permission (Inventory Manager or Country Super Admin).</Notice>
      )}

      <Panel title="History" description="Newest first: changes made here, orders placed and orders cancelled." flush>
        {item.movements.length === 0 ? (
          <EmptyRow title="No changes recorded yet" description="The history starts when the inventory was switched on for this country." />
        ) : (
          <DataTable caption="Stock history" head={["When", "Change", "After", "Reason", "By"]}>
            {item.movements.map((move, index) => (
              <tr key={index}>
                <Cell className="whitespace-nowrap text-muted">{formatDateTime(move.createdAt)}</Cell>
                <Cell className={`font-semibold tabular-nums ${move.change > 0 ? "text-ok" : "text-danger"}`}>{signedChange(move.change)}</Cell>
                <Cell className="tabular-nums text-ink">{move.availableAfter}</Cell>
                <Cell>
                  <span className="text-ink">{STOCK_REASON_LABEL[move.reason]}</span>
                  {move.orderNumber ? (
                    mayReadOrders ? (
                      <Link href={`/c/${country.id}/orders/${move.orderNumber}`} className="block text-xs text-muted underline-offset-4 hover:underline">
                        {move.orderNumber}
                      </Link>
                    ) : (
                      <span className="block text-xs text-muted">{move.orderNumber}</span>
                    )
                  ) : null}
                  {move.note ? <p className="text-xs text-muted [overflow-wrap:anywhere]">{move.note}</p> : null}
                </Cell>
                <Cell className="text-muted">{who(move.actorId)}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
