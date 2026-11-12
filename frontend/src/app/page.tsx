import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";
import { METER_NAV_ITEM } from "@tronic/country-config";
import { Hero } from "@/components/home/Hero";
import { FeaturedSamples } from "@/components/home/FeaturedSamples";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Homepage: hero, sample product sections and the Meter callout. The category
 * banners and the service strip left the homepage on 2026-11-09 (owner
 * request); departments stay reachable from the navbar menus, and the
 * "departments" anchor keeps the existing "Browse" links working. Product
 * listings, promotions and real campaign content (SRS FR-004) arrive in
 * Week 2; nothing here states prices or offers.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Container id="departments" className="scroll-mt-24 py-5 md:py-10 lg:py-12">
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
              <h2 className="font-display mt-2 text-[length:var(--text-h3)] leading-tight">
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
