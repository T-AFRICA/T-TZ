"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Input } from "@tronic/ui";
import { ACTIVE_COUNTRY, formatMoney } from "@tronic/country-config";
import { trackOrderAction, type TrackOrderState } from "@/features/orders/actions";
import { ORDER_NUMBER_PATTERN, ORDER_STATUS_LABELS } from "@/features/orders/status";

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

const IDLE: TrackOrderState = { status: "idle" };

/**
 * Track Order. The form posts (method POST, with or without JavaScript) to
 * trackOrderAction, which looks the order up by number plus the phone or
 * email used at checkout (both must match). The order number never goes
 * into a URL. While online orders are not connected (`enabled` false) the
 * form cannot be submitted and says so instead of inventing a status.
 */
export function TrackOrderView({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(trackOrderAction, IDLE);
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [errors, setErrors] = useState<{ orderNumber?: string; contact?: string }>({});
  const shown = { ...(state.status === "invalid" ? state.fieldErrors : {}), ...errors };

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!enabled) {
      event.preventDefault();
      return;
    }
    const next: typeof errors = {};
    if (!ORDER_NUMBER_PATTERN.test(orderNumber.trim())) next.orderNumber = "Enter the order number from your confirmation.";
    if (contact.trim().length < 5 || contact.trim().length > 254) next.contact = "Enter the phone number or email used at checkout.";
    setErrors(next);
    if (next.orderNumber || next.contact) event.preventDefault();
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
      <form action={action} noValidate onSubmit={onSubmit} className="rounded-2xl bg-white p-4 md:border md:border-[var(--color-light-grey)] md:p-6">
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
            error={shown.orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
          />
          <Input
            id="track-order-contact"
            name="contact"
            label="Phone or email"
            required
            maxLength={254}
            value={contact}
            error={shown.contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={!enabled || pending}
          aria-busy={pending || undefined}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--color-action-red)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)] disabled:cursor-not-allowed disabled:bg-[var(--color-light-grey)] disabled:text-[var(--text-muted)] sm:w-auto"
        >
          {pending ? "Looking up…" : "Track order"}
        </button>
        <div aria-live="polite">
          {!enabled || state.status === "unavailable" ? (
            <p role="status" className="mt-4 rounded-xl border border-[var(--color-light-grey)] bg-[var(--surface-card)] px-4 py-3 text-sm">
              Online order tracking opens together with online ordering.
            </p>
          ) : state.status === "not_found" ? (
            <p role="status" className="mt-4 rounded-xl border border-[var(--color-light-grey)] bg-[var(--surface-card)] px-4 py-3 text-sm">
              We couldn&apos;t find an order with that number and contact. Check both and try again.
            </p>
          ) : state.status === "found" ? (
            <div role="status" className="mt-4 rounded-xl border border-[var(--color-success)] bg-[#f3faf5] px-4 py-3 text-sm">
              <p className="font-semibold">
                Order {state.order.orderNumber}: {ORDER_STATUS_LABELS[state.order.status] ?? state.order.status}
              </p>
              <p className="mt-1 text-[var(--text-secondary)]">
                {state.order.itemCount} {state.order.itemCount === 1 ? "item" : "items"} ·{" "}
                {formatMoney(state.order.totalMinor, ACTIVE_COUNTRY, state.order.currency)} · placed{" "}
                {new Date(state.order.createdAt).toLocaleDateString(ACTIVE_COUNTRY.locale, { dateStyle: "medium" })}
              </p>
            </div>
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
