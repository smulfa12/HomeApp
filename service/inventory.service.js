/**
 * Inventory Service
 * Semua logika data barang rumah: master barang, stok masuk/keluar,
 * stock opname, daftar belanja, dan pengelompokan per lokasi.
 */
import { collection, load, save } from './storage.service.js';
import { today, daysUntil } from './format.service.js';

const items = collection('inv.items');
const movements = collection('inv.movements');

/* ---------- Master data: kategori & lokasi ---------- */

const DEFAULT_CATEGORIES = [
  { name: 'Makanan', emoji: '🍚', perishable: true },
  { name: 'Minuman', emoji: '🧃', perishable: true },
  { name: 'Bumbu Dapur', emoji: '🧂', perishable: true },
  { name: 'Susu & Bayi', emoji: '🍼', perishable: true },
  { name: 'Obat-obatan', emoji: '💊', perishable: true },
  { name: 'Kebersihan', emoji: '🧽', perishable: false },
  { name: 'Perawatan Diri', emoji: '🧴', perishable: false },
  { name: 'Peralatan Rumah', emoji: '🔧', perishable: false },
  { name: 'Lainnya', emoji: '📦', perishable: false },
];

const DEFAULT_LOCATIONS = ['Dapur', 'Kulkas', 'Freezer', 'Lemari Makan', 'Kamar Mandi', 'Gudang', 'Kamar Tidur'];
const DEFAULT_UNITS = ['pcs', 'bungkus', 'botol', 'kaleng', 'kg', 'gram', 'liter', 'ml', 'pak', 'dus', 'sachet'];

export const getCategories = () => load('inv.categories', DEFAULT_CATEGORIES);
export const getUnits = () => DEFAULT_UNITS;

export function getLocations() {
  const saved = load('inv.locations', DEFAULT_LOCATIONS);
  const used = items.all().map((i) => i.location).filter(Boolean);
  return [...new Set([...saved, ...used])];
}

export function addLocation(name) {
  const list = load('inv.locations', DEFAULT_LOCATIONS);
  if (name && !list.includes(name)) save('inv.locations', [...list, name]);
}

export function categoryInfo(name) {
  return getCategories().find((c) => c.name === name) || { name: name || 'Lainnya', emoji: '📦', perishable: false };
}

export const isPerishable = (category) => categoryInfo(category).perishable;

/* ---------- Barang ---------- */

export const listItems = () => items.all().sort((a, b) => a.name.localeCompare(b.name));
export const getItem = (id) => items.get(id);
export const findByBarcode = (code) => (code ? items.find((i) => i.barcode === String(code).trim()) : null);

function logMovement(item, type, qty, before, after, note = '') {
  movements.add({ itemId: item.id, itemName: item.name, type, qty, before, after, date: today(), note });
}

/**
 * Simpan barang. Jika `id` ada → update data barang.
 * Jika barcode sudah terdaftar → stok ditambahkan ke barang tersebut.
 */
export function saveItem(data) {
  const clean = {
    name: data.name.trim(),
    barcode: (data.barcode || '').trim(),
    category: data.category || 'Lainnya',
    unit: data.unit || 'pcs',
    minStock: Number(data.minStock) || 0,
    location: (data.location || '').trim(),
    expiry: isPerishable(data.category) ? data.expiry || '' : '',
    price: Number(data.price) || 0,
  };
  if (clean.location) addLocation(clean.location);

  if (data.id) {
    const prev = items.get(data.id);
    const qty = Number(data.qty) || 0;
    const updated = items.update(data.id, { ...clean, qty });
    if (prev && prev.qty !== qty) logMovement(updated, 'adjust', qty - prev.qty, prev.qty, qty, 'Edit barang');
    return { item: updated, mode: 'updated' };
  }

  const existing = findByBarcode(clean.barcode);
  const addQty = Number(data.qty) || 0;
  if (existing) {
    const after = existing.qty + addQty;
    const updated = items.update(existing.id, { ...clean, qty: after });
    logMovement(updated, 'in', addQty, existing.qty, after, 'Tambah stok');
    return { item: updated, mode: 'restocked' };
  }

  const created = items.add({ ...clean, qty: addQty });
  logMovement(created, 'in', addQty, 0, addQty, 'Barang baru');
  return { item: created, mode: 'created' };
}

export function deleteItem(id) {
  items.remove(id);
}

export function stockIn(id, qty, note = 'Restock') {
  const item = items.get(id);
  if (!item) throw new Error('Barang tidak ditemukan');
  const after = item.qty + Number(qty);
  const updated = items.update(id, { qty: after });
  logMovement(updated, 'in', Number(qty), item.qty, after, note);
  return updated;
}

export function stockOut(id, qty, note = 'Pemakaian') {
  const item = items.get(id);
  if (!item) throw new Error('Barang tidak ditemukan');
  const n = Number(qty);
  if (n <= 0) throw new Error('Jumlah harus lebih dari 0');
  if (n > item.qty) throw new Error(`Stok tidak cukup (sisa ${item.qty} ${item.unit})`);
  const after = item.qty - n;
  const updated = items.update(id, { qty: after });
  logMovement(updated, 'out', n, item.qty, after, note);
  return updated;
}

/** Stock opname: `counts` = { [itemId]: jumlahFisik } */
export function applyOpname(counts) {
  let changed = 0;
  Object.entries(counts).forEach(([id, actual]) => {
    const item = items.get(id);
    if (!item || actual === '' || actual == null) return;
    const n = Number(actual);
    if (n !== item.qty) {
      items.update(id, { qty: n });
      logMovement(item, 'opname', n - item.qty, item.qty, n, 'Stock opname');
      changed++;
    }
  });
  save('inv.lastOpname', today());
  return changed;
}

export const lastOpnameDate = () => load('inv.lastOpname', null);

export function recentMovements(limit = 20, type) {
  return movements
    .all()
    .filter((m) => !type || m.type === type)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/* ---------- Turunan: belanja, lokasi, kadaluarsa ---------- */

/** Barang dengan stok di bawah minimum (qty < minStock). */
export function shoppingList() {
  return listItems()
    .filter((i) => i.minStock > 0 && i.qty < i.minStock)
    .map((i) => ({ ...i, needed: Math.max(i.minStock - i.qty, 1) }));
}

export function groupByLocation() {
  const groups = {};
  listItems().forEach((i) => {
    const key = i.location || 'Belum ditentukan';
    (groups[key] ||= []).push(i);
  });
  return groups;
}

export function expiryStatus(item) {
  if (!item.expiry) return null;
  const d = daysUntil(item.expiry);
  if (d < 0) return { level: 'expired', days: d, label: `Kadaluarsa ${-d} hari lalu` };
  if (d === 0) return { level: 'expired', days: d, label: 'Kadaluarsa hari ini' };
  if (d <= 7) return { level: 'soon', days: d, label: `${d} hari lagi` };
  if (d <= 30) return { level: 'near', days: d, label: `${d} hari lagi` };
  return { level: 'ok', days: d, label: `${d} hari lagi` };
}

export function expiringItems(withinDays = 7) {
  return listItems()
    .filter((i) => i.expiry && i.qty > 0 && daysUntil(i.expiry) <= withinDays)
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
}

export function summary() {
  const all = listItems();
  return {
    totalItems: all.length,
    lowStock: shoppingList().length,
    expiring: expiringItems(7).length,
    locations: Object.keys(groupByLocation()).length,
  };
}
