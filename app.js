/**
 * ============================================================
 *  Rumahku — Main App
 *  File ini HANYA mendaftarkan & memanggil modul menu.
 *  Logika data ada di /service, tampilan menu ada di /program,
 *  dan desain ada di /style.
 * ============================================================
 */
import { createRouter } from './service/router.service.js';
import { initData, needsLogin } from './service/sync.service.js';
import { isUserBusy } from './service/ui.service.js';
import { enableAutoUpdate } from './service/update.service.js';

// Login, beranda & pengaturan
import login from './program/login.js';
import home from './program/home.js';
import settings from './program/settings.js';

// Menu Utama Inventory Rumah
import inventoryMenu from './program/inventory/inventory-menu.js';
import inputBarang from './program/inventory/input-barang.js';
import stockKeluar from './program/inventory/stock-keluar.js';
import stockOpname from './program/inventory/stock-opname.js';
import daftarBelanja from './program/inventory/daftar-belanja.js';
import barangLokasi from './program/inventory/barang-lokasi.js';

// Menu Utama Financial Rumah
import financeMenu from './program/finance/finance-menu.js';
import inputIncome from './program/finance/input-income.js';
import inputExpense from './program/finance/input-expense.js';
import laporanPengeluaran from './program/finance/laporan-pengeluaran.js';
import laporanPemasukan from './program/finance/laporan-pemasukan.js';
import neracaLabaRugi from './program/finance/neraca-labarugi.js';
import budget from './program/finance/budget.js';
import akun from './program/finance/akun.js';
import transfer from './program/finance/transfer.js';

const MODULES = [
  login, home, settings,
  inventoryMenu, inputBarang, stockKeluar, stockOpname, daftarBelanja, barangLokasi,
  financeMenu, inputIncome, inputExpense, laporanPengeluaran, laporanPemasukan, neracaLabaRugi, budget, akun, transfer,
];

/** Tandai tab navigasi bawah yang aktif sesuai halaman. */
function highlightNav(path) {
  document.body.classList.toggle('auth-page', path === '/login');
  const section = path.startsWith('/inventory') ? 'inventory' : path.startsWith('/finance') ? 'finance' : path.startsWith('/settings') ? 'settings' : 'home';
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === section));
}

const router = createRouter({
  outlet: document.getElementById('app'),
  onNavigate: highlightNav,
  guard: (path) => (needsLogin() ? '/login' : path === '/login' ? '/' : null),
});
MODULES.forEach((m) => router.register(m));

// Siapkan database (Supabase) lalu tampilkan halaman pertama
await initData({ onRemoteChange: () => router.refreshInBackground(isUserBusy) });
router.start();

// Mode offline + update otomatis ke versi terbaru
enableAutoUpdate();
