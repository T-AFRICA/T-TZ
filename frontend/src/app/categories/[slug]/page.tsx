import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, Container } from "@tronic/ui";
import { CATEGORY_SECTIONS, getCategorySection } from "@tronic/country-config";
import { CategoryArt } from "@/components/home/CategoryArt";

export function generateStaticParams() {
  return CATEGORY_SECTIONS.map((section) => ({ slug: section.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const section = getCategorySection(slug);
  return { title: section ? section.name : "Category" };
}

/**
 * Week 1 category landing shell: proves the route and group hierarchy.
 * Product listings, filters and sorting are built in W02-W05 against the
 * approved catalog content — group cards stay honest "coming soon" tiles
 * until then (no fabricated products or counts).
 */
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const section = getCategorySection(slug);
  if (!section) {
    notFound();
  }

  const otherSections = CATEGORY_SECTIONS.filter((other) => other.slug !== section.slug);

  return (
    <>
      {/* Page header band */}
      <div className="border-b border-[var(--color-light-grey)] bg-[var(--surface-alt)] max-md:border-b-0 max-md:bg-transparent">
        <Container className="relative py-8 lg:py-12">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-[var(--color-action-red)]">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-medium text-[var(--text-secondary)]">
                {section.name}
              </li>
            </ol>
          </nav>
          <p className="mt-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-action-red)]">
            <span aria-hidden="true" className="h-px w-8 bg-[var(--color-action-red)]" />
            Department
          </p>
          <h1 className="mt-3 text-[length:var(--text-h1)] font-bold leading-tight tracking-[-0.01em]">
            {section.name}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
            Product listings for this department are prepared in the upcoming build phase.
          </p>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 text-[var(--color-light-grey)] md:block lg:right-8"
          >
            <CategoryArt slug={section.slug} size={140} />
          </span>
        </Container>
      </div>

      <Container className="py-10 lg:py-14">
        <h2
          className="text-[length:var(--text-h3)] font-bold leading-tight"
          style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
        >
          Browse groups
        </h2>
        <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {section.groups.map((group) => (
            <li
              key={group.slug}
              className="flex items-center gap-4 rounded-xl border border-[var(--color-light-grey)] bg-white p-5 max-md:border-transparent max-md:shadow-[0_3px_14px_rgba(17,17,17,0.06)]"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--surface-card)] text-[var(--color-dark-grey)]">
                <CategoryArt slug={section.slug} size={24} />
              </span>
              <span>
                <span className="block font-semibold">{group.name}</span>
                <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                  Products arrive with the catalogue module
                </span>
              </span>
            </li>
          ))}
        </ul>

        {/* Cross-navigation to the other departments */}
        <nav aria-label="Other departments" className="mt-12">
          <h2
            className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
          >
            Explore other departments
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {otherSections.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/categories/${other.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-light-grey)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)] max-md:border-transparent max-md:shadow-sm"
                >
                  {other.name}
                  <ArrowRightIcon size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </>
  );
}
