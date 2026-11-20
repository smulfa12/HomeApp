/**
 * Finance Service
 * Logika keuangan keluarga: akun (aset & hutang), transaksi pemasukan /
 * pengeluaran, laporan per periode, neraca, laba-rugi, dan budget.
 */
import { collection, load, save } from './storage.service.js';
import { today } from './format.service.js';

const accounts = collection('fin.accounts');
const transactions = collection('fin.transactions');

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
  { name: 'Lainnya', emoji: '🧾' },
];

export function categoryEmoji(type, name) {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return (list.find((c) => c.name === name) || { emoji: type === 'income' ? '✨' : '🧾' }).emoji;
}

/* ---------- Akun (dompet, bank, hutang) ---------- */

export const ASSET_GROUPS = ['Kas / Tunai', 'Bank', 'E-Wallet', 'Tabungan & Investasi', 'Aset Tetap'];
export const LIABILITY_GROUPS = ['Hutang', 'Cicilan / Kredit', 'Kartu Kredit'];

function ensureDefaultAccounts() {
  if (accounts.all().length === 0) {
    accounts.add({ name: 'Dompet', type: 'asset', group: 'Kas / Tunai', opening: 0 });
    accounts.add({ name: 'Rekening Bank', type: 'asset', group: 'Bank', opening: 0 });
  }
}

export function listAccounts(type) {
  ensureDefaultAccounts();
  return accounts.all().filter((a) => !type || a.type === type);
}

export const saveAccount = (data) =>
  data.id ? accounts.update(data.id, data) : accounts.add({ ...data, opening: Number(data.opening) || 0 });
export const deleteAccount = (id) => accounts.remove(id);

/** Saldo akun aset = saldo awal + pemasukan − pengeluaran (sampai tanggal `asOf`). */
export function accountBalance(account, asOf = '9999-12-31') {
  if (account.type === 'liability') return Number(account.opening) || 0;
  return transactions
    .filter((t) => t.accountId === account.id && t.date <= asOf)
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), Number(account.opening) || 0);
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
  const assets = listAccounts('asset').map((a) => ({ ...a, balance: accountBalance(a, asOf) }));
  const liabilities = listAccounts('liability').map((a) => ({ ...a, balance: accountBalance(a, asOf) }));
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
  const LIQUID = ['Kas / Tunai', 'Bank', 'E-Wallet'];
  const cash = bs.assets.filter((a) => LIQUID.includes(a.group)).reduce((s, a) => s + a.balance, 0);
  return { income: pl.totalIncome, expense: pl.totalExpense, net: pl.net, netWorth: bs.equity, cash };
}
