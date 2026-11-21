/**
 * Pengaturan — status database, backup / restore, data contoh, reset.
 */
import { pageHeader, toast, confirmDialog, confirmTyped, esc } from '../service/ui.service.js';
import { exportAll, importAll, clearAll } from '../service/storage.service.js';
import { loadDemoData } from '../service/demo.service.js';
import { today } from '../service/format.service.js';
import { syncState, onSyncChange, syncNow, logout } from '../service/sync.service.js';
import { navigate } from '../service/router.service.js';
import { APP_VERSION } from '../service/version.service.js';

const STATUS = {
  synced: ['ok', '✅ Tersinkron'],
  syncing: ['info', '🔄 Menyinkronkan…'],
  offline: ['warn', '📴 Offline — tersimpan di HP'],
  error: ['danger', '⚠️ Gagal sinkron'],
  idle: ['info', '☁️ Terhubung'],
};

function timeLabel(iso) {
  if (!iso) return 'belum pernah';
  const d = new Date(iso);
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function dbCard(s) {
  if (s.mode === 'local') {
    return `
      <section class="card">
        <div class="card__head"><h2>🗄️ Database</h2><span class="badge badge--warn">Mode lokal</span></div>
        <p class="small muted">Data hanya tersimpan di HP ini. Hubungkan ke Supabase agar data aman di cloud dan bisa dipakai bersama keluarga
        (isi <code>service/supabase.config.js</code>, lihat README).</p>
      </section>`;
  }
  const [cls, label] = STATUS[s.status] || STATUS.idle;
  return `
    <section class="card">
      <div class="card__head"><h2>🗄️ Database Supabase</h2><span class="badge badge--${cls}">${label}</span></div>
      <div class="kv"><span>Akun</span><strong>${esc(s.user?.email || '-')}</strong></div>
      <div class="kv"><span>Sinkron terakhir</span><strong>${timeLabel(s.lastSync)}</strong></div>
      <div class="kv"><span>Menunggu dikirim</span><strong>${s.pending} perubahan</strong></div>
      ${s.error && s.status === 'error' ? `<p class="small text-rose">${esc(s.error)}</p>` : ''}
      <div class="row gap-sm">
        <button class="btn btn--soft grow" data-sync>🔄 Sinkron sekarang</button>
        <button class="btn btn--ghost grow" data-logout>🚪 Keluar</button>
      </div>
    </section>`;
}

export default {
  path: '/settings',
  title: 'Pengaturan',
  render(el) {
    const cloud = syncState().mode === 'cloud';
    el.innerHTML = `
      ${pageHeader({ title: 'Pengaturan', subtitle: cloud ? 'Data tersimpan di database Supabase' : 'Data tersimpan di HP ini', emoji: '⚙️', tone: 'sky' })}
      <div data-db>${dbCard(syncState())}</div>
      <section class="card settings">
        <a class="setting-row" href="#/finance/akun?from=settings"><span>💳</span><div><strong>Dompet & Rekening</strong><small>Tambah / atur tempat penyimpanan uang & hutang</small></div></a>
        <a class="setting-row" href="#/inventory/lokasi-atur?from=settings"><span>📍</span><div><strong>Lokasi Inventory</strong><small>Atur tempat penyimpanan barang</small></div></a>
        <a class="setting-row" href="#/finance/kategori?from=settings"><span>🗂️</span><div><strong>Kategori Budget</strong><small>Atur kategori pengeluaran & pemasukan sendiri</small></div></a>
        <a class="setting-row" href="#/finance/transfer"><span>🔁</span><div><strong>Transfer</strong><small>Pindah saldo antar dompet / rekening, bayar hutang</small></div></a>
        <button class="setting-row" data-export><span>💾</span><div><strong>Backup data</strong><small>Unduh file cadangan (.json)</small></div></button>
        <label class="setting-row"><input type="file" accept="application/json" hidden data-import /><span>📂</span><div><strong>Pulihkan data</strong><small>Dari file backup${cloud ? ' (menggantikan data di database)' : ''}</small></div></label>
        <button class="setting-row" data-demo><span>🧸</span><div><strong>Isi data contoh</strong><small>Untuk mencoba semua fitur</small></div></button>
        <button class="setting-row setting-row--danger" data-reset><span>🗑️</span><div><strong>Hapus semua data</strong><small>${cloud ? 'Termasuk di database, untuk semua anggota keluarga' : 'Tidak bisa dibatalkan'}</small></div></button>
      </section>
      <section class="card">
        <h2>📱 Pasang di HP</h2>
        <p class="small muted">Android (Chrome): menu ⋮ → <b>Tambahkan ke layar utama</b>.<br/>iPhone (Safari): tombol Bagikan → <b>Add to Home Screen</b>.</p>
      </section>
      <p class="muted small center">Rumahku ${APP_VERSION} · dibuat dengan 🤍</p>`;

    const dbBox = el.querySelector('[data-db]');
    const bindDb = () => {
      dbBox.querySelector('[data-sync]')?.addEventListener('click', async () => {
        const ok = await syncNow();
        toast(ok ? '✅ Data tersinkron' : 'Belum bisa sinkron, coba lagi nanti', ok ? 'ok' : 'warn');
      });
      dbBox.querySelector('[data-logout]')?.addEventListener('click', async () => {
        const { pending } = syncState();
        const msg = pending
          ? `Masih ada ${pending} perubahan yang belum terkirim ke database dan akan hilang. Tetap keluar?`
          : 'Keluar dari akun? Data di HP ini akan dibersihkan (tetap aman di database).';
        if (!(await confirmDialog(msg, { okText: 'Keluar', danger: pending > 0 }))) return;
        await logout();
        navigate('/login');
      });
    };
    bindDb();
    const stop = onSyncChange((s) => {
      dbBox.innerHTML = dbCard(s);
      bindDb();
    });

    /** Unduh backup JSON. Dipanggil manual & otomatis sebelum tindakan berbahaya. */
    const downloadBackup = (suffix = '') => {
      const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `rumahku-backup-${today()}${suffix}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const who = cloud ? ' untuk SEMUA anggota keluarga (di database)' : ' di HP ini';
    const AUTO_BACKUP = 'Sebelum dilanjutkan, file backup data sekarang otomatis diunduh — simpan baik-baik untuk jaga-jaga.';

    el.querySelector('[data-export]').addEventListener('click', () => {
      downloadBackup();
      toast('💾 Backup diunduh');
    });

    el.querySelector('[data-import]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        if (!payload || typeof payload.data !== 'object') throw new Error('Format backup tidak dikenali');
        const ok = await confirmTyped(`Semua data sekarang akan DIGANTI dengan isi file backup${who}.`, 'PULIHKAN', { okText: 'Pulihkan', detail: AUTO_BACKUP });
        e.target.value = '';
        if (!ok) return;
        downloadBackup('-sebelum-pulihkan');
        importAll(payload);
        toast('✅ Data dipulihkan');
        navigate('/');
      } catch (err) {
        toast(err.message || 'File tidak valid', 'error');
      }
    });

    el.querySelector('[data-demo]').addEventListener('click', async () => {
      const ok = await confirmTyped(`Data contoh akan MENGGANTIKAN semua data barang & keuangan${who}. Data asli kamu akan hilang.`, 'CONTOH', {
        okText: 'Isi Data Contoh',
        detail: AUTO_BACKUP,
      });
      if (!ok) return;
      downloadBackup('-sebelum-data-contoh');
      loadDemoData();
      toast('🧸 Data contoh dimuat');
      navigate('/');
    });

    el.querySelector('[data-reset]').addEventListener('click', async () => {
      const ok = await confirmTyped(`Semua data inventory & keuangan akan DIHAPUS PERMANEN${who}.`, 'HAPUS', {
        okText: 'Hapus Semua',
        detail: AUTO_BACKUP,
      });
      if (!ok) return;
      downloadBackup('-sebelum-hapus');
      clearAll();
      toast('Semua data dihapus');
      navigate('/');
    });

    return stop;
  },
};
