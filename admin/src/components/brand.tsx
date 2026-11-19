/**
 * The white TRONIC wordmark (brand guide §11, white-on-dark artwork), for
 * the console's red surfaces: the sidebar and the sign-in panel. The
 * shared BrandMark keeps the red artwork, which the storefront uses.
 */
export function WhiteMark({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small fixed static asset; no optimisation needed
    <img src="/brand/tronic-logo-white.png" alt="TRONIC" width={667} height={148} className={className} />
  );
}
