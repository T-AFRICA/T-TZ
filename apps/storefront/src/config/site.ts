/**
 * Deployment-level display content for the Tanzania storefront.
 *
 * Values marked PLACEHOLDER are synthetic pre-launch content (the site ships
 * noindex): the business owner supplies the real promotion copy, support
 * phone and social profile URLs before the Tanzania launch gate. Keeping them
 * here — not inside components — makes the swap a one-file change.
 */

export const ANNOUNCEMENT = {
  // PLACEHOLDER promotion copy pending the marketing team's launch offer.
  message: "Free delivery in Dar es Salaam on qualifying orders.",
  linkLabel: "See details",
  href: "/policies/delivery",
} as const;

/** PLACEHOLDER support line (all zeros) — replace with the real number. */
export const SUPPORT_PHONE = {
  label: "+255 000 000 000",
  href: "tel:+255000000000",
} as const;

/**
 * Official Tanzania profile URLs are not confirmed yet. Entries with a null
 * href are not rendered — never invent profile URLs.
 */
export const SOCIAL_LINKS: readonly { label: string; href: string | null }[] = [
  { label: "Facebook", href: null },
  { label: "Instagram", href: null },
  { label: "TikTok", href: null },
];

/** Informational pages (SRS §7.1) — built in W06; the catch-all page covers them until then. */
export const COMPANY_LINKS = [
  { href: "/about", label: "About Us" },
  { href: "/locations", label: "Our Locations" },
  { href: "/blog", label: "Engineering Blog" },
  { href: "/showrooms", label: "Our Showroom Locations" },
] as const;

export const POLICY_LINKS = [
  { href: "/help", label: "Help Center" },
  { href: "/policies/shipping", label: "Shipping Policy" },
  { href: "/policies/delivery", label: "Delivery Information" },
  { href: "/policies/returns", label: "Return Policy" },
  { href: "/policies/warranty", label: "Warranty Policy" },
  { href: "/policies/privacy", label: "Privacy Policy" },
  { href: "/policies/terms", label: "Terms of Service" },
  { href: "/policies/cookies", label: "Cookie Policy" },
] as const;

/** Account, order tracking, wishlist and cart UIs land in W03-W04; routes exist as placeholders. */
export const TRACK_ORDER_LINK = { href: "/track-order", label: "Track Order" } as const;
export const ACCOUNT_LINK = { href: "/account", label: "Login" } as const;
export const WISHLIST_LINK = { href: "/wishlist", label: "Wishlist" } as const;
export const CART_LINK = { href: "/cart", label: "Cart" } as const;
