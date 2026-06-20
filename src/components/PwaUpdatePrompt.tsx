import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 z-[70] flex items-center justify-between gap-3 rounded-xl bg-stone-900 border border-stone-700 px-4 py-3 shadow-2xl">
      <span className="text-sm font-medium text-stone-100">A new version is ready.</span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-900 font-semibold text-sm transition cursor-pointer"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="text-sm font-medium text-stone-400 hover:text-stone-200 cursor-pointer"
        >
          Later
        </button>
      </div>
    </div>
  );
}
