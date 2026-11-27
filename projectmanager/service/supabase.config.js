/**
 * Konfigurasi Supabase
 * Isi dari Supabase: Project Settings → API (atau Data API).
 *  - SUPABASE_URL      : "Project URL", cth. https://abcdefgh.supabase.co
 *  - SUPABASE_ANON_KEY : kunci "anon public" / "publishable"
 *
 * Default memakai project Supabase yang sama dengan aplikasi Rumahku
 * (tabel aplikasi ini berawalan pm_ sehingga tidak bentrok).
 * JANGAN menaruh kunci "service_role" / "secret" di sini.
 *
 * Kalau dikosongkan, aplikasi berjalan dalam "mode lokal" (data di browser + data contoh).
 */
export const SUPABASE_URL = 'https://zdttzggjrdukursldxhd.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Fsyd3m2h5PINacGjKrWcKw_g6Ms9QOl';
