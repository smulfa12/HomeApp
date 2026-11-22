/**
 * 5. Daftar Barang per Lokasi
 * Barang dikelompokkan sesuai tempat penyimpanannya.
 */
import { pageHeader, esc, emptyState } from '../../service/ui.service.js';
import * as inv from '../../service/inventory.service.js';
import { itemCard } from '../shared/item-card.js';

const TONES = ['mint', 'peach', 'sky', 'lavender', 'butter', 'rose'];

export default {
  path: '/inventory/lokasi',
  title: 'Items by Location',
  render(el, params) {
    const groups = inv.groupByLocation();
    // urutan mengikuti menu Atur Lokasi; "Belum ditentukan" di akhir
    const order = inv.getLocations();
    const names = Object.keys(groups).sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999));
    let active = params.loc && groups[params.loc] ? params.loc : null;
    let query = '';

    el.innerHTML = `
      ${pageHeader({ title: 'Items by Location', subtitle: `${names.length} lokasi penyimpanan`, emoji: '🗂️', tone: 'butter', back: '#/inventory' })}
      ${
        !names.length
          ? `<div class="card">${emptyState('🗂️', 'Belum ada barang', 'Barang yang kamu input akan muncul di sini.', `<a class="btn btn--primary" href="#/inventory/input">Input Barang</a>`)}</div>`
          : `
        <div class="loc-grid">
          ${names
            .map(
              (n, idx) => `
            <button class="loc-tile tone-${TONES[idx % TONES.length]}" data-loc="${esc(n)}">
              <span class="loc-tile__emoji">${esc(inv.locationEmoji(n))}</span>
              <span class="loc-tile__name">${esc(n)}</span>
              <span class="loc-tile__count">${groups[n].length} barang</span>
            </button>`
            )
            .join('')}
        </div>
        <a class="link small" href="#/inventory/lokasi-atur?from=lokasi">⚙️ Atur lokasi (tambah / ganti nama / urutkan)</a>
        <input class="input" data-search placeholder="🔍 Cari barang…" />
        <div data-groups></div>`
      }`;

    const box = el.querySelector('[data-groups]');
    if (!box) return;

    const draw = () => {
      const shown = active ? [active] : names;
      box.innerHTML = shown
        .map((n) => {
          const rows = groups[n].filter((i) => !query || i.name.toLowerCase().includes(query));
          if (!rows.length) return '';
          return `
          <section class="card">
            <div class="card__head"><h2>${esc(inv.locationEmoji(n))} ${esc(n)}</h2><span class="muted small">${rows.length} barang</span></div>
            <div class="list">${rows.map((i) => itemCard(i, { showLocation: false, href: `#/inventory/input?id=${i.id}` })).join('')}</div>
          </section>`;
        })
        .join('') || `<p class="muted center">Tidak ada barang yang cocok.</p>`;
      el.querySelectorAll('[data-loc]').forEach((t) => t.classList.toggle('loc-tile--on', t.dataset.loc === active));
    };

    el.querySelectorAll('[data-loc]').forEach((t) =>
      t.addEventListener('click', () => {
        active = active === t.dataset.loc ? null : t.dataset.loc;
        draw();
      })
    );
    el.querySelector('[data-search]').addEventListener('input', (e) => {
      query = e.target.value.trim().toLowerCase();
      draw();
    });
    draw();
  },
};
