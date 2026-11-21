/**
 * Riwayat Belanja — log setiap kali belanja dari Mode Belanja:
 * tanggal, toko, isi barang (jumlah × harga), total, dibayar dari.
 */
import { pageHeader, esc, periodFilter, emptyState, openSheet, toast, confirmDialog } from '../../service/ui.service.js';
import { rupiah, number, dateLabel } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';
import * as shop from '../../service/shopping.service.js';
import { navigate } from '../../service/router.service.js';

export default {
  path: '/inventory/riwayat-belanja',
  title: 'Riwayat Belanja',
  render(el) {
    let range;

    el.innerHTML = `
      ${pageHeader({ title: 'Riwayat Belanja', subtitle: 'Catatan setiap kali belanja', emoji: '🧾', tone: 'sky', back: '#/inventory' })}
      <a class="btn btn--peach btn--block" href="#/inventory/mode-belanja">🛍️ ${shop.hasSession() ? `Lanjutkan belanja (${shop.sessionCount()} di keranjang)` : 'Mulai Belanja'}</a>
      <div data-period></div>
      <div data-content></div>`;

    const content = el.querySelector('[data-content]');

    const draw = () => {
      const trips = shop.listTrips(range);
      if (!trips.length) {
        content.innerHTML = `<div class="card">${emptyState('🧾', 'Belum ada riwayat', 'Belanja lewat Mode Belanja akan tercatat di sini.')}</div>`;
        return;
      }
      const total = trips.reduce((s, t) => s + (Number(t.total) || 0), 0);
      const itemCount = trips.reduce((s, t) => s + (t.items || []).length, 0);

      content.innerHTML = `
        <section class="stat-row">
          <div class="stat tone-sky"><span>Total belanja</span><strong class="small-num">${rupiah(total)}</strong></div>
          <div class="stat tone-peach"><span>Kali belanja</span><strong>${trips.length}</strong></div>
          <div class="stat tone-butter"><span>Barang</span><strong>${itemCount}</strong></div>
        </section>
        <section class="card">
          <ul class="tx-list">
            ${trips
              .map((t) => {
                const acc = t.accountId ? fin.getAccount(t.accountId) : null;
                return `
              <li class="tx-list__row" data-trip="${t.id}" role="button" tabindex="0">
                <span class="tx-list__icon tone-sky">🛍️</span>
                <div class="grow">
                  <div class="tx-list__title">${esc(t.store || 'Belanja')}</div>
                  <div class="muted small">${dateLabel(t.date)} · ${(t.items || []).length} barang${acc ? ` · ${fin.accountIcon(acc)} ${esc(acc.name)}` : ' · tidak dicatat di keuangan'}</div>
                </div>
                <div class="tx-list__amt">${rupiah(t.total)}</div>
                <span class="tx-list__edit" aria-hidden="true">›</span>
              </li>`;
              })
              .join('')}
          </ul>
        </section>`;

      content.querySelectorAll('[data-trip]').forEach((row) => {
        const open = () => detail(row.dataset.trip);
        row.addEventListener('click', open);
        row.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open()));
      });
    };

    const detail = (id) => {
      const t = shop.getTrip(id);
      if (!t) return;
      const acc = t.accountId ? fin.getAccount(t.accountId) : null;
      const sum = (t.items || []).reduce((s, i) => s + i.qty * (i.price || 0), 0);
      const sheet = openSheet({
        title: `🛍️ ${t.store || 'Belanja'}`,
        body: `
          <p class="muted small">${dateLabel(t.date)}${acc ? ` · dibayar dari ${fin.accountIcon(acc)} ${esc(acc.name)}` : ''}${t.note ? ` · ${esc(t.note)}` : ''}</p>
          <ul class="receipt">
            ${(t.items || [])
              .map(
                (i) => `<li><span>${esc(i.name)}<small>${number(i.qty)} ${esc(i.unit || '')} × ${i.price ? rupiah(i.price) : '—'}</small></span><b>${i.price ? rupiah(i.qty * i.price) : '—'}</b></li>`
              )
              .join('')}
          </ul>
          ${sum && Math.round(sum) !== Math.round(t.total) ? `<div class="kv"><span>Jumlah harga barang</span><strong>${rupiah(sum)}</strong></div>` : ''}
          <div class="fin-grand tone-sky"><span>Total dibayar</span><strong>${rupiah(t.total)}</strong></div>
          ${t.transactionId && fin.getTransaction(t.transactionId) ? `<button class="btn btn--soft btn--block" data-tx>✏️ Lihat / ubah pengeluarannya</button>` : ''}
          <button class="btn btn--soft btn--block" data-repeat>🔁 Belanja lagi barang yang sama</button>
          <button class="btn btn--danger-soft btn--block" data-del>🗑️ Hapus dari riwayat</button>`,
      });

      sheet.el.querySelector('[data-tx]')?.addEventListener('click', () => {
        sheet.close();
        navigate('/finance/laporan-pengeluaran');
      });
      sheet.el.querySelector('[data-repeat]').addEventListener('click', () => {
        const n = shop.repeatTrip(t.id);
        sheet.close();
        toast(`🛒 ${n} barang dimasukkan ke keranjang`);
        navigate('/inventory/mode-belanja');
      });
      sheet.el.querySelector('[data-del]').addEventListener('click', async () => {
        sheet.close();
        const ok = await confirmDialog(
          'Hapus catatan belanja ini dari riwayat? Stok barang dan pengeluaran di Keuangan TIDAK ikut berubah (ubah lewat menunya masing-masing).',
          { okText: 'Hapus', danger: true }
        );
        if (!ok) return;
        shop.deleteTrip(t.id);
        toast('Dihapus dari riwayat');
        draw();
      });
    };

    periodFilter(el.querySelector('[data-period]'), (r) => {
      range = r;
      draw();
    });
  },
};
