/**
 * Finance Service
 * Logika keuangan keluarga: akun (aset & hutang), transaksi pemasukan /
 * pengeluaran, laporan per periode, neraca, laba-rugi, dan budget.
 */
import { collection, load, save } from './storage.service.js';
import { today, toISODate } from './format.service.js';

const accounts = collection('fin.accounts');
const transactions = collection('fin.transactions');
const goals = collection('fin.goals');

/* ---------- Master kategori ---------- */

export const INCOME_CATEGORIES = [
  { name: 'Gaji', emoji: '💼' },
  { name: 'Bonus / THR', emoji: '🎁' },
  { name: 'Usaha', emoji: '🏪' },
  { name: 'Investasi', emoji: '📈' },
  { name: 'Hadiah', emoji: '💝' },
  { name: 'Lainnya', emoji: '✨' },
];

export const EXPENSE_CATEGORIES = [
  { name: 'Belanja Dapur', emoji: '🛒' },
  { name: 'Makan di Luar', emoji: '🍜' },
  { name: 'Transportasi', emoji: '🛵' },
  { name: 'Listrik & Air', emoji: '💡' },
  { name: 'Internet & Pulsa', emoji: '📶' },
  { name: 'Pendidikan', emoji: '📚' },
  { name: 'Kesehatan', emoji: '🩺' },
  { name: 'Cicilan & Hutang', emoji: '🏦' },
  { name: 'Rumah Tangga', emoji: '🏠' },
  { name: 'Hiburan', emoji: '🎈' },
  { name: 'Sedekah', emoji: '🤲' },
  { name: 'Biaya Admin', emoji: '🏧' },
  { name: 'Lainnya', emoji: '🧾' },
];

export function categoryEmoji(type, name) {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return (list.find((c) => c.name === name) || { emoji: type === 'income' ? '✨' : '🧾' }).emoji;
}

/* ---------- Akun / tempat penyimpanan uang ---------- */

/** Jenis akun beserta ikon bawaannya. */
export const ACCOUNT_GROUPS = {
  asset: [
    { name: 'Kas / Tunai', icon: '👛' },
    { name: 'Bank', icon: '🏦' },
    { name: 'E-Wallet', icon: '📱' },
    { name: 'Tabungan & Investasi', icon: '🐷' },
    { name: 'Emas', icon: '🪙' },
    { name: 'Piutang', icon: '🤝' },
    { name: 'Aset Tetap', icon: '🏠' },
    { name: 'Lainnya', icon: '💼' },
  ],
  liability: [
    { name: 'Hutang', icon: '📌' },
    { name: 'Cicilan / Kredit', icon: '🧾' },
    { name: 'Kartu Kredit', icon: '💳' },
    { name: 'Paylater', icon: '⏳' },
  ],
};
export const ASSET_GROUPS = ACCOUNT_GROUPS.asset.map((g) => g.name);
export const LIABILITY_GROUPS = ACCOUNT_GROUPS.liability.map((g) => g.name);
export const ACCOUNT_ICONS = ['👛', '💵', '🏦', '📱', '💳', '🐷', '📈', '🪙', '🤝', '🏠', '🚗', '💼', '🎁', '🧾', '📌', '⏳'];

/** Jenis akun yang dianggap uang siap pakai (saldo kas di menu Keuangan). */
export const LIQUID_GROUPS = ['Kas / Tunai', 'Bank', 'E-Wallet'];

export function accountIcon(account) {
  if (account.icon) return account.icon;
  const all = [...ACCOUNT_GROUPS.asset, ...ACCOUNT_GROUPS.liability];
  return (all.find((g) => g.name === account.group) || { icon: '💼' }).icon;
}

function ensureDefaultAccounts() {
  if (accounts.all().length === 0) {
    accounts.add({ name: 'Dompet', type: 'asset', group: 'Kas / Tunai', icon: '👛', opening: 0, archived: false });
    accounts.add({ name: 'Rekening Bank', type: 'asset', group: 'Bank', icon: '🏦', opening: 0, archived: false });
  }
}

const groupOrder = (a) => {
  const list = ACCOUNT_GROUPS[a.type] || [];
  const i = list.findIndex((g) => g.name === a.group);
  return i < 0 ? 99 : i;
};

/**
 * Daftar akun. `type` = 'asset' | 'liability' (opsional).
 * Akun yang diarsipkan disembunyikan kecuali includeArchived = true.
 */
export function listAccounts(type, { includeArchived = false } = {}) {
  ensureDefaultAccounts();
  return accounts
    .all()
    .filter((a) => (!type || a.type === type) && (includeArchived || !a.archived))
    .sort((a, b) => groupOrder(a) - groupOrder(b) || a.name.localeCompare(b.name));
}

export const getAccount = (id) => accounts.get(id);

export function saveAccount(data) {
  const name = (data.name || '').trim();
  if (!name) throw new Error('Nama akun wajib diisi');
  const dup = accounts.find((a) => a.id !== data.id && a.type === data.type && a.name.toLowerCase() === name.toLowerCase());
  if (dup) throw new Error(`Akun "${name}" sudah ada`);
  const clean = {
    name,
    type: data.type,
    group: data.group,
    icon: data.icon || '',
    number: (data.number || '').trim(),
    note: (data.note || '').trim(),
    opening: Number(data.opening) || 0,
    archived: Boolean(data.archived),
  };
  return data.id ? accounts.update(data.id, clean) : accounts.add(clean);
}

export const transactionCount = (accountId) =>
  transactions.filter((t) => t.accountId === accountId || t.toAccountId === accountId).length;

/** Hapus akun. Ditolak bila akun sudah dipakai transaksi (arsipkan saja). */
export function deleteAccount(id) {
  const n = transactionCount(id);
  if (n) throw new Error(`Akun ini dipakai di ${n} transaksi. Arsipkan saja supaya riwayat tetap utuh.`);
  accounts.remove(id);
  // lepaskan akun dari target tabungan yang memakainya
  goals.filter((g) => (g.accountIds || []).includes(id)).forEach((g) => goals.update(g.id, { accountIds: g.accountIds.filter((x) => x !== id) }));
}

export const setArchived = (id, archived) => accounts.update(id, { archived });

/**
 * Saldo akun sampai tanggal `asOf`.
 *  - Aset   : saldo awal + pemasukan − pengeluaran + transfer masuk − transfer keluar
 *  - Hutang : sisa awal − pembayaran (transfer masuk ke akun hutang)
 *             + pemakaian (transfer keluar dari akun hutang, mis. paylater)
 */
export function accountBalance(account, asOf = '9999-12-31') {
  const sign = account.type === 'liability' ? -1 : 1;
  return transactions
    .filter((t) => t.date <= asOf && (t.accountId === account.id || t.toAccountId === account.id))
    .reduce((sum, t) => {
      if (t.type === 'transfer') return sum + (t.toAccountId === account.id ? sign * t.amount : -sign * t.amount);
      if (account.type === 'liability') return sum; // pemasukan/pengeluaran tidak dicatat di akun hutang
      return sum + (t.type === 'income' ? t.amount : -t.amount);
    }, Number(account.opening) || 0);
}

/* ---------- Transaksi ---------- */

export function addTransaction({ type, amount, category, accountId, date, note, source = 'manual' }) {
  const n = Number(amount);
  if (!n || n <= 0) throw new Error('Nominal harus lebih dari 0');
  return transactions.add({
    type,
    amount: n,
    category: category || 'Lainnya',
    accountId: accountId || listAccounts('asset')[0]?.id || null,
    date: date || today(),
    note: (note || '').trim(),
    source,
  });
}

export const deleteTransaction = (id) => transactions.remove(id);

export function listTransactions({ type, from = '0000-01-01', to = '9999-12-31' } = {}) {
  return transactions
    .filter((t) => (!type || t.type === type) && t.date >= from && t.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function sumByCategory(rows) {
  const map = {};
  rows.forEach((t) => (map[t.category] = (map[t.category] || 0) + t.amount));
  return Object.entries(map)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export const total = (rows) => rows.reduce((s, t) => s + t.amount, 0);

/* ---------- Transfer antar akun ---------- */

/**
 * Pindahkan uang antar akun. Transfer tidak dihitung sebagai pemasukan /
 * pengeluaran. Biaya admin (opsional) dicatat sebagai pengeluaran terpisah
 * yang terhubung ke transfer lewat refId.
 */
export function addTransfer({ fromId, toId, amount, fee = 0, date, note = '' }) {
  const n = Number(amount);
  const f = Number(fee) || 0;
  if (!fromId || !toId) throw new Error('Pilih akun asal dan tujuan');
  if (fromId === toId) throw new Error('Akun asal dan tujuan tidak boleh sama');
  if (!n || n <= 0) throw new Error('Nominal harus lebih dari 0');
  if (f < 0) throw new Error('Biaya admin tidak valid');
  const from = accounts.get(fromId);
  const to = accounts.get(toId);
  if (!from || !to) throw new Error('Akun tidak ditemukan');

  const transfer = transactions.add({
    type: 'transfer',
    amount: n,
    category: 'Transfer',
    accountId: fromId,
    toAccountId: toId,
    date: date || today(),
    note: note.trim(),
    source: 'manual',
    refId: '',
  });
  if (f > 0) {
    transactions.add({
      type: 'expense',
      amount: f,
      category: 'Biaya Admin',
      accountId: fromId,
      toAccountId: '',
      date: transfer.date,
      note: `Biaya transfer ke ${to.name}`,
      source: 'transfer',
      refId: transfer.id,
    });
  }
  return transfer;
}

export function listTransfers({ from = '0000-01-01', to = '9999-12-31' } = {}) {
  const all = transactions.all();
  return all
    .filter((t) => t.type === 'transfer' && t.date >= from && t.date <= to)
    .map((t) => ({ ...t, fee: all.filter((x) => x.refId === t.id).reduce((s, x) => s + x.amount, 0) }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** Hapus transfer beserta biaya adminnya. */
export function deleteTransfer(id) {
  transactions.filter((t) => t.refId === id).forEach((t) => transactions.remove(t.id));
  transactions.remove(id);
}

/** Jenis transfer, untuk label yang mudah dipahami. */
export function transferKind(from, to) {
  if (!from || !to) return 'Transfer';
  if (from.type === 'asset' && to.type === 'liability') return 'Bayar hutang';
  if (from.type === 'liability' && to.type === 'asset') return 'Pinjam / pakai limit';
  if (from.type === 'liability' && to.type === 'liability') return 'Pindah hutang';
  return 'Pindah saldo';
}

/* ---------- Target tabungan ---------- */

export const GOAL_ICONS = ['🛟', '🏠', '🎓', '🕋', '✈️', '🚗', '💍', '👶', '🏥', '📱', '🎁', '🐷'];
export const GOAL_MILESTONES = [25, 50, 75, 100];

export const listGoals = ({ includeArchived = false } = {}) =>
  goals
    .all()
    .filter((g) => includeArchived || !g.archived)
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.name.localeCompare(b.name));
export const getGoal = (id) => goals.get(id);

export function saveGoal(data) {
  const name = (data.name || '').trim();
  const target = Number(data.targetAmount) || 0;
  const ids = [...new Set(data.accountIds || [])];
  if (!name) throw new Error('Nama target wajib diisi');
  if (target <= 0) throw new Error('Nominal target harus lebih dari 0');
  if (!ids.length) throw new Error('Pilih minimal 1 rekening tempat menyimpan');
  const clean = {
    name,
    icon: data.icon || '🐷',
    targetAmount: target,
    accountIds: ids,
    deadline: data.deadline || '',
    note: (data.note || '').trim(),
    archived: Boolean(data.archived),
  };
  return data.id ? goals.update(data.id, clean) : goals.add({ ...clean, milestone: 0 });
}

export const deleteGoal = (id) => goals.remove(id);
export const setGoalArchived = (id, archived) => goals.update(id, { archived });

/** Target lain yang juga memakai akun ini (saldonya terhitung ganda). */
export const goalsUsingAccount = (accountId, exceptGoalId) =>
  listGoals().filter((g) => g.id !== exceptGoalId && (g.accountIds || []).includes(accountId));

function monthsBetween(fromISO, toISO) {
  const [fy, fm] = fromISO.split('-').map(Number);
  const [ty, tm] = toISO.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function addMonthsISO(iso, n) {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Progres target: jumlah saldo semua akun terkait.
 * Juga menghitung kebutuhan nabung per bulan (bila ada tenggat) dan
 * perkiraan tercapai berdasarkan rata-rata kenaikan saldo 3 bulan terakhir.
 */
export function goalProgress(goal) {
  const linked = (goal.accountIds || []).map((id) => accounts.get(id)).filter(Boolean);
  const parts = linked.map((a) => ({ account: a, balance: accountBalance(a), shared: goalsUsingAccount(a.id, goal.id) }));
  const saved = parts.reduce((s, p) => s + p.balance, 0);
  const target = Number(goal.targetAmount) || 0;
  const remaining = Math.max(target - saved, 0);
  const pct = target ? Math.max(0, Math.round((saved / target) * 100)) : 0;
  const now = today();

  let monthlyNeeded = null;
  let monthsLeft = null;
  if (goal.deadline && remaining > 0) {
    monthsLeft = Math.max(monthsBetween(now, goal.deadline), 0);
    monthlyNeeded = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
  }

  // laju: kenaikan saldo dalam 90 hari terakhir → per bulan
  const past = new Date();
  past.setDate(past.getDate() - 90);
  const pastISO = toISODate(past);
  const savedThen = linked.reduce((s, a) => s + accountBalance(a, pastISO), 0);
  const monthlyPace = Math.round((saved - savedThen) / 3);
  let eta = null;
  if (remaining > 0 && monthlyPace > 0) eta = addMonthsISO(now, Math.ceil(remaining / monthlyPace));

  return {
    saved,
    target,
    remaining,
    pct,
    done: target > 0 && saved >= target,
    parts,
    monthsLeft,
    monthlyNeeded,
    monthlyPace,
    eta,
    onTrack: goal.deadline ? (eta ? eta.slice(0, 7) <= goal.deadline.slice(0, 7) : remaining === 0) : null,
  };
}

/**
 * Cek apakah target melewati milestone baru (25/50/75/100%).
 * Mengembalikan angka milestone yang baru tercapai (untuk dirayakan) atau null.
 */
export function checkMilestone(goal) {
  const { pct } = goalProgress(goal);
  const reached = GOAL_MILESTONES.filter((m) => pct >= m).pop() || 0;
  if (reached > (Number(goal.milestone) || 0)) {
    goals.update(goal.id, { milestone: reached });
    return reached;
  }
  return null;
}

/** Saran dana darurat: 6 × rata-rata pengeluaran 3 bulan penuh terakhir. */
export function suggestEmergencyFund(multiplier = 6) {
  const now = new Date();
  const from = toISODate(new Date(now.getFullYear(), now.getMonth() - 3, 1));
  const to = toISODate(new Date(now.getFullYear(), now.getMonth(), 0));
  const spent = total(listTransactions({ type: 'expense', from, to }));
  if (!spent) return null;
  const monthly = Math.round(spent / 3);
  return { monthly, suggested: Math.ceil((monthly * multiplier) / 100000) * 100000, multiplier };
}

/* ---------- Laporan: laba rugi & neraca ---------- */

export function profitLoss(from, to) {
  const income = listTransactions({ type: 'income', from, to });
  const expense = listTransactions({ type: 'expense', from, to });
  const totalIncome = total(income);
  const totalExpense = total(expense);
  return {
    income: sumByCategory(income),
    expense: sumByCategory(expense),
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    savingRate: totalIncome ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
  };
}

export function balanceSheet(asOf = today()) {
  const assets = listAccounts('asset', { includeArchived: true }).filter((a) => !a.archived || accountBalance(a, asOf) !== 0).map((a) => ({ ...a, balance: accountBalance(a, asOf) }));
  const liabilities = listAccounts('liability', { includeArchived: true }).filter((a) => !a.archived || accountBalance(a, asOf) !== 0).map((a) => ({ ...a, balance: accountBalance(a, asOf) }));
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
  return { assets, liabilities, totalAssets, totalLiabilities, equity: totalAssets - totalLiabilities };
}

/* ---------- Budget ---------- */

const budgetStore = () => load('fin.budgets', {});

export const getBudget = (month) => budgetStore()[month] || {};

export function setBudget(month, category, amount) {
  const all = budgetStore();
  all[month] = { ...(all[month] || {}) };
  if (Number(amount) > 0) all[month][category] = Number(amount);
  else delete all[month][category];
  save('fin.budgets', all);
}

export function copyBudget(fromMonth, toMonth) {
  const all = budgetStore();
  all[toMonth] = { ...(all[fromMonth] || {}) };
  save('fin.budgets', all);
}

/** Budget vs realisasi untuk bulan "YYYY-MM". */
export function budgetVsActual(month) {
  const plan = getBudget(month);
  const actual = sumByCategory(listTransactions({ type: 'expense', from: `${month}-01`, to: `${month}-31` }));
  const actualMap = Object.fromEntries(actual.map((a) => [a.category, a.total]));
  const cats = [...new Set([...Object.keys(plan), ...Object.keys(actualMap)])];
  const rows = cats
    .map((category) => {
      const budget = plan[category] || 0;
      const spent = actualMap[category] || 0;
      return { category, budget, spent, remaining: budget - spent, pct: budget ? Math.round((spent / budget) * 100) : spent ? 999 : 0 };
    })
    .sort((a, b) => b.pct - a.pct);
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  return { rows, totalBudget, totalSpent, remaining: totalBudget - totalSpent };
}

export function summary(month) {
  const from = `${month}-01`;
  const to = `${month}-31`;
  const pl = profitLoss(from, to);
  const bs = balanceSheet();
  const cash = bs.assets.filter((a) => LIQUID_GROUPS.includes(a.group)).reduce((s, a) => s + a.balance, 0);
  return { income: pl.totalIncome, expense: pl.totalExpense, net: pl.net, netWorth: bs.equity, cash };
}
