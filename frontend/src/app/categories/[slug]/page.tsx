import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORY_SECTIONS, getCategorySection } from "@tronic/country-config";
import { CategoryListing, listingBasePath } from "@/components/catalog/CategoryListing";
import { listingMetadata } from "@/features/catalog/metadata";
import type { SearchParams } from "@/features/catalog/catalog";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return CATEGORY_SECTIONS.map((section) => ({ slug: section.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const section = getCategorySection(slug);
  if (!section) {
    return { title: "Category" };
  }
  return listingMetadata({
    title: section.name,
    description: `Shop ${section.name.toLowerCase()} at TRONIC Tanzania: ${section.groups.map((g) => g.name.toLowerCase()).join(", ")}.`,
    basePath: listingBasePath(section),
    searchParams: await searchParams,
  });
}

/** Department listing: every product in the section, with filters and sort. */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const section = getCategorySection(slug);
  if (!section) {
    notFound();
  }
  return <CategoryListing section={section} searchParams={await searchParams} />;
}
