/**
 * Access Service — role Admin / User & menu yang boleh dibuka tiap akun.
 * Data akses disimpan di tabel app_users (lihat service/database/008_role_akses.sql)
 * dan di-cache di HP supaya tetap jalan saat offline.
 *
 * Mode lokal (tanpa Supabase) atau SQL 008 belum dijalankan → semua menu terbuka (admin).
 */
import * as db from './database.service.js';

const KEY = 'rumahku-access';

/** Menu utama yang aksesnya bisa diatur admin. */
export const MENUS = [
  { key: 'inventory', label: 'Inventory', icon: '📦', path: '/inventory' },
  { key: 'finance', label: 'Finance', icon: '💰', path: '/finance' },
  { key: 'kegiatan', label: 'Activities', icon: '✅', path: '/kegiatan' },
  { key: 'resep', label: 'Recipes', icon: '🍳', path: '/resep' },
];
const ALL = MENUS.map((m) => m.key);
const FULL = { role: 'admin', menus: ALL, managed: false };

let access = read();

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || FULL;
  } catch {
    return FULL;
  }
}
function write(a) {
  access = a;
  localStorage.setItem(KEY, JSON.stringify(a));
}

export const isAdmin = () => access.role === 'admin';
export const can = (menu) => isAdmin() || access.menus.includes(menu);
/** Fitur role aktif (SQL 008 sudah dijalankan & login Supabase). */
export const isManaged = () => Boolean(access.managed);
export const currentAccess = () => ({ ...access });

/** Boleh membuka halaman ini? /configure hanya admin. */
export function canPath(path) {
  if (path.startsWith('/configure')) return isAdmin() && isManaged();
  if (path === '/resep/belanja' && !can('inventory')) return false; // butuh stok Inventory
  const menu = MENUS.find((m) => path === m.path || path.startsWith(m.path + '/'));
  if (!menu) return true;
  // pengaturan dompet/kategori/lokasi dari Settings tetap butuh akses menunya
  return can(menu.key);
}

/** Ambil ulang akses dari database. Gagal (offline) → pakai cache terakhir. */
export async function refresh() {
  if (!db.isConfigured()) return write(FULL);
  try {
    const me = await db.fetchMyAccess();
    if (!me) return;
    if (me.missing) write({ role: 'user', menus: [], managed: true, userId: me.user_id });
    else write({ role: me.role, menus: me.menus || [], managed: true, userId: me.user_id });
  } catch (err) {
    // tabel app_users belum ada → fitur role belum dipakai, semua terbuka
    if (['PGRST205', '42P01'].includes(String(err?.code || ''))) write(FULL);
  }
}

export const reset = () => {
  localStorage.removeItem(KEY);
  access = FULL;
};

/* ---------- Untuk admin (menu Configure) ---------- */

export const listUsers = () => db.listAppUsers();

export function updateUser(userId, { role, menus }) {
  if (!['admin', 'user'].includes(role)) throw new Error('Role tidak dikenal');
  return db.updateAppUser(userId, { role, menus: menus.filter((m) => ALL.includes(m)) });
}
