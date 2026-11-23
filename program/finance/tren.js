/**
 * Trends — grafik pengeluaran per bulan & riwayat harga barang.
 */
import { pageHeader, esc, emptyState } from '../../service/ui.service.js';
import { rupiah, rupiahShort, monthLabel, dateLabel, thisMonth, number } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';
import * as trend from '../../service/trend.service.js';
import { can } from '../../service/access.service.js';
import { barChart, lineChart } from '../shared/chart.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const monShort = (ym) => MON[Number(ym.slice(5, 7)) - 1];
const STATE = 'tren-state';

/** Perubahan persen; naik = merah untuk pengeluaran & harga. */
function deltaBadge(now, before, { suffix = '' } = {}) {
  if (!before) return '';
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return `<span class="delta delta--flat">= sama${suffix}</span>`;
  return `<span class="delta delta--${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%${suffix}</span>`;
}

export default {
  path: '/finance/tren',
  title: 'Trends',
  render(el) {
    const st = { tab: 'spend', months: 6, cat: '', item: '', ...JSON.parse(sessionStorage.getItem(STATE) || '{}') };
    const prices = can('inventory');
    if (!prices) st.tab = 'spend';
    const keep = () => sessionStorage.setItem(STATE, JSON.stringify(st));

    el.innerHTML = `
      ${pageHeader({ title: 'Trends', subtitle: 'Pengeluaran & harga dari bulan ke bulan', emoji: '📊', tone: 'sky', back: '#/finance' })}
      ${prices ? `<div class="segmented" role="tablist">
        <button data-tab="spend">📉 Spending</button>
        <button data-tab="price">🏷️ Prices</button>
      </div>` : ''}
      <div data-body></div>`;
    const body = el.querySelector('[data-body]');

    /* ---------- Tab pengeluaran ---------- */
    const drawSpend = () => {
      const cats = trend.expenseCategories(st.months);
      if (st.cat && !cats.includes(st.cat)) st.cat = '';
      const data = trend.monthlyExpense(st.months, st.cat);
      const cur = data[data.length - 1];
      const prev = data[data.length - 2];
      const any = data.some((d) => d.total > 0);
      const label = st.cat ? `${fin.categoryEmoji('expense', st.cat)} ${st.cat}` : 'Semua pengeluaran';

      body.innerHTML = `
        <div class="row gap-sm">
          <div class="chips">${[6, 12].map((m) => `<button class="chip ${st.months === m ? 'chip--on' : ''}" data-months="${m}">${m} bulan</button>`).join('')}</div>
          <select class="input input--sm grow" data-cat aria-label="Kategori">
            <option value="">Semua kategori</option>
            ${cats.map((c) => `<option value="${esc(c)}" ${c === st.cat ? 'selected' : ''}>${fin.categoryEmoji('expense', c)} ${esc(c)}</option>`).join('')}
          </select>
        </div>
        <section class="card">
          <div class="trend-hero">
            <small>${esc(label)} · ${monthLabel(cur.month)}</small>
            <strong>${rupiah(cur.total)}</strong>
            <span class="small muted">${deltaBadge(cur.total, prev.total)} ${prev.total ? `dari ${monthLabel(prev.month)} (${rupiahShort(prev.total)})` : ''}${cur.month === thisMonth() ? ' · bulan berjalan' : ''}</span>
          </div>
          ${any ? '<div data-chart></div>' : emptyState('📉', 'Belum ada pengeluaran', 'Grafik muncul setelah ada pengeluaran yang dicatat.')}
        </section>
        ${any ? `
        <section class="card">
          <h2>🗓️ Per bulan</h2>
          <ul class="trend-table">${[...data].reverse().map((d, i, arr) => `
            <li><span>${monthLabel(d.month)}<small>${d.count} transaksi${d.byCategory[0] && !st.cat ? ` · terbesar ${esc(d.byCategory[0].category)}` : ''}</small></span>
              <span class="right"><b>${rupiah(d.total)}</b>${arr[i + 1] ? deltaBadge(d.total, arr[i + 1].total) : ''}</span></li>`).join('')}
          </ul>
        </section>` : ''}`;

      if (any) {
        barChart(
          body.querySelector('[data-chart]'),
          data.map((d) => ({
            label: monShort(d.month),
            value: d.total,
            tip: `<b>${monthLabel(d.month)}</b><br>${rupiah(d.total)} · ${d.count} transaksi${
              !st.cat && d.byCategory.length ? `<small>${d.byCategory.slice(0, 3).map((c) => `${fin.categoryEmoji('expense', c.category)} ${esc(c.category)} ${rupiahShort(c.amount)}`).join('<br>')}</small>` : ''
            }`,
          })),
          { ariaLabel: `Pengeluaran ${st.months} bulan terakhir` }
        );
      }
      body.querySelectorAll('[data-months]').forEach((b) =>
        b.addEventListener('click', () => {
          st.months = Number(b.dataset.months);
          keep();
          drawSpend();
        })
      );
      body.querySelector('[data-cat]').addEventListener('change', (e) => {
        st.cat = e.target.value;
        keep();
        drawSpend();
      });
    };

    /* ---------- Tab harga ---------- */
    const drawPrice = () => {
      const items = trend.pricedItems();
      if (!items.length) {
        body.innerHTML = `<section class="card">${emptyState('🏷️', 'Belum ada catatan harga', 'Harga tercatat otomatis setiap kali selesai belanja lewat Shopping Mode.', '<a class="btn btn--primary" href="#/inventory/mode-belanja">🛒 Buka Shopping Mode</a>')}</section>`;
        return;
      }
      const r = items.find((i) => i.key === st.item) || items[0];
      st.item = r.key;
      const unit = r.unit ? ` / ${esc(r.unit)}` : '';
      const avg = r.points.reduce((s, p) => s + p.price, 0) / r.points.length;
      const movers = trend.priceMovers(5);
      const moverRow = (m) => `<li><button class="link-row" data-pick="${esc(m.key)}"><span>${esc(m.name)}<small>${rupiah(m.first)} → ${rupiah(m.last)}</small></span>${deltaBadge(m.last, m.first)}</button></li>`;

      body.innerHTML = `
        <select class="input" data-item aria-label="Pilih barang">
          ${items.map((i) => `<option value="${esc(i.key)}" ${i.key === r.key ? 'selected' : ''}>${esc(i.name)} · ${i.points.length} catatan</option>`).join('')}
        </select>
        <section class="card">
          <div class="trend-hero">
            <small>Harga terakhir · ${dateLabel(r.points[r.points.length - 1].date)}</small>
            <strong>${rupiah(r.last)}<small>${unit}</small></strong>
            <span class="small muted">${r.points.length > 1 ? `${deltaBadge(r.last, r.first)} sejak ${dateLabel(r.points[0].date)} (${rupiah(r.first)})` : 'Baru 1 catatan — grafik makin berguna setelah belanja berikutnya'}</span>
          </div>
          <div data-chart></div>
          <div class="trend-stats">
            <div><small>Terendah</small><b>${rupiah(r.min)}</b><small>${esc(r.cheapest.store || dateLabel(r.cheapest.date))}</small></div>
            <div><small>Rata-rata</small><b>${rupiah(avg)}</b><small>${r.points.length}× beli</small></div>
            <div><small>Tertinggi</small><b>${rupiah(r.max)}</b><small>${r.max > r.min ? `+${rupiahShort(r.max - r.min)}` : '-'}</small></div>
          </div>
        </section>
        <section class="card">
          <h2>🧾 Riwayat harga</h2>
          <ul class="trend-table">${[...r.points].reverse().map((p) => `
            <li><span>${dateLabel(p.date)}<small>${esc(p.store || 'Toko tidak dicatat')} · ${number(p.qty)} ${esc(r.unit)}</small></span><span class="right"><b>${rupiah(p.price)}</b></span></li>`).join('')}
          </ul>
        </section>
        ${movers.up.length ? `<section class="card"><h2>📈 Harga paling naik</h2><ul class="mini-list mover-list">${movers.up.map(moverRow).join('')}</ul></section>` : ''}
        ${movers.down.length ? `<section class="card"><h2>📉 Harga paling turun</h2><ul class="mini-list mover-list">${movers.down.map(moverRow).join('')}</ul></section>` : ''}
        <p class="muted small center">Harga diambil dari riwayat Shopping Mode.</p>`;

      lineChart(
        body.querySelector('[data-chart]'),
        r.points.map((p) => ({ date: p.date, value: p.price, tip: `<b>${rupiah(p.price)}</b>${unit}<small>${dateLabel(p.date)}${p.store ? ` · ${esc(p.store)}` : ''}</small>` })),
        { ariaLabel: `Riwayat harga ${r.name}` }
      );
      body.querySelector('[data-item]').addEventListener('change', (e) => {
        st.item = e.target.value;
        keep();
        drawPrice();
      });
      body.querySelectorAll('[data-pick]').forEach((b) =>
        b.addEventListener('click', () => {
          st.item = b.dataset.pick;
          keep();
          drawPrice();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        })
      );
    };

    const draw = () => {
      el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === st.tab));
      st.tab === 'price' ? drawPrice() : drawSpend();
    };
    el.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        st.tab = b.dataset.tab;
        keep();
        draw();
      })
    );
    draw();
  },
};
