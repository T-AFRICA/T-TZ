/**
 * TRONIC brand mark.
 *
 * tone="light" renders the official red wordmark artwork supplied by the
 * owner, served by the storefront at /brand/tronic-logo.png (698×204,
 * transparent background).
 *
 * tone="dark" is still an INTERIM rendition (wordmark text + star device):
 * the white-on-dark artwork (tronic-logo-white.svg, brand guide §11) has not
 * been supplied yet — replace it when available, keeping the clear-space and
 * minimum-size rules from brand guide §3.
 */
export interface BrandMarkProps {
  /** "light" = red mark for white surfaces; "dark" = white mark for dark surfaces. */
  tone?: "light" | "dark";
}

export function BrandMark({ tone = "light" }: BrandMarkProps) {
  if (tone === "light") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- fixed-size static
      // asset in a framework-agnostic package; no optimization needed.
      <img
        src="/brand/tronic-logo.png"
        alt="TRONIC"
        width={123}
        height={36}
        className="h-9 w-auto"
      />
    );
  }
  return (
    <span
      role="img"
      aria-label="TRONIC"
      className="inline-flex items-center text-[1.75rem] font-bold leading-none tracking-tight text-white"
      style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
    >
      <span aria-hidden="true">TR</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="mx-[0.06em] h-[0.84em] w-[0.84em]"
      >
        <polygon points="12,1 13.91,7.38 19.78,4.22 16.62,10.09 23,12 16.62,13.91 19.78,19.78 13.91,16.62 12,23 10.09,16.62 4.22,19.78 7.38,13.91 1,12 7.38,10.09 4.22,4.22 10.09,7.38" />
      </svg>
      <span aria-hidden="true">NIC</span>
    </span>
  );
}
