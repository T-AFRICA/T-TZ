"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * The rider's live position on an OpenFreeMap map (owner decision
 * 2026-11-19: free, no key, MapLibre GL). Shows only what the rider's phone
 * reported: the latest point as the rider marker and the path so far as a
 * red line. There are no store or address coordinates yet, so there is no
 * destination pin and no route; without a position the map shows Tanzania
 * and says why. MapLibre is loaded only on this page, after it renders.
 */

export interface MapPoint {
  lat: number;
  lng: number;
  at: string;
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const TANZANIA = { center: [34.9, -6.4] as [number, number], zoom: 4.6 };
const RIDER_ZOOM = 15;
const BRAND_RED = "#d71920";

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function riderElement(): HTMLElement {
  const element = document.createElement("div");
  element.className = "tracking-rider-marker";
  element.setAttribute("aria-hidden", "true");
  element.innerHTML =
    '<span class="tracking-rider-pulse"></span><span class="tracking-rider-dot"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg></span>';
  return element;
}

export function TrackingMap({
  path,
  overlay,
  children,
}: {
  /** Oldest first; the last point is where the rider is now. */
  path: readonly MapPoint[];
  /** A short message over the map when there is no position to show. */
  overlay: string | null;
  /** Floating content at the top of the map (the arrival strip). */
  children?: React.ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
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
          map.current = instance;
          setReady(true);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      marker.current?.remove();
      marker.current = null;
      instance?.remove();
      map.current = null;
    };
  }, []);

  // Draw the path and move the rider whenever a new position arrives.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const source = instance.getSource<GeoJSONSource>("rider-path");
    source?.setData({
      type: "FeatureCollection",
      features:
        path.length > 1
          ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: path.map((p) => [p.lng, p.lat]) } }]
          : [],
    });
    if (!latest) {
      marker.current?.remove();
      marker.current = null;
      instance.jumpTo(TANZANIA);
      return;
    }
    const position: [number, number] = [latest.lng, latest.lat];
    void import("maplibre-gl").then(({ Marker: MarkerClass }) => {
      if (!map.current) return;
      if (!marker.current) {
        marker.current = new MarkerClass({ element: riderElement() }).setLngLat(position).addTo(map.current);
        map.current.jumpTo({ center: position, zoom: RIDER_ZOOM });
      } else {
        marker.current.setLngLat(position);
        if (reducedMotion()) map.current.jumpTo({ center: position });
        else map.current.easeTo({ center: position, duration: 800 });
      }
    });
  }, [ready, path, latest]);

  const recenter = () => {
    if (!map.current || !latest) return;
    const target = { center: [latest.lng, latest.lat] as [number, number], zoom: RIDER_ZOOM };
    if (reducedMotion()) map.current.jumpTo(target);
    else map.current.easeTo({ ...target, duration: 600 });
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#eef0f2]">
      {/* MapLibre makes its container position: relative, so the container fills a positioned wrapper. */}
      <div className="absolute inset-0">
        <div
          ref={container}
          className="h-full w-full"
          role="region"
          aria-label={latest ? "Map with the rider's current location" : "Map of Tanzania"}
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
          aria-label="Centre the map on the rider"
          title="Centre on the rider"
        >
          <LocateFixed size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
