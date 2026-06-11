declare const __BUILD_DATE__: string;
declare const __BUILD_SHA__: string;

/**
 * Subtle always-visible build stamp: build date + short commit SHA, injected
 * at build time via vite `define`. Tells you at a glance which deploy you're on.
 * `tone="light"` for dark/coloured backgrounds; default reads on light ones.
 */
export default function BuildStamp({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const color = tone === 'light' ? 'text-white/40' : 'text-stone-400';
  return (
    <div className={`text-center py-4 text-[10px] ${color} select-none tracking-[0.2em] font-mono`}>
      {__BUILD_DATE__} · {__BUILD_SHA__}
    </div>
  );
}
