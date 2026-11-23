"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRightIcon, CartIcon, ChevronDownIcon, Container, ErrorState, Field, Input, Select, Textarea, controlClasses, fieldDescribedBy } from "@tronic/ui";
import { formatPrice } from "@/components/home/sampleProducts";
import { withNext } from "@/features/auth/next";
import { useCart, useHydrated } from "@/features/cart/hooks";
import type { CartLine } from "@/features/cart/store";
import { cartStore } from "@/features/cart/store";
import { getCheckoutQuote, placeOrderAction, type PlaceOrderResponse } from "@/features/checkout/actions";
import { DELIVERY_METHODS, TZ_REGIONS, isPaymentMethodAvailable } from "@/features/checkout/config";
import { DEFAULT_DIAL_CODE, DIAL_CODES, OTHER_DIAL_CODE, normalizeWhatsApp, splitWhatsApp, tzLocalNumber } from "@/features/checkout/phone";
import type { CheckoutQuote } from "@/features/checkout/quote";
import {
  EMPTY_CHECKOUT_FORM,
  FIELD_LIMITS,
  FIELD_ORDER,
  readCheckoutForm,
  validateCheckout,
  type CheckoutErrors,
  type CheckoutField,
  type CheckoutForm,
} from "@/features/checkout/validation";
import { CheckoutSummary } from "./CheckoutSummary";
import { PAYMENT_LABELS, PaymentMethods } from "./PaymentMethods";

/** The form survives leaving checkout (back to the cart, a product page)
 *  for the rest of this browser tab, and is cleared once the order is placed. */
const DRAFT_KEY = "tronic:checkout-draft";
const PAYMENT_FIELDS: readonly CheckoutField[] = ["paymentMethod", "walletProvider", "walletNumber"];

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
 * - Place order (Cash on delivery) calls placeOrderAction with an
 *   idempotency key: the database reprices, checks and reserves stock and
 *   saves the order in one transaction, and the confirmation shows only
 *   after it is saved. A retry or double click with the same details reuses
 *   the key, so it can never create a second order. While orders are not
 *   connected (`ordersEnabled` false) Place order checks the details and
 *   says plainly that nothing was sent. No order or payment is simulated.
 *
 * Desktop: form (60%) beside a sticky summary (40%). Phones: a collapsible
 * summary at the top and a sticky total + Place order bar above the tab bar.
 */
type Confirmation = Extract<PlaceOrderResponse, { ok: true }>;

/** The signed-in customer's details, to start the form with (they can change them for this order). */
export interface CheckoutCustomer {
  fullName: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * The account's number as the WhatsApp field starts with it: its country
 * code chosen in the list and the rest in the field, or the whole number
 * under "Other country" when its code is not in the list.
 */
function startingNumber(phone: string | null): { phoneCountry: string; phone: string } {
  const split = splitWhatsApp(phone);
  if (split) return { phoneCountry: split.dialCode, phone: split.national };
  return phone ? { phoneCountry: OTHER_DIAL_CODE, phone } : { phoneCountry: DEFAULT_DIAL_CODE, phone: "" };
}

/** True for a number typed in full: it starts with a plus sign or 00, so it carries its own country code. */
const typedInFull = (value: string) => /^\s*(\+|00)/.test(value);

export function CheckoutView({
  buyNowLine,
  ordersEnabled = false,
  customer = null,
}: {
  buyNowLine: CartLine | null;
  ordersEnabled?: boolean;
  customer?: CheckoutCustomer | null;
}) {
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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // One idempotency key per distinct submission: retries of the same
  // details reuse it; changed details (or a changed total) get a new one.
  const attemptRef = useRef<{ key: string; payload: string } | null>(null);

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

  // Bring back what the customer typed earlier in this tab (untrusted:
  // known string fields only; a payment method no longer offered is dropped).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!hydrated || restoredRef.current) return;
    restoredRef.current = true;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(DRAFT_KEY);
    } catch {
      raw = null;
    }
    if (!raw) {
      // A first visit: start from the customer's account details.
      if (customer) {
        setForm((current) => ({
          ...current,
          fullName: current.fullName || (customer.fullName ?? ""),
          email: current.email || (customer.email ?? ""),
          ...(current.phone ? {} : startingNumber(customer.phone)),
        }));
      }
      return;
    }
    try {
      const draft = readCheckoutForm(JSON.parse(raw) as unknown);
      if (!isPaymentMethodAvailable(draft.paymentMethod)) {
        draft.paymentMethod = EMPTY_CHECKOUT_FORM.paymentMethod;
        draft.walletProvider = "";
      }
      setForm(draft);
    } catch {
      // A damaged draft is ignored.
    }
  }, [hydrated, customer]);

  useEffect(() => {
    if (!restoredRef.current || confirmation) return;
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      // Storage may be blocked; the form still works without it.
    }
  }, [form, confirmation]);

  const update = useCallback(
    (field: CheckoutField, value: string) => {
      setForm((current) => {
        const next = { ...current, [field]: value } as CheckoutForm;
        // The wallet number starts as the contact number when that is a Tanzanian one; the customer can change it.
        if (field === "paymentMethod" && value === "mobile_money" && next.walletNumber.trim() === "") {
          next.walletNumber = tzLocalNumber(normalizeWhatsApp(current.phone, current.phoneCountry)) ?? "";
        }
        // The country code has no message of its own: changing it checks the number again.
        const checked = field === "phoneCountry" ? "phone" : field;
        if (touched[checked]) {
          const fieldError = validateCheckout(next)[checked];
          setErrors((existing) => ({ ...existing, [checked]: fieldError }));
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
      let next = form;
      if (field === "phone" && typedInFull(form.phone)) {
        // A number typed in full (+254 712…) moves its country code into the list, so the customer sees how it was
        // read; a code that is not in the list stays in the field, under "Other country".
        const split = splitWhatsApp(normalizeWhatsApp(form.phone));
        next = split ? { ...form, phoneCountry: split.dialCode, phone: split.national } : { ...form, phoneCountry: OTHER_DIAL_CODE };
        setForm(next);
      }
      setErrors((existing) => ({ ...existing, [field]: validateCheckout(next)[field] }));
    },
    [form],
  );

  const allErrors = useMemo(() => validateCheckout(form), [form]);
  const contactDone = CONTACT_FIELDS.every((field) => !allErrors[field]);
  const deliveryDone = DELIVERY_FIELDS.every((field) => !allErrors[field]);
  const paymentDone = PAYMENT_FIELDS.every((field) => !allErrors[field]);
  const paymentLabel = !allErrors.paymentMethod && form.paymentMethod ? PAYMENT_LABELS[form.paymentMethod] : null;

  const quote = quoteState.status === "ready" ? quoteState.quote : null;
  const canSubmit = quote !== null && quote.itemCount > 0 && !submitting;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !quote) return;
    const found = validateCheckout(form);
    setErrors(found);
    setTouched(Object.fromEntries(FIELD_ORDER.map((field) => [field, true])));
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) {
      setNotice(null);
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (!ordersEnabled) {
      setNotice(
        `Your details are complete${form.paymentMethod === "pay_on_delivery" ? " and Cash on delivery is selected" : ""}. Online ordering is not connected yet, so this order was not sent to TRONIC: nothing has been ordered or charged. Your cart stays saved on this device.`,
      );
      return;
    }

    // One submission at a time (the button is disabled while it runs).
    const payload = { lines, form, expectedTotalMinor: quote.totalMinor };
    const serialized = JSON.stringify(payload);
    if (attemptRef.current?.payload !== serialized) {
      attemptRef.current = { key: crypto.randomUUID(), payload: serialized };
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await placeOrderAction({ idempotencyKey: attemptRef.current.key, ...payload });
      if (result.ok) {
        if (!buyNowLine) cartStore.set([]);
        try {
          window.sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          // Nothing to clear.
        }
        setConfirmation(result);
        window.scrollTo({ top: 0 });
        return;
      }
      switch (result.reason) {
        case "price_changed":
          setReload((count) => count + 1);
          setNotice(
            `Prices changed since you opened checkout. The new total is ${formatPrice(result.totalMinor)}. Check the order summary, then place your order again.`,
          );
          break;
        case "lines_unavailable":
          setReload((count) => count + 1);
          setNotice(
            "Some items are no longer available in the quantity you chose. The order summary is updated; adjust your cart and try again. Nothing was ordered.",
          );
          break;
        case "invalid":
          setErrors((existing) => ({ ...existing, ...result.fieldErrors }));
          setNotice("Some details need another look. Nothing was ordered.");
          break;
        case "conflict":
          attemptRef.current = null;
          setNotice("Your order details changed while it was being placed. Check them and place the order again.");
          break;
        case "sign_in_required":
          // The session ended (signed out elsewhere, expired): sign in again and come back.
          // The cart and the typed details stay on this device.
          setNotice("Your sign-in has ended. Sign in again to place your order. Nothing was ordered.");
          window.location.assign(withNext("/login", `${window.location.pathname}${window.location.search}`));
          break;
        default:
          setNotice("Online ordering is not available right now. Nothing was ordered or charged.");
      }
    } catch {
      // The same key is kept, so trying again cannot create a second order.
      setNotice("We could not confirm your order. Check your connection and press Place order again: it will not be placed twice.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return <OrderConfirmation confirmation={confirmation} />;
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

  const phoneError = touched.phone ? errors.phone : undefined;
  const placeLabel = submitting ? (ordersEnabled ? "Placing order…" : "Checking…") : "Place order";

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
            <span className="text-base font-bold tabular-nums">{formatPrice(quote.totalMinor)}</span>
          </button>
          <div
            id="checkout-summary-mobile"
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${summaryOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          >
            <div className="overflow-hidden" inert={!summaryOpen}>
              <div className="border-t border-[var(--color-light-grey)] px-4 py-4">
                <CheckoutSummary quote={quote} paymentLabel={paymentLabel} />
              </div>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
          <form ref={formRef} id="checkout-form" noValidate onSubmit={onSubmit} className="space-y-4">
            <Section number={1} title="Contact details" done={contactDone}>
              <p className="-mt-1 mb-4 text-xs text-[var(--text-secondary)]">
                {customer?.email
                  ? `Signed in as ${customer.email}. The order is saved to your account; you can change the contact details for this delivery.`
                  : "Orders are placed from a TRONIC account."}
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
                <Field
                  id="checkout-phone"
                  label="WhatsApp number"
                  required
                  hint="With its country code. We contact you on this number about your delivery."
                  error={phoneError}
                >
                  <div className="flex gap-2">
                    <span className="relative block w-[8.5rem] shrink-0">
                      <select
                        name="phoneCountry"
                        aria-label="Country code"
                        autoComplete="tel-country-code"
                        value={form.phoneCountry}
                        onChange={(event) => update("phoneCountry", event.target.value)}
                        className={`${controlClasses()} appearance-none truncate pr-8`}
                      >
                        {DIAL_CODES.map((entry) => (
                          <option key={entry.iso} value={entry.code}>
                            {entry.code} {entry.name}
                          </option>
                        ))}
                        <option value={OTHER_DIAL_CODE}>Other country</option>
                      </select>
                      <ChevronDownIcon size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    </span>
                    <input
                      id="checkout-phone"
                      name="phone"
                      type="tel"
                      required
                      autoComplete={form.phoneCountry === OTHER_DIAL_CODE ? "tel" : "tel-national"}
                      inputMode="tel"
                      placeholder={form.phoneCountry === OTHER_DIAL_CODE ? "+255 712 345 678" : form.phoneCountry === DEFAULT_DIAL_CODE ? "712 345 678" : "Without the country code"}
                      maxLength={FIELD_LIMITS.phone}
                      value={form.phone}
                      onChange={(event) => update("phone", event.target.value)}
                      onBlur={() => blur("phone")}
                      aria-invalid={phoneError ? true : undefined}
                      aria-describedby={fieldDescribedBy("checkout-phone", phoneError ? undefined : "hint", phoneError)}
                      className={`${controlClasses(phoneError)} min-w-0 flex-1`}
                    />
                  </div>
                </Field>
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
                            {method.feeMinor !== null && method.enabled ? formatPrice(method.feeMinor) : method.note}
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
              <PaymentMethods
                form={form}
                errors={errors}
                touched={touched}
                totalMinor={quote.totalMinor}
                totalIsPartial={quote.totalIsPartial}
                onChange={update}
                onBlur={blur}
              />
            </Section>

            <Section number={4} title="Review and place order" done={false}>
              <dl className="mb-4 divide-y divide-[var(--color-light-grey)] rounded-xl border border-[var(--color-light-grey)] text-sm">
                <ReviewRow label="Contact" step={1} complete={contactDone}>
                  {contactDone ? `${form.fullName.trim()} · ${normalizeWhatsApp(form.phone, form.phoneCountry) ?? form.phone.trim()}` : null}
                </ReviewRow>
                <ReviewRow label="Deliver to" step={2} complete={deliveryDone}>
                  {deliveryDone
                    ? [form.street, form.ward, form.district, form.region].map((part) => part.trim()).filter(Boolean).join(", ")
                    : null}
                </ReviewRow>
                <ReviewRow label="Payment" step={3} complete={paymentDone}>
                  {paymentDone && form.paymentMethod ? PAYMENT_LABELS[form.paymentMethod] : null}
                </ReviewRow>
              </dl>
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
                {placeLabel} · {formatPrice(quote.totalMinor)}
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
            <CheckoutSummary quote={quote} paymentLabel={paymentLabel} />
          </aside>
        </div>
      </Container>

      {/* Phones and tablets: sticky total + Place order. On phones the panel reaches
          the bottom edge and the tab bar floats over its lower part
          (globals.css, [data-sticky-purchase]). */}
      <div
        data-sticky-purchase
        data-sticky-checkout
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-light-grey)] bg-white/95 px-4 pt-2.5 backdrop-blur md:pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-[var(--text-muted)]">{quote.totalIsPartial ? "Total so far" : "Total"}</p>
            <p className="text-base font-bold leading-tight tabular-nums text-[var(--color-action-red)]">
              {formatPrice(quote.totalMinor)}
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

/** Shown only after the order is saved in the database. */
function OrderConfirmation({ confirmation }: { confirmation: Confirmation }) {
  return (
    <Container className="flex flex-col items-center py-12 text-center lg:py-20">
      <span
        aria-hidden="true"
        className="grid h-16 w-16 place-items-center rounded-full bg-[#e8f5ec] text-2xl font-bold text-[var(--color-success)]"
      >
        ✓
      </span>
      <h2 className="mt-5 text-xl font-bold" style={HEADING_FONT}>
        Order placed
      </h2>
      <p role="status" className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
        Thank you. Your order number is <strong className="tabular-nums text-[var(--text-primary)]">{confirmation.orderNumber}</strong>.
        You can follow it in your account. Pay the delivery team in cash when it arrives.
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <dt className="text-left text-[var(--text-secondary)]">Items</dt>
        <dd className="text-right font-medium tabular-nums">{confirmation.itemCount}</dd>
        <dt className="text-left text-[var(--text-secondary)]">Total to pay</dt>
        <dd className="text-right font-bold tabular-nums">{formatPrice(confirmation.totalMinor)}</dd>
      </dl>
      <p className="mt-3 max-w-md text-xs text-[var(--text-muted)]">Delivery fees, if any, are confirmed with you before delivery.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`/account/orders/${encodeURIComponent(confirmation.orderNumber)}`}
          className="inline-flex h-11 items-center rounded-full border border-[var(--color-light-grey)] bg-white px-6 text-sm font-semibold"
        >
          Track your order
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-full bg-[var(--color-action-red)] px-6 text-sm font-semibold text-white"
        >
          Continue shopping
        </Link>
      </div>
    </Container>
  );
}

/** One line of the order review, with a link back to its step. */
function ReviewRow({ label, step, complete, children }: { label: string; step: number; complete: boolean; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-3">
      <dt className="w-20 shrink-0 text-[var(--text-secondary)]">{label}</dt>
      <dd className={`min-w-0 flex-1 break-words ${complete ? "font-medium" : "text-[var(--text-muted)]"}`}>
        {complete ? children : "Not complete yet"}
      </dd>
      <a
        href={`#checkout-step-${step}`}
        className="-my-1 inline-flex min-h-8 shrink-0 items-center rounded-full px-2 text-xs font-semibold text-[var(--color-action-red)] underline-offset-4 hover:underline"
      >
        {complete ? "Edit" : "Complete"}
        <span className="sr-only"> {label.toLowerCase()}</span>
      </a>
    </div>
  );
}

function Section({ number, title, done, children }: { number: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={`checkout-step-${number}`} className={SECTION}>
      <h2 id={`checkout-step-${number}`} className="mb-4 flex scroll-mt-[calc(var(--header-height)_+_1rem)] items-center gap-2.5 text-base font-bold md:text-lg" style={HEADING_FONT}>
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
