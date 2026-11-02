import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";
import { CATEGORY_SECTIONS, METER_NAV_ITEM } from "@tronic/country-config";
import { Hero } from "@/components/home/Hero";
import { CategoryArt } from "@/components/home/CategoryArt";
import { FeaturedSamples } from "@/components/home/FeaturedSamples";

/**
 * Week 1 storefront shell: hero carousel, category grid and the Meter
 * callout. Product listings, promotions and real campaign content
 * (SRS FR-004) arrive in Week 2; nothing here states prices or offers.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Container id="departments" className="scroll-mt-24 py-8 md:py-14 lg:py-20">
        <div className="max-w-2xl max-md:hidden">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-action-red)]">
            <span aria-hidden="true" className="h-px w-8 bg-[var(--color-action-red)]" />
            Departments
          </p>
          <h2
            className="mt-3 text-[length:var(--text-h2)] font-bold leading-tight tracking-[-0.01em]"
            style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
          >
            Shop by category
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Everything electrical in eight departments — from cable to switchgear.
          </p>
        </div>

        {/* Mobile: horizontally scrollable circle chips (approved mobile UI reference) */}
        <nav aria-label="Shop by category" className="md:hidden">
          <ul className="-mx-[var(--gutter)] flex snap-x gap-4 overflow-x-auto px-[var(--gutter)] pb-2">
            {CATEGORY_SECTIONS.map((section) => (
              <li key={section.slug} className="w-[4.5rem] shrink-0 snap-start">
                <Link
                  href={`/categories/${section.slug}`}
                  className="group flex flex-col items-center gap-1.5 text-center"
                >
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-[var(--color-dark-grey)] shadow-[0_3px_10px_rgba(17,17,17,0.08)] transition-colors group-hover:text-[var(--color-action-red)]">
                    <CategoryArt slug={section.slug} size={30} />
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-[var(--text-primary)]">
                    {section.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <ul className="mt-8 grid grid-cols-2 gap-4 max-md:hidden sm:gap-5 lg:grid-cols-4">
          {CATEGORY_SECTIONS.map((section) => (
            <li key={section.slug}>
              <Link
                href={`/categories/${section.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--color-light-grey)] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-mid-grey)] hover:shadow-[0_12px_28px_-16px_rgba(17,17,17,0.35)]"
              >
                {/* Media area — in-house illustration pending approved category photography */}
                <span className="grid aspect-[16/10] place-items-center bg-[var(--surface-card)] text-[var(--color-dark-grey)] transition-colors group-hover:text-[var(--color-action-red)]">
                  <CategoryArt slug={section.slug} size={56} />
                </span>
                <span className="flex flex-1 flex-col p-4 sm:p-5">
                  <span
                    className="flex items-center justify-between gap-2 text-sm font-semibold sm:text-base"
                    style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
                  >
                    {section.name}
                    <ArrowRightIcon
                      size={16}
                      className="shrink-0 text-[var(--color-action-red)] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                    />
                  </span>
                  <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-[13px]">
                    {section.groups.map((group) => group.name).join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <FeaturedSamples />

        {/* Meter callout — reserved single-page service, no payment flows (SRS FR-035/036) */}
        <section className="relative mt-10 overflow-hidden rounded-2xl bg-[var(--color-premium-black)] text-white md:mt-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,rgba(215,25,32,0.35),transparent_55%)]"
          />
          <div className="relative flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center lg:p-10">
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
      </Container>
    </>
  );
}
