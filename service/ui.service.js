/**
 * UI Service
 * Komponen tampilan yang dipakai ulang oleh semua menu:
 * header halaman, toast, bottom sheet, konfirmasi, empty state,
 * filter periode, dan helper escape HTML.
 */
import { periodRange } from './format.service.js';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Header halaman dengan tombol kembali dan warna tema. */
export function pageHeader({ title, subtitle = '', emoji = '', tone = 'mint', back = '#/' }) {
  return `
    <header class="page-head tone-${tone}">
      ${back ? `<a class="icon-btn" href="${back}" aria-label="Kembali">‹</a>` : ''}
      <div class="page-head__text">
        <h1>${emoji ? `<span class="page-head__emoji">${emoji}</span>` : ''}${esc(title)}</h1>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      </div>
    </header>`;
}

export function emptyState(emoji, title, text = '', action = '') {
  return `
    <div class="empty">
      <div class="empty__emoji">${emoji}</div>
      <h3>${esc(title)}</h3>
      ${text ? `<p>${esc(text)}</p>` : ''}
      ${action}
    </div>`;
}

/* ---------- Toast ---------- */

let toastTimer;
export function toast(message, type = 'ok') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.dataset.type = type;
  el.classList.add('toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast--show'), 2600);
}

/* ---------- Bottom sheet / modal ---------- */

export function openSheet({ title, body, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet';
  wrap.innerHTML = `
    <div class="sheet__backdrop" data-close></div>
    <section class="sheet__panel" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet__grip"></div>
      <div class="sheet__head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn icon-btn--plain" data-close aria-label="Tutup">✕</button>
      </div>
      <div class="sheet__body">${body}</div>
    </section>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => wrap.classList.add('sheet--open'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('sheet--open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => wrap.remove(), 250);
  };
  wrap.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => {
      onClose ? onClose() : close();
    })
  );
  return { el: wrap, close };
}

export function confirmDialog(message, { okText = 'Ya', cancelText = 'Batal', danger = false } = {}) {
  return new Promise((resolve) => {
    const sheet = openSheet({
      title: 'Konfirmasi',
      body: `
        <p class="confirm-text">${esc(message)}</p>
        <div class="row gap-sm">
          <button class="btn btn--ghost grow" data-no>${esc(cancelText)}</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'} grow" data-yes>${esc(okText)}</button>
        </div>`,
      onClose: () => done(false),
    });
    const done = (v) => {
      sheet.close();
      resolve(v);
    };
    sheet.el.querySelector('[data-no]').onclick = () => done(false);
    sheet.el.querySelector('[data-yes]').onclick = () => done(true);
  });
}

/** User sedang mengetik / membuka sheet → jangan render ulang halaman. */
export function isUserBusy() {
  const a = document.activeElement;
  return Boolean(document.querySelector('.sheet') || (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)));
}

/* ---------- Form helpers ---------- */

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function options(list, selected, { valueKey, labelKey } = {}) {
  return list
    .map((o) => {
      const value = valueKey ? o[valueKey] : o;
      const label = labelKey ? (typeof labelKey === 'function' ? labelKey(o) : o[labelKey]) : o;
      return `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;
    })
    .join('');
}

/** Input nominal rupiah yang otomatis diberi titik ribuan saat diketik. */
export function bindMoneyInput(input) {
  const fmt = () => {
    const digits = input.value.replace(/[^\d]/g, '');
    input.value = digits ? Number(digits).toLocaleString('id-ID') : '';
  };
  input.addEventListener('input', fmt);
  fmt();
}

/* ---------- Filter periode ---------- */

const PRESETS = [
  ['this-month', 'Bulan ini'],
  ['last-month', 'Bulan lalu'],
  ['3-months', '3 Bulan'],
  ['this-year', 'Tahun ini'],
  ['custom', 'Pilih tanggal'],
];

/**
 * Render chip filter periode ke dalam `el`. Memanggil onChange({from,to})
 * setiap kali periode berubah (dan sekali saat awal).
 */
export function periodFilter(el, onChange, initial = 'this-month') {
  let preset = initial;
  const range = periodRange(preset);
  el.innerHTML = `
    <div class="chips" role="tablist">
      ${PRESETS.map(([k, l]) => `<button class="chip ${k === preset ? 'chip--on' : ''}" data-p="${k}">${l}</button>`).join('')}
    </div>
    <div class="custom-range ${preset === 'custom' ? '' : 'hidden'}">
      <input type="date" class="input" data-from value="${range.from}" />
      <span class="muted">s/d</span>
      <input type="date" class="input" data-to value="${range.to}" />
    </div>`;
  const custom = el.querySelector('.custom-range');
  const fromIn = el.querySelector('[data-from]');
  const toIn = el.querySelector('[data-to]');
  const emit = () => onChange(periodRange(preset, { from: fromIn.value, to: toIn.value }));

  el.querySelectorAll('[data-p]').forEach((b) =>
    b.addEventListener('click', () => {
      preset = b.dataset.p;
      el.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('chip--on', x === b));
      custom.classList.toggle('hidden', preset !== 'custom');
      if (preset !== 'custom') {
        const r = periodRange(preset);
        fromIn.value = r.from;
        toIn.value = r.to;
      }
      emit();
    })
  );
  fromIn.addEventListener('change', emit);
  toIn.addEventListener('change', emit);
  emit();
}

/** Bar horizontal sederhana untuk breakdown kategori. */
export function barList(rows, { tone = 'peach', format = (v) => v, emoji = () => '' } = {}) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return `
    <ul class="bar-list tone-${tone}">
      ${rows
        .map(
          (r) => `
        <li>
          <div class="bar-list__label">
            <span>${emoji(r.category)} ${esc(r.category)}</span>
            <strong>${format(r.total)}</strong>
          </div>
          <div class="bar"><span style="width:${Math.max((r.total / max) * 100, 3)}%"></span></div>
        </li>`
        )
        .join('')}
    </ul>`;
}

/** Animasi perayaan (konfeti emoji) + pesan, mis. saat target tabungan tercapai. */
export function celebrate(message) {
  const layer = document.createElement('div');
  layer.className = 'celebrate';
  layer.setAttribute('role', 'status');
  const bits = ['🎉', '✨', '🤍', '🪙', '🎊', '⭐'];
  layer.innerHTML =
    `<div class="celebrate__msg">${esc(message)}</div>` +
    Array.from({ length: 28 }, (_, i) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.6;
      const dur = 1.6 + Math.random() * 1.2;
      return `<span style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s">${bits[i % bits.length]}</span>`;
    }).join('');
  document.body.appendChild(layer);
  if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
  layer.addEventListener('click', () => layer.remove());
  setTimeout(() => layer.remove(), 3200);
}

/**
 * Konfirmasi untuk tindakan berbahaya: user wajib mengetik `word` (mis. HAPUS)
 * sebelum tombol aktif. Resolve true / false.
 */
export function confirmTyped(message, word, { okText = 'Lanjutkan', detail = '' } = {}) {
  return new Promise((resolve) => {
    const sheet = openSheet({
      title: '⚠️ Tindakan berbahaya',
      body: `
        <p class="confirm-text">${esc(message)}</p>
        ${detail ? `<p class="muted small">${esc(detail)}</p>` : ''}
        <label class="field">
          <span>Ketik <b class="danger-word">${esc(word)}</b> untuk melanjutkan</span>
          <input class="input" data-typed autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(word)}" />
        </label>
        <div class="row gap-sm">
          <button class="btn btn--ghost grow" data-no>Batal</button>
          <button class="btn btn--danger grow" data-yes disabled>${esc(okText)}</button>
        </div>`,
      onClose: () => done(false),
    });
    let finished = false;
    const done = (v) => {
      if (finished) return;
      finished = true;
      sheet.close();
      resolve(v);
    };
    const input = sheet.el.querySelector('[data-typed]');
    const yes = sheet.el.querySelector('[data-yes]');
    input.addEventListener('input', () => (yes.disabled = input.value.trim().toUpperCase() !== word.toUpperCase()));
    sheet.el.querySelector('[data-no]').onclick = () => done(false);
    yes.onclick = () => !yes.disabled && done(true);
    setTimeout(() => input.focus(), 300);
  });
}
