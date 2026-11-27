/**
 * Theme Service — tampilan terang / gelap / otomatis (ikut pengaturan HP).
 * Pilihan disimpan per HP. Warna diatur di style/theme.css ([data-theme='dark']).
 */
const KEY = 'rumahku-theme';
export const MODES = [
  ['auto', '🌗 Auto'],
  ['light', '☀️ Light'],
  ['dark', '🌙 Dark'],
];
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getMode() {
  try {
    return localStorage.getItem(KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

/** Terapkan tema ke <html> + warna bilah status HP. */
export function apply(mode = getMode()) {
  const dark = mode === 'dark' || (mode === 'auto' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1B1D1B' : '#F6F4EF');
}

export function setMode(mode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch { /* mode privat: tetap berlaku sampai ditutup */ }
  apply(mode);
}

// Mode Auto: ikut berubah saat HP berganti terang/gelap
media.addEventListener?.('change', () => getMode() === 'auto' && apply());
apply();
