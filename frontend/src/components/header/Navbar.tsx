"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  Container,
  InfoIcon,
  MapPinIcon,
  NewspaperIcon,
  StoreIcon,
  type IconProps,
} from "@tronic/ui";
import { COMPANY_LINKS } from "@/config/site";

/**
 * Desktop navigation: a solid action-red bar with the eight approved category
 * sections as disclosure buttons opening a mega-menu panel of their groups
 * and, under each group, its subcategories (SRS FR-002; Website Content
 * Structure 2026-11-09). Mouse users get hover-open with a short close delay (owner
 * request Nov 2026); click, touch and keyboard behavior are unchanged, so
 * the menu is never hover-only. Escape closes an open panel; each panel is
 * a labelled region of plain links.
 *
 * Every label is on one line (owner brief 2026-11-12). The bar measures the
 * labels in the font actually rendered (Myriad Pro, or Arial before it
 * loads), at the current width and zoom, and shows as many sections as fit;
 * the rest move, in order, into the "More" menu, where each opens its usual
 * panel. From 1280px to 1679px that menu also holds the company links.
 *
 * The bar is rendered after the sticky header, not inside it (owner request
 * 2026-11-09): it scrolls away with the page and is visible again at the
 * top. z-30 keeps an open panel above page content and below the header;
 * the scroll margin keeps a focused item clear of the sticky header when
 * the keyboard brings the bar back into view.
 */
const HOVER_CLOSE_DELAY_MS = 160;
/** openSlug value of the "More" menu (not a category slug). */
const MORE_MENU = "__more";
/** Tailwind xl up to 3xl: the company links live in the More menu. */
const COMPANY_IN_MORE_QUERY = "(min-width: 80rem) and (max-width: 104.99rem)";

/** Icon before each company link (owner brief 2026-11-10), keyed by route. */
const COMPANY_ICONS: Record<(typeof COMPANY_LINKS)[number]["href"], (props: IconProps) => React.ReactElement> = {
  "/about": InfoIcon,
  "/locations": MapPinIcon,
  "/blog": NewspaperIcon,
  "/showrooms": StoreIcon,
};

/** Shared by the bar and its hidden ruler, so measured widths match. */
const SECTION_ITEM =
  "flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap px-2 text-xs font-semibold uppercase leading-[1.2] tracking-[0.03em] min-[85rem]:px-2.5 min-[85rem]:text-[13px]";
const MORE_GROUP = "relative flex shrink-0 items-stretch border-l border-white/30 pl-2";
const MORE_ITEM =
  "flex items-center gap-1 whitespace-nowrap px-2 text-xs font-semibold uppercase leading-[1.2] tracking-[0.03em] min-[85rem]:text-[13px]";
const MENU_LINK =
  "group flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--color-action-red)] focus-visible:bg-[var(--surface-card)] focus-visible:text-[var(--color-action-red)] focus-visible:outline-none";

/**
 * How many sections fit, in order, in `available` px. All of them if they
 * fit (next to the More group when it is shown anyway); otherwise as many
 * as fit beside the More group, which then takes the rest.
 */
export function fitCount(
  widths: readonly number[],
  available: number,
  moreSpace: number,
  moreAlwaysShown: boolean,
): number {
  const tolerance = 0.5;
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total + (moreAlwaysShown ? moreSpace : 0) <= available + tolerance) {
    return widths.length;
  }
  const room = available - moreSpace + tolerance;
  let used = 0;
  let count = 0;
  for (const width of widths) {
    if (used + width > room) break;
    used += width;
    count += 1;
  }
  return count;
}

export function Navbar() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(CATEGORY_SECTIONS.length);
  const [measured, setMeasured] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const companyBarRef = useRef<HTMLElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const panelLinkRef = useRef<HTMLAnchorElement>(null);
  const closeTimer = useRef<number | null>(null);
  /** Section whose panel was opened by mouse hover — its next click keeps it open. */
  const hoverOpenedSlug = useRef<string | null>(null);
  /** Set when a section opens from the More menu: focus moves into its panel. */
  const focusPanelOnOpen = useRef(false);
  /** Mirrors openSlug for the document-level Escape handler. */
  const openSlugRef = useRef<string | null>(null);

  function cancelScheduledClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelScheduledClose();
    closeTimer.current = window.setTimeout(() => setOpenSlug(null), HOVER_CLOSE_DELAY_MS);
  }

  const measure = useCallback(() => {
    const row = navRef.current?.querySelector<HTMLElement>("[data-nav-row]");
    const ruler = rulerRef.current;
    if (!row || !ruler) return;
    const rowStyle = getComputedStyle(row);
    const gap = parseFloat(rowStyle.columnGap) || 0;
    let available =
      row.clientWidth - (parseFloat(rowStyle.paddingLeft) || 0) - (parseFloat(rowStyle.paddingRight) || 0);
    // 1680px and up: the company links sit in the bar beside the sections.
    const companyBar = companyBarRef.current;
    if (companyBar && companyBar.offsetWidth > 0) {
      available -= companyBar.offsetWidth + gap;
    }
    const widths = [...ruler.querySelectorAll<HTMLElement>("[data-ruler-section]")].map(
      (element) => element.getBoundingClientRect().width,
    );
    const moreWidth = ruler.querySelector<HTMLElement>("[data-ruler-more]")?.getBoundingClientRect().width ?? 0;
    const companyInMore =
      typeof window.matchMedia === "function" && window.matchMedia(COMPANY_IN_MORE_QUERY).matches;
    setVisibleCount(fitCount(widths, available, moreWidth + gap, companyInMore));
    setMeasured(true);
  }, []);

  // Before paint, then again whenever the bar's width changes (window
  // resize, zoom, breakpoint) or a web font finishes loading.
  useLayoutEffect(() => {
    measure();
    const row = navRef.current?.querySelector<HTMLElement>("[data-nav-row]");
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => measure()) : null;
    if (row && observer) observer.observe(row);
    // Absent in jsdom.
    const fonts: FontFaceSet | undefined = document.fonts;
    fonts?.addEventListener("loadingdone", measure);
    void fonts?.ready.then(measure);
    return () => {
      observer?.disconnect();
      fonts?.removeEventListener("loadingdone", measure);
    };
  }, [measure]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Focus inside the closing panel goes back to what opened it.
      const panel = document.getElementById("navbar-mega-panel");
      if (panel?.contains(document.activeElement)) {
        const trigger = navRef.current?.querySelector<HTMLElement>(
          `[data-section-trigger="${openSlugRef.current ?? ""}"]`,
        );
        (trigger ?? moreButtonRef.current)?.focus();
      }
      setOpenSlug(null);
    }
    function onPointerDown(event: PointerEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenSlug(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    openSlugRef.current = openSlug;
    if (focusPanelOnOpen.current && openSlug) {
      focusPanelOnOpen.current = false;
      panelLinkRef.current?.focus();
    }
  }, [openSlug]);

  const visibleSections = CATEGORY_SECTIONS.slice(0, visibleCount);
  const overflowSections = CATEGORY_SECTIONS.slice(visibleCount);
  const openSection = CATEGORY_SECTIONS.find((section) => section.slug === openSlug);
  const moreOpen = openSlug === MORE_MENU;
  const moreActive = moreOpen || overflowSections.some((section) => section.slug === openSlug);

  function toggle(slug: string, isOpen: boolean) {
    // A click right after hover-open must not instantly close the panel;
    // later clicks (keyboard, touch re-tap, second mouse click) toggle it
    // closed as before.
    if (isOpen && hoverOpenedSlug.current !== slug) {
      setOpenSlug(null);
    } else {
      hoverOpenedSlug.current = null;
      setOpenSlug(slug);
    }
  }

  function hoverOpen(event: React.PointerEvent, slug: string) {
    // Hover opens for mouse only; touch taps go through onClick.
    if (event.pointerType === "mouse") {
      cancelScheduledClose();
      hoverOpenedSlug.current = slug;
      setOpenSlug(slug);
    }
  }

  return (
    <nav
      ref={navRef}
      aria-label="Product categories"
      className="relative z-30 hidden bg-[var(--color-action-red)] shadow-sm lg:block [&_a]:scroll-mt-[calc(var(--header-height)_+_0.5rem)] [&_button]:scroll-mt-[calc(var(--header-height)_+_0.5rem)]"
      onPointerEnter={cancelScheduledClose}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          scheduleClose();
        }
      }}
    >
      {/* Ruler: every section and the More group in the bar's own styles,
          invisible and out of the layout, so the bar can measure what fits
          even for sections it currently shows in the More menu. */}
      <div ref={rulerRef} aria-hidden="true" className="invisible absolute left-0 top-0 flex h-0 w-max overflow-hidden">
        {CATEGORY_SECTIONS.map((section) => (
          <span key={section.slug} data-ruler-section className={SECTION_ITEM}>
            {section.name}
            <ChevronDownIcon size={13} className="shrink-0" />
          </span>
        ))}
        <span data-ruler-more className={MORE_GROUP}>
          <span className={MORE_ITEM}>
            More
            <ChevronDownIcon size={13} className="shrink-0" />
          </span>
        </span>
      </div>

      <Container data-nav-row className="flex items-stretch justify-between gap-3">
        {/* Until the first measurement (before hydration) the row is clipped
            rather than wrapped or scrolled; after it, everything shown fits. */}
        <div className={`min-w-0 flex-1 ${measured ? "" : "overflow-hidden"}`}>
          <ul className="flex flex-nowrap items-stretch">
            {visibleSections.map((section) => {
              const isOpen = section.slug === openSlug;
              return (
                <li key={section.slug} className="flex shrink-0">
                  <button
                    type="button"
                    data-section-trigger={section.slug}
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? "navbar-mega-panel" : undefined}
                    onClick={() => toggle(section.slug, isOpen)}
                    onPointerEnter={(event) => hoverOpen(event, section.slug)}
                    className={`${SECTION_ITEM} transition-colors duration-150 ${
                      isOpen
                        ? "bg-white text-[var(--color-action-red)]"
                        : "text-white hover:bg-white hover:text-[var(--color-action-red)]"
                    }`}
                  >
                    {section.name}
                    <ChevronDownIcon
                      size={13}
                      className={`shrink-0 opacity-80 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* More: sections that do not fit, then (1280–1679px) the company
            links (owner choice 2026-11-10). Below 1280px with every section
            showing there is nothing to put in it; the footer lists the
            company links there. */}
        <div className={`${MORE_GROUP} ${overflowSections.length > 0 ? "" : "hidden xl:flex 3xl:hidden"}`}>
          <button
            ref={moreButtonRef}
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreOpen ? "navbar-more-menu" : undefined}
            onClick={() => toggle(MORE_MENU, moreOpen)}
            onPointerEnter={(event) => hoverOpen(event, MORE_MENU)}
            className={`${MORE_ITEM} transition-colors duration-150 ${
              moreActive
                ? "bg-white text-[var(--color-action-red)]"
                : "text-white hover:bg-white hover:text-[var(--color-action-red)]"
            }`}
          >
            More
            <ChevronDownIcon
              size={13}
              className={`shrink-0 opacity-80 transition-transform ${moreOpen ? "rotate-180" : ""}`}
            />
          </button>
          {moreOpen ? (
            <div
              id="navbar-more-menu"
              className="mega-panel-in absolute right-0 top-full w-64 rounded-b-xl border-t-2 border-[var(--color-action-red)] bg-white py-2 text-[var(--text-primary)] shadow-xl"
            >
              {overflowSections.length > 0 ? (
                <ul aria-label="More categories">
                  {overflowSections.map((section) => (
                    <li key={section.slug}>
                      <button
                        type="button"
                        onClick={() => {
                          hoverOpenedSlug.current = null;
                          focusPanelOnOpen.current = true;
                          setOpenSlug(section.slug);
                        }}
                        className={MENU_LINK}
                      >
                        <span className="flex-1">{section.name}</span>
                        <ArrowRightIcon size={15} className="shrink-0 text-[var(--color-action-red)]" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul
                aria-label="Company"
                className={`hidden xl:block 3xl:hidden ${
                  overflowSections.length > 0 ? "mt-2 border-t border-[var(--color-light-grey)] pt-2" : ""
                }`}
              >
                {COMPANY_LINKS.map((link) => {
                  const Icon = COMPANY_ICONS[link.href];
                  return (
                    <li key={link.href}>
                      <Link href={link.href} onClick={() => setOpenSlug(null)} className={MENU_LINK}>
                        <Icon size={16} className="shrink-0 text-[var(--color-action-red)]" />
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <nav
          ref={companyBarRef}
          aria-label="Company"
          className="hidden shrink-0 items-center border-l border-white/30 pl-3 3xl:flex"
        >
          <ul className="flex items-center gap-5">
            {COMPANY_LINKS.map((link) => {
              const Icon = COMPANY_ICONS[link.href];
              return (
                <li key={link.href} className="flex">
                  <Link
                    href={link.href}
                    className="group flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-sm text-[11px] font-medium uppercase tracking-[0.04em] text-white/85 transition-colors duration-150 hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <Icon
                      size={14}
                      className="shrink-0 opacity-80 transition-[opacity,transform] duration-150 group-hover:-translate-y-px group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
                    />
                    <span className="underline-offset-4 decoration-white/70 group-hover:underline">
                      {link.navLabel}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Container>
      {openSection ? (
        <div
          id="navbar-mega-panel"
          role="region"
          aria-label={`${openSection.name} groups`}
          className="mega-panel-in absolute left-0 right-0 top-full max-h-[calc(100vh-7.75rem)] overflow-y-auto border-b-2 border-[var(--color-action-red)] bg-white text-[var(--text-primary)] shadow-xl"
        >
          <Container className="py-6">
            <div className="flex items-baseline justify-between">
              <Link
                ref={panelLinkRef}
                href={`/categories/${openSection.slug}`}
                className="inline-flex items-center gap-1.5 font-bold text-[var(--color-action-red)] hover:underline"
                onClick={() => setOpenSlug(null)}
              >
                All {openSection.name}
                <ArrowRightIcon size={16} />
              </Link>
            </div>
            {/* One column per group: the group link as heading, its subcategories
                beneath. Groups without subcategories (Tools, Shop by Use) are
                plain links. */}
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
              {openSection.groups.map((group) => (
                <li key={group.slug} className="min-w-0">
                  <Link
                    href={`/categories/${openSection.slug}/${group.slug}`}
                    className="block rounded px-2 py-1 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-card)] hover:text-[var(--color-action-red)]"
                    onClick={() => setOpenSlug(null)}
                  >
                    {group.name}
                  </Link>
                  {group.subcategories?.length ? (
                    <ul className="mt-1 border-l border-[var(--color-light-grey)]">
                      {group.subcategories.map((subcategory) => (
                        <li key={subcategory.slug}>
                          <Link
                            href={`/categories/${openSection.slug}/${group.slug}/${subcategory.slug}`}
                            className="block rounded-r px-3 py-1 text-[13px] leading-snug text-[var(--text-secondary)] hover:bg-[var(--surface-card)] hover:text-[var(--color-action-red)]"
                            onClick={() => setOpenSlug(null)}
                          >
                            {subcategory.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </Container>
        </div>
      ) : null}
    </nav>
  );
}
