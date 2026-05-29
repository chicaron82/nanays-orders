import { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { fmt, formatDate, localYMD } from '../lib/utils';

const CATEGORIES = [
  { value: 'wrappers',   label: 'Wrappers',   emoji: '🧻' },
  { value: 'pork',       label: 'Pork',        emoji: '🥩' },
  { value: 'vegetables', label: 'Vegetables',  emoji: '🥦' },
  { value: 'containers', label: 'Containers',  emoji: '📦' },
  { value: 'bihon',      label: 'Bihon',       emoji: '🍜' },
  { value: 'other',      label: 'Other',       emoji: '🛒' },
];

const EMPTY_FORM = { date: localYMD(new Date()), category: 'wrappers', amount: '', note: '' };

export default function ExpenseLog({ expenses, onAdd, onDelete }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const grouped = useMemo(() => {
    const map = {};
    for (const e of expenses) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [expenses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.date || isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await onAdd({ date: form.date, category: form.category, amount, note: form.note.trim() || null });
      setForm(prev => ({ ...EMPTY_FORM, date: prev.date, category: prev.category }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 space-y-6">
      {/* Add expense form */}
      <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl p-5 shadow-lg">
        <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-4">Log an Expense</div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
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
              <label htmlFor="expense-amount" className="text-xs text-white/70 font-semibold block mb-1">Amount</label>
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
                className="w-full bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/70 font-semibold block mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
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
            disabled={saving || !form.amount}
            className="w-full bg-white text-orange-600 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors disabled:opacity-50"
          >
            <Plus size={16} /> {saving ? 'Saving…' : 'Add Expense'}
          </button>
        </form>
      </div>

      {/* Grouped expense history */}
      {grouped.length === 0 ? (
        <div className="text-center text-white/50 py-10 text-sm">No expenses logged yet.</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, entries]) => {
            const batchTotal = entries.reduce((s, e) => s + Number(e.amount), 0);
            const cat = v => CATEGORIES.find(c => c.value === v);
            return (
              <div key={date} className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden shadow">
                <div className="flex items-center justify-between px-4 py-3 bg-white/10 border-b border-white/10">
                  <span className="text-white font-bold text-sm">{formatDate(date)}</span>
                  <span className="text-white/80 text-sm font-semibold">{fmt(batchTotal)}</span>
                </div>
                <div className="divide-y divide-white/10">
                  {entries.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 group">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{cat(entry.category)?.emoji ?? '🛒'}</span>
                        <div>
                          <div className="text-white text-sm font-medium">{cat(entry.category)?.label ?? entry.category}</div>
                          {entry.note && <div className="text-white/50 text-xs">{entry.note}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-semibold text-sm">{fmt(entry.amount)}</span>
                        {pendingDeleteId === entry.id ? (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setPendingDeleteId(null)} className="text-xs text-white/60 hover:text-white font-semibold transition-colors cursor-pointer">Cancel</button>
                            <button type="button" onClick={() => { onDelete(entry.id); setPendingDeleteId(null); }} className="text-xs text-red-300 hover:text-red-200 font-bold transition-colors cursor-pointer">Delete</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-label="Delete expense"
                            onClick={() => setPendingDeleteId(entry.id)}
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
