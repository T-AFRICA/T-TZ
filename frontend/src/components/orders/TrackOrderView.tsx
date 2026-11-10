"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@tronic/ui";

/** Customer-facing order statuses, in order (owner brief 2026-11-10). */
export const ORDER_STATUSES = [
  { label: "Pending payment", text: "Order received; waiting for payment to be confirmed." },
  { label: "Confirmed", text: "Payment confirmed by the payment provider." },
  { label: "Processing", text: "Your items are being prepared." },
  { label: "Packed", text: "Packed and ready to leave." },
  { label: "Dispatched", text: "Handed to the delivery team." },
  { label: "In transit", text: "On the way to your address." },
  { label: "Delivered", text: "Delivered to your address." },
] as const;

const ORDER_NUMBER = /^[A-Za-z0-9-]{4,40}$/;

/**
 * Track Order (frontend first, owner request 2026-11-10). The form checks
 * its input, but online orders do not exist yet, so nothing is looked up
 * and no status is shown; the page says so plainly instead of inventing a
 * delivery progress. When orders go live, submit looks up the order by
 * number plus the phone or email used at checkout (both must match).
 */
export function TrackOrderView() {
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [errors, setErrors] = useState<{ orderNumber?: string; contact?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!ORDER_NUMBER.test(orderNumber.trim())) next.orderNumber = "Enter the order number from your confirmation.";
    if (contact.trim().length < 5 || contact.trim().length > 254) next.contact = "Enter the phone number or email used at checkout.";
    setErrors(next);
    setNotice(
      Object.keys(next).length === 0
        ? "Online order tracking opens together with online ordering. Nothing was looked up."
        : null,
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
      <form noValidate onSubmit={onSubmit} className="rounded-2xl bg-white p-4 md:border md:border-[var(--color-light-grey)] md:p-6">
        <h2 className="text-base font-bold md:text-lg">Find your order</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Use the order number from your confirmation and the phone number or email you checked out with.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input
            id="track-order-number"
            name="orderNumber"
            label="Order number"
            required
            autoComplete="off"
            maxLength={40}
            value={orderNumber}
            error={errors.orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
          />
          <Input
            id="track-order-contact"
            name="contact"
            label="Phone or email"
            required
            maxLength={254}
            value={contact}
            error={errors.contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </div>
        <button
          type="submit"
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--color-action-red)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)] sm:w-auto"
        >
          Track order
        </button>
        <div aria-live="polite">
          {notice ? (
            <p role="status" className="mt-4 rounded-xl border border-[var(--color-light-grey)] bg-[var(--surface-card)] px-4 py-3 text-sm">
              {notice}
            </p>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="order-statuses" className="rounded-2xl bg-white p-4 md:border md:border-[var(--color-light-grey)] md:p-6">
        <h2 id="order-statuses" className="text-base font-bold">
          What each status means
        </h2>
        <ol className="mt-4">
          {ORDER_STATUSES.map((status, index) => (
            <li key={status.label} className="relative flex gap-3 pb-4 last:pb-0">
              {index < ORDER_STATUSES.length - 1 ? (
                <span aria-hidden="true" className="absolute left-[0.6875rem] top-6 h-[calc(100%-1.25rem)] w-px bg-[var(--color-light-grey)]" />
              ) : null}
              <span
                aria-hidden="true"
                className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-[var(--color-light-grey)] bg-white text-[10px] font-bold text-[var(--text-muted)]"
              >
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold">{status.label}</span>
                <span className="block text-xs text-[var(--text-secondary)]">{status.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
