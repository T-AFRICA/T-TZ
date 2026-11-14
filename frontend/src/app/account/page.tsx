import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Heart, Hourglass, LifeBuoy, MapPin, Package, Truck, type LucideIcon } from "lucide-react";
import { ArrowRightIcon } from "@tronic/ui";
import { OrderCard } from "@/components/account/OrderCard";
import { WishlistCount } from "@/components/account/WishlistCount";
import { ButtonLink, EmptyState, NotConnected, Panel, PortalPage, TextLink } from "@/components/account/ui";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { createAccountService, loadLineImages } from "@/features/account/service";
import { firstName, requireCustomer } from "@/features/account/session";

export const metadata: Metadata = { title: "Your account" };

function StatCard({ icon: Icon, label, value, href }: { icon: LucideIcon; label: string; value: React.ReactNode; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(17,17,17,0.04)] transition-shadow hover:shadow-[0_10px_28px_-16px_rgba(17,17,17,0.3)] md:p-5"
    >
      <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fdf1f1] text-[var(--color-action-red)]">
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold leading-none tabular-nums">{value}</span>
        <span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">{label}</span>
      </span>
    </Link>
  );
}

const QUICK_ACTIONS: readonly { href: string; label: string; body: string; icon: LucideIcon }[] = [
  { href: "/account/tracking", label: "Track an order", body: "See where your order is", icon: Truck },
  { href: "/account/orders", label: "My orders", body: "All your purchases", icon: Package },
  { href: "/account/wishlist", label: "Wishlist", body: "Products you saved", icon: Heart },
  { href: "/account/addresses", label: "Manage addresses", body: "Delivery addresses", icon: MapPin },
  { href: "/account/support", label: "Customer support", body: "Help with an order", icon: LifeBuoy },
];

/**
 * /account — the customer dashboard: greeting, order counts, recent
 * orders, quick actions and the products this browser viewed recently.
 * Every number and order is the signed-in customer's own record; with no
 * order database connected the page says so instead of showing samples.
 */
export default async function AccountDashboardPage() {
  const user = await requireCustomer();
  const service = createAccountService(user);
  const [counts, recent] = await Promise.all([service.getOrderCounts(), service.listOrders({ pageSize: 3 })]);
  const images = recent.status === "ok" ? await loadLineImages(recent.data.items) : new Map<string, string>();
  const name = firstName(user);
  const figure = (value: number | undefined) => (counts.status === "ok" && value !== undefined ? value : "–");

  return (
    <PortalPage>
      <section className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(17,17,17,0.04)] md:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[30px] border-[var(--color-action-red)]/[0.06]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-action-red)]">TRONIC account</p>
        <h1 className="mt-1 text-[1.6rem] font-bold leading-tight tracking-[-0.01em] md:text-[2rem]">
          {name ? `Welcome back, ${name}` : "Welcome back"}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-[var(--text-secondary)] md:text-[15px]">
          Manage your orders, track deliveries and enjoy a smoother shopping experience with TRONIC.
        </p>
      </section>

      <section aria-label="Account overview" className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard icon={Package} label="Total orders" value={figure(counts.status === "ok" ? counts.data.total : undefined)} href="/account/orders" />
        <StatCard icon={Hourglass} label="In progress" value={figure(counts.status === "ok" ? counts.data.inProgress : undefined)} href="/account/tracking" />
        <StatCard icon={CheckCircle2} label="Delivered" value={figure(counts.status === "ok" ? counts.data.delivered : undefined)} href="/account/orders?status=delivered" />
        <StatCard icon={Heart} label="Wishlist items" value={<WishlistCount />} href="/account/wishlist" />
      </section>

      <Panel title="Recent orders" labelledBy="recent-orders" action={<TextLink href="/account/orders">View all</TextLink>} bare>
        {recent.status === "not_connected" ? (
          <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
            <NotConnected
              icon={Package}
              title="Your orders will appear here"
              body="Online ordering is not connected to this site yet, so there are no orders to show."
              waitingFor={recent.waitingFor}
            />
          </div>
        ) : recent.data.items.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
            <EmptyState
              icon={Package}
              title="No orders yet"
              body="When you place an order it will show up here with its status."
              action={<ButtonLink href="/">Start shopping</ButtonLink>}
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {recent.data.items.map((order) => (
              <li key={order.orderNumber}>
                <OrderCard order={order} images={images} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Quick actions" labelledBy="quick-actions">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {QUICK_ACTIONS.map((action) => (
            <li key={action.href}>
              <Link
                href={action.href}
                className="group flex h-full items-center gap-3 rounded-xl border border-[var(--color-light-grey)] p-3 transition-colors hover:border-[var(--color-action-red)] xl:flex-col xl:items-start"
              >
                <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#f6f6f7] text-[var(--text-primary)] transition-colors group-hover:bg-[#fdf1f1] group-hover:text-[var(--color-action-red)]">
                  <action.icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{action.label}</span>
                  <span className="block text-xs text-[var(--text-secondary)]">{action.body}</span>
                </span>
                <ArrowRightIcon size={15} className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-action-red)] xl:hidden" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Products this browser opened recently (real, local history); renders nothing without any. */}
      <RecentlyViewed currentId="" />
    </PortalPage>
  );
}
