/**
 * Demo Service
 * Mengisi data contoh supaya aplikasi bisa langsung dicoba.
 */
import { collection, save, uid } from './storage.service.js';
import { toISODate, thisMonth, addMonths } from './format.service.js';

const shift = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export function loadDemoData() {
  const items = [
    ['8992753033735', 'Beras Pandan Wangi 5kg', 1, 'karung', 'Makanan', 1, 'Lemari Makan', shift(120), 78000],
    ['8998866200301', 'Minyak Goreng 2L', 1, 'botol', 'Makanan', 2, 'Dapur', shift(200), 36000],
    ['8992388101026', 'Telur Ayam', 4, 'butir', 'Makanan', 10, 'Kulkas', shift(5), 2200],
    ['8999999195663', 'Susu UHT Full Cream 1L', 2, 'kotak', 'Susu & Bayi', 3, 'Kulkas', shift(3), 19500],
    ['8992696404441', 'Kecap Manis 520ml', 1, 'botol', 'Bumbu Dapur', 1, 'Dapur', shift(240), 23000],
    ['8993560025014', 'Indomie Goreng', 12, 'bungkus', 'Makanan', 5, 'Lemari Makan', shift(150), 3100],
    ['8999999036607', 'Sabun Cuci Piring 800ml', 0, 'pouch', 'Kebersihan', 1, 'Dapur', '', 15500],
    ['8998866100618', 'Detergen Bubuk 1.8kg', 1, 'bungkus', 'Kebersihan', 1, 'Gudang', '', 42000],
    ['8999999059316', 'Shampo 340ml', 1, 'botol', 'Perawatan Diri', 1, 'Kamar Mandi', '', 32000],
    ['8992745210112', 'Pasta Gigi 190g', 2, 'tube', 'Perawatan Diri', 2, 'Kamar Mandi', '', 14000],
    ['8999908222101', 'Tisu Gulung isi 10', 3, 'pak', 'Kebersihan', 2, 'Gudang', '', 28000],
    ['8993175536652', 'Paracetamol 500mg', 1, 'strip', 'Obat-obatan', 1, 'Kamar Tidur', shift(-2), 5000],
    ['8991102300107', 'Daging Ayam Fillet 500g', 1, 'pak', 'Makanan', 1, 'Freezer', shift(20), 38000],
  ].map(([barcode, name, qty, unit, category, minStock, location, expiry, price]) => {
    const now = new Date().toISOString();
    return { id: uid(), barcode, name, qty, unit, category, minStock, location, expiry, price, createdAt: now, updatedAt: now };
  });
  collection('inv.items').replaceAll(items);
  collection('inv.movements').replaceAll([]);

  const now = new Date().toISOString();
  const wallet = { id: uid(), name: 'Dompet', type: 'asset', group: 'Kas / Tunai', opening: 750000, createdAt: now, updatedAt: now };
  const bank = { id: uid(), name: 'Rekening BCA', type: 'asset', group: 'Bank', opening: 8500000, createdAt: now, updatedAt: now };
  const ewallet = { id: uid(), name: 'GoPay', type: 'asset', group: 'E-Wallet', opening: 250000, createdAt: now, updatedAt: now };
  const saving = { id: uid(), name: 'Tabungan Pendidikan', type: 'asset', group: 'Tabungan & Investasi', opening: 15000000, createdAt: now, updatedAt: now };
  const kpr = { id: uid(), name: 'KPR Rumah', type: 'liability', group: 'Cicilan / Kredit', opening: 185000000, createdAt: now, updatedAt: now };
  const house = { id: uid(), name: 'Rumah', type: 'asset', group: 'Aset Tetap', opening: 450000000, createdAt: now, updatedAt: now };
  collection('fin.accounts').replaceAll([wallet, bank, ewallet, saving, house, kpr]);

  const m0 = thisMonth();
  const m1 = addMonths(m0, -1);
  const tx = (type, amount, category, accountId, date, note) => ({
    id: uid(), type, amount, category, accountId, date, note, source: 'manual', createdAt: now, updatedAt: now,
  });
  const day = (m, d) => `${m}-${String(d).padStart(2, '0')}`;
  const todayDay = new Date().getDate();
  const cap = (d) => Math.min(d, todayDay);

  collection('fin.transactions').replaceAll([
    tx('income', 12500000, 'Gaji', bank.id, day(m1, 1), 'Gaji bulan lalu'),
    tx('expense', 1850000, 'Belanja Dapur', bank.id, day(m1, 3), 'Belanja bulanan'),
    tx('expense', 3200000, 'Cicilan & Hutang', bank.id, day(m1, 5), 'Cicilan KPR'),
    tx('expense', 650000, 'Listrik & Air', bank.id, day(m1, 8), 'PLN + PDAM'),
    tx('expense', 1200000, 'Pendidikan', bank.id, day(m1, 10), 'SPP sekolah'),
    tx('expense', 480000, 'Makan di Luar', wallet.id, day(m1, 18), 'Makan keluarga'),
    tx('income', 12500000, 'Gaji', bank.id, day(m0, 1), 'Gaji bulan ini'),
    tx('income', 850000, 'Usaha', ewallet.id, day(m0, cap(6)), 'Jualan kue online'),
    tx('expense', 1675000, 'Belanja Dapur', bank.id, day(m0, cap(2)), 'Belanja bulanan supermarket'),
    tx('expense', 3200000, 'Cicilan & Hutang', bank.id, day(m0, cap(5)), 'Cicilan KPR'),
    tx('expense', 720000, 'Listrik & Air', bank.id, day(m0, cap(7)), 'Token listrik + PDAM'),
    tx('expense', 350000, 'Internet & Pulsa', ewallet.id, day(m0, cap(9)), 'Wifi rumah'),
    tx('expense', 300000, 'Transportasi', wallet.id, day(m0, cap(11)), 'Bensin'),
    tx('expense', 265000, 'Makan di Luar', wallet.id, day(m0, cap(14)), 'Bakso weekend'),
    tx('expense', 185000, 'Kesehatan', wallet.id, day(m0, cap(15)), 'Vitamin anak'),
  ]);

  const plan = {
    'Belanja Dapur': 2000000, 'Cicilan & Hutang': 3200000, 'Listrik & Air': 700000, 'Internet & Pulsa': 400000,
    Transportasi: 600000, 'Makan di Luar': 400000, Pendidikan: 1200000, Kesehatan: 300000, Hiburan: 300000,
  };
  save('fin.budgets', { [m0]: plan, [m1]: plan });
}
