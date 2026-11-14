/**
 * Deployment-level display content for the Tanzania storefront.
 *
 * Values marked PLACEHOLDER are synthetic pre-launch content (the site ships
 * noindex): the business owner supplies the real promotion copy, support
 * phone and social profile URLs before the Tanzania launch gate. Keeping them
 * here — not inside components — makes the swap a one-file change.
 */

/**
 * Rotating announcement ticker (owner request Nov 2026). PLACEHOLDER copy
 * pending the marketing team's launch content — descriptions of planned
 * platform features only, never invented offers or prices. `shortMessage`
 * keeps the bar on one line on phones.
 */
export const ANNOUNCEMENTS = [
  {
    message: "Free delivery in Dar es Salaam on qualifying orders.",
    shortMessage: "Free delivery in Dar es Salaam.",
    linkLabel: "See details",
    href: "/policies/delivery",
  },
  {
    message: "Track your TRONIC order online from dispatch to delivery.",
    shortMessage: "Track your order online.",
    linkLabel: "Track Order",
    href: "/track-order",
  },
  {
    message: "TRONIC Meter — prepaid meter tokens on one dedicated page.",
    shortMessage: "TRONIC Meter token service.",
    linkLabel: "Learn more",
    href: "/meter",
  },
] as const;

/** PLACEHOLDER support line (all zeros) — replace with the real number. */
export const SUPPORT_PHONE = {
  label: "+255 000 000 000",
  href: "tel:+255000000000",
} as const;

/**
 * PLACEHOLDER WhatsApp chat number (international digits, no "+"), the same
 * all-zeros placeholder as SUPPORT_PHONE. Replace it with the real business
 * WhatsApp number before launch; never guess one. `greeting` pre-fills the
 * customer's first message.
 */
export const WHATSAPP = {
  number: "255000000000",
  greeting: "Hello TRONIC, I have a question.",
} as const;

/** wa.me chat link with a pre-filled, URL-encoded message. */
export function whatsappHref(message: string = WHATSAPP.greeting): string {
  return `https://wa.me/${WHATSAPP.number}?text=${encodeURIComponent(message)}`;
}

/**
 * Official Tanzania profile URLs are not confirmed yet. PLACEHOLDER "#"
 * hrefs render the icons without linking anywhere (owner request Nov 2026;
 * shown in the footer since 2026-11-09) — never invent profile URLs; the
 * owner swaps in the real profiles before launch. A null href hides the
 * entry entirely.
 */
export const SOCIAL_LINKS: readonly { label: string; href: string | null }[] = [
  { label: "Facebook", href: "#" },
  { label: "Instagram", href: "#" },
  { label: "TikTok", href: "#" },
];

/** Informational pages (SRS §7.1) — built in W06; the catch-all page covers
 *  them until then. `navLabel` is the compact form shown in the red navbar. */
export const COMPANY_LINKS = [
  { href: "/about", label: "About Us", navLabel: "About" },
  { href: "/locations", label: "Our Locations", navLabel: "Locations" },
  { href: "/blog", label: "Engineering Blog", navLabel: "Blog" },
  { href: "/showrooms", label: "Our Showroom Locations", navLabel: "Showrooms" },
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
/** Warranty lookup tool (owner request Nov 2026) — placeholder route until the feature is built. */
export const CHECK_WARRANTY_LINK = { href: "/check-warranty", label: "Check Warranty" } as const;
/** Customer sign-in (login and register UI built 2026-11-10; auth connects later). */
export const ACCOUNT_LINK = { href: "/login", label: "Login" } as const;
/** The same button once this browser has a customer session (features/auth/sessionHint.ts). */
export const SIGNED_IN_ACCOUNT_LINK = { href: "/account", label: "Account" } as const;
export const WISHLIST_LINK = { href: "/wishlist", label: "Wishlist" } as const;
export const CART_LINK = { href: "/cart", label: "Cart" } as const;
