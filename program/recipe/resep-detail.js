/**
 * Detail resep — bahan (dengan stok di rumah), langkah, gizi, porsi,
 * jadwal masak (tertaut ke Kegiatan), dan bahan habis → keranjang belanja.
 */
import { pageHeader, esc, openSheet, toast, confirmDialog, emptyState } from '../../service/ui.service.js';
import { today, dateLabel, number } from '../../service/format.service.js';
import * as rcp from '../../service/recipe.service.js';
import * as act from '../../service/activity.service.js';
import * as shop from '../../service/shopping.service.js';
import { navigate } from '../../service/router.service.js';

const STOCK = {
  ok: ['✅', 'ada'],
  low: ['🟡', 'menipis'],
  out: ['⚠️', 'habis'],
  none: ['', ''],
};

export default {
  path: '/resep/detail',
  title: 'Resep',
  render(el, params) {
    const draw = () => {
      const r = rcp.getRecipe(params.id);
      if (!r) {
        el.innerHTML = `${pageHeader({ title: 'Resep', emoji: '🍳', tone: 'peach', back: '#/resep' })}<div class="card">${emptyState('🤔', 'Resep tidak ditemukan', 'Mungkin sudah dihapus.')}</div>`;
        return;
      }
      let portions = Number(sessionStorage.getItem(`portions-${r.id}`)) || r.servings || 1;
      const scale = portions / (r.servings || 1);
      const stock = rcp.ingredientStock(r);
      const missing = stock.filter((s) => s.item && (s.status === 'out' || s.status === 'low'));
      const upcoming = rcp.schedulesFor(r.id, 30);
      const mins = (r.prepMinutes || 0) + (r.cookMinutes || 0);

      el.innerHTML = `
        ${pageHeader({ title: r.name, subtitle: `${r.category}${mins ? ` · ⏱️ ${mins} menit` : ''}${r.source === 'ai' ? ' · ✨ AI' : ''}`, emoji: r.emoji || '🍳', tone: 'peach', back: '#/resep' })}

        <div class="row gap-sm">
          <button class="btn btn--primary grow" data-schedule>📅 Jadwalkan masak</button>
          <button class="btn btn--soft btn--icon" data-fav aria-label="Favorit">${r.favorite ? '⭐' : '☆'}</button>
          <a class="btn btn--soft btn--icon" href="#/resep/form?id=${r.id}" aria-label="Edit">✏️</a>
        </div>

        ${upcoming.length ? `
        <section class="card">
          <div class="card__head"><h2>📅 Jadwal masak</h2><a class="link" href="#/kegiatan">Kegiatan ›</a></div>
          <ul class="mini-list">${upcoming.slice(0, 5).map((u) => `<li><span>${dateLabel(u.date)}${u.time ? ` · ${u.time}` : ''}${u.who ? ` · 👤 ${esc(u.who)}` : ''}</span>${u.done ? '<span class="badge badge--ok">sudah</span>' : ''}</li>`).join('')}</ul>
        </section>` : ''}

        <section class="card">
          <div class="card__head"><h2>🧺 Bahan</h2>
            <div class="stepper stepper--sm">
              <button type="button" class="btn btn--soft" data-portion="-1" aria-label="Kurangi porsi">−</button>
              <span class="stepper__val">${portions} <small>porsi</small></span>
              <button type="button" class="btn btn--soft" data-portion="1" aria-label="Tambah porsi">+</button>
            </div>
          </div>
          ${stock.length
            ? `<ul class="ing-list">${stock
                .map((s) => {
                  const [ico, label] = STOCK[s.status];
                  return `<li><span>${esc(rcp.ingredientText(s, scale))}</span>${s.item ? `<span class="ing-stock ing-stock--${s.status}" title="${esc(s.item.name)}">${ico} ${label}${s.status !== 'out' ? ` · ${number(s.item.qty)} ${esc(s.item.unit)}` : ''}</span>` : ''}</li>`;
                })
                .join('')}</ul>`
            : '<p class="muted small">Belum ada bahan.</p>'}
          ${missing.length ? `<button class="btn btn--soft btn--block btn--wrap" data-cart>🛒 ${missing.length} bahan kurang → keranjang belanja</button>` : ''}
          <p class="muted small">Status stok dicocokkan otomatis dengan nama barang di Inventory.</p>
        </section>

        <section class="card">
          <div class="card__head"><h2>👩‍🍳 Langkah</h2><span class="muted small">ketuk bila selesai</span></div>
          ${(r.steps || []).length ? `<ol class="step-list">${r.steps.map((s, i) => `<li data-step="${i}">${esc(s)}</li>`).join('')}</ol>` : '<p class="muted small">Belum ada langkah.</p>'}
        </section>

        <section class="card">
          <div class="card__head"><h2>🥗 Gizi</h2><span class="muted small">perkiraan</span></div>
          ${rcp.hasNutrition(r)
            ? `<table class="nutri-table">
                <thead><tr><th></th><th>per porsi</th><th>${portions} porsi</th></tr></thead>
                <tbody>${rcp.NUTRIENTS.filter((n) => r.nutrition[n.key] != null)
                  .map((n) => `<tr><td>${n.label}</td><td>${number(Math.round(r.nutrition[n.key]))} ${n.unit}</td><td>${number(Math.round(r.nutrition[n.key] * portions))} ${n.unit}</td></tr>`)
                  .join('')}</tbody>
              </table>`
            : `<p class="muted small">Belum ada data gizi. <a class="link" href="#/resep/form?id=${r.id}">Isi sendiri atau hitung dengan AI</a>.</p>`}
        </section>

        ${(r.tags || []).length || r.note ? `<section class="card">${(r.tags || []).length ? `<div class="chips chips--wrap">${r.tags.map((t) => `<span class="chip">#${esc(t)}</span>`).join('')}</div>` : ''}${r.note ? `<p class="small">💡 ${esc(r.note)}</p>` : ''}</section>` : ''}

        <button class="btn btn--danger-soft btn--block" data-del>🗑️ Hapus Resep</button>`;

      el.querySelectorAll('[data-portion]').forEach((b) =>
        b.addEventListener('click', () => {
          portions = Math.max(1, portions + Number(b.dataset.portion));
          sessionStorage.setItem(`portions-${r.id}`, portions);
          draw();
        })
      );
      el.querySelectorAll('[data-step]').forEach((li) => li.addEventListener('click', () => li.classList.toggle('done')));
      el.querySelector('[data-fav]').addEventListener('click', () => {
        rcp.toggleFavorite(r.id);
        draw();
      });
      el.querySelector('[data-cart]')?.addEventListener('click', () => {
        missing.forEach((s) => shop.addToSession(s.item, 1));
        toast(`🛒 ${missing.length} bahan masuk keranjang Mode Belanja`);
      });
      el.querySelector('[data-schedule]').addEventListener('click', () => schedule(r));
      el.querySelector('[data-del]').addEventListener('click', async () => {
        if (!(await confirmDialog(`Hapus resep "${r.name}"? Jadwal masak di Kegiatan tetap ada.`, { okText: 'Hapus', danger: true }))) return;
        rcp.deleteRecipe(r.id);
        toast('Resep dihapus');
        navigate('/resep');
      });
    };

    const schedule = (r) => {
      const names = act.whoList();
      const sheet = openSheet({
        title: `📅 Jadwalkan: ${r.name}`,
        body: `
          <form class="form" data-sch autocomplete="off">
            <div class="grid-2">
              <label class="field"><span>Tanggal</span><input class="input" type="date" name="date" value="${today()}" required /></label>
              <label class="field"><span>Jam</span><input class="input" type="time" name="time" /></label>
            </div>
            <div class="chips chips--wrap">
              ${[['06:00', 'Sarapan'], ['11:00', 'Makan siang'], ['17:00', 'Makan malam']].map(([t, l]) => `<button type="button" class="chip" data-t="${t}">${l} ${t}</button>`).join('')}
            </div>
            <label class="field"><span>Ulangi</span>
              <select class="input" name="repeat">${Object.entries(act.REPEAT_LABEL).filter(([k]) => k !== 'weekly').map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
            </label>
            <label class="field"><span>Yang masak (opsional)</span>
              <input class="input" name="who" maxlength="20" list="who-list-r" placeholder="cth. Ibu" />
              <datalist id="who-list-r">${names.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
            </label>
            <button class="btn btn--primary btn--block" type="submit">📅 Masukkan ke Kegiatan</button>
          </form>`,
      });
      const f = sheet.el.querySelector('[data-sch]');
      f.querySelectorAll('[data-t]').forEach((b) =>
        b.addEventListener('click', () => {
          f.time.value = b.dataset.t;
          f.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('chip--on', x === b));
        })
      );
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          rcp.scheduleCooking(r, { date: f.date.value, time: f.time.value, who: f.who.value, repeat: f.repeat.value });
          sheet.close();
          toast('📅 Jadwal masak masuk ke Kegiatan');
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    };

    draw();
  },
};
