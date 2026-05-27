import { useState } from 'react';
import { getAvailable, getReserved, getMakeMoreNeeds } from '../lib/utils';
import { AlertTriangle, Package, ChefHat, CheckCircle2 } from 'lucide-react';

export default function StockManager({ stock, orders, updateStock }) {
  const [stockEdit, setStockEdit] = useState({ ...stock });
  const avail = getAvailable(stock, orders);
  const reserved = getReserved(orders);
  const makeMore = getMakeMoreNeeds(orders, stock);

  const handleUpdate = () => {
    updateStock(stockEdit);
  };

  const hasShortage = makeMore.lumpia.need > 0 || makeMore.pancitFull.need > 0 || makeMore.pancitHalf.need > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-12 space-y-4">
      {hasShortage ? (
        <div className="bg-gradient-to-br from-orange-50 to-amber-100 border border-amber-300 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-amber-900 font-bold mb-3 font-playfair text-lg">
            <ChefHat className="text-amber-600" /> Make More — Pending Orders Need:
          </div>
          <div className="space-y-2 text-sm text-amber-800">
            {makeMore.lumpia.need > 0 && (
              <div className="flex items-center gap-2">
                🥟 <strong>{makeMore.lumpia.need} more lumpia batch{makeMore.lumpia.need !== 1 ? 'es' : ''}</strong>
                <span className="text-xs opacity-75">({makeMore.lumpia.avail} avail, {makeMore.lumpia.total} needed)</span>
                {stock.wrapper_packs > 0 ? (
                  <span className={`ml-2 text-xs font-bold ${makeMore.lumpia.need <= stock.wrapper_packs ? 'text-emerald-600' : 'text-red-600'}`}>
                    · {stock.wrapper_packs} packs on hand
                  </span>
                ) : (
                  <span className="ml-2 text-xs font-bold text-red-600">· No wrappers on hand! 🚨</span>
                )}
              </div>
            )}
            {makeMore.pancitFull.need > 0 && (
              <div>🍜 <strong>{makeMore.pancitFull.need} more regular tray{makeMore.pancitFull.need !== 1 ? 's' : ''}</strong></div>
            )}
            {makeMore.pancitHalf.need > 0 && (
              <div>🍜 <strong>{makeMore.pancitHalf.need} more small tray{makeMore.pancitHalf.need !== 1 ? 's' : ''}</strong></div>
            )}
          </div>
        </div>
      ) : (
        orders.filter(o => o.order_status === "Pending").length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm flex items-center gap-3 text-emerald-800">
            <CheckCircle2 className="text-emerald-600" />
            <span className="font-bold text-sm">All pending orders are covered by current stock!</span>
          </div>
        )
      )}

      {[
        { key: "lumpia_sets", label: "🥟 Lumpia Ready", avail: avail.lumpiaSets, reserved: reserved.lumpiaSets, total: stock.lumpia_sets || 0 },
        { key: "wrapper_packs", label: "📦 Wrapper Packs on Hand", avail: stock.wrapper_packs || 0, reserved: 0, total: Math.max(stock.wrapper_packs || 1, 1), isWrapper: true },
        { key: "pancit_full", label: "🍜 Pancit Regular Trays", avail: avail.pancitFull, reserved: reserved.pancitFull, total: stock.pancit_full || 0 },
        { key: "pancit_half", label: "🍜 Pancit Small Trays", avail: avail.pancitHalf, reserved: reserved.pancitHalf, total: stock.pancit_half || 0 },
      ].map(item => {
        const { label, avail: a, reserved: r, total: t, isWrapper } = item;
        const level = a <= 0 ? "danger" : a <= 2 ? "warn" : "ok";
        const pct = t > 0 ? Math.min(100, Math.max(0, (a / t) * 100)) : 0;
        
        return (
          <div key={label} className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-stone-200">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-stone-800 text-sm">{label}</div>
                <div className="text-xs text-stone-500 mt-1">
                  {!isWrapper && r > 0 ? `${r} reserved · ` : ""}{isWrapper ? "" : `${t} on hand`}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-playfair text-3xl font-black leading-none ${level === 'danger' ? 'text-red-500' : level === 'warn' ? 'text-orange-500' : 'text-emerald-500'}`}>
                  {a}
                </div>
                <div className="text-[10px] text-stone-400 font-bold uppercase mt-1">{isWrapper ? 'packs' : 'avail'}</div>
              </div>
            </div>
            
            {!isWrapper && (
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden mt-3">
                <div className={`h-full rounded-full transition-all duration-500 ${level === 'danger' ? 'bg-red-500' : level === 'warn' ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
              </div>
            )}
            
            <div className="mt-2 text-xs font-bold">
              {isWrapper && stock.wrapper_packs > 0 && <span className="text-emerald-600">✅ Can make {stock.wrapper_packs} more batch{stock.wrapper_packs !== 1 ? 'es' : ''}</span>}
              {isWrapper && stock.wrapper_packs === 0 && <span className="text-red-600 flex items-center gap-1"><AlertTriangle size={14}/> Need to buy wrappers!</span>}
              {!isWrapper && level === "danger" && <span className="text-red-600 flex items-center gap-1"><AlertTriangle size={14}/> Out of stock!</span>}
              {!isWrapper && level === "warn" && <span className="text-orange-600 flex items-center gap-1"><AlertTriangle size={14}/> Running low</span>}
            </div>
          </div>
        );
      })}

      {/* Ingredients */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-md border border-stone-200">
        <h3 className="font-playfair text-xl font-bold text-stone-800 mb-5 flex items-center gap-2">
          <ChefHat className="text-orange-500" /> Ingredients
        </h3>

        {/* Shared consumables */}
        <div className="mb-6">
          <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-3">Shared — Carrots &amp; Chinese Celery</div>
          {[
            { key: 'carrots_status', label: '🥕 Carrots' },
            { key: 'celery_status',  label: '🌿 Chinese Celery' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-stone-700">{label}</span>
              <div className="flex rounded-lg overflow-hidden border border-stone-200 text-xs font-bold">
                {[
                  { value: 'plenty', label: 'Plenty', active: 'bg-emerald-500 text-white', inactive: 'bg-white text-stone-400 hover:bg-stone-50' },
                  { value: 'low',    label: 'Low',    active: 'bg-amber-400 text-amber-900', inactive: 'bg-white text-stone-400 hover:bg-stone-50' },
                  { value: 'out',    label: 'Out',    active: 'bg-red-500 text-white',   inactive: 'bg-white text-stone-400 hover:bg-stone-50' },
                ].map(({ value, label: optLabel, active, inactive }) => (
                  <button
                    key={value}
                    onClick={() => setStockEdit(s => ({ ...s, [key]: value }))}
                    className={`px-3 py-1.5 transition-colors ${stockEdit[key] === value ? active : inactive}`}
                  >
                    {optLabel}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Lumpia prep chain */}
        <div className="mb-6">
          <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-3">🥟 Lumpia — Ground Pork</div>
          <div className="text-xs text-stone-400 mb-3">1 portion (5lb) = 400 pcs = 4 batches · Frozen needs ~1 day to defrost</div>
          {[
            { key: 'pork_frozen', label: 'Frozen portions' },
            { key: 'pork_thawed', label: 'Thawed portions' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-stone-700">{label}</span>
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 rounded-lg border-2 border-orange-200 text-orange-600 font-bold hover:bg-orange-50 transition-colors" onClick={() => setStockEdit(s => ({ ...s, [key]: Math.max(0, (s[key] || 0) - 1) }))}>−</button>
                <span className="text-base font-bold w-6 text-center text-stone-800">{stockEdit[key] ?? 0}</span>
                <button className="w-8 h-8 rounded-lg border-2 border-orange-200 text-orange-600 font-bold hover:bg-orange-50 transition-colors" onClick={() => setStockEdit(s => ({ ...s, [key]: (s[key] || 0) + 1 }))}>+</button>
              </div>
            </div>
          ))}
          {/* Prep chain status */}
          {(() => {
            const frozen = stockEdit.pork_frozen || 0;
            const thawed = stockEdit.pork_thawed || 0;
            if (frozen === 0 && thawed === 0 && (stockEdit.lumpia_sets || 0) === 0) {
              return <div className="text-xs font-bold text-red-600 flex items-center gap-1 mt-1"><AlertTriangle size={13}/> No pork and no ready batches — can't fill lumpia orders</div>;
            }
            if (frozen > 0 && thawed === 0) {
              return <div className="text-xs text-amber-700 mt-1">🕐 Frozen pork needs ~1 day to defrost before filling can be made</div>;
            }
            if (thawed > 0) {
              return <div className="text-xs text-emerald-700 mt-1">✅ Ready to make filling (~1hr per 400 pcs / 4 batches)</div>;
            }
            return null;
          })()}
        </div>

        {/* Pancit noodles */}
        <div>
          <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-3">🍜 Pancit — Noodle Packs</div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-stone-700">Apo Q Bihon packs</span>
              <div className="text-xs text-stone-400 mt-0.5">1 pack = 1 full tray · 2 half orders</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 rounded-lg border-2 border-orange-200 text-orange-600 font-bold hover:bg-orange-50 transition-colors" onClick={() => setStockEdit(s => ({ ...s, noodle_packs: Math.max(0, (s.noodle_packs || 0) - 1) }))}>−</button>
              <span className="text-base font-bold w-6 text-center text-stone-800">{stockEdit.noodle_packs ?? 0}</span>
              <button className="w-8 h-8 rounded-lg border-2 border-orange-200 text-orange-600 font-bold hover:bg-orange-50 transition-colors" onClick={() => setStockEdit(s => ({ ...s, noodle_packs: (s.noodle_packs || 0) + 1 }))}>+</button>
            </div>
          </div>
        </div>

        <button onClick={handleUpdate} className="w-full mt-6 bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-orange-500/30 transition-all active:scale-[0.98]">
          Save Ingredients ✓
        </button>
      </div>

      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-md border border-stone-200 mt-6">
        <h3 className="font-playfair text-xl font-bold text-stone-800 mb-4 flex items-center gap-2"><Package className="text-orange-500"/> Update Stock</h3>
        <div className="space-y-4">
          {[
            { key: "lumpia_sets", label: "🥟 Lumpia Ready (batches × 100 pcs)" },
            { key: "wrapper_packs", label: "📦 Wrapper Packs on Hand" },
            { key: "pancit_full", label: "🍜 Pancit Full Trays" },
            { key: "pancit_half", label: "🍜 Pancit Half Trays" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">{label}</label>
              <div className="flex items-center gap-3">
                <button className="w-10 h-10 rounded-lg border-2 border-orange-200 text-orange-600 font-bold text-xl hover:bg-orange-50 transition-colors" onClick={() => setStockEdit(s => ({ ...s, [key]: Math.max(0, (s[key] || 0) - 1) }))}>−</button>
                <span className="text-lg font-bold w-8 text-center text-stone-800">{stockEdit[key] ?? 0}</span>
                <button className="w-10 h-10 rounded-lg border-2 border-orange-200 text-orange-600 font-bold text-xl hover:bg-orange-50 transition-colors" onClick={() => setStockEdit(s => ({ ...s, [key]: (s[key] || 0) + 1 }))}>+</button>
                <input type="number" min={0} value={stockEdit[key] ?? 0}
                  onChange={e => setStockEdit(s => ({ ...s, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-20 text-center border-2 border-stone-200 rounded-lg py-2 focus:border-orange-500 outline-none transition-colors" />
              </div>
            </div>
          ))}
        </div>
        <button onClick={handleUpdate} className="w-full mt-6 bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-orange-500/30 transition-all active:scale-[0.98]">
          Save Stock ✓
        </button>
      </div>
    </div>
  );
}
