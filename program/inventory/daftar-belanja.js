/**
 * 4. Daftar Belanja
 * Semua barang dengan stok < minimum stok. Bisa dicentang saat sudah
 * dibeli (stok otomatis bertambah) dan dibagikan via WhatsApp.
 */
import { pageHeader, esc, toast, emptyState } from '../../service/ui.service.js';
import * as inv from '../../service/inventory.service.js';
import { number, rupiah, dateLabel, today } from '../../service/format.service.js';

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
          toast(`✅ ${item.name} +${number(item.needed)} ${item.unit}`);
          setTimeout(draw, 350);
        })
      );
    };
    draw();
  },
};
