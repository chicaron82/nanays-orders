// One logged expense. Hover reveals Edit (reopens the Log an Expense form above,
// pre-filled — see ExpenseLog.startEdit) and Delete (hover-reveal, two-step confirm).
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Expense } from '../types';
import { fmt } from '../lib/utils';

interface CatOption { value: string; label: string; emoji: string; }

interface Props {
  entry: Expense;
  categories: CatOption[];
  onEdit: (entry: Expense) => void;
  onDelete: (id: string | number) => void;
}

export function ExpenseRow({ entry, categories, onEdit, onDelete }: Props) {
  const [pendingDelete, setPendingDelete] = useState(false);
  const cat = categories.find(c => c.value === entry.category);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 group">
      <div className="flex items-center gap-2.5">
        <span className="text-base">{cat?.emoji ?? '🛒'}</span>
        <div>
          <div className="text-white text-sm font-medium">{cat?.label ?? entry.category}</div>
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
            <button type="button" aria-label="Edit expense" onClick={() => onEdit(entry)}
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
