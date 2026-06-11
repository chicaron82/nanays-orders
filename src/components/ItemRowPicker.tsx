import { Check } from 'lucide-react';

const ROW_BTN = 'w-8 h-8 rounded border border-stone-300 text-orange-600 font-bold hover:bg-orange-50 flex items-center justify-center text-sm transition-colors active:scale-95';

interface ItemRowPickerProps {
  label: string;
  /** Pre-formatted price string (parent owns the pricing table). */
  price: string;
  count: number;
  onChange: (n: number) => void;
  /** Optional cooked/frozen toggle — omit (with onCookedChange) for items that don't have it. */
  cooked?: boolean;
  onCookedChange?: (cooked: boolean) => void;
}

/**
 * One selectable menu row: checkbox → quantity stepper → optional cooked/frozen toggle.
 * Shared by every lumpia and pancit size so the markup lives in one place.
 */
export default function ItemRowPicker({ label, price, count, onChange, cooked, onCookedChange }: ItemRowPickerProps) {
  const active = count > 0;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(active ? 0 : 1)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}
      >
        {active && <Check size={11} className="text-white" />}
      </button>
      <div className="flex-1">
        <div className="text-sm font-semibold text-stone-700">{label}</div>
        <div className="text-xs text-stone-400">{price}</div>
      </div>
      {active && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onChange(Math.max(1, count - 1))} className={ROW_BTN}>−</button>
          <span className="font-bold text-sm w-4 text-center">{count}</span>
          <button type="button" onClick={() => onChange(count + 1)} className={ROW_BTN}>+</button>
          {onCookedChange && (
            <button
              type="button"
              onClick={() => onCookedChange(!cooked)}
              className={`ml-1 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${cooked ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-400'}`}
            >
              {cooked ? 'cooked' : 'frozen'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
