import { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Expense } from '../types';
import { fmt, formatDate, localYMD } from '../lib/utils';

interface Props {
  expenses: Expense[];
  onAdd: (expense: Expense) => Promise<void>;
  onDelete: (id: string | number) => void;
}

type PricingType = 'flat' | 'unit' | 'weight';

interface ExpenseForm {
  date: string;
  category: string;
  pricing_type: PricingType;
  amount: string;       // used when pricing_type === 'flat'
  unit_price: string;  // used for unit and weight modes
  quantity: string;    // used for unit mode (price × qty)
  weight: string;      // used for weight mode (price × weight)
  note: string;
}

const STORES = [
  { value: 'Superstore', label: 'Superstore', emoji: '🏪' },
  { value: 'Dollarama',  label: 'Dollarama',  emoji: '💰' },
  { value: 'Lucky',      label: 'Lucky',       emoji: '🍀' },
  { value: 'other',      label: 'Other',       emoji: '🛒' },
];

const CATEGORIES = [
  { value: 'wrappers',   label: 'Wrappers',   emoji: '🧻' },
  { value: 'pork',       label: 'Meats',       emoji: '🥩' },
  { value: 'vegetables', label: 'Vegetables',  emoji: '🥦' },
  { value: 'containers', label: 'Containers',  emoji: '📦' },
  { value: 'bihon',      label: 'Bihon',       emoji: '🍜' },
  { value: 'other',      label: 'Other',       emoji: '🛒' },
];

const EMPTY_FORM: ExpenseForm = {
  date: localYMD(new Date()), category: 'wrappers',
  pricing_type: 'flat', amount: '', unit_price: '', quantity: '', weight: '',
  note: '',
};

export default function ExpenseLog({ expenses, onAdd, onDelete }: Props) {
  const [form, setForm] = useState<ExpenseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | number | null>(null);
  // Trip-level: stays selected across items until manually changed.
  const [tripStore, setTripStore] = useState('');
  const [otherStoreName, setOtherStoreName] = useState('');

  const grouped = useMemo<[string, Expense[]][]>(() => {
    const map: Record<string, Expense[]> = {};
    for (const e of expenses) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [expenses]);

  const computedAmount = (() => {
    if (form.pricing_type === 'unit') {
      const p = parseFloat(form.unit_price), q = parseFloat(form.quantity);
      return isNaN(p) || isNaN(q) ? NaN : p * q;
    }
    if (form.pricing_type === 'weight') {
      const p = parseFloat(form.unit_price), w = parseFloat(form.weight);
      return isNaN(p) || isNaN(w) ? NaN : p * w;
    }
    return parseFloat(form.amount);
  })();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.date || isNaN(computedAmount) || computedAmount <= 0) return;
    const noteBase = form.note.trim();
    const breakdown = form.pricing_type === 'unit'
      ? `$${form.unit_price}/pc × ${form.quantity}`
      : form.pricing_type === 'weight'
      ? `$${form.unit_price}/lb × ${form.weight} lb`
      : '';
    const note = [breakdown, noteBase].filter(Boolean).join(' — ') || undefined;
    const store = tripStore === 'other'
      ? (otherStoreName.trim() || 'Other')
      : tripStore || undefined;
    setSaving(true);
    try {
      await onAdd({ date: form.date, category: form.category, amount: computedAmount, note, store });
      setForm(prev => ({ ...EMPTY_FORM, date: prev.date, category: prev.category, pricing_type: prev.pricing_type }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 space-y-6">
      <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl p-5 shadow-lg">
        <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-4">Log an Expense</div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="expense-date" className="text-xs text-white/70 font-semibold block mb-1">Batch Date</label>
            <input
              id="expense-date"
              name="expense_date"
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
              required
            />
          </div>

          <div>
            <label className="text-xs text-white/70 font-semibold block mb-2">
              Store <span className="font-normal opacity-60">(optional — sticks for the whole trip)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {STORES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setTripStore(tripStore === s.value ? '' : s.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    tripStore === s.value
                      ? 'bg-white text-orange-600 border-white shadow-sm'
                      : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                  }`}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
            {tripStore === 'other' && (
              <input
                type="text"
                placeholder="e.g. Walmart, Costco…"
                value={otherStoreName}
                onChange={e => setOtherStoreName(e.target.value)}
                className="mt-2 w-full bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            )}
          </div>

          <div>
            <label className="text-xs text-white/70 font-semibold block mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    form.category === cat.value
                      ? 'bg-white text-orange-600 border-white shadow-sm'
                      : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="expense-amount" className="text-xs text-white/70 font-semibold block mb-1">Amount</label>
            <div className="flex gap-2 items-stretch">
              <div className="flex gap-1 shrink-0">
                {(['flat', 'unit', 'weight'] as PricingType[]).map(pt => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, pricing_type: pt }))}
                    className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      form.pricing_type === pt
                        ? 'bg-white text-orange-600 border-white'
                        : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                    }`}
                  >
                    {pt === 'flat' ? '$' : pt === 'unit' ? '×qty' : '×lb'}
                  </button>
                ))}
              </div>
              {form.pricing_type === 'flat' ? (
                <input
                  id="expense-amount"
                  name="expense_amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  autoComplete="off"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="flex-1 min-w-0 bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                  required
                />
              ) : (
                <div className="flex gap-2 flex-1 items-center min-w-0">
                  <input
                    id="expense-unit-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={form.pricing_type === 'unit' ? '$/pc' : '$/lb'}
                    autoComplete="off"
                    value={form.unit_price}
                    onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                    className="flex-1 min-w-0 bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                    required
                  />
                  <span className="text-white/60 text-sm shrink-0">×</span>
                  <input
                    id="expense-qty"
                    type="number"
                    min={form.pricing_type === 'unit' ? '1' : '0.01'}
                    step={form.pricing_type === 'unit' ? '1' : '0.01'}
                    placeholder={form.pricing_type === 'unit' ? 'qty' : 'lb'}
                    autoComplete="off"
                    value={form.pricing_type === 'unit' ? form.quantity : form.weight}
                    onChange={e => setForm(f =>
                      form.pricing_type === 'unit'
                        ? { ...f, quantity: e.target.value }
                        : { ...f, weight: e.target.value }
                    )}
                    className="flex-1 min-w-0 bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                    required
                  />
                </div>
              )}
            </div>
            {!isNaN(computedAmount) && computedAmount > 0 && form.pricing_type !== 'flat' && (
              <p className="text-xs text-white/60 mt-1">= {fmt(computedAmount)}</p>
            )}
          </div>

          <div>
            <label htmlFor="expense-note" className="text-xs text-white/70 font-semibold block mb-1">Note <span className="font-normal opacity-60">(optional)</span></label>
            <input
              id="expense-note"
              name="expense_note"
              type="text"
              autoComplete="off"
              placeholder="e.g. 200 wrappers from Seafood City"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>

          <button
            type="submit"
            disabled={saving || isNaN(computedAmount) || computedAmount <= 0}
            className="w-full bg-white text-orange-600 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors disabled:opacity-50"
          >
            <Plus size={16} /> {saving ? 'Saving…' : 'Add Expense'}
          </button>
        </form>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center text-white/50 py-10 text-sm">No expenses logged yet.</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, entries]) => {
            const batchTotal = entries.reduce((s, e) => s + Number(e.amount), 0);
            const cat = (v: string) => CATEGORIES.find(c => c.value === v);
            return (
              <div key={date} className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden shadow">
                <div className="flex items-center justify-between px-4 py-3 bg-white/10 border-b border-white/10">
                  <span className="text-white font-bold text-sm">{formatDate(date)}</span>
                  <span className="text-white/80 text-sm font-semibold">{fmt(batchTotal)}</span>
                </div>
                <div className="divide-y divide-white/10">
                  {entries.map(entry => (
                    <div key={entry.id as string} className="flex items-center justify-between px-4 py-2.5 group">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{cat(entry.category ?? '')?.emoji ?? '🛒'}</span>
                        <div>
                          <div className="text-white text-sm font-medium">{cat(entry.category ?? '')?.label ?? entry.category}</div>
                          {entry.store && <div className="text-white/40 text-[10px]">📍 {entry.store}</div>}
                          {entry.note && <div className="text-white/50 text-xs">{entry.note}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-semibold text-sm">{fmt(Number(entry.amount))}</span>
                        {pendingDeleteId === entry.id ? (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setPendingDeleteId(null)} className="text-xs text-white/60 hover:text-white font-semibold transition-colors cursor-pointer">Cancel</button>
                            <button type="button" onClick={() => { onDelete(entry.id!); setPendingDeleteId(null); }} className="text-xs text-red-300 hover:text-red-200 font-bold transition-colors cursor-pointer">Delete</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-label="Delete expense"
                            onClick={() => setPendingDeleteId(entry.id ?? null)}
                            className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-300 transition-all cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
