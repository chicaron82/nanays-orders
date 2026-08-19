import { formatTime12 } from './utils';
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

/** Base prep/park/hand-off cushion added on top of the drive when computing leave-by. */
export const LEAVE_BUFFER_MIN = 15;

/** Heavier cushion for weekday rush-hour pickups — covers the congestion the
 *  free-flow OSRM estimate is blind to. */
export const RUSH_BUFFER_MIN = 30;

/** "Leave by" clock time so a delivery arrives on time: pickup − drive − buffer.
 *  `pickupTime` is the order form's 24h "HH:MM" (<input type=time>). Returns a 12h
 *  display like "12:49 PM", or null if the time can't be parsed or the math would
 *  underflow the day (drive + buffer earlier than midnight — not a real delivery). */
export function leaveByTime(
  pickupTime: string | null | undefined,
  driveMinutes: number,
  bufferMin: number = LEAVE_BUFFER_MIN,
): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((pickupTime ?? '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2]);
  if (h > 23 || min > 59) return null;

  const total = h * 60 + min - driveMinutes - bufferMin;
  if (total < 0) return null;

  const hh = Math.floor(total / 60);
  const mm = total % 60;
  // Shares the one 12-hour formatter with every display site (2026-08-18) — this file had its own
  // copy, and two conversions of the same rule are two chances to drift on the midnight/noon edge.
  return formatTime12(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
}

/** Winnipeg weekday rush windows (local time): 7:00–9:00 AM and 3:30–6:00 PM. */
function inRushWindow(minutesOfDay: number): boolean {
  return (minutesOfDay >= 7 * 60 && minutesOfDay < 9 * 60)
      || (minutesOfDay >= 15 * 60 + 30 && minutesOfDay < 18 * 60);
}

/** Delivery buffer: RUSH_BUFFER_MIN when the pickup lands in a weekday rush window
 *  (congestion the free-flow estimate can't see), else LEAVE_BUFFER_MIN. Weekend
 *  pickups never count as rush — a Sunday 5 PM drop shouldn't be over-padded.
 *  `neededDate` is "YYYY-MM-DD" (parsed as LOCAL so the weekday is right, not a
 *  UTC-shifted day), `pickupTime` is 24h "HH:MM"; anything unparseable → base. */
export function deliveryBuffer(
  neededDate: string | null | undefined,
  pickupTime: string | null | undefined,
): number {
  const t = /^(\d{1,2}):(\d{2})$/.exec((pickupTime ?? '').trim());
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec((neededDate ?? '').trim());
  if (!t || !d) return LEAVE_BUFFER_MIN;

  const minutesOfDay = Number(t[1]) * 60 + Number(t[2]);
  const dow = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3])).getDay(); // 0=Sun … 6=Sat
  const isWeekday = dow >= 1 && dow <= 5;

  return isWeekday && inRushWindow(minutesOfDay) ? RUSH_BUFFER_MIN : LEAVE_BUFFER_MIN;
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

// ── Address autocomplete ────────────────────────────────────────────────────

export interface AddressHit { label: string; lat: number; lng: number; }

/** Nominatim search URL returning up to `limit` candidates (for autocomplete). */
export function searchUrl(query: string, limit = 5): string {
  return `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}`;
}

/** Trim Nominatim's verbose display_name to a readable "street, city".
 *  "629, Sherburn Street, Minto, …, Winnipeg, Manitoba, R3E 0C7, Canada"
 *  → "629 Sherburn Street, Winnipeg". Falls back to the first component. */
export function shortAddress(display: string): string {
  const parts = display.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return display.trim();
  let street = parts[0];
  if (/^\d+$/.test(street) && parts[1]) street = `${parts[0]} ${parts[1]}`;
  const city = parts.find(p => /winnipeg/i.test(p));
  return city && !new RegExp(city, 'i').test(street) ? `${street}, ${city}` : street;
}

/** Autocomplete search: free-text → up to 5 address candidates with coords.
 *  Returns [] for short queries or any failure (the field stays free-text). */
export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await fetch(searchUrl(q), { signal });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map(d => d as { display_name?: string; lat?: string; lon?: string })
      .map(d => ({ label: d.display_name ?? '', lat: parseFloat(d.lat ?? ''), lng: parseFloat(d.lon ?? '') }))
      .filter(h => h.label && Number.isFinite(h.lat) && Number.isFinite(h.lng));
  } catch {
    return [];
  }
}
