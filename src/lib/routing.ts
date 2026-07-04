// Drive-time estimates for delivery orders. Geocodes the destination address and
// routes it from the kitchen base, reusing the same free public providers as the
// roadtrip planner: Nominatim (via Aaron's CORS-open Cloudflare Worker proxy) for
// geocoding, and OSRM (routing.openstreetmap.de) for the drive. OSRM overestimates
// free-flow duration, so we carry the same 0.85 correction factor RP tuned.
//
// Pure URL/format/math helpers are unit-tested; the two async fns are thin fetch
// wrappers that fail soft (return null) so a fuzzy address or a provider hiccup
// degrades to "no estimate" — the Directions link is always the fallback.

/** The kitchen — origin for every delivery drive-time estimate.
 *  629 Sherburn St, Winnipeg (geocoded once via Nominatim). A later pass can move
 *  this into `app_settings` to make it operator-editable. */
export const KITCHEN_BASE = {
  label: '629 Sherburn St',
  lat: 49.8892483,
  lng: -97.1753295,
} as const;

export interface LatLng { lat: number; lng: number; }

const NOMINATIM = 'https://nominatim-proxy.aaronsauddin.workers.dev';
const OSRM = 'https://routing.openstreetmap.de/routed-car';
const OSRM_CORRECTION = 0.85;

/** Nominatim search URL for a free-text address. */
export function geocodeUrl(address: string): string {
  return `${NOMINATIM}/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
}

/** OSRM driving-route URL between two points (OSRM wants lon,lat;lon,lat). */
export function routeUrl(from: LatLng, to: LatLng): string {
  return `${OSRM}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
}

/** Raw OSRM seconds → corrected whole minutes (0.85 factor, floored at 1). */
export function driveMinutes(rawSeconds: number): number {
  return Math.max(1, Math.round((rawSeconds * OSRM_CORRECTION) / 60));
}

/** Estimate → display string; null passes through so the caller shows nothing. */
export function formatDriveEstimate(minutes: number | null): string | null {
  return minutes == null ? null : `~${minutes} min from the kitchen`;
}

/** Geocode a free-text address → coords, or null if it can't be resolved. */
export async function geocode(address: string, signal?: AbortSignal): Promise<LatLng | null> {
  try {
    const res = await fetch(geocodeUrl(address), { signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const hit = data[0] as { lat?: string; lon?: string };
    const lat = parseFloat(hit.lat ?? '');
    const lng = parseFloat(hit.lon ?? '');
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/** Corrected drive minutes from `from` to `to`, or null on any failure. */
export async function driveMinutesBetween(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<number | null> {
  try {
    const res = await fetch(routeUrl(from, to), { signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const sec = (data as { routes?: { duration?: number }[] })?.routes?.[0]?.duration;
    return typeof sec === 'number' ? driveMinutes(sec) : null;
  } catch {
    return null;
  }
}

/** Geocode `address` then route from the kitchen base → drive minutes, or null. */
export async function estimateDriveMinutes(address: string, signal?: AbortSignal): Promise<number | null> {
  const dest = await geocode(address, signal);
  if (!dest) return null;
  return driveMinutesBetween(KITCHEN_BASE, dest, signal);
}
