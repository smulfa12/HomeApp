/**
 * Update Service
 * Memasang service worker (offline) dan memastikan HP selalu memakai
 * versi aplikasi terbaru:
 *  - sw.js selalu dicek ke server (updateViaCache: 'none')
 *  - dicek ulang setiap aplikasi dibuka kembali & tiap 30 menit
 *  - begitu versi baru aktif, aplikasi memuat ulang dirinya sendiri
 *    (ditunda bila user sedang mengisi form, supaya isian tidak hilang)
 */
import { isUserBusy, toast } from './ui.service.js';

export function enableAutoUpdate() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  let controller = navigator.serviceWorker.controller;
  let pending = false;

  const reloadWhenIdle = () => {
    if (!isUserBusy()) return location.reload();
    if (pending) return;
    pending = true;
    toast('✨ Versi baru siap — dipakai otomatis saat aplikasi dibuka lagi');
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && location.reload());
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const wasControlled = Boolean(controller);
    controller = navigator.serviceWorker.controller;
    if (wasControlled) reloadWhenIdle(); // pemasangan pertama tidak perlu reload
  });

  navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
      setInterval(check, 30 * 60 * 1000);
    })
    .catch(() => {});
}
