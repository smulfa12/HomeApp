/**
 * Notification Service — pengingat di HP:
 *  - 📅 tagihan jatuh tempo hari ini / besok / terlambat
 *  - ⏰ kegiatan yang mulai ±15 menit lagi
 *  - 🥫 barang segera kedaluwarsa (≤ 3 hari)
 *  - 🛒 stok menipis
 *
 * Dicek saat aplikasi dibuka, saat kembali ke aplikasi, dan tiap menit selama
 * aplikasi masih terbuka / di latar belakang. Saat aplikasi ditutup penuh,
 * HP tidak bisa diberi pengingat tanpa server push.
 * Pengaturan disimpan per HP (bukan di database).
 */
import { today } from './format.service.js';
import { can } from './access.service.js';
import * as inv from './inventory.service.js';
import * as act from './activity.service.js';
import * as bill from './bill.service.js';

const SETTINGS_KEY = 'rumahku-notify';
const SENT_KEY = 'rumahku-notified';
export const TYPES = [
  { key: 'bills', label: 'Tagihan jatuh tempo', icon: '📅', menu: 'finance' },
  { key: 'activity', label: 'Kegiatan akan mulai (15 menit sebelumnya)', icon: '⏰', menu: 'kegiatan' },
  { key: 'expiry', label: 'Barang segera kedaluwarsa', icon: '🥫', menu: 'inventory' },
  { key: 'stock', label: 'Stok menipis (sekali sehari)', icon: '🛒', menu: 'inventory' },
];

export const isSupported = () => 'Notification' in window;
export const permission = () => (isSupported() ? Notification.permission : 'unsupported');

export function getSettings() {
  try {
    return { enabled: false, types: { bills: true, activity: true, expiry: true, stock: true }, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return { enabled: false, types: { bills: true, activity: true, expiry: true, stock: true } };
  }
}
export const saveSettings = (s) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));

/** Nyalakan: minta izin ke browser. Mengembalikan true bila diizinkan. */
export async function enable() {
  if (!isSupported()) throw new Error('Browser ini belum mendukung notifikasi');
  const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (result !== 'granted') throw new Error('Izin notifikasi ditolak. Buka pengaturan situs di browser untuk mengizinkan.');
  saveSettings({ ...getSettings(), enabled: true });
  check();
  return true;
}

export const disable = () => saveSettings({ ...getSettings(), enabled: false });

/** Tampilkan satu notifikasi (lewat service worker supaya bisa diketuk membuka halaman). */
export async function show(title, body, { tag, url = '#/' } = {}) {
  const opts = { body, tag, icon: 'style/assets/icon-192.png', badge: 'style/assets/icon-192.png', data: { url } };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) return await reg.showNotification(title, opts);
  } catch { /* lanjut cara biasa */ }
  new Notification(title, opts);
}

/* ---------- Sekali kirim per hari / per kejadian ---------- */

function sentLog() {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY)) || {};
  } catch {
    return {};
  }
}
function once(key) {
  const log = sentLog();
  if (log[key]) return false;
  log[key] = today();
  // buang catatan lebih dari 7 hari
  const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  Object.keys(log).forEach((k) => log[k] < week && delete log[k]);
  localStorage.setItem(SENT_KEY, JSON.stringify(log));
  return true;
}

const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Daftar pengingat yang perlu dikirim sekarang (tanpa mengirim). */
export function pending(now = new Date()) {
  const s = getSettings();
  const date = today();
  const out = [];
  const on = (type) => s.types[type] !== false && can(TYPES.find((t) => t.key === type).menu);

  if (on('bills')) {
    bill.dueSoon(1).forEach((x) => {
      const [y, m, d] = x.due.split('-').map(Number);
      const diff = Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
      const when = diff < 0 ? `terlambat ${-diff} hari` : diff === 0 ? 'jatuh tempo hari ini' : 'jatuh tempo besok';
      out.push({ key: `bill:${x.bill.id}:${x.month}:${date}`, title: `${x.bill.icon || '📅'} ${x.bill.name} ${when}`, body: `Rp ${x.bill.amount.toLocaleString('id-ID')} · ketuk untuk bayar`, url: '#/finance/tagihan' });
    });
  }

  if (on('activity')) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    act.tasksForDate(date)
      .filter((t) => !t.done && t.time && /^\d{2}:\d{2}$/.test(t.time))
      .forEach((t) => {
        const diff = minutesOf(t.time) - nowMin;
        if (diff >= 0 && diff <= 15) {
          out.push({ key: `act:${t.id}:${date}`, title: `${t.icon || '⏰'} ${t.title}`, body: diff ? `Mulai ${diff} menit lagi (${t.time})` : `Mulai sekarang (${t.time})`, url: '#/kegiatan' });
        }
      });
  }

  if (on('expiry')) {
    const soon = inv.expiringItems(3);
    if (soon.length) {
      out.push({ key: `expiry:${date}`, title: `🥫 ${soon.length} barang segera kedaluwarsa`, body: soon.slice(0, 4).map((i) => i.name).join(', ') + (soon.length > 4 ? ', …' : ''), url: '#/inventory' });
    }
  }

  if (on('stock')) {
    const low = inv.shoppingList();
    if (low.length) {
      out.push({ key: `stock:${date}`, title: `🛒 ${low.length} barang stoknya menipis`, body: low.slice(0, 4).map((i) => i.name).join(', ') + (low.length > 4 ? ', …' : ''), url: '#/inventory/belanja' });
    }
  }
  return out;
}

/** Kirim pengingat yang belum pernah dikirim. */
export function check() {
  if (!getSettings().enabled || permission() !== 'granted') return [];
  const sent = pending().filter((n) => once(n.key));
  sent.forEach((n) => show(n.title, n.body, { tag: n.key, url: n.url }).catch(() => {}));
  return sent;
}

let timer = null;
/** Dipanggil sekali oleh app.js. */
export function startNotifications() {
  if (!isSupported()) return;
  check();
  clearInterval(timer);
  timer = setInterval(check, 60000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
}
