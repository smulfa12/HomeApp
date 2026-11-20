/**
 * Format Service
 * Helper format angka, rupiah, tanggal, dan periode.
 */
const rupiahFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('id-ID');

export const rupiah = (n) => rupiahFmt.format(Math.round(Number(n) || 0));
export const number = (n) => numFmt.format(Number(n) || 0);

/** "Rp 1,2 jt" — ringkas untuk kartu statistik. */
export function rupiahShort(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}Rp ${(abs / 1e9).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1e6) return `${sign}Rp ${(abs / 1e6).toFixed(1).replace('.', ',')} jt`;
  if (abs >= 1e3) return `${sign}Rp ${Math.round(abs / 1e3)} rb`;
  return rupiah(v);
}

/** Ubah teks "Rp 125.000" / "125,000" / "125000" menjadi angka. */
export function parseNumber(text) {
  if (typeof text === 'number') return text;
  const digits = String(text || '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const today = () => toISODate(new Date());
export const thisMonth = () => today().slice(0, 7);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function dateLabel(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Selisih hari dari hari ini ke tanggal ISO (negatif = sudah lewat). */
export function daysUntil(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - base) / 86400000);
}

/** Preset periode untuk filter laporan. Mengembalikan {from, to} ISO date. */
export function periodRange(preset, custom = {}) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'this-month':
      return { from: toISODate(new Date(y, m, 1)), to: toISODate(new Date(y, m + 1, 0)) };
    case 'last-month':
      return { from: toISODate(new Date(y, m - 1, 1)), to: toISODate(new Date(y, m, 0)) };
    case '3-months':
      return { from: toISODate(new Date(y, m - 2, 1)), to: toISODate(new Date(y, m + 1, 0)) };
    case 'this-year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'custom':
      return { from: custom.from || today(), to: custom.to || today() };
    default:
      return periodRange('this-month');
  }
}
