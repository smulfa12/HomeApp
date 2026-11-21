/**
 * Halaman laporan transaksi per periode (dipakai laporan pemasukan
 * & pengeluaran supaya tidak menulis kode yang sama dua kali).
 */
import { pageHeader, esc, periodFilter, barList, emptyState } from '../../service/ui.service.js';
import { openTransactionEditor } from './transaction-form.js';
import { rupiah, dateLabel } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';

export function createReportPage({ path, type, title, emoji, tone, addHref }) {
  return {
    path,
    title,
    render(el) {
      el.innerHTML = `
        ${pageHeader({ title, subtitle: 'Pilih periode untuk melihat data', emoji, tone, back: '#/finance' })}
        <div data-period></div>
        <div data-content></div>`;

      const content = el.querySelector('[data-content]');
      const accounts = Object.fromEntries(fin.listAccounts(null, { includeArchived: true }).map((a) => [a.id, a.name]));
      let range;

      const draw = () => {
        const rows = fin.listTransactions({ type, ...range });
        const totalAmount = fin.total(rows);
        const byCat = fin.sumByCategory(rows);
        const days = Math.max(1, Math.round((new Date(range.to) - new Date(range.from)) / 86400000) + 1);

        if (!rows.length) {
          content.innerHTML = `<div class="card">${emptyState(emoji, 'Belum ada data', 'Tidak ada transaksi pada periode ini.', `<a class="btn btn--primary" href="${addHref}">Tambah Data</a>`)}</div>`;
          return;
        }

        content.innerHTML = `
          <section class="hero-num tone-${tone}">
            <span>Total ${type === 'income' ? 'pemasukan' : 'pengeluaran'}</span>
            <strong>${rupiah(totalAmount)}</strong>
            <small>${dateLabel(range.from)} – ${dateLabel(range.to)} · ${rows.length} transaksi · rata-rata ${rupiah(totalAmount / days)}/hari</small>
          </section>

          <section class="card">
            <div class="card__head"><h2>Per kategori</h2></div>
            ${barList(byCat, { tone, format: rupiah, emoji: (c) => fin.categoryEmoji(type, c) })}
          </section>

          <section class="card">
            <div class="card__head"><h2>Rincian transaksi</h2><span class="muted small">ketuk untuk ubah</span></div>
            <ul class="tx-list">
              ${rows
                .map(
                  (t) => `
                <li class="tx-list__row" data-edit="${t.id}" role="button" tabindex="0">
                  <span class="tx-list__icon tone-${tone}">${fin.categoryEmoji(type, t.category)}</span>
                  <div class="grow">
                    <div class="tx-list__title">${esc(t.note || t.category)}</div>
                    <div class="muted small">${dateLabel(t.date)} · ${esc(t.category)}${accounts[t.accountId] ? ` · ${esc(accounts[t.accountId])}` : ''}${t.source === 'scan' ? ' · 🧾 scan' : ''}${t.source === 'belanja' ? ' · 🛒 belanja' : ''}${t.refId ? ' · 🔁 transfer' : ''}</div>
                  </div>
                  <div class="tx-list__amt text-${tone}">${type === 'income' ? '+' : '−'}${rupiah(t.amount)}</div>
                  <span class="tx-list__edit" aria-hidden="true">✏️</span>
                </li>`
                )
                .join('')}
            </ul>
          </section>`;

        content.querySelectorAll('[data-edit]').forEach((row) => {
          const open = () => openTransactionEditor(row.dataset.edit, { onDone: draw });
          row.addEventListener('click', open);
          row.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open()));
        });
      };

      periodFilter(el.querySelector('[data-period]'), (r) => {
        range = r;
        draw();
      });
    },
  };
}
