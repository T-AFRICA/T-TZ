import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";

/**
 * Owner-supplied TRONIC product photographs, cut out of their studio
 * background (frontend/public/auth; the same set as the account screens).
 */
const ART = {
  stabilizer: { src: "/auth/stabilizer.webp", alt: "TRONIC voltage stabilizer" },
  heater: { src: "/auth/water-heater.webp", alt: "TRONIC water heater" },
  fan: { src: "/auth/exhaust-fan.webp", alt: "TRONIC exhaust fan" },
  bulb: { src: "/auth/bulb-a60.webp", alt: "TRONIC LED bulb" },
  cable: { src: "/auth/cable.webp", alt: "TRONIC single core cable" },
  chandelier: { src: "/auth/chandelier.webp", alt: "Pendant chandelier" },
} as const;

function Cutout({ name, className, sizes }: { name: keyof typeof ART; className: string; sizes: string }) {
  const { src, alt } = ART[name];
  return (
    <span className={`absolute block ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-contain object-bottom" />
    </span>
  );
}

/**
 * Premium brand banner between the category rail and the product
 * collections (owner brief 2026-11-12, section 9). Full width, dark, with
 * TRONIC products on a lit platform under a pendant; the warm light
 * breathes slowly (promo-glow in globals.css, still under reduced motion).
 * Brand message only — the owner chose no offer, so there are no prices,
 * discounts or claims. Headline in Arial Black (.font-display).
 */
export function PromoBanner() {
  return (
    <section
      aria-labelledby="promo-banner-title"
      className="relative mt-6 overflow-hidden bg-[#141011] text-white md:mt-14"
    >
      {/* Depth: red bloom left, warm light right, fine top edge */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/2 h-[36rem] w-[36rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(215,25,32,0.32),transparent_62%)]" />
        <div className="promo-glow absolute right-[-6rem] top-[-8rem] h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,rgba(255,190,120,0.22),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>

      <Container className="relative grid items-center gap-6 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-10 md:py-14 lg:py-16">
        <div className="max-md:text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#ff6b72]">TRONIC Tanzania</p>
          <h2
            id="promo-banner-title"
            className="font-display mt-3 text-[clamp(2rem,1.2rem+2.8vw,3.4rem)] leading-[1.04]"
          >
            Your electrical <span className="text-[var(--color-brand-red)]">partner.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75 max-md:mx-auto md:text-base">
            Lighting, cables, switchgear and appliances for homes, businesses and industry.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 max-md:justify-center">
            <Link
              href="/categories/lighting"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--color-action-red)] px-6 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(215,25,32,0.8)] transition-colors hover:bg-[var(--color-action-red-dark)]"
            >
              Shop lighting
              <ArrowRightIcon size={16} />
            </Link>
            <Link
              href="/categories/shop-by-use"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/35 px-6 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white hover:text-[var(--color-premium-black)]"
            >
              Shop by use
            </Link>
          </div>
        </div>

        {/* Products on a lit platform under a pendant */}
        <div className="relative mx-auto aspect-[16/10] w-full max-w-[40rem]">
          <span aria-hidden="true" className="absolute right-[9%] top-0 h-[16%] w-[2px] bg-gradient-to-b from-white/0 to-white/40" />
          <span
            aria-hidden="true"
            className="promo-glow absolute right-[-4%] top-[2%] h-[60%] w-[46%] rounded-full bg-[radial-gradient(closest-side,rgba(255,205,130,0.5),rgba(255,150,70,0.14)_55%,transparent)]"
          />
          <Cutout name="chandelier" className="right-[1%] top-[14%] h-[44%] w-[18%] drop-shadow-[0_0_22px_rgba(255,200,120,0.5)]" sizes="(min-width: 768px) 8rem, 20vw" />

          {/* Platform with a red LED rim */}
          <div aria-hidden="true" className="absolute bottom-[3%] left-[2%] right-[18%] h-[22%]">
            <span className="absolute inset-x-0 bottom-[18%] h-[62%] rounded-[50%] bg-[linear-gradient(180deg,#f2eeee_0%,#a9a1a1_55%,#4d4646_100%)] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)]" />
            <span className="absolute inset-x-0 bottom-[16%] h-[66%] rounded-[50%] border-b-[3px] border-[#ff4a3a] shadow-[0_12px_30px_-4px_rgba(255,50,40,0.85)]" />
            <span className="absolute inset-x-[8%] top-[6%] h-[38%] rounded-[50%] bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0.1))]" />
            <span className="promo-glow absolute left-[34%] top-[-8%] h-[84%] w-[40%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,205,135,0.6),transparent)]" />
          </div>

          <div className="absolute bottom-[14%] left-[2%] right-[18%] top-[6%]">
            <Cutout name="stabilizer" className="bottom-[10%] left-[12%] h-[86%] w-[30%]" sizes="(min-width: 768px) 13rem, 30vw" />
            <Cutout name="heater" className="bottom-[16%] left-[55%] h-[42%] w-[26%]" sizes="(min-width: 768px) 9rem, 22vw" />
            <Cutout name="fan" className="bottom-0 left-[-2%] h-[34%] w-[20%]" sizes="(min-width: 768px) 8rem, 20vw" />
            {/* LED bulb, switched on: warm halo behind the globe */}
            <span className="absolute bottom-0 left-[40%] block aspect-[334/609] w-[14%]">
              <span
                aria-hidden="true"
                className="promo-glow absolute left-1/2 top-[27%] h-[150%] w-[310%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,214,150,0.55),rgba(255,170,90,0.16)_55%,transparent)]"
              />
              <Image src={ART.bulb.src} alt={ART.bulb.alt} fill sizes="(min-width: 768px) 6rem, 14vw" className="object-contain" />
            </span>
            <Cutout name="cable" className="bottom-0 right-[-4%] h-[24%] w-[42%]" sizes="(min-width: 768px) 14rem, 36vw" />
          </div>
        </div>
      </Container>
    </section>
  );
}
