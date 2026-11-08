import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORY_SECTIONS, getCategorySection } from "@tronic/country-config";
import { CategoryListing, listingBasePath } from "@/components/catalog/CategoryListing";
import { listingMetadata } from "@/features/catalog/metadata";
import type { SearchParams } from "@/features/catalog/catalog";

type Params = Promise<{ slug: string; group: string }>;

export function generateStaticParams() {
  return CATEGORY_SECTIONS.flatMap((section) =>
    section.groups.map((group) => ({ slug: section.slug, group: group.slug })),
  );
}

function resolve(slug: string, groupSlug: string) {
  const section = getCategorySection(slug);
  const group = section?.groups.find((g) => g.slug === groupSlug);
  return section && group ? { section, group } : null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { slug, group: groupSlug } = await params;
  const match = resolve(slug, groupSlug);
  if (!match) {
    return { title: "Category" };
  }
  return listingMetadata({
    title: `${match.group.name} | ${match.section.name}`,
    description: `Shop ${match.group.name.toLowerCase()} in ${match.section.name.toLowerCase()} at TRONIC Tanzania.`,
    basePath: listingBasePath(match.section, match.group),
    searchParams: await searchParams,
  });
}

/** Group (subcategory) listing inside a department. Unknown pairs 404. */
export default async function CategoryGroupPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<SearchParams>;
}) {
  const { slug, group: groupSlug } = await params;
  const match = resolve(slug, groupSlug);
  if (!match) {
    notFound();
  }
  return <CategoryListing section={match.section} group={match.group} searchParams={await searchParams} />;
}
