"use client";

import { useRef } from "react";
import Link from "next/link";
import { CATEGORY_SECTIONS, METER_NAV_ITEM } from "@tronic/country-config";
import { BrandMark, HeartIcon, MeterIcon, ShieldCheckIcon, TruckIcon, UserIcon } from "@tronic/ui";
import { CountrySelector } from "@/components/country/CountrySelector";
import { CategoryArt } from "@/components/home/CategoryArt";
import { ACCOUNT_LINK, CHECK_WARRANTY_LINK, TRACK_ORDER_LINK, WISHLIST_LINK } from "@/config/site";

/**
 * Mobile navigation drawer built on the native <dialog> element, which
 * provides focus containment and Escape handling for free. Premium app
 * styling (owner iterations, Nov 2026): off-white canvas with white cards,
 * per-category icon chips, slide-in motion (reduced-motion safe via the
 * global override). Order per owner: categories, Meter Token Issuer,
 * Track Order, Check Warranty, Wishlist, country, red Login last; company
 * links live in the footer.
 */
export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:bg-[var(--surface-card)] md:bg-transparent md:shadow-none"
        aria-label="Open menu"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        className="mobile-drawer m-0 h-full max-h-none w-[85vw] max-w-[22rem] overflow-y-auto rounded-r-2xl bg-[var(--color-off-white)] p-0 backdrop:bg-black/50"
        aria-label="Site menu"
        onClick={(event) => {
          // Click on the backdrop (the dialog element itself) closes the drawer.
          if (event.target === dialogRef.current) {
            close();
          }
        }}
      >
        <div className="flex items-center justify-between bg-white p-4 shadow-sm">
          <BrandMark tone="light" />
          <button
            type="button"
            onClick={close}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-card)] transition-colors hover:bg-[var(--color-light-grey)]"
            aria-label="Close menu"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav aria-label="Product categories" className="p-3">
          <h2 className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Categories
          </h2>
          <ul className="overflow-hidden rounded-2xl bg-white shadow-[0_3px_14px_rgba(17,17,17,0.06)]">
            {CATEGORY_SECTIONS.map((section) => (
              <li key={section.slug} className="border-b border-[var(--color-off-white)] last:border-b-0">
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-3 px-3 py-2.5 font-medium hover:bg-[var(--surface-alt)]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fdecec] text-[var(--color-action-red)]">
                      <CategoryArt slug={section.slug} size={20} />
                    </span>
                    <span className="flex-1 text-sm">{section.name}</span>
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      className="text-[var(--text-muted)] transition-transform group-open:rotate-180"
                    >
                      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </summary>
                  <ul className="bg-[var(--surface-alt)] py-1 pl-14 pr-3">
                    <li>
                      <Link
                        href={`/categories/${section.slug}`}
                        onClick={close}
                        className="block rounded py-2 text-sm font-semibold text-[var(--color-action-red)]"
                      >
                        All {section.name}
                      </Link>
                    </li>
                    {section.groups.map((group) => (
                      <li key={group.slug}>
                        <Link
                          href={`/categories/${section.slug}`}
                          onClick={close}
                          className="block rounded py-2 text-sm text-[var(--text-secondary)]"
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

        <nav aria-label="Quick links" className="px-3 pb-3">
          <h2 className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Quick links
          </h2>
          <ul className="overflow-hidden rounded-2xl bg-white shadow-[0_3px_14px_rgba(17,17,17,0.06)]">
            {[
              { ...METER_NAV_ITEM, icon: MeterIcon },
              { ...TRACK_ORDER_LINK, icon: TruckIcon },
              { ...CHECK_WARRANTY_LINK, icon: ShieldCheckIcon },
              { ...WISHLIST_LINK, icon: HeartIcon },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href} className="border-b border-[var(--color-off-white)] last:border-b-0">
                  <Link
                    href={item.href}
                    onClick={close}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-[var(--surface-alt)]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fdecec] text-[var(--color-action-red)]">
                      <Icon size={18} />
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-3 pb-5">
          <div className="rounded-2xl bg-white p-3 shadow-[0_3px_14px_rgba(17,17,17,0.06)]">
            <CountrySelector />
            <Link
              href={ACCOUNT_LINK.href}
              onClick={close}
              className="mt-3 flex items-center justify-center gap-2 rounded-full bg-[var(--color-action-red)] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)]"
            >
              <UserIcon size={18} />
              {ACCOUNT_LINK.label}
            </Link>
          </div>
        </div>
      </dialog>
    </div>
  );
}
