"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Headset, Mail, ShieldCheck, ShoppingBag, Truck, UserRound } from "lucide-react";
import { PASSWORD_POLICY, validateLogin, type LoginValues } from "@/features/auth/rules";
import { authService } from "@/features/auth/service";
import { useAuthForm } from "@/features/auth/useAuthForm";
import { AuthMessage, IconField, PasswordField, SubmitButton } from "./AuthFields";

const HEADING_FONT = { fontFamily: "var(--font-heading, var(--font-fallback-heading))" };

/**
 * Product images for the showcase, supplied by the owner (2026-11-11) and
 * cut out of their white studio background (frontend/public/auth). The
 * chandelier came transparent. An approved composite render can replace
 * the whole scene later.
 */
const PRODUCTS = {
  stabilizer: { src: "/auth/stabilizer.webp", alt: "TRONIC voltage stabilizer" },
  heater: { src: "/auth/water-heater.webp", alt: "TRONIC water heater" },
  fan: { src: "/auth/exhaust-fan.webp", alt: "TRONIC exhaust fan" },
  bulb: { src: "/auth/bulb-a60.webp", alt: "TRONIC LED bulb" },
  cable: { src: "/auth/cable.webp", alt: "TRONIC single core cable" },
  chandelier: { src: "/auth/chandelier.webp", alt: "Pendant chandelier" },
} as const;

/**
 * Shared shell for the four account screens (login, register, forgot and
 * reset password), art-directed after the owner's references (2026-11-11).
 *
 * - Phones and tablets: red stage, white logo, one rounded white panel with
 *   a compact product showcase and the form. On shorter screens the extras
 *   step aside first (see the login-* height rules in globals.css).
 * - Laptops and desktops (lg+): a cinematic showroom on the left (brand,
 *   chandelier, lit platform with TRONIC products, trust strip) and the
 *   white card on the right.
 *
 * Every screen fits without scrolling; `long` (register, reset) drops the
 * phone showcase and the account icon and turns on the compact card rules
 * ([data-long] in globals.css). Only very small phones (320×568) scroll.
 * The page carries data-auth-screen, which hides the site header, navbar,
 * footer, tab bar and chat button; "Back to shopping" returns to the store.
 * Frontend only: forms validate and then call the not-connected auth
 * service (features/auth/service.ts). No login, session or success state.
 */
export function AuthScreen({
  icon,
  title,
  subtitle,
  footer,
  long = false,
  children,
}: {
  /** The card icon, e.g. <UserRound size={28} strokeWidth={1.9} />. */
  icon: ReactNode;
  /** The heading; wrap the highlighted word in <Accent>. */
  title: ReactNode;
  subtitle: string;
  footer: ReactNode;
  long?: boolean;
  children: ReactNode;
}) {
  return (
    <div data-auth-screen data-long={long || undefined} className="login-stage relative isolate min-h-[100dvh] overflow-hidden">
      <StageBackdrop />
      <div className="login-shell relative mx-auto flex min-h-[100dvh] w-full max-w-[30rem] flex-col items-center justify-center px-4 py-[calc(1rem+env(safe-area-inset-top))] lg:grid lg:max-w-[90rem] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:px-12 lg:py-6 xl:gap-16 xl:px-20">
        {/* Brand column */}
        <div className="flex flex-col items-center text-white lg:items-start">
          <Link href="/" aria-label="TRONIC home" className="login-in login-in-1 flex items-center gap-5 rounded-md">
            <Image
              src="/brand/tronic-logo.png"
              alt="TRONIC"
              width={698}
              height={204}
              priority
              className="h-auto w-[9rem] brightness-0 invert sm:w-[10.5rem] lg:w-[clamp(11rem,15vw,15.5rem)]"
            />
            <span aria-hidden="true" className="hidden h-10 w-px bg-white/45 lg:block" />
            <span className="hidden lg:block">
              <span className="block text-sm font-semibold uppercase tracking-[0.42em] text-white/95">Tanzania</span>
              <span aria-hidden="true" className="mt-2 block h-[3px] w-16 rounded-full bg-[#ff2a36]" />
            </span>
          </Link>
          <p className="login-tagline login-in login-in-2 mt-2 max-w-[19rem] text-center text-[13px] leading-snug text-white/85 sm:max-w-none lg:hidden">
            Your electrical partner for homes, businesses and industry.
          </p>
          <div className="hidden w-full lg:block">
            <p
              className="login-in login-in-2 relative z-10 mt-[clamp(1rem,3vh,2rem)] text-[clamp(2.4rem,3.6vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.02em] [text-shadow:0_4px_24px_rgba(60,0,0,0.35)]"
              style={HEADING_FONT}
            >
              Power Every Space.
            </p>
            <p className="login-desc login-in login-in-3 relative z-10 mt-3 max-w-[28rem] text-[clamp(0.95rem,1.1vw,1.1rem)] leading-relaxed text-white/85">
              Electrical supplies, LED lighting and switchgear for homes, businesses and industry.
            </p>
            <ShowroomScene />
            <TrustStrip tone="dark" className="login-trust-d mt-[clamp(0.75rem,2vh,1.5rem)] max-w-[44rem]" />
          </div>
        </div>

        {/* Form column */}
        <div className="login-panel-wrap mt-4 flex w-full flex-col items-center sm:mt-6 lg:mt-0">
          <section
            aria-labelledby="auth-title"
            className="login-panel relative w-full overflow-hidden rounded-[28px] bg-white shadow-[0_32px_80px_-28px_rgba(40,0,0,0.6)] sm:rounded-[32px] lg:max-w-[33rem] lg:bg-[linear-gradient(180deg,#ffffff_0%,#fffafa_100%)] lg:shadow-[0_40px_100px_-30px_rgba(40,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.6)]"
          >
            {long ? null : <PhoneShowcase className="login-showcase-m h-[9rem] sm:h-[10.5rem] lg:hidden" />}
            <div className={`login-panel-body relative px-5 pb-5 sm:px-8 sm:pb-7 lg:px-11 lg:pb-9 ${long ? "pt-5 lg:pt-7" : "lg:pt-9"}`}>
              {long ? null : (
              <div className={`login-icon login-in login-in-4 mx-auto -mt-7 grid h-14 w-14 place-items-center rounded-2xl bg-[#fdecec] text-[var(--color-action-red)] shadow-[0_10px_24px_-14px_rgba(215,25,32,0.7)] ring-4 ring-white lg:mt-0 lg:h-16 lg:w-16`}>
                {icon}
              </div>
              )}
              <p className={`login-kicker login-in login-in-5 text-center ${long ? "" : "mt-3"} text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-action-red)] lg:text-xs`}>
                TRONIC account
              </p>
              <h1
                id="auth-title"
                className="login-title login-in login-in-5 mt-1 text-center text-[1.85rem] font-bold leading-tight tracking-[-0.02em] text-[#141821] sm:text-[2.15rem] lg:text-[2.5rem]"
                style={HEADING_FONT}
              >
                {title}
              </h1>
              <p className="login-sub login-in login-in-6 mt-1 text-center text-[13px] text-[var(--text-secondary)] sm:text-sm lg:text-[15px]">
                {subtitle}
              </p>

              <div className="login-in login-in-6 mt-5 lg:mt-6">
                {children}
              </div>

              <div className="login-register login-in login-in-7 mt-4 flex items-center gap-3 text-sm text-[var(--text-secondary)] lg:mt-5">
                <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-light-grey)]" />
                <span className="text-center">{footer}</span>
                <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-light-grey)]" />
              </div>

              <TrustStrip tone="light" className="login-trust-m mt-4 lg:hidden" />
            </div>
          </section>

          <Link
            href="/"
            className="login-back login-in login-in-8 mt-3 inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 lg:mt-5 lg:text-base"
          >
            <span aria-hidden="true" className="hidden h-px w-12 bg-white/35 lg:block" />
            <ShoppingBag size={18} strokeWidth={1.9} aria-hidden="true" />
            Back to shopping
            <span aria-hidden="true" className="hidden h-px w-12 bg-white/35 lg:block" />
          </Link>
          <p className="login-tz mt-1 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 lg:hidden">
            <span aria-hidden="true" className="h-px w-10 bg-white/30" />
            TRONIC Tanzania
            <span aria-hidden="true" className="h-px w-10 bg-white/30" />
          </p>
        </div>
      </div>
    </div>
  );
}


/** The highlighted word in an account-screen heading ("Welcome <Accent>Back</Accent>"). */
export function Accent({ children }: { children: ReactNode }) {
  return <span className="text-[var(--color-action-red)]">{children}</span>;
}

/** Inline link used in the card footers. */
export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-[var(--color-action-red)] underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

/** /login — fits one screen without scrolling. */
export function LoginScreen() {
  return (
    <AuthScreen
      icon={<UserRound size={28} strokeWidth={1.9} aria-hidden="true" />}
      title={
        <>
          Welcome <Accent>Back</Accent>
        </>
      }
      subtitle="Sign in to your TRONIC account and continue shopping."
      footer={
        <>
          New to TRONIC? <AuthLink href="/register">Create an account</AuthLink>
        </>
      }
    >
      <LoginForm />
    </AuthScreen>
  );
}

/** Background depth: glow, rings, slats and light curves (the curves and slats only from lg). */
function StageBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
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
 * Desktop showroom (lg+): the chandelier glows over a metal platform with a
 * red LED rim, and the owner's TRONIC products stand on it: stabilizer and
 * water heater at the back, exhaust fan, LED bulb and cable in front.
 * Height follows the viewport so the page never scrolls.
 */
function ShowroomScene() {
  return (
    <div className="login-showcase-d login-in login-in-3 relative mt-[clamp(0.5rem,2vh,1.5rem)] h-[clamp(14rem,40vh,26rem)] w-full max-w-[44rem]">
      {/* Chandelier with its warm glow */}
      <div aria-hidden="true" className="login-lamp absolute right-[1%] top-[-4%] h-[72%] w-[31%] rounded-full bg-[radial-gradient(closest-side,rgba(255,200,120,0.5),rgba(255,140,60,0.15)_60%,transparent)] blur-[18px]" />
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
      </div>
      {/* Products: back row, then front row */}
      <div className="absolute bottom-[15%] left-[1%] right-[24%] top-0">
        <Product name="stabilizer" className="login-prod login-prod-2 bottom-[12%] left-[13%] h-[90%] w-[30%]" sizes="(min-width: 1024px) 14rem, 1px" />
        <Product name="heater" className="login-prod login-prod-3 bottom-[20%] left-[54%] h-[44%] w-[25%]" sizes="(min-width: 1024px) 10rem, 1px" />
        <Product name="fan" className="login-prod login-prod-3 bottom-[0%] left-[-1%] h-[34%] w-[19%]" sizes="(min-width: 1024px) 9rem, 1px" />
        <Product name="bulb" className="login-prod login-prod-4 bottom-[0%] left-[39%] h-[54%] w-[15%] drop-shadow-[0_0_26px_rgba(255,205,130,0.85)]" sizes="(min-width: 1024px) 7rem, 1px" />
        <Product name="cable" className="login-prod login-prod-4 bottom-[0%] right-[-2%] h-[26%] w-[40%]" sizes="(min-width: 1024px) 14rem, 1px" />
      </div>
    </div>
  );
}

/** Phones and tablets: compact showcase at the top of the white panel. */
function PhoneShowcase({ className }: { className: string }) {
  return (
    <div className={`login-in login-in-3 relative overflow-hidden bg-[linear-gradient(180deg,#fff5f5_0%,#ffe9e9_62%,#ffffff_100%)] ${className}`}>
      <div aria-hidden="true" className="absolute left-1/2 top-[-4rem] h-60 w-60 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,214,170,0.75),transparent_65%)]" />
      <div aria-hidden="true" className="absolute bottom-[12%] left-1/2 h-[20%] max-h-12 w-[78%] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#ffffff,#f1e6e6)] shadow-[0_10px_22px_-10px_rgba(120,10,10,0.45),0_0_0_1px_rgba(215,25,32,0.08)]" />
      <div aria-hidden="true" className="absolute bottom-[10%] left-1/2 h-1.5 w-[70%] -translate-x-1/2 rounded-full bg-[var(--color-action-red)] opacity-40 blur-[6px]" />
      <div className="absolute inset-x-0 bottom-[19%] top-[6%] mx-auto w-[86%]">
        <Product name="stabilizer" className="bottom-0 left-[4%] h-[92%] w-[30%]" sizes="30vw" />
        <Product name="bulb" className="bottom-0 left-[38%] z-10 h-[88%] w-[24%] drop-shadow-[0_0_22px_rgba(255,196,120,0.8)]" sizes="30vw" />
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

function TrustStrip({ tone, className }: { tone: "light" | "dark"; className: string }) {
  const dark = tone === "dark";
  return (
    <ul
      className={`login-in login-in-8 grid grid-cols-3 divide-x rounded-2xl py-3 text-center ${
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

/** Login form: shared rules and the not-connected auth service. */
export function LoginForm() {
  const form = useAuthForm<LoginValues & { remember: boolean }>({
    initial: { email: "", password: "", remember: false },
    validate: validateLogin,
    submit: ({ email, password, remember }) => authService.signIn({ email: email.trim(), password, remember }),
  });
  const { values, errors } = form;

  return (
    <form ref={form.formRef} noValidate onSubmit={form.onSubmit} className="login-form space-y-3.5">
      <IconField
        label="Email address"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="Enter your email address"
        maxLength={254}
        icon={<Mail size={18} strokeWidth={1.8} />}
        value={values.email}
        error={errors.email}
        onChange={(event) => form.setValue("email", event.target.value)}
        onBlur={() => form.touch("email")}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        placeholder="Enter your password"
        maxLength={PASSWORD_POLICY.maxLength}
        value={values.password}
        error={errors.password}
        onChange={(event) => form.setValue("password", event.target.value)}
        onBlur={() => form.touch("password")}
      />
      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-[var(--text-secondary)]">
          <input
            type="checkbox"
            name="remember"
            checked={values.remember}
            onChange={(event) => form.setValue("remember", event.target.checked)}
            className="h-[1.1rem] w-[1.1rem] rounded accent-[var(--color-action-red)]"
          />
          Remember me
        </label>
        <AuthLink href="/forgot-password">Forgot password?</AuthLink>
      </div>
      <SubmitButton pending={form.pending}>Sign in</SubmitButton>
      <AuthMessage message={form.message} />
    </form>
  );
}
