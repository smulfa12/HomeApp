/**
 * 2. Stock Keluar
 * Scan barcode barang ketika dipakai → stok berkurang.
 */
import { pageHeader, esc, toast, emptyState } from '../../service/ui.service.js';
import { scanBarcode } from '../../service/barcode.service.js';
import * as inv from '../../service/inventory.service.js';
import { number, dateLabel } from '../../service/format.service.js';
import { itemCard } from '../shared/item-card.js';

export default {
  path: '/inventory/keluar',
  title: 'Stock Keluar',
  autoRefresh: false, // halaman form: jangan di-render ulang saat ada data baru
  render(el) {
    let selected = null;

    el.innerHTML = `
      ${pageHeader({ title: 'Stock Keluar', subtitle: 'Catat barang yang dipakai', emoji: '📤', tone: 'peach', back: '#/inventory' })}

      <button class="scan-cta tone-peach" data-scan>
        <span class="scan-cta__icon">📷</span>
        <span><strong>Scan Barang Dipakai</strong><small>Stok otomatis berkurang</small></span>
      </button>

      <div class="card">
        <label class="field">
          <span>Atau cari barang</span>
          <input class="input" data-search placeholder="Ketik nama barang…" />
        </label>
        <div class="list list--compact" data-results></div>
      </div>

      <div data-selected></div>

      <section class="card">
        <div class="card__head"><h2>🕘 Pemakaian terakhir</h2></div>
        <div data-history></div>
      </section>`;

    const results = el.querySelector('[data-results]');
    const selectedBox = el.querySelector('[data-selected]');
    const history = el.querySelector('[data-history]');

    const renderHistory = () => {
      const rows = inv.recentMovements(10, 'out');
      history.innerHTML = rows.length
        ? `<ul class="timeline">${rows
            .map((m) => `<li><span>${esc(m.itemName)}</span><span class="muted small">${dateLabel(m.date)}</span><strong class="text-peach">−${number(m.qty)}</strong></li>`)
            .join('')}</ul>`
        : `<p class="muted small center">Belum ada pemakaian tercatat.</p>`;
    };

    const select = (item) => {
      selected = item;
      results.innerHTML = '';
      el.querySelector('[data-search]').value = '';
      selectedBox.innerHTML = `
        <form class="card form tone-border-peach" data-out>
          ${itemCard(item)}
          <label class="field">
            <span>Jumlah dipakai (${esc(item.unit)})</span>
            <div class="stepper">
              <button type="button" class="btn btn--soft" data-step="-1">−</button>
              <input class="input center" name="qty" type="number" inputmode="decimal" min="0" step="any" value="1" />
              <button type="button" class="btn btn--soft" data-step="1">+</button>
            </div>
          </label>
          <label class="field">
            <span>Catatan</span>
            <input class="input" name="note" placeholder="opsional, cth. masak sarapan" />
          </label>
          <button class="btn btn--peach btn--block" type="submit">Kurangi Stok</button>
        </form>`;
      const form = selectedBox.querySelector('[data-out]');
      form.querySelectorAll('[data-step]').forEach((b) =>
        b.addEventListener('click', () => {
          form.qty.value = Math.max(1, (Number(form.qty.value) || 0) + Number(b.dataset.step));
        })
      );
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          const updated = inv.stockOut(selected.id, form.qty.value, form.note.value || 'Pemakaian');
          const low = updated.minStock > 0 && updated.qty < updated.minStock;
          toast(low ? `⚠️ Sisa ${number(updated.qty)} — masuk daftar belanja` : `✅ Sisa stok ${number(updated.qty)} ${updated.unit}`, low ? 'warn' : 'ok');
          selectedBox.innerHTML = '';
          selected = null;
          renderHistory();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      form.qty.focus();
    };

    el.querySelector('[data-scan]').addEventListener('click', async () => {
      const code = await scanBarcode({ title: 'Scan Barang Keluar' });
      if (!code) return;
      const item = inv.findByBarcode(code);
      if (item) select(item);
      else {
        selectedBox.innerHTML = `<div class="card">${emptyState('🤔', 'Barcode belum terdaftar', `Kode ${code} belum ada di inventory.`, `<a class="btn btn--primary" href="#/inventory/input">Daftarkan Barang</a>`)}</div>`;
      }
    });

    el.querySelector('[data-search]').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) return (results.innerHTML = '');
      const found = inv.listItems().filter((i) => i.name.toLowerCase().includes(q)).slice(0, 6);
      results.innerHTML = found.length
        ? found.map((i) => `<button class="pick" data-pick="${i.id}">${itemCard(i)}</button>`).join('')
        : `<p class="muted small center">Tidak ditemukan</p>`;
      results.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => select(inv.getItem(b.dataset.pick))));
    });

    renderHistory();
  },
};
