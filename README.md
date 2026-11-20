# 🏡 Rumahku — Inventory & Keuangan Rumah

Aplikasi web (PWA) untuk HP: kelola **stok barang rumah** dan **keuangan keluarga**.
Desain pastel kalem dan lucu, tiap menu punya warna sendiri supaya mudah dibedakan.
Bisa dipasang ke layar utama HP dan tetap jalan tanpa internet (kecuali scan nota pertama kali).

## ✨ Fitur

### 📦 Menu Utama Inventory Rumah
| # | Menu | Isi |
|---|------|-----|
| 1 | **Input Barang** | Scan barcode → jumlah stok, satuan, kategori, tanggal kadaluarsa (khusus kategori makanan/minuman/bumbu/susu/obat), minimum stok, harga, penempatan. Barcode yang sudah terdaftar otomatis menambah stok. |
| 2 | **Stock Keluar** | Scan barcode (atau cari nama) saat barang dipakai → stok berkurang + riwayat pemakaian. |
| 3 | **Stock Opname** | Hitung stok fisik per lokasi sebelum belanja, selisih disesuaikan otomatis, lalu lanjut ke daftar belanja. |
| 4 | **Daftar Belanja** | Barang dengan stok < minimum stok, jumlah yang perlu dibeli, estimasi biaya, kirim ke WhatsApp / salin, centang = stok bertambah. |
| 5 | **Barang per Lokasi** | Barang dikelompokkan per tempat (Dapur, Kulkas, Gudang, …) + peringatan kadaluarsa. |

### 💰 Menu Utama Financial Rumah
| # | Menu | Isi |
|---|------|-----|
| 1 | **Input Income** | Nominal, kategori, tanggal, akun tujuan, catatan. |
| 2 | **Input Expense** | **Scan nota** (OCR membaca total, tanggal & nama toko) atau input manual. |
| 3 | **Data Pengeluaran** | Filter periode (bulan ini, bulan lalu, 3 bulan, tahun ini, custom), total, rata-rata/hari, per kategori, rincian. |
| 4 | **Data Pemasukan** | Sama seperti di atas untuk pemasukan. |
| 5 | **Neraca & Laba Rugi** | Laba rugi per periode (surplus/defisit, rasio tabungan) dan neraca (aset − hutang = kekayaan bersih, rasio hutang). |
| 6 | **Budget & Realisasi** | Budget per kategori per bulan, progres realisasi, status over budget, salin budget bulan lalu. |

Tambahan: **Akun & Hutang** (dompet, bank, e-wallet, tabungan, aset tetap, hutang) sebagai sumber neraca, dan **Pengaturan** (backup/restore JSON, isi data contoh, hapus data).

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
│   ├── storage.service.js     # simpan data (localStorage) + backup
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

## 🚀 Menjalankan

Tidak perlu build. Cukup jalankan web server statis di folder ini:

```bash
python3 -m http.server 8080
```

Buka `http://localhost:8080` di browser.

> **Kamera (scan barcode & nota) wajib HTTPS** di HP. Cara termudah: deploy gratis ke
> GitHub Pages / Netlify / Vercel, buka link-nya di HP, lalu **Tambahkan ke layar utama**.

## 📝 Catatan teknis
- Data tersimpan di HP (localStorage). Gunakan menu **Pengaturan → Backup data** secara berkala.
- Scan barcode memakai `BarcodeDetector` bawaan Chrome Android; di iPhone otomatis memakai library `html5-qrcode`. Kode juga bisa diketik manual.
- Scan nota memakai `Tesseract.js` (bahasa Indonesia + Inggris). Hasil total selalu bisa dikoreksi sebelum disimpan.
- Saat mengubah file, naikkan `VERSION` di `sw.js` agar HP mengambil versi terbaru.
