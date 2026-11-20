/**
 * Pengaturan — backup / restore data, data contoh, reset.
 */
import { pageHeader, toast, confirmDialog } from '../service/ui.service.js';
import { exportAll, importAll, clearAll } from '../service/storage.service.js';
import { loadDemoData } from '../service/demo.service.js';
import { today } from '../service/format.service.js';

export default {
  path: '/settings',
  title: 'Pengaturan',
  render(el) {
    el.innerHTML = `
      ${pageHeader({ title: 'Pengaturan', subtitle: 'Data tersimpan di HP ini', emoji: '⚙️', tone: 'sky' })}
      <section class="card settings">
        <button class="setting-row" data-export><span>💾</span><div><strong>Backup data</strong><small>Unduh file cadangan (.json)</small></div></button>
        <label class="setting-row"><input type="file" accept="application/json" hidden data-import /><span>📂</span><div><strong>Pulihkan data</strong><small>Dari file backup</small></div></label>
        <button class="setting-row" data-demo><span>🧸</span><div><strong>Isi data contoh</strong><small>Untuk mencoba semua fitur</small></div></button>
        <button class="setting-row setting-row--danger" data-reset><span>🗑️</span><div><strong>Hapus semua data</strong><small>Tidak bisa dibatalkan</small></div></button>
      </section>
      <section class="card">
        <h2>📱 Pasang di HP</h2>
        <p class="small muted">Android (Chrome): menu ⋮ → <b>Tambahkan ke layar utama</b>.<br/>iPhone (Safari): tombol Bagikan → <b>Add to Home Screen</b>.</p>
      </section>
      <p class="muted small center">Rumahku v1.0 · dibuat dengan 💜</p>`;

    el.querySelector('[data-export]').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `rumahku-backup-${today()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('💾 Backup diunduh');
    });

    el.querySelector('[data-import]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        if (!(await confirmDialog('Data sekarang akan diganti dengan isi backup. Lanjutkan?', { okText: 'Pulihkan' }))) return;
        importAll(payload);
        toast('✅ Data dipulihkan');
        location.hash = '#/';
      } catch (err) {
        toast(err.message || 'File tidak valid', 'error');
      }
    });

    el.querySelector('[data-demo]').addEventListener('click', async () => {
      if (!(await confirmDialog('Data contoh akan menggantikan data yang ada. Lanjutkan?', { okText: 'Isi Contoh' }))) return;
      loadDemoData();
      toast('🧸 Data contoh dimuat');
      location.hash = '#/';
    });

    el.querySelector('[data-reset]').addEventListener('click', async () => {
      if (!(await confirmDialog('Semua data inventory & keuangan akan dihapus permanen.', { okText: 'Hapus Semua', danger: true }))) return;
      clearAll();
      toast('Semua data dihapus');
      location.hash = '#/';
    });
  },
};
