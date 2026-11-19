"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronUp, Phone, PhoneOff, Store, Truck } from "lucide-react";
import type { CustomerTracking } from "@tronic/database";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import { formatDate } from "@/components/account/ui";
import { refreshTrackingAction } from "@/features/account/actions";
import { buildTracking, type TrackableOrder } from "@/features/account/tracking";
import { TrackingMap } from "./TrackingMap";

/**
 * Live order tracking (owner brief 2026-11-19): the order's status, the
 * rider and where the rider is now. Everything shown comes from the order's
 * own records (migration 0012): status history, the rider's first name and
 * phone, and the positions the rider's phone reported. Nothing is estimated:
 * there is no store or address location yet, so arrival time and distance
 * say "not available" instead of a guess.
 *
 * While the order is on its way the page asks for news every 15 seconds
 * (every minute before that) and only while it is visible; a status change
 * reloads the page's server parts (the delivery code, the summary).
 */

const ON_THE_WAY = new Set(["dispatched", "in_transit"]);
const FINISHED = new Set(["delivered", "cancelled"]);
const FAST_POLL_MS = 15_000;
const SLOW_POLL_MS = 60_000;
/** A position older than this is called out as old. */
const STALE_MS = 5 * 60_000;
/** One shared empty path, so the map is not redrawn on every render without a position. */
const NO_POINTS: CustomerTracking["path"] = [];

function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : formatDate(iso, true);
}

function headline(status: string, pickup: boolean, riderName: string | null): { title: string; text: string; tone: "live" | "progress" | "done" | "stopped" } {
  if (status === "cancelled") return { title: "Order cancelled", text: "This order was cancelled and will not be delivered.", tone: "stopped" };
  if (status === "delivered")
    return { title: pickup ? "Order collected" : "Order delivered", text: pickup ? "You have collected your order." : "Your order has been delivered. Thank you for shopping with TRONIC.", tone: "done" };
  if (pickup) {
    if (["packed", "dispatched", "in_transit"].includes(status)) return { title: "Ready for pickup", text: "Your order is packed and waiting for you at the store.", tone: "live" };
    return { title: "Preparing your order", text: "We will tell you when it is ready to collect.", tone: "progress" };
  }
  if (status === "in_transit")
    return { title: "Out for delivery", text: riderName ? `${riderName} is bringing your order to you.` : "Your order is on its way to you.", tone: "live" };
  if (status === "dispatched")
    return { title: "On its way", text: riderName ? `${riderName} has your order and is setting off.` : "Your order has left our store.", tone: "live" };
  if (status === "pending_payment") return { title: "Order placed", text: "We have received your order.", tone: "progress" };
  return { title: "Preparing your order", text: "We are getting your items ready for delivery.", tone: "progress" };
}

const TONE_CLASS = {
  live: "bg-[#17743a] text-white",
  progress: "bg-[var(--color-premium-black)] text-white",
  done: "bg-[#e9f7ef] text-[#0f4f27]",
  stopped: "bg-[#fdecec] text-[#8f1016]",
} as const;

export function LiveTracking({
  orderNumber,
  order,
  initial,
  address,
  orderHref,
  code,
  summary,
}: {
  orderNumber: string;
  order: TrackableOrder;
  initial: CustomerTracking | null;
  /** The delivery address as one line; shown as text (there is no map pin for it). */
  address: string | null;
  orderHref: string;
  /** The delivery code card, when the order is on its way. */
  code: React.ReactNode;
  /** Order summary and delivery details. */
  summary: React.ReactNode;
}) {
  const router = useRouter();
  const [live, setLive] = useState<CustomerTracking | null>(initial);
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(true);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);

  const status = live?.status ?? order.status;
  const pickup = order.deliveryMethod === "pickup";
  const onTheWay = !pickup && ON_THE_WAY.has(status);
  const tracking = buildTracking({ ...order, status }, live?.events ?? []);
  const rider = onTheWay ? (live?.rider ?? null) : null;
  const path = (onTheWay ? live?.path : undefined) ?? NO_POINTS;
  const latest = path.at(-1) ?? null;
  const top = headline(status, pickup, rider?.name || null);

  // Ask for news while the page is visible; stop once the order is finished.
  useEffect(() => {
    if (FINISHED.has(status) || initial === null) return;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const next = await refreshTrackingAction(orderNumber).catch(() => null);
      if (stopped || !next) return;
      setLive(next);
      if (next.status !== status) router.refresh();
    };
    const timer = window.setInterval(tick, onTheWay ? FAST_POLL_MS : SLOW_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, onTheWay, orderNumber, router, initial]);

  // A clock for "updated 2 min ago" (set after mount so server and browser agree).
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // The sheet folds only on phones; a wider window always shows everything.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 64rem)");
    const unfold = () => {
      if (wide.matches) setOpen(true);
    };
    wide.addEventListener("change", unfold);
    return () => wide.removeEventListener("change", unfold);
  }, []);

  const stale = latest && now !== null && now - new Date(latest.at).getTime() > STALE_MS;
  const overlay = pickup
    ? "This order is collected at the store, so there is no rider to follow."
    : status === "cancelled"
      ? "This order was cancelled."
      : status === "delivered"
        ? "Your order has been delivered."
        : !onTheWay
          ? "The live map starts when your order leaves our store."
          : initial === null
            ? "Live location is not available right now."
            : !latest
              ? "Waiting for the rider's location. It appears here as soon as the rider shares it."
              : null;
  const currentStep = tracking.steps.find((step) => step.state === "current");

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* Left column on wide screens; on phones its parts interleave with the map (display: contents + order). */}
      <div className="contents lg:flex lg:flex-col lg:gap-5">
        <section aria-labelledby="tracking-status" aria-live="polite" className={`order-1 rounded-2xl p-4 md:p-5 ${TONE_CLASS[top.tone]}`}>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
              {pickup ? <Store size={22} /> : <Truck size={22} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="tracking-status" className="text-lg font-bold leading-tight md:text-xl">
                  {top.title}
                </h2>
                {onTheWay && latest && !stale ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
                    <span aria-hidden="true" className="relative flex h-2 w-2">
                      <span className="tracking-rider-pulse !inset-[-3px] !bg-white/50" />
                      <span className="relative h-2 w-2 rounded-full bg-white" />
                    </span>
                    Live
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm opacity-90">{top.text}</p>
            </div>
          </div>
        </section>

        <section
          aria-label="Delivery progress"
          className="order-3 rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)] max-lg:relative max-lg:z-10 max-lg:-mt-10 max-lg:rounded-t-[1.75rem] max-lg:shadow-[0_-8px_24px_rgba(17,17,17,0.10)]"
        >
          <button
            type="button"
            className="flex w-full touch-none flex-col items-center gap-1 pb-1 pt-2.5 lg:hidden"
            aria-expanded={open}
            aria-controls="tracking-sheet-body"
            onPointerDown={(event) => {
              drag.current = { y: event.clientY, moved: false };
            }}
            onPointerUp={(event) => {
              const start = drag.current;
              if (!start) return;
              const dy = event.clientY - start.y;
              if (Math.abs(dy) > 24) {
                start.moved = true;
                setOpen(dy < 0);
              }
            }}
            onClick={() => {
              if (drag.current?.moved) {
                drag.current = null;
                return;
              }
              drag.current = null;
              setOpen((value) => !value);
            }}
          >
            <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-[var(--color-light-grey)]" />
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]">
              {open ? "Hide progress" : "Show progress"}
              {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />}
            </span>
          </button>

          <div className="space-y-4 p-4 pt-2 md:p-5 lg:pt-5">
            {pickup ? null : <RiderCard rider={rider} onTheWay={onTheWay} status={status} />}
            {code}
            {!open && currentStep ? (
              <p className="flex items-center justify-between gap-3 rounded-xl bg-[#f6f6f7] px-3.5 py-2.5 text-sm lg:hidden">
                <span className="font-semibold text-[var(--color-action-red)]">{currentStep.title}</span>
                {currentStep.at ? <span className="text-xs tabular-nums text-[var(--text-muted)]">{formatDate(currentStep.at, true)}</span> : null}
              </p>
            ) : null}
            <div id="tracking-sheet-body" className="tracking-sheet-body" data-open={open} inert={!open}>
              <div>
                <h3 className="mb-3 text-sm font-bold">Progress</h3>
                <OrderTimeline tracking={tracking} />
              </div>
            </div>
            <Link
              href={orderHref}
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[var(--color-light-grey)] bg-white text-sm font-semibold transition-colors hover:border-[var(--color-premium-black)] lg:hidden"
            >
              Order details
            </Link>
          </div>
        </section>
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-5">
        <section aria-label="Map" className="tracking-map order-2 h-[56vh] min-h-[18rem] max-h-[32rem] overflow-hidden rounded-2xl shadow-[0_1px_2px_rgba(17,17,17,0.04)] lg:h-[34rem] lg:max-h-none">
          <TrackingMap path={path} overlay={overlay}>
            {pickup ? null : (
              <dl className="grid grid-cols-3 divide-x divide-[var(--color-light-grey)] rounded-2xl bg-white/95 py-2 text-center shadow-[0_6px_20px_rgba(17,17,17,0.12)] backdrop-blur">
                <div className="min-w-0 px-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] sm:text-[11px]">Arrival</dt>
                  <dd className="mt-0.5 truncate text-xs font-semibold text-[var(--text-secondary)] sm:text-sm" title="Needs the delivery address on the map">
                    Not available
                  </dd>
                </div>
                <div className="min-w-0 px-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] sm:text-[11px]">Distance</dt>
                  <dd className="mt-0.5 truncate text-xs font-semibold text-[var(--text-secondary)] sm:text-sm" title="Needs the delivery address on the map">
                    Not available
                  </dd>
                </div>
                <div className="min-w-0 px-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] sm:text-[11px]">Updated</dt>
                  <dd className={`mt-0.5 truncate text-xs font-semibold tabular-nums sm:text-sm ${stale ? "text-[#8a5300]" : ""}`}>
                    {latest && now !== null ? ago(latest.at, now) : onTheWay ? "Waiting" : "–"}
                  </dd>
                </div>
              </dl>
            )}
          </TrackingMap>
        </section>
        {address && !pickup ? (
          <p className="order-4 -mt-1 flex items-start gap-2 px-1 text-xs text-[var(--text-secondary)] max-lg:hidden">
            <span className="font-semibold text-[var(--text-primary)]">Delivering to</span>
            <span className="min-w-0 break-words">{address}</span>
          </p>
        ) : null}
        <div className="order-5 min-w-0">{summary}</div>
      </div>
    </div>
  );
}

function RiderCard({ rider, onTheWay, status }: { rider: { name: string; phone: string | null } | null; onTheWay: boolean; status: string }) {
  if (!rider) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-[#f6f6f7] px-3.5 py-3">
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[var(--text-muted)]">
          <Truck size={20} />
        </span>
        <p className="text-sm text-[var(--text-secondary)]">
          {FINISHED.has(status)
            ? "The rider's details are shown only while an order is on its way."
            : onTheWay
              ? "Your rider's details will appear here shortly."
              : "A TRONIC rider will be assigned when your order leaves our store."}
        </p>
      </div>
    );
  }
  const name = rider.name || "Your rider";
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-action-red)] text-lg font-bold text-white">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold">{name}</p>
        <p className="text-xs text-[var(--text-secondary)]">Your TRONIC rider</p>
      </div>
      {rider.phone ? (
        <a
          href={`tel:${rider.phone}`}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#17743a] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0f4f27]"
          aria-label={`Call ${name}`}
        >
          <Phone size={16} aria-hidden="true" />
          Call
        </a>
      ) : (
        <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#f1f1f3] px-3.5 text-xs font-semibold text-[var(--text-muted)]" title="The rider's phone number has not been added yet">
          <PhoneOff size={15} aria-hidden="true" />
          No phone
        </span>
      )}
    </div>
  );
}
