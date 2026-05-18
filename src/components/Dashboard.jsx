import { getRevenue, fmt, formatDate } from '../lib/utils';
import { Repeat, DollarSign, Calendar, Clock } from 'lucide-react';

export default function Dashboard({ orders, repeatCount }) {
  const revenue = getRevenue(orders);
  
  const nextOrder = [...orders]
    .filter(o => o.order_status === "Pending" && o.needed_date)
    .sort((a, b) => a.needed_date.localeCompare(b.needed_date))[0];

  const counts = ["Pending", "Ready"].reduce((acc, s) => {
    acc[s] = orders.filter(o => o.order_status === s).length;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
      <div className="col-span-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-4 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20"><DollarSign size={48} /></div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">Revenue This Month</div>
        <div className="font-playfair text-3xl font-black leading-tight">{fmt(revenue.month)}</div>
        <div className="text-xs text-white/70 mt-1">All time: {fmt(revenue.total)} · from paid & fulfilled</div>
      </div>
      
      <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-4 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20"><Calendar size={48} /></div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">Next Due</div>
        {nextOrder ? (
          <>
            <div className="font-playfair text-xl font-black leading-tight truncate">{nextOrder.customer_name}</div>
            <div className="text-xs text-white/70 mt-1">{formatDate(nextOrder.needed_date)}</div>
          </>
        ) : (
          <div className="font-playfair text-xl font-black leading-tight">—</div>
        )}
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
    </div>
  );
}
