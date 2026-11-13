import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";
import { METER_NAV_ITEM } from "@tronic/country-config";
import { Hero } from "@/components/home/Hero";
import { CategoryRail } from "@/components/home/CategoryRail";
import { HomeCollections } from "@/components/home/HomeCollections";
import { HomeEssentials } from "@/components/home/HomeEssentials";
import { PromoBanner } from "@/components/home/PromoBanner";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Homepage (owner brief 2026-11-12): hero and the category icon rail; the
 * eight core sections (Offers & Promotions, Featured Products,
 * Best-Selling Products, New Arrivals, Shop Collections, Luxury Chandeliers
 * & Lighting, Cables & Wiring, New Arrival Wall Lights — HomeEssentials);
 * then the earlier collections (Switchgear & Protection, Adapters &
 * Extensions, Spotlights, Garden Lights), the Meter callout and last the
 * full-width brand banner (no offer). The phone product tabs were removed
 * because Featured, Best-Selling and New Arrivals now cover them on every
 * screen. The banner runs full width, so the page uses blocks instead of
 * one container. The "departments" anchor keeps the existing "Browse"
 * links working.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Container id="departments" className="scroll-mt-24 pt-5 md:pt-10 lg:pt-12">
        <CategoryRail />
      </Container>

      <HomeEssentials />

      <HomeCollections />

      <Container>
        {/* Meter callout — reserved single-page service, no payment flows (SRS FR-035/036) */}
        <Reveal>
        {/* Light card (design pass 2026-11-12): the brand banner and the
            footer below are dark, so this breaks up the dark run. */}
        <section className="relative mt-8 overflow-hidden rounded-2xl border border-[var(--color-light-grey)] bg-[linear-gradient(120deg,#ffffff_0%,#fbf3f3_100%)] md:mt-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[36px] border-[var(--color-action-red)]/[0.06]"
          />
          <div className="relative flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-8 lg:p-10">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-action-red)]">
                Utility service
              </p>
              <h2 className="font-display mt-2 text-[length:var(--text-h3)] leading-tight text-[var(--color-premium-black)]">
                TRONIC <span className="text-[var(--color-brand-red)]">Meter</span>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Prepaid meter token service for Tanzania — learn how it works on one dedicated page.
              </p>
            </div>
            <Link
              href={METER_NAV_ITEM.href}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-[var(--color-action-red)] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_rgba(215,25,32,0.7)] transition-colors hover:bg-[var(--color-action-red-dark)]"
            >
              Visit Meter
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </section>
        </Reveal>
      </Container>

      {/* Last on the page (owner request 2026-11-12). */}
      <PromoBanner />
    </>
  );
}
