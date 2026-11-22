/**
 * Activity Service — Kegiatan / to-do harian
 *
 * Satu kegiatan bisa sekali saja (tanggal tertentu) atau rutin:
 *   repeat = 'none' | 'daily' | 'weekdays' | 'weekly' (days = [0..6], 0 = Minggu)
 * Status selesai disimpan per tanggal di doneDates, sehingga kegiatan rutin
 * bisa dicentang setiap hari. skipDates = tanggal yang dihapus "hari ini saja".
 */
import { collection } from './storage.service.js';
import { today, toISODate } from './format.service.js';

const todos = collection('act.todos');

export const TODO_ICONS = [
  '✅', '🧹', '🍳', '🍽️', '🛒', '🧺', '🚿', '🏃', '🕌', '📚', '💼', '💻',
  '🚗', '🎒', '👶', '🐱', '🌱', '💊', '📞', '😴', '💸', '🧽', '🎉', '📝',
];
export const REPEAT_LABEL = { none: 'Sekali', daily: 'Setiap hari', weekdays: 'Senin–Jumat', weekly: 'Hari tertentu' };
export const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const dayOfWeek = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

/** Apakah kegiatan muncul di tanggal ini? */
export function occursOn(t, date) {
  if ((t.skipDates || []).includes(date)) return false;
  if (!t.repeat || t.repeat === 'none') return t.date === date;
  if (date < t.date) return false; // rutin dimulai dari tanggal dibuat
  const dow = dayOfWeek(date);
  if (t.repeat === 'daily') return true;
  if (t.repeat === 'weekdays') return dow >= 1 && dow <= 5;
  if (t.repeat === 'weekly') return (t.days || []).map(Number).includes(dow);
  return false;
}

/** Kegiatan pada satu tanggal: yang tanpa jam dulu, lalu urut jam. */
export function tasksForDate(date) {
  return todos
    .filter((t) => occursOn(t, date))
    .map((t) => ({ ...t, done: (t.doneDates || []).includes(date) }))
    .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.title.localeCompare(b.title));
}

export function dayProgress(date) {
  const list = tasksForDate(date);
  return { total: list.length, done: list.filter((t) => t.done).length };
}

export const getTodo = (id) => todos.get(id);

export function saveTodo(data) {
  const title = (data.title || '').trim();
  if (!title) throw new Error('Nama kegiatan wajib diisi');
  const repeat = REPEAT_LABEL[data.repeat] ? data.repeat : 'none';
  const days = repeat === 'weekly' ? [...new Set((data.days || []).map(Number))].sort() : [];
  if (repeat === 'weekly' && !days.length) throw new Error('Pilih minimal 1 hari');
  if (data.time && data.endTime && data.endTime <= data.time) throw new Error('Jam selesai harus setelah jam mulai');
  const clean = {
    title,
    icon: data.icon || '✅',
    time: data.time || '',
    endTime: data.time ? data.endTime || '' : '',
    date: data.date || today(),
    repeat,
    days,
    who: (data.who || '').trim(),
    note: (data.note || '').trim(),
  };
  return data.id ? todos.update(data.id, clean) : todos.add({ ...clean, doneDates: [], skipDates: [] });
}

/** Centang / batal centang kegiatan pada tanggal tertentu. */
export function toggleDone(id, date) {
  const t = todos.get(id);
  if (!t) return null;
  const cutoff = toISODate(new Date(Date.now() - 120 * 86400000)); // simpan 4 bulan terakhir saja
  const set = new Set((t.doneDates || []).filter((d) => d >= cutoff));
  const done = !set.has(date);
  done ? set.add(date) : set.delete(date);
  todos.update(id, { doneDates: [...set].sort() });
  return done;
}

/** Hapus kegiatan (seluruhnya, termasuk semua jadwal rutinnya). */
export const deleteTodo = (id) => todos.remove(id);

/** Kegiatan rutin: lewati satu tanggal saja. */
export function skipOn(id, date) {
  const t = todos.get(id);
  if (!t) return;
  todos.update(id, { skipDates: [...new Set([...(t.skipDates || []), date])].sort() });
}

/** Nama anggota keluarga yang pernah dipakai di kolom "untuk siapa". */
export function whoList() {
  return [...new Set(todos.all().map((t) => t.who).filter(Boolean))].sort();
}

/**
 * Status waktu sebuah kegiatan hari ini relatif ke jam sekarang:
 * 'now' (sedang berlangsung), 'late' (terlewat & belum selesai), atau ''.
 */
export function timeStatus(t, date, now = new Date()) {
  if (t.done || !t.time || date !== today()) return '';
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const end = t.endTime || addMinutes(t.time, 30); // tanpa jam selesai → dianggap 30 menit
  if (t.time <= hhmm && hhmm < end) return 'now';
  if (end <= hhmm) return 'late';
  return '';
}

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Kegiatan berikutnya hari ini (belum selesai, jamnya belum lewat). */
export function nextTask(now = new Date()) {
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return tasksForDate(today()).find((t) => !t.done && t.time && t.time >= hhmm) || null;
}
