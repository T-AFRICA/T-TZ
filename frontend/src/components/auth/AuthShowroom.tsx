import Image from "next/image";
import { Headset, ShieldCheck, Truck } from "lucide-react";

/**
 * Showroom pieces of the account screens: the stage backdrop, the desktop
 * showroom, the phone showcase and the trust strip. Markup only (no hooks),
 * so the (auth) layout renders them on the server and the card can reuse
 * the phone pieces.
 *
 * Motion classes (am-*) are defined in globals.css ("Account screen
 * motion"): a timed entrance, then a slow light ambience. Every animation
 * is CSS transform/opacity and is off under reduced motion, where the
 * final, lit state shows at once.
 */

export const HEADING_FONT = { fontFamily: "var(--font-heading, var(--font-fallback-heading))" };

/**
 * Product images supplied by the owner (2026-11-11), cut out of their white
 * studio background (frontend/public/auth). The chandelier came
 * transparent. An approved composite render can replace the scene later.
 */
const PRODUCTS = {
  stabilizer: { src: "/auth/stabilizer.webp", alt: "TRONIC voltage stabilizer" },
  heater: { src: "/auth/water-heater.webp", alt: "TRONIC water heater" },
  fan: { src: "/auth/exhaust-fan.webp", alt: "TRONIC exhaust fan" },
  bulb: { src: "/auth/bulb-a60.webp", alt: "TRONIC LED bulb" },
  cable: { src: "/auth/cable.webp", alt: "TRONIC single core cable" },
  chandelier: { src: "/auth/chandelier.webp", alt: "Pendant chandelier" },
} as const;

function Product({
  name,
  className,
  sizes,
  fit = "object-bottom",
}: {
  name: keyof typeof PRODUCTS;
  className: string;
  sizes: string;
  fit?: "object-bottom" | "object-top";
}) {
  const { src, alt } = PRODUCTS[name];
  return (
    <span className={`absolute block ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className={`object-contain ${fit}`} />
    </span>
  );
}

/**
 * The LED bulb "switching on": the box keeps the photo's own proportions
 * (334×609) so the light layers sit exactly on the globe. A warm halo
 * behind the bulb and a soft light on the globe fade in (am-light); the
 * photo itself is never recoloured.
 */
function LitBulb({ className, sizes, light }: { className: string; sizes: string; light: string }) {
  return (
    <span className={`absolute block aspect-[334/609] ${className}`}>
      <span
        aria-hidden="true"
        className={`${light} pointer-events-none absolute left-1/2 top-[27%] h-[150%] w-[310%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,214,150,0.55),rgba(255,170,90,0.16)_55%,transparent)]`}
      />
      <Image src={PRODUCTS.bulb.src} alt={PRODUCTS.bulb.alt} fill sizes={sizes} className="object-contain" />
      <span
        aria-hidden="true"
        className={`${light} pointer-events-none absolute inset-x-[3%] top-[1%] h-[54%] rounded-full bg-[radial-gradient(circle_at_50%_46%,rgba(255,247,226,0.9),rgba(255,224,168,0.4)_52%,transparent_72%)] mix-blend-screen`}
      />
    </span>
  );
}

/** Background depth: glow, rings, slats and light curves (the curves and slats only from lg). */
export function StageBackdrop() {
  return (
    <div aria-hidden="true" className="am-bg pointer-events-none absolute inset-0 -z-10">
      <div className="login-glow absolute left-1/2 top-[-18rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,92,92,0.45),transparent_62%)] lg:left-[30%] lg:top-[-8rem] lg:h-[56rem] lg:w-[56rem] lg:bg-[radial-gradient(circle,rgba(255,70,60,0.32),transparent_60%)]" />
      {[14, 24, 34, 46, 60].map((size) => (
        <span
          key={size}
          className="absolute left-1/2 top-[2.75rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07] lg:hidden"
          style={{ width: `${size}rem`, height: `${size}rem` }}
        />
      ))}
      {/* Showroom slats on the far left (lg+) */}
      <div className="absolute inset-y-0 left-0 hidden w-[7%] bg-[repeating-linear-gradient(90deg,rgba(255,170,120,0.06)_0_9px,rgba(0,0,0,0.12)_9px_20px)] [mask-image:linear-gradient(90deg,black,transparent)] lg:block" />
      {/* Light curves behind the card (lg+) */}
      <svg className="absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none">
        <path d="M1440 40 C 1180 70, 960 260, 900 520" stroke="rgba(255,60,60,0.55)" strokeWidth="2.5" />
        <path d="M1440 140 C 1240 160, 1060 330, 1010 600" stroke="rgba(255,90,90,0.25)" strokeWidth="1.5" />
        <path d="M600 900 C 820 760, 1120 720, 1440 760" stroke="rgba(255,80,80,0.35)" strokeWidth="2" />
        <path d="M0 860 C 380 760, 820 820, 1440 700" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />
      </svg>
      <svg className="absolute inset-x-0 bottom-0 h-56 w-full lg:hidden" viewBox="0 0 1440 220" preserveAspectRatio="none" fill="none">
        <path d="M0 150 C 380 60, 760 230, 1440 90" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
        <path d="M0 200 C 420 110, 900 250, 1440 140" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/**
 * Desktop showroom (lg+): the chandelier glows over a metal platform with a
 * red LED rim, and the owner's TRONIC products stand on it: stabilizer and
 * water heater at the back, exhaust fan, LED bulb and cable in front. The
 * products arrive one by one, then the bulb switches on and warms the
 * platform. Height follows the viewport so the page never scrolls.
 */
export function ShowroomScene() {
  return (
    <div className="login-showcase-d am-show relative mt-[clamp(0.5rem,2vh,1.5rem)] h-[clamp(14rem,40vh,26rem)] w-full max-w-[44rem]">
      {/* Chandelier with its warm glow (a soft gradient, no blur filter) */}
      <div aria-hidden="true" className="login-lamp absolute right-[-3%] top-[-12%] h-[86%] w-[40%] rounded-full bg-[radial-gradient(closest-side,rgba(255,200,120,0.42),rgba(255,140,60,0.14)_55%,transparent)]" />
      <div className="login-prod login-prod-1 absolute right-[3%] top-[-14%] h-[80%] w-[27%]">
        {/* Suspension rod up to the ceiling (top of the screen) */}
        <span aria-hidden="true" className="absolute bottom-full left-1/2 h-[100vh] w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-black/45 to-black/70" />
        <Product name="chandelier" className="inset-0 drop-shadow-[0_0_24px_rgba(255,200,120,0.55)]" sizes="(min-width: 1024px) 12rem, 1px" fit="object-top" />
      </div>
      {/* Platform */}
      <div aria-hidden="true" className="absolute bottom-[3%] left-[1%] right-[24%] h-[26%]">
        <span className="absolute inset-x-0 bottom-[18%] h-[62%] rounded-[50%] bg-[linear-gradient(180deg,#f4f1f1_0%,#bdb6b6_55%,#6d6464_100%)] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]" />
        <span className="login-led absolute inset-x-0 bottom-[16%] h-[66%] rounded-[50%] border-b-[3px] border-[#ff5a3c] shadow-[0_12px_28px_-4px_rgba(255,60,40,0.85)]" />
        <span className="absolute inset-x-[8%] top-[6%] h-[38%] rounded-[50%] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.15))]" />
        {/* Warm pool of light from the bulb on the platform */}
        <span className="am-light absolute left-[30%] top-[-6%] h-[80%] w-[44%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,200,130,0.6),rgba(255,170,90,0.18)_60%,transparent)]" />
      </div>
      {/* Products: contact shadow, back row, then front row */}
      <div className="absolute bottom-[15%] left-[1%] right-[24%] top-0">
        <span aria-hidden="true" className="am-shadow absolute bottom-[-4%] left-[2%] right-[2%] h-[12%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(40,0,0,0.38),transparent)]" />
        <Product name="stabilizer" className="login-prod login-prod-2 bottom-[12%] left-[13%] h-[90%] w-[30%]" sizes="(min-width: 1024px) 14rem, 1px" />
        <Product name="heater" className="login-prod login-prod-3 bottom-[20%] left-[54%] h-[44%] w-[25%]" sizes="(min-width: 1024px) 10rem, 1px" />
        <Product name="fan" className="login-prod login-prod-3 bottom-[0%] left-[-1%] h-[34%] w-[19%]" sizes="(min-width: 1024px) 9rem, 1px" />
        <LitBulb className="login-prod login-prod-4 bottom-[0%] left-[39%] w-[15%]" sizes="(min-width: 1024px) 7rem, 1px" light="am-light" />
        <Product name="cable" className="login-prod login-prod-4 bottom-[0%] right-[-2%] h-[26%] w-[40%]" sizes="(min-width: 1024px) 14rem, 1px" />
      </div>
    </div>
  );
}

/** Phones and tablets: compact showcase at the top of the white panel. */
export function PhoneShowcase({ className }: { className: string }) {
  return (
    <div className={`am-show-m relative overflow-hidden bg-[linear-gradient(180deg,#fff5f5_0%,#ffe9e9_62%,#ffffff_100%)] ${className}`}>
      <div aria-hidden="true" className="absolute left-1/2 top-[-4rem] h-60 w-60 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,214,170,0.75),transparent_65%)]" />
      <div aria-hidden="true" className="absolute bottom-[12%] left-1/2 h-[20%] max-h-12 w-[78%] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#ffffff,#f1e6e6)] shadow-[0_10px_22px_-10px_rgba(120,10,10,0.45),0_0_0_1px_rgba(215,25,32,0.08)]" />
      <div aria-hidden="true" className="absolute bottom-[10%] left-1/2 h-1.5 w-[70%] -translate-x-1/2 rounded-full bg-[var(--color-action-red)] opacity-40 blur-[6px]" />
      <div className="absolute inset-x-0 bottom-[19%] top-[6%] mx-auto w-[86%]">
        <Product name="stabilizer" className="bottom-0 left-[4%] h-[92%] w-[30%]" sizes="30vw" />
        <LitBulb className="bottom-0 left-1/2 z-10 h-[88%] -translate-x-1/2" sizes="30vw" light="am-light-m" />
        <Product name="heater" className="bottom-0 right-[2%] h-[64%] w-[32%] drop-shadow-[0_10px_12px_rgba(0,0,0,0.14)]" sizes="30vw" />
      </div>
    </div>
  );
}

const TRUST = [
  { icon: Truck, title: "Delivery service", text: "To your address" },
  { icon: ShieldCheck, title: "Genuine products", text: "TRONIC quality" },
  { icon: Headset, title: "Customer support", text: "Here to help" },
] as const;

export function TrustStrip({ tone, className }: { tone: "light" | "dark"; className: string }) {
  const dark = tone === "dark";
  return (
    <ul
      className={`grid grid-cols-3 divide-x rounded-2xl py-3 text-center ${
        dark ? "divide-white/20 bg-white/[0.07] ring-1 ring-white/15 lg:py-4" : "divide-[#f3d6d6] bg-[#fff6f6]"
      } ${className}`}
    >
      {TRUST.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex flex-col items-center gap-1 px-1.5">
          <Icon size={dark ? 28 : 20} strokeWidth={1.6} className={dark ? "text-white" : "text-[var(--color-action-red)]"} aria-hidden="true" />
          <span
            className={`text-[11px] font-semibold leading-tight min-[360px]:whitespace-nowrap min-[400px]:text-[12px] sm:text-[13px] ${
              dark ? "text-white lg:text-[15px]" : "text-[var(--color-premium-black)]"
            }`}
          >
            {title}
          </span>
          <span className={`text-[11px] leading-tight sm:text-xs ${dark ? "text-white/75 lg:text-sm" : "text-[var(--text-secondary)]"}`}>{text}</span>
        </li>
      ))}
    </ul>
  );
}
