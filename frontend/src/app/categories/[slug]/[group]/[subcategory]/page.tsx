import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORY_SECTIONS, getCategorySection } from "@tronic/country-config";
import { CategoryListing, listingBasePath } from "@/components/catalog/CategoryListing";
import { listingMetadata } from "@/features/catalog/metadata";
import type { SearchParams } from "@/features/catalog/catalog";

type Params = Promise<{ slug: string; group: string; subcategory: string }>;

export function generateStaticParams() {
  return CATEGORY_SECTIONS.flatMap((section) =>
    section.groups.flatMap((group) =>
      (group.subcategories ?? []).map((subcategory) => ({
        slug: section.slug,
        group: group.slug,
        subcategory: subcategory.slug,
      })),
    ),
  );
}

function resolve(slug: string, groupSlug: string, subcategorySlug: string) {
  const section = getCategorySection(slug);
  const group = section?.groups.find((g) => g.slug === groupSlug);
  const subcategory = group?.subcategories?.find((s) => s.slug === subcategorySlug);
  return section && group && subcategory ? { section, group, subcategory } : null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { slug, group: groupSlug, subcategory: subcategorySlug } = await params;
  const match = resolve(slug, groupSlug, subcategorySlug);
  if (!match) {
    return { title: "Category" };
  }
  return listingMetadata({
    title: `${match.subcategory.name} | ${match.group.name} | ${match.section.name}`,
    description: `Shop ${match.subcategory.name.toLowerCase()} in ${match.group.name.toLowerCase()} at TRONIC Tanzania.`,
    basePath: listingBasePath(match.section, match.group, match.subcategory),
    searchParams: await searchParams,
  });
}

/** Subcategory listing inside a group. Unknown triples 404. */
export default async function CategorySubcategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<SearchParams>;
}) {
  const { slug, group: groupSlug, subcategory: subcategorySlug } = await params;
  const match = resolve(slug, groupSlug, subcategorySlug);
  if (!match) {
    notFound();
  }
  return (
    <CategoryListing
      section={match.section}
      group={match.group}
      subcategory={match.subcategory}
      searchParams={await searchParams}
    />
  );
}
