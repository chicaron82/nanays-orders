import { MessageSquare } from 'lucide-react';
import type { Order, OrderStatus } from '../../types';
import { orderSummary, fmt, isSettled } from '../../lib/utils';

interface Props {
  order: Order;
  variant?: 'full' | 'compact';
  onClick?: () => void;
}

const STATUS: Record<OrderStatus, { dot: string; border: string; bg: string; text: string }> = {
  Pending:   { dot: 'bg-orange-500',  border: 'border-l-orange-500',  bg: 'bg-orange-50',  text: 'text-orange-700' },
  Ready:     { dot: 'bg-blue-500',    border: 'border-l-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  Fulfilled: { dot: 'bg-emerald-500', border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Cancelled: { dot: 'bg-stone-400',   border: 'border-l-stone-400',   bg: 'bg-stone-100',  text: 'text-stone-500' },
};

export default function OrderChip({ order, variant = 'full', onClick }: Props) {
  // "Done" is payment-driven: a settled (fully paid) order is complete. Legacy
  // rows hand-flipped to Fulfilled (pre-June-2026 status pills) keep their done
  // treatment via the explicit Fulfilled checks.
  const settled = isSettled(order);
  const legacyFulfilled = order.order_status === 'Fulfilled';
  const cancelled = order.order_status === 'Cancelled';
  const s = (!cancelled && settled)
    ? STATUS.Fulfilled
    : (order.order_status && STATUS[order.order_status]) || STATUS.Pending;
  const items = `${order.lumpia?.enabled ? '🥟' : ''}${order.pancit?.enabled ? '🍜' : ''}` || '🍽️';
  const dp = order.delivery_type === 'pickup' ? 'P' : 'D';
  const done = settled;
  const faded = settled || legacyFulfilled;
  const balance = order.payment_status === 'Deposit' ? (order.total ?? 0) - (Number(order.deposit_amount) || 0) : 0;
  const showBalance = order.payment_status === 'Deposit' && !legacyFulfilled && !cancelled && balance > 0;
  const unpaid = order.payment_status === 'Unpaid' && !legacyFulfilled && !cancelled;
  const note = [order.preferences, order.notes].filter(Boolean).join(' · ');

  if (variant === 'compact') {
    return (
      <div
        className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${s.bg} ${s.text} ${faded ? 'opacity-60' : ''} ${done ? 'line-through' : ''}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
        <span className="truncate">{items}</span>
        <span className="ml-auto shrink-0">{dp}</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-lg border-l-4 ${s.border} shadow-sm px-3 py-2 flex items-center gap-3 hover:shadow-md transition-shadow ${faded ? 'opacity-60' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className={`font-bold text-sm flex items-baseline gap-1.5 ${done ? 'text-stone-400' : 'text-stone-800'}`}>
          <span className={`truncate ${done ? 'line-through' : ''}`}>{order.customer_name}</span>
          {order.pickup_time && (
            <span className="shrink-0 text-xs font-mono font-normal text-stone-400">{order.pickup_time}</span>
          )}
          {note && (
            <span className="shrink-0 self-center text-stone-400" title={note} aria-label="Has notes">
              <MessageSquare size={12} />
            </span>
          )}
          {showBalance && (
            <span className="shrink-0 ml-auto text-xs font-bold text-amber-600">owes {fmt(balance)}</span>
          )}
          {unpaid && (
            <span className="shrink-0 ml-auto px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider">Unpaid</span>
          )}
        </div>
        <div className={`text-xs truncate mt-0.5 ${done ? 'line-through text-stone-400' : 'text-stone-500'}`}>
          {items} {orderSummary(order)}
        </div>
      </div>
      {cancelled ? (
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-stone-200 text-stone-500 text-[10px] font-bold uppercase tracking-wider">Cancelled</span>
      ) : (
        <span className={`shrink-0 w-6 h-6 rounded-full ${s.bg} ${s.text} text-[11px] font-black flex items-center justify-center`}>{dp}</span>
      )}
    </button>
  );
}
