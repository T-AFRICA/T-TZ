import { notFound } from "next/navigation";
import { Container } from "@tronic/ui";
import { CATEGORY_SECTIONS, getCategorySection } from "@tronic/country-config";

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
 * approved catalog content.
 */
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const section = getCategorySection(slug);
  if (!section) {
    notFound();
  }

  return (
    <Container className="py-10">
      <h1 className="text-[length:var(--text-h1)] font-bold leading-tight">{section.name}</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Product listings for this category are prepared in the upcoming build phase.
      </p>
      <h2 className="mt-8 text-lg font-bold">Browse groups</h2>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {section.groups.map((group) => (
          <li key={group.slug} className="rounded-lg bg-card p-5">
            <span className="font-semibold">{group.name}</span>
            <span className="mt-1 block text-sm text-[var(--text-muted)]">Products coming soon</span>
          </li>
        ))}
      </ul>
    </Container>
  );
}
