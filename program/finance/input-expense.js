/**
 * 2. Input Expense (Pengeluaran)
 * Dua cara: scan foto nota (OCR otomatis membaca total & tanggal) atau
 * input manual.
 */
import { pageHeader, esc, toast } from '../../service/ui.service.js';
import { rupiah, today } from '../../service/format.service.js';
import { scanReceipt } from '../../service/ocr.service.js';
import { navigate } from '../../service/router.service.js';
import { transactionFormHtml, bindTransactionForm } from '../shared/transaction-form.js';

export default {
  path: '/finance/expense',
  title: 'Input Expense',
  render(el, params) {
    let mode = params.mode === 'manual' ? 'manual' : 'scan';
    let scanned = null;

    const draw = () => {
      el.innerHTML = `
        ${pageHeader({ title: 'Input Expense', subtitle: 'Catat pengeluaran keluarga', emoji: '🧾', tone: 'peach', back: '#/finance' })}
        <div class="segmented">
          <button class="${mode === 'scan' ? 'on' : ''}" data-mode="scan">📸 Scan Nota</button>
          <button class="${mode === 'manual' ? 'on' : ''}" data-mode="manual">✍️ Manual</button>
        </div>
        <div data-body></div>`;
      el.querySelectorAll('[data-mode]').forEach((b) =>
        b.addEventListener('click', () => {
          mode = b.dataset.mode;
          scanned = null;
          draw();
        })
      );
      const body = el.querySelector('[data-body]');
      if (mode === 'manual' || scanned) renderForm(body);
      else renderScan(body);
    };

    const renderForm = (body) => {
      body.innerHTML = `
        ${scanned?.image ? `
          <div class="receipt-preview card">
            <img src="${scanned.image}" alt="Foto nota" />
            <div class="grow">
              <div class="badge badge--ok">Nota terbaca</div>
              <p class="small">Total terdeteksi: <strong>${scanned.total ? rupiah(scanned.total) : 'tidak terbaca'}</strong></p>
              ${scanned.store ? `<p class="small muted">Toko: ${esc(scanned.store)}</p>` : ''}
              <p class="small muted">Periksa kembali sebelum menyimpan ya 🙏</p>
            </div>
          </div>
          <details class="card ocr-text"><summary>Lihat teks hasil scan</summary><pre>${esc(scanned.text)}</pre></details>` : ''}
        ${transactionFormHtml('expense', {
          amount: scanned?.total ? scanned.total.toLocaleString('id-ID') : '',
          date: scanned?.date || today(),
          note: scanned?.store ? `Belanja ${scanned.store}` : '',
          category: scanned ? 'Belanja Dapur' : undefined,
        })}`;
      bindTransactionForm(body, 'expense', {
        extra: () => ({ source: scanned ? 'scan' : 'manual' }),
        onSaved: () => navigate('/finance/laporan-pengeluaran'),
      });
    };

    const renderScan = (body) => {
      body.innerHTML = `
        <label class="upload tone-peach">
          <input type="file" accept="image/*" capture="environment" hidden data-file />
          <span class="upload__emoji">📸</span>
          <strong>Foto nota / struk belanja</strong>
          <small>Total & tanggal akan dibaca otomatis</small>
        </label>
        <label class="upload upload--small">
          <input type="file" accept="image/*" hidden data-file />
          🖼️ Pilih dari galeri
        </label>
        <div class="card hidden" data-progress>
          <p class="center">🔎 Membaca nota… <strong data-pct>0%</strong></p>
          <div class="bar"><span data-bar style="width:0%"></span></div>
          <p class="muted small center">Pertama kali butuh internet untuk mengunduh pembaca teks.</p>
        </div>
        <div class="notice tone-butter">💡 Tips: foto nota di tempat terang, lurus, dan seluruh bagian total terlihat.</div>`;

      const progress = body.querySelector('[data-progress]');
      body.querySelectorAll('[data-file]').forEach((input) =>
        input.addEventListener('change', async () => {
          const file = input.files[0];
          if (!file) return;
          progress.classList.remove('hidden');
          body.querySelectorAll('.upload').forEach((u) => u.classList.add('hidden'));
          try {
            scanned = await scanReceipt(file, (p) => {
              body.querySelector('[data-pct]').textContent = `${p}%`;
              body.querySelector('[data-bar]').style.width = `${p}%`;
            });
            if (!scanned.total) toast('Total tidak terbaca, isi manual ya', 'warn');
          } catch (err) {
            toast(err.message || 'Gagal membaca nota', 'error');
            scanned = { image: '', total: 0, date: null, store: '', text: '' };
          }
          draw();
        })
      );
    };

    draw();
  },
};
