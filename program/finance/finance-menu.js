/**
 * Menu Utama Financial Rumah
 */
import { pageHeader } from '../../service/ui.service.js';
import { rupiah, rupiahShort, thisMonth, monthLabel } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';

const MENUS = [
  { href: '#/finance/income', emoji: '💰', title: 'Income', desc: 'Catat pemasukan', tone: 'mint' },
  { href: '#/finance/expense', emoji: '🧾', title: 'Expense', desc: 'Scan nota / manual', tone: 'peach' },
  { href: '#/finance/transfer', emoji: '🔁', title: 'Transfer', desc: 'Antar dompet & rekening', tone: 'sky' },
  { href: '#/finance/target', emoji: '🐷', title: 'Savings Goals', desc: 'Dana darurat & impian', tone: 'rose' },
  { href: '#/finance/neraca', emoji: '⚖️', title: 'Balance Sheet & P&L', desc: 'Kesehatan keuangan', tone: 'lavender' },
  { href: '#/finance/budget', emoji: '🎯', title: 'Budget vs Actual', desc: 'Rencana vs aktual', tone: 'butter' },
  { href: '#/finance/laporan-pemasukan', emoji: '📈', title: 'Income Report', desc: 'Per periode', tone: 'sky' },
  { href: '#/finance/laporan-pengeluaran', emoji: '📉', title: 'Expense Report', desc: 'Per periode', tone: 'rose' },
  { href: '#/finance/akun', emoji: '💳', title: 'Manage Accounts', desc: 'Tambah / atur tempat uang', tone: 'mint' },
];

export default {
  path: '/finance',
  title: 'Home Finance',
  render(el) {
    const month = thisMonth();
    const s = fin.summary(month);
    const b = fin.budgetVsActual(month);
    const pct = b.totalBudget ? Math.min(Math.round((b.totalSpent / b.totalBudget) * 100), 100) : 0;

    el.innerHTML = `
      ${pageHeader({ title: 'Home Finance', subtitle: monthLabel(month), emoji: '💰', tone: 'lavender' })}

      <section class="balance-card">
        <span>Saldo kas, bank & e-wallet</span>
        <strong>${rupiah(s.cash)}</strong>
        <div class="balance-card__row">
          <div><small>⬆️ Pemasukan</small><b>${rupiahShort(s.income)}</b></div>
          <div><small>⬇️ Pengeluaran</small><b>${rupiahShort(s.expense)}</b></div>
          <div><small>💫 Selisih</small><b>${rupiahShort(s.net)}</b></div>
        </div>
        ${b.totalBudget ? `
        <div class="balance-card__budget">
          <div class="row between small"><span>Budget terpakai</span><span>${pct}%</span></div>
          <div class="bar bar--light"><span style="width:${pct}%"></span></div>
        </div>` : ''}
      </section>

      <section class="menu-grid">
        ${MENUS.map(
          (m) => `
          <a class="menu-tile tone-${m.tone}" href="${m.href}">
            <span class="menu-tile__icon">${m.emoji}</span>
            <span class="menu-tile__title">${m.title}</span>
            <span class="menu-tile__desc">${m.desc}</span>
          </a>`
        ).join('')}
      </section>
`;
  },
};
