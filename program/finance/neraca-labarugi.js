/**
 * 5. Neraca & Laba Rugi Keuangan Keluarga
 *  - Laba Rugi: pemasukan − pengeluaran per kategori dalam periode.
 *  - Neraca: aset (kas, bank, tabungan) − kewajiban (hutang) = kekayaan bersih.
 */
import { pageHeader, esc, periodFilter } from '../../service/ui.service.js';
import { rupiah, dateLabel, today } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';

function section(title, rows, totalLabel, totalValue, tone, sign = '') {
  return `
    <div class="fin-table">
      <div class="fin-table__head tone-${tone}">${title}</div>
      ${rows.length ? rows.map((r) => `<div class="fin-table__row"><span>${r.label}</span><span>${sign}${rupiah(r.value)}</span></div>`).join('')
        : `<div class="fin-table__row muted"><span>Belum ada data</span><span>-</span></div>`}
      <div class="fin-table__total"><span>${totalLabel}</span><span>${sign}${rupiah(totalValue)}</span></div>
    </div>`;
}

export default {
  path: '/finance/neraca',
  title: 'Neraca & Laba Rugi',
  render(el) {
    let tab = 'labarugi';

    el.innerHTML = `
      ${pageHeader({ title: 'Neraca & Laba Rugi', subtitle: 'Laporan keuangan keluarga', emoji: '⚖️', tone: 'lavender', back: '#/finance' })}
      <div class="segmented">
        <button class="on" data-tab="labarugi">📊 Laba Rugi</button>
        <button data-tab="neraca">⚖️ Neraca</button>
      </div>
      <div data-labarugi>
        <div data-period></div>
        <div data-pl></div>
      </div>
      <div data-neraca class="hidden"></div>`;

    const plBox = el.querySelector('[data-pl]');
    const nrBox = el.querySelector('[data-neraca]');

    const drawPL = ({ from, to }) => {
      const pl = fin.profitLoss(from, to);
      const positive = pl.net >= 0;
      plBox.innerHTML = `
        <section class="hero-num tone-${positive ? 'mint' : 'rose'}">
          <span>${positive ? 'Surplus 🎉' : 'Defisit 😥'}</span>
          <strong>${rupiah(pl.net)}</strong>
          <small>${dateLabel(from)} – ${dateLabel(to)} · Rasio tabungan ${pl.savingRate}%</small>
        </section>
        <section class="card">
          ${section('⬆️ Pendapatan', pl.income.map((r) => ({ label: `${fin.categoryEmoji('income', r.category)} ${esc(r.category)}`, value: r.total })), 'Total Pendapatan', pl.totalIncome, 'mint')}
          ${section('⬇️ Beban / Pengeluaran', pl.expense.map((r) => ({ label: `${fin.categoryEmoji('expense', r.category)} ${esc(r.category)}`, value: r.total })), 'Total Pengeluaran', pl.totalExpense, 'peach')}
          <div class="fin-grand tone-${positive ? 'mint' : 'rose'}">
            <span>${positive ? 'Laba (Surplus)' : 'Rugi (Defisit)'}</span><strong>${rupiah(pl.net)}</strong>
          </div>
        </section>`;
    };

    const drawNeraca = () => {
      const bs = fin.balanceSheet(today());
      const ratio = bs.totalAssets ? Math.round((bs.totalLiabilities / bs.totalAssets) * 100) : 0;
      nrBox.innerHTML = `
        <section class="hero-num tone-lavender">
          <span>Kekayaan bersih keluarga</span>
          <strong>${rupiah(bs.equity)}</strong>
          <small>Per ${dateLabel(today())} · Rasio hutang ${ratio}% ${ratio <= 30 ? '✅ sehat' : ratio <= 50 ? '⚠️ waspada' : '🚨 tinggi'}</small>
        </section>
        <section class="card">
          ${section('🏦 Aset', bs.assets.map((a) => ({ label: `${esc(a.name)} <small class="muted">${esc(a.group)}</small>`, value: a.balance })), 'Total Aset', bs.totalAssets, 'sky')}
          ${section('📌 Kewajiban (Hutang)', bs.liabilities.map((a) => ({ label: `${esc(a.name)} <small class="muted">${esc(a.group)}</small>`, value: a.balance })), 'Total Kewajiban', bs.totalLiabilities, 'rose')}
          <div class="fin-grand tone-lavender"><span>Ekuitas / Kekayaan Bersih</span><strong>${rupiah(bs.equity)}</strong></div>
        </section>
        <a class="link-card" href="#/finance/akun?from=neraca">✏️ Atur akun, saldo awal & hutang <span>›</span></a>`;
    };

    el.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.tab;
        el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
        el.querySelector('[data-labarugi]').classList.toggle('hidden', tab !== 'labarugi');
        nrBox.classList.toggle('hidden', tab !== 'neraca');
        if (tab === 'neraca') drawNeraca();
      })
    );

    periodFilter(el.querySelector('[data-period]'), drawPL);
  },
};
