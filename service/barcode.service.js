/**
 * Barcode Service
 * Membuka kamera belakang dan membaca barcode / QR dari setiap frame.
 *  - Pembaca: BarcodeDetector bawaan browser bila mendukung EAN-13
 *    (Chrome Android), selain itu ZXing (iPhone & browser lain).
 *  - Hanya area di dalam bingkai yang dibaca → lebih cepat & akurat.
 *  - Cadangan: foto barcode, atau ketik kode manual.
 */
import { loadScript } from './script-loader.service.js';
import { openSheet } from './ui.service.js';

const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];
const ZXING_FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'ITF', 'QR_CODE'];

/* ---------- Pembaca barcode ---------- */

let decoderPromise = null;

/** Mengembalikan fungsi async (canvas) → teks barcode | null. */
function getDecoder() {
  if (!decoderPromise) {
    decoderPromise = (async () => {
      if ('BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          if (supported.includes('ean_13')) {
            const detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS.filter((f) => supported.includes(f)) });
            return async (canvas) => (await detector.detect(canvas))[0]?.rawValue || null;
          }
        } catch { /* lanjut ke ZXing */ }
      }
      const ZX = await loadScript(ZXING_URL, 'ZXing');
      const hints = new Map();
      hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS.map((f) => ZX.BarcodeFormat[f]));
      hints.set(ZX.DecodeHintType.TRY_HARDER, true);
      const reader = new ZX.MultiFormatReader();
      reader.setHints(hints);
      return async (canvas) => {
        try {
          const bitmap = new ZX.BinaryBitmap(new ZX.HybridBinarizer(new ZX.HTMLCanvasElementLuminanceSource(canvas)));
          return reader.decodeWithState(bitmap).getText();
        } catch {
          return null; // tidak ada barcode di frame ini
        } finally {
          reader.reset();
        }
      };
    })().catch((err) => {
      decoderPromise = null;
      throw err;
    });
  }
  return decoderPromise;
}

/**
 * Salin sebagian gambar ke canvas.
 * crop = {x, y, w, h} dalam pecahan (0..1) dari ukuran sumber.
 */
function grab(source, srcW, srcH, canvas, { crop = { x: 0, y: 0, w: 1, h: 1 }, maxW = 1000, rotate = false } = {}) {
  const sx = srcW * crop.x;
  const sy = srcH * crop.y;
  const sw = srcW * crop.w;
  const sh = srcH * crop.h;
  const scale = Math.min(1, maxW / sw);
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  canvas.width = rotate ? h : w;
  canvas.height = rotate ? w : h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.save();
  if (rotate) {
    ctx.translate(h, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
  ctx.restore();
  return canvas;
}

// Area bingkai di layar (lihat .scanner__frame di CSS): 80% lebar, 44% tinggi di tengah.
const FRAME_CROP = { x: 0.1, y: 0.28, w: 0.8, h: 0.44 };
const ATTEMPTS = [
  { crop: FRAME_CROP },
  { crop: FRAME_CROP },
  { crop: { x: 0, y: 0, w: 1, h: 1 } },
  { crop: FRAME_CROP, rotate: true }, // barcode dipegang tegak
];

/** Baca barcode dari foto (File). */
export async function decodeImageFile(file) {
  const decode = await getDecoder();
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Foto tidak dapat dibuka'));
    i.src = URL.createObjectURL(file);
  });
  const canvas = document.createElement('canvas');
  const tries = [
    { maxW: 1400 },
    { maxW: 1400, rotate: true },
    { crop: { x: 0.15, y: 0.25, w: 0.7, h: 0.5 }, maxW: 1200 },
    { maxW: 800 },
  ];
  try {
    for (const t of tries) {
      const code = await decode(grab(img, img.naturalWidth, img.naturalHeight, canvas, t));
      if (code) return code;
    }
    return null;
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

/* ---------- Kamera ---------- */

function cameraErrorMessage(err) {
  if (!window.isSecureContext) return 'Kamera hanya bisa dipakai lewat alamat https://';
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Izin kamera ditolak. Buka pengaturan browser → izin situs → Kamera → Izinkan, lalu coba lagi.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Kamera tidak ditemukan di perangkat ini.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.';
    default:
      return err?.message || 'Kamera tidak dapat dibuka.';
  }
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser ini tidak mendukung kamera.');
  const tries = [
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
    { video: true, audio: false },
  ];
  let lastErr;
  for (const constraints of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') break;
    }
  }
  throw lastErr;
}

/**
 * Membuka bottom-sheet scanner. Resolve dengan kode barcode (string)
 * atau null bila dibatalkan.
 */
export function scanBarcode({ title = 'Scan Barcode' } = {}) {
  return new Promise((resolve) => {
    let stream = null;
    let done = false;

    const sheet = openSheet({
      title,
      body: `
        <div class="scanner">
          <div class="scanner__view" data-view>
            <video playsinline muted autoplay></video>
            <div class="scanner__frame"></div>
            <div class="scanner__hint" data-hint>Menyalakan kamera…</div>
            <button type="button" class="scanner__torch hidden" data-torch aria-label="Senter">🔦</button>
          </div>
          <p class="muted small center" data-tip>Posisikan barcode mendatar di dalam bingkai, jarak ±15 cm</p>
          <label class="btn btn--soft btn--block">
            <input type="file" accept="image/*" capture="environment" hidden data-photo />
            📸 Foto barcode
          </label>
          <form class="row gap-sm" data-manual>
            <input class="input" name="code" inputmode="numeric" placeholder="atau ketik kode barcode" autocomplete="off" />
            <button class="btn btn--soft" type="submit">OK</button>
          </form>
        </div>`,
      onClose: () => finish(null),
    });

    const view = sheet.el.querySelector('[data-view]');
    const video = view.querySelector('video');
    const hint = sheet.el.querySelector('[data-hint]');
    const torchBtn = sheet.el.querySelector('[data-torch]');

    const showError = (msg) => {
      hint.textContent = msg;
      hint.classList.remove('hidden');
      hint.classList.add('scanner__hint--error');
      view.classList.add('scanner__view--error');
    };

    const finish = (code) => {
      if (done) return;
      done = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (code && navigator.vibrate) navigator.vibrate(80);
      sheet.close();
      resolve(code ? String(code).trim() : null);
    };

    sheet.el.querySelector('[data-manual]').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = e.target.code.value.trim();
      if (v) finish(v);
    });

    sheet.el.querySelector('[data-photo]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const tip = sheet.el.querySelector('[data-tip]');
      tip.textContent = '🔎 Membaca foto…';
      try {
        const code = await decodeImageFile(file);
        if (code) return finish(code);
        tip.textContent = '😕 Barcode tidak terbaca. Foto lebih dekat, terang, dan tidak buram.';
      } catch (err) {
        tip.textContent = err.message;
      }
      e.target.value = '';
    });

    (async () => {
      let decode;
      try {
        stream = await openCamera();
      } catch (err) {
        return showError(cameraErrorMessage(err) + ' Kamu masih bisa pakai "Foto barcode" atau ketik kode.');
      }
      if (done) return stream.getTracks().forEach((t) => t.stop());

      video.srcObject = stream;
      try {
        await video.play();
      } catch { /* autoplay ditunda; frame tetap datang */ }

      // Fokus otomatis terus-menerus & tombol senter bila didukung
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      if (caps.focusMode?.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      if (caps.torch) {
        let on = false;
        torchBtn.classList.remove('hidden');
        torchBtn.addEventListener('click', () => {
          on = !on;
          track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});
          torchBtn.classList.toggle('on', on);
        });
      }

      try {
        decode = await getDecoder();
      } catch (err) {
        return showError(err.message + ' Kamu masih bisa ketik kode barcode.');
      }
      hint.classList.add('hidden');

      const canvas = document.createElement('canvas');
      let n = 0;
      const loop = async () => {
        if (done) return;
        if (video.readyState >= 2 && video.videoWidth) {
          const attempt = ATTEMPTS[n++ % ATTEMPTS.length];
          const code = await decode(grab(video, video.videoWidth, video.videoHeight, canvas, { ...attempt, maxW: 1000 }));
          if (code) return finish(code);
        }
        setTimeout(loop, 120);
      };
      loop();
    })();
  });
}
