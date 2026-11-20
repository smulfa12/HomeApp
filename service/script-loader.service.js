/**
 * Script Loader Service
 * Memuat library eksternal (CDN) hanya ketika dibutuhkan, supaya aplikasi
 * tetap ringan saat dibuka.
 */
const cache = {};

export function loadScript(src, globalName) {
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  if (!cache[src]) {
    cache[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(globalName ? window[globalName] : true);
      s.onerror = () => {
        delete cache[src];
        reject(new Error('Gagal memuat library. Periksa koneksi internet.'));
      };
      document.head.appendChild(s);
    });
  }
  return cache[src];
}
