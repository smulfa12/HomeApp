/**
 * 3. Stock Opname
 * Hitung ulang stok fisik sebelum belanja. Selisih otomatis disesuaikan,
 * lalu langsung bisa lanjut ke daftar belanja.
 */
import { pageHeader, esc, toast, emptyState } from '../../service/ui.service.js';
import { scanBarcode } from '../../service/barcode.service.js';
import * as inv from '../../service/inventory.service.js';
import { dateLabel, number } from '../../service/format.service.js';
import { navigate } from '../../service/router.service.js';

export default {
  path: '/inventory/opname',
  title: 'Stock Opname',
  render(el) {
    const items = inv.listItems();
    const counts = {};
    let filter = 'Semua';
    const last = inv.lastOpnameDate();

    if (!items.length) {
      el.innerHTML = `${pageHeader({ title: 'Stock Opname', emoji: '📋', tone: 'sky', back: '#/inventory' })}
        <div class="card">${emptyState('📦', 'Belum ada barang', 'Tambahkan barang dulu sebelum stock opname.', `<a class="btn btn--primary" href="#/inventory/input">Input Barang</a>`)}</div>`;
      return;
    }

    const locations = ['Semua', ...new Set(items.map((i) => i.location || 'Belum ditentukan'))];

    el.innerHTML = `
      ${pageHeader({ title: 'Stock Opname', subtitle: last ? `Terakhir: ${dateLabel(last)}` : 'Hitung stok fisik sebelum belanja', emoji: '📋', tone: 'sky', back: '#/inventory' })}

      <div class="notice tone-sky">💡 Isi jumlah fisik barang. Biarkan kosong jika sama dengan sistem.</div>

      <div class="row gap-sm sticky-tools">
        <button class="btn btn--soft grow" data-scan>📷 Scan untuk cari</button>
      </div>
      <div class="chips" data-filter>
        ${locations.map((l) => `<button class="chip ${l === filter ? 'chip--on' : ''}" data-loc="${esc(l)}">${esc(l)}</button>`).join('')}
      </div>

      <div class="list" data-list></div>

      <div class="bottom-bar">
        <div><small class="muted">Barang berubah</small><strong data-changed>0</strong></div>
        <button class="btn btn--sky" data-save>Simpan Opname</button>
      </div>`;

    const list = el.querySelector('[data-list]');
    const changedEl = el.querySelector('[data-changed]');

    const updateChanged = () => {
      changedEl.textContent = Object.entries(counts).filter(([id, v]) => v !== '' && Number(v) !== inv.getItem(id)?.qty).length;
    };

    const renderList = () => {
      const rows = items.filter((i) => filter === 'Semua' || (i.location || 'Belum ditentukan') === filter);
      list.innerHTML = rows
        .map(
          (i) => `
        <div class="opname-row" data-row="${i.id}">
          <div class="grow">
            <div class="item-card__title">${esc(i.name)}</div>
            <div class="muted small">Sistem: <strong>${number(i.qty)} ${esc(i.unit)}</strong> · min ${number(i.minStock)}${i.location ? ` · 📍${esc(i.location)}` : ''}</div>
          </div>
          <input class="input input--qty" type="number" inputmode="decimal" min="0" step="any" placeholder="${i.qty}"
                 value="${counts[i.id] ?? ''}" data-count="${i.id}" aria-label="Jumlah fisik ${esc(i.name)}" />
        </div>`
        )
        .join('');
      list.querySelectorAll('[data-count]').forEach((input) =>
        input.addEventListener('input', () => {
          counts[input.dataset.count] = input.value;
          const item = inv.getItem(input.dataset.count);
          input.classList.toggle('input--diff', input.value !== '' && Number(input.value) !== item.qty);
          updateChanged();
        })
      );
    };

    el.querySelectorAll('[data-loc]').forEach((c) =>
      c.addEventListener('click', () => {
        filter = c.dataset.loc;
        el.querySelectorAll('[data-loc]').forEach((x) => x.classList.toggle('chip--on', x === c));
        renderList();
      })
    );

    el.querySelector('[data-scan]').addEventListener('click', async () => {
      const code = await scanBarcode({ title: 'Scan untuk Opname' });
      if (!code) return;
      const item = inv.findByBarcode(code);
      if (!item) return toast('Barcode belum terdaftar', 'warn');
      filter = 'Semua';
      el.querySelectorAll('[data-loc]').forEach((x) => x.classList.toggle('chip--on', x.dataset.loc === 'Semua'));
      renderList();
      const input = list.querySelector(`[data-count="${item.id}"]`);
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.closest('.opname-row').classList.add('flash');
      input.focus();
    });

    el.querySelector('[data-save]').addEventListener('click', () => {
      const changed = inv.applyOpname(counts);
      const low = inv.shoppingList().length;
      toast(`✅ Opname tersimpan (${changed} barang disesuaikan)`);
      navigate(low ? '/inventory/belanja' : '/inventory');
    });

    renderList();
  },
};
