import type { LumpiaOrder } from '../types';
import { fmt, LUMPIA_PRICE, LUMPIA_HALF_PRICE, lumpiaSplit, lumpiaFromCounts, type LumpiaSplit } from '../lib/utils';

const STEP_BTN = 'w-8 h-8 rounded border border-stone-300 text-orange-600 font-bold hover:bg-orange-50 flex items-center justify-center text-sm transition-colors active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent';

interface LumpiaCountsPickerProps {
  lumpia: LumpiaOrder;
  onChange: (next: LumpiaOrder) => void;
  fullLabel: string;
  halfLabel: string;
  /** What this audience calls uncooked: "Uncooked" in the kitchen, "Frozen" on the public page. */
  uncookedLabel: string;
}

/**
 * Lumpia sizes, each with a COOKED count and an UNCOOKED count.
 *
 * Aaron, 2026-10-04, choosing this layout from a mock: *"i lean option A. its has it all laid out. less confusion
 * and i think it would work well for the public request link too"*. It replaced one cooked switch per size,
 * which could not express 50 cooked + 50 uncooked in one order. Shared by the order form and the public
 * request page so the two can't drift. Reads and writes through lumpiaSplit / lumpiaFromCounts only.
 */
export default function LumpiaCountsPicker({ lumpia, onChange, fullLabel, halfLabel, uncookedLabel }: LumpiaCountsPickerProps) {
  const split = lumpiaSplit(lumpia);
  const set = (key: keyof LumpiaSplit, n: number) => onChange(lumpiaFromCounts(lumpia, { ...split, [key]: Math.max(0, n) }));

  const sizes = [
    { label: fullLabel, prices: LUMPIA_PRICE, cooked: 'setsCooked', uncooked: 'setsUncooked', noun: 'full batches' },
    { label: halfLabel, prices: LUMPIA_HALF_PRICE, cooked: 'halvesCooked', uncooked: 'halvesUncooked', noun: 'half batches' },
  ] as const;

  return (
    <div className="space-y-3">
      {sizes.map((size, i) => (
        <div key={size.label} className={`space-y-1.5 ${i > 0 ? 'pt-3 border-t border-stone-100' : ''}`}>
          <div className="text-sm font-semibold text-stone-700">{size.label}</div>
          {([
            { key: size.cooked, style: 'Cooked', price: size.prices.cooked, tone: 'text-amber-700' },
            { key: size.uncooked, style: uncookedLabel, price: size.prices.uncooked, tone: 'text-stone-600' },
          ] as const).map(row => {
            const count = split[row.key];
            return (
              <div key={row.key} className={`flex items-center gap-2 pl-1 transition-opacity ${count === 0 ? 'opacity-60' : ''}`}>
                <div className="flex-1 text-xs">
                  <span className={`font-semibold ${row.tone}`}>{row.style}</span>
                  <span className="text-stone-400 ml-1.5">{fmt(row.price)}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Fewer ${row.style.toLowerCase()} ${size.noun}`}
                  disabled={count === 0}
                  onClick={() => set(row.key, count - 1)}
                  className={STEP_BTN}
                >−</button>
                <span className="font-bold text-sm w-4 text-center" aria-label={`${row.style} ${size.noun}`}>{count}</span>
                <button
                  type="button"
                  aria-label={`More ${row.style.toLowerCase()} ${size.noun}`}
                  onClick={() => set(row.key, count + 1)}
                  className={STEP_BTN}
                >+</button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
