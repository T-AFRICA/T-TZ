import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@tronic/ui";
import { Reveal } from "@/components/motion/Reveal";
import type { CollectionResult } from "@/features/catalog/collections";
import { ProductCard } from "./ProductCard";

/**
 * Homepage collection layouts (owner brief 2026-11-12, sections 10–13).
 * Every one renders catalogue products through the shared ProductCard
 * (SAMPLE chip, wishlist, Add to Cart / Buy Now, product page link) and has
 * explicit empty and error states. Headings use the interface font; Arial
 * Black stays with the promotional banner.
 */

interface CollectionBase {
  /** id of the section heading. */
  id: string;
  title: string;
  description: string;
  viewAllHref: string;
  result: CollectionResult;
}

interface Photo {
  src: string;
  alt: string;
}

type NoticeProps = Pick<CollectionBase, "result" | "title" | "viewAllHref"> & {
  tone: "light" | "dark";
  /** Text when the catalogue has nothing for this collection. */
  emptyMessage?: string;
};

/** Empty or error state of a collection, with a way into its category. */
export function Notice({ result, title, viewAllHref, tone, emptyMessage = "No products in this collection yet." }: NoticeProps) {
  const message =
    result.status === "error" ? "These products could not be loaded right now. Please try again shortly." : emptyMessage;
  return (
    <div
      role={result.status === "error" ? "alert" : "status"}
      className={`flex flex-col items-center justify-between gap-3 rounded-2xl px-5 py-5 text-sm sm:flex-row sm:px-6 ${
        tone === "dark" ? "bg-white/[0.07] text-white/85" : "bg-[#f6f6f7] text-[var(--text-secondary)]"
      }`}
    >
      <p className="text-center sm:text-left">{message}</p>
      <Link
        href={viewAllHref}
        className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 font-semibold transition-colors ${
          tone === "dark"
            ? "bg-white text-[var(--color-premium-black)] hover:bg-[var(--color-action-red)] hover:text-white"
            : "bg-white text-[var(--text-primary)] shadow-[0_1px_3px_rgba(17,17,17,0.08)] hover:text-[var(--color-action-red)]"
        }`}
      >
        Browse {title}
        <ArrowRightIcon size={14} />
      </Link>
    </div>
  );
}

/** Product cards in a grid, or the collection's empty / error state. */
export function ProductGrid({
  result,
  title,
  viewAllHref,
  columns,
  tone = "light",
  emptyMessage,
  showSku = false,
}: Omit<NoticeProps, "tone"> & { columns: string; tone?: "light" | "dark"; showSku?: boolean }) {
  if (result.status !== "ok" || result.products.length === 0) {
    return <Notice result={result} title={title} viewAllHref={viewAllHref} tone={tone} emptyMessage={emptyMessage} />;
  }
  return (
    <ul className={`grid gap-3 md:gap-4 ${columns}`}>
      {result.products.map((product) => (
        <ProductCard key={product.id} product={product} showSku={showSku} />
      ))}
    </ul>
  );
}

export function ViewAll({ href, label, tone }: { href: string; label: string; tone: "red" | "light" }) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-1 text-sm font-semibold ${
        tone === "red" ? "text-[var(--color-action-red)]" : "text-white"
      } hover:underline`}
    >
      {label}
      <ArrowRightIcon size={14} />
    </Link>
  );
}

/**
 * A photo panel with the title and "View all" beside a product grid
 * (Switchgear & Protection, Garden Lights). `reverse` puts the panel on the
 * right from lg; on phones the panel sits above the grid.
 */
export function PanelCollection({
  id,
  title,
  description,
  viewAllHref,
  viewAllLabel,
  result,
  photo,
  reverse = false,
}: CollectionBase & { viewAllLabel: string; photo: Photo; reverse?: boolean }) {
  return (
    <section aria-labelledby={id} className="mt-8 md:mt-14">
      <Reveal>
        <div
          className={`grid grid-cols-[minmax(0,1fr)] gap-4 ${
            reverse
              ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
              : "lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]"
          }`}
        >
          <div className={`group relative isolate flex min-h-[13rem] flex-col justify-end overflow-hidden rounded-2xl bg-[var(--color-premium-black)] p-5 text-white md:min-h-[16rem] md:p-6 ${reverse ? "lg:order-2" : ""}`}>
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 1024px) 24rem, 100vw"
              className="-z-10 object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.04]"
            />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.05)_0%,rgba(0,0,0,0.35)_45%,rgba(0,0,0,0.82)_100%)]" />
            <h2 id={id} className="text-2xl font-bold leading-tight md:text-[length:var(--text-h3)]">
              {title}
            </h2>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/80">{description}</p>
            <Link
              href={viewAllHref}
              className="mt-4 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[var(--color-premium-black)] transition-colors hover:bg-[var(--color-action-red)] hover:text-white"
            >
              {viewAllLabel}
              <ArrowRightIcon size={15} />
            </Link>
          </div>
          <ProductGrid
            result={result}
            title={title}
            viewAllHref={viewAllHref}
            columns="grid-cols-2 sm:grid-cols-3"
          />
        </div>
      </Reveal>
    </section>
  );
}

/** Heading row with "View all", then a product grid (Adapters & Extensions). */
export function GridCollection({ id, title, description, viewAllHref, result }: CollectionBase) {
  return (
    <section aria-labelledby={id} className="mt-8 md:mt-14">
      <Reveal>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id={id} className="text-lg font-bold leading-tight md:text-[length:var(--text-h2)] md:tracking-[-0.01em]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
          </div>
          <ViewAll href={viewAllHref} label="View all" tone="red" />
        </div>
        <div className="mt-3 md:mt-5">
          <ProductGrid
            result={result}
            title={title}
            viewAllHref={viewAllHref}
            columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          />
        </div>
      </Reveal>
    </section>
  );
}

/**
 * A dark, lit band over architectural lighting photography with slow light
 * beams (spot-beam in globals.css, still under reduced motion) and a curated
 * product row (Spotlights — New Collection).
 */
export function SpotlightCollection({
  id,
  title,
  description,
  viewAllHref,
  result,
  photo,
}: CollectionBase & { photo: Photo }) {
  return (
    <section aria-labelledby={id} className="mt-8 md:mt-14">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-2xl bg-[#0f0c0b] px-4 py-6 text-white sm:px-6 md:px-8 md:py-9">
          <Image src={photo.src} alt={photo.alt} fill sizes="100vw" className="-z-20 object-cover opacity-40" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(15,12,11,0.55)_0%,rgba(15,12,11,0.8)_55%,rgba(15,12,11,0.95)_100%)]" />
          {/* Three soft beams from the ceiling */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full">
            {["left-[12%]", "left-[46%]", "left-[78%]"].map((position, index) => (
              <span
                key={position}
                className={`spot-beam absolute top-[-10%] ${position} h-[85%] w-[16rem] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(255,226,170,0.32),transparent_68%)] [clip-path:polygon(44%_0,56%_0,100%_100%,0_100%)]`}
                style={{ animationDelay: `${index * -3}s` }}
              />
            ))}
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 id={id} className="text-2xl font-bold leading-tight md:text-[length:var(--text-h2)]">
                {title}
              </h2>
              <p className="mt-1 max-w-lg text-sm text-white/75">{description}</p>
            </div>
            <ViewAll href={viewAllHref} label="View all" tone="light" />
          </div>
          {/* Cards are white: reset the band's white text for them. */}
          <div className="mt-5 text-[var(--text-primary)] md:mt-7">
            <ProductGrid
              result={result}
              title={title}
              viewAllHref={viewAllHref}
              columns="grid-cols-2 md:grid-cols-4"
              tone="dark"
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
