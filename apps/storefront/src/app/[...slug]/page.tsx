import { Container } from "@tronic/ui";

export const metadata = {
  title: "Page under construction",
  robots: { index: false, follow: false },
};

/**
 * Catch-all placeholder for routes that are planned but not yet built
 * (About, Locations, Blog, Showrooms and the eight policy pages — Week 6;
 * cart/checkout/account — Weeks 3-4). It keeps header and footer links
 * honest instead of returning 404s, and is excluded from indexing.
 */
export default function PlaceholderPage() {
  return (
    <Container className="py-10">
      <h1 className="text-[length:var(--text-h1)] font-bold leading-tight">This page is on the way</h1>
      <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
        This part of the TRONIC Tanzania site is scheduled for a later build phase and its content
        is pending business approval.
      </p>
    </Container>
  );
}
