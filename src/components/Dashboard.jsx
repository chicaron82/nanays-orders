import { getRevenue, fmt } from '../lib/utils';
import { Repeat, DollarSign, Clock, TrendingUp, Wallet } from 'lucide-react';

export default function Dashboard({ orders, repeatCount, expenses = [] }) {
  const revenue = getRevenue(orders);

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlySpend = expenses
    .filter(e => e.date.startsWith(monthPrefix))
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const net = revenue.month - monthlySpend;

  const counts = ["Pending", "Ready"].reduce((acc, s) => {
    acc[s] = orders.filter(o => o.order_status === s).length;
    return acc;
  }, {});

  const unpaidOrders = orders.filter(o => o.payment_status === 'Unpaid' && o.order_status !== 'Cancelled');
  const thisMonthUnpaid = unpaidOrders.filter(o => (o.needed_date || '').substring(0, 7) <= monthPrefix);
  const futureUnpaid = unpaidOrders.filter(o => (o.needed_date || '').substring(0, 7) > monthPrefix);
  const outstanding = thisMonthUnpaid.reduce((sum, o) => sum + (o.total || 0), 0);
  const futureOutstanding = futureUnpaid.reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
      <div className="col-span-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-4 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20"><DollarSign size={48} /></div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">Revenue This Month</div>
        <div className="font-playfair text-3xl font-black leading-tight">{fmt(revenue.month)}</div>
        <div className="text-xs text-white/70 mt-1">All time: {fmt(revenue.total)} · from paid & fulfilled</div>
      </div>

      <div className="col-span-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-4 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp size={48} /></div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">This Month — Net</div>
        <div className={`font-playfair text-3xl font-black leading-tight ${net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmt(net)}</div>
        <div className="text-xs text-white/70 mt-1">{fmt(revenue.month)} revenue · {fmt(monthlySpend)} expenses</div>
      </div>

      <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-4 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20"><Repeat size={48} /></div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">Repeat Customers</div>
        <div className="font-playfair text-3xl font-black leading-tight">{repeatCount}</div>
        <div className="text-xs text-white/70 mt-1">ordered &gt; 1 time</div>
      </div>

      <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-4 text-white shadow-lg relative overflow-hidden grid grid-cols-2 gap-2">
        <div>
          <div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={48} /></div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">Pending</div>
          <div className="font-playfair text-2xl font-black leading-tight">{counts.Pending || 0}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">Ready</div>
          <div className="font-playfair text-2xl font-black leading-tight text-emerald-300">{counts.Ready || 0}</div>
        </div>
      </div>

      <div className="col-span-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-4 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20"><Wallet size={48} /></div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">Outstanding Balance</div>
        <div className={`font-playfair text-3xl font-black leading-tight ${outstanding > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{fmt(outstanding)}</div>
        <div className="text-xs text-white/70 mt-1">{thisMonthUnpaid.length} unpaid order{thisMonthUnpaid.length !== 1 ? 's' : ''} this month</div>
        {futureOutstanding > 0 && (
          <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between">
            <span className="text-xs text-white/50">Future orders</span>
            <span className="text-xs font-semibold text-white/70">{fmt(futureOutstanding)} · {futureUnpaid.length} order{futureUnpaid.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
