import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";

/** The photograph's own wall colour, so the panel and the photo read as one surface. */
const WALL = "#cfcdc9";

/**
 * The homepage's second hero slide (owner request 2026-11-19): TRONIC's
 * lighting range in one photograph (street lamp, pendants, chandelier,
 * bulbs, floodlights, wall lamps). Laid out like the "Power Every Space"
 * hero so the two slides share one size: on phones the photograph edge to
 * edge (it has the same 96:50 shape) over a strip with the button; from md
 * the copy above the photograph; from lg the copy on the left and the
 * photograph on the right at its own shape, its left edge fading into the
 * wall colour. Not loaded with priority: it shows only after the first
 * slide's lighting cycle.
 */
export function LightingHero() {
  return (
    <section
      aria-label="TRONIC lighting: pendants, chandeliers, bulbs, floodlights and outdoor lamps"
      className="relative flex h-full flex-col overflow-hidden text-[var(--color-premium-black)] lg:min-h-[max(22rem,30vw)] lg:justify-center 2xl:min-h-[30rem]"
      style={{ backgroundColor: WALL }}
    >
      <Container className="relative z-10 py-9 max-lg:text-center max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:pb-3.5 max-md:pt-0 lg:py-10">
        <div className="lg:max-w-[32%] xl:max-w-[24rem]">
          {/* As on the first slide, phones show only the photograph and the button. */}
          <h2 className="font-display text-[length:var(--text-display)] leading-[1.04] max-md:sr-only">
            Light Up
            <span className="block text-[var(--color-brand-red)]">Every Room.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[#3d3a36] max-lg:mx-auto max-md:sr-only md:text-[15px]">
            Pendants, chandeliers, wall lamps, LED bulbs, floodlights and garden lamps for homes, shops and
            outdoor spaces.
          </p>
          <div className="md:mt-6">
            <Link
              href="/categories/lighting"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-action-red)] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(215,25,32,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-action-red-dark)]"
            >
              Shop Lighting
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </Container>

      <div aria-hidden="true" className="relative w-full overflow-hidden max-md:pb-16 md:h-[21rem] lg:absolute lg:inset-0 lg:h-auto">
        <div className="relative aspect-[1600/833] w-full md:absolute md:inset-0 md:aspect-auto lg:inset-y-0 lg:left-auto lg:right-0 lg:aspect-[1600/833] lg:w-auto lg:max-w-[78%]">
          <Image
            src="/banners/hero-lighting-collection.webp"
            alt=""
            fill
            quality={85}
            sizes="(min-width: 1024px) 78vw, 100vw"
            className="object-cover md:object-[center_72%] lg:object-center"
          />
          {/* lg: the photograph's left edge fades into the wall behind the copy (narrow, so the street lamp stays clear). */}
          <div
            className="absolute inset-y-0 left-0 hidden w-[12%] lg:block"
            style={{ backgroundImage: `linear-gradient(to right, ${WALL}, transparent)` }}
          />
          {/* Phones: the photograph's foot fades into the strip with the button. */}
          <div
            className="absolute inset-x-0 bottom-0 h-[18%] md:hidden"
            style={{ backgroundImage: `linear-gradient(to bottom, transparent, ${WALL})` }}
          />
        </div>
      </div>
    </section>
  );
}
