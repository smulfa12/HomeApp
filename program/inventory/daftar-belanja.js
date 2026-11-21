/**
 * 4. Daftar Belanja
 * Semua barang dengan stok < minimum stok. Bisa dicentang saat sudah
 * dibeli (stok otomatis bertambah) dan dibagikan via WhatsApp.
 * Barang yang sudah dibeli masuk keranjang → dicatat sebagai pengeluaran.
 */
import { pageHeader, esc, toast, emptyState, openSheet, bindMoneyInput, options, confirmDialog } from '../../service/ui.service.js';
import * as inv from '../../service/inventory.service.js';
import * as fin from '../../service/finance.service.js';
import { number, rupiah, dateLabel, today, parseNumber } from '../../service/format.service.js';

/** Sheet untuk mencatat isi keranjang belanja sebagai pengeluaran. */
function openRecordSheet(onDone) {
  const cart = inv.getCart();
  const cats = fin.getCategories('expense');
  const category = (cats.find((c) => c.name === 'Belanja Dapur') || cats[0]).name;
  const accounts = fin.listAccounts('asset');
  const liquid = accounts.filter((a) => fin.LIQUID_GROUPS.includes(a.group));
  const accountId = (liquid[0] || accounts[0])?.id;
  const names = cart.map((c) => c.name);
  const note = `Belanja: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` +${names.length - 4} lainnya` : ''}`;

  const sheet = openSheet({
    title: '🧾 Catat Pengeluaran Belanja',
    body: `
      <form class="form" data-rec autocomplete="off">
        <p class="muted small">Isi harga satuan sesuai struk (opsional) — harga ini juga dipakai untuk estimasi belanja berikutnya.</p>
        <ul class="cart-list">
          ${cart
            .map(
              (c, i) => `
            <li>
              <div class="grow"><strong>${esc(c.name)}</strong><small>${number(c.qty)} ${esc(c.unit)} × harga</small></div>
              <div class="money money--sm cart-price"><span>Rp</span><input data-price="${i}" inputmode="numeric" placeholder="0" value="${c.price ? Number(c.price).toLocaleString('id-ID') : ''}" /></div>
            </li>`
            )
            .join('')}
        </ul>
        <label class="field"><span>Total dibayar (sesuai struk)</span>
          <div class="money tone-peach"><span>Rp</span><input name="total" inputmode="numeric" required placeholder="0" /></div>
        </label>
        <div class="grid-2">
          <label class="field"><span>Kategori</span>
            <select class="input" name="category">${options(cats, category, { valueKey: 'name', labelKey: (c) => `${c.emoji} ${c.name}` })}</select>
          </label>
          <label class="field"><span>Dibayar dari</span>
            <select class="input" name="accountId">${options(accounts, accountId, { valueKey: 'id', labelKey: (a) => `${fin.accountIcon(a)} ${a.name}` })}</select>
          </label>
        </div>
        <div class="grid-2">
          <label class="field"><span>Tanggal</span><input class="input" type="date" name="date" value="${today()}" required /></label>
          <label class="field"><span>Catatan</span><input class="input" name="note" maxlength="80" value="${esc(note)}" /></label>
        </div>
        <button class="btn btn--peach btn--block" type="submit">💾 Simpan sebagai Pengeluaran</button>
        <button class="btn btn--ghost btn--block" type="button" data-skip>Lewati (tidak dicatat)</button>
      </form>`,
  });

  const form = sheet.el.querySelector('[data-rec]');
  const priceInputs = [...form.querySelectorAll('[data-price]')];
  let totalTouched = false;
  const recalc = () => {
    if (totalTouched) return;
    const sum = priceInputs.reduce((s, inp) => s + cart[inp.dataset.price].qty * parseNumber(inp.value), 0);
    form.total.value = sum ? sum.toLocaleString('id-ID') : '';
  };
  priceInputs.forEach((inp) => {
    bindMoneyInput(inp);
    inp.addEventListener('input', recalc);
  });
  bindMoneyInput(form.total);
  form.total.addEventListener('input', () => (totalTouched = true));
  recalc();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      fin.addTransaction({
        type: 'expense',
        amount: parseNumber(form.total.value),
        category: form.category.value,
        accountId: form.accountId.value,
        date: form.date.value,
        note: form.note.value,
        source: 'belanja',
      });
      priceInputs.forEach((inp) => inv.updateItemPrice(cart[inp.dataset.price].itemId, parseNumber(inp.value)));
      inv.clearCart();
      sheet.close();
      toast(`✅ Pengeluaran ${rupiah(parseNumber(form.total.value))} tercatat`);
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  form.querySelector('[data-skip]').addEventListener('click', async () => {
    sheet.close();
    if (!(await confirmDialog('Kosongkan keranjang tanpa mencatat pengeluaran? Stok barang tetap sudah bertambah.', { okText: 'Lewati' }))) return;
    inv.clearCart();
    onDone();
  });
}

export default {
  path: '/inventory/belanja',
  title: 'Daftar Belanja',
  render(el) {
    const draw = () => {
      const list = inv.shoppingList();
      const estimate = list.reduce((s, i) => s + i.needed * (i.price || 0), 0);
      const byCat = {};
      list.forEach((i) => (byCat[i.category] ||= []).push(i));

      el.innerHTML = `
        ${pageHeader({ title: 'Daftar Belanja', subtitle: 'Barang yang stoknya di bawah minimum', emoji: '🛒', tone: 'rose', back: '#/inventory' })}
        ${
          !list.length
            ? `<div class="card">${emptyState('🎉', 'Semua stok aman!', 'Tidak ada barang di bawah minimum stok.', `<a class="btn btn--soft" href="#/inventory/opname">Lakukan Stock Opname</a>`)}</div>`
            : `
          <section class="stat-row">
            <div class="stat tone-rose"><span>Perlu dibeli</span><strong>${list.length}</strong></div>
            <div class="stat tone-butter"><span>Estimasi biaya</span><strong class="small-num">${estimate ? rupiah(estimate) : '-'}</strong></div>
          </section>
          <div class="row gap-sm">
            <button class="btn btn--soft grow" data-share>💬 Kirim ke WhatsApp</button>
            <button class="btn btn--soft grow" data-copy>📋 Salin</button>
          </div>
          ${Object.entries(byCat)
            .map(
              ([cat, rows]) => `
            <section class="card">
              <div class="card__head"><h2>${inv.categoryInfo(cat).emoji} ${esc(cat)}</h2><span class="muted small">${rows.length} barang</span></div>
              <ul class="check-list">
                ${rows
                  .map(
                    (i) => `
                  <li>
                    <button class="check" data-buy="${i.id}" aria-label="Tandai ${esc(i.name)} sudah dibeli"></button>
                    <div class="grow">
                      <div class="item-card__title">${esc(i.name)}</div>
                      <div class="muted small">Sisa ${number(i.qty)} / min ${number(i.minStock)} ${esc(i.unit)}${i.location ? ` · 📍${esc(i.location)}` : ''}</div>
                    </div>
                    <div class="buy-qty"><small>beli</small><strong>${number(i.needed)}</strong><small>${esc(i.unit)}</small></div>
                  </li>`
                  )
                  .join('')}
              </ul>
            </section>`
            )
            .join('')}
          <p class="muted small center">Centang ✓ barang yang sudah dibeli untuk menambah stoknya.</p>`
        }`;

      const text = () =>
        `🛒 *Daftar Belanja* (${dateLabel(today())})\n\n` +
        list.map((i, n) => `${n + 1}. ${i.name} — ${number(i.needed)} ${i.unit}`).join('\n') +
        (estimate ? `\n\nEstimasi: ${rupiah(estimate)}` : '');

      el.querySelector('[data-share]')?.addEventListener('click', () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, '_blank');
      });
      el.querySelector('[data-copy]')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text());
          toast('📋 Daftar belanja disalin');
        } catch {
          toast('Gagal menyalin', 'error');
        }
      });
      el.querySelectorAll('[data-buy]').forEach((b) =>
        b.addEventListener('click', () => {
          const item = list.find((i) => i.id === b.dataset.buy);
          b.classList.add('check--on');
          inv.stockIn(item.id, item.needed, 'Belanja');
          inv.addToCart(item, item.needed);
          toast(`✅ ${item.name} +${number(item.needed)} ${item.unit}`);
          setTimeout(draw, 350);
        })
      );

      // Bar keranjang: barang yang sudah dibeli → catat sebagai pengeluaran
      const cart = inv.getCart();
      if (cart.length) {
        const total = inv.cartTotal(cart);
        const bar = document.createElement('div');
        bar.className = 'bottom-bar cart-bar';
        bar.innerHTML = `
          <div><small class="muted">🛍️ ${cart.length} barang dibeli</small><strong>${total ? rupiah(total) : 'Rp —'}</strong></div>
          <button class="btn btn--peach" data-record>🧾 Catat Pengeluaran</button>`;
        el.appendChild(bar);
        bar.querySelector('[data-record]').addEventListener('click', () => openRecordSheet(draw));
      }
    };
    draw();
  },
};
