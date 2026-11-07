import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@tronic/ui";

export interface CategoryBanner {
  /** Category slug: the card links to /categories/<slug>. */
  slug: string;
  /** Visible title (the category's name from the taxonomy). */
  name: string;
  /** One-line description under the title. */
  tagline: string;
  /** 2:1 banner under /public/categories; see CategoryShowcase for provenance. */
  image: string;
  /** What the photograph shows, for assistive tech. */
  alt: string;
}

/**
 * One photographic category banner (oraimo-style reference, owner request
 * 2026-11-07): a 2:1 image with the title and tagline over a soft gradient
 * in the top-left corner, the whole card a link. From sm every card is 2:1.
 * On phones the grid is two-up like the oraimo reference: the first two
 * ("feature") cards are tall 3:4 tiles, the rest ("compact") are 2:1 tiles
 * that show the title only. Hover zooms the photo and reveals an arrow;
 * reduced motion keeps everything still.
 */
export function CategoryBannerCard({
  banner,
  variant = "compact",
  priority = false,
}: {
  banner: CategoryBanner;
  variant?: "feature" | "compact";
  priority?: boolean;
}) {
  const feature = variant === "feature";
  return (
    <Link
      href={`/categories/${banner.slug}`}
      aria-label={`${banner.name} — ${banner.tagline}`}
      className={`group relative block min-w-0 overflow-hidden rounded-xl bg-[var(--color-dark-grey)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-red)] sm:aspect-[2/1] ${
        feature ? "aspect-[3/4]" : "aspect-[2/1]"
      }`}
    >
      <Image
        src={banner.image}
        alt={banner.alt}
        fill
        priority={priority}
        quality={85}
        sizes="50vw"
        className="object-cover transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.04]"
      />
      {/* Readability gradient under the title only; the rest of the photo stays clean. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.28)_38%,transparent_65%)]"
      />
      <div className="absolute left-3 top-3 max-w-[80%] text-white sm:left-4 sm:top-4 md:left-5 md:top-5">
        <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] sm:text-lg md:text-xl">
          {banner.name}
        </h3>
        <p className={`mt-1 text-xs leading-snug text-white/85 md:text-[13px] ${feature ? "" : "max-sm:hidden"}`}>
          {banner.tagline}
        </p>
      </div>
      {/* Directional arrow: always visible on touch screens, revealed on hover
          elsewhere; compact phone tiles are too small for it. */}
      <span
        aria-hidden="true"
        className={`absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[var(--color-premium-black)] shadow-sm transition-[opacity,transform] duration-300 sm:bottom-4 sm:right-4 sm:h-9 sm:w-9 [@media(hover:hover)]:translate-y-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:opacity-100 ${
          feature ? "" : "max-sm:hidden"
        }`}
      >
        <ArrowRightIcon size={16} />
      </span>
    </Link>
  );
}
