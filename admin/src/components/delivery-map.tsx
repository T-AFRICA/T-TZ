"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocationSharing, type SharedPosition } from "@/components/location-sharing";
import { distanceMetres, formatDistance, type LatLng } from "@/features/deliveries/distance";

/**
 * The rider's map for one delivery (owner request 2026-11-19): where the
 * rider is now (a lorry, from this phone) and the point the customer shared
 * (a home pin), on an OpenFreeMap map (free, no key, MapLibre GL, as on the
 * customer's tracking page). Only map tiles are fetched from OpenFreeMap; no
 * address or position is sent to it. Without either point the map shows
 * Tanzania and says why. MapLibre is loaded only on this page.
 */

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const TANZANIA = { center: [34.9, -6.4] as [number, number], zoom: 4.6 };
const CLOSE_ZOOM = 15;
const FRAME_PADDING = { top: 60, bottom: 60, left: 60, right: 60 };
const SVG = 'viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function riderElement(): HTMLElement {
  const element = document.createElement("div");
  element.className = "rider-map-me";
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<span class="rider-map-me-pulse"></span><span class="rider-map-me-dot"><svg ${SVG}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></span>`;
  return element;
}

function homeElement(): HTMLElement {
  const element = document.createElement("div");
  element.className = "rider-map-home";
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<span class="rider-map-home-dot"><svg ${SVG}><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></span>`;
  return element;
}

function RiderMap({ me, destination }: { me: LatLng | null; destination: LatLng | null }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const rider = useRef<Marker | null>(null);
  const home = useRef<Marker | null>(null);
  const framed = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    void import("maplibre-gl")
      .then(({ Map, NavigationControl, AttributionControl }) => {
        if (cancelled || !container.current) return;
        instance = new Map({
          container: container.current,
          style: STYLE_URL,
          center: TANZANIA.center,
          zoom: TANZANIA.zoom,
          attributionControl: false,
          cooperativeGestures: true,
          fadeDuration: reducedMotion() ? 0 : 300,
        });
        instance.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
        instance.addControl(new AttributionControl({ compact: true }), "bottom-left");
        // The style could not be fetched (offline, blocked): say so instead of an empty grey box.
        instance.on("error", () => {
          if (!cancelled && instance && !instance.isStyleLoaded() && !map.current) setFailed(true);
        });
        instance.on("load", () => {
          if (cancelled || !instance) return;
          container.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
          map.current = instance;
          setReady(true);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      rider.current?.remove();
      home.current?.remove();
      rider.current = null;
      home.current = null;
      instance?.remove();
      map.current = null;
    };
  }, []);

  const frame = useCallback((force: boolean) => {
    const current = map.current;
    if (!current) return;
    void import("maplibre-gl").then(({ LngLatBounds }) => {
      const want = me && destination ? "both" : me ? "me" : destination ? "home" : "none";
      if (!force && framed.current === want) {
        // Same view as before: follow the rider when only the rider is shown.
        if (want === "me" && me) {
          if (reducedMotion()) current.jumpTo({ center: [me.lng, me.lat] });
          else current.easeTo({ center: [me.lng, me.lat], duration: 800 });
        }
        return;
      }
      framed.current = want;
      if (me && destination) {
        const bounds = new LngLatBounds([me.lng, me.lat], [me.lng, me.lat]).extend([destination.lng, destination.lat]);
        current.fitBounds(bounds, { padding: FRAME_PADDING, maxZoom: 16, duration: reducedMotion() ? 0 : 600 });
      } else if (me || destination) {
        const p = (me ?? destination)!;
        current.jumpTo({ center: [p.lng, p.lat], zoom: CLOSE_ZOOM });
      } else {
        current.jumpTo(TANZANIA);
      }
    });
  }, [me, destination]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    let cancelled = false;
    void import("maplibre-gl").then(({ Marker: MarkerClass }) => {
      const current = map.current;
      if (cancelled || !current) return;
      if (me) {
        if (rider.current) rider.current.setLngLat([me.lng, me.lat]);
        else rider.current = new MarkerClass({ element: riderElement() }).setLngLat([me.lng, me.lat]).addTo(current);
      } else {
        rider.current?.remove();
        rider.current = null;
      }
      if (destination) {
        if (home.current) home.current.setLngLat([destination.lng, destination.lat]);
        else home.current = new MarkerClass({ element: homeElement(), anchor: "bottom" }).setLngLat([destination.lng, destination.lat]).addTo(current);
      } else {
        home.current?.remove();
        home.current = null;
      }
      frame(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, me, destination, frame]);

  const overlay = me || destination ? null : "Your location and the customer's pin will show here.";
  return (
    <div className="relative h-64 w-full overflow-hidden rounded-lg border border-line bg-[#eef0f2] sm:h-80">
      {/* MapLibre makes its container position: relative, so the container fills a positioned wrapper. */}
      <div className="absolute inset-0">
        <div
          ref={container}
          className="h-full w-full"
          role="region"
          aria-label={me && destination ? "Map with your location and the customer's pin" : me ? "Map with your location" : destination ? "Map with the customer's pin" : "Map of Tanzania"}
        />
      </div>
      {failed ? (
        <p role="status" className="absolute inset-0 z-10 grid place-items-center bg-raised px-6 text-center text-sm text-muted">
          The map could not be loaded right now. Use the address and the buttons below.
        </p>
      ) : overlay ? (
        <p role="status" className="absolute left-1/2 top-1/2 z-10 w-[min(18rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white/95 px-4 py-3 text-center text-sm font-medium text-[#111] shadow-lg">
          {overlay}
        </p>
      ) : null}
      {ready && (me || destination) ? (
        <button
          type="button"
          onClick={() => frame(true)}
          className="absolute bottom-[5.25rem] right-2.5 z-10 grid h-[29px] w-[29px] place-items-center rounded-[4px] bg-white text-[#111] shadow-[0_0_0_2px_rgba(0,0,0,0.1)] hover:bg-[#f2f2f2]"
          aria-label={me && destination ? "Show you and the customer's pin" : "Centre the map"}
          title={me && destination ? "Show you and the customer's pin" : "Centre the map"}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="2" x2="5" y1="12" y2="12" />
            <line x1="19" x2="22" y1="12" y2="12" />
            <line x1="12" x2="12" y1="2" y2="5" />
            <line x1="12" x2="12" y1="19" y2="22" />
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/**
 * The map with, while the order is on its way, the location sharing that
 * feeds it: the position this phone sends to the customer is the one the
 * rider sees as the lorry.
 */
export function DeliveryMap({
  countryId,
  orderNumber,
  sharing,
  destination,
}: {
  countryId: string;
  orderNumber: string;
  /** True while the order is dispatched or in transit. */
  sharing: boolean;
  destination: LatLng | null;
}) {
  const [me, setMe] = useState<LatLng | null>(null);
  const onPosition = useCallback((position: SharedPosition) => {
    setMe((current) => (current && current.lat === position.lat && current.lng === position.lng ? current : { lat: position.lat, lng: position.lng }));
  }, []);
  const distance = me && destination ? formatDistance(distanceMetres(me, destination)) : null;
  return (
    <div className="flex flex-col gap-3">
      {sharing ? <LocationSharing countryId={countryId} orderNumber={orderNumber} onPosition={onPosition} /> : null}
      <RiderMap me={sharing ? me : null} destination={destination} />
      {distance ? (
        <p className="text-sm font-medium text-ink" data-testid="rider-distance">
          About {distance} from you to the customer&apos;s pin, in a straight line.
        </p>
      ) : null}
    </div>
  );
}
