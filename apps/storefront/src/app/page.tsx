import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";
import { CATEGORY_SECTIONS, METER_NAV_ITEM } from "@tronic/country-config";
import { Hero } from "@/components/home/Hero";

/**
 * Week 1 storefront shell: hero carousel, category grid and the Meter
 * callout. Product listings, promotions and real campaign content
 * (SRS FR-004) arrive in Week 2; nothing here states prices or offers.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Container className="py-12 lg:py-16">
        <div className="flex items-baseline justify-between">
          <h2
            className="text-[length:var(--text-h2)] font-bold leading-tight"
            style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
          >
            Shop by category
          </h2>
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_SECTIONS.map((section) => (
            <li key={section.slug}>
              <Link
                href={`/categories/${section.slug}`}
                className="group block h-full rounded-xl bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span className="flex items-center justify-between gap-2 font-bold">
                  {section.name}
                  <ArrowRightIcon
                    size={16}
                    className="shrink-0 text-[var(--color-action-red)] opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-[var(--text-muted)]">
                  {section.groups.map((group) => group.name).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-14 flex flex-col items-start justify-between gap-5 overflow-hidden rounded-2xl bg-[var(--color-premium-black)] p-8 text-white sm:flex-row sm:items-center lg:p-10">
          <div>
            <h2
              className="text-[length:var(--text-h3)] font-bold leading-tight"
              style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
            >
              TRONIC <span className="text-[var(--color-brand-red)]">Meter</span>
            </h2>
            <p className="mt-2 max-w-xl text-sm text-[var(--color-light-grey)]">
              Prepaid meter token service for Tanzania — learn how it works on one dedicated page.
            </p>
          </div>
          <Link
            href={METER_NAV_ITEM.href}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[var(--color-action-red)] px-6 py-3 text-sm font-bold transition-colors hover:bg-[var(--color-action-red-dark)]"
          >
            Visit Meter
            <ArrowRightIcon size={16} />
          </Link>
        </section>
      </Container>
    </>
  );
}
