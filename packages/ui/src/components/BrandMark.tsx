/**
 * TRONIC brand mark: the official red wordmark artwork supplied by the
 * owner, served by the storefront at /brand/tronic-logo.png (698×204,
 * transparent background).
 *
 * `tone` names the surface the mark sits on. Both tones currently render the
 * same red artwork (owner request 2026-11-09: the footer shows the real logo
 * rather than an interim text wordmark). When the white-on-dark artwork
 * (tronic-logo-white.svg, brand guide §11) is supplied, tone="dark" should
 * switch to it, keeping the clear-space and minimum-size rules from brand
 * guide §3.
 */
export interface BrandMarkProps {
  /** "light" = mark for white surfaces; "dark" = mark for dark surfaces. */
  tone?: "light" | "dark";
}

export function BrandMark({ tone = "light" }: BrandMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size static
    // asset in a framework-agnostic package; no optimization needed.
    <img
      src="/brand/tronic-logo.png"
      alt="TRONIC"
      width={123}
      height={36}
      className="h-9 w-auto"
      data-tone={tone}
    />
  );
}
