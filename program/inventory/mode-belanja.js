/**
 * Mode Belanja — dipakai saat berbelanja di toko / supermarket.
 * Scan barcode (terus-menerus) atau input manual → keranjang dengan
 * jumlah & harga → "Selesai & Bayar": stok bertambah, pengeluaran
 * tercatat, dan tersimpan di Riwayat Belanja.
 */
import { pageHeader, esc, toast, openSheet, bindMoneyInput, options, confirmDialog, emptyState, formData } from '../../service/ui.service.js';
import { scanBarcode } from '../../service/barcode.service.js';
import { rupiah, number, parseNumber, today } from '../../service/format.service.js';
import * as inv from '../../service/inventory.service.js';
import * as fin from '../../service/finance.service.js';
import * as shop from '../../service/shopping.service.js';
import { navigate } from '../../service/router.service.js';

export default {
  path: '/inventory/mode-belanja',
  title: 'Mode Belanja',
  autoRefresh: false,
  render(el) {
    const draw = () => {
      const s = shop.getSession();
      const pending = shop.pendingFromList();
      const stores = shop.recentStores();

      el.innerHTML = `
        ${pageHeader({ title: 'Mode Belanja', subtitle: 'Scan / input barang yang kamu ambil', emoji: '🛍️', tone: 'peach', back: '#/inventory' })}

        <div class="card shop-store">
          <label class="field"><span>Belanja di</span>
            <input class="input" data-store maxlength="40" value="${esc(s.store)}" placeholder="cth. Indomaret, Superindo, Pasar" list="store-list" />
            <datalist id="store-list">${options(stores)}</datalist>
          </label>
          ${stores.length ? `<div class="chips">${stores.map((x) => `<button class="chip ${x === s.store ? 'chip--on' : ''}" data-pick-store="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
        </div>

        <div class="shop-actions">
          <button class="scan-cta tone-peach" data-scan>
            <span class="scan-cta__icon">📷</span>
            <span><strong>Scan Barang</strong><small>Scan terus, tutup kamera bila selesai</small></span>
          </button>
          <button class="btn btn--soft btn--block" data-manual>✍️ Input Manual</button>
        </div>

        <section class="card">
          <div class="card__head"><h2>🛒 Keranjang (${s.items.length})</h2>
            ${s.items.length ? `<button class="link small" data-discard>Kosongkan</button>` : ''}</div>
          ${
            s.items.length
              ? `<ul class="shop-list">${s.items
                  .map(
                    (i) => `
                <li data-row="${i.itemId}">
                  <div class="shop-list__top">
                    <div class="grow">
                      <strong>${esc(i.name)}</strong>
                      ${i.stocked ? `<small class="muted">✓ stok sudah ditambah</small>` : ''}
                    </div>
                    <button class="icon-btn icon-btn--plain icon-btn--sm" data-remove="${i.itemId}" aria-label="Hapus ${esc(i.name)}">✕</button>
                  </div>
                  <div class="shop-list__bottom">
                    <div class="stepper stepper--sm">
                      <button type="button" class="btn btn--soft" data-step="-1" data-id="${i.itemId}" aria-label="Kurangi">−</button>
                      <span class="stepper__val">${number(i.qty)} <small>${esc(i.unit)}</small></span>
                      <button type="button" class="btn btn--soft" data-step="1" data-id="${i.itemId}" aria-label="Tambah">+</button>
                    </div>
                    <div class="money money--sm shop-price"><span>@Rp</span><input data-price="${i.itemId}" inputmode="numeric" placeholder="0" value="${i.price ? Number(i.price).toLocaleString('id-ID') : ''}" /></div>
                  </div>
                  <div class="shop-list__sub" data-sub="${i.itemId}">${i.price ? rupiah(i.qty * i.price) : 'harga belum diisi'}</div>
                </li>`
                  )
                  .join('')}</ul>`
              : emptyState('🛒', 'Keranjang kosong', 'Scan barcode atau input manual barang yang kamu ambil.')
          }
        </section>

        ${
          pending.length
            ? `<section class="card">
                <div class="card__head"><h2>📋 Dari daftar belanja</h2><span class="muted small">${pending.length} belum diambil</span></div>
                <ul class="mini-list">
                  ${pending
                    .map(
                      (i) => `<li><span>${inv.categoryInfo(i.category).emoji} ${esc(i.name)} <small class="muted">· perlu ${number(i.needed)} ${esc(i.unit)}</small></span>
                        <button class="btn btn--soft btn--sm" data-take="${i.id}">+ Ambil</button></li>`
                    )
                    .join('')}
                </ul>
              </section>`
            : ''
        }

        <a class="link-card" href="#/inventory/riwayat-belanja">🧾 Riwayat belanja <span>›</span></a>

        ${
          s.items.length
            ? `<div class="bottom-bar">
                <div><small class="muted">${s.items.length} barang</small><strong data-total>${rupiah(shop.sessionTotal(s))}</strong></div>
                <button class="btn btn--peach" data-checkout>✅ Selesai & Bayar</button>
              </div>`
            : ''
        }`;

      bind();
    };

    const bind = () => {
      const storeInput = el.querySelector('[data-store]');
      storeInput.addEventListener('change', () => shop.setSessionStore(storeInput.value));
      el.querySelectorAll('[data-pick-store]').forEach((b) =>
        b.addEventListener('click', () => {
          shop.setSessionStore(b.dataset.pickStore);
          draw();
        })
      );

      el.querySelector('[data-scan]').addEventListener('click', scanLoop);
      el.querySelector('[data-manual]').addEventListener('click', manualInput);

      el.querySelectorAll('[data-step]').forEach((b) =>
        b.addEventListener('click', () => {
          const row = shop.getSession().items.find((i) => i.itemId === b.dataset.id);
          shop.setSessionQty(b.dataset.id, Math.max(0, row.qty + Number(b.dataset.step)));
          draw();
        })
      );
      el.querySelectorAll('[data-remove]').forEach((b) =>
        b.addEventListener('click', () => {
          shop.removeFromSession(b.dataset.remove);
          draw();
        })
      );
      // harga: perbarui subtotal & total tanpa render ulang (supaya keyboard tidak tertutup)
      el.querySelectorAll('[data-price]').forEach((input) => {
        bindMoneyInput(input);
        input.addEventListener('input', () => {
          const id = input.dataset.price;
          shop.setSessionPrice(id, parseNumber(input.value));
          const row = shop.getSession().items.find((i) => i.itemId === id);
          el.querySelector(`[data-sub="${id}"]`).textContent = row.price ? rupiah(row.qty * row.price) : 'harga belum diisi';
          el.querySelector('[data-total]').textContent = rupiah(shop.sessionTotal());
        });
      });
      el.querySelectorAll('[data-take]').forEach((b) =>
        b.addEventListener('click', () => {
          const item = inv.shoppingList().find((i) => i.id === b.dataset.take);
          shop.addToSession(item, item.needed);
          toast(`🛒 ${item.name} ×${number(item.needed)}`);
          draw();
        })
      );
      el.querySelector('[data-discard]')?.addEventListener('click', async () => {
        if (!(await confirmDialog('Kosongkan keranjang? Barang yang sudah di-scan akan dihapus dari keranjang.', { okText: 'Kosongkan', danger: true }))) return;
        shop.discardSession();
        draw();
      });
      el.querySelector('[data-checkout]')?.addEventListener('click', checkout);
    };

    /** Scan terus-menerus: kamera tetap terbuka, tiap barcode langsung masuk keranjang. */
    const scanLoop = async () => {
      const unknown = await scanBarcode({
        title: 'Scan Belanja',
        continuous: true,
        onCode: (code) => {
          const item = inv.findByBarcode(code);
          if (!item) return { stop: true }; // barcode baru → tutup kamera & isi data barang
          const row = shop.addToSession(item, 1);
          return { message: `✅ ${item.name} ×${number(row.qty)}` };
        },
      });
      draw();
      if (unknown) newItem({ barcode: unknown });
    };

    /** Cari barang yang sudah ada, atau buat barang baru. */
    const manualInput = () => {
      const sheet = openSheet({
        title: 'Input Manual',
        body: `
          <input class="input" data-q placeholder="🔍 Cari nama barang…" autocomplete="off" />
          <div class="list list--compact" data-results></div>
          <button class="btn btn--soft btn--block" data-new>➕ Barang baru (belum terdaftar)</button>`,
      });
      const q = sheet.el.querySelector('[data-q]');
      const results = sheet.el.querySelector('[data-results]');
      const show = () => {
        const term = q.value.trim().toLowerCase();
        const found = inv.listItems().filter((i) => !term || i.name.toLowerCase().includes(term)).slice(0, 8);
        results.innerHTML = found
          .map((i) => `<button class="pick-row" data-pick="${i.id}"><span>${inv.categoryInfo(i.category).emoji} ${esc(i.name)}</span><small>${i.price ? rupiah(i.price) : ''}</small></button>`)
          .join('') || `<p class="muted small center">Tidak ditemukan — tambahkan sebagai barang baru.</p>`;
        results.querySelectorAll('[data-pick]').forEach((b) =>
          b.addEventListener('click', () => {
            const item = inv.getItem(b.dataset.pick);
            const row = shop.addToSession(item, 1);
            toast(`🛒 ${item.name} ×${number(row.qty)}`);
            sheet.close();
            draw();
          })
        );
      };
      q.addEventListener('input', show);
      sheet.el.querySelector('[data-new]').addEventListener('click', () => {
        const name = q.value.trim();
        sheet.close();
        setTimeout(() => newItem({ name }), 260);
      });
      show();
      setTimeout(() => q.focus(), 300);
    };

    /** Form barang baru (barcode belum terdaftar / input manual). */
    const newItem = ({ barcode = '', name = '' }) => {
      const cats = inv.getCategories();
      const sheet = openSheet({
        title: 'Barang Baru',
        body: `
          <form class="form" data-new-item autocomplete="off">
            ${barcode ? `<p class="notice tone-sky">🆕 Barcode <b>${esc(barcode)}</b> belum terdaftar. Lengkapi datanya ya.</p>` : ''}
            <label class="field"><span>Nama barang *</span><input class="input" name="name" required value="${esc(name)}" placeholder="cth. Gula Pasir 1kg" /></label>
            <div class="grid-2">
              <label class="field"><span>Jumlah dibeli</span><input class="input" name="qty" type="number" inputmode="decimal" min="0" step="any" value="1" /></label>
              <label class="field"><span>Satuan</span><select class="input" name="unit">${options(inv.getUnits(), 'pcs')}</select></label>
            </div>
            <label class="field"><span>Harga satuan</span>
              <div class="money money--sm"><span>Rp</span><input name="price" inputmode="numeric" placeholder="0" /></div>
            </label>
            <div class="grid-2">
              <label class="field"><span>Kategori</span><select class="input" name="category">${options(cats, 'Makanan', { valueKey: 'name', labelKey: (c) => `${c.emoji} ${c.name}` })}</select></label>
              <label class="field"><span>Disimpan di</span><select class="input" name="location"><option value="">— nanti saja —</option>${inv
                .getLocations()
                .map((l) => `<option value="${esc(l)}">${esc(inv.locationEmoji(l))} ${esc(l)}</option>`)
                .join('')}</select></label>
            </div>
            <label class="field"><span>Minimum stok</span><input class="input" name="minStock" type="number" inputmode="decimal" min="0" step="any" value="1" /></label>
            <button class="btn btn--peach btn--block" type="submit">🛒 Masukkan Keranjang</button>
          </form>`,
      });
      const form = sheet.el.querySelector('[data-new-item]');
      bindMoneyInput(form.price);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = formData(form);
        try {
          const price = parseNumber(d.price);
          const { item } = inv.saveItem({ ...d, barcode, qty: 0, price });
          shop.addToSession(item, Number(d.qty) || 1, price);
          sheet.close();
          toast(`🆕 ${item.name} terdaftar & masuk keranjang`);
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      setTimeout(() => (name ? form.price : form.name).focus(), 300);
    };

    /** Selesai & bayar. */
    const checkout = () => {
      const s = shop.getSession();
      const store = el.querySelector('[data-store]').value.trim();
      shop.setSessionStore(store);
      const cats = fin.getCategories('expense');
      const category = (cats.find((c) => c.name === 'Belanja Dapur') || cats[0]).name;
      const accounts = fin.listAccounts('asset');
      const accountId = (accounts.find((a) => fin.LIQUID_GROUPS.includes(a.group)) || accounts[0])?.id;
      const total = shop.sessionTotal(s);
      const noPrice = s.items.filter((i) => !i.price).length;

      const sheet = openSheet({
        title: '✅ Selesai Belanja',
        body: `
          <form class="form" data-pay autocomplete="off">
            <p class="muted small">${s.items.length} barang${store ? ` di <b>${esc(store)}</b>` : ''} · stok akan otomatis bertambah.${noPrice ? ` ${noPrice} barang belum ada harganya.` : ''}</p>
            <label class="field"><span>Total dibayar (sesuai struk)</span>
              <div class="money tone-peach"><span>Rp</span><input name="total" inputmode="numeric" placeholder="0" value="${total ? total.toLocaleString('id-ID') : ''}" /></div>
            </label>
            <label class="switch-row"><input type="checkbox" name="record" checked /> <span>Catat sebagai pengeluaran di Keuangan</span></label>
            <div class="grid-2" data-exp>
              <label class="field"><span>Kategori</span><select class="input" name="category">${options(cats, category, { valueKey: 'name', labelKey: (c) => `${c.emoji} ${c.name}` })}</select></label>
              <label class="field"><span>Dibayar dari</span><select class="input" name="accountId">${options(accounts, accountId, { valueKey: 'id', labelKey: (a) => `${fin.accountIcon(a)} ${a.name}` })}</select></label>
            </div>
            <div class="grid-2">
              <label class="field"><span>Tanggal</span><input class="input" type="date" name="date" value="${today()}" required /></label>
              <label class="field"><span>Catatan</span><input class="input" name="note" maxlength="80" placeholder="${esc(shop.defaultNote(s.items, store))}" /></label>
            </div>
            <button class="btn btn--peach btn--block" type="submit">💾 Simpan Belanja</button>
          </form>`,
      });
      const form = sheet.el.querySelector('[data-pay]');
      bindMoneyInput(form.total);
      form.record.addEventListener('change', () => sheet.el.querySelector('[data-exp]').classList.toggle('hidden', !form.record.checked));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          const trip = shop.checkout({
            total: parseNumber(form.total.value),
            accountId: form.accountId.value,
            category: form.category.value,
            date: form.date.value,
            note: form.note.value,
            store,
            recordExpense: form.record.checked,
          });
          sheet.close();
          toast(`✅ Belanja ${rupiah(trip.total)} tersimpan, stok bertambah`);
          navigate('/inventory/riwayat-belanja');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    };

    draw();
  },
};
