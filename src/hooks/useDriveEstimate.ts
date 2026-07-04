import { useEffect, useState } from 'react';
import { KITCHEN_BASE, driveMinutesBetween, estimateDriveMinutes } from '../lib/routing';

export interface DriveEstimate {
  loading: boolean;
  minutes: number | null;
  failed: boolean;
}

const IDLE: DriveEstimate = { loading: false, minutes: null, failed: false };

/** One-shot drive-time estimate from the kitchen base to a delivery.
 *  Prefers stored coords (exact, no geocode) when present; otherwise geocodes the
 *  free-text address on the fly. Pass null/empty address + no coords to stay idle.
 *  Aborts on unmount or input change so a slow reply can't overwrite a newer one.
 *
 *  Loading/idle/failed are DERIVED during render (the resolved result carries the
 *  key it answered), so the effect only sets state inside its async callback. */
export function useDriveEstimate(
  address: string | null | undefined,
  lat?: number | null,
  lng?: number | null,
): DriveEstimate {
  const hasCoords = typeof lat === 'number' && typeof lng === 'number';
  const query = address?.trim() ?? '';
  const key = hasCoords ? `${lat},${lng}` : query;

  const [result, setResult] = useState<{ key: string; minutes: number | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    const pending = hasCoords
      ? driveMinutesBetween(KITCHEN_BASE, { lat: lat as number, lng: lng as number }, ctrl.signal)
      : estimateDriveMinutes(query, ctrl.signal);
    pending
      .then(minutes => { if (!ctrl.signal.aborted) setResult({ key, minutes }); })
      .catch(() => { if (!ctrl.signal.aborted) setResult({ key, minutes: null }); });
    return () => ctrl.abort();
  }, [key, hasCoords, lat, lng, query]);

  if (!key) return IDLE;
  if (result?.key === key) {
    return { loading: false, minutes: result.minutes, failed: result.minutes == null };
  }
  return { loading: true, minutes: null, failed: false };
}
