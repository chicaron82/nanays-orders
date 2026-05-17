import { useState, useEffect, useRef } from "react";

// ─── PRICING ─────────────────────────────────────────────────────────────────
const LUMPIA_PRICE = { uncooked: 30, cooked: 35 };
const PANCIT_PRICE = { full: 35, half: 17.50 };
const DELIVERY_FEE = { pickup: 0, city: 5, outside: 10 };

function calcTotal(order) {
  let t = 0;
  if (order.lumpia.enabled) t += LUMPIA_PRICE[order.lumpia.style] * (order.lumpia.sets || 1);
  if (order.pancit.enabled) {
    t += PANCIT_PRICE.full * (order.pancit.full || 0);
    t += PANCIT_PRICE.half * (order.pancit.half || 0);
  }
  t += DELIVERY_FEE[order.deliveryType] || 0;
  return t;
}

function orderSummary(order) {
  const parts = [];
  if (order.lumpia.enabled) parts.push(`Lumpia ×${order.lumpia.sets} (${order.lumpia.style === "cooked" ? "Cooked" : "Uncooked / Frozen"})`);
  if (order.pancit.enabled) {
    const ps = [];
    if (order.pancit.full > 0) ps.push(`${order.pancit.full} Full`);
    if (order.pancit.half > 0) ps.push(`${order.pancit.half} Half`);
    if (ps.length) parts.push(`Pancit: ${ps.join(" + ")}`);
  }
  return parts.join(" · ") || "No items";
}

// ─── URGENCY ─────────────────────────────────────────────────────────────────
function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

function urgencyLabel(days) {
  if (days === null) return null;
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, bg: "#DC3545", color: "white" };
  if (days === 0) return { text: "Today!", bg: "#DC3545", color: "white" };
  if (days === 1) return { text: "Tomorrow", bg: "#E8651A", color: "white" };
  if (days <= 3) return { text: `${days}d`, bg: "#FFC107", color: "#3A1A08" };
  if (days <= 7) return { text: `${days}d`, bg: "#D1E7DD", color: "#0A3622" };
  return { text: `${days}d`, bg: "#F0F0F0", color: "#888" };
}

// ─── STOCK ───────────────────────────────────────────────────────────────────
function getReserved(orders) {
  const reserved = { lumpiaSets: 0, pancitFull: 0, pancitHalf: 0 };
  orders.filter(o => o.orderStatus === "Ready").forEach(o => {
    if (o.lumpia.enabled) reserved.lumpiaSets += o.lumpia.sets || 0;
    if (o.pancit.enabled) {
      reserved.pancitFull += o.pancit.full || 0;
      reserved.pancitHalf += o.pancit.half || 0;
    }
  });
  return reserved;
}

function getAvailable(stock, orders) {
  const reserved = getReserved(orders);
  return {
    lumpiaSets: stock.lumpiaSets - reserved.lumpiaSets,
    pancitFull: stock.pancitFull - reserved.pancitFull,
    pancitHalf: stock.pancitHalf - reserved.pancitHalf,
  };
}

function checkShortage(order, stock, orders, excludeId = null) {
  const filtered = excludeId ? orders.filter(o => o.id !== excludeId) : orders;
  const avail = getAvailable(stock, filtered);
  const warnings = [];
  if (order.lumpia.enabled) {
    const needed = order.lumpia.sets || 0;
    if (needed > avail.lumpiaSets) warnings.push(`Lumpia: need ${needed} batch${needed !== 1 ? "es" : ""}, only ${Math.max(0, avail.lumpiaSets)} available`);
  }
  if (order.pancit.enabled) {
    const nf = order.pancit.full || 0, nh = order.pancit.half || 0;
    if (nf > avail.pancitFull) warnings.push(`Pancit full trays: need ${nf}, only ${Math.max(0, avail.pancitFull)} available`);
    if (nh > avail.pancitHalf) warnings.push(`Pancit half/small trays: need ${nh}, only ${Math.max(0, avail.pancitHalf)} available`);
  }
  return warnings;
}

// ─── MAKE MORE CALCULATOR ────────────────────────────────────────────────────
function getMakeMoreNeeds(orders, stock) {
  const pending = orders.filter(o => o.orderStatus === "Pending");
  const avail = getAvailable(stock, orders);
  let needLumpia = 0, needFull = 0, needHalf = 0;
  pending.forEach(o => {
    if (o.lumpia.enabled) needLumpia += o.lumpia.sets || 0;
    if (o.pancit.enabled) {
      needFull += o.pancit.full || 0;
      needHalf += o.pancit.half || 0;
    }
  });
  return {
    lumpia: { need: Math.max(0, needLumpia - avail.lumpiaSets), avail: avail.lumpiaSets, total: needLumpia },
    pancitFull: { need: Math.max(0, needFull - avail.pancitFull), avail: avail.pancitFull, total: needFull },
    pancitHalf: { need: Math.max(0, needHalf - avail.pancitHalf), avail: avail.pancitHalf, total: needHalf },
  };
}

// ─── REVENUE ─────────────────────────────────────────────────────────────────
function getRevenue(orders) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const counted = orders.filter(o =>
    o.orderStatus === "Fulfilled" ||
    (o.orderStatus === "Ready" && (o.paymentStatus === "Prepaid" || o.paymentStatus === "Deposit"))
  );
  const thisMonth = counted.filter(o => {
    const d = new Date(o.createdAt || o.neededDate + "T00:00:00");
    return d >= monthStart;
  });
  return {
    total: counted.reduce((s, o) => s + (o.total ?? calcTotal(o)), 0),
    month: thisMonth.reduce((s, o) => s + (o.total ?? calcTotal(o)), 0),
  };
}

// ─── REPEAT CUSTOMERS ────────────────────────────────────────────────────────
function fuzzyMatch(a, b) {
  if (!a || !b) return false;
  const norm = s => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  if (na.startsWith(nb.slice(0, 4)) || nb.startsWith(na.slice(0, 4))) return true;
  return false;
}

function getRepeatCustomers(orders) {
  const counts = {};
  orders.forEach(o => {
    const key = o.customerName.toLowerCase().trim().slice(0, 6);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function isRepeat(name, orders, currentId = null) {
  const others = currentId ? orders.filter(o => o.id !== currentId) : orders;
  return others.filter(o => fuzzyMatch(o.customerName, name)).length >= 1;
}

// ─── CUSTOMER PREFS ───────────────────────────────────────────────────────────
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem("nanay-prefs-v1") || "{}"); } catch { return {}; }
}

function savePrefs(prefs) {
  localStorage.setItem("nanay-prefs-v1", JSON.stringify(prefs));
}

function findPref(name, prefs) {
  if (!name || name.length < 3) return null;
  const key = Object.keys(prefs).find(k => fuzzyMatch(k, name));
  return key ? prefs[key] : null;
}

function upsertPref(name, data, prefs) {
  const key = Object.keys(prefs).find(k => fuzzyMatch(k, name)) || name.toLowerCase().trim();
  return { ...prefs, [key]: { ...data, name } };
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ORDER_STATUS = ["Pending", "Ready", "Fulfilled", "Cancelled"];
const STATUS_COLORS = {
  Pending:   { bg: "#FFF3CD", text: "#856404", border: "#FFDA6A" },
  Ready:     { bg: "#D1E7DD", text: "#0A3622", border: "#A3CFBB" },
  Fulfilled: { bg: "#CFF4FC", text: "#055160", border: "#9EEAF9" },
  Cancelled: { bg: "#F8D7DA", text: "#58151C", border: "#F1AEB5" },
};
const PAYMENT_COLORS = {
  Prepaid: { bg: "#D1E7DD", text: "#0A3622" },
  Deposit: { bg: "#FFF3CD", text: "#856404" },
  Unpaid:  { bg: "#F8D7DA", text: "#58151C" },
};
const BORDER_COLORS = { Pending: "#E8651A", Ready: "#0D6EFD", Fulfilled: "#0AA86B", Cancelled: "#DC3545" };

const initialStock = { lumpiaSets: 0, wrapperPacks: 0, pancitFull: 0, pancitHalf: 0 };

const initialForm = {
  customerName: "", contact: "",
  lumpia: { enabled: false, style: "uncooked", sets: 1 },
  pancit: { enabled: false, full: 1, half: 0 },
  neededDate: "", pickupTime: "", deliveryType: "pickup", address: "",
  paymentStatus: "Unpaid", depositAmount: "", notes: "", preferences: "",
  orderStatus: "Pending", saveCustomer: false,
};

function formatDate(s) {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function fmt(n) { return "$" + Number(n).toFixed(2); }

function loadStock() {
  try { return JSON.parse(localStorage.getItem("nanay-stock-v4") || JSON.stringify(initialStock)); } catch { return initialStock; }
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [orders, setOrders] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nanay-orders-v3") || "[]"); } catch { return []; }
  });
  const [stock, setStock] = useState(loadStock);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [formWarnings, setFormWarnings] = useState([]);
  const [filter, setFilter] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("orders");
  // stockEdit mirrors saved stock so the update form starts with real values, not zeros
  const [stockEdit, setStockEdit] = useState(loadStock);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => { localStorage.setItem("nanay-orders-v3", JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem("nanay-stock-v4", JSON.stringify(stock)); }, [stock]);
  useEffect(() => { savePrefs(prefs); }, [prefs]);

  useEffect(() => {
    if (!showForm) return;
    setFormWarnings(checkShortage(form, stock, orders, editId));
  }, [form, stock, orders, editId, showForm]);

  useEffect(() => {
    if (!form.customerName || form.customerName.length < 2) { setNameSuggestions([]); return; }
    const existing = [...new Set(orders.map(o => o.customerName))];
    const matches = existing.filter(n => fuzzyMatch(n, form.customerName) && n.toLowerCase() !== form.customerName.toLowerCase());
    setNameSuggestions(matches.slice(0, 4));
  }, [form.customerName, orders]);

  function setField(path, value) {
    setForm(f => {
      const clone = JSON.parse(JSON.stringify(f));
      const keys = path.split(".");
      let cur = clone;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return clone;
    });
  }

  function applyCustomerPref(name) {
    const pref = findPref(name, prefs);
    if (!pref) return;
    setForm(f => ({ ...f, customerName: name, contact: pref.contact || f.contact, preferences: pref.preferences || f.preferences }));
    setShowSuggestions(false);
  }

  function selectSuggestion(name) {
    setField("customerName", name);
    applyCustomerPref(name);
    setShowSuggestions(false);
  }

  function handleSubmit() {
    if (!form.customerName.trim() || !form.neededDate) return;
    if (!form.lumpia.enabled && !form.pancit.enabled) return;
    const order = { ...JSON.parse(JSON.stringify(form)), total: calcTotal(form) };
    if (form.saveCustomer) {
      setPrefs(upsertPref(form.customerName, { contact: form.contact, preferences: form.preferences }, prefs));
    }
    if (editId) {
      setOrders(o => o.map(x => x.id === editId ? { ...order, id: editId } : x));
      setEditId(null);
    } else {
      setOrders(o => [{ ...order, id: generateId(), createdAt: new Date().toISOString() }, ...o]);
    }
    setForm(initialForm);
    setShowForm(false);
  }

  function handleStatusChange(id, newStatus) {
    setOrders(prev => prev.map(x => x.id === id ? { ...x, orderStatus: newStatus } : x));
    setSelectedOrder(s => s?.id === id ? { ...s, orderStatus: newStatus } : s);
  }

  function handleEdit(order) {
    setForm(order);
    setEditId(order.id);
    setShowForm(true);
    setSelectedOrder(null);
  }

  function handleDelete(id) {
    setOrders(o => o.filter(x => x.id !== id));
    setSelectedOrder(null);
  }

  function handleExport() {
    const data = { orders, stock, prefs, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nanay-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.orders) setOrders(data.orders);
        if (data.stock) { setStock(data.stock); setStockEdit(data.stock); }
        if (data.prefs) setPrefs(data.prefs);
      } catch {
        alert("Could not read backup file. Make sure it's a Nanay's Orders backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ─── DERIVED ───────────────────────────────────────────────────────────────
  const avail = getAvailable(stock, orders);
  const reserved = getReserved(orders);
  const revenue = getRevenue(orders);
  const makeMore = getMakeMoreNeeds(orders, stock);
  const repeatMap = getRepeatCustomers(orders);

  const nextOrder = [...orders]
    .filter(o => o.orderStatus === "Pending" && o.neededDate)
    .sort((a, b) => a.neededDate.localeCompare(b.neededDate))[0];

  const repeatCount = [...new Set(orders.map(o => o.customerName.toLowerCase().trim().slice(0, 6)))]
    .filter(k => repeatMap[k] >= 2).length;

  const filtered = orders.filter(o => {
    const matchFilter = filter === "All" || o.orderStatus === filter;
    const matchSearch = o.customerName.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = ORDER_STATUS.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.orderStatus === s).length;
    return acc;
  }, {});

  const liveTotal = calcTotal(form);
  const hasItems = form.lumpia.enabled || form.pancit.enabled;

  function orderHasShortage(order) {
    if (order.orderStatus !== "Pending") return false;
    return checkShortage(order, stock, orders.filter(o => o.id !== order.id && o.orderStatus === "Ready")).length > 0;
  }

  // ─── STYLES ────────────────────────────────────────────────────────────────
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Lato:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .btn-primary { background: linear-gradient(135deg, #B5350F, #E8651A); color: white; border: none; border-radius: 10px; padding: 12px 24px; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.2s; }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(181,53,15,0.4); }
    .btn-ghost { background: transparent; border: 2px solid rgba(255,255,255,0.6); color: white; border-radius: 8px; padding: 8px 14px; font-family: 'Lato', sans-serif; font-weight: 600; font-size: 12px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
    .btn-ghost:hover { background: rgba(255,255,255,0.15); }
    .btn-ghost.active { background: white; color: #B5350F; border-color: white; }
    input, select, textarea { font-family: 'Lato', sans-serif; font-size: 14px; border: 2px solid #EDD5C0; border-radius: 8px; padding: 10px 12px; width: 100%; outline: none; color: #3A1A08; background: #FFFAF7; transition: border 0.2s; }
    input:focus, select:focus, textarea:focus { border-color: #E8651A; }
    label { font-family: 'Lato', sans-serif; font-size: 11px; font-weight: 700; color: #8B3A1A; letter-spacing: 0.5px; text-transform: uppercase; display: block; margin-bottom: 5px; }
    .order-card { background: white; border-radius: 14px; padding: 16px 18px; border-left: 5px solid #E8651A; box-shadow: 0 2px 12px rgba(124,29,10,0.1); cursor: pointer; transition: all 0.2s; margin-bottom: 12px; }
    .order-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(124,29,10,0.18); }
    .badge { display: inline-block; font-family: 'Lato', sans-serif; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(60,10,0,0.6); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal { background: white; border-radius: 20px; width: 100%; max-width: 540px; max-height: 92vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(60,10,0,0.35); }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 480px) { .field-grid { grid-template-columns: 1fr; } }
    .dish-panel { border: 2px solid #EDD5C0; border-radius: 12px; overflow: hidden; transition: border-color 0.2s; }
    .dish-panel.active { border-color: #E8651A; }
    .dish-header { display: flex; align-items: center; gap: 10px; padding: 12px 14px; cursor: pointer; background: #FFF8F4; user-select: none; }
    .dish-body { padding: 14px; background: white; display: flex; flex-direction: column; gap: 12px; }
    .toggle { width: 20px; height: 20px; border-radius: 6px; border: 2px solid #EDD5C0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; font-size: 13px; font-weight: 700; }
    .toggle.on { background: #E8651A; border-color: #E8651A; color: white; }
    .seg { display: flex; border: 2px solid #EDD5C0; border-radius: 8px; overflow: hidden; }
    .seg-btn { flex: 1; padding: 8px 6px; border: none; background: white; font-family: 'Lato', sans-serif; font-size: 12px; font-weight: 600; color: #8B3A1A; cursor: pointer; transition: all 0.15s; text-align: center; }
    .seg-btn.active { background: #E8651A; color: white; }
    .info-box { background: #FFF8F4; border-radius: 10px; padding: 10px 14px; }
    .info-box-label { font-family: 'Lato', sans-serif; font-size: 10px; font-weight: 700; color: #8B3A1A; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-box-val { font-family: 'Lato', sans-serif; font-size: 14px; font-weight: 700; color: #2A0E04; margin-top: 3px; }
    .total-bar { background: linear-gradient(135deg, #B5350F, #E8651A); border-radius: 12px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }
    .divider { height: 1px; background: #F0D9C8; margin: 14px 0; }
    .price-hint { font-family: 'Lato', sans-serif; font-size: 11px; color: #AAA; margin-top: 2px; }
    .qty-row { display: flex; align-items: center; gap: 12px; }
    .qty-btn { width: 34px; height: 34px; border-radius: 8px; border: 2px solid #EDD5C0; background: white; font-size: 20px; font-weight: 700; color: #B5350F; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .qty-val { font-family: 'Lato', sans-serif; font-size: 17px; font-weight: 700; color: #2A0E04; min-width: 28px; text-align: center; }
    .warning-box { background: #FFF3CD; border: 2px solid #FFDA6A; border-radius: 10px; padding: 12px 14px; }
    .shortage-banner { background: #FFF3CD; border-left: 4px solid #E8651A; border-radius: 0 8px 8px 0; padding: 6px 10px; margin-top: 8px; font-family: 'Lato', sans-serif; font-size: 11px; font-weight: 700; color: #856404; }
    .stock-card { background: white; border-radius: 16px; padding: 18px 20px; box-shadow: 0 2px 12px rgba(124,29,10,0.1); margin-bottom: 12px; }
    .stock-bar-track { height: 8px; background: #F0D9C8; border-radius: 4px; overflow: hidden; margin-top: 8px; }
    .tab-bar { display: flex; background: rgba(0,0,0,0.15); border-radius: 12px; padding: 4px; gap: 4px; margin: 0 16px 16px; max-width: 608px; margin-left: auto; margin-right: auto; }
    .tab-btn { flex: 1; padding: 10px; border: none; border-radius: 9px; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s; background: transparent; color: rgba(255,255,255,0.7); }
    .tab-btn.active { background: white; color: #B5350F; }
    .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0 16px 16px; max-width: 608px; margin-left: auto; margin-right: auto; }
    .dash-card { background: rgba(255,255,255,0.18); border-radius: 12px; padding: 12px 14px; }
    .dash-label { font-family: 'Lato', sans-serif; font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px; }
    .dash-val { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 900; color: white; line-height: 1.1; margin-top: 2px; }
    .dash-sub { font-family: 'Lato', sans-serif; font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 2px; }
    .urgency-pill { font-family: 'Lato', sans-serif; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; display: inline-block; }
    .repeat-badge { font-size: 13px; }
    .suggestion-box { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 2px solid #E8651A; border-radius: 0 0 10px 10px; z-index: 50; box-shadow: 0 8px 24px rgba(124,29,10,0.15); }
    .suggestion-item { padding: 10px 14px; font-family: 'Lato', sans-serif; font-size: 14px; color: #2A0E04; cursor: pointer; border-bottom: 1px solid #F0D9C8; }
    .suggestion-item:last-child { border-bottom: none; }
    .suggestion-item:hover { background: #FFF8F4; }
    .pref-box { background: #F0F8FF; border: 2px solid #B8D4E8; border-radius: 10px; padding: 10px 14px; }
    .make-more-card { background: linear-gradient(135deg, #FFF8F0, #FFF3E0); border: 2px solid #FFDA6A; border-radius: 14px; padding: 16px 18px; margin-bottom: 12px; }
  `;

  return (
    <div style={{ fontFamily: "'Georgia', serif", minHeight: "100vh", background: "linear-gradient(135deg, #7C1D0A 0%, #B5350F 40%, #E8651A 75%, #F4A435 100%)", paddingBottom: 60 }}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <div style={{ padding: "28px 20px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 38, marginBottom: 4 }}>🍜</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: "white", fontSize: 28, fontWeight: 900, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>Nanay's Orders</h1>
        <p style={{ color: "rgba(255,255,255,0.8)", fontFamily: "'Lato', sans-serif", fontSize: 12, marginTop: 3 }}>Pancit · Lumpia · Made with love 🥟</p>
      </div>

      {/* ── DASHBOARD ── */}
      <div className="dash-grid">
        <div className="dash-card" style={{ gridColumn: "span 2", background: "rgba(255,255,255,0.22)" }}>
          <div className="dash-label">💰 Revenue This Month</div>
          <div className="dash-val">{fmt(revenue.month)}</div>
          <div className="dash-sub">All time: {fmt(revenue.total)} · from fulfilled + paid orders</div>
        </div>
        <div className="dash-card">
          <div className="dash-label">🔥 Next Due</div>
          {nextOrder ? <>
            <div className="dash-val" style={{ fontSize: 16 }}>{nextOrder.customerName}</div>
            <div className="dash-sub">{formatDate(nextOrder.neededDate)}</div>
          </> : <div className="dash-val" style={{ fontSize: 16 }}>—</div>}
        </div>
        <div className="dash-card">
          <div className="dash-label">⭐ Repeat Customers</div>
          <div className="dash-val">{repeatCount}</div>
          <div className="dash-sub">ordered more than once</div>
        </div>
        <div className="dash-card">
          <div className="dash-label">⏳ Pending</div>
          <div className="dash-val">{counts.Pending || 0}</div>
          <div className="dash-sub">orders to fulfill</div>
        </div>
        <div className="dash-card">
          <div className="dash-label">✅ Ready</div>
          <div className="dash-val">{counts.Ready || 0}</div>
          <div className="dash-sub">made, awaiting pickup</div>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === "orders" ? "active" : ""}`} onClick={() => setTab("orders")}>📋 Orders</button>
        <button className={`tab-btn ${tab === "stock" ? "active" : ""}`} onClick={() => setTab("stock")}>📦 Stock</button>
      </div>

      {/* ══ ORDERS TAB ══ */}
      {tab === "orders" && <>
        <div style={{ padding: "0 16px 14px", maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
            {["All", ...ORDER_STATUS].map(s => (
              <button key={s} className={`btn-ghost ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
                {s}{s !== "All" && counts[s] != null ? ` (${counts[s]})` : ""}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input placeholder="🔍 Search by name..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
            <button className="btn-primary" onClick={() => { setForm(initialForm); setEditId(null); setShowForm(true); }}>+ New</button>
          </div>
        </div>

        <div style={{ padding: "0 16px", maxWidth: 640, margin: "0 auto" }}>
          {filtered.length === 0 && (
            <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: 16, padding: "40px 20px", textAlign: "center", boxShadow: "0 4px 24px rgba(124,29,10,0.18)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🥟</div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#B5350F", fontSize: 18, fontWeight: 700 }}>No orders yet</p>
              <p style={{ fontFamily: "'Lato', sans-serif", color: "#999", fontSize: 14, marginTop: 6 }}>Tap "+ New" to get started</p>
            </div>
          )}
          {filtered.map(order => {
            const sc = STATUS_COLORS[order.orderStatus] || STATUS_COLORS.Pending;
            const pc = PAYMENT_COLORS[order.paymentStatus] || PAYMENT_COLORS.Unpaid;
            const total = order.total ?? calcTotal(order);
            const shortage = orderHasShortage(order);
            const days = getDaysUntil(order.neededDate);
            const urgency = urgencyLabel(days);
            const repeat = isRepeat(order.customerName, orders, order.id);
            return (
              <div key={order.id} className="order-card" onClick={() => setSelectedOrder(order)}
                style={{ borderLeftColor: shortage ? "#DC3545" : (BORDER_COLORS[order.orderStatus] || "#E8651A") }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "#2A0E04" }}>{order.customerName}</div>
                      {repeat && <span className="repeat-badge" title="Repeat customer">⭐</span>}
                      {shortage && <span style={{ fontSize: 14 }} title="Stock shortage">⚠️</span>}
                    </div>
                    <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#8B3A1A", marginTop: 2 }}>{orderSummary(order)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "#AAA" }}>
                        📅 {formatDate(order.neededDate)}{order.deliveryType === "pickup" && order.pickupTime ? ` @ ${order.pickupTime}` : ""}
                      </span>
                      {urgency && order.orderStatus === "Pending" && (
                        <span className="urgency-pill" style={{ background: urgency.bg, color: urgency.color }}>{urgency.text}</span>
                      )}
                    </div>
                    {shortage && <div className="shortage-banner">⚠️ Not enough stock — make more first!</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#B5350F" }}>{fmt(total)}</div>
                    <span className="badge" style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{order.orderStatus}</span>
                    <span className="badge" style={{ background: pc.bg, color: pc.text }}>
                      {order.paymentStatus}{order.paymentStatus === "Deposit" && order.depositAmount ? ` ${fmt(order.depositAmount)}` : ""}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>}

      {/* ══ STOCK TAB ══ */}
      {tab === "stock" && (
        <div style={{ padding: "0 16px", maxWidth: 640, margin: "0 auto" }}>

          {(makeMore.lumpia.need > 0 || makeMore.pancitFull.need > 0 || makeMore.pancitHalf.need > 0) && (
            <div className="make-more-card">
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "#7C1D0A", marginBottom: 10 }}>🍳 Make More — Pending Orders Need:</div>
              {makeMore.lumpia.need > 0 && (
                <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#856404", marginBottom: 6 }}>
                  🥟 <strong>{makeMore.lumpia.need} more lumpia batch{makeMore.lumpia.need !== 1 ? "es" : ""}</strong> ({makeMore.lumpia.avail} available, {makeMore.lumpia.total} needed total)
                  {stock.wrapperPacks > 0 && (
                    <span style={{ color: makeMore.lumpia.need <= stock.wrapperPacks ? "#0AA86B" : "#DC3545", marginLeft: 6 }}>
                      · {stock.wrapperPacks} pack{stock.wrapperPacks !== 1 ? "s" : ""} on hand {makeMore.lumpia.need <= stock.wrapperPacks ? "✅ enough!" : `— short ${makeMore.lumpia.need - stock.wrapperPacks} pack${makeMore.lumpia.need - stock.wrapperPacks !== 1 ? "s" : ""} 🚨`}
                    </span>
                  )}
                  {stock.wrapperPacks === 0 && <span style={{ color: "#DC3545", marginLeft: 6 }}>· No wrappers on hand 🚨</span>}
                </div>
              )}
              {makeMore.pancitFull.need > 0 && (
                <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#856404", marginBottom: 6 }}>
                  🍜 <strong>{makeMore.pancitFull.need} more full tray{makeMore.pancitFull.need !== 1 ? "s" : ""}</strong> ({makeMore.pancitFull.avail} available, {makeMore.pancitFull.total} needed)
                </div>
              )}
              {makeMore.pancitHalf.need > 0 && (
                <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#856404" }}>
                  🍜 <strong>{makeMore.pancitHalf.need} more half/small tray{makeMore.pancitHalf.need !== 1 ? "s" : ""}</strong> ({makeMore.pancitHalf.avail} available, {makeMore.pancitHalf.total} needed)
                </div>
              )}
            </div>
          )}

          {(makeMore.lumpia.need === 0 && makeMore.pancitFull.need === 0 && makeMore.pancitHalf.need === 0) && orders.filter(o => o.orderStatus === "Pending").length > 0 && (
            <div style={{ background: "#D1E7DD", border: "2px solid #A3CFBB", borderRadius: 14, padding: "14px 18px", marginBottom: 12 }}>
              <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, fontWeight: 700, color: "#0A3622" }}>✅ All pending orders are covered by current stock!</div>
            </div>
          )}

          {[
            { label: "🥟 Lumpia Ready", avail: avail.lumpiaSets, reserved: reserved.lumpiaSets, total: stock.lumpiaSets },
            { label: "📦 Wrapper Packs on Hand", avail: stock.wrapperPacks, reserved: 0, total: Math.max(stock.wrapperPacks, 1), isWrapper: true },
            { label: "🍜 Pancit Full Trays", avail: avail.pancitFull, reserved: reserved.pancitFull, total: stock.pancitFull },
            { label: "🍜 Pancit Half / Small Trays", avail: avail.pancitHalf, reserved: reserved.pancitHalf, total: stock.pancitHalf },
          ].map(item => {
            const { label, avail: a, reserved: r, total: t, isWrapper } = item;
            const level = a <= 0 ? "danger" : a <= 2 ? "warn" : "ok";
            const barColor = level === "danger" ? "#DC3545" : level === "warn" ? "#E8651A" : "#0AA86B";
            const pct = t > 0 ? Math.min(100, Math.max(0, (a / t) * 100)) : 0;
            return (
              <div key={label} className="stock-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700, fontSize: 14, color: "#2A0E04" }}>{label}</div>
                    <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#888", marginTop: 3 }}>
                      {!isWrapper && r > 0 ? `${r} in Ready orders · ` : ""}{isWrapper ? "" : `${t} on hand`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: level === "danger" ? "#DC3545" : level === "warn" ? "#E8651A" : "#0AA86B", lineHeight: 1 }}>{a}</div>
                    <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "#AAA" }}>{isWrapper ? "packs" : "available"}</div>
                  </div>
                </div>
                {!isWrapper && <div className="stock-bar-track"><div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 4, transition: "width 0.4s" }} /></div>}
                {isWrapper && stock.wrapperPacks > 0 && <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#0AA86B", marginTop: 6, fontWeight: 700 }}>✅ Can make {stock.wrapperPacks} more batch{stock.wrapperPacks !== 1 ? "es" : ""} of 100 pcs</div>}
                {isWrapper && stock.wrapperPacks === 0 && <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, fontWeight: 700, color: "#DC3545", marginTop: 6 }}>🚨 No wrappers — need to buy more!</div>}
                {!isWrapper && level === "danger" && <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, fontWeight: 700, color: "#DC3545", marginTop: 6 }}>🚨 Out of stock — time to make more!</div>}
                {!isWrapper && level === "warn" && <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, fontWeight: 700, color: "#E8651A", marginTop: 6 }}>⚠️ Running low — consider making more soon</div>}
              </div>
            );
          })}

          <div className="stock-card">
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#2A0E04", marginBottom: 14 }}>Update Stock on Hand</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { key: "lumpiaSets", label: "🥟 Lumpia Ready (batches × 100 pcs)" },
                { key: "wrapperPacks", label: "📦 Wrapper Packs on Hand (Spring Home 50pc)" },
                { key: "pancitFull", label: "🍜 Pancit Full Trays" },
                { key: "pancitHalf", label: "🍜 Pancit Half / Small Trays" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label>{label}</label>
                  <div className="qty-row">
                    <button className="qty-btn" onClick={() => setStockEdit(s => ({ ...s, [key]: Math.max(0, (s[key] || 0) - 1) }))}>−</button>
                    <span className="qty-val">{stockEdit[key] ?? 0}</span>
                    <button className="qty-btn" onClick={() => setStockEdit(s => ({ ...s, [key]: (s[key] || 0) + 1 }))}>+</button>
                    <input type="number" min={0} value={stockEdit[key] ?? 0}
                      onChange={e => setStockEdit(s => ({ ...s, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                      style={{ width: 70, textAlign: "center", flexShrink: 0 }} />
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-primary" style={{ marginTop: 16, width: "100%" }} onClick={() => setStock({ ...stockEdit })}>
              Save Stock ✓
            </button>
            <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "#AAA", textAlign: "center", marginTop: 8 }}>
              Stock goes down automatically when orders are marked Ready
            </div>
          </div>

          <div className="stock-card">
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#2A0E04", marginBottom: 6 }}>💾 Backup</div>
            <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#888", marginBottom: 14 }}>Save a copy of all orders, stock, and customer info to your device. Restore anytime from a backup file.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleExport}>⬇️ Save Backup</button>
              <label style={{ flex: 1, margin: 0 }}>
                <div className="btn-primary" style={{ textAlign: "center", cursor: "pointer" }}>⬆️ Restore</div>
                <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ══ DETAIL MODAL ══ */}
      {selectedOrder && (() => {
        const o = selectedOrder;
        const total = o.total ?? calcTotal(o);
        const deposit = Number(o.depositAmount) || 0;
        const balance = o.paymentStatus === "Prepaid" ? 0 : o.paymentStatus === "Deposit" ? total - deposit : total;
        const detailShortage = checkShortage(o, stock, orders.filter(x => x.id !== o.id && x.orderStatus === "Ready"));
        const days = getDaysUntil(o.neededDate);
        const urgency = urgencyLabel(days);
        const repeat = isRepeat(o.customerName, orders, o.id);
        return (
          <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div style={{ background: "linear-gradient(135deg, #B5350F, #E8651A)", padding: "22px 24px 18px", borderRadius: "20px 20px 0 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", color: "white", fontSize: 22, fontWeight: 900 }}>{o.customerName}</div>
                      {repeat && <span title="Repeat customer" style={{ fontSize: 18 }}>⭐</span>}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontFamily: "'Lato', sans-serif", fontSize: 13, marginTop: 3 }}>{o.contact || "No contact info"}</div>
                    {o.preferences && <div style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Lato', sans-serif", fontSize: 12, marginTop: 4 }}>💛 {o.preferences}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <button onClick={() => setSelectedOrder(null)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: "50%", width: 32, height: 32, fontSize: 18, cursor: "pointer", fontWeight: 700 }}>×</button>
                    {urgency && o.orderStatus === "Pending" && <span className="urgency-pill" style={{ background: urgency.bg, color: urgency.color }}>{urgency.text}</span>}
                  </div>
                </div>
              </div>
              <div style={{ padding: "20px 24px 24px" }}>
                {detailShortage.length > 0 && o.orderStatus === "Pending" && (
                  <div className="warning-box" style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, fontWeight: 700, color: "#856404", marginBottom: 6 }}>⚠️ Stock Shortage — Cannot Fulfill Yet</div>
                    {detailShortage.map((w, i) => <div key={i} style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#856404", marginTop: 3 }}>• {w}</div>)}
                    <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "#AA8000", marginTop: 8 }}>🍳 Make more before marking Ready</div>
                  </div>
                )}
                {o.lumpia.enabled && (
                  <div className="info-box" style={{ marginBottom: 10 }}>
                    <div className="info-box-label">🥟 Lumpia</div>
                    <div className="info-box-val">{o.lumpia.sets} batch{o.lumpia.sets !== 1 ? "es" : ""} (×100 pcs) · {o.lumpia.style === "cooked" ? "Cooked" : "Uncooked / Frozen"} · {fmt(LUMPIA_PRICE[o.lumpia.style] * o.lumpia.sets)}</div>
                  </div>
                )}
                {o.pancit.enabled && (
                  <div className="info-box" style={{ marginBottom: 10 }}>
                    <div className="info-box-label">🍜 Pancit</div>
                    <div className="info-box-val">
                      {[o.pancit.full > 0 && `${o.pancit.full} Full (${fmt(PANCIT_PRICE.full * o.pancit.full)})`, o.pancit.half > 0 && `${o.pancit.half} Half/Small (${fmt(PANCIT_PRICE.half * o.pancit.half)})`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <div className="info-box" style={{ flex: 1 }}>
                    <div className="info-box-label">📅 Needed By</div>
                    <div className="info-box-val">{formatDate(o.neededDate)}{o.deliveryType === "pickup" && o.pickupTime ? ` @ ${o.pickupTime}` : ""}</div>
                  </div>
                  <div className="info-box" style={{ flex: 1 }}>
                    <div className="info-box-label">🚗 Delivery</div>
                    <div className="info-box-val">{o.deliveryType === "pickup" ? "Pickup" : o.deliveryType === "city" ? "City (+$5)" : "Outside (+$10)"}</div>
                  </div>
                </div>
                {o.deliveryType !== "pickup" && o.address && (
                  <div className="info-box" style={{ marginBottom: 12 }}>
                    <div className="info-box-label">📍 Address</div>
                    <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#2A0E04", marginTop: 3 }}>{o.address}</div>
                  </div>
                )}
                <div className="total-bar" style={{ marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: "'Lato', sans-serif", color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 700 }}>Order Total</div>
                    {o.paymentStatus === "Deposit" && <div style={{ fontFamily: "'Lato', sans-serif", color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>Deposit: {fmt(deposit)} · Balance: {fmt(balance)}</div>}
                    {o.paymentStatus === "Prepaid" && <div style={{ fontFamily: "'Lato', sans-serif", color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>✓ Fully Paid</div>}
                    {o.paymentStatus === "Unpaid" && <div style={{ fontFamily: "'Lato', sans-serif", color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>Balance Due: {fmt(total)}</div>}
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", color: "white", fontSize: 28, fontWeight: 900 }}>{fmt(total)}</div>
                </div>
                {o.notes && (
                  <div className="info-box" style={{ marginBottom: 12 }}>
                    <div className="info-box-label">📝 Notes</div>
                    <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#2A0E04", marginTop: 3 }}>{o.notes}</div>
                  </div>
                )}
                <div className="divider" />
                <div style={{ marginBottom: 14 }}>
                  <label>Update Status</label>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "#AAA", marginBottom: 8 }}>Stock adjusts automatically when marked Ready</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {ORDER_STATUS.map(s => {
                      const c = STATUS_COLORS[s];
                      const isActive = o.orderStatus === s;
                      const isReadyWarn = s === "Ready" && detailShortage.length > 0 && o.orderStatus === "Pending";
                      return (
                        <button key={s} onClick={() => handleStatusChange(o.id, s)}
                          style={{ padding: "7px 14px", borderRadius: 20, border: `2px solid ${isReadyWarn ? "#DC3545" : c.border}`, background: isActive ? c.bg : "white", color: isReadyWarn ? "#DC3545" : c.text, fontFamily: "'Lato', sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: isActive ? 1 : 0.65, transition: "all 0.15s" }}>
                          {isReadyWarn ? "⚠️ Ready" : s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleEdit(o)}>✏️ Edit</button>
                  <button onClick={() => handleDelete(o.id)} style={{ flex: 1, background: "transparent", border: "2px solid #F8D7DA", color: "#DC3545", borderRadius: 10, padding: "12px", fontFamily: "'Lato', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>🗑️ Delete</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ FORM MODAL ══ */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ background: "linear-gradient(135deg, #B5350F, #E8651A)", padding: "22px 24px 18px", borderRadius: "20px 20px 0 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", color: "white", fontSize: 20, fontWeight: 900 }}>{editId ? "Edit Order" : "New Order 🍜"}</div>
                <button onClick={() => setShowForm(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: "50%", width: 32, height: 32, fontSize: 18, cursor: "pointer", fontWeight: 700 }}>×</button>
              </div>
            </div>
            <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

              <div className="field-grid">
                <div style={{ position: "relative" }} ref={nameRef}>
                  <label>Customer Name *</label>
                  <input
                    value={form.customerName}
                    onChange={e => { setField("customerName", e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="Tita Cora"
                  />
                  {showSuggestions && nameSuggestions.length > 0 && (
                    <div className="suggestion-box">
                      {nameSuggestions.map(name => (
                        <div key={name} className="suggestion-item" onMouseDown={() => selectSuggestion(name)}>
                          {isRepeat(name, orders) ? "⭐ " : ""}{name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label>Contact</label>
                  <input value={form.contact} onChange={e => setField("contact", e.target.value)} placeholder="204-555-0100" />
                </div>
              </div>

              {findPref(form.customerName, prefs)?.preferences && (
                <div className="pref-box">
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, fontWeight: 700, color: "#1A5276", textTransform: "uppercase", letterSpacing: "0.5px" }}>💛 Saved Preferences</div>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#1A3A4A", marginTop: 4 }}>{findPref(form.customerName, prefs).preferences}</div>
                </div>
              )}

              <div className={`dish-panel ${form.lumpia.enabled ? "active" : ""}`}>
                <div className="dish-header" onClick={() => setField("lumpia.enabled", !form.lumpia.enabled)}>
                  <div className={`toggle ${form.lumpia.enabled ? "on" : ""}`}>{form.lumpia.enabled ? "✓" : ""}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700, color: "#2A0E04", fontSize: 14 }}>🥟 Lumpia (100 pcs per batch)</div>
                    <div className="price-hint">Uncooked / Frozen $30 · Cooked $35 · {avail.lumpiaSets} batch{avail.lumpiaSets !== 1 ? "es" : ""} available</div>
                  </div>
                  {form.lumpia.enabled && <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, color: "#B5350F", fontSize: 16 }}>{fmt(LUMPIA_PRICE[form.lumpia.style] * (form.lumpia.sets || 1))}</div>}
                </div>
                {form.lumpia.enabled && (
                  <div className="dish-body">
                    <div>
                      <label>Style</label>
                      <div className="seg">
                        {[["uncooked", "Uncooked / Frozen — $30"], ["cooked", "Cooked — $35"]].map(([val, lbl]) => (
                          <button key={val} className={`seg-btn ${form.lumpia.style === val ? "active" : ""}`} onClick={() => setField("lumpia.style", val)}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label>Batches (× 100 pcs)</label>
                      <div className="qty-row">
                        <button className="qty-btn" onClick={() => setField("lumpia.sets", Math.max(1, (form.lumpia.sets || 1) - 1))}>−</button>
                        <span className="qty-val">{form.lumpia.sets || 1}</span>
                        <button className="qty-btn" onClick={() => setField("lumpia.sets", (form.lumpia.sets || 1) + 1)}>+</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={`dish-panel ${form.pancit.enabled ? "active" : ""}`}>
                <div className="dish-header" onClick={() => setField("pancit.enabled", !form.pancit.enabled)}>
                  <div className={`toggle ${form.pancit.enabled ? "on" : ""}`}>{form.pancit.enabled ? "✓" : ""}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700, color: "#2A0E04", fontSize: 14 }}>🍜 Pancit Tray</div>
                    <div className="price-hint">Full $35 · Half / Small $17.50 · {avail.pancitFull}F / {avail.pancitHalf}H available</div>
                  </div>
                  {form.pancit.enabled && (
                    <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, color: "#B5350F", fontSize: 16 }}>
                      {fmt(PANCIT_PRICE.full * (form.pancit.full || 0) + PANCIT_PRICE.half * (form.pancit.half || 0))}
                    </div>
                  )}
                </div>
                {form.pancit.enabled && (
                  <div className="dish-body">
                    <div>
                      <label>Full Trays — $35 each</label>
                      <div className="qty-row">
                        <button className="qty-btn" onClick={() => setField("pancit.full", Math.max(0, (form.pancit.full || 0) - 1))}>−</button>
                        <span className="qty-val">{form.pancit.full || 0}</span>
                        <button className="qty-btn" onClick={() => setField("pancit.full", (form.pancit.full || 0) + 1)}>+</button>
                      </div>
                    </div>
                    <div>
                      <label>Half / Small Trays — $17.50 each</label>
                      <div className="qty-row">
                        <button className="qty-btn" onClick={() => setField("pancit.half", Math.max(0, (form.pancit.half || 0) - 1))}>−</button>
                        <span className="qty-val">{form.pancit.half || 0}</span>
                        <button className="qty-btn" onClick={() => setField("pancit.half", (form.pancit.half || 0) + 1)}>+</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {formWarnings.length > 0 && (
                <div className="warning-box">
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, fontWeight: 700, color: "#856404", marginBottom: 4 }}>⚠️ Stock Shortage</div>
                  {formWarnings.map((w, i) => <div key={i} style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#856404" }}>• {w}</div>)}
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "#AA8000", marginTop: 6 }}>You can still save — make more before marking Ready</div>
                </div>
              )}

              <div className="field-grid">
                <div>
                  <label>Date Needed *</label>
                  <input type="date" value={form.neededDate} onChange={e => setField("neededDate", e.target.value)} />
                </div>
                <div>
                  <label>Delivery Type</label>
                  <select value={form.deliveryType} onChange={e => setField("deliveryType", e.target.value)}>
                    <option value="pickup">🏠 Pickup (free)</option>
                    <option value="city">🚗 City Delivery (+$5)</option>
                    <option value="outside">🛣️ Outside City (+$10)</option>
                  </select>
                </div>
              </div>

              {form.deliveryType === "pickup" && (
                <div>
                  <label>Pickup Time</label>
                  <input type="time" value={form.pickupTime} onChange={e => setField("pickupTime", e.target.value)} />
                </div>
              )}

              {form.deliveryType !== "pickup" && (
                <div>
                  <label>Delivery Address</label>
                  <input value={form.address} onChange={e => setField("address", e.target.value)} placeholder="123 Main St, Winnipeg" />
                </div>
              )}

              <div className="field-grid">
                <div>
                  <label>Payment Status</label>
                  <select value={form.paymentStatus} onChange={e => setField("paymentStatus", e.target.value)}>
                    <option>Unpaid</option>
                    <option>Deposit</option>
                    <option>Prepaid</option>
                  </select>
                </div>
                {form.paymentStatus === "Deposit" && (
                  <div>
                    <label>Deposit Amount ($)</label>
                    <input type="number" value={form.depositAmount} onChange={e => setField("depositAmount", e.target.value)} placeholder="20" />
                  </div>
                )}
              </div>

              <div>
                <label>Customer Preferences (saved for next time)</label>
                <input value={form.preferences} onChange={e => setField("preferences", e.target.value)} placeholder="Sweet chili sauce · no onions · extra crispy..." />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, background: form.saveCustomer ? "#D1E7DD" : "#FFF8F4", border: `2px solid ${form.saveCustomer ? "#A3CFBB" : "#EDD5C0"}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", transition: "all 0.2s" }}
                onClick={() => setField("saveCustomer", !form.saveCustomer)}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${form.saveCustomer ? "#0AA86B" : "#EDD5C0"}`, background: form.saveCustomer ? "#0AA86B" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                  {form.saveCustomer && <span style={{ color: "white", fontSize: 13, fontWeight: 900 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, fontWeight: 700, color: form.saveCustomer ? "#0A3622" : "#2A0E04" }}>Save this customer</div>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: form.saveCustomer ? "#0A3622" : "#AAA", marginTop: 1 }}>Preferences & contact will load automatically next time</div>
                </div>
              </div>

              <div>
                <label>Order Notes</label>
                <textarea value={form.notes} onChange={e => setField("notes", e.target.value)} rows={2} placeholder="Special instructions for this order..." style={{ resize: "vertical" }} />
              </div>

              {hasItems && (
                <div className="total-bar">
                  <div>
                    <div style={{ fontFamily: "'Lato', sans-serif", color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 700 }}>Order Total</div>
                    {form.deliveryType !== "pickup" && (
                      <div style={{ fontFamily: "'Lato', sans-serif", color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>incl. {form.deliveryType === "city" ? "$5" : "$10"} delivery fee</div>
                    )}
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", color: "white", fontSize: 28, fontWeight: 900 }}>{fmt(liveTotal)}</div>
                </div>
              )}

              <button className="btn-primary" onClick={handleSubmit}
                style={{ padding: "14px", fontSize: 16, opacity: (!form.customerName.trim() || !form.neededDate || !hasItems) ? 0.5 : 1 }}>
                {editId ? "Save Changes ✓" : "Add Order 🎉"}
              </button>
              {!hasItems && <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#CC6633", textAlign: "center", marginTop: -8 }}>Select at least one dish to save</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
