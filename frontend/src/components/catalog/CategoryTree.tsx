"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type { CategorySection } from "@tronic/types";
import { ChevronDownIcon } from "@tronic/ui";
import { listingBasePath, listingHref, type ListingFilters } from "@/features/catalog/catalog";

/**
 * Expandable category tree for the listing sidebar: section > group >
 * subcategory, the same hierarchy as the mega-menu. The header names the
 * section and is its "All …" link; each group label links to the group and
 * its separate chevron expands or collapses the subcategories without
 * navigating. The active level and its ancestor are open on every render (so
 * they stay open after navigation or a refresh); a chevron toggle overrides
 * that until the active group changes, because the parent re-keys the tree
 * per group. Links carry the current brand, price, stock and sort filters and
 * reset the page.
 *
 * Active rows use a light red tint, red semibold text and a slim red bar at
 * the left; ancestors stay charcoal and medium weight so the path reads at a
 * glance. The thin vertical rule under a group is the hierarchy guide.
 */
export function CategoryTree({
  section,
  activeGroup,
  activeSubcategory,
  filters,
}: {
  section: CategorySection;
  activeGroup?: string;
  activeSubcategory?: string;
  filters: ListingFilters;
}) {
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const idBase = useId();
  const carried = { ...filters, page: 1 };
  const href = (path: string) => listingHref(path, carried);

  const isOpen = (slug: string) => toggled[slug] ?? slug === activeGroup;
  const toggle = (slug: string) => setToggled((prev) => ({ ...prev, [slug]: !isOpen(slug) }));

  const row = (state: "active" | "ancestor" | "idle", level: "group" | "sub") => {
    const base =
      "relative block min-w-0 flex-1 rounded-md px-2.5 py-2 leading-snug transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-action-red)] lg:py-[7px]";
    const size = level === "group" ? "text-sm" : "text-[13px]";
    if (state === "active") {
      return `${base} ${size} bg-[#fdecec] font-semibold text-[var(--color-action-red)] before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-0.5 before:rounded-full before:bg-[var(--color-action-red)]`;
    }
    if (state === "ancestor") {
      return `${base} ${size} font-medium text-[var(--text-primary)] hover:bg-[var(--surface-alt)] hover:text-[var(--color-action-red)]`;
    }
    return `${base} ${size} ${level === "group" ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"} hover:bg-[var(--surface-alt)] hover:text-[var(--color-action-red)]`;
  };

  const rootActive = !activeGroup;

  return (
    <nav aria-label={`${section.name} categories`}>
      <div className="border-b border-[var(--color-light-grey)]/70 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Categories</p>
        <Link
          href={href(listingBasePath(section))}
          aria-current={rootActive ? "page" : undefined}
          className={`mt-1 inline-block text-base font-bold leading-tight transition-colors ${
            rootActive ? "text-[var(--color-action-red)]" : "text-[var(--text-primary)] hover:text-[var(--color-action-red)]"
          }`}
          style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
        >
          <span className="sr-only">All </span>
          {section.name}
        </Link>
      </div>
      <ul className="mt-1.5 divide-y divide-[var(--color-off-white)]">
        {section.groups.map((group) => {
          const subcategories = group.subcategories ?? [];
          const open = subcategories.length > 0 && isOpen(group.slug);
          const groupState =
            activeGroup === group.slug ? (activeSubcategory ? "ancestor" : "active") : "idle";
          const panelId = `${idBase}-${group.slug}`;
          return (
            <li key={group.slug} className="py-0.5">
              <div className="flex items-center gap-0.5">
                <Link
                  href={href(listingBasePath(section, group))}
                  aria-current={groupState === "active" ? "page" : undefined}
                  className={row(groupState, "group")}
                >
                  {group.name}
                </Link>
                {subcategories.length > 0 ? (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    aria-label={`${open ? "Collapse" : "Expand"} ${group.name}`}
                    onClick={() => toggle(group.slug)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-alt)] hover:text-[var(--color-action-red)] focus-visible:outline-2 focus-visible:outline-[var(--color-action-red)] lg:h-7 lg:w-7"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid place-items-center transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                    >
                      <ChevronDownIcon size={14} />
                    </span>
                  </button>
                ) : null}
              </div>
              {subcategories.length > 0 ? (
                <div id={panelId} className="cat-tree-panel" data-open={open} inert={!open}>
                  <div className="min-h-0 overflow-hidden">
                    <ul className="mb-1.5 ml-3 mt-0.5 space-y-px border-l border-[var(--color-light-grey)] pl-1.5 lg:ml-3.5">
                      {subcategories.map((subcategory) => {
                        const active = activeSubcategory === subcategory.slug && activeGroup === group.slug;
                        return (
                          <li key={subcategory.slug}>
                            <Link
                              href={href(listingBasePath(section, group, subcategory))}
                              aria-current={active ? "page" : undefined}
                              className={row(active ? "active" : "idle", "sub")}
                            >
                              {subcategory.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
