/**
 * Beranda — ringkasan inventory & keuangan, akses cepat ke dua menu utama.
 */
import { esc } from '../service/ui.service.js';
import { rupiahShort, thisMonth, monthLabel } from '../service/format.service.js';
import * as inv from '../service/inventory.service.js';
import * as fin from '../service/finance.service.js';
import { syncState, onSyncChange } from '../service/sync.service.js';
import * as act from '../service/activity.service.js';
import { today } from '../service/format.service.js';
import { todoRow } from './shared/todo-row.js';
import { can, isAdmin } from '../service/access.service.js';
import * as bill from '../service/bill.service.js';
import { billRow, openPaySheet } from './finance/tagihan.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return ['Selamat pagi', '☀️'];
  if (h < 15) return ['Selamat siang', '🌤️'];
  if (h < 18) return ['Selamat sore', '🌇'];
  return ['Selamat malam', '🌙'];
}

export default {
  path: '/',
  title: 'Home',
  render(el) {
    const [hello, icon] = greeting();
    const is = inv.summary();
    const fs = fin.summary(thisMonth());
    const low = inv.shoppingList().slice(0, 3);
    const empty = isAdmin() && is.totalItems === 0 && fs.income === 0 && fs.expense === 0;
    const sync = syncState();
    const pillHtml = (st) =>
      st.mode === 'cloud' ? `${SYNC_LABEL[st.status] || SYNC_LABEL.idle}${st.pending ? ` · ${st.pending} antri` : ''}` : '';
    const SYNC_LABEL = { synced: '☁️ Tersinkron', syncing: '🔄 Sinkron…', offline: '📴 Offline', error: '⚠️ Gagal sinkron', idle: '☁️ Online' };

    const goals = fin.listGoals().slice(0, 3);
    const goalsHtml = goals.length && can('finance')
      ? `<a class="card goal-mini" href="#/finance/target">
          <div class="card__head"><h2>🐷 Savings Goals</h2><span class="link">Semua ›</span></div>
          ${goals
            .map((g) => {
              const p = fin.goalProgress(g);
              return `<div class="goal-mini__row">
                <div class="row between small"><span>${esc(g.icon || '🐷')} <b>${esc(g.name)}</b></span><b>${p.pct}%</b></div>
                <div class="goal-bar goal-bar--${p.done ? 'ok' : 'goal'} goal-bar--thin"><span style="width:${Math.min(p.pct, 100)}%"></span></div>
              </div>`;
            })
            .join('')}
        </a>`
      : '';

    // Kegiatan hari ini: yang belum selesai dulu (urut jam), maks. 4
    const tasks = act.tasksForDate(today());
    const doneCount = tasks.filter((t) => t.done).length;
    const upcoming = [...tasks.filter((t) => !t.done), ...tasks.filter((t) => t.done)].slice(0, 4);
    const todoHtml = !can('kegiatan') ? '' : `
      <section class="card todo-home">
        <div class="card__head">
          <h2>✅ Today's Activities</h2>
          <a class="link" href="#/kegiatan">${tasks.length ? `${doneCount}/${tasks.length} selesai ›` : 'Buka ›'}</a>
        </div>
        ${tasks.length
          ? `<div class="bar"><span style="width:${Math.round((doneCount / tasks.length) * 100)}%"></span></div>
             <ul class="todo-list">${upcoming.map((t) => todoRow(t, today(), { compact: true })).join('')}</ul>`
          : `<p class="muted small">Belum ada kegiatan. <a class="link" href="#/kegiatan">Buat jadwal harian</a></p>`}
      </section>`;

    // Tagihan yang jatuh tempo ≤ 7 hari lagi / terlambat
    const dueBills = can('finance') ? bill.dueSoon(7) : [];
    const billsHtml = dueBills.length
      ? `<section class="card">
          <div class="card__head"><h2>📅 Bills Due</h2><a class="link" href="#/finance/tagihan">Semua ›</a></div>
          <ul class="bill-list">${dueBills.slice(0, 4).map((x) => billRow(x)).join('')}</ul>
        </section>`
      : '';

    const quick = [
      ...(can('inventory') ? ['<a class="quick tone-mint" href="#/inventory/input"><span>📥</span>Stock In</a>', '<a class="quick tone-peach" href="#/inventory/keluar"><span>📤</span>Stock Out</a>'] : []),
      ...(can('finance') ? ['<a class="quick tone-sky" href="#/finance/expense"><span>🧾</span>Scan Receipt</a>', '<a class="quick tone-butter" href="#/finance/income"><span>💰</span>Income</a>'] : []),
    ];
    const menuCount = ['inventory', 'finance', 'kegiatan', 'resep'].filter(can).length;

    el.innerHTML = `
      <header class="home-head">
        <div>
          <p class="muted">${hello} ${icon}</p>
          <h1>Rumahku</h1>
          ${sync.mode === 'cloud' ? `<a class="sync-pill sync-pill--${sync.status}" href="#/settings" data-sync-pill>${pillHtml(sync)}</a>` : ''}
        </div>
        <a class="icon-btn" href="#/settings" aria-label="Pengaturan">⚙️</a>
      </header>

      ${empty ? `
      <div class="notice tone-lavender">
        👋 Data masih kosong. <a class="link" href="#/settings">Load Sample Data</a> untuk mencoba, atau langsung mulai input.
      </div>` : ''}

      ${todoHtml}

      ${billsHtml}

      ${can('inventory') ? `<a class="big-card tone-mint" href="#/inventory">
        <div class="big-card__top">
          <span class="big-card__icon">📦</span>
          <div><h2>Home Inventory</h2><p>${is.totalItems} barang di ${is.locations} lokasi</p></div>
          <span class="big-card__arrow">›</span>
        </div>
        <div class="big-card__stats">
          <div><strong>${is.lowStock}</strong><small>stok menipis</small></div>
          <div><strong>${is.expiring}</strong><small>segera kadaluarsa</small></div>
        </div>
      </a>` : ''}

      ${can('finance') ? `<a class="big-card tone-lavender" href="#/finance">
        <div class="big-card__top">
          <span class="big-card__icon">💰</span>
          <div><h2>Home Finance</h2><p>${monthLabel(thisMonth())}</p></div>
          <span class="big-card__arrow">›</span>
        </div>
        <div class="big-card__stats">
          <div><strong>${rupiahShort(fs.income)}</strong><small>pemasukan</small></div>
          <div><strong>${rupiahShort(fs.expense)}</strong><small>pengeluaran</small></div>
          <div><strong>${rupiahShort(fs.net)}</strong><small>selisih</small></div>
        </div>
      </a>` : ''}

      ${quick.length ? `<h3 class="section-title">⚡ Quick Actions</h3>
      <div class="quick-grid">${quick.join('')}</div>` : ''}

      ${menuCount ? '' : `<div class="notice tone-lavender">🔒 Akun ini belum diberi akses menu. Minta admin membuka menu lewat <b>Settings → Configure</b>.</div>`}

      ${goalsHtml}

      ${low.length && can('inventory') ? `
      <section class="card">
        <div class="card__head"><h2>🛒 To Buy</h2><a class="link" href="#/inventory/belanja">Semua (${is.lowStock})</a></div>
        <ul class="mini-list">
          ${low.map((i) => `<li><span>${inv.categoryInfo(i.category).emoji} ${esc(i.name)}</span><span class="badge badge--warn">sisa ${i.qty}</span></li>`).join('')}
        </ul>
      </section>` : ''}`;

    el.querySelectorAll('[data-pay]').forEach((b) =>
      b.addEventListener('click', () => openPaySheet(b.dataset.pay, b.dataset.month, () => window.dispatchEvent(new HashChangeEvent('hashchange'))))
    );

    el.querySelectorAll('[data-toggle]').forEach((b) =>
      b.addEventListener('click', () => {
        act.toggleDone(b.dataset.toggle, today());
        window.dispatchEvent(new HashChangeEvent('hashchange')); // render ulang lewat router (listener lama dibersihkan)
      })
    );

    const pill = el.querySelector('[data-sync-pill]');
    return onSyncChange((st) => {
      if (!pill) return;
      pill.className = `sync-pill sync-pill--${st.status}`;
      pill.textContent = pillHtml(st);
    });
  },
};
