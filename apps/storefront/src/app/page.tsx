import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";
import { CATEGORY_SECTIONS, METER_NAV_ITEM } from "@tronic/country-config";
import { Hero } from "@/components/home/Hero";
import { CategoryArt } from "@/components/home/CategoryArt";
import { FeaturedSamples } from "@/components/home/FeaturedSamples";
import { Reveal } from "@/components/motion/Reveal";

/** One category circle in the rail under the hero. The looping copy of the rail
    stays clickable but is skipped by the keyboard. */
function CategoryCircle({
  section,
  isLoopCopy = false,
}: {
  section: (typeof CATEGORY_SECTIONS)[number];
  isLoopCopy?: boolean;
}) {
  return (
    <Link
      href={`/categories/${section.slug}`}
      tabIndex={isLoopCopy ? -1 : undefined}
      className="group flex flex-col items-center gap-1.5 text-center md:gap-2.5"
    >
      <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-[var(--color-dark-grey)] shadow-[0_3px_10px_rgba(17,17,17,0.08)] transition-all duration-200 group-hover:scale-105 group-hover:text-[var(--color-action-red)] group-active:scale-105 group-active:text-[var(--color-action-red)] md:h-24 md:w-24 md:shadow-[0_4px_14px_rgba(17,17,17,0.08)]">
        <span className="md:scale-125">
          <CategoryArt slug={section.slug} size={30} />
        </span>
      </span>
      <span className="text-[11px] font-medium leading-tight text-[var(--text-primary)] md:text-[13px]">
        {section.name}
      </span>
    </Link>
  );
}

/**
 * Week 1 storefront shell: hero carousel, category grid and the Meter
 * callout. Product listings, promotions and real campaign content
 * (SRS FR-004) arrive in Week 2; nothing here states prices or offers.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Container id="departments" className="scroll-mt-24 py-5 md:py-10 lg:py-12">
        {/* News-ticker rail (owner request 2026-11-06): moves slowly right to left,
            on every screen size. The loop needs a second copy, hidden from assistive
            tech. Each copy is wider than the screen, so a category is never on
            screen twice (owner request 2026-11-05). Hover, touch and keyboard focus
            pause it; reduced motion shows one still, swipeable row. */}
        <nav aria-label="Shop by category" className="category-rail-frame -mx-[var(--gutter)]">
          <div className="category-rail flex w-max items-start pt-1 pb-2">
            <ul className="category-rail-group">
              {CATEGORY_SECTIONS.map((section) => (
                <li key={section.slug} className="w-[4.5rem] shrink-0 md:w-28">
                  <CategoryCircle section={section} />
                </li>
              ))}
            </ul>
            <ul aria-hidden="true" className="category-rail-group category-rail-copy">
              {CATEGORY_SECTIONS.map((section) => (
                <li key={section.slug} className="w-[4.5rem] shrink-0 md:w-28">
                  <CategoryCircle section={section} isLoopCopy />
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <FeaturedSamples />

        {/* Meter callout — reserved single-page service, no payment flows (SRS FR-035/036) */}
        <Reveal>
        <section className="relative mt-8 overflow-hidden rounded-2xl bg-[var(--color-premium-black)] text-white md:mt-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,rgba(215,25,32,0.35),transparent_55%)]"
          />
          <div className="relative flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-8 lg:p-10">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#ff6b72]">
                Utility service
              </p>
              <h2
                className="mt-2 text-[length:var(--text-h3)] font-bold leading-tight"
                style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
              >
                TRONIC <span className="text-[var(--color-brand-red)]">Meter</span>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                Prepaid meter token service for Tanzania — learn how it works on one dedicated page.
              </p>
            </div>
            <Link
              href={METER_NAV_ITEM.href}
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[var(--color-action-red)] px-6 py-3 text-sm font-semibold transition-colors hover:bg-[var(--color-action-red-dark)]"
            >
              Visit Meter
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </section>
        </Reveal>
      </Container>
    </>
  );
}
