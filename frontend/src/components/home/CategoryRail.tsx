"use client";

import Link from "next/link";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { CategoryArt } from "./CategoryArt";

/** One category circle in the rail under the hero. The looping copy of the rail
    stays clickable but is skipped by the keyboard. */
function CategoryCircle({
  section,
  isLoopCopy = false,
}: {
  section: (typeof CATEGORY_SECTIONS)[number];
  isLoopCopy?: boolean;
}) {
  return (
    <Link
      href={`/categories/${section.slug}`}
      tabIndex={isLoopCopy ? -1 : undefined}
      className="group flex flex-col items-center gap-1.5 text-center md:gap-2.5"
    >
      {/* Phones: white on the off-white page. md+: a soft grey surface on the
          white page that turns white with a red ring on hover (design pass
          2026-11-12). */}
      <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-[var(--color-dark-grey)] shadow-[0_3px_10px_rgba(17,17,17,0.08)] transition-all duration-200 group-hover:scale-105 group-hover:text-[var(--color-action-red)] group-active:scale-105 group-active:text-[var(--color-action-red)] md:h-24 md:w-24 md:bg-[#f4f4f5] md:shadow-[inset_0_0_0_1px_rgba(17,17,17,0.04)] md:group-hover:bg-white md:group-hover:shadow-[0_0_0_2px_var(--color-action-red),0_12px_24px_-10px_rgba(215,25,32,0.45)]">
        <span className="md:scale-125">
          <CategoryArt slug={section.slug} size={30} />
        </span>
      </span>
      <span className="text-[11px] font-medium leading-tight text-[var(--text-primary)] md:text-[13px]">
        {section.name}
      </span>
    </Link>
  );
}

/**
 * Category icon rail directly under the hero (restored 2026-11-12, owner
 * request; first added 2026-11-05, removed 2026-11-07 for the photographic
 * banners). News-ticker motion (owner request 2026-11-06): it moves slowly
 * right to left on every screen size, pure CSS (globals.css, "Category
 * ticker"). The loop needs a second copy, hidden from assistive tech. Each
 * copy is wider than the screen, so a category is never on screen twice
 * (owner request 2026-11-05). Hover, touch and keyboard focus pause it;
 * reduced motion shows one still, swipeable row.
 *
 * A keyboard-focused category is scrolled fully into view: browsers only
 * scroll on focus when the element is entirely hidden, which would leave a
 * half-visible category behind the screen edge.
 */
export function CategoryRail() {
  return (
    <nav
      aria-label="Shop by category"
      className="category-rail-frame -mx-[var(--gutter)] max-md:mb-3"
      onFocus={(event) => {
        if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) {
          event.target.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      }}
    >
      <div className="category-rail flex w-max items-start pt-1 pb-1 md:pb-2">
        <ul className="category-rail-group">
          {CATEGORY_SECTIONS.map((section) => (
            <li key={section.slug} className="w-[4.5rem] shrink-0 md:w-28">
              <CategoryCircle section={section} />
            </li>
          ))}
        </ul>
        <ul aria-hidden="true" className="category-rail-group category-rail-copy">
          {CATEGORY_SECTIONS.map((section) => (
            <li key={section.slug} className="w-[4.5rem] shrink-0 md:w-28">
              <CategoryCircle section={section} isLoopCopy />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
