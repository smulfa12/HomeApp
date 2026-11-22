/**
 * Recipe Service — daftar menu masak, resep, gizi, & keterkaitan dengan
 * Inventory (stok bahan) dan Kegiatan (jadwal masak).
 */
import { collection } from './storage.service.js';
import { today, toISODate } from './format.service.js';
import * as db from './database.service.js';
import * as inv from './inventory.service.js';
import * as act from './activity.service.js';

const recipes = collection('rcp.recipes');

export const CATEGORIES = ['Sarapan', 'Makan Siang', 'Makan Malam', 'Lauk', 'Sayur', 'Camilan', 'Kue', 'Minuman', 'Lainnya'];
export const RECIPE_EMOJIS = ['🍳', '🍛', '🍚', '🍜', '🍲', '🥘', '🍗', '🐟', '🥩', '🥚', '🥗', '🥦', '🍤', '🍝', '🥟', '🍰', '🍪', '🥤', '☕', '🍌'];

/** Nama & satuan gizi (per porsi). */
export const NUTRIENTS = [
  { key: 'calories', label: 'Energi', unit: 'kkal' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbs_g', label: 'Karbohidrat', unit: 'g' },
  { key: 'fat_g', label: 'Lemak', unit: 'g' },
  { key: 'fiber_g', label: 'Serat', unit: 'g' },
  { key: 'sugar_g', label: 'Gula', unit: 'g' },
  { key: 'sodium_mg', label: 'Natrium (garam)', unit: 'mg' },
];

const UNITS = ['gram', 'gr', 'g', 'kg', 'ml', 'liter', 'l', 'sdm', 'sdt', 'butir', 'siung', 'buah', 'lembar', 'batang', 'ruas', 'gelas', 'cup', 'ekor', 'potong', 'bungkus', 'sachet', 'ikat', 'genggam', 'secukupnya', 'sejumput'];

/* ---------- CRUD ---------- */

export function listRecipes({ q = '', category = '', favorite = false } = {}) {
  const term = q.trim().toLowerCase();
  return recipes
    .filter((r) => (!category || r.category === category) && (!favorite || r.favorite))
    .filter((r) => !term || r.name.toLowerCase().includes(term) || (r.tags || []).some((t) => t.toLowerCase().includes(term)) || (r.ingredients || []).some((i) => i.name.toLowerCase().includes(term)))
    .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.name.localeCompare(b.name));
}

export const getRecipe = (id) => recipes.get(id);

export function saveRecipe(data) {
  const name = (data.name || '').trim();
  if (!name) throw new Error('Nama masakan wajib diisi');
  const clean = {
    name,
    emoji: data.emoji || '🍳',
    category: CATEGORIES.includes(data.category) ? data.category : 'Lainnya',
    servings: Math.max(1, Math.round(Number(data.servings) || 1)),
    prepMinutes: Math.max(0, Math.round(Number(data.prepMinutes) || 0)),
    cookMinutes: Math.max(0, Math.round(Number(data.cookMinutes) || 0)),
    ingredients: (data.ingredients || []).filter((i) => i.name),
    steps: (data.steps || []).map((s) => s.trim()).filter(Boolean),
    nutrition: cleanNutrition(data.nutrition),
    tags: [...new Set((data.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8),
    note: (data.note || '').trim(),
    source: data.source || 'manual',
    favorite: Boolean(data.favorite),
  };
  return data.id ? recipes.update(data.id, clean) : recipes.add(clean);
}

function cleanNutrition(n = {}) {
  const out = {};
  NUTRIENTS.forEach(({ key }) => {
    const v = Number(n?.[key]);
    if (Number.isFinite(v) && v >= 0 && n?.[key] !== '' && n?.[key] != null) out[key] = Math.round(v * 10) / 10;
  });
  return out;
}

export const hasNutrition = (r) => Object.keys(r.nutrition || {}).length > 0;

/** Hapus resep; jadwal masak yang terkait tetap ada tapi tautannya dilepas. */
export function deleteRecipe(id) {
  act.unlinkRecipe(id);
  recipes.remove(id);
}

export const toggleFavorite = (id) => {
  const r = recipes.get(id);
  return r ? recipes.update(id, { favorite: !r.favorite }) : null;
};

/* ---------- Teks bahan ⇄ data ---------- */

const fraction = (s) => {
  const map = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
  if (map[s]) return map[s];
  if (/^\d+\/\d+$/.test(s)) {
    const [a, b] = s.split('/').map(Number);
    return b ? a / b : 0;
  }
  return Number(s.replace(',', '.')) || 0;
};

/** "2 siung bawang putih, cincang" → { qty: 2, unit: 'siung', name: 'bawang putih', note: 'cincang' } */
export function parseIngredientLine(line) {
  // buang penanda daftar: "- ", "• ", "1. ", "2) "
  let text = line.trim().replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s+/, '').trim();
  if (!text) return null;
  let note = '';
  const comma = text.search(/(?<!\d),|,(?!\d)/); // koma desimal "1,5" bukan pemisah catatan
  if (comma > 0) {
    note = text.slice(comma + 1).trim();
    text = text.slice(0, comma).trim();
  }
  const m = text.match(/^([\d.,/½¼¾⅓⅔]+)\s*(.*)$/);
  let qty = 0;
  let rest = text;
  if (m) {
    qty = fraction(m[1]);
    rest = m[2];
  }
  let unit = '';
  const words = rest.split(/\s+/);
  if (words.length > 1 && UNITS.includes(words[0].toLowerCase())) unit = words.shift().toLowerCase();
  if (/secukupnya/i.test(rest)) {
    unit = 'secukupnya';
    rest = rest.replace(/\s*secukupnya\s*/i, ' ');
  } else rest = words.join(' ');
  return { name: rest.trim().toLowerCase(), qty, unit, note };
}

export const parseIngredients = (text) => text.split('\n').map(parseIngredientLine).filter(Boolean);

const fmtQty = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ','));

export function ingredientText(i, scale = 1) {
  if (i.unit === 'secukupnya' || !i.qty) return `${i.name} ${i.unit === 'secukupnya' ? 'secukupnya' : ''}`.trim() + (i.note ? `, ${i.note}` : '');
  return `${fmtQty(i.qty * scale)}${i.unit ? ` ${i.unit}` : ''} ${i.name}${i.note ? `, ${i.note}` : ''}`;
}

/* ---------- Keterkaitan dengan Inventory ---------- */

const tokens = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);

/** Cari barang inventory yang cocok dengan nama bahan (mis. "telur" ↔ "Telur Ayam"). */
export function matchItem(ingredientName) {
  const want = tokens(ingredientName);
  if (!want.length) return null;
  const items = inv.listItems();
  return (
    items.find((it) => want.every((w) => it.name.toLowerCase().includes(w))) ||
    items.find((it) => tokens(it.name).length && tokens(it.name).every((w) => ingredientName.toLowerCase().includes(w))) ||
    null
  );
}

/** Status stok tiap bahan: ok (ada), low (di bawah minimum), out (habis), none (tidak dilacak). */
export function ingredientStock(recipe) {
  return (recipe.ingredients || []).map((ing) => {
    const item = matchItem(ing.name);
    let status = 'none';
    if (item) status = item.qty <= 0 ? 'out' : item.minStock > 0 && item.qty < item.minStock ? 'low' : 'ok';
    return { ...ing, item, status };
  });
}

/* ---------- Keterkaitan dengan Kegiatan (jadwal masak) ---------- */

/** Buat kegiatan "Masak …" yang tertaut ke resep. */
export function scheduleCooking(recipe, { date, time = '', who = '', repeat = 'none', days = [] }) {
  return act.saveTodo({
    title: `Masak ${recipe.name}`,
    icon: '🍳',
    date: date || today(),
    time,
    endTime: '',
    repeat,
    days,
    who,
    note: '',
    recipeId: recipe.id,
  });
}

/** Rencana menu: jadwal masak (kegiatan bertaut resep) untuk N hari ke depan. */
export function mealPlan(days = 7, from = today()) {
  const [y, m, d] = from.split('-').map(Number);
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = toISODate(new Date(y, m - 1, d + i));
    const meals = act.tasksForDate(date).filter((t) => t.recipeId && recipes.get(t.recipeId));
    out.push({ date, meals: meals.map((t) => ({ ...t, recipe: recipes.get(t.recipeId) })) });
  }
  return out;
}

export const schedulesFor = (recipeId, days = 30) =>
  mealPlan(days).flatMap((d) => d.meals.filter((m) => m.recipeId === recipeId).map((m) => ({ ...m, date: d.date })));

/* ---------- AI ---------- */

export const aiAvailable = () => db.isConfigured();

/**
 * Minta AI (Edge Function "recipe-ai") mengubah teks resep / nama masakan
 * menjadi resep terstruktur + perkiraan gizi. Mengembalikan draf (belum disimpan).
 */
export async function aiDraft(text) {
  if (!aiAvailable()) throw new Error('Fitur AI butuh database Supabase (lihat README)');
  const { recipe } = await db.invokeFunction('recipe-ai', { text });
  return {
    name: recipe.name,
    emoji: recipe.emoji,
    category: recipe.category,
    servings: recipe.servings,
    prepMinutes: recipe.prep_minutes,
    cookMinutes: recipe.cook_minutes,
    ingredients: recipe.ingredients.map((i) => ({ name: i.name, qty: Number(i.qty) || 0, unit: i.unit === 'secukupnya' ? 'secukupnya' : i.unit, note: i.note })),
    steps: recipe.steps,
    nutrition: recipe.nutrition,
    tags: recipe.tags,
    note: recipe.notes,
    source: 'ai',
  };
}
