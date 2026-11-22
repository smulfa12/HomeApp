/**
 * 4. Daftar Belanja
 * Semua barang dengan stok < minimum stok. Centang = masukkan ke keranjang
 * Mode Belanja (stok bertambah & pengeluaran dicatat saat "Selesai & Bayar").
 * Bisa dibagikan via WhatsApp.
 */
import { pageHeader, esc, toast, emptyState } from '../../service/ui.service.js';
import * as inv from '../../service/inventory.service.js';
import * as shop from '../../service/shopping.service.js';
import { number, rupiah, dateLabel, today } from '../../service/format.service.js';

export default {
  path: '/inventory/belanja',
  title: 'Shopping List',
  render(el) {
    const draw = () => {
      const list = inv.shoppingList();
      const estimate = list.reduce((s, i) => s + i.needed * (i.price || 0), 0);
      const byCat = {};
      list.forEach((i) => (byCat[i.category] ||= []).push(i));

      el.innerHTML = `
        ${pageHeader({ title: 'Shopping List', subtitle: 'Barang yang stoknya di bawah minimum', emoji: '🛒', tone: 'rose', back: '#/inventory' })}
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
          <p class="muted small center">Centang ✓ barang yang sudah diambil → masuk keranjang Shopping Mode. Stok bertambah saat “Selesai & Bayar”.</p>`
        }`;

      const text = () =>
        `🛒 *Shopping List* (${dateLabel(today())})\n\n` +
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
      // Centang = masuk / keluar keranjang Mode Belanja
      const inCart = new Set(shop.getSession().items.map((i) => i.itemId));
      el.querySelectorAll('[data-buy]').forEach((b) => {
        b.classList.toggle('check--on', inCart.has(b.dataset.buy));
        b.addEventListener('click', () => {
          const item = list.find((i) => i.id === b.dataset.buy);
          if (inCart.has(item.id)) {
            shop.removeFromSession(item.id);
            toast(`↩️ ${item.name} dikeluarkan dari keranjang`);
          } else {
            shop.addToSession(item, item.needed);
            toast(`🛒 ${item.name} ×${number(item.needed)} masuk keranjang`);
          }
          draw();
        });
      });

      // Mulai / lanjutkan Mode Belanja
      const s = shop.getSession();
      const bar = document.createElement('div');
      bar.className = 'bottom-bar cart-bar';
      bar.innerHTML = s.items.length
        ? `<div><small class="muted">🛒 ${s.items.length} di keranjang</small><strong>${rupiah(shop.sessionTotal(s))}</strong></div>
           <a class="btn btn--peach" href="#/inventory/mode-belanja">🛍️ Lanjut Belanja</a>`
        : `<div><small class="muted">Sedang di toko?</small><strong>Shopping Mode</strong></div>
           <a class="btn btn--peach" href="#/inventory/mode-belanja">🛍️ Mulai Belanja</a>`;
      el.appendChild(bar);
    };
    draw();
  },
};
