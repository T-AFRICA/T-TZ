import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ShowroomScene, StageBackdrop, TrustStrip } from "./AuthShowroom";

/**
 * The stage shared by the four account screens, rendered once by the (auth)
 * layout: red background, brand column (logo, tagline; on laptops the
 * heading, showroom and trust strip) and a slot for the page's card.
 *
 * Because the layout stays mounted, moving between login, register and the
 * password pages swaps only the card: the background and the showroom do
 * not replay their entrance (owner brief 2026-11-11, smooth login ↔
 * registration navigation).
 *
 * data-auth-screen hides the site header, navbar, footer, tab bar and chat
 * button (globals.css); the card's "Back to shopping" returns to the store.
 */
export function AuthStage({ children }: { children: ReactNode }) {
  return (
    <div data-auth-screen className="login-stage relative isolate min-h-[100dvh] overflow-hidden">
      <StageBackdrop />
      <div className="login-shell relative mx-auto flex min-h-[100dvh] w-full max-w-[30rem] flex-col items-center justify-center px-4 py-[calc(1rem+env(safe-area-inset-top))] lg:grid lg:max-w-[90rem] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:px-12 lg:py-6 xl:gap-16 xl:px-20">
        {/* Brand column */}
        <div className="flex flex-col items-center text-white lg:items-start">
          <Link href="/" aria-label="TRONIC home" className="flex items-center gap-5 rounded-md">
            <Image
              src="/brand/tronic-logo.png"
              alt="TRONIC"
              width={698}
              height={204}
              priority
              className="login-logo am-logo h-auto w-[9rem] brightness-0 invert sm:w-[10.5rem] lg:w-[clamp(11rem,15vw,15.5rem)]"
            />
            <span aria-hidden="true" className="am-sub hidden h-10 w-px bg-white/45 lg:block" />
            <span className="am-sub hidden lg:block">
              <span className="block text-sm font-semibold uppercase tracking-[0.42em] text-white/95">Tanzania</span>
              <span aria-hidden="true" className="mt-2 block h-[3px] w-16 rounded-full bg-[#ff2a36]" />
            </span>
          </Link>
          <p className="login-tagline am-sub mt-2 max-w-[19rem] text-center text-[13px] leading-snug text-white/85 sm:max-w-none lg:hidden">
            Your electrical partner for homes, businesses and industry.
          </p>
          <div className="hidden w-full lg:block">
            <p
              className="font-display am-head relative z-10 mt-[clamp(1rem,3vh,2rem)] text-[clamp(2.4rem,3.6vw,3.6rem)] leading-[1.05] [text-shadow:0_4px_24px_rgba(60,0,0,0.35)]"
            >
              Power Every Space.
            </p>
            <p className="login-desc am-desc relative z-10 mt-3 max-w-[28rem] text-[clamp(0.95rem,1.1vw,1.1rem)] leading-relaxed text-white/85">
              Electrical supplies, LED lighting and switchgear for homes, businesses and industry.
            </p>
            <ShowroomScene />
            <TrustStrip tone="dark" className="login-trust-d am-trust mt-[clamp(0.75rem,2vh,1.5rem)] max-w-[44rem]" />
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
