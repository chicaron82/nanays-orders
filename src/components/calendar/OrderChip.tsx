import type { Order, OrderStatus } from '../../types';
import { orderSummary } from '../../lib/utils';

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
  const s = (order.order_status && STATUS[order.order_status]) || STATUS.Pending;
  const items = `${order.lumpia?.enabled ? '🥟' : ''}${order.pancit?.enabled ? '🍜' : ''}` || '🍽️';
  const dp = order.delivery_type === 'pickup' ? 'P' : 'D';
  const faded = order.order_status === 'Fulfilled';

  if (variant === 'compact') {
    return (
      <div
        className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${s.bg} ${s.text} ${faded ? 'opacity-60' : ''}`}
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
        <div className="font-bold text-stone-800 text-sm truncate">{order.customer_name}</div>
        <div className="text-xs text-stone-500 truncate">{items} {orderSummary(order)}</div>
      </div>
      <span className={`shrink-0 w-6 h-6 rounded-full ${s.bg} ${s.text} text-[11px] font-black flex items-center justify-center`}>{dp}</span>
    </button>
  );
}
