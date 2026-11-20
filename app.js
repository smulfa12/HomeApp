/**
 * ============================================================
 *  Rumahku — Main App
 *  File ini HANYA mendaftarkan & memanggil modul menu.
 *  Logika data ada di /service, tampilan menu ada di /program,
 *  dan desain ada di /style.
 * ============================================================
 */
import { createRouter } from './service/router.service.js';

// Beranda & pengaturan
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

const MODULES = [
  home, settings,
  inventoryMenu, inputBarang, stockKeluar, stockOpname, daftarBelanja, barangLokasi,
  financeMenu, inputIncome, inputExpense, laporanPengeluaran, laporanPemasukan, neracaLabaRugi, budget, akun,
];

/** Tandai tab navigasi bawah yang aktif sesuai halaman. */
function highlightNav(path) {
  const section = path.startsWith('/inventory') ? 'inventory' : path.startsWith('/finance') ? 'finance' : path.startsWith('/settings') ? 'settings' : 'home';
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === section));
}

const router = createRouter({ outlet: document.getElementById('app'), onNavigate: highlightNav });
MODULES.forEach((m) => router.register(m));
router.start();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
