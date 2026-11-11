import Image from "next/image";
import type { ReactNode } from "react";
import { Container } from "@tronic/ui";

const HEADING_FONT = { fontFamily: "var(--font-heading, var(--font-fallback-heading))" };

/**
 * Shell for the customer account screens (owner brief 2026-11-10). Desktop:
 * a showroom photograph with a short brand line beside the form. Phones and
 * tablets: the form alone, first on screen. The site header, navbar and tab
 * bar stay as they are on every other page.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Container className="py-6 md:py-10 lg:py-12">
      <div className="auth-enter mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-white md:border md:border-[var(--color-light-grey)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative hidden min-h-[36rem] lg:block">
          <Image
            src="/banners/hero-showroom-lit.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 32rem, 0px"
            className="object-cover"
            priority
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">TRONIC Tanzania</p>
            <p className="mt-2 text-3xl font-bold leading-tight" style={HEADING_FONT}>
              Power every <span className="text-[var(--color-action-red)]">space.</span>
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/85">
              Electrical supplies, LED lighting and switchgear for homes, businesses and industry.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center px-5 py-8 sm:px-10 md:py-10 lg:px-12">
          <div className="mx-auto w-full max-w-md">
            <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.01em] md:text-[2rem]" style={HEADING_FONT}>
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{subtitle}</p>
            <div className="mt-7">{children}</div>
            {footer ? <div className="mt-6 border-t border-[var(--color-light-grey)] pt-5 text-center text-sm text-[var(--text-secondary)]">{footer}</div> : null}
          </div>
        </div>
      </div>
    </Container>
  );
}

/** Primary submit button with a loading state the future auth calls will use. */
export function AuthSubmit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-action-red)] text-[15px] font-semibold text-white shadow-[0_10px_26px_-12px_rgba(215,25,32,0.7)] transition-[background-color,transform] hover:bg-[var(--color-action-red-dark)] active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? (
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
      ) : null}
      {pending ? "Please wait…" : children}
    </button>
  );
}

/** Result line under a form: the not-connected notice or an auth error. Never a success claim. */
export function AuthMessage({ message }: { message: { tone: "info" | "error"; text: string } | null }) {
  return (
    <div aria-live="polite">
      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`auth-message mt-4 rounded-xl px-4 py-3 text-sm leading-relaxed ${
            message.tone === "error"
              ? "bg-[#fdecec] text-[var(--color-action-red)]"
              : "border border-[var(--color-light-grey)] bg-[var(--surface-card)] text-[var(--text-primary)]"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
