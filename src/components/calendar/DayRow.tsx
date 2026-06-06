import { Lock, Plus } from 'lucide-react';
import type { Order } from '../../types';
import { dayLoad } from '../../lib/utils';
import OrderChip from './OrderChip';

interface Props {
  ymd: string;
  orders: Order[];
  isToday: boolean;
  isBlocked?: boolean;
  blockedReason?: string | null;
  onOrderClick: (order: Order) => void;
  onNewOrderForDate: (ymd: string) => void;
}

const LEVEL = {
  light:  { row: 'bg-white border-stone-200',    badge: 'bg-emerald-100 text-emerald-700', label: 'Light' },
  medium: { row: 'bg-amber-50 border-amber-300', badge: 'bg-amber-200 text-amber-900',     label: 'Filling up' },
  heavy:  { row: 'bg-red-50 border-red-300',     badge: 'bg-red-200 text-red-900',         label: 'Heavy' },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DayRow({ ymd, orders, isToday, isBlocked, blockedReason, onOrderClick, onNewOrderForDate }: Props) {
  const d = new Date(ymd + 'T00:00:00');
  const visible = orders.filter(o => o.order_status !== 'Cancelled');
  const { units, level } = dayLoad(visible);
  const lv = LEVEL[level];

  const rowClass = isBlocked
    ? 'bg-slate-50 border-slate-200'
    : lv.row;

  return (
    <div className={`rounded-xl border-2 ${rowClass} ${isToday ? 'ring-2 ring-orange-500' : ''} overflow-hidden`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-black/5">
        <div className="flex items-baseline gap-2">
          <span className={`font-bold text-sm flex items-center gap-1.5 ${isToday ? 'text-orange-600' : isBlocked ? 'text-slate-400' : 'text-stone-700'}`}>
            {isToday ? 'Today' : WEEKDAYS[d.getDay()]}
            {isBlocked && <Lock size={11} className="inline-block" />}
          </span>
          <span className="text-xs text-stone-400">{MONTHS[d.getMonth()]} {d.getDate()}</span>
          {isBlocked && blockedReason && (
            <span className="text-[10px] text-slate-400 italic">— {blockedReason}</span>
          )}
        </div>
        {!isBlocked && units > 0 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lv.badge}`}>
            {lv.label} · {units}
          </span>
        )}
        {isBlocked && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">Day off</span>
        )}
      </div>
      <div className="p-2 space-y-1.5">
        {visible.map(o => (
          <OrderChip key={o.id as string} order={o} variant="full" onClick={() => onOrderClick(o)} />
        ))}
        <button
          onClick={() => onNewOrderForDate(ymd)}
          className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${isBlocked ? 'text-slate-300 hover:text-slate-500' : 'text-stone-400 hover:text-orange-500'} ${visible.length === 0 ? 'py-2' : 'pt-1 border-t border-stone-100'}`}
        >
          <Plus size={14} /> Add order
        </button>
      </div>
    </div>
  );
}
