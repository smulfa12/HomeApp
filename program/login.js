/**
 * Halaman Login (database Supabase)
 * Akun anggota keluarga dibuat oleh pemilik di dashboard Supabase.
 */
import { esc, toast } from '../service/ui.service.js';
import { login, needsLogin } from '../service/sync.service.js';
import { navigate } from '../service/router.service.js';

const ERRORS = {
  'Invalid login credentials': 'Email atau password salah',
  'Email not confirmed': 'Email belum dikonfirmasi',
};

export default {
  path: '/login',
  title: 'Login',
  autoRefresh: false,
  render(el) {
    if (!needsLogin()) return navigate('/');

    el.innerHTML = `
      <div class="login">
        <img class="login__logo" src="style/assets/icon.svg" alt="" width="96" height="96" />
        <h1>Rumahku</h1>
        <p class="muted">Inventory & keuangan keluarga, tersimpan aman di cloud ☁️</p>

        <form class="card form" data-login autocomplete="on">
          <label class="field">
            <span>Email</span>
            <input class="input" type="email" name="email" autocomplete="username" required placeholder="nama@email.com" />
          </label>
          <label class="field">
            <span>Password</span>
            <input class="input" type="password" name="password" autocomplete="current-password" required placeholder="••••••••" />
          </label>
          <p class="login__error hidden" data-error role="alert"></p>
          <button class="btn btn--primary btn--block" type="submit" data-submit>Masuk</button>
        </form>

        <p class="muted small center">Belum punya akun? Minta pemilik aplikasi menambahkan email kamu di Supabase.</p>
      </div>`;

    const form = el.querySelector('[data-login]');
    const errorEl = el.querySelector('[data-error]');
    const btn = el.querySelector('[data-submit]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Memuat data…';
      errorEl.classList.add('hidden');
      try {
        await login(form.email.value, form.password.value);
        toast('👋 Selamat datang!');
        navigate('/');
      } catch (err) {
        const msg = ERRORS[err?.message] || (navigator.onLine ? err?.message || 'Gagal masuk' : 'Tidak ada koneksi internet');
        errorEl.innerHTML = `⚠️ ${esc(msg)}`;
        errorEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Masuk';
      }
    });
  },
};
