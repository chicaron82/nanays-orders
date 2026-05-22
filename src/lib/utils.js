// ─── PRICING ─────────────────────────────────────────────────────────────────
export const LUMPIA_PRICE = { uncooked: 30, cooked: 35 };
export const PANCIT_PRICE = { full: 35, half: 17.50 };
export const DELIVERY_FEE = { pickup: 0, city: 5, outside: 10 };

export function calcTotal(order) {
  let t = 0;
  if (order.lumpia?.enabled) t += LUMPIA_PRICE[order.lumpia.style] * (order.lumpia.sets || 1);
  if (order.pancit?.enabled) {
    t += PANCIT_PRICE.full * (order.pancit.full || 0);
    t += PANCIT_PRICE.half * (order.pancit.half || 0);
  }
  t += DELIVERY_FEE[order.delivery_type] || 0;
  return t;
}

export function orderSummary(order) {
  const parts = [];
  if (order.lumpia?.enabled) parts.push(`Lumpia ×${order.lumpia.sets} (${order.lumpia.style === "cooked" ? "Cooked" : "Uncooked / Frozen"})`);
  if (order.pancit?.enabled) {
    const ps = [];
    if (order.pancit.full > 0) ps.push(`${order.pancit.full} Full`);
    if (order.pancit.half > 0) ps.push(`${order.pancit.half} Half`);
    if (ps.length) parts.push(`Pancit: ${ps.join(" + ")}`);
  }
  return parts.join(" · ") || "No items";
}

// ─── URGENCY ─────────────────────────────────────────────────────────────────
export function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

export function urgencyLabel(days) {
  if (days === null) return null;
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, bg: "#DC3545", color: "white", tailwind: "bg-red-500 text-white" };
  if (days === 0) return { text: "Today!", bg: "#DC3545", color: "white", tailwind: "bg-red-500 text-white" };
  if (days === 1) return { text: "Tomorrow", bg: "#E8651A", color: "white", tailwind: "bg-orange-500 text-white" };
  if (days <= 3) return { text: `${days}d`, bg: "#FFC107", color: "#3A1A08", tailwind: "bg-yellow-400 text-amber-900" };
  if (days <= 7) return { text: `${days}d`, bg: "#D1E7DD", color: "#0A3622", tailwind: "bg-emerald-100 text-emerald-900" };
  return { text: `${days}d`, bg: "#F0F0F0", color: "#888", tailwind: "bg-gray-100 text-gray-500" };
}

// ─── STOCK ───────────────────────────────────────────────────────────────────
export function getReserved(orders) {
  const reserved = { lumpiaSets: 0, pancitFull: 0, pancitHalf: 0 };
  orders.filter(o => o.order_status === "Ready").forEach(o => {
    if (o.lumpia?.enabled) reserved.lumpiaSets += o.lumpia.sets || 0;
    if (o.pancit?.enabled) {
      reserved.pancitFull += o.pancit.full || 0;
      reserved.pancitHalf += o.pancit.half || 0;
    }
  });
  return reserved;
}

export function getAvailable(stock, orders) {
  const reserved = getReserved(orders);
  return {
    lumpiaSets: (stock?.lumpia_sets || 0) - reserved.lumpiaSets,
    pancitFull: (stock?.pancit_full || 0) - reserved.pancitFull,
    pancitHalf: (stock?.pancit_half || 0) - reserved.pancitHalf,
  };
}

export function checkShortage(order, stock, orders, excludeId = null) {
  const filtered = excludeId ? orders.filter(o => o.id !== excludeId) : orders;
  const avail = getAvailable(stock, filtered);
  const warnings = [];
  if (order.lumpia?.enabled) {
    const needed = order.lumpia.sets || 0;
    if (needed > avail.lumpiaSets) warnings.push(`Lumpia: need ${needed} batch${needed !== 1 ? "es" : ""}, only ${Math.max(0, avail.lumpiaSets)} available`);
  }
  if (order.pancit?.enabled) {
    const nf = order.pancit.full || 0, nh = order.pancit.half || 0;
    if (nf > avail.pancitFull) warnings.push(`Pancit full trays: need ${nf}, only ${Math.max(0, avail.pancitFull)} available`);
    if (nh > avail.pancitHalf) warnings.push(`Pancit half/small trays: need ${nh}, only ${Math.max(0, avail.pancitHalf)} available`);
  }
  return warnings;
}

// ─── MAKE MORE CALCULATOR ────────────────────────────────────────────────────
export function getMakeMoreNeeds(orders, stock) {
  const pending = orders.filter(o => o.order_status === "Pending");
  const avail = getAvailable(stock, orders);
  let needLumpia = 0, needFull = 0, needHalf = 0;
  pending.forEach(o => {
    if (o.lumpia?.enabled) needLumpia += o.lumpia.sets || 0;
    if (o.pancit?.enabled) {
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
export function getRevenue(orders) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const counted = orders.filter(o => {
    const counts = o.order_status === "Fulfilled" ||
      (o.order_status === "Ready" && (o.payment_status === "Prepaid" || o.payment_status === "Deposit"));
    return counts;
  });
  const thisMonth = counted.filter(o => {
    const d = new Date(o.created_at || o.needed_date + "T00:00:00");
    return d >= monthStart;
  });
  return {
    total: counted.reduce((s, o) => s + Number(o.total ?? calcTotal(o)), 0),
    month: thisMonth.reduce((s, o) => s + Number(o.total ?? calcTotal(o)), 0),
  };
}

// ─── REPEAT CUSTOMERS ────────────────────────────────────────────────────────
export function fuzzyMatch(a, b) {
  if (!a || !b) return false;
  const norm = s => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  if (na.startsWith(nb.slice(0, 4)) || nb.startsWith(na.slice(0, 4))) return true;
  return false;
}

export function getRepeatCustomers(orders) {
  const counts = {};
  orders.forEach(o => {
    const key = (o.customer_name || "").toLowerCase().trim().slice(0, 6);
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

export function isRepeat(name, orders, currentId = null) {
  const others = currentId ? orders.filter(o => o.id !== currentId) : orders;
  return others.filter(o => fuzzyMatch(o.customer_name, name)).length >= 1;
}

export function formatDate(s) {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export function fmt(n) { return "$" + Number(n).toFixed(2); }

export const ORDER_STATUS = ["Pending", "Ready", "Fulfilled", "Cancelled"];

// ─── FULFILLABILITY WARNINGS ─────────────────────────────────────────────────
export function getIngredientWarnings(form, stock) {
  if (!stock) return [];
  const warnings = [];
  const hasLumpia = !!form.lumpia?.enabled;
  const hasPancit = !!form.pancit?.enabled;
  if (!hasLumpia && !hasPancit) return [];

  const porkFrozen = stock.pork_frozen || 0;
  const porkThawed = stock.pork_thawed || 0;
  const days = form.needed_date ? getDaysUntil(form.needed_date) : null;
  const dateLabel = form.needed_date ? formatDate(form.needed_date) : '';

  // Only hour-precise when pickup_time is set — otherwise warnings are day-granularity
  const pickupDt = (form.needed_date && form.pickup_time)
    ? new Date(`${form.needed_date}T${form.pickup_time}:00`)
    : null;
  const hoursUntil = pickupDt ? (pickupDt - Date.now()) / 3600000 : null;
  const timeLabel = form.pickup_time ? ` at ${form.pickup_time}` : '';

  // ── Shared consumables (carrots + celery) ─────────────────────────────────
  const carrotsCtx = hasLumpia && hasPancit ? 'lumpia filling and pancit'
    : hasLumpia ? 'lumpia filling' : 'pancit';
  const celeryCtx = hasLumpia && hasPancit ? 'lumpia filling and pancit'
    : hasLumpia ? 'lumpia filling' : 'pancit';

  if (stock.carrots_status === 'out') {
    warnings.push(`⚠️ Out of carrots — needed for ${carrotsCtx}. May need a store run.`);
  } else if (stock.carrots_status === 'low') {
    warnings.push('⚠️ Running low on carrots — worth grabbing more soon.');
  }

  if (stock.celery_status === 'out') {
    warnings.push(`⚠️ Out of Chinese celery — needed for ${celeryCtx}.`);
  } else if (stock.celery_status === 'low') {
    warnings.push('⚠️ Running low on Chinese celery.');
  }

  // ── Lumpia timeline warnings ───────────────────────────────────────────────
  if (hasLumpia && form.needed_date) {
    const lumpiaNeeded = form.lumpia.sets || 0;
    const lumpiaReady = stock.lumpia_sets || 0;

    if (lumpiaNeeded > lumpiaReady) {
      if (porkThawed === 0 && porkFrozen > 0) {
        // Only frozen pork — defrost takes ~1 day before filling can start
        if (days !== null && days <= 2) {
          warnings.push(`⚠️ Pork is frozen — needs a day to defrost before filling can be made. Tight timeline for ${dateLabel}.`);
        }
      } else if (porkThawed > 0) {
        // Pork is thawed but filling + rolling still needed (~2hrs total)
        const isTight = hoursUntil !== null ? hoursUntil <= 4 : days !== null && days <= 0;
        if (isTight) {
          warnings.push(`⚠️ Filling still needs to be made (~1hr) + rolling (~1hr). Tight for ${dateLabel}${timeLabel}.`);
        }
      }
    }
  }

  // ── Pancit warnings ────────────────────────────────────────────────────────
  if (hasPancit) {
    const packsNeeded = (form.pancit.full || 0) + Math.ceil((form.pancit.half || 0) / 2);
    const packsOnHand = stock.noodle_packs || 0;

    if (packsNeeded > packsOnHand) {
      warnings.push(`⚠️ Not enough noodle packs. Need ${packsNeeded}, have ${packsOnHand}.`);
    }

    // 30-minute check — only meaningful when a specific pickup time is set
    if (form.needed_date && hoursUntil !== null && hoursUntil > 0 && hoursUntil <= 0.5) {
      warnings.push(`⚠️ Pancit takes ~30 mins to make. Very tight for ${dateLabel}${timeLabel}.`);
    }
  }

  return warnings;
}
