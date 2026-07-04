import { useEffect, useState } from 'react';
import { estimateDriveMinutes } from '../lib/routing';

export interface DriveEstimate {
  loading: boolean;
  minutes: number | null;
  failed: boolean;
}

const IDLE: DriveEstimate = { loading: false, minutes: null, failed: false };

/** One-shot drive-time estimate from the kitchen base to a delivery address.
 *  Pass null/empty (e.g. pickup orders, or a closed modal) to stay idle. Aborts
 *  on unmount or address change so a slow response can't overwrite a newer one.
 *
 *  Loading/idle/failed are DERIVED during render (the resolved result carries the
 *  query it answered), so the effect only sets state inside its async callback —
 *  no synchronous setState-in-effect, and no stale-state flash between addresses. */
export function useDriveEstimate(address: string | null | undefined): DriveEstimate {
  const query = address?.trim() ?? '';
  const [result, setResult] = useState<{ query: string; minutes: number | null } | null>(null);

  useEffect(() => {
    if (!query) return;
    const ctrl = new AbortController();
    estimateDriveMinutes(query, ctrl.signal)
      .then(minutes => { if (!ctrl.signal.aborted) setResult({ query, minutes }); })
      .catch(() => { if (!ctrl.signal.aborted) setResult({ query, minutes: null }); });
    return () => ctrl.abort();
  }, [query]);

  if (!query) return IDLE;
  if (result?.query === query) {
    return { loading: false, minutes: result.minutes, failed: result.minutes == null };
  }
  return { loading: true, minutes: null, failed: false };
}
