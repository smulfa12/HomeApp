# 🏡 Rumahku — Inventory & Keuangan Rumah

Aplikasi web (PWA) untuk HP: kelola **stok barang rumah** dan **keuangan keluarga**.
Desain pastel kalem dan lucu, tiap menu punya warna sendiri supaya mudah dibedakan.
Bisa dipasang ke layar utama HP dan tetap jalan tanpa internet (kecuali scan nota pertama kali).

> 📊 **Aplikasi kedua di repo ini: [Project Manager](projectmanager/README.md)** — dashboard workload, inquiry & list
> project, activity member (Gantt & Kanban), monitoring client, reminder email. Folder `projectmanager/`.

## ✨ Fitur

> Nama menu di aplikasi memakai bahasa Inggris (Home, Inventory, Finance, Activities, Recipes, Settings); isi & keterangan tetap bahasa Indonesia.

### 📦 Menu Utama Inventory Rumah
| # | Menu | Isi |
|---|------|-----|
| 1 | **Input Barang** | Scan barcode → jumlah stok, satuan, kategori, tanggal kadaluarsa (khusus kategori makanan/minuman/bumbu/susu/obat), minimum stok, harga, penempatan. Barcode yang sudah terdaftar otomatis menambah stok. |
| 2 | **Stock Keluar** | Scan barcode (atau cari nama) saat barang dipakai → stok berkurang + riwayat pemakaian. |
| 3 | **Stock Opname** | Hitung stok fisik per lokasi sebelum belanja, selisih disesuaikan otomatis, lalu lanjut ke daftar belanja. |
| 4 | **Daftar Belanja** | Barang dengan stok < minimum stok, jumlah yang perlu dibeli, estimasi biaya, kirim ke WhatsApp / salin, centang = stok bertambah. |
| 5 | **Barang per Lokasi** | Barang dikelompokkan per tempat (Dapur, Kulkas, Gudang, …) + peringatan kadaluarsa. |
| 6 | **Atur Lokasi** | Kelola sendiri tempat penyimpanan: tambah, ganti nama & ikon (barang ikut pindah), urutkan, hapus (barang dipindahkan ke lokasi lain). Disimpan di `app_settings` (tidak perlu SQL). |
| 7 | **Mode Belanja** | Dipakai di supermarket: scan barcode terus-menerus / input manual / ambil dari Daftar Belanja → keranjang (jumlah, harga, total berjalan) → Selesai & Bayar: stok bertambah, pengeluaran tercatat, tersimpan di Riwayat Belanja. |
| 8 | **Riwayat Belanja** | Log setiap belanja per periode: toko, isi barang × harga, total, dibayar dari; belanja ulang barang yang sama. |

### ✅ Menu Utama Kegiatan
| Fitur | Isi |
|------|-----|
| **To-do harian** | Kegiatan per hari urut jam (mulai–selesai), checklist selesai, progres harian, strip mingguan. |
| **Rutin** | Sekali / setiap hari / Senin–Jumat / hari tertentu; hapus untuk satu tanggal saja. |
| **Untuk siapa** | Tandai kegiatan per anggota keluarga & filter. |
| **Penanda waktu** | Sedang berlangsung & terlewat disorot; widget di Beranda. |

### 🍳 Menu Utama Resep
| Fitur | Isi |
|------|-----|
| **Daftar menu masak** | Cari (nama / bahan / label), kategori, favorit. |
| **Resep** | Bahan (bisa dihitung ulang per porsi), langkah (ketuk bila selesai), tips, label. |
| **Gizi per porsi** | Energi, protein, karbohidrat, lemak, serat, gula, natrium — per porsi & total. |
| **Stok bahan** | Bahan dicocokkan dengan Inventory (ada / menipis / habis); bahan kurang → keranjang Mode Belanja. |
| **Jadwal masak** | "Jadwalkan masak" membuat kegiatan tertaut resep di Kegiatan; Rencana menu 7 hari. |

### 💰 Menu Utama Financial Rumah
| # | Menu | Isi |
|---|------|-----|
| 1 | **Input Income** | Nominal, kategori, tanggal, akun tujuan, catatan. |
| 2 | **Input Expense** | **Scan nota** (OCR membaca total, tanggal & nama toko) atau input manual. |
| 3 | **Data Pengeluaran** | Filter periode (bulan ini, bulan lalu, 3 bulan, tahun ini, custom), total, rata-rata/hari, per kategori, rincian. |
| 4 | **Data Pemasukan** | Sama seperti di atas untuk pemasukan. |
| 5 | **Neraca & Laba Rugi** | Laba rugi per periode (surplus/defisit, rasio tabungan) dan neraca (aset − hutang = kekayaan bersih, rasio hutang). |
| 6 | **Budget & Realisasi** | Budget per kategori per bulan, progres realisasi, status over budget, salin budget bulan lalu. |
| 7 | **Transfer** | Pindah saldo antar dompet/rekening, bayar hutang/kartu kredit, pakai paylater; biaya admin dicatat sebagai pengeluaran. Tidak dihitung sebagai pemasukan/pengeluaran. |
| 8 | **Target Tabungan** | Target nabung (dana darurat, DP rumah, dll) dikaitkan ke satu atau beberapa rekening; progres % otomatis dari saldo, kebutuhan nabung per bulan, perkiraan tercapai, saran dana darurat (6× pengeluaran bulanan), perayaan 25/50/75/100%. |
| 9 | **Kategori Budget** | Atur sendiri kategori pengeluaran (budget) & pemasukan: tambah, ganti nama/ikon (transaksi & budget lama ikut pindah), urutkan, sembunyikan, hapus. Disimpan di `app_settings` (tidak perlu SQL). |

Tambahan: **Login**, **Dompet & Rekening** (menu Atur: tambah dompet, bank, e-wallet, tabungan, emas, piutang, hutang, paylater; ikon, nomor rekening, arsip) (dompet, bank, e-wallet, tabungan, aset tetap, hutang) sebagai sumber neraca, dan **Pengaturan** (backup/restore JSON, isi data contoh, hapus data).

## 🗂️ Struktur Folder (modular)

```
HomeApp/
├── index.html            # kerangka halaman + tab bar
├── app.js                # MAIN APP — hanya import & daftarkan modul menu
├── manifest.webmanifest  # konfigurasi PWA
├── sw.js                 # service worker (offline)
│
├── program/              # 📱 SEMUA PROGRAM (tampilan tiap menu)
│   ├── home.js
│   ├── settings.js
│   ├── activity/         # menu Kegiatan (to-do harian)
│   ├── recipe/           # menu Resep (resep, gizi, rencana menu)
│   ├── inventory/
│   │   ├── inventory-menu.js
│   │   ├── input-barang.js
│   │   ├── stock-keluar.js
│   │   ├── stock-opname.js
│   │   ├── daftar-belanja.js
│   │   └── barang-lokasi.js
│   ├── finance/
│   │   ├── finance-menu.js
│   │   ├── input-income.js
│   │   ├── input-expense.js
│   │   ├── laporan-pengeluaran.js
│   │   ├── laporan-pemasukan.js
│   │   ├── neraca-labarugi.js
│   │   ├── budget.js
│   │   └── akun.js
│   └── shared/           # komponen yang dipakai beberapa menu
│
├── service/              # ⚙️ SEMUA SERVICE (logika & data)
│   ├── recipe.service.js      # resep, gizi, stok bahan, jadwal masak
│   ├── supabase.config.js     # 🔑 URL & anon key Supabase (isi di sini)
│   ├── database.service.js    # akses database Supabase (login, baca, tulis, realtime)
│   ├── sync.service.js        # sinkron HP ⇄ database, antrian offline
│   ├── database/schema.sql    # skema tabel database (jalankan di Supabase)
│   ├── storage.service.js     # cache lokal di HP + backup
│   ├── inventory.service.js   # logika stok, opname, belanja, lokasi
│   ├── finance.service.js     # transaksi, neraca, laba rugi, budget
│   ├── barcode.service.js     # kamera + baca barcode
│   ├── ocr.service.js         # baca foto nota (Tesseract.js)
│   ├── ui.service.js          # toast, bottom sheet, filter periode, dll
│   ├── router.service.js      # navigasi antar menu
│   ├── format.service.js      # format rupiah & tanggal
│   ├── script-loader.service.js
│   └── demo.service.js        # data contoh
│
└── style/                # 🎨 SEMUA DESAIN
    ├── theme.css         # warna, font, radius (ubah tema di sini)
    ├── base.css          # reset & utilitas
    ├── layout.css        # kerangka & tab bar
    ├── components.css    # tombol, kartu, form, badge, sheet, scanner
    ├── pages.css         # gaya khusus per halaman
    └── assets/           # ikon aplikasi
```

### Cara menambah menu baru
1. Buat file di `program/...` yang meng-export `{ path, title, render(el, params) }`.
2. Logika data taruh di `service/...`.
3. Daftarkan di `app.js` (import + tambahkan ke `MODULES`).
4. Tambahkan file baru ke daftar `CORE` di `sw.js` supaya ikut tersedia offline.

## 🗄️ Database Supabase

Data disimpan di **Supabase** (PostgreSQL online). Di HP tetap ada salinan (cache) supaya aplikasi
cepat dan bisa dipakai offline. Perubahan saat offline masuk antrian dan dikirim otomatis begitu online.
Perubahan dari HP anggota keluarga lain masuk otomatis (realtime).

### Setup (sekali saja, ±10 menit)
1. Daftar gratis di <https://supabase.com> → **New project** (region: Singapore).
2. **SQL Editor → New query** → paste isi `service/database/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers**: matikan **Allow new users to sign up**
   (supaya orang lain tidak bisa mendaftar).
4. **Authentication → Users → Add user → Create new user**: buat akun untuk tiap anggota keluarga
   (centang **Auto Confirm User**).
5. **Project Settings → API**: salin **Project URL** dan kunci **anon / publishable**, isi ke
   `service/supabase.config.js`. Jangan pakai kunci `service_role` / `secret`.
6. Commit & push. Buka aplikasi → login → selesai. Data lama yang ada di HP otomatis dipindahkan
   ke database saat login pertama (kalau database masih kosong).

### Migrasi database
Setiap ada perubahan struktur database, file SQL baru ditambahkan di `service/database/`.
Jalankan file yang belum pernah dijalankan, berurutan, di **SQL Editor** Supabase:

| File | Isi |
|---|---|
| `schema.sql` | skema awal (sudah termasuk migrasi 002–007; project baru: jalankan ini lalu `008` & `009`) |
| `002_akun_uang.sql` | ikon, nomor rekening, catatan & arsip untuk dompet/rekening |
| `003_transfer.sql` | transfer antar dompet / rekening (+ biaya admin) |
| `004_target_tabungan.sql` | target tabungan (dikaitkan ke satu / beberapa rekening) |
| `005_riwayat_belanja.sql` | riwayat belanja dari Mode Belanja |
| `006_kegiatan.sql` | to-do list kegiatan harian |
| `007_resep.sql` | resep, gizi, & tautan jadwal masak di Kegiatan |
| `008_role_akses.sql` | role Admin / User & akses menu per akun (menu **Configure**) |
| `009_relasi.sql` | relasi antar tabel (foreign key) |

Kalau aplikasi versi baru dipakai sebelum SQL-nya dijalankan, perubahan tetap aman tersimpan di HP
(menu Atur menampilkan pesan "Database perlu diperbarui") dan otomatis terkirim setelah SQL dijalankan.

Kalau `supabase.config.js` dibiarkan kosong, aplikasi jalan dalam **mode lokal** (data hanya di HP).

### Tabel
| Tabel | Isi |
|---|---|
| `inv_items` | master barang |
| `inv_movements` | riwayat stok masuk / keluar / opname |
| `fin_accounts` | dompet, bank, e-wallet, aset, hutang |
| `fin_transactions` | pemasukan & pengeluaran |
| `app_settings` | lokasi, budget, tanggal opname terakhir |

| `app_users` | role (admin / user) & menu yang boleh dibuka tiap akun |

### 🔗 Relasi antar tabel (`009_relasi.sql`)
```
inv_items ──< inv_movements            (item_id)
fin_accounts ──< fin_transactions      (account_id, to_account_id)
fin_transactions ──< fin_transactions  (ref_id: biaya admin → transfernya)
fin_accounts ──< inv_shopping >── fin_transactions   (account_id, transaction_id)
rcp_recipes ──< act_todos              (recipe_id: jadwal masak)
fin_accounts ──< fin_goals             (account_ids[], dijaga trigger)
auth.users ──< semua tabel (created_by) · auth.users ──1 app_users
```
Data induk yang dihapus **tidak** ikut menghapus riwayatnya: tautannya dikosongkan
(kecuali biaya admin transfer, yang ikut terhapus bersama transfernya).
Kategori & lokasi disimpan di `app_settings` (bukan tabel), jadi tidak punya relasi.

Semua tabel dilindungi Row Level Security: hanya user yang login yang bisa membaca & menulis,
dan (setelah `008`) hanya untuk menu yang boleh dibuka akun tersebut.

### 🔐 Role Admin & User
- Akun **pertama** yang dibuat di Supabase otomatis jadi **Admin**; akun baru otomatis **User**.
- Admin: Settings → **Configure** → pilih role & centang menu (Inventory, Finance, Activities, Recipes) tiap akun.
- Menu tanpa akses disembunyikan dari tab bar & Home, dan datanya ditolak oleh database (RLS).
- Restore, Load Sample Data & Delete All Data hanya untuk Admin.
- Tambah akun: Supabase → Authentication → Users → **Add user**.

## 🚀 Menjalankan

Tidak perlu build. Cukup jalankan web server statis di folder ini:

```bash
python3 -m http.server 8080
```

Buka `http://localhost:8080` di browser.

> **Kamera (scan barcode & nota) wajib HTTPS** di HP. Cara termudah: deploy gratis ke
> GitHub Pages / Netlify / Vercel, buka link-nya di HP, lalu **Tambahkan ke layar utama**.

## 📝 Catatan teknis
- Data utama di Supabase, cache di HP (localStorage). **Pengaturan → Backup data** tetap bisa dipakai untuk cadangan tambahan.
- Scan barcode memakai `BarcodeDetector` bawaan Chrome Android; di iPhone otomatis memakai library `html5-qrcode`. Kode juga bisa diketik manual.
- Scan nota memakai `Tesseract.js` (bahasa Indonesia + Inggris). Hasil total selalu bisa dikoreksi sebelum disimpan.
- Saat mengubah file, naikkan `VERSION` di `sw.js` agar HP mengambil versi terbaru.
