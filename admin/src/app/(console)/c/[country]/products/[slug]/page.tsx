import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCT_IMAGES_MAX, PRODUCT_SLUG_PATTERN } from "@tronic/api-contracts";
import { getCountryEndpoint, listAdministrators } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { ConfirmAction } from "@/components/forms";
import { PhotoOrderButton, PhotoUpload, ProductForm, StockForm } from "@/components/products";
import { Notice, PageHeader, Panel, StatusPill, buttonClass } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT, auditActionLabel, formatDateTime } from "@/features/labels";
import { formatMinor } from "@/features/orders/labels";
import {
  addProductImageAction,
  arrangeProductImagesAction,
  setProductStatusAction,
  setProductStockAction,
  updateProductAction,
} from "@/features/products/actions";
import { formValuesOf, placementChoices } from "@/features/products/form";
import { PRODUCT_STATUS_HELP, PRODUCT_STATUS_LABEL, PRODUCT_STATUS_TONE } from "@/features/products/labels";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Product" };

const move = <T,>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
};

/** One product of the country: its status, photos, stock, details and recent changes. */
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { country: countryId, slug: raw } = await params;
  const { admin, country } = await requireCountry(countryId, "products.read");
  const slug = decodeURIComponent(raw).toLowerCase();
  if (!PRODUCT_SLUG_PATTERN.test(slug)) notFound();
  const created = (await searchParams).created === "1";

  const api = await countryApiFor(admin, country);
  const base = `/c/${country.id}/products`;
  const [result, options] = await Promise.all([api.getProduct(admin.actor.userId, slug), api.catalogueOptions(admin.actor.userId)]);

  if (!result.available) {
    return (
      <>
        <PageHeader eyebrow={`${country.name} · Products`} title="Product" />
        <Notice tone="warn" title="This product cannot be shown right now">
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
        <div>
          <Link href={base} className={buttonClass.secondary}>
            All products
          </Link>
        </div>
      </>
    );
  }
  if (!result.data.ok) notFound();
  const product = result.data.product;
  const mayUpdate = can(admin.actor, "products.update", country.id);
  const mayPublish = can(admin.actor, "products.publish", country.id);
  const mayStock = can(admin.actor, "inventory.adjust", country.id);
  const amount = (minor: number) => formatMinor(minor, product.currency, product.currencyExponent);

  const [people, endpoint] = await Promise.all([
    listAdministrators(getAdminDb(), admin.access, { countryId: country.id }),
    getCountryEndpoint(getAdminDb(), admin.access, country.id),
  ]);
  const who = (actorId: string) => (actorId === admin.actor.userId ? "You" : (people.find((person) => person.userId === actorId)?.email ?? "Another administrator"));
  const storefront = product.status === "live" && endpoint?.apiBaseUrl ? `${endpoint.apiBaseUrl.replace(/\/+$/, "")}/products/${product.slug}` : null;
  const ids = product.images.map((image) => image.id);
  const fields = { countryId: country.id, slug: product.slug };

  return (
    <>
      <PageHeader
        eyebrow={`${country.name} · Products`}
        title={product.name}
        description={`SKU ${product.sku} · /products/${product.slug}`}
        actions={
          <>
            <StatusPill tone={PRODUCT_STATUS_TONE[product.status]}>{PRODUCT_STATUS_LABEL[product.status]}</StatusPill>
            {storefront ? (
              <a href={storefront} target="_blank" rel="noopener noreferrer" className={buttonClass.secondary}>
                View on the website
              </a>
            ) : null}
            <Link href={base} className={buttonClass.secondary}>
              All products
            </Link>
          </>
        }
      />

      {created && product.status === "draft" ? (
        <Notice tone="ok" title="Draft created">
          It is not on the website yet. Add at least one photo, then publish it.
        </Notice>
      ) : null}
      {product.sample ? (
        <Notice tone="warn" title="Sample product">
          This comes from the SAMPLE catalogue: its name, price and photo are placeholders. Correct them before customers rely on it, or hide it.
        </Notice>
      ) : null}

      <Panel title="On the website" description={PRODUCT_STATUS_HELP[product.status]}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink">
            {product.priceMinor === null ? "No price yet" : amount(product.priceMinor)}
            {product.wasPriceMinor ? <span className="ml-2 text-muted line-through">{amount(product.wasPriceMinor)}</span> : null}
            <span className="text-muted"> · {product.images.length} {product.images.length === 1 ? "photo" : "photos"}</span>
            {product.publishedAt ? <span className="text-muted"> · first published {formatDateTime(product.publishedAt)}</span> : null}
          </p>
          {mayPublish ? (
            product.status === "live" ? (
              <ConfirmAction
                action={setProductStatusAction}
                fields={{ ...fields, publish: "false" }}
                label="Hide from the website"
                title="Hide this product?"
                description="Customers will no longer find or order it. Orders and reports keep it, and you can publish it again."
                confirmLabel="Hide product"
                variant="danger"
              />
            ) : (
              <ConfirmAction
                action={setProductStatusAction}
                fields={{ ...fields, publish: "true" }}
                label="Publish"
                title="Publish this product?"
                description={`Customers will see it on ${country.name}'s website at the price shown. It needs a price and at least one photo.`}
                confirmLabel="Publish"
                variant="primary"
              />
            )
          ) : (
            <p className="text-xs text-muted">Publishing needs the products.publish permission (Product Manager or Country Super Admin).</p>
          )}
        </div>
      </Panel>

      <Panel title="Photos" description="The first photo is the main one on the website.">
        {product.images.length === 0 ? (
          <p className="text-sm text-muted">No photos yet.</p>
        ) : (
          <ul aria-label="Photos" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {product.images.map((image, index) => (
              <li key={image.id} className="flex flex-col gap-2 rounded-lg border border-line p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- served by this console from the country */}
                <img
                  src={`${base}/${product.slug}/images/${image.id}`}
                  alt={image.alt ?? `Photo ${index + 1} of ${product.name}`}
                  className="aspect-square w-full rounded-md bg-raised object-contain"
                  loading="lazy"
                />
                <p className="text-xs text-muted">
                  {index === 0 ? "Main photo" : `Photo ${index + 1}`}
                  {image.uploaded ? "" : " · sample file"}
                </p>
                {mayUpdate ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {index > 0 ? (
                      <>
                        <PhotoOrderButton action={arrangeProductImagesAction} {...fields} keep={move(ids, index, 0)} label="Main" title={`Make photo ${index + 1} the main photo`} />
                        <PhotoOrderButton action={arrangeProductImagesAction} {...fields} keep={move(ids, index, index - 1)} label="←" title={`Move photo ${index + 1} earlier`} />
                      </>
                    ) : null}
                    {index < ids.length - 1 ? (
                      <PhotoOrderButton action={arrangeProductImagesAction} {...fields} keep={move(ids, index, index + 1)} label="→" title={`Move photo ${index + 1} later`} />
                    ) : null}
                    <ConfirmAction
                      action={arrangeProductImagesAction}
                      fields={{ ...fields, keep: ids.filter((id) => id !== image.id).join(",") }}
                      label="Remove"
                      title="Remove this photo?"
                      description="It is deleted from the product. A live product keeps at least one photo."
                      confirmLabel="Remove photo"
                      variant="quiet"
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {mayUpdate && product.images.length < PRODUCT_IMAGES_MAX ? (
          <div className="mt-5 border-t border-line pt-5">
            <PhotoUpload action={addProductImageAction} {...fields} />
          </div>
        ) : null}
      </Panel>

      <Panel title="Stock" description="Units this country can sell. Checkout reserves them; a cancelled order gives them back.">
        {mayStock ? (
          <StockForm action={setProductStockAction} {...fields} available={product.available} />
        ) : (
          <p className="text-sm text-ink">
            {product.available === null ? "Not set" : `${product.available} in stock`}
            <span className="block text-xs text-muted">Changing stock needs the inventory.adjust permission (Inventory Manager or Country Super Admin).</span>
          </p>
        )}
      </Panel>

      <Panel title="Details">
        {mayUpdate && options.available ? (
          <ProductForm
            action={updateProductAction}
            countryId={country.id}
            currency={product.currency}
            currencyExponent={product.currencyExponent}
            slug={product.slug}
            initial={formValuesOf(product)}
            placements={placementChoices(options.data)}
            brands={options.data.brands}
            submitLabel="Save changes"
          />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Description</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{product.description ?? "None"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Specifications</dt>
              <dd className="mt-1 text-sm text-ink">
                {product.specifications.length === 0 ? "None" : product.specifications.map((spec) => `${spec.label}: ${spec.value}`).join(" · ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{product.variantLabel ?? "Options"}</dt>
              <dd className="mt-1 text-sm text-ink">{product.variants.join(", ") || "None"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Colours</dt>
              <dd className="mt-1 text-sm text-ink">{product.colors.map((color) => color.name).join(", ") || "None"}</dd>
            </div>
          </dl>
        )}
      </Panel>

      <Panel title="Recent changes">
        {product.history.length === 0 ? (
          <p className="text-sm text-muted">No changes from the admin yet.</p>
        ) : (
          <ol className="flex flex-col gap-2 text-sm">
            {product.history.map((change, index) => (
              <li key={index}>
                <span className="text-ink">{auditActionLabel(change.action)}</span>
                <span className="text-muted">
                  {" "}
                  · {formatDateTime(change.createdAt)} · {who(change.actorId)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
