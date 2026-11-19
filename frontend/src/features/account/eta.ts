/**
 * Distance and arrival time on the tracking page, from two points only: the
 * rider's latest position and the point the customer shared. There is no
 * road routing (no outside service), so both are estimates and the page
 * says so: the distance is the straight line, and the time assumes roads
 * are about 1.4 times longer than that at an average city speed.
 */

const EARTH_RADIUS_M = 6_371_000;
/** Roads are longer than the straight line; 1.4 is a common urban detour factor. */
export const ROAD_FACTOR = 1.4;
/** Average motorbike/van speed in Dar es Salaam traffic, km/h. */
export const CITY_SPEED_KMH = 20;
/** A rider position older than this does not give an arrival time. */
export const FRESH_MS = 5 * 60_000;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in metres. */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "850 m", "2.4 km", "15 km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Minutes to arrive, at least 1. */
export function arrivalMinutes(metres: number): number {
  const hours = ((metres * ROAD_FACTOR) / 1000) / CITY_SPEED_KMH;
  return Math.max(1, Math.ceil(hours * 60));
}

/** "about 9 min", "about 1 h 20 min", or "Arriving now" within 100 m. */
export function formatArrival(metres: number): string {
  if (metres <= 100) return "Arriving now";
  const minutes = arrivalMinutes(metres);
  if (minutes < 60) return `about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `about ${hours} h${rest ? ` ${rest} min` : ""}`;
}
