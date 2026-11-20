/**
 * Barcode Service
 * Membuka kamera dan membaca barcode / QR.
 *  - Pakai BarcodeDetector bawaan browser bila tersedia (Chrome Android).
 *  - Fallback ke library html5-qrcode (iPhone / browser lain).
 *  - Selalu ada input manual kalau kamera tidak bisa dipakai.
 */
import { loadScript } from './script-loader.service.js';
import { openSheet } from './ui.service.js';

const HTML5_QRCODE_URL = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

async function nativeSupported() {
  if (!('BarcodeDetector' in window)) return false;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    return supported.includes('ean_13');
  } catch {
    return false;
  }
}

async function startNative(box, onCode) {
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.muted = true;
  box.appendChild(video);
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  video.srcObject = stream;
  await video.play();
  const supported = await window.BarcodeDetector.getSupportedFormats();
  const detector = new window.BarcodeDetector({ formats: FORMATS.filter((f) => supported.includes(f)) });
  let active = true;
  const tick = async () => {
    if (!active) return;
    try {
      const codes = await detector.detect(video);
      if (codes.length && active) return onCode(codes[0].rawValue);
    } catch { /* frame belum siap */ }
    setTimeout(tick, 200);
  };
  tick();
  return () => {
    active = false;
    stream.getTracks().forEach((t) => t.stop());
  };
}

async function startFallback(box, onCode) {
  const Lib = await loadScript(HTML5_QRCODE_URL, 'Html5Qrcode');
  const id = 'qr-' + Date.now();
  const area = document.createElement('div');
  area.id = id;
  box.appendChild(area);
  const scanner = new Lib(id, { verbose: false });
  let stopped = false;
  await scanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: (w, h) => ({ width: Math.min(w * 0.85, 320), height: Math.min(h * 0.5, 160) }) },
    (text) => !stopped && onCode(text),
    () => {}
  );
  return async () => {
    if (stopped) return;
    stopped = true;
    try { await scanner.stop(); scanner.clear(); } catch { /* sudah berhenti */ }
  };
}

/**
 * Membuka bottom-sheet scanner. Resolve dengan kode barcode (string)
 * atau null bila dibatalkan.
 */
export function scanBarcode({ title = 'Scan Barcode' } = {}) {
  return new Promise((resolve) => {
    let stop = null;
    let done = false;

    const sheet = openSheet({
      title,
      body: `
        <div class="scanner">
          <div class="scanner__view" data-view>
            <div class="scanner__hint" data-hint>Menyalakan kamera…</div>
            <div class="scanner__frame"></div>
          </div>
          <p class="muted small center">Arahkan kamera ke barcode barang</p>
          <form class="row gap-sm" data-manual>
            <input class="input" name="code" inputmode="numeric" placeholder="atau ketik kode barcode" autocomplete="off" />
            <button class="btn btn--soft" type="submit">OK</button>
          </form>
        </div>`,
      onClose: () => finish(null),
    });

    const finish = async (code) => {
      if (done) return;
      done = true;
      if (stop) await stop();
      if (navigator.vibrate && code) navigator.vibrate(60);
      sheet.close();
      resolve(code ? String(code).trim() : null);
    };

    sheet.el.querySelector('[data-manual]').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = e.target.code.value.trim();
      if (v) finish(v);
    });

    const box = sheet.el.querySelector('[data-view]');
    const hint = sheet.el.querySelector('[data-hint]');

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak didukung di browser ini');
        stop = (await nativeSupported()) ? await startNative(box, finish) : await startFallback(box, finish);
        hint.remove();
        if (done) stop();
      } catch (err) {
        hint.textContent = (err && err.message) || 'Kamera tidak dapat dibuka';
        hint.classList.add('scanner__hint--error');
      }
    })();
  });
}
