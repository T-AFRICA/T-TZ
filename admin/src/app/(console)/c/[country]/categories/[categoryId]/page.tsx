import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BannerUpload, TaxonomyForm } from "@/components/categories";
import { ConfirmAction } from "@/components/forms";
import { Notice, PageHeader, Panel, StatusPill, buttonClass } from "@/components/ui";
import { saveTaxonomyAction, setCategoryBannerAction } from "@/features/categories/actions";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Category" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** One category: its name and line, banner photo, groups and subcategories. */
export default async function CategoryPage({ params }: { params: Promise<{ country: string; categoryId: string }> }) {
  const { country: countryId, categoryId } = await params;
  const { admin, country } = await requireCountry(countryId, "categories.manage");
  if (!UUID.test(categoryId)) notFound();
  const api = await countryApiFor(admin, country);
  const result = await api.categoryTree(admin.actor.userId);
  const back = `/c/${country.id}/categories`;

  if (!result.available) {
    return (
      <>
        <PageHeader eyebrow={`${country.name} · Categories`} title="Category" />
        <Notice tone="warn" title="This category cannot be shown right now">
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
      </>
    );
  }
  const category = result.data.categories.find((candidate) => candidate.id === categoryId);
  if (!category) notFound();
  const nextGroupOrder = Math.max(-1, ...category.groups.map((group) => group.sortOrder)) + 1;

  return (
    <>
      <PageHeader
        eyebrow={`${country.name} · Categories`}
        title={category.name}
        description={`/categories/${category.slug} · ${category.live} live of ${category.products} products`}
        actions={
          <>
            <StatusPill tone={category.active ? "ok" : "neutral"}>{category.active ? "Shown" : "Hidden"}</StatusPill>
            <Link href={back} className={buttonClass.secondary}>
              All categories
            </Link>
          </>
        }
      />

      <Panel title="Category">
        <TaxonomyForm
          action={saveTaxonomyAction}
          countryId={country.id}
          level="category"
          node={{ id: category.id, slug: category.slug, name: category.name, description: category.description, sortOrder: category.sortOrder, active: category.active, live: category.live }}
          submitLabel="Save category"
        />
      </Panel>

      <Panel title="Banner" description="Shown on the website's homepage and category page. Without one, the website shows the category's icon (the original categories keep their own photos).">
        {category.banner ? (
          <div className="mb-5 flex flex-wrap items-end gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- served by this console from the country */}
            <img
              src={`${back}/${category.id}/banner?v=${category.banner.sha256.slice(0, 12)}`}
              alt={`Banner of ${category.name}`}
              className="h-32 w-auto max-w-full rounded-lg border border-line bg-raised object-contain"
            />
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted">Saved {formatDateTime(category.banner.updatedAt)}</p>
              <ConfirmAction
                action={setCategoryBannerAction}
                fields={{ countryId: country.id, categoryId: category.id, image: "" }}
                label="Remove banner"
                title="Remove this banner?"
                description="The website shows the category's icon instead."
                confirmLabel="Remove banner"
                variant="quiet"
              />
            </div>
          </div>
        ) : null}
        <BannerUpload action={setCategoryBannerAction} countryId={country.id} categoryId={category.id} hasBanner={category.banner !== null} />
      </Panel>

      {category.groups.map((group) => (
        <Panel key={group.id} title={`Group: ${group.name}`} description={`/categories/${category.slug}/${group.slug} · ${group.live} live of ${group.products} products${group.active ? "" : " · hidden"}`}>
          <TaxonomyForm
            action={saveTaxonomyAction}
            countryId={country.id}
            level="group"
            node={{ id: group.id, slug: group.slug, name: group.name, sortOrder: group.sortOrder, active: group.active, live: group.live }}
            submitLabel="Save group"
            compact
          />
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-ink">Subcategories</h3>
            {group.subcategories.length === 0 ? <p className="mt-1 text-sm text-muted">None yet.</p> : null}
            <ul className="mt-3 flex flex-col gap-4">
              {group.subcategories.map((sub) => (
                <li key={sub.id} className="rounded-lg border border-line p-3">
                  <p className="mb-2 text-xs text-muted">
                    /{sub.slug} · {sub.live} live of {sub.products} products
                  </p>
                  <TaxonomyForm
                    action={saveTaxonomyAction}
                    countryId={country.id}
                    level="subcategory"
                    node={{ id: sub.id, slug: sub.slug, name: sub.name, sortOrder: sub.sortOrder, active: sub.active, live: sub.live }}
                    submitLabel="Save"
                    compact
                  />
                </li>
              ))}
            </ul>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-accent-ink">Add a subcategory to {group.name}</summary>
              <div className="mt-3">
                <TaxonomyForm action={saveTaxonomyAction} countryId={country.id} level="subcategory" parentId={group.id} submitLabel="Add subcategory" compact />
              </div>
            </details>
          </div>
        </Panel>
      ))}

      <Panel title="Add a group" description={`Next free order number: ${nextGroupOrder}.`}>
        <TaxonomyForm action={saveTaxonomyAction} countryId={country.id} level="group" parentId={category.id} submitLabel="Add group" compact />
      </Panel>
    </>
  );
}
