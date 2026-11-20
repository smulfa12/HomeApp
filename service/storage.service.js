/**
 * Storage Service
 * Wrapper sederhana di atas localStorage. Semua data aplikasi disimpan
 * dengan prefix "homeapp." supaya tidak bentrok dengan aplikasi lain.
 */
const PREFIX = 'homeapp.';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('Gagal menyimpan data', err);
    return false;
  }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Membuat "tabel" sederhana (array of object) dengan operasi CRUD.
 */
export function collection(name) {
  const read = () => load(name, []);
  const write = (rows) => save(name, rows);

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
      return row;
    },
    update(id, patch) {
      const rows = read();
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return null;
      rows[idx] = { ...rows[idx], ...patch, updatedAt: new Date().toISOString() };
      write(rows);
      return rows[idx];
    },
    remove(id) {
      write(read().filter((r) => r.id !== id));
    },
    replaceAll: (rows) => write(rows),
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

export function clearAll() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}
