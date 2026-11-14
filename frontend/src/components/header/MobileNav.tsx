"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORY_SECTIONS, METER_NAV_ITEM } from "@tronic/country-config";
import { BrandMark, HeartIcon, MeterIcon, ShieldCheckIcon, TruckIcon, UserIcon } from "@tronic/ui";
import { CountrySelector } from "@/components/country/CountrySelector";
import { CategoryArt } from "@/components/home/CategoryArt";
import { ACCOUNT_LINK, CHECK_WARRANTY_LINK, SIGNED_IN_ACCOUNT_LINK, TRACK_ORDER_LINK, WISHLIST_LINK } from "@/config/site";
import { useSignedInHint } from "@/features/auth/sessionHint";

/**
 * Mobile navigation drawer built on the native <dialog> element, which
 * provides focus containment and Escape handling for free. Premium app
 * styling (owner iterations, Nov 2026): off-white canvas with white cards,
 * per-category icon chips. Order per owner: categories, Meter Token Issuer,
 * Track Order, Check Warranty, Wishlist, country, red Login (Account for a
 * signed-in customer) last; company
 * links live in the footer.
 *
 * Motion (owner request 2026-11-08): the panel slides in over 400ms with the
 * backdrop fading and blurring, the contents reveal in document order (each
 * carries a --i stagger index for globals.css), and closing plays the slide
 * back before the dialog really closes: close() marks the dialog
 * data-closing, waits for the drawer-out animation to end, then calls
 * dialog.close(). Escape, the X button, a backdrop tap and a leftward swipe
 * all go through that path. Reduced motion skips every animation and closes
 * at once.
 */
export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const pathname = usePathname();
  const accountLink = useSignedInHint() ? SIGNED_IN_ACCOUNT_LINK : ACCOUNT_LINK;

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || !dialog.open || dialog.dataset.closing !== undefined) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.close();
      return;
    }
    dialog.dataset.closing = "";
    let done = false;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      dialog.removeEventListener("animationend", onEnd);
      delete dialog.dataset.closing;
      dialog.close();
    };
    const onEnd = (event: AnimationEvent) => {
      if (event.target === dialog) {
        finish();
      }
    };
    dialog.addEventListener("animationend", onEnd);
    // Safety net if the animation never fires (for example in a hidden tab).
    window.setTimeout(finish, 400);
  }, []);

  // Escape would close the dialog instantly; route it through the animated close.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const onCancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [close]);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch) {
      return;
    }
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // A clear leftward swipe closes the drawer; vertical scrolling does not.
    if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      close();
    }
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
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={(event) => {
          // Click on the backdrop (the dialog element itself) closes the drawer.
          if (event.target === dialogRef.current) {
            close();
          }
        }}
      >
        <div className="drawer-reveal sticky top-0 z-10 flex items-center justify-between border-b-2 border-transparent bg-white p-4 shadow-sm [border-image:linear-gradient(90deg,var(--color-brand-red),rgba(239,28,38,0.25)_55%,transparent)_1]">
          <BrandMark tone="light" />
          <button
            type="button"
            onClick={close}
            className="group flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-card)] transition-colors hover:bg-[var(--color-light-grey)]"
            aria-label="Close menu"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              className="transition-transform duration-200 group-hover:rotate-90"
            >
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav aria-label="Product categories" className="p-3">
          <h2 style={{ "--i": 1 } as React.CSSProperties} className="drawer-reveal flex items-center gap-3 px-2 pb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Categories
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-light-grey)]" />
          </h2>
          <ul className="overflow-hidden rounded-2xl bg-white shadow-[0_3px_14px_rgba(17,17,17,0.06)]">
            {CATEGORY_SECTIONS.map((section, index) => (
              <li
                key={section.slug}
                style={{ "--i": 2 + index } as React.CSSProperties}
                className="drawer-reveal border-b border-[var(--color-off-white)] last:border-b-0"
              >
                <details className="group drawer-acc">
                  <summary className="group/row flex cursor-pointer items-center gap-3 px-3 py-1.5 font-medium transition-colors hover:bg-[var(--surface-alt)] active:bg-[var(--surface-card)]">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-card)] text-[var(--color-dark-grey)] shadow-[inset_0_0_0_1px_rgba(17,17,17,0.04)] transition-all duration-200 group-hover/row:scale-110 group-hover/row:bg-[#fdecec] group-hover/row:text-[var(--color-action-red)] group-active/row:scale-110 group-active/row:bg-[#fdecec] group-active/row:text-[var(--color-action-red)] group-open:bg-[#fdecec] group-open:text-[var(--color-action-red)]">
                      <CategoryArt slug={section.slug} size={18} />
                    </span>
                    <span className="flex-1 text-sm transition-transform duration-200 group-hover/row:translate-x-0.5">
                      {section.name}
                    </span>
                    <span className="drawer-chevron grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-card)] text-[var(--text-muted)] group-open:rotate-180 group-open:bg-[#fdecec] group-open:text-[var(--color-action-red)]">
                      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                  </summary>
                  <ul className="mx-3 mb-3 ml-[26px] border-l-2 border-[var(--color-light-grey)] py-0.5 pl-6">
                    <li style={{ "--i": 0 } as React.CSSProperties}>
                      <Link
                        href={`/categories/${section.slug}`}
                        onClick={close}
                        className="block rounded py-2 text-sm font-semibold text-[var(--color-action-red)]"
                      >
                        All {section.name}
                      </Link>
                    </li>
                    {section.groups.map((group, groupIndex) => (
                      <li key={group.slug} style={{ "--i": groupIndex + 1 } as React.CSSProperties}>
                        <Link
                          href={`/categories/${section.slug}/${group.slug}`}
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
          <h2 style={{ "--i": 2 + CATEGORY_SECTIONS.length } as React.CSSProperties} className="drawer-reveal flex items-center gap-3 px-2 pb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Quick links
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-light-grey)]" />
          </h2>
          <ul className="overflow-hidden rounded-2xl bg-white shadow-[0_3px_14px_rgba(17,17,17,0.06)]">
            {[
              { ...METER_NAV_ITEM, icon: MeterIcon },
              { ...TRACK_ORDER_LINK, icon: TruckIcon },
              { ...CHECK_WARRANTY_LINK, icon: ShieldCheckIcon },
              { ...WISHLIST_LINK, icon: HeartIcon },
            ].map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li
                  key={item.href}
                  style={{ "--i": 3 + CATEGORY_SECTIONS.length + index } as React.CSSProperties}
                  className="drawer-reveal border-b border-[var(--color-off-white)] last:border-b-0"
                >
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={isActive ? "page" : undefined}
                    className={`group flex items-center gap-3 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--surface-alt)] active:bg-[var(--surface-card)] ${
                      isActive ? "text-[var(--color-action-red)]" : ""
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all duration-200 group-hover:scale-110 ${
                        isActive
                          ? "bg-[var(--color-action-red)] text-white shadow-[inset_0_0_0_1px_rgba(215,25,32,0.2)]"
                          : "bg-[var(--surface-card)] text-[var(--color-dark-grey)] shadow-[inset_0_0_0_1px_rgba(17,17,17,0.04)] group-hover:bg-[#fdecec] group-hover:text-[var(--color-action-red)] group-active:bg-[#fdecec] group-active:text-[var(--color-action-red)]"
                      }`}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="flex-1 transition-transform duration-200 group-hover:translate-x-0.5">
                      {item.label}
                    </span>
                    <svg
                      aria-hidden="true"
                      width="13"
                      height="13"
                      viewBox="0 0 14 14"
                      fill="none"
                      className="text-[var(--color-light-grey)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--text-muted)]"
                    >
                      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div style={{ "--i": 7 + CATEGORY_SECTIONS.length } as React.CSSProperties} className="drawer-reveal px-3 pb-5">
          <div className="rounded-2xl bg-white p-3 shadow-[0_3px_14px_rgba(17,17,17,0.06)]">
            <CountrySelector />
            <Link
              href={accountLink.href}
              onClick={close}
              className="mt-3 flex items-center justify-center gap-2 rounded-full bg-[var(--color-action-red)] px-4 py-2.5 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-action-red-dark)] hover:shadow-[0_8px_18px_-8px_rgba(215,25,32,0.6)]"
            >
              <UserIcon size={18} />
              {accountLink.label}
            </Link>
          </div>
          <p className="pt-4 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-light-grey)]">
            TRONIC Tanzania
          </p>
        </div>
      </dialog>
    </div>
  );
}
