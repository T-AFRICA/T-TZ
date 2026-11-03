"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { ArrowRightIcon, ChevronDownIcon, Container } from "@tronic/ui";
import { COMPANY_LINKS } from "@/config/site";

/**
 * Desktop navigation: a solid action-red bar with the eight approved category
 * sections as disclosure buttons opening a mega-menu panel of their groups
 * (SRS FR-002). Mouse users get hover-open with a short close delay (owner
 * request Nov 2026); click, touch and keyboard behavior are unchanged, so
 * the menu is never hover-only. Escape closes an open panel; each panel is
 * a labelled region of plain links.
 */
const HOVER_CLOSE_DELAY_MS = 160;

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

  return (
    <nav
      ref={navRef}
      aria-label="Product categories"
      className="relative hidden bg-[var(--color-action-red)] lg:block"
      onPointerEnter={cancelScheduledClose}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          scheduleClose();
        }
      }}
    >
      <Container className="flex items-stretch justify-between gap-2">
        {/* Natural-width items on one line — no flex-1 stretching, no label
            wrapping. w-max + mx-auto centers the group when it fits and
            scrolls from the left edge (never clipping) when it does not;
            from xl the group sits left of the company links. */}
        <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
          <ul className="mx-auto flex w-max items-stretch xl:mx-0">
          {CATEGORY_SECTIONS.map((section) => {
            const isOpen = section.slug === openSlug;
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
                  className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-3 text-xs font-semibold transition-colors duration-150 xl:px-2 2xl:gap-1.5 2xl:px-4 2xl:text-sm ${
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
        {/* Company links (owner request Nov 2026): moved here from the old
            utility row; compact labels, full names stay in the footer. */}
        <nav aria-label="Company" className="hidden shrink-0 items-center xl:flex">
          <ul className="flex items-center gap-3 2xl:gap-4">
            {COMPANY_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="whitespace-nowrap text-xs font-medium text-white/80 transition-colors hover:text-white"
                >
                  {link.navLabel}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      {openSection ? (
        <div
          id="navbar-mega-panel"
          role="region"
          aria-label={`${openSection.name} groups`}
          className="mega-panel-in absolute left-0 right-0 top-full border-b-2 border-[var(--color-action-red)] bg-white text-[var(--text-primary)] shadow-xl"
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
            <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {openSection.groups.map((group) => (
                <li key={group.slug}>
                  <Link
                    href={`/categories/${openSection.slug}`}
                    className="block rounded px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-card)] hover:text-[var(--color-action-red)]"
                    onClick={() => setOpenSlug(null)}
                  >
                    {group.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </div>
      ) : null}
    </nav>
  );
}
