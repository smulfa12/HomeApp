/**
 * Atur Lokasi — kelola sendiri daftar tempat penyimpanan barang:
 * tambah, ganti nama/ikon, urutkan, hapus (barang di dalamnya dipindahkan).
 */
import { pageHeader, esc, openSheet, toast, confirmDialog, options } from '../../service/ui.service.js';
import * as inv from '../../service/inventory.service.js';

export default {
  path: '/inventory/lokasi-atur',
  title: 'Atur Lokasi',
  render(el, params) {
    const back = { settings: '#/settings', lokasi: '#/inventory/lokasi', input: '#/inventory/input' }[params.from] || '#/inventory';

    const draw = () => {
      const list = inv.getLocations();
      const unplaced = inv.locationItemCount(inv.NO_LOCATION);

      el.innerHTML = `
        ${pageHeader({ title: 'Atur Lokasi', subtitle: `${list.length} tempat penyimpanan`, emoji: '📍', tone: 'butter', back })}

        <button class="btn btn--primary btn--block" data-add>➕ Tambah Lokasi</button>

        <section class="card">
          <div class="card__head"><h2>Lokasi penyimpanan</h2><span class="muted small">urutan = urutan di pilihan</span></div>
          <ul class="cat-list">
            ${list
              .map((name, idx) => {
                const n = inv.locationItemCount(name);
                return `
              <li class="cat-row">
                <button class="cat-row__main" data-edit="${esc(name)}">
                  <span class="cat-row__emoji">${esc(inv.locationEmoji(name))}</span>
                  <span class="grow"><strong>${esc(name)}</strong><small>${n ? `${n} barang` : 'kosong'}</small></span>
                </button>
                <div class="cat-row__move">
                  <button class="icon-btn icon-btn--plain icon-btn--sm" data-move="-1" data-name="${esc(name)}" ${idx === 0 ? 'disabled' : ''} aria-label="Naikkan ${esc(name)}">▲</button>
                  <button class="icon-btn icon-btn--plain icon-btn--sm" data-move="1" data-name="${esc(name)}" ${idx === list.length - 1 ? 'disabled' : ''} aria-label="Turunkan ${esc(name)}">▼</button>
                </div>
              </li>`;
              })
              .join('')}
          </ul>
          ${unplaced ? `<p class="muted small">❔ ${unplaced} barang belum punya lokasi. <a class="link" href="#/inventory/lokasi?loc=${encodeURIComponent(inv.NO_LOCATION)}">Lihat</a></p>` : ''}
        </section>

        <a class="link-card" href="#/inventory/lokasi">🗂️ Lihat barang per lokasi <span>›</span></a>`;

      el.querySelector('[data-add]').addEventListener('click', () => edit(null));
      el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => edit(b.dataset.edit)));
      el.querySelectorAll('[data-move]').forEach((b) =>
        b.addEventListener('click', () => {
          inv.moveLocation(b.dataset.name, Number(b.dataset.move));
          draw();
        })
      );
    };

    const edit = (name) => {
      const isNew = !name;
      const count = name ? inv.locationItemCount(name) : 0;
      let emoji = name ? inv.locationEmoji(name) : '📍';
      const others = inv.getLocations().filter((l) => l !== name);

      const sheet = openSheet({
        title: isNew ? 'Lokasi Baru' : `Edit ${name}`,
        body: `
          <form class="form" data-loc-form autocomplete="off">
            <div class="cat-preview"><span data-preview>${esc(emoji)}</span></div>
            <label class="field"><span>Nama lokasi *</span>
              <input class="input" name="name" required maxlength="30" value="${esc(name || '')}" placeholder="cth. Rak Dapur Atas, Lemari Obat, Garasi" />
            </label>
            ${!isNew && count ? `<p class="muted small">Ganti nama → ${count} barang di lokasi ini ikut pindah ke nama baru.</p>` : ''}

            <div class="field"><span>Ikon</span>
              <div class="icon-pick">
                ${inv.LOCATION_EMOJIS.map((i) => `<button type="button" class="icon-pick__item ${i === emoji ? 'on' : ''}" data-icon="${i}" aria-label="Ikon ${i}">${i}</button>`).join('')}
              </div>
              <input class="input" name="custom" maxlength="8" placeholder="atau ketik emoji sendiri 🙂" />
            </div>

            <button class="btn btn--primary btn--block" type="submit">💾 Simpan</button>
            ${isNew ? '' : `
              ${count ? `
              <label class="field"><span>Pindahkan ${count} barang ke (bila lokasi ini dihapus)</span>
                <select class="input" name="moveTo">
                  ${options(others)}
                  <option value="${esc(inv.NO_LOCATION)}">❔ ${esc(inv.NO_LOCATION)}</option>
                </select>
              </label>` : ''}
              <button class="btn btn--danger-soft btn--block" type="button" data-del>🗑️ Hapus Lokasi</button>`}
          </form>`,
      });

      const form = sheet.el.querySelector('[data-loc-form]');
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
          if (isNew) inv.addLocation(form.name.value, emoji);
          else inv.updateLocation(name, { name: form.name.value, emoji });
          sheet.close();
          toast(isNew ? '✅ Lokasi ditambahkan' : '✅ Lokasi diperbarui');
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      });

      sheet.el.querySelector('[data-del]')?.addEventListener('click', async () => {
        const moveTo = form.moveTo?.value;
        sheet.close();
        const msg = count ? `Hapus "${name}" dan pindahkan ${count} barang ke "${moveTo}"?` : `Hapus lokasi "${name}"?`;
        if (!(await confirmDialog(msg, { okText: 'Hapus', danger: true }))) return;
        try {
          const moved = inv.deleteLocation(name, moveTo);
          toast(moved ? `🗑️ Lokasi dihapus, ${moved} barang dipindah ke ${moveTo}` : '🗑️ Lokasi dihapus');
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    };

    draw();
  },
};
