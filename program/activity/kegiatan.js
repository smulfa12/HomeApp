/**
 * Menu Utama Kegiatan — to-do list kegiatan harian.
 * Per hari, urut jam, bisa dicentang. Kegiatan bisa sekali atau rutin
 * (setiap hari / Senin–Jumat / hari tertentu).
 */
import { pageHeader, esc, openSheet, toast, confirmDialog, emptyState, celebrate } from '../../service/ui.service.js';
import { today, toISODate } from '../../service/format.service.js';
import * as act from '../../service/activity.service.js';
import { todoRow } from '../shared/todo-row.js';

const DAY_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shift = (iso, days) => {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};
const longLabel = (iso) => {
  const d = parse(iso);
  return `${DAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
};
/** Senin pada minggu tanggal ini. */
const weekStart = (iso) => shift(iso, -((parse(iso).getDay() + 6) % 7));

export default {
  path: '/kegiatan',
  title: 'Kegiatan',
  render(el, params) {
    let date = /^\d{4}-\d{2}-\d{2}$/.test(params.date || '') ? params.date : today();
    let who = '';

    const draw = () => {
      const all = act.tasksForDate(date);
      const list = who ? all.filter((t) => t.who === who || !t.who) : all;
      const done = list.filter((t) => t.done).length;
      const pct = list.length ? Math.round((done / list.length) * 100) : 0;
      const names = act.whoList();
      const start = weekStart(date);
      const isToday = date === today();
      const anytime = list.filter((t) => !t.time);
      const timed = list.filter((t) => t.time);

      el.innerHTML = `
        ${pageHeader({ title: 'Kegiatan', subtitle: longLabel(date), emoji: '✅', tone: 'sky', back: '#/' })}

        <section class="week">
          <button class="icon-btn icon-btn--sm" data-week="-7" aria-label="Minggu sebelumnya">‹</button>
          <div class="week__days">
            ${Array.from({ length: 7 }, (_, i) => {
              const d = shift(start, i);
              const p = act.dayProgress(d);
              const state = p.total ? (p.done === p.total ? 'full' : p.done ? 'part' : 'none') : 'empty';
              return `<button class="week__day ${d === date ? 'on' : ''} ${d === today() ? 'today' : ''}" data-day="${d}">
                <small>${act.DAY_SHORT[parse(d).getDay()]}</small><b>${parse(d).getDate()}</b><i class="week__dot week__dot--${state}"></i>
              </button>`;
            }).join('')}
          </div>
          <button class="icon-btn icon-btn--sm" data-week="7" aria-label="Minggu berikutnya">›</button>
        </section>
        ${isToday ? '' : `<button class="chip chip--link center-self" data-today>↩ Kembali ke hari ini</button>`}

        <section class="hero-num tone-sky todo-progress">
          <span>${isToday ? 'Progres hari ini' : 'Progres'}</span>
          <strong>${done}/${list.length} <small>selesai</small></strong>
          <div class="bar bar--light"><span style="width:${pct}%"></span></div>
          ${list.length && done === list.length ? '<small>🎉 Semua beres! Kerja bagus.</small>' : ''}
        </section>

        <button class="btn btn--primary btn--block" data-add>➕ Tambah Kegiatan</button>

        ${names.length ? `
        <div class="chips">
          <button class="chip ${!who ? 'chip--on' : ''}" data-who="">Semua</button>
          ${names.map((n) => `<button class="chip ${who === n ? 'chip--on' : ''}" data-who="${esc(n)}">👤 ${esc(n)}</button>`).join('')}
        </div>` : ''}

        ${
          !list.length
            ? `<div class="card">${emptyState('🗓️', 'Belum ada kegiatan', 'Tambahkan jadwal harian, mis. 05:00 Masak sarapan, 07:00 Antar sekolah.')}</div>`
            : `
          ${anytime.length ? `<section class="card"><div class="card__head"><h2>🕘 Kapan saja</h2></div><ul class="todo-list">${anytime.map((t) => todoRow(t, date)).join('')}</ul></section>` : ''}
          ${timed.length ? `<section class="card"><div class="card__head"><h2>⏰ Jadwal</h2><span class="muted small">ketuk untuk ubah</span></div><ul class="todo-list">${timed.map((t) => todoRow(t, date)).join('')}</ul></section>` : ''}`
        }`;

      el.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => ((date = b.dataset.day), draw())));
      el.querySelectorAll('[data-week]').forEach((b) => b.addEventListener('click', () => ((date = shift(date, Number(b.dataset.week))), draw())));
      el.querySelector('[data-today]')?.addEventListener('click', () => ((date = today()), draw()));
      el.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => ((who = b.dataset.who), draw())));
      el.querySelector('[data-add]').addEventListener('click', () => edit({ date }));
      el.querySelectorAll('[data-toggle]').forEach((b) =>
        b.addEventListener('click', () => {
          const nowDone = act.toggleDone(b.dataset.toggle, date);
          const p = act.dayProgress(date);
          if (nowDone && p.total && p.done === p.total) celebrate('🎉 Semua kegiatan selesai!');
          draw();
        })
      );
      el.querySelectorAll('[data-edit]').forEach((b) => {
        const open = () => edit(act.getTodo(b.dataset.edit));
        b.addEventListener('click', open);
        b.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open()));
      });
    };

    const edit = (t) => {
      const isNew = !t.id;
      let icon = t.icon || '✅';
      let repeat = t.repeat || 'none';
      const days = new Set((t.days || []).map(Number));
      const names = act.whoList();

      const sheet = openSheet({
        title: isNew ? 'Kegiatan Baru' : 'Edit Kegiatan',
        body: `
          <form class="form" data-todo autocomplete="off">
            <label class="field"><span>Kegiatan *</span>
              <input class="input" name="title" required maxlength="60" value="${esc(t.title || '')}" placeholder="cth. Masak sarapan, Antar anak sekolah" />
            </label>
            <div class="field"><span>Ikon</span>
              <div class="icon-pick">${act.TODO_ICONS.map((i) => `<button type="button" class="icon-pick__item ${i === icon ? 'on' : ''}" data-icon="${i}" aria-label="Ikon ${i}">${i}</button>`).join('')}</div>
            </div>
            <div class="grid-2">
              <label class="field"><span>Jam mulai</span><input class="input" type="time" name="time" value="${esc(t.time || '')}" /></label>
              <label class="field"><span>Jam selesai</span><input class="input" type="time" name="endTime" value="${esc(t.endTime || '')}" /></label>
            </div>
            <p class="muted small">Kosongkan jam bila kegiatan bisa dilakukan kapan saja.</p>

            <div class="field"><span>Ulangi</span>
              <div class="chips chips--wrap">
                ${Object.entries(act.REPEAT_LABEL).map(([k, l]) => `<button type="button" class="chip ${k === repeat ? 'chip--on' : ''}" data-repeat="${k}">${l}</button>`).join('')}
              </div>
            </div>
            <div class="day-pick ${repeat === 'weekly' ? '' : 'hidden'}" data-days>
              ${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="day-pick__d ${days.has(d) ? 'on' : ''}" data-d="${d}">${act.DAY_SHORT[d]}</button>`).join('')}
            </div>
            <label class="field"><span data-date-label>${repeat === 'none' ? 'Tanggal' : 'Mulai berlaku'}</span>
              <input class="input" type="date" name="date" value="${esc(t.date || today())}" required />
            </label>

            <label class="field"><span>Untuk siapa (opsional)</span>
              <input class="input" name="who" maxlength="20" value="${esc(t.who || '')}" placeholder="cth. Ayah, Ibu, Kakak" list="who-list" />
              <datalist id="who-list">${names.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
            </label>
            <label class="field"><span>Catatan</span><input class="input" name="note" maxlength="80" value="${esc(t.note || '')}" placeholder="opsional" /></label>

            <button class="btn btn--primary btn--block" type="submit">💾 Simpan</button>
            ${isNew ? '' : t.repeat && t.repeat !== 'none'
              ? `<button class="btn btn--soft btn--block" type="button" data-skip>⏭️ Hapus untuk ${date === today() ? 'hari ini' : 'tanggal ini'} saja</button>
                 <button class="btn btn--danger-soft btn--block" type="button" data-del>🗑️ Hapus rutinitas ini</button>`
              : `<button class="btn btn--danger-soft btn--block" type="button" data-del>🗑️ Hapus</button>`}
          </form>`,
      });

      const form = sheet.el.querySelector('[data-todo]');
      form.querySelectorAll('[data-icon]').forEach((b) =>
        b.addEventListener('click', () => {
          icon = b.dataset.icon;
          form.querySelectorAll('[data-icon]').forEach((x) => x.classList.toggle('on', x === b));
        })
      );
      form.querySelectorAll('[data-repeat]').forEach((b) =>
        b.addEventListener('click', () => {
          repeat = b.dataset.repeat;
          form.querySelectorAll('[data-repeat]').forEach((x) => x.classList.toggle('chip--on', x === b));
          form.querySelector('[data-days]').classList.toggle('hidden', repeat !== 'weekly');
          form.querySelector('[data-date-label]').textContent = repeat === 'none' ? 'Tanggal' : 'Mulai berlaku';
        })
      );
      form.querySelectorAll('[data-d]').forEach((b) =>
        b.addEventListener('click', () => {
          const d = Number(b.dataset.d);
          days.has(d) ? days.delete(d) : days.add(d);
          b.classList.toggle('on', days.has(d));
        })
      );

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          act.saveTodo({
            id: t.id,
            title: form.title.value,
            icon,
            time: form.time.value,
            endTime: form.endTime.value,
            date: form.date.value,
            repeat,
            days: [...days],
            who: form.who.value,
            note: form.note.value,
          });
          sheet.close();
          toast(isNew ? '✅ Kegiatan ditambahkan' : '✅ Kegiatan diperbarui');
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      sheet.el.querySelector('[data-skip]')?.addEventListener('click', () => {
        act.skipOn(t.id, date);
        sheet.close();
        toast('⏭️ Dihapus untuk tanggal ini saja');
        draw();
      });
      sheet.el.querySelector('[data-del]')?.addEventListener('click', async () => {
        sheet.close();
        const msg = t.repeat && t.repeat !== 'none' ? `Hapus rutinitas "${t.title}" dari semua hari?` : `Hapus kegiatan "${t.title}"?`;
        if (!(await confirmDialog(msg, { okText: 'Hapus', danger: true }))) return;
        act.deleteTodo(t.id);
        toast('Kegiatan dihapus');
        draw();
      });
      if (isNew) setTimeout(() => form.title.focus(), 300);
    };

    draw();
    // perbarui sorotan "sedang berlangsung / terlewat" tiap menit
    const timer = setInterval(() => !document.querySelector('.sheet') && draw(), 60000);
    return () => clearInterval(timer);
  },
};
