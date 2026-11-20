import type { Metadata } from "next";
import Link from "next/link";
import { BrandForm, TaxonomyForm } from "@/components/categories";
import { Cell, DataTable, Notice, PageHeader, Panel, StatusPill, buttonClass } from "@/components/ui";
import { saveBrandAction, saveTaxonomyAction } from "@/features/categories/actions";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Categories" };

/**
 * The categories and brands of one country, read live from the country.
 * The website's menu, homepage and category pages show these categories, in
 * this order; Shop by Use is the website's own section and is not here.
 */
export default async function CategoriesPage({ params }: { params: Promise<{ country: string }> }) {
  const { admin, country } = await requireCountry((await params).country, "categories.manage");
  const api = await countryApiFor(admin, country);
  const result = await api.categoryTree(admin.actor.userId);
  const base = `/c/${country.id}/categories`;

  const header = (
    <PageHeader
      eyebrow={country.name}
      title="Categories"
      description={`The categories of ${country.name}'s website: its menu, homepage and category pages follow them, in this order. Nothing is deleted; hide what should not show.`}
    />
  );

  if (!result.available) {
    return (
      <>
        {header}
        <Notice tone="warn" title={`${country.name}'s categories cannot be shown right now`}>
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
      </>
    );
  }
  const { categories, brands } = result.data;
  const nextOrder = Math.max(0, ...categories.map((category) => category.sortOrder)) + 1;

  return (
    <>
      {header}

      <Panel title={`${categories.length} categories`} flush>
        <DataTable caption="Categories" head={["Category", "Groups", "Products", "Order", "On the website"]}>
          {categories.map((category) => (
            <tr key={category.id}>
              <Cell>
                <div className="flex items-start gap-3">
                  {category.banner ? (
                    // eslint-disable-next-line @next/next/no-img-element -- served by this console from the country
                    <img
                      src={`${base}/${category.id}/banner?v=${category.banner.sha256.slice(0, 12)}`}
                      alt=""
                      width={64}
                      height={32}
                      loading="lazy"
                      className="h-8 w-16 shrink-0 rounded border border-line bg-raised object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <Link href={`${base}/${category.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                      {category.name}
                    </Link>
                    <p className="text-xs text-muted">/categories/{category.slug}</p>
                  </div>
                </div>
              </Cell>
              <Cell className="tabular-nums text-muted">
                {category.groups.length} groups · {category.groups.reduce((sum, group) => sum + group.subcategories.length, 0)} subcategories
              </Cell>
              <Cell className="tabular-nums">
                <span className="text-ink">{category.live} live</span>
                <span className="text-muted"> of {category.products}</span>
              </Cell>
              <Cell className="tabular-nums text-muted">{category.sortOrder}</Cell>
              <Cell>
                <StatusPill tone={category.active ? "ok" : "neutral"}>{category.active ? "Shown" : "Hidden"}</StatusPill>
              </Cell>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel title="Add a category" description="It starts with no groups; add them on its page. Hidden categories are not on the website.">
        <TaxonomyForm action={saveTaxonomyAction} countryId={country.id} level="category" submitLabel="Add category" />
        <p className="mt-3 text-xs text-muted">Next free order number: {nextOrder}.</p>
      </Panel>

      <Panel title={`Brands (${brands.length})`} description="Shown on product pages and in the website's brand filter. A brand's name can change; it is never deleted.">
        <ul className="flex flex-col gap-4">
          {brands.map((brand) => (
            <li key={brand.id} className="flex flex-col gap-1 border-b border-line pb-4 last:border-b-0">
              <BrandForm action={saveBrandAction} countryId={country.id} brand={{ id: brand.id, name: brand.name }} />
              <p className="text-xs text-muted">
                {brand.products} {brand.products === 1 ? "product" : "products"}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-5 border-t border-line pt-5">
          <BrandForm action={saveBrandAction} countryId={country.id} />
        </div>
      </Panel>

      <div>
        <Link href={`/c/${country.id}/products`} className={buttonClass.secondary}>
          Products
        </Link>
      </div>
    </>
  );
}
