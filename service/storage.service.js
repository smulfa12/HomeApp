/**
 * Storage Service
 * Cache data lokal di HP (localStorage). Semua menu membaca dari sini
 * supaya aplikasi tetap cepat dan bisa dipakai offline.
 *
 * Setiap perubahan dilaporkan lewat "sync hook" — sync.service.js memakai
 * hook ini untuk mengirim perubahan ke database Supabase.
 */
const PREFIX = 'homeapp.';

let syncHook = null;
/** Dipasang oleh sync.service.js. op = {kind:'upsert'|'delete'|'replace'|'clear', key, row?, id?, value?} */
export const setSyncHook = (fn) => (syncHook = fn);
const notify = (op) => syncHook && syncHook(op);

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('Gagal menyimpan data', err);
    return false;
  }
}

/** Simpan nilai (pengaturan). `silent` = jangan kirim ke database (dipakai saat menerima data dari server). */
export function save(key, value, { silent = false } = {}) {
  const ok = writeRaw(key, value);
  if (ok && !silent) notify({ kind: 'replace', key, value });
  return ok;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Membuat "tabel" sederhana (array of object) dengan operasi CRUD.
 */
export function collection(name) {
  const read = () => load(name, []);
  const write = (rows) => writeRaw(name, rows);

  return {
    all: () => read(),
    get: (id) => read().find((r) => r.id === id) || null,
    find: (predicate) => read().find(predicate) || null,
    filter: (predicate) => read().filter(predicate),
    add(obj) {
      const rows = read();
      const now = new Date().toISOString();
      const row = { id: uid(), createdAt: now, updatedAt: now, ...obj };
      rows.push(row);
      write(rows);
      notify({ kind: 'upsert', key: name, row });
      return row;
    },
    update(id, patch) {
      const rows = read();
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return null;
      rows[idx] = { ...rows[idx], ...patch, updatedAt: new Date().toISOString() };
      write(rows);
      notify({ kind: 'upsert', key: name, row: rows[idx] });
      return rows[idx];
    },
    remove(id) {
      write(read().filter((r) => r.id !== id));
      notify({ kind: 'delete', key: name, id });
    },
    replaceAll(rows, { silent = false } = {}) {
      write(rows);
      if (!silent) notify({ kind: 'replace', key: name, value: rows });
    },
    /** Terapkan perubahan dari server tanpa mengirim balik. */
    applyRemote(row, deleted = false) {
      const rows = read().filter((r) => r.id !== row.id);
      if (!deleted) rows.push(row);
      write(rows);
    },
  };
}

/** Semua key milik aplikasi (untuk backup / restore). */
export function exportAll() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) data[k.slice(PREFIX.length)] = load(k.slice(PREFIX.length));
  }
  return { app: 'HomeApp', version: 1, exportedAt: new Date().toISOString(), data };
}

export function importAll(payload) {
  if (!payload || typeof payload.data !== 'object') throw new Error('Format backup tidak dikenali');
  clearAll();
  Object.entries(payload.data).forEach(([k, v]) => save(k, v));
}

export function clearAll({ silent = false } = {}) {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
  if (!silent) notify({ kind: 'clear' });
}

/** Hapus satu key dari cache lokal tanpa mengirim ke database. */
export function removeLocal(key) {
  localStorage.removeItem(PREFIX + key);
}

/** Apakah ada data lokal (untuk migrasi pertama kali ke database). */
export function hasLocalData() {
  return Object.keys(localStorage).some((k) => k.startsWith(PREFIX));
}
