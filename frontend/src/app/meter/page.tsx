import { Container } from "@tronic/ui";

export const metadata = { title: "Meter" };

/**
 * Reserved route for the single customer-facing Meter page (SRS FR-036).
 * The full one-page flow — meter number, verified details, units, authorized
 * token generation and same-page receipt — is built in Week 4 with mock
 * states, and integrated with the protected token service in Week 10.
 *
 * This page, and every future Meter screen, carries NO payment, pricing,
 * cart or checkout elements (SRS FR-035 / FR-043). The steps below describe
 * the SRS-approved flow; nothing here issues tokens.
 */
const PLANNED_STEPS = [
  {
    step: "01",
    title: "Look up your meter",
    body: "Enter the meter number and confirm the verified meter details on the same page.",
  },
  {
    step: "02",
    title: "Enter the units",
    body: "Specify the units for the token request — no prices, cart or checkout on this page.",
  },
  {
    step: "03",
    title: "Receive the token",
    body: "An authorized token is issued with a printable receipt, right here on this page.",
  },
] as const;

export default function MeterPage() {
  return (
    <>
      {/* Dark service header, consistent with the homepage Meter callout */}
      <div className="relative overflow-hidden bg-[var(--color-premium-black)] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_10%,rgba(215,25,32,0.35),transparent_55%)]"
        />
        <Container className="relative py-12 lg:py-16">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#ff6b72]">
            <span aria-hidden="true" className="h-px w-8 bg-[var(--color-action-red)]" />
            Utility service
          </p>
          <h1 className="font-display mt-3 text-[length:var(--text-h1)] leading-tight">
            TRONIC <span className="text-[var(--color-brand-red)]">Meter</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
            Prepaid meter token service for Tanzania. The workflow below is under construction and
            will go live after authorization — this page never carries payment, cart or checkout
            elements.
          </p>
        </Container>
      </div>

      <Container className="py-10 lg:py-14">
        <h2
          className="text-[length:var(--text-h3)] font-bold leading-tight"
          style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
        >
          How it will work
        </h2>
        <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANNED_STEPS.map((item) => (
            <li
              key={item.step}
              className="rounded-xl border border-[var(--color-light-grey)] bg-white p-6"
            >
              <span
                className="text-2xl font-bold text-[var(--color-light-grey)]"
                style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
                aria-hidden="true"
              >
                {item.step}
              </span>
              <h3 className="mt-2 font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs text-[var(--text-muted)]">
          Under construction — the single-page flow is built in a later phase and activated only
          with the owner&apos;s authorization.
        </p>
      </Container>
    </>
  );
}
