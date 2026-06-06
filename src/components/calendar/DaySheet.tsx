import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Plus, Printer, Lock, Unlock } from 'lucide-react';
import type { Order } from '../../types';
import { formatDate, dayLoad, fmt } from '../../lib/utils';
import OrderChip from './OrderChip';

interface Props {
  ymd: string | null;
  orders: Order[];
  isBlocked?: boolean;
  blockedReason?: string | null;
  onBlock?: (ymd: string, reason?: string) => void;
  onUnblock?: (ymd: string) => void;
  onClose: () => void;
  onOrderClick: (order: Order) => void;
  onNewOrderForDate: (ymd: string) => void;
  onPrint?: (ymd: string) => void;
}

export default function DaySheet({ ymd, orders, isBlocked, blockedReason, onBlock, onUnblock, onClose, onOrderClick, onNewOrderForDate, onPrint }: Props) {
  const [showCancelled, setShowCancelled] = useState(false);
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [showBlockInput, setShowBlockInput] = useState(false);

  if (!ymd) return null;

  const visible = orders
    .filter(o => o.order_status !== 'Cancelled')
    .sort((a, b) => (a.pickup_time || '').localeCompare(b.pickup_time || ''));
  const cancelled = orders.filter(o => o.order_status === 'Cancelled');
  const shown = showCancelled ? [...visible, ...cancelled] : visible;
  const { units } = dayLoad(visible);
  const dayTotal = visible.reduce((s, o) => s + (o.total ?? 0), 0);

  const handleBlock = () => {
    onBlock?.(ymd, blockReasonInput.trim() || undefined);
    setBlockReasonInput('');
    setShowBlockInput(false);
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <m.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          onClick={e => e.stopPropagation()}
          className="bg-stone-50 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        >
          <div className={`sticky top-0 p-4 flex justify-between items-center z-10 ${isBlocked ? 'bg-gradient-to-r from-slate-500 to-slate-600' : 'bg-gradient-to-r from-orange-600 to-amber-500'}`}>
            <div className="text-white">
              <div className="font-playfair text-xl font-black flex items-center gap-2">
                {formatDate(ymd)}
                {isBlocked && <Lock size={15} />}
              </div>
              <div className="text-xs text-white/80">
                {isBlocked
                  ? blockedReason ? `Off — ${blockedReason}` : 'Day off'
                  : `${visible.length} order${visible.length !== 1 ? 's' : ''}${units > 0 ? ` · ${units} work units` : ''}${dayTotal > 0 ? ` · ${fmt(dayTotal)}` : ''}`
                }
              </div>
            </div>
            <div className="flex items-center gap-2">
              {visible.length > 0 && onPrint && !isBlocked && (
                <button
                  onClick={() => onPrint(ymd)}
                  aria-label="Print prep sheet"
                  className="h-8 px-3 flex items-center gap-1.5 rounded-full bg-white/20 text-white text-xs font-bold hover:bg-white/30 transition-colors"
                >
                  <Printer size={15} /> Prep
                </button>
              )}
              <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-2">
            {isBlocked && (
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-sm text-slate-600 flex items-start gap-2">
                <Lock size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <span>{blockedReason ? `This day is blocked: ${blockedReason}` : 'This day is blocked — the kitchen is off.'}</span>
              </div>
            )}

            {visible.length === 0 && !showCancelled && !isBlocked && (
              <div className="text-center text-stone-400 text-sm py-6">No orders this day</div>
            )}
            {shown.map(o => (
              <OrderChip key={o.id as string} order={o} variant="full" onClick={() => onOrderClick(o)} />
            ))}
            {cancelled.length > 0 && (
              <button
                onClick={() => setShowCancelled(v => !v)}
                className="w-full text-center text-xs font-semibold text-stone-400 hover:text-stone-600 py-1.5 transition-colors"
              >
                {showCancelled ? 'Hide' : 'Show'} {cancelled.length} cancelled
              </button>
            )}

            {!isBlocked && (
              <button
                onClick={() => onNewOrderForDate(ymd)}
                className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 font-bold text-sm hover:border-orange-400 hover:text-orange-500 transition-colors"
              >
                <Plus size={16} /> New order this day
              </button>
            )}

            <div className="pt-1 border-t border-stone-200">
              {isBlocked ? (
                <button
                  onClick={() => onUnblock?.(ymd)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-slate-500 font-semibold text-xs hover:bg-slate-100 transition-colors"
                >
                  <Unlock size={13} /> Unblock this day
                </button>
              ) : showBlockInput ? (
                <div className="flex gap-2 items-center">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Reason (optional)"
                    value={blockReasonInput}
                    onChange={e => setBlockReasonInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleBlock(); if (e.key === 'Escape') setShowBlockInput(false); }}
                    className="flex-1 text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button onClick={handleBlock} className="px-3 py-1.5 rounded-lg bg-slate-600 text-white text-xs font-bold hover:bg-slate-700 transition-colors">Block</button>
                  <button onClick={() => setShowBlockInput(false)} className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-500 text-xs font-bold hover:bg-stone-200 transition-colors">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBlockInput(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-slate-400 font-semibold text-xs hover:bg-slate-100 transition-colors"
                >
                  <Lock size={13} /> Block this day
                </button>
              )}
            </div>
          </div>
        </m.div>
      </div>
    </AnimatePresence>
  );
}
