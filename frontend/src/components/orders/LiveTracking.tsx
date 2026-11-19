"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronUp, House, LocateFixed, MessageCircle, Phone, PhoneOff, Store, Truck } from "lucide-react";
import type { CustomerTracking } from "@tronic/database";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import { formatDate } from "@/components/account/ui";
import { refreshTrackingAction, shareDeliveryPointAction } from "@/features/account/actions";
import { FRESH_MS, distanceMetres, formatArrival, formatDistance } from "@/features/account/eta";
import { buildTracking, type TrackableOrder } from "@/features/account/tracking";
import { TrackingMap } from "./TrackingMap";

/**
 * Live order tracking (owner brief 2026-11-19): the order's status, the
 * rider and where the rider is now. Everything shown comes from the order's
 * own records (migrations 0012, 0013): status history, the rider's first
 * name and phone (never an email address), the positions the rider's phone
 * reported and the point the customer shared from their own phone. Distance
 * and arrival are estimates from those two points and say so.
 *
 * While the order is on its way the page asks for news every 15 seconds
 * (every minute before that) and only while it is visible; a status change
 * reloads the page's server parts (the delivery code, the summary).
 */

const ON_THE_WAY = new Set(["dispatched", "in_transit"]);
const FINISHED = new Set(["delivered", "cancelled"]);
const FAST_POLL_MS = 15_000;
const SLOW_POLL_MS = 60_000;
/** Phone positions less precise than this are left off the drawn path (they zigzag). */
const PATH_ACCURACY_M = 100;
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

/** wa.me wants the number in international form without "+" or spaces. */
function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

/** "+255712000111" -> "+255 712 000 111" for reading. */
function readablePhone(phone: string): string {
  const match = /^\+255(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return match ? `+255 ${match[1]} ${match[2]} ${match[3]}` : phone;
}

function headline(status: string, pickup: boolean, riderName: string | null): { title: string; text: string; tone: "active" | "done" | "stopped" } {
  if (status === "cancelled") return { title: "Order cancelled", text: "This order was cancelled and will not be delivered.", tone: "stopped" };
  if (status === "delivered")
    return { title: pickup ? "Order collected" : "Order delivered", text: pickup ? "You have collected your order." : "Your order has been delivered. Thank you for shopping with TRONIC.", tone: "done" };
  if (pickup) {
    if (["packed", "dispatched", "in_transit"].includes(status)) return { title: "Ready for pickup", text: "Your order is packed and waiting for you at the store.", tone: "active" };
    return { title: "Preparing your order", text: "We will tell you when it is ready to collect.", tone: "active" };
  }
  const rider = riderName ?? "Your TRONIC rider";
  if (status === "in_transit") return { title: "Out for delivery", text: `${rider} is bringing your order to you.`, tone: "active" };
  if (status === "dispatched") return { title: "On its way", text: `${rider} has your order and is setting off.`, tone: "active" };
  if (status === "pending_payment") return { title: "Order placed", text: "We have received your order.", tone: "active" };
  return { title: "Preparing your order", text: "We are getting your items ready for delivery.", tone: "active" };
}

const TONE_CLASS = {
  active: "bg-[#eceef1] text-[var(--text-primary)]",
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
  /** The delivery address as one line. */
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
  const finished = FINISHED.has(status);
  const tracking = buildTracking({ ...order, status }, live?.events ?? []);
  const rider = onTheWay ? (live?.rider ?? null) : null;
  const raw = (onTheWay ? live?.path : undefined) ?? NO_POINTS;
  const latest = raw.at(-1) ?? null;
  const path = raw.filter((p, index) => index === raw.length - 1 || p.accuracy === null || p.accuracy <= PATH_ACCURACY_M);
  const destination = !pickup && !finished ? (live?.destination ?? null) : null;
  const top = headline(status, pickup, rider?.name ?? null);

  // Ask for news while the page is visible; stop once the order is finished.
  useEffect(() => {
    if (finished || initial === null) return;
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
  }, [status, onTheWay, finished, orderNumber, router, initial]);

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

  const fresh = latest !== null && now !== null && now - new Date(latest.at).getTime() <= FRESH_MS;
  const metres = latest && destination ? distanceMetres(latest, destination) : null;
  const overlay = pickup
    ? "This order is collected at the store, so there is no rider to follow."
    : status === "cancelled"
      ? "This order was cancelled."
      : status === "delivered"
        ? "Your order has been delivered."
        : !onTheWay
          ? destination
            ? null
            : "The live map starts when your order leaves our store."
          : initial === null
            ? "Live location is not available right now."
            : !latest
              ? "Waiting for the rider's location. It appears here as soon as the rider shares it."
              : null;
  const currentStep = tracking.steps.find((step) => step.state === "current");
  const strip = arrivalStrip({ onTheWay, destination: destination !== null, metres, fresh, latestAt: latest?.at ?? null, now });

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* Left column on wide screens; on phones its parts interleave with the map (display: contents + order). */}
      <div className="contents lg:flex lg:flex-col lg:gap-5">
        <section aria-labelledby="tracking-status" aria-live="polite" className={`order-1 rounded-2xl p-4 md:p-5 ${TONE_CLASS[top.tone]}`}>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[var(--text-primary)] shadow-[0_1px_2px_rgba(17,17,17,0.06)]">
              {pickup ? <Store size={22} /> : <Truck size={22} />}
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="tracking-status" className="text-lg font-bold leading-tight md:text-xl">
                {top.title}
              </h2>
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
            {!pickup && !finished ? (
              <ShareLocation orderNumber={orderNumber} shared={destination !== null} onShared={(point) => setLive((value) => (value ? { ...value, destination: point } : value))} />
            ) : null}
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
          <TrackingMap path={path} destination={destination} overlay={overlay}>
            {pickup ? null : (
              <dl className="grid grid-cols-3 divide-x divide-[var(--color-light-grey)] rounded-2xl bg-white/95 py-2 text-center shadow-[0_6px_20px_rgba(17,17,17,0.12)] backdrop-blur">
                {strip.map((cell) => (
                  <div key={cell.label} className="min-w-0 px-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] sm:text-[11px]">{cell.label}</dt>
                    <dd className={`mt-0.5 truncate text-xs font-semibold tabular-nums sm:text-sm ${cell.muted ? "text-[var(--text-secondary)]" : ""}`} title={cell.title}>
                      {cell.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </TrackingMap>
        </section>
        {metres !== null ? (
          <p className="order-4 -mt-2 px-1 text-[11px] text-[var(--text-muted)] lg:-mt-3">
            Distance is in a straight line from the rider to your shared location; arrival is an estimate for city traffic.
          </p>
        ) : null}
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

function arrivalStrip({
  onTheWay,
  destination,
  metres,
  fresh,
  latestAt,
  now,
}: {
  onTheWay: boolean;
  destination: boolean;
  metres: number | null;
  fresh: boolean;
  latestAt: string | null;
  now: number | null;
}): { label: string; value: string; muted: boolean; title?: string }[] {
  const needsPoint = "Share your location below";
  const arrival =
    !onTheWay
      ? { value: "–", muted: true, title: "Shown once the order is on its way" }
      : !destination
        ? { value: "Share location", muted: true, title: needsPoint }
        : metres === null
          ? { value: "Waiting", muted: true, title: "Waiting for the rider's location" }
          : !fresh
            ? { value: "–", muted: true, title: "The rider's last position is too old for an estimate" }
            : { value: formatArrival(metres), muted: false, title: "Estimate for city traffic" };
  const distance =
    !onTheWay
      ? { value: "–", muted: true, title: "Shown once the order is on its way" }
      : !destination
        ? { value: "Share location", muted: true, title: needsPoint }
        : metres === null
          ? { value: "Waiting", muted: true, title: "Waiting for the rider's location" }
          : { value: formatDistance(metres), muted: false, title: "Straight line from the rider to your location" };
  const updated = latestAt && now !== null ? { value: ago(latestAt, now), muted: false } : { value: onTheWay ? "Waiting" : "–", muted: true };
  return [
    { label: "Arrival", ...arrival },
    { label: "Distance", ...distance },
    { label: "Updated", ...updated },
  ];
}

function RiderCard({ rider, onTheWay, status }: { rider: { name: string | null; phone: string | null } | null; onTheWay: boolean; status: string }) {
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
  const name = rider.name ?? "Your TRONIC rider";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-action-red)] text-lg font-bold text-white">
          {rider.name ? rider.name.slice(0, 1).toUpperCase() : <Truck size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{name}</p>
          {rider.phone ? (
            <p className="text-sm tabular-nums text-[var(--text-secondary)]">{readablePhone(rider.phone)}</p>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">Your TRONIC rider</p>
          )}
        </div>
      </div>
      {rider.phone ? (
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`tel:${rider.phone}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-premium-black)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#333]"
            aria-label={`Call ${name}`}
          >
            <Phone size={16} aria-hidden="true" />
            Call
          </a>
          <a
            href={whatsappUrl(rider.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1f9d55] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#17803f]"
            aria-label={`WhatsApp ${name}`}
          >
            <MessageCircle size={16} aria-hidden="true" />
            WhatsApp
          </a>
        </div>
      ) : (
        <p className="inline-flex items-center gap-2 rounded-xl bg-[#f6f6f7] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-muted)]">
          <PhoneOff size={15} aria-hidden="true" />
          The rider&apos;s phone number has not been added yet.
        </p>
      )}
    </div>
  );
}

type ShareState = "idle" | "asking" | "saved" | "denied" | "unsupported" | "failed" | "finished";

/**
 * "Share my location": the customer's phone position becomes where the
 * order should go (migration 0013). Asked only when the customer presses
 * the button; nothing is shared otherwise.
 */
function ShareLocation({
  orderNumber,
  shared,
  onShared,
}: {
  orderNumber: string;
  shared: boolean;
  onShared: (point: { lat: number; lng: number; at: string }) => void;
}) {
  const [state, setState] = useState<ShareState>("idle");
  const [pending, startTransition] = useTransition();

  const share = () => {
    if (!("geolocation" in navigator)) return setState("unsupported");
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        startTransition(async () => {
          const result = await shareDeliveryPointAction({
            orderNumber,
            ...point,
            accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          }).catch(() => "failed" as const);
          if (result === "saved") {
            onShared({ ...point, at: new Date().toISOString() });
            setState("saved");
          } else setState(result === "finished" ? "finished" : "failed");
        });
      },
      (error) => setState(error.code === error.PERMISSION_DENIED ? "denied" : "failed"),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
    );
  };

  const message =
    state === "asking" || pending
      ? "Finding your location…"
      : state === "saved"
        ? "Location shared. The rider can now get directions to you."
        : state === "denied"
          ? "Location is blocked for this site. Allow it in your browser's settings, then try again."
          : state === "unsupported"
            ? "This browser cannot share a location."
            : state === "finished"
              ? "This order is finished; there is nothing to share."
              : state === "failed"
                ? "Your location could not be shared. Try again."
                : shared
                  ? "Your location is shared for this order. Moved? Share it again."
                  : "Share where you are now to see the arrival time and distance, and to help the rider find you.";

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--color-light-grey)] px-3.5 py-3 sm:flex-row sm:items-center">
      <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f1f1f3] text-[var(--text-primary)] sm:grid">
        <House size={17} />
      </span>
      <p role="status" className="min-w-0 flex-1 text-xs text-[var(--text-secondary)]">
        {message}
      </p>
      <button
        type="button"
        onClick={share}
        disabled={state === "asking" || pending}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--color-action-red)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-premium-black)] disabled:opacity-60"
      >
        <LocateFixed size={15} aria-hidden="true" />
        {shared || state === "saved" ? "Update location" : "Share my location"}
      </button>
    </div>
  );
}
