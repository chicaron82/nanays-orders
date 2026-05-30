import type { Order } from '../../types';
import { dayLoad } from '../../lib/utils';
import OrderChip from './OrderChip';

interface Props {
  ymd: string;
  orders: Order[];
  isToday: boolean;
  inMonth: boolean;
  onDayClick: (ymd: string) => void;
}

const LEVEL: Record<'light' | 'medium' | 'heavy', string> = {
  light:  'bg-white',
  medium: 'bg-amber-100',
  heavy:  'bg-red-100',
};

export default function DayCell({ ymd, orders, isToday, inMonth, onDayClick }: Props) {
  const d = new Date(ymd + 'T00:00:00');
  const visible = orders.filter(o => o.order_status !== 'Cancelled');
  const { level } = dayLoad(visible);
  const shown = visible.slice(0, 2);
  const extra = visible.length - shown.length;

  return (
    <button
      onClick={() => onDayClick(ymd)}
      className={`h-[88px] sm:h-[104px] p-1 flex flex-col gap-0.5 text-left border border-black/5 rounded-lg transition hover:brightness-95 ${LEVEL[level]} ${inMonth ? '' : 'opacity-40'} ${isToday ? 'ring-2 ring-orange-500' : ''}`}
    >
      <span className={`text-xs font-bold px-1 ${isToday ? 'text-orange-600' : 'text-stone-500'}`}>
        {d.getDate()}
      </span>
      <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
        {shown.map(o => <OrderChip key={o.id as string} order={o} variant="compact" />)}
        {extra > 0 && (
          <span className="text-[10px] font-bold text-stone-400 px-1">+{extra} more</span>
        )}
      </div>
    </button>
  );
}
