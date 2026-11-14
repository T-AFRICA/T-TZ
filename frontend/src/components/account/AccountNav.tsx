"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CreditCard,
  FileText,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Package,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { ACCOUNT_NAV, isActiveNavItem } from "@/features/account/nav";

const ICONS: Record<string, LucideIcon> = {
  "/account": LayoutDashboard,
  "/account/orders": Package,
  "/account/tracking": Truck,
  "/account/wishlist": Heart,
  "/account/addresses": MapPin,
  "/account/payments": CreditCard,
  "/account/invoices": FileText,
  "/account/notifications": Bell,
  "/account/support": LifeBuoy,
  "/account/profile": UserRound,
};

/**
 * Portal navigation in two shapes from one list: the desktop sidebar and a
 * swipeable row of pills on phones and tablets (the bottom tab bar already
 * holds Home, Wishlist, Cart and Profile, so this row is the account's own
 * second-level navigation, not another copy of it). The active pill is
 * scrolled into view.
 */
export function AccountNav({ variant }: { variant: "sidebar" | "pills" }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (variant !== "pills") return;
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname, variant]);

  if (variant === "pills") {
    return (
      <nav aria-label="Account sections">
        <ul className="-mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ACCOUNT_NAV.map((item) => {
            const active = isActiveNavItem(item, pathname);
            const Icon = ICONS[item.href] ?? LayoutDashboard;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  ref={active ? activeRef : undefined}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? "bg-[var(--color-premium-black)] text-white"
                      : "bg-white text-[var(--text-primary)] shadow-[0_1px_2px_rgba(17,17,17,0.06)] hover:text-[var(--color-action-red)]"
                  }`}
                >
                  <Icon size={15} aria-hidden="true" />
                  {item.shortLabel ?? item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Account sections">
      <ul className="space-y-0.5">
        {ACCOUNT_NAV.map((item) => {
          const active = isActiveNavItem(item, pathname);
          const Icon = ICONS[item.href] ?? LayoutDashboard;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#fdf1f1] font-semibold text-[var(--color-action-red)]"
                    : "text-[var(--text-primary)] hover:bg-[#f6f6f7]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-2.5 h-6 w-[3px] rounded-full bg-[var(--color-action-red)] transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
                />
                <Icon size={18} aria-hidden="true" className={active ? "" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
