import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, Container } from "@tronic/ui";

/** Canopy-to-shade run of each cord, in the frames' 2000x500 coordinate space. */
const CORDS = [
  { x: 1192, top: 28, bottom: 215, delay: "0s" },
  { x: 1428, top: 26, bottom: 205, delay: "0.35s" },
  { x: 1665, top: 26, bottom: 158, delay: "0.7s" },
] as const;

/** The two scene frames below are sized by this; sizes reflect the cover crop. */
const SCENE_SIZES =
  "(min-width: 1536px) 105vw, (min-width: 1280px) 125vw, (min-width: 1024px) 145vw, (min-width: 768px) 175vw, 210vw";

/**
 * Places a layer by its box in the frames' 2000x500 space. The unit is the scene's
 * cover scale, and the anchor is the crop's bottom-right, so layers track the photo.
 */
function sceneBox(x: number, y: number, width: number, height: number) {
  const unit = "max(100cqw / 2000, 100cqh / 500)";
  return {
    width: `calc(${width} * ${unit})`,
    height: `calc(${height} * ${unit})`,
    right: `calc(${2000 - x - width} * ${unit})`,
    bottom: `calc(${500 - y - height} * ${unit})`,
  };
}

/**
 * The stand fan: blades turning behind its still body, with lit and dim frames.
 * rotorClassName puts the blades' axis on the axis of that frame's own fan.
 */
function StandFan({
  frame,
  rotorClassName,
  bodySizes,
  rotorSizes,
}: {
  frame: "floor" | "solo";
  rotorClassName: string;
  bodySizes: string;
  rotorSizes: string;
}) {
  return (
    <>
      <div className={`hero-fan-spin absolute ${rotorClassName}`}>
        <Image src="/banners/hero-standfan-rotor-lit.webp" alt="" fill quality={85} sizes={rotorSizes} />
        <Image
          src="/banners/hero-standfan-rotor-dim.webp"
          alt=""
          fill
          quality={85}
          sizes={rotorSizes}
          className="hero-room-dim"
        />
      </div>
      <Image src={`/banners/hero-standfan-${frame}-lit.webp`} alt="" fill quality={90} sizes={bodySizes} />
      <Image
        src={`/banners/hero-standfan-${frame}-dim.webp`}
        alt=""
        fill
        quality={85}
        sizes={bodySizes}
        className="hero-room-dim"
      />
    </>
  );
}

/**
 * "Power Every Space" hero: TRONIC's own campaign photograph of its pendants
 * (offer text cropped out, wall extended left), rebuilt as one room with a floor,
 * skirting and wall-fixed electrical accessories baked into the frames. The official
 * stand fan stands in the room: beside a mounted backlit mirror on wide screens, in
 * front of the slatted wall below that. The dim frames are pre-rendered too, so
 * switching on is a crossfade between images rather than glows painted over a
 * product. Pure CSS, so the server HTML always shows the lit scene and no client JS
 * is needed.
 */
export function Hero() {
  return (
    <section
      aria-label="TRONIC — electrical supplies, lighting and switchgear"
      className="relative flex flex-col overflow-hidden bg-[#f6f3ee] text-[var(--color-premium-black)] lg:min-h-[max(22rem,30vw)] lg:justify-center lg:bg-[#2b221e] lg:text-white 2xl:min-h-[30rem]"
    >
      <Container className="relative z-10 py-9 max-lg:text-center max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:pb-3.5 max-md:pt-0 lg:py-10">
        <div className="lg:max-w-[32%] xl:max-w-[24rem]">
          {/* Phones show only the banner and CTA; the copy stays for screen
              readers and search engines. */}
          <p className="flex animate-[hero-copy-in_500ms_ease-out_both] items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)] max-lg:justify-center max-md:sr-only lg:text-white/75">
            <span aria-hidden="true" className="hidden h-px w-8 bg-[var(--color-brand-red)] xl:block" />
            TRONIC · Lighting &amp; Electrical
          </p>
          <h1
            className="mt-3 animate-[hero-copy-in_500ms_ease-out_120ms_both] text-[length:var(--text-display)] font-bold leading-[1.04] tracking-[-0.015em] max-md:sr-only"
            style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
          >
            Power Every
            <span className="block text-[var(--color-brand-red)]">Space.</span>
          </h1>
          <p className="mt-4 max-w-md animate-[hero-copy-in_500ms_ease-out_240ms_both] text-sm leading-relaxed text-[var(--text-secondary)] max-lg:mx-auto max-md:sr-only md:text-[15px] lg:text-white/80">
            Discover premium lighting, wiring, and electrical solutions for homes, businesses, and
            industries.
          </p>
          <div className="animate-[hero-copy-in_500ms_ease-out_360ms_both] md:mt-6">
            <Link
              href="/#departments"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-action-red)] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(215,25,32,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-action-red-dark)]"
            >
              Explore Products
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </Container>

      {/* The SVG's xMaxYMax slice must stay in step with the images'
          object-right-bottom cover crop, or the pulses and fan drift. */}
      <div
        aria-hidden="true"
        className="relative w-full overflow-hidden bg-[#2b221e] max-md:pb-16 md:h-[21rem] lg:absolute lg:inset-0 lg:h-auto"
      >
        {/* On phones this 96:50 box shows all three lamps edge to edge; the
            strip below it, in the wall colour, carries the CTA. */}
        <div className="relative aspect-[96/50] w-full [container-type:size] md:absolute md:inset-0 md:aspect-auto">
          <Image
            src="/banners/hero-showroom-lit.webp"
            alt=""
            fill
            priority
            quality={90}
            sizes={SCENE_SIZES}
            className="object-cover object-right-bottom"
          />
          <Image
            src="/banners/hero-showroom-dim.webp"
            alt=""
            fill
            priority
            quality={85}
            sizes={SCENE_SIZES}
            className="hero-room-dim object-cover object-right-bottom"
          />
          {/* Keeps the brand-red headline at 3:1 or better on the lit wall. It sits
              under the fan and mirror so they stay at full brightness. */}
          <div className="absolute inset-0 hidden bg-[linear-gradient(to_right,rgba(0,0,0,0.42),rgba(0,0,0,0.42)_22%,transparent_38%)] lg:block" />
          {/* Below xl the copy needs this part of the wall. */}
          <div className="absolute inset-0 hidden xl:block">
            <div className="absolute" style={sceneBox(793, 9, 218, 218)}>
              <Image src="/banners/hero-mirror-mounted.webp" alt="" fill quality={85} sizes="13vw" />
              <Image
                src="/banners/hero-mirror-mounted-glow.webp"
                alt=""
                fill
                quality={85}
                sizes="13vw"
                className="hero-room-glow"
              />
            </div>
            <div className="absolute" style={sceneBox(880, 10, 262.6, 490)}>
              <StandFan
                frame="floor"
                rotorClassName="left-[38.9%] top-[5.81%] h-[23.62%] w-[44.05%]"
                bodySizes="19vw"
                rotorSizes="9vw"
              />
            </div>
          </div>
          <svg
            viewBox="0 0 2000 500"
            preserveAspectRatio="xMaxYMax slice"
            className="absolute inset-0 h-full w-full"
          >
            {CORDS.map((cord) => (
              <path
                key={cord.x}
                d={`M${cord.x} ${cord.top}V${cord.bottom}`}
                pathLength={100}
                fill="none"
                stroke="#ffe2b0"
                strokeWidth={3}
                strokeLinecap="round"
                className="hero-cord-flow"
                style={{ animationDelay: cord.delay }}
              />
            ))}
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-b from-transparent to-[#2b221e] md:hidden" />
          {/* In front of the slatted wall, above the fade so its base stays clear. */}
          <div className="absolute xl:hidden" style={sceneBox(1727, 10, 228.6, 490)}>
            <StandFan
              frame="solo"
              rotorClassName="left-[29.8%] top-[5.81%] h-[23.62%] w-[50.61%]"
              bodySizes="(min-width: 768px) 17vw, 30vw"
              rotorSizes="(min-width: 768px) 9vw, 16vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
