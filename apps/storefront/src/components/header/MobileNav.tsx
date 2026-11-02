"use client";

import { useRef } from "react";
import Link from "next/link";
import { CATEGORY_SECTIONS, METER_NAV_ITEM } from "@tronic/country-config";
import { HeartIcon, TruckIcon, UserIcon, VisuallyHidden } from "@tronic/ui";
import { CountrySelector } from "@/components/country/CountrySelector";
import { ACCOUNT_LINK, COMPANY_LINKS, TRACK_ORDER_LINK, WISHLIST_LINK } from "@/config/site";

/**
 * Mobile navigation drawer built on the native <dialog> element, which
 * provides focus containment and Escape handling for free. Categories render
 * as disclosure groups; the Meter link stays prominent (SRS FR-003).
 */
export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-[var(--surface-card)]"
        aria-label="Open menu"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        className="m-0 h-full max-h-none w-80 max-w-[85vw] bg-white p-0 backdrop:bg-black/40"
        aria-label="Site menu"
        onClick={(event) => {
          // Click on the backdrop (the dialog element itself) closes the drawer.
          if (event.target === dialogRef.current) {
            dialogRef.current?.close();
          }
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-light-grey)] p-4">
          <span className="font-bold">Menu</span>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-[var(--surface-card)]"
            aria-label="Close menu"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav aria-label="Product categories" className="overflow-y-auto p-2">
          <ul>
            <li>
              <Link
                href={METER_NAV_ITEM.href}
                onClick={() => dialogRef.current?.close()}
                className="block rounded px-3 py-2.5 font-semibold text-[var(--color-action-red)]"
              >
                {METER_NAV_ITEM.label}
                <VisuallyHidden> token service</VisuallyHidden>
              </Link>
            </li>
            {CATEGORY_SECTIONS.map((section) => (
              <li key={section.slug}>
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between rounded px-3 py-2.5 font-medium hover:bg-[var(--surface-card)]">
                    {section.name}
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      className="transition-transform group-open:rotate-180"
                    >
                      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </summary>
                  <ul className="pb-1 pl-3">
                    <li>
                      <Link
                        href={`/categories/${section.slug}`}
                        onClick={() => dialogRef.current?.close()}
                        className="block rounded px-3 py-2 text-sm font-medium"
                      >
                        All {section.name}
                      </Link>
                    </li>
                    {section.groups.map((group) => (
                      <li key={group.slug}>
                        <Link
                          href={`/categories/${section.slug}`}
                          onClick={() => dialogRef.current?.close()}
                          className="block rounded px-3 py-2 text-sm text-[var(--text-secondary)]"
                        >
                          {group.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-[var(--color-light-grey)] p-2">
          <ul>
            <li>
              <Link
                href={ACCOUNT_LINK.href}
                onClick={() => dialogRef.current?.close()}
                className="flex items-center gap-3 rounded px-3 py-2.5 font-medium hover:bg-[var(--surface-card)]"
              >
                <UserIcon size={20} className="text-[var(--color-action-red)]" />
                {ACCOUNT_LINK.label}
              </Link>
            </li>
            <li>
              <Link
                href={TRACK_ORDER_LINK.href}
                onClick={() => dialogRef.current?.close()}
                className="flex items-center gap-3 rounded px-3 py-2.5 font-medium hover:bg-[var(--surface-card)]"
              >
                <TruckIcon size={20} className="text-[var(--color-action-red)]" />
                {TRACK_ORDER_LINK.label}
              </Link>
            </li>
            <li>
              <Link
                href={WISHLIST_LINK.href}
                onClick={() => dialogRef.current?.close()}
                className="flex items-center gap-3 rounded px-3 py-2.5 font-medium hover:bg-[var(--surface-card)]"
              >
                <HeartIcon size={20} className="text-[var(--color-action-red)]" />
                {WISHLIST_LINK.label}
              </Link>
            </li>
          </ul>
          <div className="mt-1 px-1">
            <CountrySelector />
          </div>
        </div>
        <nav aria-label="Company" className="border-t border-[var(--color-light-grey)] p-2 pb-4">
          <ul>
            {COMPANY_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => dialogRef.current?.close()}
                  className="block rounded px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-card)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </div>
  );
}
