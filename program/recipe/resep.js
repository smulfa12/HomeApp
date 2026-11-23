/**
 * Menu Utama Resep — daftar menu masak, rencana menu 7 hari (dari jadwal
 * masak di Kegiatan), dan tulis resep baru.
 */
import { pageHeader, esc, emptyState } from '../../service/ui.service.js';
import { today } from '../../service/format.service.js';
import * as rcp from '../../service/recipe.service.js';
import { can } from '../../service/access.service.js';

const DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default {
  path: '/resep',
  title: 'Recipes',
  render(el) {
    let q = '';
    let category = '';
    let favorite = false;

    el.innerHTML = `
      ${pageHeader({ title: 'Recipes', subtitle: 'Menu masak, resep & gizi keluarga', emoji: '🍳', tone: 'peach', back: '#/' })}

      <a class="btn btn--primary btn--block" href="#/resep/form">✍️ Tulis Resep Baru</a>

      <section class="card" data-plan></section>

      <input class="input" data-q placeholder="🔍 Cari masakan, bahan, atau label…" />
      <div class="chips" data-cats></div>
      <div data-list></div>`;

    const drawPlan = () => {
      const plan = rcp.mealPlan(7);
      const count = plan.reduce((s, d) => s + d.meals.length, 0);
      el.querySelector('[data-plan]').innerHTML = `
        <div class="card__head"><h2>📅 7-Day Meal Plan</h2>${can('kegiatan') ? '<a class="link" href="#/kegiatan">Activities ›</a>' : ''}</div>
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
          : `<p class="muted small">Belum ada jadwal masak. Buka resep → <b>📅 Jadwalkan masak</b>, nanti muncul di sini dan di Activities.</p>`}`;
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
        : `<div class="card">${emptyState('🍳', q || category || favorite ? 'Tidak ditemukan' : 'Belum ada resep', 'Tulis resep pertama: bahan & langkah cukup diketik satu per baris.')}</div>`;

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

    el.querySelector('[data-q]').addEventListener('input', (e) => {
      q = e.target.value;
      drawList();
    });

    drawPlan();
    drawList();
  },
};
