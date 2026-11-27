/**
 * Bill Service — tagihan rutin (listrik, internet, cicilan, SPP, …).
 * Atur sekali → muncul tiap jatuh tempo → "Bayar" mencatat pengeluaran
 * di Keuangan dan menandai tagihan bulan itu lunas.
 */
import { collection } from './storage.service.js';
import { today, thisMonth, addMonths, toISODate, daysUntil } from './format.service.js';
import * as fin from './finance.service.js';

const bills = collection('fin.bills');

export const BILL_ICONS = ['💡', '💧', '📶', '📱', '🏦', '🏠', '🚗', '🎓', '🩺', '🛡️', '📺', '🧹', '🗑️', '⛽', '💳', '🧾'];
export const INTERVALS = [
  [1, 'Tiap bulan'],
  [2, 'Tiap 2 bulan'],
  [3, 'Tiap 3 bulan'],
  [6, 'Tiap 6 bulan'],
  [12, 'Setahun sekali'],
];
export const intervalLabel = (n) => (INTERVALS.find(([k]) => k === Number(n)) || INTERVALS[0])[1];

const monthsBetween = (a, b) => {
  const [y1, m1] = a.split('-').map(Number);
  const [y2, m2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
};

/* ---------- CRUD ---------- */

export const listBills = ({ includeArchived = false } = {}) =>
  bills.filter((b) => includeArchived || !b.archived).sort((a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name));

export const getBill = (id) => bills.get(id);

export function saveBill(data) {
  const name = (data.name || '').trim();
  if (!name) throw new Error('Nama tagihan wajib diisi');
  const amount = Number(data.amount) || 0;
  if (amount <= 0) throw new Error('Isi jumlah tagihan');
  const dueDay = Math.round(Number(data.dueDay));
  if (!(dueDay >= 1 && dueDay <= 31)) throw new Error('Tanggal jatuh tempo 1–31');
  const clean = {
    name,
    icon: data.icon || '🧾',
    amount,
    category: data.category || 'Lainnya',
    accountId: data.accountId || '',
    dueDay,
    intervalMonths: INTERVALS.some(([k]) => k === Number(data.intervalMonths)) ? Number(data.intervalMonths) : 1,
    startMonth: /^\d{4}-\d{2}$/.test(data.startMonth || '') ? data.startMonth : thisMonth(),
    note: (data.note || '').trim(),
    archived: Boolean(data.archived),
  };
  return data.id ? bills.update(data.id, clean) : bills.add({ ...clean, paid: {} });
}

export const deleteBill = (id) => bills.remove(id);
export const setBillArchived = (id, archived) => bills.update(id, { archived });

/* ---------- Jatuh tempo ---------- */

/** Apakah tagihan ditagih pada bulan "YYYY-MM"? */
export function isDueIn(bill, month) {
  const diff = monthsBetween(bill.startMonth, month);
  return diff >= 0 && diff % (bill.intervalMonths || 1) === 0;
}

/** Tanggal jatuh tempo di bulan itu (tanggal 31 → hari terakhir bulan pendek). */
export function dueDate(bill, month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return toISODate(new Date(y, m - 1, Math.min(bill.dueDay, last)));
}

/** Catatan pembayaran bulan itu — hanya dianggap lunas bila transaksinya masih ada. */
export function payment(bill, month) {
  const p = (bill.paid || {})[month];
  if (!p) return null;
  if (p.tx && !fin.getTransaction(p.tx)) return null; // transaksinya sudah dihapus
  return p;
}

/**
 * Status tagihan pada bulan itu:
 * paid (lunas) · overdue (lewat jatuh tempo) · soon (≤ 3 hari lagi) · upcoming · none (tidak ditagih bulan ini)
 */
export function status(bill, month = thisMonth()) {
  if (!isDueIn(bill, month)) return 'none';
  if (payment(bill, month)) return 'paid';
  const d = daysUntil(dueDate(bill, month));
  if (d < 0) return 'overdue';
  if (d <= 3) return 'soon';
  return 'upcoming';
}

/** Semua tagihan yang ditagih pada bulan itu, urut tanggal jatuh tempo. */
export function billsForMonth(month = thisMonth()) {
  return listBills()
    .filter((b) => isDueIn(b, month))
    .map((b) => ({ bill: b, month, due: dueDate(b, month), status: status(b, month), payment: payment(b, month) }))
    .sort((a, b) => a.due.localeCompare(b.due));
}

/**
 * Yang perlu perhatian: belum dibayar & jatuh tempo ≤ `days` hari lagi,
 * termasuk tunggakan sampai 3 bulan ke belakang.
 */
export function dueSoon(days = 7) {
  const now = thisMonth();
  const out = [];
  for (let back = 3; back >= -1; back--) {
    const month = addMonths(now, -back);
    billsForMonth(month)
      .filter((x) => !x.payment && daysUntil(x.due) <= days)
      .forEach((x) => out.push({ ...x, status: daysUntil(x.due) < 0 ? 'overdue' : x.status }));
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

/** Ringkasan bulan ini. */
export function monthSummary(month = thisMonth()) {
  const list = billsForMonth(month);
  const paid = list.filter((x) => x.payment);
  return {
    count: list.length,
    paidCount: paid.length,
    total: list.reduce((s, x) => s + (x.payment?.amount || x.bill.amount), 0),
    remaining: list.filter((x) => !x.payment).reduce((s, x) => s + x.bill.amount, 0),
  };
}

/* ---------- Bayar ---------- */

/** Catat pembayaran: pengeluaran di Keuangan + tandai lunas untuk bulan itu. */
export function pay(billId, month, { amount, accountId, date, note }) {
  const bill = bills.get(billId);
  if (!bill) throw new Error('Tagihan tidak ditemukan');
  if (payment(bill, month)) throw new Error('Tagihan bulan ini sudah lunas');
  const n = Number(amount) || 0;
  if (n <= 0) throw new Error('Isi jumlah yang dibayar');
  if (!accountId) throw new Error('Pilih dibayar dari mana');
  const [y, m] = month.split('-');
  const tx = fin.addTransaction({
    type: 'expense',
    amount: n,
    category: bill.category,
    accountId,
    date: date || today(),
    note: note || `${bill.name} ${m}/${y}`,
    source: 'tagihan',
  });
  bills.update(billId, { paid: { ...(bill.paid || {}), [month]: { tx: tx.id, date: tx.date, amount: n } } });
  return tx;
}

/** Tandai lunas tanpa membuat pengeluaran (sudah dibayar & dicatat sebelumnya). */
export function markPaid(billId, month) {
  const bill = bills.get(billId);
  if (!bill) return;
  bills.update(billId, { paid: { ...(bill.paid || {}), [month]: { tx: '', date: today(), amount: bill.amount } } });
}

/** Batalkan pembayaran: transaksi pengeluarannya ikut dihapus. */
export function unpay(billId, month) {
  const bill = bills.get(billId);
  if (!bill) return;
  const p = (bill.paid || {})[month];
  if (p?.tx && fin.getTransaction(p.tx)) fin.deleteTransaction(p.tx);
  const paid = { ...(bill.paid || {}) };
  delete paid[month];
  bills.update(billId, { paid });
}
