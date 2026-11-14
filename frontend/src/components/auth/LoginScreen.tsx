"use client";

import Link from "next/link";
import { useActionState, type CSSProperties, type ReactNode } from "react";
import { Mail, ShoppingBag, UserRound } from "lucide-react";
import { PASSWORD_POLICY, validateLogin, type LoginValues } from "@/features/auth/rules";
import { signInAction } from "@/features/auth/actions";
import { AUTH_REGISTERED_NOTICE } from "@/features/auth/service";
import { IDLE } from "@/features/auth/state";
import { useAuthForm } from "@/features/auth/useAuthForm";
import { AuthCardMotion } from "./AuthCardMotion";
import { AuthMessage, IconField, PasswordField, SubmitButton } from "./AuthFields";
import { HEADING_FONT, PhoneShowcase, TrustStrip } from "./AuthShowroom";

/** Stagger position of a card element (--i), read by the am-c rules in globals.css. */
const at = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * The card of the four account screens (login, register, forgot and reset
 * password), art-directed after the owner's references (2026-11-11). The
 * stage around it (red background, brand column, desktop showroom) is the
 * (auth) layout, AuthStage.tsx.
 *
 * - Phones and tablets: one rounded white panel with a compact product
 *   showcase and the form. On shorter screens the extras step aside first
 *   (see the login-* height rules in globals.css).
 * - Laptops and desktops (lg+): the white card on the right of the showroom.
 *
 * Every screen fits without scrolling; `long` (register, reset) drops the
 * phone showcase and the account icon and turns on the compact card rules
 * ([data-long] in globals.css). Only very small phones (320×568) scroll.
 *
 * Motion: the card fades up after the showroom, then its contents follow in
 * a short stagger (am-c with --i, and every form row). Nothing waits for an
 * animation: fields can be focused and used at once.
 *
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
    <AuthCardMotion long={long}>
      <section
        aria-labelledby="auth-title"
        className="login-panel relative w-full overflow-hidden rounded-[28px] bg-white shadow-[0_32px_80px_-28px_rgba(40,0,0,0.6)] sm:rounded-[32px] lg:max-w-[33rem] lg:bg-[linear-gradient(180deg,#ffffff_0%,#fffafa_100%)] lg:shadow-[0_40px_100px_-30px_rgba(40,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.6)]"
      >
        {long ? null : <PhoneShowcase className="login-showcase-m h-[9rem] sm:h-[10.5rem] lg:hidden" />}
        <div className={`login-panel-body relative px-5 pb-5 sm:px-8 sm:pb-7 lg:px-11 lg:pb-9 ${long ? "pt-5 lg:pt-7" : "lg:pt-9"}`}>
          {long ? null : (
            <div className="login-icon am-icon relative mx-auto -mt-7 grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#fff6f6_0%,#fbdfe0_100%)] text-[var(--color-action-red)] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_24px_-14px_rgba(215,25,32,0.7)] ring-4 ring-white lg:mt-0 lg:h-16 lg:w-16">
              <span aria-hidden="true" className="absolute inset-x-2 top-1 h-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.85),transparent)]" />
              <span className="relative">{icon}</span>
            </div>
          )}
          <h1
            id="auth-title"
            className={`login-title am-c ${long ? "" : "mt-3"} text-center text-[1.85rem] font-bold leading-tight tracking-[-0.02em] text-[#141821] sm:text-[2.15rem] lg:text-[2.5rem]`}
            style={{ ...HEADING_FONT, ...at(1) }}
          >
            {title}
          </h1>
          <p
            className="login-sub am-c mt-1 text-center text-[13px] text-[var(--text-secondary)] sm:text-sm lg:text-[15px]"
            style={at(2)}
          >
            {subtitle}
          </p>

          <div className="mt-5 lg:mt-6">{children}</div>

          <div
            className="login-register am-c mt-4 flex items-center gap-3 text-sm text-[var(--text-secondary)] lg:mt-5"
            style={at(10)}
          >
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-light-grey)]" />
            <span className="text-center">{footer}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-light-grey)]" />
          </div>

          <div className="am-c" style={at(11)}>
            <TrustStrip tone="light" className="login-trust-m mt-4 lg:hidden" />
          </div>
        </div>
      </section>

      <Link
        href="/"
        className="login-back am-c mt-3 inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 lg:mt-5 lg:text-base"
        style={at(11)}
      >
        <span aria-hidden="true" className="hidden h-px w-12 bg-white/35 lg:block" />
        <ShoppingBag size={18} strokeWidth={1.9} aria-hidden="true" />
        Back to Store
        <span aria-hidden="true" className="hidden h-px w-12 bg-white/35 lg:block" />
      </Link>
      <p
        className="login-tz am-c mt-1 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70 lg:hidden"
        style={at(12)}
      >
        <span aria-hidden="true" className="h-px w-10 bg-white/30" />
        TRONIC Tanzania
        <span aria-hidden="true" className="h-px w-10 bg-white/30" />
      </p>
    </AuthCardMotion>
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

/**
 * /login — fits one screen without scrolling. `authEnabled` is false until
 * Supabase Auth is configured; `registered` is true when the customer has
 * just come from the registration form.
 */
export function LoginScreen({ authEnabled, registered = false }: { authEnabled: boolean; registered?: boolean }) {
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
      <LoginForm enabled={authEnabled} registered={registered} />
    </AuthScreen>
  );
}

/**
 * Login form: posts (method POST, with or without JavaScript) to
 * signInAction, which signs in with Supabase Auth and goes to /account.
 * Sessions persist until sign-out (Supabase's refresh token); the Remember
 * me box does not shorten them yet.
 *
 * `registered`: the customer has just registered, so the form opens with
 * the confirm-by-email note. Any answer of the form's own replaces it.
 */
export function LoginForm({ enabled, registered = false }: { enabled: boolean; registered?: boolean }) {
  const [state, action, pending] = useActionState(signInAction, IDLE);
  const form = useAuthForm<LoginValues & { remember: boolean }>({
    initial: { email: "", password: "", remember: false },
    validate: validateLogin,
    state,
    enabled,
  });
  const { values, errors } = form;
  const message = form.message ?? (registered ? { tone: "info" as const, text: AUTH_REGISTERED_NOTICE } : null);

  return (
    <form ref={form.formRef} action={action} noValidate onSubmit={form.onSubmit} className="login-form space-y-3.5">
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
      <SubmitButton pending={pending} disabled={!enabled}>
        Sign in
      </SubmitButton>
      <AuthMessage message={message} />
    </form>
  );
}
