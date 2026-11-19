"use client";

import { useEffect, useRef, useState } from "react";
import { riderLocationAction } from "@/features/deliveries/actions";

/**
 * While an order is on its way, the rider's phone shares where it is: the
 * browser asks the rider once, then a position goes to the country every
 * 15 seconds at most (the country keeps one per 10 seconds). It runs only
 * while this page is open; a phone that locks its screen stops it, and the
 * customer sees how old the last position is.
 */
const EVERY_MS = 15_000;

type State =
  | { kind: "asking" }
  | { kind: "sharing"; sentAt: Date | null }
  | { kind: "denied" }
  | { kind: "unsupported" }
  | { kind: "error"; message: string };

export interface SharedPosition {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export function LocationSharing({
  countryId,
  orderNumber,
  onPosition,
}: {
  countryId: string;
  orderNumber: string;
  /** Every position the phone reports, also those not sent (the rider's own map). */
  onPosition?: (position: SharedPosition) => void;
}) {
  const [state, setState] = useState<State>({ kind: "asking" });
  const lastSent = useRef(0);
  const sending = useRef(false);
  const listener = useRef(onPosition);
  useEffect(() => {
    listener.current = onPosition;
  }, [onPosition]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState({ kind: "unsupported" });
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        setState((current) => (current.kind === "sharing" ? current : { kind: "sharing", sentAt: null }));
        listener.current?.({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
        const now = Date.now();
        if (sending.current || now - lastSent.current < EVERY_MS) return;
        sending.current = true;
        lastSent.current = now;
        void riderLocationAction({
          countryId,
          orderNumber,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        })
          .then((result) => {
            if (result === "saved" || result === "skipped") setState({ kind: "sharing", sentAt: new Date() });
            else if (result === "unavailable") setState({ kind: "error", message: "The country service did not answer; trying again shortly." });
            else if (result === "missing") setState({ kind: "error", message: "Live tracking is not turned on for this country yet, so the customer cannot see your location." });
            else setState({ kind: "error", message: "This order is no longer on its way; nothing more is shared." });
          })
          .catch(() => setState({ kind: "error", message: "No connection; trying again shortly." }))
          .finally(() => {
            sending.current = false;
          });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setState({ kind: "denied" });
        else setState({ kind: "error", message: "Your phone could not find its position; trying again." });
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [countryId, orderNumber]);

  const tone =
    state.kind === "sharing" ? "border-ok/40 bg-ok-soft text-ok" : state.kind === "asking" ? "border-line bg-raised text-muted" : "border-warn/40 bg-warn-soft text-warn";
  return (
    <p role="status" className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${tone}`}>
      <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${state.kind === "sharing" ? "animate-pulse bg-ok" : "bg-current"}`} />
      <span>
        {state.kind === "asking"
          ? "Allow location on your phone so the customer can follow the delivery."
          : state.kind === "sharing"
            ? `Sharing your location with the customer${state.sentAt ? `, last sent ${state.sentAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}. Keep this page open.`
            : state.kind === "denied"
              ? "Location is blocked for this site. Allow it in your browser's settings so the customer can follow the delivery."
              : state.kind === "unsupported"
                ? "This browser cannot share a location."
                : state.message}
      </span>
    </p>
  );
}
