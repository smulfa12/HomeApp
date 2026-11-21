/**
 * Menu Utama Inventory Rumah
 */
import { pageHeader } from '../../service/ui.service.js';
import { sessionCount } from '../../service/shopping.service.js';
import { summary, expiringItems } from '../../service/inventory.service.js';
import { itemCard } from '../shared/item-card.js';

const MENUS = [
  { href: '#/inventory/input', emoji: '📥', title: 'Input Barang', desc: 'Scan barcode & tambah stok', tone: 'mint' },
  { href: '#/inventory/keluar', emoji: '📤', title: 'Stock Keluar', desc: 'Scan saat barang dipakai', tone: 'peach' },
  { href: '#/inventory/mode-belanja', emoji: '🛍️', title: 'Mode Belanja', desc: 'Scan saat di supermarket', tone: 'sky', badgeKey: 'cart' },
  { href: '#/inventory/belanja', emoji: '🛒', title: 'Daftar Belanja', desc: 'Stok di bawah minimum', tone: 'rose', badgeKey: 'lowStock' },
  { href: '#/inventory/opname', emoji: '📋', title: 'Stock Opname', desc: 'Hitung stok sebelum belanja', tone: 'lavender' },
  { href: '#/inventory/riwayat-belanja', emoji: '🧾', title: 'Riwayat Belanja', desc: 'Log setiap kali belanja', tone: 'butter' },
  { href: '#/inventory/lokasi', emoji: '🗂️', title: 'Barang per Lokasi', desc: 'Lihat isi tiap tempat', tone: 'butter' },
  { href: '#/inventory/lokasi-atur', emoji: '📍', title: 'Atur Lokasi', desc: 'Tambah / ubah tempat simpan', tone: 'mint' },
];

export default {
  path: '/inventory',
  title: 'Inventory Rumah',
  render(el) {
    const s = { ...summary(), cart: sessionCount() };
    const expiring = expiringItems(7).slice(0, 3);
    el.innerHTML = `
      ${pageHeader({ title: 'Inventory Rumah', subtitle: 'Stok barang rumah tetap terkendali', emoji: '🏠', tone: 'mint' })}
      <section class="stat-row">
        <div class="stat tone-mint"><span>Total barang</span><strong>${s.totalItems}</strong></div>
        <div class="stat tone-rose"><span>Stok menipis</span><strong>${s.lowStock}</strong></div>
        <div class="stat tone-butter"><span>Hampir kadaluarsa</span><strong>${s.expiring}</strong></div>
      </section>

      <section class="menu-grid">
        ${MENUS.map(
          (m) => `
          <a class="menu-tile tone-${m.tone}" href="${m.href}">
            <span class="menu-tile__icon">${m.emoji}</span>
            <span class="menu-tile__title">${m.title}</span>
            <span class="menu-tile__desc">${m.desc}</span>
            ${m.badgeKey && s[m.badgeKey] ? `<span class="menu-tile__badge">${s[m.badgeKey]}</span>` : ''}
          </a>`
        ).join('')}
      </section>

      ${
        expiring.length
          ? `<section class="card">
              <div class="card__head"><h2>⏰ Segera kadaluarsa</h2><a href="#/inventory/lokasi" class="link">Lihat semua</a></div>
              <div class="list">${expiring.map((i) => itemCard(i, { href: `#/inventory/input?id=${i.id}` })).join('')}</div>
            </section>`
          : ''
      }`;
  },
};
