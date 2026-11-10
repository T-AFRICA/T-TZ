"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRightIcon, CartIcon, ChevronDownIcon, Container, ErrorState, Input, Select, Textarea } from "@tronic/ui";
import { formatSamplePrice } from "@/components/home/sampleProducts";
import { useCart, useHydrated } from "@/features/cart/hooks";
import type { CartLine } from "@/features/cart/store";
import { getCheckoutQuote } from "@/features/checkout/actions";
import { DELIVERY_METHODS, ORDERS_CONNECTED, PAYMENT_METHODS, TZ_REGIONS } from "@/features/checkout/config";
import type { CheckoutQuote } from "@/features/checkout/quote";
import {
  EMPTY_CHECKOUT_FORM,
  FIELD_LIMITS,
  FIELD_ORDER,
  validateCheckout,
  type CheckoutErrors,
  type CheckoutField,
  type CheckoutForm,
} from "@/features/checkout/validation";
import { CheckoutSummary } from "./CheckoutSummary";

const SECTION = "rounded-2xl bg-white p-4 md:border md:border-[var(--color-light-grey)] md:p-6";
const HEADING_FONT = { fontFamily: "var(--font-heading, var(--font-fallback-heading))" };

const CONTACT_FIELDS: readonly CheckoutField[] = ["fullName", "email", "phone"];
const DELIVERY_FIELDS: readonly CheckoutField[] = [
  "deliveryMethod",
  "region",
  "district",
  "ward",
  "street",
  "addressExtra",
  "instructions",
];

type QuoteState =
  | { status: "loading" }
  | { status: "ready"; quote: CheckoutQuote }
  | { status: "error" };

/**
 * The checkout page body (owner brief 2026-11-10; frontend first, payments
 * and orders connected later).
 *
 * - Lines come from the cart, or from Buy Now (one product in the URL; the
 *   cart is not touched). The server prices them (getCheckoutQuote); the
 *   page never computes a price itself.
 * - Contact and delivery forms validate on blur and on submit with the same
 *   rules the server will run (features/checkout/validation.ts).
 * - Payment methods come from features/checkout/config.ts. Cash on
 *   delivery is open (owner decision 2026-11-10) and chosen by default;
 *   the online methods are not connected yet.
 * - Orders are not stored yet (ORDERS_CONNECTED), so Place order checks
 *   the details and then says plainly that nothing was sent, ordered or
 *   charged. No order or payment is simulated.
 *
 * Desktop: form (60%) beside a sticky summary (40%). Phones: a collapsible
 * summary at the top and a sticky total + Place order bar above the tab bar.
 */
export function CheckoutView({ buyNowLine }: { buyNowLine: CartLine | null }) {
  const hydrated = useHydrated();
  const { lines: cartLines } = useCart();
  const lines = useMemo(() => (buyNowLine ? [buyNowLine] : cartLines), [buyNowLine, cartLines]);
  const linesKey = JSON.stringify(lines);

  const [form, setForm] = useState<CheckoutForm>(EMPTY_CHECKOUT_FORM);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [touched, setTouched] = useState<Partial<Record<CheckoutField, boolean>>>({});
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Price the lines on the server whenever they or the delivery method change.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setQuoteState((state) => (state.status === "ready" ? state : { status: "loading" }));
    getCheckoutQuote(JSON.parse(linesKey) as unknown, form.deliveryMethod)
      .then((quote) => {
        if (!cancelled) setQuoteState({ status: "ready", quote });
      })
      .catch(() => {
        if (!cancelled) setQuoteState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, linesKey, form.deliveryMethod, reload]);

  const update = useCallback(
    (field: CheckoutField, value: string) => {
      setForm((current) => {
        const next = { ...current, [field]: value } as CheckoutForm;
        if (touched[field]) {
          const fieldError = validateCheckout(next)[field];
          setErrors((existing) => ({ ...existing, [field]: fieldError }));
        }
        return next;
      });
      setNotice(null);
    },
    [touched],
  );

  const blur = useCallback(
    (field: CheckoutField) => {
      setTouched((current) => ({ ...current, [field]: true }));
      setErrors((existing) => ({ ...existing, [field]: validateCheckout(form)[field] }));
    },
    [form],
  );

  const allErrors = useMemo(() => validateCheckout(form), [form]);
  const contactDone = CONTACT_FIELDS.every((field) => !allErrors[field]);
  const deliveryDone = DELIVERY_FIELDS.every((field) => !allErrors[field]);
  const paymentDone = !allErrors.paymentMethod;

  const quote = quoteState.status === "ready" ? quoteState.quote : null;
  const canSubmit = quote !== null && quote.itemCount > 0 && !submitting;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const found = validateCheckout(form);
    setErrors(found);
    setTouched(Object.fromEntries(FIELD_ORDER.map((field) => [field, true])));
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) {
      setNotice(null);
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    // One submission at a time. When orders are connected, the order action
    // runs here with an idempotency key, so a repeated click can never
    // create two orders; until then nothing is sent.
    setSubmitting(true);
    if (!ORDERS_CONNECTED) {
      setNotice(
        `Your details are complete${form.paymentMethod === "pay_on_delivery" ? " and Cash on delivery is selected" : ""}. Online ordering is not connected yet, so this order was not sent to TRONIC: nothing has been ordered or charged. Your cart stays saved on this device.`,
      );
      setSubmitting(false);
    }
  }

  if (!hydrated || (quoteState.status === "loading" && lines.length > 0)) {
    return (
      <Container className="py-6 lg:py-8">
        <div aria-busy="true" aria-label="Loading checkout" className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            <div className="h-44 animate-pulse rounded-2xl bg-white" />
            <div className="h-64 animate-pulse rounded-2xl bg-white" />
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-white" />
        </div>
      </Container>
    );
  }

  if (lines.length === 0 || (quote && quote.lines.length === 0)) {
    return (
      <Container className="flex flex-col items-center py-14 text-center lg:py-20">
        <span
          aria-hidden="true"
          className="grid h-16 w-16 place-items-center rounded-full bg-white text-[var(--color-action-red)] shadow-[0_3px_14px_rgba(17,17,17,0.08)]"
        >
          <CartIcon size={28} />
        </span>
        <h2 className="mt-5 text-lg font-bold">Nothing to check out</h2>
        <p className="mt-1.5 max-w-sm text-sm text-[var(--text-secondary)]">
          {buyNowLine ? "This product is no longer available." : "Your cart is empty."} Add products and come back here.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-action-red)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)]"
        >
          Browse products
          <ArrowRightIcon size={16} />
        </Link>
      </Container>
    );
  }

  if (quoteState.status === "error" || !quote) {
    return (
      <Container className="py-6">
        <ErrorState
          title="We couldn't load your order summary"
          description="Check your connection and try again. Nothing has been ordered."
          action={
            <button
              type="button"
              onClick={() => setReload((count) => count + 1)}
              className="inline-flex h-10 items-center rounded-full bg-[var(--color-action-red)] px-5 text-sm font-semibold text-white"
            >
              Try again
            </button>
          }
        />
      </Container>
    );
  }

  const field = (name: CheckoutField) => ({
    name,
    value: form[name],
    error: touched[name] ? errors[name] : undefined,
    onChange: (event: { target: { value: string } }) => update(name, event.target.value),
    onBlur: () => blur(name),
  });

  const placeLabel = submitting ? "Checking…" : "Place order";

  return (
    <>
      {/* Phones: the body already reserves the sticky bar (data-sticky-purchase);
          tablets have no tab bar, so the page reserves it here. */}
      <Container className="py-5 md:pb-28 lg:py-8">
        {buyNowLine ? (
          <p className="mb-4 rounded-xl bg-white px-4 py-3 text-sm text-[var(--text-secondary)] md:border md:border-[var(--color-light-grey)]">
            <span className="font-semibold text-[var(--text-primary)]">Buy now:</span> only this item is in this checkout;
            your cart is unchanged.{" "}
            {cartLines.length > 0 ? (
              <Link href="/checkout" className="font-semibold text-[var(--color-action-red)] underline-offset-4 hover:underline">
                Check out your cart instead
              </Link>
            ) : null}
          </p>
        ) : null}

        {/* Phones: collapsible summary above the form */}
        <section className={`${SECTION} mb-4 !p-0 lg:hidden`}>
          <button
            type="button"
            aria-expanded={summaryOpen}
            aria-controls="checkout-summary-mobile"
            onClick={() => setSummaryOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <CartIcon size={18} />
              {summaryOpen ? "Hide order summary" : "Show order summary"}
              <ChevronDownIcon size={16} className={`transition-transform ${summaryOpen ? "rotate-180" : ""}`} />
            </span>
            <span className="text-base font-bold tabular-nums">{formatSamplePrice(quote.total)}</span>
          </button>
          <div
            id="checkout-summary-mobile"
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${summaryOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          >
            <div className="overflow-hidden" inert={!summaryOpen}>
              <div className="border-t border-[var(--color-light-grey)] px-4 py-4">
                <CheckoutSummary quote={quote} />
              </div>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
          <form ref={formRef} id="checkout-form" noValidate onSubmit={onSubmit} className="space-y-4">
            <Section number={1} title="Contact details" done={contactDone}>
              <p className="-mt-1 mb-4 text-xs text-[var(--text-secondary)]">
                Checking out as a guest. Customer accounts are coming soon.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input id="checkout-name" label="Full name" required autoComplete="name" maxLength={FIELD_LIMITS.fullName} {...field("fullName")} />
                </div>
                <Input
                  id="checkout-email"
                  label="Email address"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  maxLength={FIELD_LIMITS.email}
                  hint="Your order confirmation goes here."
                  {...field("email")}
                />
                <Input
                  id="checkout-phone"
                  label="Phone number"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="0712 345 678"
                  maxLength={FIELD_LIMITS.phone}
                  hint="Tanzanian mobile number, for delivery contact."
                  {...field("phone")}
                />
              </div>
            </Section>

            <Section number={2} title="Delivery" done={deliveryDone}>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Delivery method</legend>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {DELIVERY_METHODS.map((method) => {
                    const checked = form.deliveryMethod === method.id;
                    return (
                      <label
                        key={method.id}
                        className={`relative flex gap-3 rounded-xl border p-3.5 transition-colors ${
                          !method.enabled
                            ? "cursor-not-allowed border-[var(--color-light-grey)] bg-[var(--surface-card)] opacity-70"
                            : checked
                              ? "cursor-pointer border-[var(--color-action-red)] bg-[#fff7f7] ring-1 ring-[var(--color-action-red)]"
                              : "cursor-pointer border-[var(--color-light-grey)] hover:border-[var(--color-mid-grey)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="deliveryMethod"
                          value={method.id}
                          checked={checked}
                          disabled={!method.enabled}
                          onChange={() => update("deliveryMethod", method.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-action-red)]"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{method.label}</span>
                          <span className="block text-xs text-[var(--text-secondary)]">{method.description}</span>
                          <span className="mt-1 block text-xs font-medium text-[var(--text-muted)]">
                            {method.feeMinor !== null && method.enabled ? formatSamplePrice(method.feeMinor) : method.note}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {form.deliveryMethod === "home" ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Select id="checkout-region" label="Region" required autoComplete="address-level1" {...field("region")}>
                    <option value="">Choose a region</option>
                    {TZ_REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </Select>
                  <Input
                    id="checkout-district"
                    label="District or city"
                    required
                    autoComplete="address-level2"
                    maxLength={FIELD_LIMITS.district}
                    {...field("district")}
                  />
                  <Input id="checkout-ward" label="Ward or area" required maxLength={FIELD_LIMITS.ward} {...field("ward")} />
                  <Input
                    id="checkout-street"
                    label="Street or building"
                    required
                    autoComplete="address-line1"
                    maxLength={FIELD_LIMITS.street}
                    {...field("street")}
                  />
                  <div className="sm:col-span-2">
                    <Input
                      id="checkout-extra"
                      label="Additional address details"
                      autoComplete="address-line2"
                      placeholder="Floor, gate, landmark (optional)"
                      maxLength={FIELD_LIMITS.addressExtra}
                      {...field("addressExtra")}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Textarea
                      id="checkout-instructions"
                      label="Delivery instructions"
                      rows={3}
                      placeholder="Best time to deliver, who to call on arrival (optional)"
                      maxLength={FIELD_LIMITS.instructions}
                      {...field("instructions")}
                    />
                  </div>
                </div>
              ) : null}
              <p className="mt-4 text-xs text-[var(--text-muted)]">
                Delivery areas and fees are confirmed before you pay.
              </p>
            </Section>

            <Section number={3} title="Payment" done={paymentDone}>
              <fieldset aria-describedby="payment-status">
                <legend className="sr-only">Payment method</legend>
                <div className="grid gap-2.5">
                  {PAYMENT_METHODS.map((method) => {
                    const available = method.status !== "unavailable";
                    const checked = form.paymentMethod === method.id;
                    return (
                      <label
                        key={method.id}
                        className={`flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                          !available
                            ? "cursor-not-allowed border-[var(--color-light-grey)] bg-[var(--surface-card)]"
                            : checked
                              ? "cursor-pointer border-[var(--color-action-red)] bg-[#fff7f7] ring-1 ring-[var(--color-action-red)]"
                              : "cursor-pointer border-[var(--color-light-grey)] hover:border-[var(--color-mid-grey)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={checked}
                          disabled={!available}
                          onChange={() => update("paymentMethod", method.id)}
                          className="h-4 w-4 shrink-0 accent-[var(--color-action-red)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm font-semibold ${available ? "" : "text-[var(--text-secondary)]"}`}>
                            {method.label}
                          </span>
                          <span className="block text-xs text-[var(--text-muted)]">{method.description}</span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            available
                              ? "bg-[#e8f5ec] text-[var(--color-success)]"
                              : "border border-dashed border-[var(--color-light-grey)] text-[var(--text-muted)]"
                          }`}
                        >
                          {method.status === "sandbox" ? "Test mode" : available ? "Available" : "Not available yet"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {touched.paymentMethod && errors.paymentMethod ? (
                <p className="mt-2 text-xs font-medium text-[var(--color-action-red)]">{errors.paymentMethod}</p>
              ) : null}
              <p id="payment-status" className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                {form.paymentMethod === "pay_on_delivery"
                  ? "Pay the delivery team in cash when your order arrives. "
                  : null}
                Mobile money, card and bank transfer are being connected. TRONIC never stores card details.
              </p>
            </Section>

            <Section number={4} title="Review and place order" done={false}>
              <p className="text-sm text-[var(--text-secondary)]">
                By placing an order you agree to our{" "}
                <Link href="/policies/terms" className="font-medium text-[var(--text-primary)] underline underline-offset-2">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/policies/returns" className="font-medium text-[var(--text-primary)] underline underline-offset-2">
                  Return Policy
                </Link>
                .
              </p>
              <button
                type="submit"
                disabled={!canSubmit}
                className="mt-4 hidden h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-action-red)] text-[15px] font-semibold text-white shadow-[0_10px_26px_-12px_rgba(215,25,32,0.7)] transition-[background-color,transform] hover:bg-[var(--color-action-red-dark)] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[var(--color-light-grey)] disabled:text-[var(--text-muted)] disabled:shadow-none lg:inline-flex"
              >
                {placeLabel} · {formatSamplePrice(quote.total)}
              </button>
              <div aria-live="polite">
                {notice ? (
                  <p role="status" className="mt-4 rounded-xl border border-[var(--color-light-grey)] bg-[var(--surface-card)] px-4 py-3 text-sm leading-relaxed">
                    {notice}
                  </p>
                ) : null}
              </div>
            </Section>
          </form>

          <aside
            aria-label="Order summary"
            className={`${SECTION} hidden lg:sticky lg:top-[calc(var(--header-height)_+_1rem)] lg:block`}
          >
            <h2 className="mb-4 text-base font-bold" style={HEADING_FONT}>
              Order summary
            </h2>
            <CheckoutSummary quote={quote} />
          </aside>
        </div>
      </Container>

      {/* Phones and tablets: sticky total + Place order, above the tab bar */}
      <div
        data-sticky-purchase
        data-sticky-checkout
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-[var(--color-light-grey)] bg-white/95 px-4 py-2.5 backdrop-blur md:bottom-0 md:pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-[var(--text-muted)]">{quote.totalIsPartial ? "Total so far" : "Total"}</p>
            <p className="text-base font-bold leading-tight tabular-nums text-[var(--color-action-red)]">
              {formatSamplePrice(quote.total)}
            </p>
          </div>
          <button
            type="submit"
            form="checkout-form"
            disabled={!canSubmit}
            className="ml-auto inline-flex h-11 flex-1 items-center justify-center rounded-full bg-[var(--color-action-red)] px-5 text-sm font-semibold text-white disabled:bg-[var(--color-light-grey)] disabled:text-[var(--text-muted)] sm:flex-none sm:px-8"
          >
            {placeLabel}
          </button>
        </div>
      </div>
    </>
  );
}

function Section({ number, title, done, children }: { number: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={`checkout-step-${number}`} className={SECTION}>
      <h2 id={`checkout-step-${number}`} className="mb-4 flex items-center gap-2.5 text-base font-bold md:text-lg" style={HEADING_FONT}>
        <span
          aria-hidden="true"
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
            done ? "bg-[var(--color-success)] text-white" : "bg-[var(--color-action-red)] text-white"
          }`}
        >
          {done ? "✓" : number}
        </span>
        {title}
        {done ? <span className="sr-only">(complete)</span> : null}
      </h2>
      {children}
    </section>
  );
}
