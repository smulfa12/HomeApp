/**
 * Sync Service
 * Menjaga data di HP (cache lokal) tetap sama dengan database Supabase.
 *
 *  - Setiap perubahan lokal masuk ANTRIAN lalu dikirim ke database.
 *    Kalau offline, antrian disimpan dan dikirim begitu online lagi.
 *  - Saat aplikasi dibuka / login / kembali online → data diambil ulang dari database.
 *  - Realtime: perubahan dari HP anggota keluarga lain langsung masuk.
 *  - Login pertama kali & database masih kosong → data lama di HP dipindahkan ke database.
 *
 * Kalau Supabase belum dikonfigurasi, aplikasi tetap jalan dalam mode lokal.
 */
import * as db from './database.service.js';
import { setSyncHook, collection, save, load, clearAll, hasLocalData, removeLocal } from './storage.service.js';

const QUEUE_KEY = 'rumahku-sync-queue';
const USER_KEY = 'rumahku-user';
const LAST_SYNC_KEY = 'rumahku-last-sync';

let state = {
  mode: db.isConfigured() ? 'cloud' : 'local',
  status: 'idle', // idle | syncing | synced | offline | error
  user: null,
  lastSync: localStorage.getItem(LAST_SYNC_KEY),
  error: null,
};
const listeners = new Set();
let remoteChangeCallback = () => {};
let unsubscribeRealtime = null;

export const onSyncChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(syncState()));
};
export const syncState = () => ({ ...state, pending: readQueue().length });
export const needsLogin = () => state.mode === 'cloud' && !state.user;

/* ---------- Antrian ---------- */

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}
const writeQueue = (q) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q));

function enqueue(op) {
  const q = readQueue();
  // "replace" / "clear" menggantikan operasi sebelumnya pada key yang sama
  if (op.kind === 'clear') q.length = 0;
  const filtered = op.kind === 'replace' ? q.filter((o) => o.key !== op.key) : q;
  filtered.push(op);
  writeQueue(filtered);
}

const isSyncedKey = (key) => key in db.TABLES || db.SETTING_KEYS.includes(key);

function onLocalChange(op) {
  if (state.mode !== 'cloud' || !state.user) return;
  if (op.kind !== 'clear' && !isSyncedKey(op.key)) return;
  enqueue(op);
  flushSoon();
}

async function applyOp(op) {
  switch (op.kind) {
    case 'upsert':
      return db.upsertRow(op.key, op.row);
    case 'delete':
      return db.deleteRow(op.key, op.id);
    case 'replace':
      return op.key in db.TABLES ? db.replaceTable(op.key, op.value || []) : db.setSetting(op.key, op.value);
    case 'clear':
      return db.clearRemote();
  }
}

/** Kolom / tabel belum ada di database → SQL migrasi belum dijalankan. Perubahan tetap disimpan di antrian. */
const isSchemaMissing = (err) => ['PGRST204', 'PGRST205', '42703', '42P01'].includes(String(err?.code || ''));

/** Error karena data (bukan jaringan / sesi / skema) → tidak akan berhasil walau diulang. */
const isDataError = (err) => !isSchemaMissing(err) && /^(22|23|42|PGRST1|PGRST2)/.test(String(err?.code || ''));

let flushing = null;
let flushTimer = null;
const flushSoon = () => {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 300);
};

export function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    let q = readQueue();
    if (!q.length) return;
    emit({ status: 'syncing' });
    while (q.length) {
      try {
        await applyOp(q[0]);
      } catch (err) {
        if (!isDataError(err)) {
          const error = isSchemaMissing(err)
            ? 'Database perlu diperbarui: jalankan file SQL terbaru (service/database/) di Supabase. Perubahan aman tersimpan di HP.'
            : err?.message || String(err);
          emit({ status: navigator.onLine ? 'error' : 'offline', error });
          return;
        }
        console.error('Perubahan ditolak database, dilewati:', q[0], err);
        emit({ error: err.message });
      }
      q = readQueue();
      q.shift();
      writeQueue(q);
    }
    markSynced();
  })().finally(() => (flushing = null));
  return flushing;
}

function markSynced() {
  const now = new Date().toISOString();
  localStorage.setItem(LAST_SYNC_KEY, now);
  emit({ status: 'synced', lastSync: now, error: null });
}

/* ---------- Ambil data dari database ---------- */

let pulling = null;
let lastPullAt = 0;

export function pullAll() {
  if (pulling) return pulling;
  pulling = (async () => {
    await flush();
    if (readQueue().length) return false; // masih ada perubahan yang belum terkirim, jangan ditimpa
    emit({ status: 'syncing' });
    try {
      const remote = {};
      for (const key of Object.keys(db.TABLES)) remote[key] = await db.fetchTable(key);
      const settings = await db.fetchSettings();
      const remoteEmpty = Object.values(remote).every((r) => !r.length) && !Object.keys(settings).length;

      if (remoteEmpty && hasLocalData()) {
        // Pertama kali: pindahkan data yang sudah ada di HP ke database
        Object.keys(db.TABLES).forEach((key) => enqueue({ kind: 'replace', key, value: load(key, []) }));
        db.SETTING_KEYS.forEach((key) => {
          const v = load(key, undefined);
          if (v !== undefined) enqueue({ kind: 'replace', key, value: v });
        });
        await flush();
        return true;
      }

      Object.entries(remote).forEach(([key, rows]) => collection(key).replaceAll(rows, { silent: true }));
      db.SETTING_KEYS.forEach((key) => (key in settings ? save(key, settings[key], { silent: true }) : removeLocal(key)));
      lastPullAt = Date.now();
      markSynced();
      return true;
    } catch (err) {
      emit({ status: navigator.onLine ? 'error' : 'offline', error: err?.message || String(err) });
      return false;
    }
  })().finally(() => (pulling = null));
  return pulling;
}

/* ---------- Realtime ---------- */

function onRemoteEvent(evt) {
  if (evt.setting) {
    if (!db.SETTING_KEYS.includes(evt.setting)) return;
    if (JSON.stringify(load(evt.setting)) === JSON.stringify(evt.value)) return;
    evt.value === undefined ? removeLocal(evt.setting) : save(evt.setting, evt.value, { silent: true });
  } else {
    const col = collection(evt.key);
    const local = col.get(evt.row.id);
    if (evt.deleted ? !local : local && local.updatedAt === evt.row.updatedAt) return; // perubahan dari HP ini sendiri
    col.applyRemote(evt.row, evt.deleted);
  }
  remoteChangeCallback();
}

async function startRealtime() {
  try {
    unsubscribeRealtime?.();
    unsubscribeRealtime = await db.subscribe(onRemoteEvent);
  } catch (err) {
    console.warn('Realtime tidak aktif', err);
  }
}

/* ---------- Login / logout ---------- */

export async function login(email, password) {
  const session = await db.signIn(email.trim(), password);
  localStorage.setItem(USER_KEY, session.user.email);
  emit({ user: { email: session.user.email }, error: null });
  await pullAll();
  startRealtime();
}

export async function logout() {
  await flush().catch(() => {});
  try {
    await db.signOut();
  } catch { /* offline: sesi tetap dihapus lokal */ }
  unsubscribeRealtime?.();
  unsubscribeRealtime = null;
  clearAll({ silent: true });
  writeQueue([]);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
  emit({ user: null, status: 'idle', lastSync: null });
}

export async function syncNow() {
  await flush();
  return pullAll();
}

/* ---------- Mulai ---------- */

/**
 * Dipanggil sekali oleh app.js sebelum halaman pertama tampil.
 * onRemoteChange dipanggil setiap ada data baru dari HP lain.
 */
export async function initData({ onRemoteChange } = {}) {
  setSyncHook(onLocalChange);
  if (onRemoteChange) remoteChangeCallback = onRemoteChange;
  if (state.mode === 'local') return;

  const remembered = localStorage.getItem(USER_KEY);
  try {
    const session = await db.getSession();
    if (session) {
      localStorage.setItem(USER_KEY, session.user.email);
      emit({ user: { email: session.user.email } });
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    // Tidak bisa menghubungi Supabase (offline). Tetap izinkan pakai data di HP.
    if (remembered) emit({ user: { email: remembered }, status: 'offline' });
  }

  if (state.user) {
    pullAll().then((ok) => ok && remoteChangeCallback());
    startRealtime();
  }

  db.onAuthChange((event) => {
    if (event === 'SIGNED_OUT' && state.user) emit({ user: null });
  }).catch(() => {});

  window.addEventListener('online', () => state.user && syncNow().then(() => remoteChangeCallback()));
  window.addEventListener('offline', () => emit({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.user && Date.now() - lastPullAt > 30000) {
      pullAll().then((ok) => ok && remoteChangeCallback());
    }
  });
}
