import { useMemo } from 'react';
import type { Order, Expense } from '../types';
import { fmt } from '../lib/utils';
import { itemBreakdownForMonth, monthlyItemSeries, recentMonths, weekdayDemand, halfBatchInsight, ordersWithinDays, expensesByStore, expensesByCategory, linkOrderStats } from '../lib/insights';

const WINDOW_DAYS = 90;

function monthLabel(m: string, opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-CA', opts);
}

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  wrappers:   { label: 'Wrappers',   emoji: '🧻' },
  pork:       { label: 'Meats',      emoji: '🥩' },
  vegetables: { label: 'Vegetables', emoji: '🥦' },
  containers: { label: 'Containers', emoji: '📦' },
  bihon:      { label: 'Bihon',      emoji: '🍜' },
  other:      { label: 'Other',      emoji: '🛒' },
};

export default function InsightsView({ orders, expenses }: { orders: Order[]; expenses: Expense[] }) {
  // Weekday demand + half-batch read only the recent window — all-time would mix
  // stale seasonal data and let the recommendation go inert as orders pile up.
  const recent = useMemo(() => ordersWithinDays(orders, WINDOW_DAYS), [orders]);

  // Weekday demand — Mon-first display order
  const orderedDays = useMemo(() => {
    const allDays = weekdayDemand(recent);
    return [...allDays.slice(1), allDays[0]]; // Mon…Sat, Sun
  }, [recent]);
  const maxDayOrders = Math.max(...orderedDays.map(d => d.totalOrders), 1);

  // Half-batch insight
  const half = useMemo(() => halfBatchInsight(recent), [recent]);

  const [thisMonth, lastMonth] = recentMonths(2);
  const cur = itemBreakdownForMonth(orders, thisMonth);
  const linkStats = linkOrderStats(orders, thisMonth);
  const prev = itemBreakdownForMonth(orders, lastMonth);

  const momPct = prev.itemRevenue > 0
    ? Math.round(((cur.itemRevenue - prev.itemRevenue) / prev.itemRevenue) * 100)
    : null;

  const series = monthlyItemSeries(orders, 6);
  const maxRev = Math.max(...series.map(s => s.itemRevenue), 1);

  const storeRows = useMemo(() => expensesByStore(expenses), [expenses]);
  const categoryRows = useMemo(() => expensesByCategory(expenses), [expenses]);
  const expenseTotal = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const maxStoreTotal = Math.max(...storeRows.map(r => r.total), 1);
  const maxCatTotal = Math.max(...categoryRows.map(r => r.total), 1);

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

      {/* From the public order link — the marketplace funnel */}
      <div className="bg-white rounded-2xl border-2 border-stone-100 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🔗</span>
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">From the order link</span>
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-3xl font-black text-stone-800">{linkStats.fromLink}</span>
          <span className="text-sm text-stone-500">
            of {linkStats.total} order{linkStats.total !== 1 ? 's' : ''} this month{linkStats.total > 0 ? ` · ${linkStats.pct}%` : ''}
          </span>
        </div>
        <div className="text-xs text-stone-400 mt-1.5">
          {linkStats.allTimeFromLink} total via the public request form since tracking began
        </div>
      </div>

      {/* Custom / one-off items — only when there were any */}
      {cur.custom.revenue > 0 && (
        <div className="bg-white rounded-2xl border-2 border-stone-100 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🍽️</span>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Other / Custom</span>
            <span className="text-sm text-stone-400">{cur.custom.count} item{cur.custom.count !== 1 ? 's' : ''}</span>
          </div>
          <div className="text-xl font-black text-stone-800">{fmt(cur.custom.revenue)}</div>
        </div>
      )}

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
          Item sales (lumpia + pancit + custom). Delivery, rush/early fees, and tips show in the revenue cards above.
        </p>
      </div>

      {/* Weekday demand */}
      <div className="bg-white rounded-2xl border-2 border-stone-100 p-5">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-400">Orders by Day of Week</div>
          <span className="text-[11px] text-stone-400">Last 90 days</span>
        </div>
        {orderedDays.every(d => d.totalOrders === 0) ? (
          <p className="text-sm text-stone-400 italic">No order history yet.</p>
        ) : (
          <div className="space-y-2">
            {orderedDays.map(d => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-xs font-medium text-stone-500">{d.label}</span>
                <div className="flex-1 bg-stone-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all"
                    style={{ width: `${(d.totalOrders / maxDayOrders) * 100}%` }}
                  />
                </div>
                <span className="w-5 shrink-0 text-right text-xs font-bold text-stone-700 tabular-nums">{d.totalOrders}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expense insights — only when there's tagged data */}
      {expenses.length > 0 && (
        <>
          <div className="flex items-baseline justify-between pt-2">
            <h3 className="text-sm font-black text-white/80 uppercase tracking-wider">Supply Costs</h3>
            <span className="text-sm font-bold text-white/90 bg-white/15 px-3 py-1 rounded-full">{fmt(expenseTotal)} all time</span>
          </div>

          {/* By store */}
          {storeRows.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-stone-100 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Spend by Store</div>
              <div className="space-y-2">
                {storeRows.map(r => (
                  <div key={r.store} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs font-medium text-stone-600 truncate">{r.store}</span>
                    <div className="flex-1 bg-stone-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all"
                        style={{ width: `${(r.total / maxStoreTotal) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs font-bold text-stone-700 tabular-nums">{fmt(r.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By category */}
          {categoryRows.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-stone-100 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Spend by Category</div>
              <div className="space-y-2">
                {categoryRows.map(r => {
                  const meta = CATEGORY_LABELS[r.category] ?? { label: r.category, emoji: '🛒' };
                  return (
                    <div key={r.category} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs font-medium text-stone-600">{meta.emoji} {meta.label}</span>
                      <div className="flex-1 bg-stone-100 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all"
                          style={{ width: `${(r.total / maxCatTotal) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs font-bold text-stone-700 tabular-nums">{fmt(r.total)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Half-batch recommendation */}
      {half.totalLumpiaOrders >= 3 && (
        <div className={`rounded-2xl border-2 p-5 ${half.recommend ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-100'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">Lumpia Halves · <span className="text-stone-300">90d</span></div>
              <div className="text-2xl font-black text-stone-800">
                {Math.round(half.halvesRatio * 100)}%
                <span className="text-sm font-semibold text-stone-400 ml-1">of lumpia orders</span>
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {half.halvesOrderCount} of {half.totalLumpiaOrders} orders · {half.totalHalvesSold} half-sets total
              </div>
            </div>
            <span className="text-3xl">🥟</span>
          </div>
          {half.recommend && (
            <div className="mt-3 pt-3 border-t border-amber-200 flex items-start gap-2">
              <span className="text-sm">💡</span>
              <p className="text-xs font-semibold text-amber-800">
                Halves show up consistently — worth keeping them on the batch. Avg {half.avgHalvesPerOrder % 1 === 0 ? half.avgHalvesPerOrder : half.avgHalvesPerOrder.toFixed(1)} per order that includes them.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
