/**
 * Menu Utama Resep — daftar menu masak, rencana menu 7 hari (dari jadwal
 * masak di Kegiatan), dan tambah resep manual / dengan AI.
 */
import { pageHeader, esc, openSheet, toast, emptyState } from '../../service/ui.service.js';
import { today } from '../../service/format.service.js';
import * as rcp from '../../service/recipe.service.js';
import { navigate } from '../../service/router.service.js';

export const DRAFT_KEY = 'rumahku-recipe-draft';
const DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Sheet "Tambah dengan AI": tempel resep / ketik nama masakan → draf resep. */
export function openAiSheet() {
  const sheet = openSheet({
    title: '✨ Tambah Resep dengan AI',
    body: `
      <form class="form" data-ai autocomplete="off">
        <p class="muted small">Tempel resep dari web / WhatsApp / catatan, <b>atau</b> cukup ketik nama masakan. AI akan merapikan bahan, langkah, dan memperkirakan gizinya. Kamu bisa cek & ubah dulu sebelum disimpan.</p>
        <textarea class="input textarea" name="text" rows="8" maxlength="20000" required placeholder="cth. Sayur asem jakarta untuk 4 orang&#10;&#10;atau tempel resep lengkap di sini…"></textarea>
        <p class="ai-status hidden" data-status role="status"></p>
        <button class="btn btn--primary btn--block" type="submit" data-go>✨ Proses dengan AI</button>
      </form>`,
  });
  const form = sheet.el.querySelector('[data-ai]');
  const status = form.querySelector('[data-status]');
  const go = form.querySelector('[data-go]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    go.disabled = true;
    go.textContent = '⏳ AI sedang menyusun resep…';
    status.className = 'ai-status';
    status.textContent = 'Biasanya 10–40 detik. Jangan tutup halaman ini.';
    try {
      const draft = await rcp.aiDraft(form.text.value);
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      sheet.close();
      navigate('/resep/form?draft=1');
    } catch (err) {
      status.className = 'ai-status ai-status--error';
      status.textContent = `⚠️ ${err.message}`;
      go.disabled = false;
      go.textContent = '✨ Coba lagi';
    }
  });
  setTimeout(() => form.text.focus(), 300);
}

export default {
  path: '/resep',
  title: 'Resep',
  render(el) {
    let q = '';
    let category = '';
    let favorite = false;

    el.innerHTML = `
      ${pageHeader({ title: 'Resep', subtitle: 'Menu masak, resep & gizi keluarga', emoji: '🍳', tone: 'peach', back: '#/' })}

      <div class="row gap-sm">
        <button class="btn btn--primary grow" data-ai>✨ Tambah dengan AI</button>
        <a class="btn btn--soft grow" href="#/resep/form">✍️ Tulis sendiri</a>
      </div>

      <section class="card" data-plan></section>

      <input class="input" data-q placeholder="🔍 Cari masakan, bahan, atau label…" />
      <div class="chips" data-cats></div>
      <div data-list></div>`;

    const drawPlan = () => {
      const plan = rcp.mealPlan(7);
      const count = plan.reduce((s, d) => s + d.meals.length, 0);
      el.querySelector('[data-plan]').innerHTML = `
        <div class="card__head"><h2>📅 Rencana menu 7 hari</h2><a class="link" href="#/kegiatan">Kegiatan ›</a></div>
        ${count
          ? `<ul class="plan">${plan
              .map(({ date, meals }) => {
                const [y, m, d] = date.split('-').map(Number);
                const day = DAY[new Date(y, m - 1, d).getDay()];
                return `<li class="${date === today() ? 'plan--today' : ''}"><span class="plan__day"><b>${day}</b>${d}</span>
                  <div class="plan__meals">${meals.length
                    ? meals.map((mm) => `<a href="#/resep/detail?id=${mm.recipeId}">${esc(mm.recipe.emoji)} ${esc(mm.recipe.name)}${mm.time ? ` <small>${mm.time}</small>` : ''}${mm.done ? ' ✅' : ''}</a>`).join('')
                    : '<span class="muted small">—</span>'}</div></li>`;
              })
              .join('')}</ul>`
          : `<p class="muted small">Belum ada jadwal masak. Buka resep → <b>📅 Jadwalkan masak</b>, nanti muncul di sini dan di Kegiatan.</p>`}`;
    };

    const drawList = () => {
      const list = rcp.listRecipes({ q, category, favorite });
      el.querySelector('[data-cats]').innerHTML = [
        `<button class="chip ${!category && !favorite ? 'chip--on' : ''}" data-cat="">Semua</button>`,
        `<button class="chip ${favorite ? 'chip--on' : ''}" data-fav>⭐ Favorit</button>`,
        ...rcp.CATEGORIES.map((c) => `<button class="chip ${category === c ? 'chip--on' : ''}" data-cat="${c}">${c}</button>`),
      ].join('');
      el.querySelector('[data-list]').innerHTML = list.length
        ? `<div class="recipe-grid">${list
            .map((r) => {
              const mins = (r.prepMinutes || 0) + (r.cookMinutes || 0);
              return `
            <a class="recipe-card" href="#/resep/detail?id=${r.id}">
              <span class="recipe-card__emoji">${esc(r.emoji || '🍳')}</span>
              ${r.favorite ? '<span class="recipe-card__fav">⭐</span>' : ''}
              <strong>${esc(r.name)}</strong>
              <small>${esc(r.category)}${mins ? ` · ⏱️ ${mins} mnt` : ''}</small>
              <small>${rcp.hasNutrition(r) && r.nutrition.calories != null ? `🔥 ${Math.round(r.nutrition.calories)} kkal/porsi` : `🍽️ ${r.servings} porsi`}</small>
            </a>`;
            })
            .join('')}</div>`
        : `<div class="card">${emptyState('🍳', q || category || favorite ? 'Tidak ditemukan' : 'Belum ada resep', 'Tambah resep pertama: ketik nama masakan dan biarkan AI yang menyusun.')}</div>`;

      el.querySelectorAll('[data-cat]').forEach((b) =>
        b.addEventListener('click', () => {
          category = b.dataset.cat;
          favorite = false;
          drawList();
        })
      );
      el.querySelector('[data-fav]').addEventListener('click', () => {
        favorite = !favorite;
        category = '';
        drawList();
      });
    };

    el.querySelector('[data-ai]').addEventListener('click', () => {
      if (!rcp.aiAvailable()) return toast('Fitur AI butuh database Supabase — lihat README', 'warn');
      openAiSheet();
    });
    el.querySelector('[data-q]').addEventListener('input', (e) => {
      q = e.target.value;
      drawList();
    });

    drawPlan();
    drawList();
  },
};
