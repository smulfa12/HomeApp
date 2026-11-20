/**
 * Beranda — ringkasan inventory & keuangan, akses cepat ke dua menu utama.
 */
import { esc } from '../service/ui.service.js';
import { rupiahShort, thisMonth, monthLabel } from '../service/format.service.js';
import * as inv from '../service/inventory.service.js';
import * as fin from '../service/finance.service.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return ['Selamat pagi', '☀️'];
  if (h < 15) return ['Selamat siang', '🌤️'];
  if (h < 18) return ['Selamat sore', '🌇'];
  return ['Selamat malam', '🌙'];
}

export default {
  path: '/',
  title: 'Beranda',
  render(el) {
    const [hello, icon] = greeting();
    const is = inv.summary();
    const fs = fin.summary(thisMonth());
    const low = inv.shoppingList().slice(0, 3);
    const empty = is.totalItems === 0 && fs.income === 0 && fs.expense === 0;

    el.innerHTML = `
      <header class="home-head">
        <div>
          <p class="muted">${hello} ${icon}</p>
          <h1>Rumahku</h1>
        </div>
        <a class="icon-btn" href="#/settings" aria-label="Pengaturan">⚙️</a>
      </header>

      ${empty ? `
      <div class="notice tone-lavender">
        👋 Data masih kosong. <a class="link" href="#/settings">Isi data contoh</a> untuk mencoba, atau langsung mulai input.
      </div>` : ''}

      <a class="big-card tone-mint" href="#/inventory">
        <div class="big-card__top">
          <span class="big-card__icon">📦</span>
          <div><h2>Inventory Rumah</h2><p>${is.totalItems} barang di ${is.locations} lokasi</p></div>
          <span class="big-card__arrow">›</span>
        </div>
        <div class="big-card__stats">
          <div><strong>${is.lowStock}</strong><small>stok menipis</small></div>
          <div><strong>${is.expiring}</strong><small>segera kadaluarsa</small></div>
        </div>
      </a>

      <a class="big-card tone-lavender" href="#/finance">
        <div class="big-card__top">
          <span class="big-card__icon">💰</span>
          <div><h2>Keuangan Rumah</h2><p>${monthLabel(thisMonth())}</p></div>
          <span class="big-card__arrow">›</span>
        </div>
        <div class="big-card__stats">
          <div><strong>${rupiahShort(fs.income)}</strong><small>pemasukan</small></div>
          <div><strong>${rupiahShort(fs.expense)}</strong><small>pengeluaran</small></div>
          <div><strong>${rupiahShort(fs.net)}</strong><small>selisih</small></div>
        </div>
      </a>

      <h3 class="section-title">⚡ Aksi cepat</h3>
      <div class="quick-grid">
        <a class="quick tone-mint" href="#/inventory/input"><span>📥</span>Barang masuk</a>
        <a class="quick tone-peach" href="#/inventory/keluar"><span>📤</span>Barang keluar</a>
        <a class="quick tone-sky" href="#/finance/expense"><span>🧾</span>Scan nota</a>
        <a class="quick tone-butter" href="#/finance/income"><span>💰</span>Pemasukan</a>
      </div>

      ${low.length ? `
      <section class="card">
        <div class="card__head"><h2>🛒 Perlu dibeli</h2><a class="link" href="#/inventory/belanja">Semua (${is.lowStock})</a></div>
        <ul class="mini-list">
          ${low.map((i) => `<li><span>${inv.categoryInfo(i.category).emoji} ${esc(i.name)}</span><span class="badge badge--warn">sisa ${i.qty}</span></li>`).join('')}
        </ul>
      </section>` : ''}`;
  },
};
