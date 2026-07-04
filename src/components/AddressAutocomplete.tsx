import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { searchAddresses, shortAddress, type AddressHit } from '../lib/routing';

interface Props {
  id?: string;
  value: string;
  /** Fired on every keystroke — the parent clears any stored coords (text changed). */
  onChange: (text: string) => void;
  /** Fired when a candidate is picked — the parent stores the clean text + coords. */
  onPick: (address: string, lat: number, lng: number) => void;
  /** True when the current address has coords pinned (shows the ✓). */
  pinned?: boolean;
  placeholder?: string;
  className?: string;
}

const INPUT_CLASS =
  'w-full border-2 border-stone-200 rounded-xl px-4 py-2.5 focus-visible:border-orange-500 ' +
  'focus-visible:ring-2 focus-visible:ring-orange-400/20 outline-none transition-colors';

/** Delivery-address input with Nominatim autocomplete. Free-typing is always
 *  allowed (falls back to on-the-fly geocoding); picking a candidate pins its
 *  coords so the drive-time estimate is exact. Winnipeg-local, CORS-open proxy. */
export function AddressAutocomplete({ id, value, onChange, onPick, pinned, placeholder, className }: Props) {
  const [results, setResults] = useState<AddressHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  // Debounced search keyed on the controlled value. All setState lands inside the
  // async timeout (never synchronously in the effect body) so it satisfies the
  // react-hooks/set-state-in-effect rule without a suppression.
  useEffect(() => {
    const q = value.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (q.length < 3) { setResults([]); return; }
      const hits = await searchAddresses(q, ctrl.signal);
      if (!ctrl.signal.aborted) { setResults(hits); setActive(-1); }
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value]);

  const choose = (hit: AddressHit) => {
    onPick(shortAddress(hit.label), hit.lat, hit.lng);
    setOpen(false);
    setResults([]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const showList = open && results.length > 0;

  return (
    <div ref={wrap} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <input
          id={id}
          name="address"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          className={INPUT_CLASS + (pinned ? ' pr-9' : '')}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
        {pinned && (
          <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" aria-label="location pinned" />
        )}
      </div>

      {showList && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-xl border-2 border-stone-200 bg-white shadow-lg">
          {results.map((hit, i) => (
            <li key={`${hit.lat},${hit.lng},${i}`}>
              <button
                type="button"
                // onMouseDown (not onClick) so it fires before the input's blur closes the list.
                onMouseDown={e => { e.preventDefault(); choose(hit); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${i === active ? 'bg-orange-50 text-orange-700' : 'text-stone-700 hover:bg-stone-50'}`}
              >
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
