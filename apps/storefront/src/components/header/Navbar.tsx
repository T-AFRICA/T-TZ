"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { ArrowRightIcon, ChevronDownIcon, Container } from "@tronic/ui";

/**
 * Desktop navigation: a solid action-red bar with the eight approved category
 * sections as disclosure buttons opening a mega-menu panel of their groups
 * (SRS FR-002). The dedicated Meter link (FR-003) lives in the main header
 * row next to Track Order. Keyboard: Escape closes an open panel; each panel
 * is a labelled region of plain links.
 */
export function Navbar() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

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
    };
  }, []);

  const openSection = CATEGORY_SECTIONS.find((section) => section.slug === openSlug);

  return (
    <nav
      ref={navRef}
      aria-label="Product categories"
      className="relative hidden bg-[var(--color-action-red)] lg:block"
    >
      <Container>
        <ul className="flex items-stretch">
          {CATEGORY_SECTIONS.map((section) => {
            const isOpen = section.slug === openSlug;
            return (
              <li key={section.slug} className="flex flex-1">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? "navbar-mega-panel" : undefined}
                  onClick={() => setOpenSlug(isOpen ? null : section.slug)}
                  className={`flex w-full items-center justify-center gap-1.5 px-2 py-3 text-center text-[13px] font-semibold leading-tight text-white transition-colors hover:bg-[var(--color-action-red-dark)] xl:text-sm 2xl:whitespace-nowrap ${
                    isOpen ? "bg-[var(--color-action-red-dark)]" : ""
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
      </Container>
      {openSection ? (
        <div
          id="navbar-mega-panel"
          role="region"
          aria-label={`${openSection.name} groups`}
          className="absolute left-0 right-0 top-full border-b-2 border-[var(--color-action-red)] bg-white text-[var(--text-primary)] shadow-xl"
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
