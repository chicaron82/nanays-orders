// One logged expense. Collapsed: category, store, note, amount, hover-reveal
// edit/delete. Expanded: an inline edit form (note, amount, category, store) —
// the fields most likely to need a fix after the fact, same as when logging one.
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Expense } from '../types';
import { fmt } from '../lib/utils';

interface CatOption { value: string; label: string; emoji: string; }

interface Props {
  entry: Expense;
  categories: CatOption[];
  stores: CatOption[];
  onUpdate: (id: string | number, patch: Partial<Expense>) => Promise<void>;
  onDelete: (id: string | number) => void;
}

export function ExpenseRow({ entry, categories, stores, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(entry.note ?? '');
  const [amount, setAmount] = useState(String(entry.amount));
  const [category, setCategory] = useState(entry.category ?? 'other');
  const [store, setStore] = useState(entry.store ?? '');

  const cat = (v: string) => categories.find(c => c.value === v);
  const parsedAmount = parseFloat(amount);
  const valid = !isNaN(parsedAmount) && parsedAmount > 0;

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      await onUpdate(entry.id!, {
        note: note.trim() || undefined,
        amount: parsedAmount,
        category,
        store: store.trim() || undefined,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="px-4 py-3 space-y-2.5 bg-white/5">
        <div className="flex flex-wrap gap-1.5">
          {categories.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                category === c.value
                  ? 'bg-white text-orange-600 border-white'
                  : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {stores.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStore(store === s.value ? '' : s.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                store === s.value
                  ? 'bg-white text-orange-600 border-white'
                  : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
              }`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number" min="0.01" step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-24 shrink-0 bg-white/20 border border-white/30 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          <input
            type="text"
            placeholder="Note — e.g. chicken back bone for stock"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="flex-1 min-w-0 bg-white/20 border border-white/30 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setEditing(false)} disabled={saving}
            className="text-xs text-white/60 hover:text-white font-semibold transition-colors cursor-pointer disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !valid}
            className="text-xs text-white bg-white/20 hover:bg-white/30 font-bold px-3 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 group">
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
        {pendingDelete ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPendingDelete(false)} className="text-xs text-white/60 hover:text-white font-semibold transition-colors cursor-pointer">Cancel</button>
            <button type="button" onClick={() => { onDelete(entry.id!); setPendingDelete(false); }} className="text-xs text-red-300 hover:text-red-200 font-bold transition-colors cursor-pointer">Delete</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" aria-label="Edit expense" onClick={() => setEditing(true)}
              className="text-white/40 hover:text-white transition-colors cursor-pointer">
              <Pencil size={14} />
            </button>
            <button type="button" aria-label="Delete expense" onClick={() => setPendingDelete(true)}
              className="text-white/40 hover:text-red-300 transition-colors cursor-pointer">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
