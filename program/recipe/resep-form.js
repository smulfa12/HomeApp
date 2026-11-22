/**
 * Form resep — tulis sendiri, edit, atau periksa draf hasil AI sebelum disimpan.
 */
import { pageHeader, esc, toast, options, formData } from '../../service/ui.service.js';
import * as rcp from '../../service/recipe.service.js';
import { navigate } from '../../service/router.service.js';
import { DRAFT_KEY } from './resep.js';

export default {
  path: '/resep/form',
  title: 'Recipes',
  autoRefresh: false,
  render(el, params) {
    let r = params.id ? rcp.getRecipe(params.id) : null;
    let fromAi = false;
    if (!r && params.draft) {
      try {
        r = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
        fromAi = Boolean(r);
      } catch { /* draf rusak */ }
    }
    r = r || { emoji: '🍳', category: 'Makan Siang', servings: 2, ingredients: [], steps: [], nutrition: {}, tags: [] };
    let emoji = r.emoji || '🍳';
    const back = r.id ? `#/resep/detail?id=${r.id}` : '#/resep';

    el.innerHTML = `
      ${pageHeader({ title: r.id ? 'Edit Recipe' : fromAi ? 'Review AI Recipe' : 'New Recipe', subtitle: fromAi ? 'Cek & ubah bila perlu, lalu simpan' : 'Bahan, langkah & gizi', emoji: fromAi ? '✨' : '✍️', tone: 'peach', back })}
      ${fromAi ? `<div class="notice tone-butter">✨ Disusun oleh AI. Takaran & gizi adalah <b>perkiraan</b> — sesuaikan dengan kebiasaan masak keluargamu.</div>` : ''}

      <form class="card form" data-recipe autocomplete="off">
        <div class="field"><span>Ikon</span>
          <div class="icon-pick">${rcp.RECIPE_EMOJIS.map((i) => `<button type="button" class="icon-pick__item ${i === emoji ? 'on' : ''}" data-icon="${i}" aria-label="Ikon ${i}">${i}</button>`).join('')}</div>
        </div>
        <label class="field"><span>Nama masakan *</span><input class="input" name="name" required maxlength="60" value="${esc(r.name || '')}" placeholder="cth. Sayur Asem Jakarta" /></label>
        <div class="grid-2">
          <label class="field"><span>Kategori</span><select class="input" name="category">${options(rcp.CATEGORIES, r.category)}</select></label>
          <label class="field"><span>Porsi</span><input class="input" name="servings" type="number" min="1" inputmode="numeric" value="${esc(r.servings || 2)}" /></label>
        </div>
        <div class="grid-2">
          <label class="field"><span>Persiapan (menit)</span><input class="input" name="prepMinutes" type="number" min="0" inputmode="numeric" value="${esc(r.prepMinutes || '')}" /></label>
          <label class="field"><span>Memasak (menit)</span><input class="input" name="cookMinutes" type="number" min="0" inputmode="numeric" value="${esc(r.cookMinutes || '')}" /></label>
        </div>

        <label class="field"><span>Bahan — satu per baris</span>
          <textarea class="input textarea" name="ingredients" rows="7" placeholder="400 gram nasi putih&#10;2 butir telur&#10;3 siung bawang putih, cincang&#10;garam secukupnya">${esc((r.ingredients || []).map((i) => rcp.ingredientText(i)).join('\n'))}</textarea>
        </label>
        <label class="field"><span>Langkah — satu per baris</span>
          <textarea class="input textarea" name="steps" rows="7" placeholder="Tumis bawang sampai harum&#10;Masukkan telur, orak-arik&#10;Masukkan nasi, aduk rata">${esc((r.steps || []).join('\n'))}</textarea>
        </label>

        <div class="field">
          <span class="row between">Gizi per porsi (perkiraan)
            ${rcp.aiAvailable() ? '<button type="button" class="link small" data-ai-nutri>✨ Hitung dengan AI</button>' : ''}</span>
          <div class="nutri-grid">
            ${rcp.NUTRIENTS.map((n) => `<label class="nutri-input"><small>${n.label}</small><div><input name="n_${n.key}" type="number" min="0" step="any" inputmode="decimal" value="${esc(r.nutrition?.[n.key] ?? '')}" /><span>${n.unit}</span></div></label>`).join('')}
          </div>
          <p class="muted small" data-nutri-status></p>
        </div>

        <label class="field"><span>Label (pisahkan dengan koma)</span><input class="input" name="tags" value="${esc((r.tags || []).join(', '))}" placeholder="cth. pedas, anak, cepat" /></label>
        <label class="field"><span>Catatan / tips</span><input class="input" name="note" maxlength="200" value="${esc(r.note || '')}" /></label>

        <button class="btn btn--primary btn--block" type="submit">💾 Simpan Resep</button>
      </form>`;

    const form = el.querySelector('[data-recipe]');
    form.querySelectorAll('[data-icon]').forEach((b) =>
      b.addEventListener('click', () => {
        emoji = b.dataset.icon;
        form.querySelectorAll('[data-icon]').forEach((x) => x.classList.toggle('on', x === b));
      })
    );

    const collect = () => {
      const d = formData(form);
      const nutrition = {};
      rcp.NUTRIENTS.forEach((n) => (nutrition[n.key] = d[`n_${n.key}`]));
      return {
        id: r.id,
        name: d.name,
        emoji,
        category: d.category,
        servings: d.servings,
        prepMinutes: d.prepMinutes,
        cookMinutes: d.cookMinutes,
        ingredients: rcp.parseIngredients(d.ingredients),
        steps: d.steps.split('\n'),
        nutrition,
        tags: d.tags.split(','),
        note: d.note,
        source: r.source || (fromAi ? 'ai' : 'manual'),
        favorite: r.favorite,
      };
    };

    form.querySelector('[data-ai-nutri]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const d = collect();
      if (!d.ingredients.length) return toast('Isi bahan dulu supaya gizinya bisa dihitung', 'warn');
      const status = form.querySelector('[data-nutri-status]');
      btn.disabled = true;
      status.textContent = '⏳ AI menghitung gizi…';
      try {
        const text = `${d.name || 'Masakan'} untuk ${d.servings || 1} porsi.\nBahan:\n${d.ingredients.map((i) => rcp.ingredientText(i)).join('\n')}`;
        const draft = await rcp.aiDraft(text);
        rcp.NUTRIENTS.forEach((n) => (form[`n_${n.key}`].value = draft.nutrition?.[n.key] ?? ''));
        status.textContent = '✨ Gizi diisi oleh AI (perkiraan per porsi).';
      } catch (err) {
        status.textContent = `⚠️ ${err.message}`;
      } finally {
        btn.disabled = false;
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const saved = rcp.saveRecipe(collect());
        sessionStorage.removeItem(DRAFT_KEY);
        toast('✅ Resep tersimpan');
        navigate(`/resep/detail?id=${saved.id}`);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  },
};
