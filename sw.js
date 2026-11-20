/**
 * Service Worker — supaya aplikasi bisa dibuka tanpa internet.
 * Naikkan VERSION setiap kali ada perubahan file agar cache diperbarui.
 */
const VERSION = 'rumahku-v12';
const CORE = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './style/theme.css',
  './style/base.css',
  './style/layout.css',
  './style/components.css',
  './style/pages.css',
  './style/assets/icon.svg',
  './style/assets/icon-192.png',
  './service/storage.service.js',
  './service/format.service.js',
  './service/inventory.service.js',
  './service/finance.service.js',
  './service/barcode.service.js',
  './service/ocr.service.js',
  './service/ui.service.js',
  './service/router.service.js',
  './service/script-loader.service.js',
  './service/demo.service.js',
  './service/database.service.js',
  './service/sync.service.js',
  './service/supabase.config.js',
  './service/version.service.js',
  './service/update.service.js',
  './program/login.js',
  './program/home.js',
  './program/settings.js',
  './program/shared/item-card.js',
  './program/shared/transaction-form.js',
  './program/shared/transaction-report.js',
  './program/inventory/inventory-menu.js',
  './program/inventory/input-barang.js',
  './program/inventory/stock-keluar.js',
  './program/inventory/stock-opname.js',
  './program/inventory/daftar-belanja.js',
  './program/inventory/barang-lokasi.js',
  './program/finance/finance-menu.js',
  './program/finance/input-income.js',
  './program/finance/input-expense.js',
  './program/finance/laporan-pengeluaran.js',
  './program/finance/laporan-pemasukan.js',
  './program/finance/neraca-labarugi.js',
  './program/finance/budget.js',
  './program/finance/akun.js',
  './program/finance/transfer.js',
  './program/finance/target-tabungan.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// File aplikasi: network-first (selalu versi terbaru bila online), fallback cache.
// Library CDN & font: cache-first.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;

  if (sameOrigin) {
    // cache: 'no-cache' → selalu cek ke server dulu (tidak memakai cache HTTP browser yang bisa basi)
    const fresh = req.mode === 'navigate' ? req : new Request(req, { cache: 'no-cache' });
    e.respondWith(
      fetch(fresh)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
  } else if (/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
