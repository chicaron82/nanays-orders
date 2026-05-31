import type { Order } from '../types';
import { fmt } from '../lib/utils';
import { itemBreakdownForMonth, monthlyItemSeries, recentMonths } from '../lib/insights';

function monthLabel(m: string, opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-CA', opts);
}

export default function InsightsView({ orders }: { orders: Order[] }) {
  const [thisMonth, lastMonth] = recentMonths(2);
  const cur = itemBreakdownForMonth(orders, thisMonth);
  const prev = itemBreakdownForMonth(orders, lastMonth);

  const momPct = prev.itemRevenue > 0
    ? Math.round(((cur.itemRevenue - prev.itemRevenue) / prev.itemRevenue) * 100)
    : null;

  const series = monthlyItemSeries(orders, 6);
  const maxRev = Math.max(...series.map(s => s.itemRevenue), 1);

  return (
    <div className="max-w-3xl mx-auto px-6 pb-10 space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-black text-white">Insights</h2>
        <span className="text-sm font-bold text-white/90 bg-white/15 px-3 py-1 rounded-full">{monthLabel(thisMonth)}</span>
      </div>

      {/* Item cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border-2 border-stone-100 p-5">
          <div className="text-3xl mb-1">🥟</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-400">Lumpia</div>
          <div className="text-2xl font-black text-stone-800 mt-1">{fmt(cur.lumpia.revenue)}</div>
          <div className="text-sm text-stone-500 mt-1">
            {cur.lumpia.full} full · {cur.lumpia.half} half
          </div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-stone-100 p-5">
          <div className="text-3xl mb-1">🍜</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-400">Pancit</div>
          <div className="text-2xl font-black text-stone-800 mt-1">{fmt(cur.pancit.revenue)}</div>
          <div className="text-sm text-stone-500 mt-1">
            {cur.pancit.full} reg · {cur.pancit.half} sm · {cur.pancit.large} lg
          </div>
        </div>
      </div>

      {/* Month total + MoM */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 rounded-2xl p-5 text-white shadow-lg flex items-baseline justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider opacity-80">Item Sales This Month</div>
          <div className="text-xs opacity-70 mt-1">{cur.orderCount} order{cur.orderCount !== 1 ? 's' : ''}</div>
        </div>
        <div className="text-right">
          <div className="font-playfair text-3xl font-black">{fmt(cur.itemRevenue)}</div>
          {momPct !== null && (
            <div className={`text-xs font-bold mt-0.5 ${momPct >= 0 ? 'text-emerald-100' : 'text-red-100'}`}>
              {momPct >= 0 ? '▲' : '▼'} {Math.abs(momPct)}% vs {monthLabel(lastMonth, { month: 'short' })}
            </div>
          )}
        </div>
      </div>

      {/* 6-month trend */}
      <div className="bg-white rounded-2xl border-2 border-stone-100 p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Recent Months</div>
        {series.every(s => s.itemRevenue === 0) ? (
          <p className="text-sm text-stone-400 italic">No item sales recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {series.map(s => (
              <div key={s.month} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs font-medium text-stone-500">{monthLabel(s.month, { month: 'short', year: '2-digit' })}</span>
                <div className="flex-1 bg-stone-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all"
                    style={{ width: `${(s.itemRevenue / maxRev) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs font-bold text-stone-700 tabular-nums">{fmt(s.itemRevenue)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-stone-400 mt-3">
          Item sales only (lumpia + pancit). Delivery, rush/early fees, and tips show in the revenue cards above.
        </p>
      </div>
    </div>
  );
}
