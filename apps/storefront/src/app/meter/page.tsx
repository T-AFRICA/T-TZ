import { Container } from "@tronic/ui";

export const metadata = { title: "Meter" };

/**
 * Reserved route for the single customer-facing Meter page (SRS FR-036).
 * The full one-page flow — meter number, verified details, units, authorized
 * token generation and same-page receipt — is built in Week 4 with mock
 * states, and integrated with the protected token service in Week 10.
 *
 * This page, and every future Meter screen, carries NO payment, pricing,
 * cart or checkout elements (SRS FR-035 / FR-043).
 */
export default function MeterPage() {
  return (
    <Container className="py-10">
      <h1 className="text-[length:var(--text-h1)] font-bold leading-tight">Meter token service</h1>
      <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
        The meter token workflow is under construction. Authorized operators will be able to look
        up a meter, enter units and issue a token with a printable receipt — all on this single
        page.
      </p>
    </Container>
  );
}
