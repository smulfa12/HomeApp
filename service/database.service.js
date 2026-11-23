/**
 * Database Service (Supabase)
 * Satu-satunya file yang berbicara langsung dengan database Supabase:
 * login, ambil data, simpan / hapus baris, dan realtime.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.config.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm';
const PAGE = 1000;

/** Pemetaan "koleksi" lokal → tabel database beserta kolomnya (nama JS). */
export const TABLES = {
  'inv.items': {
    table: 'inv_items',
    columns: ['id', 'name', 'barcode', 'qty', 'unit', 'category', 'minStock', 'location', 'expiry', 'price', 'createdAt', 'updatedAt'],
  },
  'inv.movements': {
    table: 'inv_movements',
    columns: ['id', 'itemId', 'itemName', 'type', 'qty', 'before', 'after', 'date', 'note', 'createdAt', 'updatedAt'],
  },
  'fin.accounts': {
    table: 'fin_accounts',
    columns: ['id', 'name', 'type', 'group', 'icon', 'number', 'note', 'archived', 'opening', 'createdAt', 'updatedAt'],
  },
  'fin.transactions': {
    table: 'fin_transactions',
    columns: ['id', 'type', 'amount', 'category', 'accountId', 'toAccountId', 'refId', 'date', 'note', 'source', 'createdAt', 'updatedAt'],
  },
  'inv.shopping': {
    table: 'inv_shopping',
    columns: ['id', 'date', 'store', 'total', 'accountId', 'transactionId', 'items', 'note', 'createdAt', 'updatedAt'],
  },
  'act.todos': {
    table: 'act_todos',
    columns: ['id', 'title', 'icon', 'time', 'endTime', 'date', 'repeat', 'days', 'who', 'note', 'recipeId', 'doneDates', 'skipDates', 'createdAt', 'updatedAt'],
  },
  'rcp.recipes': {
    table: 'rcp_recipes',
    columns: ['id', 'name', 'emoji', 'category', 'servings', 'prepMinutes', 'cookMinutes', 'ingredients', 'steps', 'nutrition', 'tags', 'note', 'source', 'favorite', 'createdAt', 'updatedAt'],
  },
  'fin.goals': {
    table: 'fin_goals',
    columns: ['id', 'name', 'icon', 'targetAmount', 'accountIds', 'deadline', 'note', 'archived', 'milestone', 'createdAt', 'updatedAt'],
  },
};

/** Pengaturan yang disimpan di tabel app_settings. */
export const SETTING_KEYS = ['inv.locations', 'inv.lastOpname', 'fin.budgets', 'inv.categories', 'fin.categories.expense', 'fin.categories.income', 'inv.locationIcons'];

export const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* ---------- Konversi baris ---------- */

const snake = (s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

export function toRow(key, obj) {
  const out = {};
  TABLES[key].columns.forEach((c) => {
    if (c in obj) out[snake(c)] = obj[c] === '' ? null : obj[c];
  });
  return out;
}

/** Nilai pengganti NULL dari database untuk kolom non-teks. */
const EMPTY = { archived: false, accountIds: [], milestone: 0, items: [], days: [], doneDates: [], skipDates: [], ingredients: [], steps: [], tags: [], nutrition: {}, favorite: false };

export function fromRow(key, row) {
  const out = {};
  TABLES[key].columns.forEach((c) => {
    const v = row[snake(c)];
    out[c] = v == null ? (c in EMPTY ? EMPTY[c] : '') : v;
  });
  return out;
}

const tableToKey = Object.fromEntries(Object.entries(TABLES).map(([k, v]) => [v.table, k]));

/* ---------- Client ---------- */

let clientPromise = null;
export function client() {
  if (!isConfigured()) return Promise.reject(new Error('Supabase belum dikonfigurasi'));
  if (!clientPromise) {
    clientPromise = import(SDK_URL)
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: 'rumahku-auth' },
        })
      )
      .catch((err) => {
        clientPromise = null;
        throw err;
      });
  }
  return clientPromise;
}

const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

/* ---------- Auth ---------- */

export async function getSession() {
  const c = await client();
  return must(await c.auth.getSession()).session;
}

export async function signIn(email, password) {
  const c = await client();
  return must(await c.auth.signInWithPassword({ email, password })).session;
}

export async function signOut() {
  const c = await client();
  await c.auth.signOut();
}

export async function onAuthChange(callback) {
  const c = await client();
  c.auth.onAuthStateChange((event, session) => callback(event, session));
}

/* ---------- Baca ---------- */

export async function fetchTable(key) {
  const c = await client();
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const data = must(await c.from(TABLES[key].table).select('*').order('id').range(from, from + PAGE - 1));
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows.map((r) => fromRow(key, r));
}

export async function fetchSettings() {
  const c = await client();
  const data = must(await c.from('app_settings').select('key, value'));
  return Object.fromEntries(data.map((r) => [r.key, r.value]));
}

/* ---------- Tulis ---------- */

export async function upsertRow(key, row) {
  const c = await client();
  must(await c.from(TABLES[key].table).upsert(toRow(key, row)));
}

export async function deleteRow(key, id) {
  const c = await client();
  must(await c.from(TABLES[key].table).delete().eq('id', id));
}

export async function replaceTable(key, rows) {
  const c = await client();
  const table = TABLES[key].table;
  must(await c.from(table).delete().not('id', 'is', null));
  for (let i = 0; i < rows.length; i += 500) {
    must(await c.from(table).upsert(rows.slice(i, i + 500).map((r) => toRow(key, r))));
  }
}

export async function setSetting(key, value) {
  const c = await client();
  must(await c.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }));
}

export async function clearRemote() {
  const c = await client();
  for (const key of Object.keys(TABLES)) await replaceTable(key, []);
  must(await c.from('app_settings').delete().not('key', 'is', null));
}

/* ---------- Realtime ---------- */

/**
 * Dengarkan perubahan dari HP lain.
 * handler({ key, deleted, row }) untuk tabel, atau ({ setting, value }) untuk pengaturan.
 */
export async function subscribe(handler) {
  const c = await client();
  let channel = c.channel('rumahku-sync');
  Object.values(TABLES).forEach(({ table }) => {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, (p) => {
      const key = tableToKey[table];
      if (p.eventType === 'DELETE') handler({ key, deleted: true, row: { id: p.old.id } });
      else handler({ key, deleted: false, row: fromRow(key, p.new) });
    });
  });
  channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (p) => {
    if (p.eventType === 'DELETE') handler({ setting: p.old.key, value: undefined });
    else handler({ setting: p.new.key, value: p.new.value });
  });
  channel.subscribe();
  return () => c.removeChannel(channel);
}

/* ---------- Role & akses menu (tabel app_users) ---------- */

/** Baris akses milik user yang sedang login (null bila belum terdaftar). */
export async function fetchMyAccess() {
  const c = await client();
  const session = must(await c.auth.getSession()).session;
  if (!session) return null;
  const rows = must(await c.from('app_users').select('user_id, email, role, menus').eq('user_id', session.user.id));
  return rows[0] ? { ...rows[0], self: true } : { user_id: session.user.id, email: session.user.email, role: 'user', menus: [], missing: true };
}

export async function listAppUsers() {
  const c = await client();
  return must(await c.from('app_users').select('user_id, email, role, menus').order('email'));
}

export async function updateAppUser(userId, patch) {
  const c = await client();
  const data = must(await c.from('app_users').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', userId).select('user_id'));
  if (!data.length) throw new Error('Tidak diizinkan (hanya admin yang bisa mengubah)');
}
