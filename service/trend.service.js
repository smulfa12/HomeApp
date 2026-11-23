/**
 * Trend Service — data grafik: pengeluaran per bulan & riwayat harga barang.
 * Harga diambil dari riwayat Shopping Mode (setiap belanja mencatat harga per barang).
 */
import { thisMonth, addMonths } from './format.service.js';
import * as fin from './finance.service.js';
import * as shop from './shopping.service.js';
import * as inv from './inventory.service.js';

/* ---------- Pengeluaran per bulan ---------- */

/** N bulan terakhir (termasuk bulan ini): [{ month:'2026-11', total, byCategory:[{category, amount}] }] */
export function monthlyExpense(months = 6, category = '') {
  const end = thisMonth();
  const start = addMonths(end, -(months - 1));
  const rows = fin.listTransactions({ type: 'expense', from: `${start}-01`, to: `${end}-31` }).filter((t) => !category || t.category === category);
  const out = [];
  for (let i = 0; i < months; i++) {
    const month = addMonths(start, i);
    const inMonth = rows.filter((t) => t.date.startsWith(month));
    const byCat = {};
    inMonth.forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) + t.amount));
    out.push({
      month,
      total: fin.total(inMonth),
      count: inMonth.length,
      byCategory: Object.entries(byCat).map(([c, amount]) => ({ category: c, amount })).sort((a, b) => b.amount - a.amount),
    });
  }
  return out;
}

/** Kategori yang pernah dipakai di rentang bulan tersebut (urut terbesar). */
export function expenseCategories(months = 6) {
  const sum = {};
  monthlyExpense(months).forEach((m) => m.byCategory.forEach((c) => (sum[c.category] = (sum[c.category] || 0) + c.amount)));
  return Object.entries(sum).sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/* ---------- Riwayat harga ---------- */

const keyOf = (i) => i.itemId || `name:${(i.name || '').trim().toLowerCase()}`;

/** Semua catatan harga dari riwayat belanja, dikelompokkan per barang. */
function priceRecords() {
  const map = new Map();
  shop.listTrips().forEach((trip) =>
    (trip.items || []).forEach((i) => {
      if (!(Number(i.price) > 0)) return;
      const k = keyOf(i);
      if (!map.has(k)) map.set(k, { key: k, name: i.name, unit: i.unit || '', points: [] });
      map.get(k).points.push({ date: trip.date, price: Number(i.price), store: trip.store || '', qty: Number(i.qty) || 0 });
    })
  );
  map.forEach((r) => {
    const item = r.key.startsWith('name:') ? null : inv.getItem(r.key);
    if (item) {
      r.name = item.name;
      r.unit = item.unit || r.unit;
    }
    r.points.sort((a, b) => a.date.localeCompare(b.date));
  });
  return [...map.values()];
}

/** Barang yang punya catatan harga, beserta ringkasan perubahan harga. */
export function pricedItems() {
  return priceRecords()
    .map((r) => {
      const first = r.points[0].price;
      const last = r.points[r.points.length - 1].price;
      const prices = r.points.map((p) => p.price);
      return {
        ...r,
        first,
        last,
        min: Math.min(...prices),
        max: Math.max(...prices),
        change: first ? Math.round(((last - first) / first) * 1000) / 10 : 0,
        cheapest: r.points.reduce((a, b) => (b.price < a.price ? b : a)),
      };
    })
    .sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
}

/** Barang dengan kenaikan / penurunan harga terbesar (minimal 2 catatan). */
export function priceMovers(limit = 5) {
  const list = pricedItems().filter((r) => r.points.length >= 2 && r.change !== 0);
  return {
    up: list.filter((r) => r.change > 0).sort((a, b) => b.change - a.change).slice(0, limit),
    down: list.filter((r) => r.change < 0).sort((a, b) => a.change - b.change).slice(0, limit),
  };
}
