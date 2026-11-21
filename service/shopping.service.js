/**
 * Shopping Service — Mode Belanja & Riwayat Belanja
 *
 *  - Sesi belanja (keranjang) disimpan sementara di HP ini saja, sampai
 *    "Selesai & Bayar". Bisa diisi dari scan barcode, input manual, atau
 *    Daftar Belanja.
 *  - Saat checkout: stok bertambah, harga satuan diperbarui, pengeluaran
 *    dicatat, dan satu log belanja disimpan ke database (inv_shopping).
 */
import { collection } from './storage.service.js';
import { today } from './format.service.js';
import * as inv from './inventory.service.js';
import * as fin from './finance.service.js';

const SESSION_KEY = 'rumahku-belanja-sesi';
const OLD_CART_KEY = 'rumahku-belanja-cart'; // keranjang versi v1.13 (stok sudah ditambah)
const trips = collection('inv.shopping');

/* ---------- Sesi belanja (keranjang) ---------- */

function emptySession() {
  return { store: '', items: [], startedAt: new Date().toISOString() };
}

export function getSession() {
  let s;
  try {
    s = JSON.parse(localStorage.getItem(SESSION_KEY)) || emptySession();
  } catch {
    s = emptySession();
  }
  // pindahkan keranjang lama (v1.13): stoknya sudah ditambah saat dicentang
  const old = localStorage.getItem(OLD_CART_KEY);
  if (old) {
    try {
      JSON.parse(old).forEach((c) => {
        if (!s.items.some((x) => x.itemId === c.itemId)) s.items.push({ ...c, stocked: true });
      });
    } catch { /* abaikan */ }
    localStorage.removeItem(OLD_CART_KEY);
    saveSession(s);
  }
  return s;
}

function saveSession(s) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  return s;
}

export const hasSession = () => getSession().items.length > 0;
export const sessionTotal = (s = getSession()) => s.items.reduce((t, i) => t + i.qty * (i.price || 0), 0);
export const sessionCount = (s = getSession()) => s.items.length;

/** Tambah barang ke keranjang (atau tambah jumlahnya bila sudah ada). */
export function addToSession(item, qty = 1, price) {
  const s = getSession();
  const row = s.items.find((i) => i.itemId === item.id);
  if (row) row.qty += Number(qty);
  else {
    s.items.push({
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      barcode: item.barcode || '',
      qty: Number(qty),
      price: Number(price ?? item.price) || 0,
    });
  }
  saveSession(s);
  return s.items.find((i) => i.itemId === item.id);
}

export function setSessionQty(itemId, qty) {
  const s = getSession();
  const n = Number(qty);
  s.items = n > 0 ? s.items.map((i) => (i.itemId === itemId ? { ...i, qty: n } : i)) : s.items.filter((i) => i.itemId !== itemId);
  saveSession(s);
}

export function setSessionPrice(itemId, price) {
  const s = getSession();
  s.items = s.items.map((i) => (i.itemId === itemId ? { ...i, price: Number(price) || 0 } : i));
  saveSession(s);
}

export const removeFromSession = (itemId) => setSessionQty(itemId, 0);

export function setSessionStore(store) {
  const s = getSession();
  s.store = (store || '').trim();
  saveSession(s);
}

export const discardSession = () => localStorage.removeItem(SESSION_KEY);

/** Barang di Daftar Belanja yang belum masuk keranjang. */
export function pendingFromList() {
  const inCart = new Set(getSession().items.map((i) => i.itemId));
  return inv.shoppingList().filter((i) => !inCart.has(i.id));
}

/* ---------- Checkout ---------- */

/**
 * Selesaikan belanja.
 *  - stok tiap barang bertambah (kecuali yang sudah ditambah sebelumnya)
 *  - harga satuan terbaru disimpan
 *  - pengeluaran dicatat (bila recordExpense & total > 0)
 *  - log belanja disimpan
 */
export function checkout({ total, accountId, category, date, note = '', store, recordExpense = true }) {
  const s = getSession();
  if (!s.items.length) throw new Error('Keranjang masih kosong');
  const amount = Number(total) || 0;
  if (recordExpense && amount <= 0) throw new Error('Isi total belanja dulu');
  const where = (store ?? s.store ?? '').trim();
  const day = date || today();

  s.items.forEach((i) => {
    if (!i.stocked && inv.getItem(i.itemId)) inv.stockIn(i.itemId, i.qty, where ? `Belanja di ${where}` : 'Belanja');
    inv.updateItemPrice(i.itemId, i.price);
  });

  let tx = null;
  if (recordExpense) {
    tx = fin.addTransaction({
      type: 'expense',
      amount,
      category,
      accountId,
      date: day,
      note: note || defaultNote(s.items, where),
      source: 'belanja',
    });
  }

  const trip = trips.add({
    date: day,
    store: where,
    total: amount || sessionTotal(s),
    accountId: recordExpense ? accountId : '',
    transactionId: tx?.id || '',
    items: s.items.map(({ itemId, name, unit, barcode, qty, price }) => ({ itemId, name, unit, barcode, qty, price })),
    note: (note || '').trim(),
  });
  discardSession();
  return trip;
}

export function defaultNote(items, store) {
  const names = items.map((i) => i.name);
  return `Belanja${store ? ` di ${store}` : ''}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3} lainnya` : ''}`;
}

/* ---------- Riwayat belanja ---------- */

export function listTrips({ from = '0000-01-01', to = '9999-12-31' } = {}) {
  return trips
    .filter((t) => t.date >= from && t.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export const getTrip = (id) => trips.get(id);

/** Hapus log belanja saja (stok & pengeluaran tidak berubah). */
export const deleteTrip = (id) => trips.remove(id);

/** Nama toko yang pernah dipakai (untuk pilihan cepat). */
export function recentStores(limit = 6) {
  const seen = [];
  listTrips().forEach((t) => t.store && !seen.includes(t.store) && seen.push(t.store));
  return seen.slice(0, limit);
}

/** Masukkan lagi isi belanja lama ke keranjang (belanja ulang). */
export function repeatTrip(id) {
  const t = trips.get(id);
  if (!t) return 0;
  let n = 0;
  t.items.forEach((i) => {
    const item = inv.getItem(i.itemId);
    if (item) {
      addToSession(item, i.qty, i.price);
      n++;
    }
  });
  return n;
}
