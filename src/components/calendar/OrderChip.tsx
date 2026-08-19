import { MessageSquare, Check } from 'lucide-react';
import type { Order, OrderStatus } from '../../types';
import { orderSummary, fmt, isSettled, needsFollowUp, formatTime12 } from '../../lib/utils';

interface Props {
  order: Order;
  variant?: 'full' | 'compact';
  onClick?: () => void;
  // One-tap "mark delivered / picked up" — toggles fulfilled_at without opening the modal.
  // Delivered is binary (nothing to record), so it's safe as a quick tap; payment stays in
  // the modal because money has detail (overage → tip). Omitted → no toggle rendered.
  onToggleFulfilled?: (order: Order) => void;
}

const STATUS: Record<OrderStatus, { dot: string; border: string; bg: string; text: string }> = {
  Pending:   { dot: 'bg-orange-500',  border: 'border-l-orange-500',  bg: 'bg-orange-50',  text: 'text-orange-700' },
  Ready:     { dot: 'bg-blue-500',    border: 'border-l-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  Fulfilled: { dot: 'bg-emerald-500', border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Cancelled: { dot: 'bg-stone-400',   border: 'border-l-stone-400',   bg: 'bg-stone-100',  text: 'text-stone-500' },
};

export default function OrderChip({ order, variant = 'full', onClick, onToggleFulfilled }: Props) {
  // "Done" (crossed off) needs BOTH conditions: paid AND fulfilled. A paid-not-delivered
  // order stays open (you owe them food); a delivered-not-paid order stays open (they owe
  // you money). Legacy rows hand-flipped to order_status='Fulfilled' (pre-June-2026 pills,
  // before the fulfilled_at axis existed) grandfather as done regardless of payment.
  const settled = isSettled(order);              // paid in full
  const fulfilled = !!order.fulfilled_at;         // picked up / delivered (modern axis)
  const legacyFulfilled = order.order_status === 'Fulfilled';
  const cancelled = order.order_status === 'Cancelled';
  const done = (settled && fulfilled) || legacyFulfilled;
  const faded = done;
  const noShow = order.no_show === true;
  const followUp = needsFollowUp(order);
  const s = (!cancelled && done)
    ? STATUS.Fulfilled
    : (order.order_status && STATUS[order.order_status]) || STATUS.Pending;
  const items = `${order.lumpia?.enabled ? '🥟' : ''}${order.pancit?.enabled ? '🍜' : ''}` || '🍽️';
  // Match the order form's delivery vocabulary (🏠 Pickup / 🚗 City / 🛣️ Outside)
  // so the calendar and the form speak one language; outside-city 🛣️ flags a
  // longer haul at a glance. Any unexpected value falls back to a generic delivery.
  const DELIVERY: Record<string, { icon: string; label: string }> = {
    pickup:  { icon: '🏠', label: 'Pickup' },
    city:    { icon: '🚗', label: 'City delivery' },
    outside: { icon: '🛣️', label: 'Outside-city delivery' },
  };
  const delivery = DELIVERY[order.delivery_type ?? 'pickup'] ?? DELIVERY.city;
  const balance = order.payment_status === 'Deposit' ? (order.total ?? 0) - (Number(order.deposit_amount) || 0) : 0;
  const showBalance = order.payment_status === 'Deposit' && !legacyFulfilled && !cancelled && balance > 0;
  const unpaid = order.payment_status === 'Unpaid' && !legacyFulfilled && !cancelled;
  // Paid, but not yet crossed off → paid-and-waiting-to-deliver (the prepaid rush order).
  // Tells you money's in; the empty delivered-circle tells you it still has to go out.
  const paidWaiting = settled && !done && !cancelled;
  const note = [order.preferences, order.notes].filter(Boolean).join(' · ');
  // The quick delivered toggle: modern orders only (legacy done rows are historical; no toggle).
  const showFulfillToggle = !!onToggleFulfilled && !cancelled && !legacyFulfilled;
  const toggleFulfilled = (e: React.MouseEvent) => { e.stopPropagation(); onToggleFulfilled?.(order); };

  if (variant === 'compact') {
    return (
      <div
        className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${s.bg} ${s.text} ${faded ? 'opacity-60' : ''} ${done ? 'line-through' : ''}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
        <span className="truncate">{items}</span>
        <span className="ml-auto shrink-0" title={delivery.label} aria-label={delivery.label}>{delivery.icon}</span>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className={`w-full text-left bg-white rounded-lg border-l-4 ${s.border} shadow-sm px-3 py-2 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer ${faded ? 'opacity-60' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className={`font-bold text-sm flex items-baseline gap-1.5 ${done ? 'text-stone-400' : 'text-stone-800'}`}>
          <span className={`truncate ${done ? 'line-through' : ''}`}>{order.customer_name}</span>
          {order.pickup_time && (
            <span className="shrink-0 text-xs font-mono font-normal text-stone-400">{formatTime12(order.pickup_time)}</span>
          )}
          {note && (
            <span className="shrink-0 self-center text-stone-400" title={note} aria-label="Has notes">
              <MessageSquare size={12} />
            </span>
          )}
          {showBalance && (
            <span className="shrink-0 ml-auto text-xs font-bold text-amber-600">owes {fmt(balance)}</span>
          )}
          {paidWaiting && (
            <span className="shrink-0 ml-auto px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold" title="Paid in full — still to deliver">✓ paid</span>
          )}
          {unpaid && followUp && (
            <span className="shrink-0 ml-auto px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold" title="Past its date and still unpaid — follow up?">⏰ follow up?</span>
          )}
          {unpaid && !followUp && (
            <span className="shrink-0 ml-auto px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider">Unpaid</span>
          )}
        </div>
        <div className={`text-xs truncate mt-0.5 ${done ? 'line-through text-stone-400' : 'text-stone-500'}`}>
          {items} {orderSummary(order)}
        </div>
      </div>
      {/* Quick "mark delivered" tap — checked = delivered; empty = still to go out. */}
      {showFulfillToggle && (
        <button
          type="button"
          onClick={toggleFulfilled}
          title={fulfilled ? 'Delivered / picked up — tap to undo' : 'Mark delivered / picked up'}
          aria-label={fulfilled ? 'Mark not delivered' : 'Mark delivered'}
          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${fulfilled ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-stone-300 text-transparent hover:border-emerald-400'}`}
        >
          <Check size={14} strokeWidth={3} />
        </button>
      )}
      {cancelled ? (
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${noShow ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-500'}`}>{noShow ? 'No-Show' : 'Cancelled'}</span>
      ) : (
        <span className={`shrink-0 w-6 h-6 rounded-full ${s.bg} ${s.text} text-[11px] font-black flex items-center justify-center`} title={delivery.label} aria-label={delivery.label}>{delivery.icon}</span>
      )}
    </div>
  );
}
