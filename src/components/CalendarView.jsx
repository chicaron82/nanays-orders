import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { getWeekDays, getMonthGrid, localYMD, formatDate } from '../lib/utils';
import DayRow from './calendar/DayRow';
import DayCell from './calendar/DayCell';
import DaySheet from './calendar/DaySheet';
import OrderChip from './calendar/OrderChip';

const VIEWS = ['week', 'month', 'agenda'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarView({ orders, onOrderClick, onNewOrderForDate }) {
  const [view, setView] = useState('week');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [daySheetDate, setDaySheetDate] = useState(null);

  const todayYMD = localYMD(new Date());

  const ordersByDate = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if (!o.needed_date) return;
      (map[o.needed_date] = map[o.needed_date] || []).push(o);
    });
    return map;
  }, [orders]);

  const overdue = useMemo(
    () => orders
      .filter(o => o.order_status === 'Pending' && o.needed_date && o.needed_date < todayYMD)
      .sort((a, b) => a.needed_date.localeCompare(b.needed_date)),
    [orders, todayYMD]
  );

  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const monthGrid = useMemo(() => getMonthGrid(anchorDate), [anchorDate]);
  const agendaDays = useMemo(
    () => Object.keys(ordersByDate).filter(ymd => ymd >= todayYMD).sort(),
    [ordersByDate, todayYMD]
  );

  const shift = (dir) => {
    setAnchorDate(prev => {
      const d = new Date(prev);
      if (view === 'month') d.setMonth(d.getMonth() + dir);
      else d.setDate(d.getDate() + dir * 7);
      return d;
    });
  };

  const shortLabel = (ymd) => {
    const d = new Date(ymd + 'T00:00:00');
    return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  };

  const periodLabel = view === 'month'
    ? `${MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
    : view === 'week'
      ? `${shortLabel(weekDays[0])} – ${shortLabel(weekDays[6])}`
      : 'Upcoming';

  return (
    <div className="px-4 sm:px-6">
      {/* Header — view toggle + navigation */}
      <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex bg-black/20 rounded-lg p-1 self-start">
          {VIEWS.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-colors ${view === v ? 'bg-white text-orange-600 shadow-sm' : 'text-white/70 hover:text-white'}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {view !== 'agenda' && (
            <>
              <button onClick={() => shift(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/20 text-white hover:bg-black/40 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setAnchorDate(new Date())} className="px-3 h-8 rounded-lg bg-black/20 text-white text-xs font-bold hover:bg-black/40 transition-colors">
                Today
              </button>
              <button onClick={() => shift(1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/20 text-white hover:bg-black/40 transition-colors">
                <ChevronRight size={16} />
              </button>
            </>
          )}
          <span className="text-white font-bold text-sm ml-1">{periodLabel}</span>
        </div>
      </div>

      {/* Overdue strip */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wide mb-2">
            <AlertTriangle size={14} /> {overdue.length} Overdue
          </div>
          <div className="space-y-1.5">
            {overdue.map(o => (
              <div key={o.id} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-red-500 shrink-0 w-20">{formatDate(o.needed_date)}</span>
                <div className="flex-1 min-w-0">
                  <OrderChip order={o} variant="full" onClick={() => onOrderClick(o)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week — vertical stack of 7 day rows */}
      {view === 'week' && (
        <div className="space-y-2">
          {weekDays.map(ymd => (
            <DayRow
              key={ymd}
              ymd={ymd}
              orders={ordersByDate[ymd] || []}
              isToday={ymd === todayYMD}
              onOrderClick={onOrderClick}
              onNewOrderForDate={onNewOrderForDate}
            />
          ))}
        </div>
      )}

      {/* Month — 7-col grid */}
      {view === 'month' && (
        <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-2">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-[10px] font-bold text-white/60 py-1">{w}</div>
            ))}
          </div>
          <div className="space-y-1">
            {monthGrid.map((week, i) => (
              <div key={i} className="grid grid-cols-7 gap-1">
                {week.map(ymd => (
                  <DayCell
                    key={ymd}
                    ymd={ymd}
                    orders={ordersByDate[ymd] || []}
                    isToday={ymd === todayYMD}
                    inMonth={new Date(ymd + 'T00:00:00').getMonth() === anchorDate.getMonth()}
                    onDayClick={setDaySheetDate}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agenda — only days with upcoming orders */}
      {view === 'agenda' && (
        <div className="space-y-2">
          {agendaDays.length === 0 && (
            <div className="text-center text-white/60 py-12 font-medium">No upcoming orders</div>
          )}
          {agendaDays.map(ymd => (
            <DayRow
              key={ymd}
              ymd={ymd}
              orders={ordersByDate[ymd] || []}
              isToday={ymd === todayYMD}
              onOrderClick={onOrderClick}
              onNewOrderForDate={onNewOrderForDate}
            />
          ))}
        </div>
      )}

      {daySheetDate && (
        <DaySheet
          ymd={daySheetDate}
          orders={ordersByDate[daySheetDate] || []}
          onClose={() => setDaySheetDate(null)}
          onOrderClick={(o) => { setDaySheetDate(null); onOrderClick(o); }}
          onNewOrderForDate={(ymd) => { setDaySheetDate(null); onNewOrderForDate(ymd); }}
        />
      )}
    </div>
  );
}
