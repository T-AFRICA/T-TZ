import Image from "next/image";
import Link from "next/link";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { ArrowRightIcon, Container, TrendingUpIcon } from "@tronic/ui";
import { Reveal } from "@/components/motion/Reveal";
import { loadCollection, loadOffers, loadProducts, type CollectionResult } from "@/features/catalog/collections";
import { Notice, ProductGrid, ViewAll } from "./CollectionSections";
import { ProductCard } from "./ProductCard";
import { ScrollRow } from "./ScrollRow";
import { TickerRow } from "./TickerRow";

/**
 * The eight core homepage sections (owner brief 2026-11-12), in order:
 * Offers & Promotions, Featured Products, Best-Selling Products, New
 * Arrivals, Shop Collections, Luxury Chandeliers & Lighting, Cables &
 * Wiring, New Arrival Wall Lights. Everything shown comes from the
 * catalogue (getCatalog) or the taxonomy; where the catalogue has no data
 * for a section it says so instead of inventing products, rankings or
 * offers:
 *   - Offers: products whose catalogue price is below their was-price.
 *   - Best-Selling: there is no sales data yet, so the section shows that
 *     it is waiting for it — no ranking is invented.
 *   - New Arrivals: catalogue order ("newest", the sequence column); the
 *     catalogue has no publish date per product, so no NEW badge.
 * Layouts differ per section: carousels, grids, an editorial collection
 * grid and photographic bands.
 */

/**
 * Featured Products: hand-picked by id (products with their real TRONIC
 * SKU). Edit this list to change the selection; unknown ids are skipped.
 */
const FEATURED_PRODUCT_IDS = [
  "sample-extension-4-way-usb-c",
  "sample-consumer-unit-10-way",
  "sample-track-spotlight-7w",
  "sample-garden-post-light-twin",
  "sample-mcb-4p-50a",
  "sample-adaptor-3-way-fused",
] as const;

/** Card widths inside a ScrollRow: about 2, 3, 4, 5 and 6 per view. */
const SCROLL_CARD = "w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23%] lg:w-[18.5%] xl:w-[15.5%]";
/** Fixed card width in the Offers ticker. */
const TICKER_CARD = "w-[12.5rem] shrink-0 md:w-[14rem]";
/**
 * Below this many offers one copy of the ticker can be narrower than the
 * band on wide screens (a product would show twice), so the row stays still.
 */
const TICKER_MIN_PRODUCTS = 5;
/** Every product, newest first (category pages sort newest by default). */
const ALL_PRODUCTS_HREF = "/categories/shop-by-use";

/** Editorial collections: categories not otherwise featured on the homepage. */
const COLLECTIONS = [
  { slug: "home-appliances", image: "/categories/home-appliances.webp", alt: "TRONIC stand fan in a bright living room" },
  { slug: "switches-sockets", image: "/categories/switches-sockets.webp", alt: "White twin socket with switches on a kitchen wall" },
  { slug: "cable-management", image: "/categories/cable-management.webp", alt: "Cables routed through galvanised cable trays in an industrial hall" },
  { slug: "tools", image: "/categories/tools.webp", alt: "Insulated pliers, screwdrivers and a digital multimeter" },
] as const;

function SectionHeading({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-bold leading-tight md:text-[length:var(--text-h2)] md:tracking-[-0.01em]">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function CardRow({ result, label, tone = "light", emptyHref, emptyMessage }: { result: CollectionResult; label: string; tone?: "light" | "dark"; emptyHref: string; emptyMessage: string }) {
  if (result.status !== "ok" || result.products.length === 0) {
    return <Notice result={result} title={label} viewAllHref={emptyHref} tone={tone} emptyMessage={emptyMessage} />;
  }
  return (
    <div className="text-[var(--text-primary)]">
      <ScrollRow label={label} tone={tone}>
        {result.products.map((product) => (
          <ProductCard key={product.id} product={product} className={SCROLL_CARD} />
        ))}
      </ScrollRow>
    </div>
  );
}

/** 01 — red band with a slowly moving row (ticker) of reduced products. */
function OffersSection({ result }: { result: CollectionResult }) {
  return (
    <section aria-labelledby="home-offers" className="mt-8 md:mt-12">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#d71920_0%,#9e1118_100%)] px-4 py-6 text-white sm:px-6 md:px-8 md:py-8">
          <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full border-[40px] border-white/[0.06]" />
          <div aria-hidden="true" className="absolute -bottom-32 left-1/3 -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_65%)]" />
          <h2 id="home-offers" className="font-display text-[clamp(1.6rem,1.1rem+1.6vw,2.4rem)] leading-tight">
            Offers &amp; Promotions
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/85">Products with a reduced price in our catalogue.</p>
          <div className="mt-5">
            {/* A slow ticker like the category rail (owner request
                2026-11-12) once there are enough offers for each copy to be
                wider than the band; fewer offers stay a swipeable row. */}
            {result.status === "ok" && result.products.length >= TICKER_MIN_PRODUCTS ? (
              <div className="-mx-4 text-[var(--text-primary)] sm:-mx-6 md:-mx-8">
                <TickerRow label="Offers" seconds={result.products.length * 6}>
                  {result.products.map((product) => (
                    <ProductCard key={product.id} product={product} className={TICKER_CARD} />
                  ))}
                </TickerRow>
              </div>
            ) : (
              <CardRow
                result={result}
                label="Offers"
                tone="dark"
                emptyHref={ALL_PRODUCTS_HREF}
                emptyMessage="There are no reduced prices right now."
              />
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** 02 — grid of hand-picked products with SKU. */
function FeaturedSection({ result }: { result: CollectionResult }) {
  return (
    <section aria-labelledby="home-featured" className="mt-8 md:mt-14">
      <Reveal>
        <SectionHeading
          id="home-featured"
          title="Featured Products"
          description="Hand-picked TRONIC products across our departments."
          action={<ViewAll href={ALL_PRODUCTS_HREF} label="View all" tone="red" />}
        />
        <div className="mt-3 md:mt-5">
          <ProductGrid
            result={result}
            title="all products"
            viewAllHref={ALL_PRODUCTS_HREF}
            columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
            showSku
          />
        </div>
      </Reveal>
    </section>
  );
}

/** Departments offered while best-seller rankings wait for sales data (not a ranking). */
const BROWSE_DEPARTMENTS = ["lighting", "switchgear-protection", "switches-sockets", "cables-wiring"] as const;

/**
 * 03 — no sales data yet: say so instead of inventing a ranking, and offer
 * the main departments (in taxonomy order, not by popularity).
 */
function BestSellersSection() {
  const departments = BROWSE_DEPARTMENTS.map((slug) => CATEGORY_SECTIONS.find((section) => section.slug === slug)).filter(
    (section): section is (typeof CATEGORY_SECTIONS)[number] => section !== undefined,
  );
  return (
    <section aria-labelledby="home-best-sellers" className="mt-8 md:mt-14">
      <Reveal>
        <div className="grid items-center gap-5 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#f7f7f8_0%,#efeff1_100%)] p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:p-8">
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-[var(--color-action-red)] shadow-[0_2px_8px_rgba(17,17,17,0.08)]">
              <TrendingUpIcon size={22} />
            </span>
            <div className="min-w-0">
              <h2 id="home-best-sellers" className="text-lg font-bold leading-tight md:text-[length:var(--text-h3)]">
                Best-Selling Products
              </h2>
              <p role="status" className="mt-1.5 text-sm text-[var(--text-secondary)]">
                Best-seller rankings are waiting for sales data. This section will list our top sellers once real sales are
                recorded; until then no ranking is shown.
              </p>
            </div>
          </div>
          <ul aria-label="Shop departments" className="grid grid-cols-2 gap-2.5">
            {departments.map((section) => (
              <li key={section.slug}>
                <Link
                  href={`/categories/${section.slug}`}
                  className="group flex h-full items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold shadow-[0_1px_3px_rgba(17,17,17,0.06)] transition-[box-shadow,color] hover:text-[var(--color-action-red)] hover:shadow-[0_8px_20px_-10px_rgba(17,17,17,0.3)]"
                >
                  <span className="min-w-0">{section.name}</span>
                  <ArrowRightIcon size={14} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}

/** 04 — newest catalogue products in a swipeable row. */
function NewArrivalsSection({ result }: { result: CollectionResult }) {
  return (
    <section aria-labelledby="home-new-arrivals" className="mt-8 md:mt-14">
      <Reveal>
        <SectionHeading
          id="home-new-arrivals"
          title="New Arrivals"
          description="The latest products in our catalogue."
          action={<ViewAll href={ALL_PRODUCTS_HREF} label="View all" tone="red" />}
        />
        <div className="mt-3 md:mt-5">
          <CardRow result={result} label="New arrivals" emptyHref={ALL_PRODUCTS_HREF} emptyMessage="No products in the catalogue yet." />
        </div>
      </Reveal>
    </section>
  );
}

/** 05 — editorial grid of large photographic collection cards. */
function ShopCollectionsSection() {
  const cards = COLLECTIONS.map((collection) => {
    const section = CATEGORY_SECTIONS.find((item) => item.slug === collection.slug);
    if (!section) throw new Error(`Unknown collection category "${collection.slug}"`);
    return { ...collection, name: section.name, description: section.description ?? "" };
  });
  return (
    <section aria-labelledby="home-collections" className="mt-8 md:mt-14">
      <Reveal>
        <SectionHeading id="home-collections" title="Shop Collections" description="Explore our departments." />
        <ul className="mt-3 grid grid-cols-2 gap-3 md:mt-5 md:h-[30rem] md:grid-cols-4 md:grid-rows-2 md:gap-4 lg:h-[34rem]">
          {cards.map((card, index) => (
            <li
              key={card.slug}
              className={`min-w-0 ${index === 0 ? "col-span-2 md:row-span-2" : index === 1 ? "col-span-2" : ""}`}
            >
              <Link
                href={`/categories/${card.slug}`}
                className={`group relative isolate flex h-full flex-col justify-end overflow-hidden rounded-2xl bg-[var(--color-premium-black)] p-4 text-white md:p-6 ${
                  index === 0 ? "aspect-[16/10] md:aspect-auto" : index === 1 ? "aspect-[2/1] md:aspect-auto" : "aspect-square md:aspect-auto"
                }`}
              >
                <Image
                  src={card.image}
                  alt={card.alt}
                  fill
                  sizes={index === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
                  className="-z-10 object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105"
                />
                <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_35%,rgba(0,0,0,0.78)_100%)] transition-opacity duration-300 group-hover:opacity-90" />
                <h3 className={`font-bold leading-tight ${index === 0 ? "text-2xl md:text-3xl" : "text-base md:text-xl"}`}>{card.name}</h3>
                <p className={`mt-1 text-xs text-white/80 md:text-sm ${index > 1 ? "max-md:hidden" : ""}`}>{card.description}</p>
                <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold md:text-sm">
                  Shop collection
                  <ArrowRightIcon size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

/** 06 — warm cinematic band over the pendant photograph, products below. */
function ChandeliersSection({ result }: { result: CollectionResult }) {
  const href = "/categories/lighting/decorative-lighting";
  return (
    <section aria-labelledby="home-chandeliers" className="mt-8 md:mt-14">
      <Reveal>
        {/* One warm band: the pendant photograph behind everything, the copy
            on the left and the products on the right from lg (below lg they
            follow the copy). */}
        <div className="relative isolate grid items-center gap-6 overflow-hidden rounded-2xl bg-[#16100b] px-4 py-7 text-white sm:px-6 md:px-10 md:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <Image
            src="/banners/pendants-warm-wall.webp"
            alt="Woven and slatted wooden pendant lamps glowing warmly against a dark wall"
            fill
            sizes="100vw"
            className="-z-20 object-cover object-[70%_center]"
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(22,16,11,0.94)_0%,rgba(22,16,11,0.72)_45%,rgba(22,16,11,0.35)_100%)]" />
          <div aria-hidden="true" className="promo-glow absolute right-[30%] top-[20%] -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,196,120,0.3),transparent_65%)]" />
          <div>
            <div className="max-w-lg">
              <h2 id="home-chandeliers" className="font-display text-[clamp(1.6rem,1.1rem+1.8vw,2.6rem)] leading-[1.08]">
                Luxury Chandeliers &amp; Lighting
              </h2>
              <p className="mt-2 text-sm text-white/80 md:text-base">Pendants, chandeliers and ceiling lights that set the mood of a room.</p>
              <Link
                href={href}
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[var(--color-premium-black)] transition-colors hover:bg-[var(--color-action-red)] hover:text-white"
              >
                Shop collection
                <ArrowRightIcon size={15} />
              </Link>
            </div>
          </div>
          <div className="text-[var(--text-primary)]">
            <ProductGrid
              result={result}
              title="Decorative Lighting"
              viewAllHref={href}
              columns="grid-cols-2"
              tone="dark"
              emptyMessage="No chandeliers or pendants in the catalogue yet."
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** 07 — industrial photo panel with sub-collection links beside cable products. */
function CablesSection({ result }: { result: CollectionResult }) {
  const section = CATEGORY_SECTIONS.find((item) => item.slug === "cables-wiring");
  const groups = section?.groups.slice(0, 3) ?? [];
  const href = "/categories/cables-wiring";
  return (
    <section aria-labelledby="home-cables" className="mt-8 md:mt-14">
      <Reveal>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="group relative isolate flex min-h-[16rem] flex-col justify-end overflow-hidden rounded-2xl bg-[var(--color-premium-black)] p-5 text-white md:min-h-[22rem] md:p-8">
            <Image
              src="/categories/cables-wiring.webp"
              alt="Cross-section of an armoured power cable showing its copper conductors"
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="-z-10 object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
            />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.45)_45%,rgba(0,0,0,0.88)_100%)]" />
            <h2 id="home-cables" className="text-2xl font-bold leading-tight md:text-[length:var(--text-h2)]">
              Cables &amp; Wiring
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-white/80">Power, data and signal cables with the accessories to install them.</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {groups.map((group) => (
                <li key={group.slug}>
                  <Link
                    href={`${href}/${group.slug}`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/40 bg-black/20 px-4 text-sm font-semibold backdrop-blur-sm transition-colors hover:border-white hover:bg-white hover:text-[var(--color-premium-black)]"
                  >
                    {group.name}
                    <ArrowRightIcon size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Cable products</p>
              <ViewAll href={href} label="View all" tone="red" />
            </div>
            <ProductGrid
              result={result}
              title="Cables & Wiring"
              viewAllHref={href}
              // One product gets one comfortable column rather than half a grid.
              columns={result.status === "ok" && result.products.length === 1 ? "grid-cols-1 max-w-[17rem]" : "grid-cols-2"}
              emptyMessage="No cable products in the catalogue yet."
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/**
 * 08 — wall-light photograph beside the copy, products below. With no wall
 * lights in the catalogue the note sits in the band itself rather than as
 * an empty box under it.
 */
function WallLightsSection({ result }: { result: CollectionResult }) {
  const href = "/categories/lighting/indoor-lighting/led-wall-lights";
  const empty = result.status === "ok" && result.products.length === 0;
  return (
    <section aria-labelledby="home-wall-lights" className="mt-8 md:mt-14">
      <Reveal>
        {/* The photo's own black background continues into the band, so the
            whole showcase is shown at its proportions beside the text. */}
        <div className="grid items-center overflow-hidden rounded-2xl bg-[#0b0b0e] text-white md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)]">
          <div className="relative aspect-[1120/500] md:order-2">
            <Image
              src="/banners/wall-lights-showcase.webp"
              alt="Stainless steel wall lights on a lit display stand"
              fill
              sizes="(min-width: 768px) 60vw, 100vw"
              className="object-cover"
            />
            <div aria-hidden="true" className="absolute inset-y-0 left-0 hidden w-1/4 bg-[linear-gradient(90deg,#0b0b0e,transparent)] md:block" />
          </div>
          <div className="px-5 py-6 md:px-10 md:py-8">
            <h2 id="home-wall-lights" className="text-2xl font-bold leading-tight md:text-[length:var(--text-h2)]">
              New Arrival Wall Lights
            </h2>
            <p className="mt-1.5 text-sm text-white/80">Modern wall lights for living rooms, stairways and facades.</p>
            {empty ? (
              <p role="status" className="mt-3 text-xs text-white/55">
                No wall lights are listed in the catalogue yet.
              </p>
            ) : null}
            <Link
              href={href}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[var(--color-premium-black)] transition-colors hover:bg-[var(--color-action-red)] hover:text-white"
            >
              View all wall lights
              <ArrowRightIcon size={15} />
            </Link>
          </div>
        </div>
        {!empty ? (
          <div className="mt-4">
            <ProductGrid
              result={result}
              title="Wall Lights"
              viewAllHref={href}
              columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
            />
          </div>
        ) : null}
      </Reveal>
    </section>
  );
}

export async function HomeEssentials() {
  const [offers, featured, newArrivals, chandeliers, cables, wallLights] = await Promise.all([
    loadOffers(8),
    loadProducts(FEATURED_PRODUCT_IDS),
    loadCollection([{}], 8),
    loadCollection(
      [
        { category: "lighting", group: "decorative-lighting" },
        { category: "lighting", group: "indoor-lighting", subcategory: "ceiling-lights" },
      ],
      4,
    ),
    loadCollection([{ category: "cables-wiring" }], 4),
    loadCollection([
      { category: "lighting", group: "indoor-lighting", subcategory: "led-wall-lights" },
      { category: "lighting", group: "indoor-lighting", subcategory: "indoor-wall-brackets" },
      { category: "lighting", group: "outdoor-lighting", subcategory: "outdoor-wall-brackets" },
    ]),
  ]);

  return (
    <Container>
      <OffersSection result={offers} />
      <FeaturedSection result={featured} />
      <BestSellersSection />
      <NewArrivalsSection result={newArrivals} />
      <ShopCollectionsSection />
      <ChandeliersSection result={chandeliers} />
      <CablesSection result={cables} />
      <WallLightsSection result={wallLights} />
    </Container>
  );
}
