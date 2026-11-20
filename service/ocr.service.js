/**
 * OCR Service
 * Membaca foto nota / struk belanja dengan Tesseract.js lalu menebak
 * total belanja, tanggal, dan nama toko.
 */
import { loadScript } from './script-loader.service.js';
import { parseNumber, toISODate } from './format.service.js';

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

/** Perkecil foto supaya OCR lebih cepat di HP. */
export function resizeImage(file, maxSize = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.filter = 'grayscale(1) contrast(1.4)';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Gambar tidak dapat dibaca'));
    img.src = URL.createObjectURL(file);
  });
}

export async function recognize(imageDataUrl, onProgress = () => {}) {
  const Tesseract = await loadScript(TESSERACT_URL, 'Tesseract');
  const result = await Tesseract.recognize(imageDataUrl, 'ind+eng', {
    logger: (m) => m.status === 'recognizing text' && onProgress(Math.round(m.progress * 100)),
  });
  return result.data.text || '';
}

const TOTAL_KEYWORDS = /(grand\s*total|total\s*bayar|total\s*belanja|jumlah\s*bayar|total\s*harga|net\s*total|tagihan|total|jumlah)/i;
const SKIP_KEYWORDS = /(sub\s*total|kembali|kembalian|change|tunai|cash|diskon|disc|ppn|pajak|tax|hemat|item|qty)/i;
const AMOUNT = /(\d{1,3}(?:[.,]\d{3})+|\d{4,})(?:[.,]\d{2}(?!\d))?/g;

function amountsIn(line) {
  return [...line.matchAll(AMOUNT)].map((m) => parseNumber(m[1])).filter((n) => n >= 100 && n < 1e9);
}

function guessTotal(lines) {
  // 1) Baris yang mengandung kata "total" (bukan subtotal / kembalian)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (TOTAL_KEYWORDS.test(line) && !SKIP_KEYWORDS.test(line)) {
      const nums = amountsIn(line).length ? amountsIn(line) : amountsIn(lines[i + 1] || '');
      if (nums.length) return Math.max(...nums);
    }
  }
  // 2) Fallback: angka terbesar yang bukan baris tunai / kembalian
  const all = lines.filter((l) => !/(tunai|cash|kembali|change)/i.test(l)).flatMap(amountsIn);
  return all.length ? Math.max(...all) : 0;
}

function guessDate(text) {
  const m = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m.map(Number);
  if (y < 100) y += 2000;
  if (mo > 12 || d > 31 || y < 2000 || y > 2100) return null;
  return toISODate(new Date(y, mo - 1, d));
}

function guessStore(lines) {
  const first = lines.find((l) => /[a-z]{3,}/i.test(l) && !/\d{4,}/.test(l));
  return first ? first.replace(/[^\w\s&.-]/g, '').trim().slice(0, 40) : '';
}

/** Ubah teks OCR menjadi {total, date, store, text}. */
export function parseReceipt(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return { total: guessTotal(lines), date: guessDate(text), store: guessStore(lines), text };
}

export async function scanReceipt(file, onProgress) {
  const image = await resizeImage(file);
  const text = await recognize(image, onProgress);
  return { image, ...parseReceipt(text) };
}
