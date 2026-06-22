import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/** Read the single app_settings row's accepting_requests flag (no state writes). */
async function readAccepting(): Promise<boolean> {
  const { data } = await supabase
    .from('app_settings')
    .select('accepting_requests')
    .eq('id', 1)
    .single();
  return data?.accepting_requests ?? true;
}

/**
 * Store-wide runtime settings (single row, `app_settings`). The public request
 * page reads `acceptingRequests` (anon); the kitchen flips it (authenticated).
 *
 * The on-load read drives the page's open/closed branch; `refresh()` re-checks at
 * submit time so a form left open when orders get paused can't slip a request
 * through (the authoritative guard, since there's no realtime subscription here).
 */
export function useStoreSettings() {
  const [acceptingRequests, setAcceptingRequests] = useState(true);
  const [loading, setLoading] = useState(true);

  // Fetch on mount via an inline async IIFE so the setState lands after the await
  // (not synchronously in the effect body).
  useEffect(() => {
    let active = true;
    void (async () => {
      const v = await readAccepting();
      if (active) { setAcceptingRequests(v); setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  // Re-check + sync local state — used as the submit-time guard.
  const refresh = useCallback(async (): Promise<boolean> => {
    const v = await readAccepting();
    setAcceptingRequests(v);
    setLoading(false);
    return v;
  }, []);

  const setAccepting = useCallback(async (next: boolean) => {
    setAcceptingRequests(next); // optimistic — the kitchen sees the flip immediately
    await supabase
      .from('app_settings')
      .update({ accepting_requests: next, updated_at: new Date().toISOString() })
      .eq('id', 1);
  }, []);

  return { acceptingRequests, loading, refresh, setAccepting };
}
