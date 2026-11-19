import { can, isMaster, type Actor, type CountryPermission } from "@tronic/permissions";

/**
 * The console's navigation, built from what the administrator may do. It
 * only decides what is shown: every page checks access again on the server.
 */

export type NavIcon =
  | "overview"
  | "countries"
  | "administrators"
  | "audit"
  | "security"
  | "dashboard"
  | "products"
  | "categories"
  | "inventory"
  | "orders"
  | "customers"
  | "content"
  | "promotions"
  | "reports"
  | "staff"
  | "settings"
  | "deliveries";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Country modules served by the country's own backend. Each needs the country's service to be connected. */
export const COUNTRY_MODULES = {
  products: { label: "Products", permission: "products.read", icon: "products", summary: "Listing, creation, SKUs, images, variants, status and bulk import." },
  categories: { label: "Categories", permission: "categories.manage", icon: "categories", summary: "Categories, subcategories and brands." },
  inventory: { label: "Inventory", permission: "inventory.read", icon: "inventory", summary: "Stock quantities, low-stock alerts, history and adjustments." },
  orders: { label: "Orders", permission: "orders.read", icon: "orders", summary: "Orders by status, details, tracking timeline and internal notes." },
  customers: { label: "Customers", permission: "customers.read", icon: "customers", summary: "Customer directory, profiles and order history." },
  content: { label: "Website content", permission: "content.read", icon: "content", summary: "Banners, homepage sections, static pages and SEO text." },
  promotions: { label: "Promotions", permission: "promotions.read", icon: "promotions", summary: "Offers and campaigns." },
  reports: { label: "Reports", permission: "reports.read", icon: "reports", summary: "Sales and operational reports in the country's own currency." },
} as const satisfies Record<string, { label: string; permission: CountryPermission; icon: NavIcon; summary: string }>;

export type CountryModuleKey = keyof typeof COUNTRY_MODULES;

export function isCountryModule(value: string): value is CountryModuleKey {
  return Object.hasOwn(COUNTRY_MODULES, value);
}

export function buildNav(actor: Actor, country: { id: string; name: string } | null): NavSection[] {
  const sections: NavSection[] = [];
  const master = isMaster(actor);

  const platform: NavItem[] = [{ href: "/", label: "Overview", icon: "overview" }];
  if (master) {
    platform.push(
      { href: "/countries", label: "Countries", icon: "countries" },
      { href: "/administrators", label: "Administrators", icon: "administrators" },
    );
  }
  const auditCountries = actor.assignments.some((assignment) => assignment.countryId && can(actor, "audit.read", assignment.countryId));
  if (master || auditCountries) platform.push({ href: "/audit", label: "Audit log", icon: "audit" });
  if (master) platform.push({ href: "/security", label: "Security events", icon: "security" });
  sections.push({ title: "Platform", items: platform });

  if (country) {
    const base = `/c/${country.id}`;
    const items: NavItem[] = [{ href: base, label: "Dashboard", icon: "dashboard" }];
    // A rider's own deliveries, first: for a rider it is the whole console.
    // Shown for the Rider role only; super admins hold the permission too
    // but follow deliveries from Orders.
    const rider = actor.assignments.some((assignment) => assignment.role === "rider" && assignment.countryId === country.id);
    if (rider && can(actor, "deliveries.perform", country.id)) items.push({ href: `${base}/deliveries`, label: "My deliveries", icon: "deliveries" });
    for (const [key, module] of Object.entries(COUNTRY_MODULES)) {
      if (can(actor, module.permission, country.id)) items.push({ href: `${base}/${key}`, label: module.label, icon: module.icon });
    }
    if (can(actor, "staff.read", country.id)) items.push({ href: `${base}/staff`, label: "Staff", icon: "staff" });
    if (can(actor, "settings.read", country.id)) items.push({ href: `${base}/settings`, label: "Settings", icon: "settings" });
    sections.push({ title: country.name, items });
  }
  return sections;
}

/**
 * True when the administrator's only role in the country is Rider: their
 * country dashboard is about their deliveries. Decides what is shown only;
 * every page and the country check access again.
 */
export function isRiderOnly(actor: Actor, countryId: string): boolean {
  if (isMaster(actor)) return false;
  const here = actor.assignments.filter((assignment) => assignment.countryId === countryId);
  return here.length > 0 && here.every((assignment) => assignment.role === "rider");
}

/** The country id in a console path ("/c/tz/orders" -> "tz"), or null. */
export function countryIdFromPath(pathname: string | null): string | null {
  const match = /^\/c\/([a-z][a-z0-9_]{1,23})(?:\/|$)/.exec(pathname ?? "");
  return match ? (match[1] as string) : null;
}

/** True when `href` is the page shown at `pathname` (or its parent section). */
export function isCurrentNavItem(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/" || /^\/c\/[^/]+$/.test(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
