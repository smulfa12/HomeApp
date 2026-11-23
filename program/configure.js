/**
 * Configure (khusus Admin) — atur role & menu yang boleh dibuka tiap akun.
 * Akun baru dibuat di Supabase (Authentication → Users), lalu muncul di sini.
 */
import { pageHeader, esc, toast, emptyState, confirmDialog } from '../service/ui.service.js';
import * as access from '../service/access.service.js';

export default {
  path: '/configure',
  title: 'Configure',
  autoRefresh: false,
  render(el) {
    let alive = true;
    const me = access.currentAccess().userId;

    el.innerHTML = `
      ${pageHeader({ title: 'Configure', subtitle: 'Role & akses menu tiap akun', emoji: '🔐', tone: 'lavender', back: '#/settings' })}
      <div class="notice tone-sky small">👑 <b>Admin</b> bisa membuka semua menu & mengatur akun lain.<br/>🙂 <b>User</b> hanya bisa membuka menu yang dicentang.</div>
      <div data-users><section class="card"><p class="muted small">⏳ Memuat akun…</p></section></div>
      <p class="muted small center">Tambah akun baru: Supabase → Authentication → Users → <b>Add user</b>. Akun baru otomatis jadi User.</p>`;
    const box = el.querySelector('[data-users]');

    const card = (u) => {
      const self = u.user_id === me;
      const admin = u.role === 'admin';
      return `
        <section class="card user-card" data-user="${u.user_id}">
          <div class="card__head">
            <h2 class="user-card__email">${esc(u.email || '(tanpa email)')}</h2>
            ${self ? '<span class="badge badge--info">kamu</span>' : ''}
          </div>
          <div class="segmented" role="radiogroup" aria-label="Role">
            <button type="button" class="${admin ? 'on' : ''}" data-role="admin" ${self ? 'disabled' : ''}>👑 Admin</button>
            <button type="button" class="${!admin ? 'on' : ''}" data-role="user" ${self ? 'disabled' : ''}>🙂 User</button>
          </div>
          <p class="muted small">Menu yang boleh dibuka${admin ? ' — admin otomatis semua' : ''}:</p>
          <div class="chips chips--wrap">
            ${access.MENUS.map((m) => `<button type="button" class="chip ${admin || (u.menus || []).includes(m.key) ? 'chip--on' : ''}" data-menu="${m.key}" ${admin ? 'disabled' : ''}>${m.icon} ${m.label}</button>`).join('')}
          </div>
          <button class="btn btn--primary btn--block hidden" data-save>💾 Simpan</button>
        </section>`;
    };

    const bind = (users) => {
      box.querySelectorAll('[data-user]').forEach((c) => {
        const u = users.find((x) => x.user_id === c.dataset.user);
        const draft = { role: u.role, menus: [...(u.menus || [])] };
        const dirty = () => c.querySelector('[data-save]').classList.remove('hidden');
        c.querySelectorAll('[data-role]').forEach((b) =>
          b.addEventListener('click', () => {
            draft.role = b.dataset.role;
            c.querySelectorAll('[data-role]').forEach((x) => x.classList.toggle('on', x === b));
            c.querySelectorAll('[data-menu]').forEach((x) => {
              x.disabled = draft.role === 'admin';
              x.classList.toggle('chip--on', draft.role === 'admin' || draft.menus.includes(x.dataset.menu));
            });
            dirty();
          })
        );
        c.querySelectorAll('[data-menu]').forEach((b) =>
          b.addEventListener('click', () => {
            const k = b.dataset.menu;
            draft.menus = draft.menus.includes(k) ? draft.menus.filter((m) => m !== k) : [...draft.menus, k];
            b.classList.toggle('chip--on', draft.menus.includes(k));
            dirty();
          })
        );
        c.querySelector('[data-save]').addEventListener('click', async (e) => {
          if (draft.role === 'admin' && u.role !== 'admin' && !(await confirmDialog(`Jadikan ${u.email} Admin? Admin bisa membuka semua data & mengatur akun lain.`, { okText: 'Jadikan Admin' }))) return;
          if (draft.role === 'user' && !draft.menus.length && !(await confirmDialog(`${u.email} tidak akan bisa membuka menu apa pun. Lanjutkan?`, { okText: 'Lanjutkan' }))) return;
          e.target.disabled = true;
          try {
            await access.updateUser(u.user_id, draft);
            u.role = draft.role;
            u.menus = draft.menus;
            e.target.classList.add('hidden');
            toast('✅ Akses disimpan');
          } catch (err) {
            toast(navigator.onLine ? err.message : 'Perlu internet untuk menyimpan', 'error');
          } finally {
            e.target.disabled = false;
          }
        });
      });
    };

    const load = async () => {
      try {
        const users = await access.listUsers();
        if (!alive) return;
        box.innerHTML = users.length
          ? users.map(card).join('')
          : `<section class="card">${emptyState('👥', 'Belum ada akun', 'Jalankan SQL 008_role_akses.sql di Supabase.')}</section>`;
        bind(users);
      } catch (err) {
        if (!alive) return;
        box.innerHTML = `<section class="card">${emptyState('📴', 'Gagal memuat akun', navigator.onLine ? esc(err.message) : 'Perlu internet untuk mengatur akun.')}</section>`;
      }
    };
    load();
    return () => (alive = false);
  },
};
