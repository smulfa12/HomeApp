/**
 * Kategori Budget — atur sendiri daftar kategori pengeluaran (dipakai untuk
 * budget & laporan) dan kategori pemasukan: tambah, ganti nama/ikon,
 * urutkan, sembunyikan, hapus.
 */
import { pageHeader, esc, openSheet, toast, confirmDialog } from '../../service/ui.service.js';
import { rupiah, thisMonth } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';

const LABEL = { expense: 'Pengeluaran', income: 'Pemasukan' };

export default {
  path: '/finance/kategori',
  title: 'Kategori',
  render(el, params) {
    let type = params.type === 'income' ? 'income' : 'expense';
    const back = { settings: '#/settings', budget: '#/finance/budget' }[params.from] || '#/finance';

    const draw = () => {
      const all = fin.getCategories(type, { includeHidden: true });
      const active = all.filter((c) => !c.hidden);
      const hidden = all.filter((c) => c.hidden);
      const budget = type === 'expense' ? fin.getBudget(thisMonth()) : {};

      const row = (c) => {
        const idx = active.indexOf(c);
        const used = fin.categoryUsage(type, c.name);
        const meta = [
          used ? `${used} transaksi` : 'belum dipakai',
          budget[c.name] ? `budget ${rupiah(budget[c.name])}/bln` : '',
          fin.isSystemCategory(type, c.name) ? 'bawaan sistem' : '',
        ].filter(Boolean).join(' · ');
        return `
          <li class="cat-row ${c.hidden ? 'cat-row--hidden' : ''}">
            <button class="cat-row__main" data-edit="${esc(c.name)}">
              <span class="cat-row__emoji">${esc(c.emoji)}</span>
              <span class="grow"><strong>${esc(c.name)}</strong><small>${meta}</small></span>
            </button>
            ${c.hidden ? '' : `
            <div class="cat-row__move">
              <button class="icon-btn icon-btn--plain icon-btn--sm" data-move="-1" data-name="${esc(c.name)}" ${idx === 0 ? 'disabled' : ''} aria-label="Naikkan ${esc(c.name)}">▲</button>
              <button class="icon-btn icon-btn--plain icon-btn--sm" data-move="1" data-name="${esc(c.name)}" ${idx === active.length - 1 ? 'disabled' : ''} aria-label="Turunkan ${esc(c.name)}">▼</button>
            </div>`}
          </li>`;
      };

      el.innerHTML = `
        ${pageHeader({ title: 'Kategori', subtitle: 'Atur sendiri daftar kategori budget', emoji: '🗂️', tone: 'butter', back })}

        <div class="segmented">
          <button class="${type === 'expense' ? 'on' : ''}" data-type="expense">⬇️ Pengeluaran</button>
          <button class="${type === 'income' ? 'on' : ''}" data-type="income">⬆️ Pemasukan</button>
        </div>

        <button class="btn btn--primary btn--block" data-add>➕ Tambah Kategori ${LABEL[type]}</button>

        <section class="card">
          <div class="card__head"><h2>${LABEL[type]} (${active.length})</h2><span class="muted small">urutan = urutan di form</span></div>
          <ul class="cat-list">${active.map(row).join('')}</ul>
          ${type === 'expense' ? `<a class="link small" href="#/finance/budget">🎯 Atur nominal budget per kategori ›</a>` : ''}
        </section>

        ${hidden.length ? `
        <details class="card archived-box">
          <summary>🙈 Disembunyikan (${hidden.length})</summary>
          <p class="muted small">Tidak muncul di form & budget, tapi transaksi lamanya tetap ada di laporan.</p>
          <ul class="cat-list">${hidden.map(row).join('')}</ul>
        </details>` : ''}

        <button class="btn btn--ghost btn--block" data-reset>↺ Kembalikan ke kategori bawaan</button>`;

      el.querySelectorAll('[data-type]').forEach((b) =>
        b.addEventListener('click', () => {
          type = b.dataset.type;
          draw();
        })
      );
      el.querySelector('[data-add]').addEventListener('click', () => edit(null));
      el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => edit(all.find((c) => c.name === b.dataset.edit))));
      el.querySelectorAll('[data-move]').forEach((b) =>
        b.addEventListener('click', () => {
          fin.moveCategory(type, b.dataset.name, Number(b.dataset.move));
          draw();
        })
      );
      el.querySelector('[data-reset]').addEventListener('click', async () => {
        const ok = await confirmDialog(
          `Kembalikan daftar kategori ${LABEL[type].toLowerCase()} ke bawaan? Kategori buatan sendiri akan hilang dari daftar (transaksi lamanya tetap ada).`,
          { okText: 'Kembalikan', danger: true }
        );
        if (!ok) return;
        fin.resetCategories(type);
        toast('↺ Kategori dikembalikan ke bawaan');
        draw();
      });
    };

    const edit = (cat) => {
      const isNew = !cat;
      const system = cat && fin.isSystemCategory(type, cat.name);
      const used = cat ? fin.categoryUsage(type, cat.name) : 0;
      let emoji = cat?.emoji || '🏷️';

      const sheet = openSheet({
        title: isNew ? `Kategori ${LABEL[type]} Baru` : `Edit ${cat.name}`,
        body: `
          <form class="form" data-cat-form autocomplete="off">
            <div class="cat-preview"><span data-preview>${esc(emoji)}</span></div>
            <label class="field"><span>Nama kategori *</span>
              <input class="input" name="name" required maxlength="30" value="${esc(cat?.name || '')}" ${system ? 'readonly' : ''}
                     placeholder="${type === 'expense' ? 'cth. Jajan Anak, Arisan, Servis Motor' : 'cth. Freelance, Sewa Kos'}" />
            </label>
            ${system ? `<p class="muted small">🔒 Kategori bawaan sistem: namanya tidak bisa diganti, ikonnya bisa.</p>` : ''}
            ${!isNew && used && !system ? `<p class="muted small">Ganti nama → ${used} transaksi${type === 'expense' ? ' & budget' : ''} lama ikut pindah ke nama baru.</p>` : ''}

            <div class="field"><span>Ikon</span>
              <div class="icon-pick">
                ${fin.CATEGORY_EMOJIS.map((i) => `<button type="button" class="icon-pick__item ${i === emoji ? 'on' : ''}" data-icon="${i}" aria-label="Ikon ${i}">${i}</button>`).join('')}
              </div>
              <input class="input" name="custom" maxlength="8" placeholder="atau ketik emoji sendiri 🙂" />
            </div>

            <button class="btn btn--primary btn--block" type="submit">💾 Simpan</button>
            ${isNew ? '' : `
              <button class="btn btn--soft btn--block" type="button" data-hide>${cat.hidden ? '👁️ Tampilkan lagi' : '🙈 Sembunyikan'}</button>
              ${system ? '' : `<button class="btn btn--danger-soft btn--block" type="button" data-del>🗑️ Hapus</button>`}`}
          </form>`,
      });

      const form = sheet.el.querySelector('[data-cat-form]');
      const preview = form.querySelector('[data-preview]');
      const pick = (value) => {
        emoji = value;
        preview.textContent = value;
        form.querySelectorAll('[data-icon]').forEach((b) => b.classList.toggle('on', b.dataset.icon === value));
      };
      form.querySelectorAll('[data-icon]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.icon)));
      form.custom.addEventListener('input', () => form.custom.value.trim() && pick(form.custom.value.trim()));

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          if (isNew) fin.addCategory(type, { name: form.name.value, emoji });
          else fin.updateCategory(type, cat.name, { name: form.name.value, emoji });
          sheet.close();
          toast(isNew ? '✅ Kategori ditambahkan' : '✅ Kategori diperbarui');
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      });

      sheet.el.querySelector('[data-hide]')?.addEventListener('click', () => {
        try {
          fin.setCategoryHidden(type, cat.name, !cat.hidden);
          sheet.close();
          toast(cat.hidden ? '👁️ Kategori tampil lagi' : '🙈 Kategori disembunyikan');
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      });

      sheet.el.querySelector('[data-del]')?.addEventListener('click', async () => {
        sheet.close();
        if (used) {
          const ok = await confirmDialog(`"${cat.name}" dipakai di ${used} transaksi, jadi tidak bisa dihapus. Sembunyikan saja?`, { okText: 'Sembunyikan' });
          if (ok) {
            fin.setCategoryHidden(type, cat.name, true);
            toast('🙈 Kategori disembunyikan');
            draw();
          }
          return;
        }
        if (!(await confirmDialog(`Hapus kategori "${cat.name}"?`, { okText: 'Hapus', danger: true }))) return;
        try {
          fin.deleteCategory(type, cat.name);
          toast('Kategori dihapus');
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    };

    draw();
  },
};
