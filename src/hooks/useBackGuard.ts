import { useEffect, useRef } from 'react';

export interface BackGuard {
  isActive: boolean;
  onBack: () => void;
}

// Intercepts the browser back button when modals are open.
// Pass an array of { isActive, onBack } in priority order — first truthy wins.
// On mount, pushes a base history entry so there's always one to pop before
// the app exits. When popstate fires with a modal active, re-pushes to cancel
// the navigation, then calls onBack for the first active entry.
export function useBackGuard(guards: BackGuard[]) {
  const guardsRef = useRef(guards);

  useEffect(() => {
    guardsRef.current = guards;
  });

  useEffect(() => {
    history.pushState({ nanays: 'base' }, '');

    const handler = () => {
      for (const { isActive, onBack } of guardsRef.current) {
        if (isActive) {
          history.pushState({ nanays: 'base' }, '');
          onBack();
          return;
        }
      }
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
}
