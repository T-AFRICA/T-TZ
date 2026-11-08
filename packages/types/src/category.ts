/**
 * Category taxonomy contract (SRS FR-002, §7).
 *
 * The storefront navbar renders exactly the eight source-defined sections plus
 * the dedicated Meter item. The hierarchy is configuration, not code: category
 * pages built in later weeks consume these same types.
 */
export interface CategoryGroup {
  /** URL-safe identifier, unique within its section. */
  slug: string;
  /** Display name, e.g. "Power Cables". */
  name: string;
}

export interface CategorySection {
  /** URL-safe identifier, unique across sections. Route: /categories/[slug]. */
  slug: string;
  /** Display name, e.g. "Cables & Wiring". */
  name: string;
  /** One line under the name on homepage banners and listing headers. */
  description?: string;
  /**
   * "department" (default) owns products through its groups. "use-case"
   * (Shop by Use) collects products from every department by who they are
   * for: its groups are use cases and products reference them in
   * `useCases`, so no product is duplicated into a second category.
   */
  kind?: "department" | "use-case";
  /** Second-level groups shown in the mega-menu and on the category page. */
  groups: CategoryGroup[];
}

/** A standalone navigation link (e.g. the Meter item, footer links). */
export interface NavLink {
  href: string;
  label: string;
}
