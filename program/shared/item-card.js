/**
 * Komponen kartu barang (dipakai di beberapa menu inventory).
 */
import { esc } from '../../service/ui.service.js';
import { number } from '../../service/format.service.js';
import { categoryInfo, expiryStatus } from '../../service/inventory.service.js';

export function stockBadge(item) {
  if (item.qty <= 0) return `<span class="badge badge--danger">Habis</span>`;
  if (item.minStock > 0 && item.qty < item.minStock) return `<span class="badge badge--warn">Menipis</span>`;
  return `<span class="badge badge--ok">Aman</span>`;
}

export function expiryBadge(item) {
  const s = expiryStatus(item);
  if (!s || s.level === 'ok') return '';
  const cls = s.level === 'expired' ? 'danger' : s.level === 'soon' ? 'warn' : 'info';
  return `<span class="badge badge--${cls}">⏰ ${esc(s.label)}</span>`;
}

export function itemCard(item, { right = '', showLocation = true, href } = {}) {
  const cat = categoryInfo(item.category);
  const tag = href ? 'a' : 'div';
  return `
    <${tag} class="item-card" ${href ? `href="${href}"` : ''} data-id="${item.id}">
      <div class="item-card__icon">${cat.emoji}</div>
      <div class="item-card__body">
        <div class="item-card__title">${esc(item.name)}</div>
        <div class="item-card__meta">
          ${esc(item.category)}${showLocation && item.location ? ` · 📍 ${esc(item.location)}` : ''}
        </div>
        <div class="item-card__badges">${stockBadge(item)}${expiryBadge(item)}</div>
      </div>
      <div class="item-card__right">
        ${right || `<div class="qty"><strong>${number(item.qty)}</strong><small>${esc(item.unit)}</small></div>`}
      </div>
    </${tag}>`;
}
