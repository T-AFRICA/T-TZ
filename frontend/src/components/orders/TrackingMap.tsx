"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * The rider's live position on an OpenFreeMap map (owner decision
 * 2026-11-19: free, no key, MapLibre GL). Shows only what the phones
 * reported: the rider's latest point as a lorry marker, the path so far as
 * a red line, and the point the customer shared as a home pin. Without a
 * rider position the map shows the home pin or Tanzania, and says why.
 * MapLibre is loaded only on this page, after it renders.
 */

export interface MapPoint {
  lat: number;
  lng: number;
  at: string;
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const TANZANIA = { center: [34.9, -6.4] as [number, number], zoom: 4.6 };
const CLOSE_ZOOM = 15;
/** Room for the arrival strip at the top, the controls and the phone sheet at the bottom. */
const FRAME_PADDING = { top: 110, bottom: 100, left: 60, right: 70 };
const BRAND_RED = "#d71920";
const SVG = 'viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The rider: a lorry in a red disc with a soft pulse (globals.css). */
function riderElement(): HTMLElement {
  const element = document.createElement("div");
  element.className = "tracking-rider-marker";
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<span class="tracking-rider-pulse"></span><span class="tracking-rider-dot"><svg ${SVG}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></span>`;
  return element;
}

/** The customer's shared point: a house on a dark pin. */
function homeElement(): HTMLElement {
  const element = document.createElement("div");
  element.className = "tracking-home-marker";
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<span class="tracking-home-dot"><svg ${SVG}><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></span>`;
  return element;
}

export function TrackingMap({
  path,
  destination,
  overlay,
  children,
}: {
  /** Oldest first; the last point is where the rider is now. */
  path: readonly MapPoint[];
  /** The point the customer shared; null without one. */
  destination: { lat: number; lng: number } | null;
  /** A short message over the map when there is nothing to follow. */
  overlay: string | null;
  /** Floating content at the top of the map (the arrival strip). */
  children?: React.ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const rider = useRef<Marker | null>(null);
  const home = useRef<Marker | null>(null);
  /** What the map was last framed on, so a new kind of view frames again and updates do not. */
  const framed = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = path.at(-1) ?? null;

  // Create the map once; MapLibre is imported here so it never reaches other pages.
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
        // Later tile errors are left to MapLibre, which retries them.
        instance.on("error", () => {
          if (!cancelled && instance && !instance.isStyleLoaded() && !map.current) setFailed(true);
        });
        instance.on("load", () => {
          if (cancelled || !instance) return;
          instance.addSource("rider-path", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          instance.addLayer({
            id: "rider-path",
            type: "line",
            source: "rider-path",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": BRAND_RED, "line-width": 4, "line-opacity": 0.85 },
          });
          // The compact attribution starts folded to its (i) button; it opens on a tap.
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

  // Draw the path, move the rider, place the home pin; frame both the first time they are known.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    instance.getSource<GeoJSONSource>("rider-path")?.setData({
      type: "FeatureCollection",
      features:
        path.length > 1
          ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: path.map((p) => [p.lng, p.lat]) } }]
          : [],
    });
    let cancelled = false;
    void import("maplibre-gl").then(({ Marker: MarkerClass, LngLatBounds }) => {
      const current = map.current;
      if (cancelled || !current) return;
      if (latest) {
        const at: [number, number] = [latest.lng, latest.lat];
        if (rider.current) rider.current.setLngLat(at);
        else rider.current = new MarkerClass({ element: riderElement() }).setLngLat(at).addTo(current);
      } else {
        rider.current?.remove();
        rider.current = null;
      }
      if (destination) {
        const at: [number, number] = [destination.lng, destination.lat];
        if (home.current) home.current.setLngLat(at);
        else home.current = new MarkerClass({ element: homeElement(), anchor: "bottom" }).setLngLat(at).addTo(current);
      } else {
        home.current?.remove();
        home.current = null;
      }

      const both = latest && destination;
      const want = both ? "both" : latest ? "rider" : destination ? "home" : "none";
      if (framed.current !== want) {
        if (both) {
          const bounds = new LngLatBounds([latest.lng, latest.lat], [latest.lng, latest.lat]).extend([destination.lng, destination.lat]);
          current.fitBounds(bounds, { padding: FRAME_PADDING, maxZoom: 16, duration: reducedMotion() ? 0 : 600 });
        } else if (latest || destination) {
          const p = (latest ?? destination)!;
          current.jumpTo({ center: [p.lng, p.lat], zoom: CLOSE_ZOOM });
        } else {
          current.jumpTo(TANZANIA);
        }
        framed.current = want;
      } else if (latest && !both) {
        // Follow the rider when only the rider is shown.
        if (reducedMotion()) current.jumpTo({ center: [latest.lng, latest.lat] });
        else current.easeTo({ center: [latest.lng, latest.lat], duration: 800 });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, path, latest, destination]);

  const recenter = () => {
    const current = map.current;
    if (!current || !latest) return;
    void import("maplibre-gl").then(({ LngLatBounds }) => {
      if (destination) {
        const bounds = new LngLatBounds([latest.lng, latest.lat], [latest.lng, latest.lat]).extend([destination.lng, destination.lat]);
        current.fitBounds(bounds, { padding: FRAME_PADDING, maxZoom: 16, duration: reducedMotion() ? 0 : 600 });
      } else {
        const target = { center: [latest.lng, latest.lat] as [number, number], zoom: CLOSE_ZOOM };
        if (reducedMotion()) current.jumpTo(target);
        else current.easeTo({ ...target, duration: 600 });
      }
    });
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#eef0f2]">
      {/* MapLibre makes its container position: relative, so the container fills a positioned wrapper. */}
      <div className="absolute inset-0">
        <div
          ref={container}
          className="h-full w-full"
          role="region"
          aria-label={latest ? "Map with the rider's current location" : destination ? "Map with your delivery location" : "Map of Tanzania"}
        />
      </div>
      {children ? <div className="pointer-events-none absolute inset-x-3 top-3 z-10">{children}</div> : null}
      {failed ? (
        <p role="status" className="absolute inset-0 z-10 grid place-items-center px-6 text-center text-sm text-[var(--text-secondary)]">
          The map could not be loaded right now. Your order&apos;s progress is shown on this page.
        </p>
      ) : overlay ? (
        <p
          role="status"
          className="absolute left-1/2 top-1/2 z-10 w-[min(20rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/95 px-4 py-3 text-center text-sm font-medium shadow-[0_8px_24px_rgba(17,17,17,0.12)]"
        >
          {overlay}
        </p>
      ) : null}
      {latest && ready ? (
        <button
          type="button"
          onClick={recenter}
          className="tracking-recenter absolute bottom-[5.25rem] right-2.5 z-10 grid h-[29px] w-[29px] place-items-center rounded-[4px] bg-white text-[var(--text-primary)] shadow-[0_0_0_2px_rgba(0,0,0,0.1)] hover:bg-[#f2f2f2] focus-visible:outline-2 focus-visible:outline-[var(--color-action-red)]"
          aria-label={destination ? "Show the rider and your location" : "Centre the map on the rider"}
          title={destination ? "Show the rider and your location" : "Centre on the rider"}
        >
          <LocateFixed size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
