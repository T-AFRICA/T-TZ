"use client";

import { useEffect, useRef, useState } from "react";
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
 * The bar is rendered after the sticky header, not inside it (owner request
 * 2026-11-09): it scrolls away with the page and is visible again at the
 * top. z-30 keeps an open panel above page content and below the header;
 * the scroll margin keeps a focused item clear of the sticky header when
 * the keyboard brings the bar back into view.
 */
const HOVER_CLOSE_DELAY_MS = 160;
/** openSlug value of the company "More" menu (not a category slug). */
const COMPANY_MENU = "__company";

/** Icon before each company link (owner brief 2026-11-10), keyed by route. */
const COMPANY_ICONS: Record<(typeof COMPANY_LINKS)[number]["href"], (props: IconProps) => React.ReactElement> = {
  "/about": InfoIcon,
  "/locations": MapPinIcon,
  "/blog": NewspaperIcon,
  "/showrooms": StoreIcon,
};

/**
 * Splits a section name into two balanced lines at a word boundary, keeping
 * "&" at the end of the first line ("Switchgear &" / "Protection"). Used
 * only at 1024–1279px, where one-line labels (~1030px) do not fit; from
 * 1280px every label is on one line (owner request 2026-11-10). One-word
 * names stay on one line.
 */
export function splitNavLabel(name: string): [string, string] | [string] {
  // "&" stays with the word before it, so it always ends the first line.
  const words: string[] = [];
  for (const word of name.split(" ")) {
    if (word === "&" && words.length > 0) {
      words[words.length - 1] += " &";
    } else {
      words.push(word);
    }
  }
  let best: [string, string] | null = null;
  let bestLength = Number.POSITIVE_INFINITY;
  for (let i = 1; i < words.length; i += 1) {
    const first = words.slice(0, i).join(" ");
    const second = words.slice(i).join(" ");
    const longest = Math.max(first.length, second.length);
    if (longest < bestLength) {
      best = [first, second];
      bestLength = longest;
    }
  }
  return best ?? [name];
}

export function Navbar() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | null>(null);
  /** Section whose panel was opened by mouse hover — its next click keeps it open. */
  const hoverOpenedSlug = useRef<string | null>(null);

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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenSlug(null);
      }
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

  const openSection = CATEGORY_SECTIONS.find((section) => section.slug === openSlug);
  const companyOpen = openSlug === COMPANY_MENU;

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
      <Container className="flex items-stretch justify-between gap-3">
        {/* Categories (left) and company links (right) are separate flex
            items: the categories take the free space (min-w-0), the company
            group never shrinks, so the two can never overlap. Labels are on
            one line from 1280px (tighter padding and tracking up to 1679px)
            and on two lines at 1024–1279px. If a larger default font still
            does not fit, the list wraps onto a second row — nothing is
            scrolled out of sight or clipped. Centered at lg, where the
            company links are not shown; left-aligned from xl. */}
        <div className="min-w-0 flex-1">
          <ul className="flex flex-wrap items-stretch justify-center xl:justify-start">
          {CATEGORY_SECTIONS.map((section) => {
            const isOpen = section.slug === openSlug;
            const [firstLine, secondLine] = splitNavLabel(section.name);
            return (
              <li key={section.slug} className="flex shrink-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? "navbar-mega-panel" : undefined}
                  onClick={() => {
                    // A click right after hover-open must not instantly close
                    // the panel; later clicks (keyboard, touch re-tap, second
                    // mouse click) toggle it closed as before.
                    if (isOpen && hoverOpenedSlug.current !== section.slug) {
                      setOpenSlug(null);
                    } else {
                      hoverOpenedSlug.current = null;
                      setOpenSlug(section.slug);
                    }
                  }}
                  onPointerEnter={(event) => {
                    // Hover opens for mouse only; touch taps go through onClick.
                    if (event.pointerType === "mouse") {
                      cancelScheduledClose();
                      hoverOpenedSlug.current = section.slug;
                      setOpenSlug(section.slug);
                    }
                  }}
                  className={`flex min-h-10 items-center gap-1 whitespace-nowrap px-2.5 py-1.5 text-left text-xs font-semibold uppercase leading-tight tracking-[0.04em] transition-colors duration-150 xl:gap-0.5 xl:px-1.5 xl:py-3 xl:tracking-[0.02em] 3xl:gap-1 3xl:px-2 3xl:tracking-[0.04em] ${
                    isOpen
                      ? "bg-white text-[var(--color-action-red)]"
                      : "text-white hover:bg-white hover:text-[var(--color-action-red)]"
                  }`}
                >
                  <span>
                    {firstLine}
                    {secondLine ? (
                      <>
                        {" "}
                        <br className="xl:hidden" />
                        {secondLine}
                      </>
                    ) : null}
                  </span>
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
        {/* Company links (owner request Nov 2026), set apart from the
            categories by a divider. 1280–1679px: one "More" button opens
            them as a small menu, so the eight sections fit on one line
            (owner choice 2026-11-10). From 1680px: the four links sit in
            the bar, icon before label. Below xl there is no room at all;
            the footer lists them there. */}
        <nav
          aria-label="Company"
          className="relative hidden shrink-0 items-stretch border-l border-white/30 pl-2 xl:flex 3xl:hidden"
        >
          <button
            type="button"
            aria-expanded={companyOpen}
            aria-controls={companyOpen ? "navbar-company-menu" : undefined}
            onClick={() => {
              if (companyOpen && hoverOpenedSlug.current !== COMPANY_MENU) {
                setOpenSlug(null);
              } else {
                hoverOpenedSlug.current = null;
                setOpenSlug(COMPANY_MENU);
              }
            }}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") {
                cancelScheduledClose();
                hoverOpenedSlug.current = COMPANY_MENU;
                setOpenSlug(COMPANY_MENU);
              }
            }}
            className={`flex items-center gap-0.5 whitespace-nowrap px-2 text-xs font-semibold uppercase tracking-[0.02em] transition-colors duration-150 ${
              companyOpen
                ? "bg-white text-[var(--color-action-red)]"
                : "text-white hover:bg-white hover:text-[var(--color-action-red)]"
            }`}
          >
            More
            <ChevronDownIcon
              size={13}
              className={`shrink-0 opacity-80 transition-transform ${companyOpen ? "rotate-180" : ""}`}
            />
          </button>
          {companyOpen ? (
            <ul
              id="navbar-company-menu"
              className="mega-panel-in absolute right-0 top-full w-60 rounded-b-xl border-t-2 border-[var(--color-action-red)] bg-white py-2 text-[var(--text-primary)] shadow-xl"
            >
              {COMPANY_LINKS.map((link) => {
                const Icon = COMPANY_ICONS[link.href];
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpenSlug(null)}
                      className="group flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--color-action-red)] focus-visible:bg-[var(--surface-card)] focus-visible:text-[var(--color-action-red)] focus-visible:outline-none"
                    >
                      <Icon size={16} className="shrink-0 text-[var(--color-action-red)]" />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </nav>
        <nav
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
