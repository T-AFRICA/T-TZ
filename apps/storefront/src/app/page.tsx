import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";
import { CATEGORY_SECTIONS, METER_NAV_ITEM } from "@tronic/country-config";
import { Hero } from "@/components/home/Hero";
import { CategoryArt } from "@/components/home/CategoryArt";
import { FeaturedSamples } from "@/components/home/FeaturedSamples";
import { Reveal } from "@/components/motion/Reveal";

/** One category circle, shared by the mobile snap carousel and the desktop marquee. */
function CategoryCircle({
  section,
  tabIndex,
}: {
  section: (typeof CATEGORY_SECTIONS)[number];
  tabIndex?: number;
}) {
  return (
    <Link
      href={`/categories/${section.slug}`}
      tabIndex={tabIndex}
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
        {/* Continuously rotating category circles right after the banner,
            on every breakpoint (owner request Nov 2026, reconfirmed
            2026-11-05 after an interim mobile swipe carousel: the circles
            must visibly drift on phones too). Touch/hover pauses the
            drift, reduced-motion stops it. Four identical copies keep the
            -50% loop seamless on ultrawide screens; copies after the first
            are hidden from assistive tech and keyboards. */}
        <nav aria-label="Shop by category" className="-mx-[var(--gutter)] overflow-hidden lg:-mx-8">
          <ul className="category-marquee flex w-max items-start pb-2">
            {[0, 1, 2, 3].map((copy) =>
              CATEGORY_SECTIONS.map((section) => (
                <li
                  key={`${copy}-${section.slug}`}
                  aria-hidden={copy > 0 ? true : undefined}
                  className="mr-4 w-[4.5rem] shrink-0 md:mr-8 md:w-28"
                >
                  <CategoryCircle section={section} tabIndex={copy > 0 ? -1 : undefined} />
                </li>
              )),
            )}
          </ul>
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
