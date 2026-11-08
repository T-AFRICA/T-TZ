import type { Metadata } from "next";
import { activeFilterCount, listingHref, parseListingFilters, type SearchParams } from "./catalog";

/**
 * Metadata for a listing page. The canonical URL keeps only the page number
 * so every filter and sort permutation points search engines at one address;
 * filtered views are additionally marked noindex (still crawlable) so the
 * index holds the unfiltered listings only.
 */
export function listingMetadata({
  title,
  description,
  basePath,
  searchParams,
}: {
  title: string;
  description: string;
  basePath: string;
  searchParams: SearchParams;
}): Metadata {
  const filters = parseListingFilters(searchParams);
  const filtered = activeFilterCount(filters) > 0 || filters.sort !== "newest";
  const canonical = listingHref(basePath, { page: filters.page });
  const pageTitle = filters.page > 1 ? `${title} – Page ${filters.page}` : title;
  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: { title: pageTitle, description, url: canonical },
  };
}
