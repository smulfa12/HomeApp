/**
 * Konfigurasi Supabase
 * Isi dengan data dari Supabase: Project Settings → API (atau Data API).
 *  - SUPABASE_URL      : "Project URL", cth. https://abcdefgh.supabase.co
 *  - SUPABASE_ANON_KEY : kunci "anon public" / "publishable"
 *
 * Kunci anon memang dirancang untuk dipakai di aplikasi (aman dipublikasikan)
 * karena data dilindungi login + Row Level Security (lihat service/database/schema.sql).
 * JANGAN pernah menaruh kunci "service_role" / "secret" di sini.
 *
 * Kalau dibiarkan kosong, aplikasi berjalan dalam "mode lokal" (data hanya di HP).
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
