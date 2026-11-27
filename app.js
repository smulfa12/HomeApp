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
import { canPath, MENUS, can } from './service/access.service.js';
import { startNotifications } from './service/notification.service.js';
import './service/theme.service.js'; // tema terang / gelap

// Login, beranda & pengaturan
import login from './program/login.js';
import home from './program/home.js';
import settings from './program/settings.js';
import configure from './program/configure.js';

// Menu Utama Inventory Rumah
import inventoryMenu from './program/inventory/inventory-menu.js';
import inputBarang from './program/inventory/input-barang.js';
import stockKeluar from './program/inventory/stock-keluar.js';
import stockOpname from './program/inventory/stock-opname.js';
import daftarBelanja from './program/inventory/daftar-belanja.js';
import barangLokasi from './program/inventory/barang-lokasi.js';
import lokasiAtur from './program/inventory/lokasi-atur.js';
import modeBelanja from './program/inventory/mode-belanja.js';
import riwayatBelanja from './program/inventory/riwayat-belanja.js';

// Menu Utama Kegiatan
import kegiatan from './program/activity/kegiatan.js';

// Menu Utama Resep
import resep from './program/recipe/resep.js';
import resepForm from './program/recipe/resep-form.js';
import resepDetail from './program/recipe/resep-detail.js';
import belanjaMingguan from './program/recipe/belanja-mingguan.js';

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
import targetTabungan from './program/finance/target-tabungan.js';
import kategori from './program/finance/kategori.js';
import tren from './program/finance/tren.js';
import tagihan from './program/finance/tagihan.js';

const MODULES = [
  login, home, settings, configure,
  kegiatan,
  resep, resepForm, resepDetail, belanjaMingguan,
  inventoryMenu, inputBarang, stockKeluar, stockOpname, daftarBelanja, modeBelanja, riwayatBelanja, barangLokasi, lokasiAtur,
  financeMenu, inputIncome, inputExpense, laporanPengeluaran, laporanPemasukan, neracaLabaRugi, budget, akun, transfer, targetTabungan, kategori, tren, tagihan,
];

/** Tandai tab navigasi bawah yang aktif sesuai halaman. */
function highlightNav(path) {
  document.body.classList.toggle('auth-page', path === '/login');
  const section = ['inventory', 'finance', 'kegiatan', 'resep', 'settings'].find((s) => path.startsWith('/' + s)) || 'home';
  document.querySelectorAll('.tabbar a').forEach((a) => {
    a.classList.toggle('on', a.dataset.tab === section);
    // sembunyikan tab menu yang tidak boleh diakses akun ini
    const menu = MENUS.find((m) => m.key === a.dataset.tab);
    a.classList.toggle('hidden', Boolean(menu) && !can(menu.key));
  });
}

const router = createRouter({
  outlet: document.getElementById('app'),
  onNavigate: highlightNav,
  guard: (path) => {
    if (needsLogin()) return path === '/login' ? null : '/login';
    if (path === '/login') return '/';
    return canPath(path) ? null : '/'; // menu tanpa akses → kembali ke Home
  },
});
MODULES.forEach((m) => router.register(m));

// Siapkan database (Supabase) lalu tampilkan halaman pertama
await initData({ onRemoteChange: () => router.refreshInBackground(isUserBusy) });
router.start();

// Mode offline + update otomatis ke versi terbaru
enableAutoUpdate();

// Pengingat (tagihan, kegiatan, kedaluwarsa, stok) — bila diaktifkan di Settings
startNotifications();
