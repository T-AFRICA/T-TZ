import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";
import { HERO_BANNER_HEADING, HERO_BANNER_TEXT, heroBannerSrc, type HeroBanner } from "./hero-banners";

/** The artwork's own colours along one edge, as a left-to-right gradient. */
function across(colours: readonly string[]): string {
  return `linear-gradient(to right, ${colours.join(", ")})`;
}

/** Fades the top of a photograph into the wall behind it, so no join shows. */
function WallFade({ colours }: { colours: readonly string[] }) {
  return (
    <div
      className="absolute inset-x-0 top-0 h-[10%] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      style={{ backgroundImage: across(colours) }}
    />
  );
}

/**
 * A category banner as a homepage hero slide (owner artwork 2026-11-24): one
 * photograph in three shapes, and each screen gets the shape made for it.
 * Laid out like the other slides so all of them share one size:
 *
 * - Phones: the 96:50 banner edge to edge, over a strip in the banner's own
 *   floor colour that carries the button. The copy stays for screen readers
 *   and search engines.
 * - Tablets (md): the copy above the 16:7 banner, on the banner's wall colour.
 * - Desktop (lg): the 4:1 banner across the full width, standing on the
 *   hero's bottom edge, with the copy in the third its designer left clear.
 *   Where the hero is taller than 4:1 the wall continues above the banner.
 *   From 1920px the hero is 4:1 itself, so the banner is never cropped.
 *
 * A banner that is not for the current screen is not rendered, and a lazy
 * image that is not rendered is not downloaded: a phone fetches only the
 * mobile file.
 */
export function BannerHero({ banner }: { banner: HeroBanner }) {
  return (
    <section
      aria-label={`TRONIC ${banner.label.toLowerCase()}: ${banner.description}`}
      className="relative flex h-full flex-col overflow-hidden lg:min-h-[max(22rem,30vw)] lg:justify-center 2xl:min-h-[30rem] min-[120rem]:min-h-[25vw]"
      style={{ color: HERO_BANNER_HEADING }}
    >
      {/* What shows wherever the photograph does not reach. */}
      <div aria-hidden="true" className="absolute inset-0 md:hidden" style={{ backgroundImage: across(banner.floor) }} />
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden md:block lg:hidden"
        style={{ backgroundImage: across(banner.tabletWall) }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden lg:block"
        style={{ backgroundImage: across(banner.desktopWall) }}
      />

      {/* From 1920px the copy stays at the banner's left edge, not the page column's. */}
      <Container className="relative z-10 py-9 max-lg:text-center max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:pb-[2.375rem] max-md:pt-0 lg:py-10 min-[120rem]:max-w-none">
        {/* Desktop: the copy keeps to the part of the banner its designer left
            clear (banner.copyWidth), with a headline sized to fit that part. */}
        <div data-hero-copy className={banner.copyWidth}>
          <h2 className="font-display text-[length:var(--text-display)] leading-[1.04] max-md:sr-only lg:text-[length:clamp(1.75rem,3vw,3.5rem)]">
            {banner.heading[0]}
            <span className="block" style={{ color: banner.accent }}>
              {banner.heading[1]}
            </span>
          </h2>
          <p
            className="mt-4 max-w-md text-sm leading-relaxed max-lg:mx-auto max-md:sr-only md:text-[15px]"
            style={{ color: HERO_BANNER_TEXT }}
          >
            {banner.text}
          </p>
          <div className="md:mt-6">
            <Link
              href={banner.cta.href}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[var(--color-action-red)] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(215,25,32,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-action-red-dark)]"
            >
              {banner.cta.label}
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </Container>

      <div
        aria-hidden="true"
        className="relative w-full max-md:pb-[5.5rem] md:min-h-[21rem] md:flex-1 lg:absolute lg:inset-0 lg:min-h-0"
      >
        <div className="relative aspect-[1600/833] w-full md:hidden">
          <Image
            src={heroBannerSrc(banner, "mobile")}
            alt=""
            fill
            quality={85}
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 hidden md:block lg:hidden">
          <Image
            src={heroBannerSrc(banner, "tablet")}
            alt=""
            fill
            quality={85}
            sizes="100vw"
            className="object-cover"
          />
          <WallFade colours={banner.tabletWall} />
        </div>
        <div className="absolute inset-x-0 bottom-0 hidden aspect-[4/1] lg:block">
          <Image
            src={heroBannerSrc(banner, "desktop")}
            alt=""
            fill
            quality={85}
            sizes="100vw"
            className="object-cover"
          />
          <WallFade colours={banner.desktopWall} />
        </div>
      </div>
    </section>
  );
}
