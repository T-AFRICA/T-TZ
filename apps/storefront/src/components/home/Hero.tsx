import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@tronic/ui";

/**
 * "Power Every Space" hero (owner direction 2026-11-05, replaces the dark
 * single-bulb scene): a light, gallery-like interior where three TRONIC
 * alabaster pendants — the real product photo, background removed — hang
 * at staggered heights and switch on in sequence. The dim room, the pulse
 * running down each cord, the warm glows and floor light-pools, and the
 * gentle after-breathing are all pure CSS (see hero4-* in globals.css):
 * no client JS, nothing hidden in server HTML, fixed heights (no CLS),
 * and reduced motion lands directly on the fully lit room. TRONIC red
 * appears only as the accent word and the CTA. No floating cards, orbits
 * or particles; copy is generic brand messaging with no offers or claims.
 */

interface PendantProps {
  /** Group position + width (the photo box is a square of this width). */
  groupClassName: string;
  /** Extra cord drawn from the ceiling down to the photo box. */
  cordClassName: string;
  /** Photo box offset below the ceiling (same length as the cord). */
  boxClassName: string;
  /** Seconds into the timeline when this lamp turns on. */
  onDelay: number;
  /** Pulse travel distance down the cord, in px. */
  drop: number;
  sizes: string;
  priority?: boolean;
}

function Pendant({
  groupClassName,
  cordClassName,
  boxClassName,
  onDelay,
  drop,
  sizes,
  priority,
}: PendantProps) {
  const style = { "--on-delay": `${onDelay}s`, "--drop": `${drop}px` } as React.CSSProperties;
  return (
    <div className={`absolute top-0 ${groupClassName}`} style={style}>
      {/* Cord extension from the ceiling to the fixture's own canopy */}
      <span aria-hidden="true" className={`absolute left-1/2 top-0 w-px bg-[#c9c2b3] ${cordClassName}`} />
      {/* Square photo box — percentages below match the 1:1 product photo */}
      <div className={`absolute inset-x-0 aspect-square ${boxClassName}`}>
        <Image
          src="/products/pendant-hero.png"
          alt=""
          fill
          priority={priority}
          sizes={sizes}
          className="hero4-lamp object-contain"
        />
        {/* Warm glow hugging the shade (shade centre ≈ x 51% / y 83%) */}
        <span
          aria-hidden="true"
          className="hero4-glow absolute left-[51%] top-[84%] h-[36%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,196,120,0.65)_0%,rgba(255,170,90,0.24)_48%,transparent_72%)] blur-[6px]"
        />
        {/* Hot core on the lit shade — the unmistakable "it is on" signal */}
        <span
          aria-hidden="true"
          className="hero4-glow absolute left-[51%] top-[82%] h-[16%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,228,180,0.95)_0%,rgba(255,200,130,0.5)_55%,transparent_80%)] blur-[3px] mix-blend-screen"
        />
      </div>
      {/* Energy pulse sliding down from the ceiling */}
      <span
        aria-hidden="true"
        className="hero4-pulse absolute left-1/2 top-0 h-4 w-[3px] -translate-x-1/2 rounded-full bg-[#ffd9a0] shadow-[0_0_8px_2px_rgba(255,190,110,0.9)]"
      />
    </div>
  );
}

export function Hero() {
  return (
    <section
      aria-label="TRONIC — electrical supplies, lighting and switchgear"
      className="relative overflow-hidden bg-[#f6f3ee] text-[var(--color-premium-black)]"
    >
      {/* Interior: warm wall with a soft floor band at the base */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,#f8f6f1_0%,#f4f0e9_68%,#e9e4da_82%,#efebe2_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[14%] h-px bg-[#d9d2c4]/60"
      />

      <div className="relative mx-auto grid min-h-[26rem] w-full max-w-[120rem] items-center gap-6 px-[var(--gutter)] py-10 md:min-h-[28rem] md:grid-cols-[1.05fr_0.95fr] md:py-12 lg:min-h-[30rem] lg:px-8">
        {/* Copy */}
        <div className="max-md:text-center">
          <p className="animate-[hero-copy-in_500ms_ease-out_both] text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
            TRONIC · Lighting &amp; Electrical
          </p>
          <h1
            className="mt-3 animate-[hero-copy-in_500ms_ease-out_120ms_both] text-[length:var(--text-h1)] font-bold leading-[1.06] tracking-[-0.01em]"
            style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
          >
            Power Every
            <span className="block text-[var(--color-brand-red)]">Space.</span>
          </h1>
          <p className="mt-4 max-w-md animate-[hero-copy-in_500ms_ease-out_240ms_both] text-sm leading-relaxed text-[var(--text-secondary)] max-md:mx-auto md:text-[15px]">
            Discover premium lighting, wiring, and electrical solutions for homes, businesses,
            and industries.
          </p>
          <div className="mt-7 animate-[hero-copy-in_500ms_ease-out_360ms_both]">
            <Link
              href="/#departments"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-action-red)] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(215,25,32,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-action-red-dark)]"
            >
              Explore Products
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>

        {/* The lighting installation: three real TRONIC pendants, staggered.
            Fixed-height stage; overflow keeps long cords tidy. */}
        <div aria-hidden="true" className="relative mx-auto h-64 w-full max-w-[26rem] sm:h-72 md:h-[24rem] md:max-w-none lg:h-[26rem]">
          {/* Floor light-pools, one under each shade */}
          <span className="hero4-glow absolute bottom-[3%] left-[3%] h-4 w-[26%] rounded-[100%] bg-[radial-gradient(ellipse,rgba(255,185,105,0.4),transparent_70%)] blur-[5px] [--on-delay:1.9s]" />
          <span className="hero4-glow absolute bottom-[1%] left-[36%] h-5 w-[32%] rounded-[100%] bg-[radial-gradient(ellipse,rgba(255,185,105,0.5),transparent_70%)] blur-[5px] [--on-delay:1.2s]" />
          <span className="hero4-glow absolute bottom-[5%] right-[3%] h-4 w-[22%] rounded-[100%] bg-[radial-gradient(ellipse,rgba(255,185,105,0.35),transparent_70%)] blur-[5px] [--on-delay:2.6s]" />

          {/* Fixtures: the same authentic pendant at three staggered drops,
              like a showroom multi-pendant installation. Centre hangs
              lowest; each photo box is square so glow percentages hold. */}
          <Pendant
            groupClassName="left-[31%] w-[38%]"
            cordClassName="h-14 md:h-24"
            boxClassName="top-14 md:top-24"
            onDelay={1.2}
            drop={260}
            sizes="(min-width: 768px) 15rem, 9rem"
            priority
          />
          <Pendant
            groupClassName="left-[1%] w-[32%]"
            cordClassName="h-4 md:h-8"
            boxClassName="top-4 md:top-8"
            onDelay={1.9}
            drop={190}
            sizes="(min-width: 768px) 12rem, 8rem"
          />
          <Pendant
            groupClassName="right-[1%] w-[27%]"
            cordClassName="h-1 md:h-2"
            boxClassName="top-1 md:top-2"
            onDelay={2.6}
            drop={140}
            sizes="(min-width: 768px) 10rem, 6rem"
          />

          {/* Room dim: fades away as the lamps come on */}
          <span className="hero4-dim pointer-events-none absolute inset-[-10%] bg-[#241c10]/40" />
        </div>
      </div>

      {/* Dim pass over the copy side too, so the whole room brightens as one */}
      <span
        aria-hidden="true"
        className="hero4-dim pointer-events-none absolute inset-0 hidden bg-[#241c10]/20 md:block"
      />

      {/* Hairline base seam with a strategic touch of brand red */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(215,25,32,0.35),transparent)]"
      />
    </section>
  );
}
