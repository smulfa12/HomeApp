/**
 * 1. Input Barang Inventory
 * Scan barcode → isi jumlah stok, kategori, kadaluarsa (bila makanan),
 * minimum stok, dan lokasi penyimpanan. Barcode yang sudah terdaftar
 * otomatis mengisi form dan stok akan ditambahkan.
 */
import { pageHeader, esc, options, formData, toast, confirmDialog } from '../../service/ui.service.js';
import { scanBarcode } from '../../service/barcode.service.js';
import * as inv from '../../service/inventory.service.js';
import { navigate } from '../../service/router.service.js';
import { number } from '../../service/format.service.js';

export default {
  path: '/inventory/input',
  title: 'Input Barang',
  render(el, params) {
    const editing = params.id ? inv.getItem(params.id) : null;
    let restockOf = null; // barang yang ditemukan lewat barcode

    el.innerHTML = `
      ${pageHeader({
        title: editing ? 'Edit Barang' : 'Input Barang',
        subtitle: editing ? 'Ubah data barang' : 'Scan barcode lalu lengkapi datanya',
        emoji: '📥',
        tone: 'mint',
        back: '#/inventory',
      })}

      ${editing ? '' : `
      <button class="scan-cta tone-mint" data-scan>
        <span class="scan-cta__icon">📷</span>
        <span><strong>Scan Barcode</strong><small>Ketuk untuk membuka kamera</small></span>
      </button>`}

      <div class="notice tone-sky hidden" data-notice></div>

      <form class="card form" data-form autocomplete="off">
        <label class="field">
          <span>Barcode</span>
          <div class="row gap-sm">
            <input class="input" name="barcode" inputmode="numeric" placeholder="Kode barcode (opsional)" />
            <button type="button" class="btn btn--soft btn--icon" data-scan aria-label="Scan">📷</button>
          </div>
        </label>
        <label class="field">
          <span>Nama barang *</span>
          <input class="input" name="name" required placeholder="cth. Beras Pandan Wangi 5kg" />
        </label>
        <div class="grid-2">
          <label class="field">
            <span data-qty-label>${editing ? 'Jumlah stok' : 'Jumlah stok'} *</span>
            <input class="input" name="qty" type="number" inputmode="decimal" min="0" step="any" required value="1" />
          </label>
          <label class="field">
            <span>Satuan</span>
            <select class="input" name="unit">${options(inv.getUnits(), 'pcs')}</select>
          </label>
        </div>
        <label class="field">
          <span>Kategori</span>
          <select class="input" name="category">
            ${options(inv.getCategories(), 'Makanan', { valueKey: 'name', labelKey: (c) => `${c.emoji} ${c.name}` })}
          </select>
        </label>
        <label class="field" data-expiry>
          <span>Tanggal kadaluarsa 🍱</span>
          <input class="input" name="expiry" type="date" />
        </label>
        <div class="grid-2">
          <label class="field">
            <span>Minimum stok</span>
            <input class="input" name="minStock" type="number" inputmode="decimal" min="0" step="any" value="1" />
          </label>
          <label class="field">
            <span>Harga satuan (Rp)</span>
            <input class="input" name="price" type="number" inputmode="numeric" min="0" placeholder="opsional" />
          </label>
        </div>
        <label class="field">
          <span>Penempatan barang</span>
          <input class="input" name="location" list="loc-list" placeholder="cth. Dapur, Kulkas, Gudang" />
          <datalist id="loc-list">${options(inv.getLocations())}</datalist>
        </label>
        <div class="chips chips--wrap" data-loc-chips>
          ${inv.getLocations().map((l) => `<button type="button" class="chip" data-loc="${esc(l)}">📍 ${esc(l)}</button>`).join('')}
        </div>

        <button class="btn btn--primary btn--block" type="submit">💾 Simpan Barang</button>
        ${editing ? `<button class="btn btn--danger-soft btn--block" type="button" data-delete>🗑️ Hapus Barang</button>` : ''}
      </form>`;

    const form = el.querySelector('[data-form]');
    const notice = el.querySelector('[data-notice]');
    const expiryField = el.querySelector('[data-expiry]');
    const qtyLabel = el.querySelector('[data-qty-label]');

    const toggleExpiry = () => expiryField.classList.toggle('hidden', !inv.isPerishable(form.category.value));
    form.category.addEventListener('change', toggleExpiry);

    const fill = (item) => {
      ['barcode', 'name', 'unit', 'category', 'expiry', 'minStock', 'location', 'price'].forEach((k) => {
        if (form[k] && item[k] != null) form[k].value = item[k] || '';
      });
      toggleExpiry();
    };

    if (editing) {
      fill(editing);
      form.qty.value = editing.qty;
    }
    toggleExpiry();

    const lookup = (code) => {
      form.barcode.value = code;
      restockOf = inv.findByBarcode(code);
      if (restockOf) {
        fill(restockOf);
        form.qty.value = 1;
        qtyLabel.textContent = 'Tambah stok sebanyak *';
        notice.innerHTML = `✨ <strong>${esc(restockOf.name)}</strong> sudah terdaftar (stok ${number(restockOf.qty)} ${esc(restockOf.unit)}). Isi jumlah yang ingin ditambahkan.`;
        notice.classList.remove('hidden');
      } else {
        qtyLabel.textContent = 'Jumlah stok *';
        notice.innerHTML = `🆕 Barcode baru. Lengkapi data barangnya ya.`;
        notice.classList.remove('hidden');
        form.name.focus();
      }
    };

    el.querySelectorAll('[data-scan]').forEach((b) =>
      b.addEventListener('click', async () => {
        const code = await scanBarcode({ title: 'Scan Barang Masuk' });
        if (code) lookup(code);
      })
    );
    form.barcode.addEventListener('change', () => !editing && form.barcode.value && lookup(form.barcode.value.trim()));

    el.querySelectorAll('[data-loc]').forEach((c) =>
      c.addEventListener('click', () => {
        form.location.value = c.dataset.loc;
        el.querySelectorAll('[data-loc]').forEach((x) => x.classList.toggle('chip--on', x === c));
      })
    );

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = formData(form);
      if (editing) data.id = editing.id;
      try {
        const { item, mode } = inv.saveItem(data);
        const msg = { created: 'Barang baru tersimpan', restocked: `Stok ${item.name} jadi ${number(item.qty)}`, updated: 'Perubahan tersimpan' }[mode];
        toast(`✅ ${msg}`);
        if (editing) navigate('/inventory/lokasi');
        else {
          form.reset();
          restockOf = null;
          qtyLabel.textContent = 'Jumlah stok *';
          notice.classList.add('hidden');
          toggleExpiry();
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    el.querySelector('[data-delete]')?.addEventListener('click', async () => {
      if (await confirmDialog(`Hapus "${editing.name}" dari inventory?`, { okText: 'Hapus', danger: true })) {
        inv.deleteItem(editing.id);
        toast('Barang dihapus');
        navigate('/inventory/lokasi');
      }
    });
  },
};
