/**
 * Baris kegiatan (dipakai halaman Kegiatan & widget Beranda).
 */
import { esc } from '../../service/ui.service.js';
import * as act from '../../service/activity.service.js';

export function todoRow(t, date, { compact = false } = {}) {
  const status = act.timeStatus(t, date);
  const time = t.time ? `${t.time}${t.endTime ? `<small>–${t.endTime}</small>` : ''}` : '<small>kapan saja</small>';
  return `
    <li class="todo ${t.done ? 'todo--done' : ''} ${status ? `todo--${status}` : ''}">
      <button class="todo__check" data-toggle="${t.id}" role="checkbox" aria-checked="${t.done}" aria-label="Tandai ${esc(t.title)} selesai"></button>
      <div class="todo__time">${time}</div>
      <div class="todo__body" ${compact ? '' : `data-edit="${t.id}" role="button" tabindex="0"`}>
        <div class="todo__title"><span>${esc(t.icon || '✅')}</span> ${esc(t.title)}</div>
        <div class="todo__meta">
          ${status === 'now' ? '<span class="badge badge--ok">sedang berlangsung</span>' : ''}
          ${status === 'late' ? '<span class="badge badge--warn">terlewat</span>' : ''}
          ${t.who ? `<span class="todo__who">👤 ${esc(t.who)}</span>` : ''}
          ${t.repeat && t.repeat !== 'none' && !compact ? `<span>🔁 ${esc(t.repeat === 'weekly' ? (t.days || []).map((d) => act.DAY_SHORT[d]).join(', ') : act.REPEAT_LABEL[t.repeat])}</span>` : ''}
          ${t.note && !compact ? `<span>📝 ${esc(t.note)}</span>` : ''}
        </div>
      </div>
    </li>`;
}
