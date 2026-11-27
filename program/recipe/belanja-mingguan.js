/**
 * Weekly Shopping — bahan semua masakan di rencana menu N hari ke depan,
 * dicocokkan dengan stok Inventory → yang kurang masuk keranjang Shopping Mode.
 */
import { pageHeader, esc, toast, emptyState } from '../../service/ui.service.js';
import { number } from '../../service/format.service.js';
import * as rcp from '../../service/recipe.service.js';
import * as inv from '../../service/inventory.service.js';
import * as shop from '../../service/shopping.service.js';
import { navigate } from '../../service/router.service.js';

const STATUS = { out: ['⚠️', 'habis', 'danger'], low: ['🟡', 'menipis', 'warn'], short: ['🟠', 'kurang', 'warn'] };

export default {
  path: '/resep/belanja',
  title: 'Weekly Shopping',
  render(el) {
    let days = Number(sessionStorage.getItem('weekly-days')) || 7;
    const picked = new Set(); // key bahan yang dicentang
    let touched = false;

    const draw = () => {
      const w = rcp.weeklyShopping(days);
      if (!touched) w.buy.forEach((g) => picked.add(g.key)); // default: yang kurang dicentang
      const count = w.buy.filter((g) => picked.has(g.key)).length + w.untracked.filter((g) => picked.has(g.key)).length;
      const used = (g) => `<small>${esc(g.recipes.join(', '))}${g.need.length ? ` · butuh ${esc(rcp.needText(g.need))}` : ''}</small>`;
      const check = (g, extra = '') => `
        <li><label class="weekly-row">
          <input type="checkbox" data-pick="${esc(g.key)}" ${picked.has(g.key) ? 'checked' : ''} />
          <span class="weekly-row__main"><b>${esc(g.name)}</b>${used(g)}</span>
          ${extra}
        </label></li>`;

      el.innerHTML = `
        ${pageHeader({ title: 'Weekly Shopping', subtitle: 'Bahan dari rencana menu vs stok di rumah', emoji: '🛒', tone: 'peach', back: '#/resep' })}
        <div class="chips">${[3, 7, 14].map((d) => `<button class="chip ${d === days ? 'chip--on' : ''}" data-days="${d}">${d} hari</button>`).join('')}</div>
        ${!w.meals.length
          ? `<section class="card">${emptyState('📅', 'Belum ada jadwal masak', `Tidak ada masakan terjadwal ${days} hari ke depan. Buka resep → 📅 Jadwalkan masak.`, '<a class="btn btn--primary" href="#/resep">🍳 Buka Recipes</a>')}</section>`
          : `
        <section class="card">
          <div class="kv"><span>Masakan terjadwal</span><strong>${w.meals.length}×</strong></div>
          <div class="kv"><span>Bahan berbeda</span><strong>${w.buy.length + w.untracked.length + w.ok.length}</strong></div>
          <p class="muted small">${[...new Set(w.meals.map((m) => `${m.recipe.emoji || '🍳'} ${m.recipe.name}`))].map(esc).join(' · ')}</p>
        </section>

        <section class="card">
          <h2>🛒 Perlu dibeli <span class="muted small">(${w.buy.length})</span></h2>
          ${w.buy.length
            ? `<ul class="weekly-list">${w.buy.map((g) => {
                const [ico, label, tone] = STATUS[g.status];
                return check(g, `<span class="weekly-row__side"><span class="badge badge--${tone}">${ico} ${label}</span><small>sisa ${number(g.item.qty)} ${esc(g.item.unit)} · beli ${g.suggest}</small></span>`);
              }).join('')}</ul>`
            : '<p class="muted small">Semua bahan yang tercatat di Inventory stoknya cukup 👍</p>'}
        </section>

        ${w.untracked.length ? `
        <section class="card">
          <h2>❔ Belum ada di Inventory <span class="muted small">(${w.untracked.length})</span></h2>
          <p class="muted small">Centang yang mau dibeli: otomatis didaftarkan ke Inventory (stok 0) lalu masuk keranjang.</p>
          <ul class="weekly-list">${w.untracked.map((g) => check(g)).join('')}</ul>
        </section>` : ''}

        ${w.ok.length ? `
        <section class="card">
          <h2>✅ Stok cukup <span class="muted small">(${w.ok.length})</span></h2>
          <ul class="mini-list">${w.ok.map((g) => `<li><span>${esc(g.name)}<small class="muted"> · ${esc(g.recipes.join(', '))}</small></span><span class="muted small">${number(g.item.qty)} ${esc(g.item.unit)}</span></li>`).join('')}</ul>
        </section>` : ''}

        <div class="bottom-bar">
          <span><b>${count}</b> barang dipilih</span>
          <button class="btn btn--primary" data-go ${count ? '' : 'disabled'}>🛒 Masukkan ke keranjang</button>
        </div>`}`;

      el.querySelectorAll('[data-days]').forEach((b) =>
        b.addEventListener('click', () => {
          days = Number(b.dataset.days);
          sessionStorage.setItem('weekly-days', days);
          picked.clear();
          touched = false;
          draw();
        })
      );
      el.querySelectorAll('[data-pick]').forEach((c) =>
        c.addEventListener('change', () => {
          touched = true;
          c.checked ? picked.add(c.dataset.pick) : picked.delete(c.dataset.pick);
          draw();
        })
      );
      el.querySelector('[data-go]')?.addEventListener('click', () => {
        let n = 0;
        w.buy.filter((g) => picked.has(g.key)).forEach((g) => {
          shop.addToSession(g.item, g.suggest);
          n++;
        });
        w.untracked.filter((g) => picked.has(g.key)).forEach((g) => {
          const unit = g.need[0]?.unit === 'g' ? 'gram' : g.need[0]?.unit || 'pcs';
          const { item } = inv.saveItem({ name: g.name.replace(/^./, (c) => c.toUpperCase()), qty: 0, unit, category: 'Makanan' });
          shop.addToSession(item, 1);
          n++;
        });
        toast(`🛒 ${n} barang masuk keranjang Shopping Mode`);
        navigate('/inventory/mode-belanja');
      });
    };
    draw();
  },
};
