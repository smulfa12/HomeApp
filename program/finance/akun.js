/**
 * Kelola Akun (pendukung Neraca):
 * dompet, rekening, e-wallet, tabungan, aset tetap, serta hutang.
 */
import { pageHeader, esc, openSheet, options, bindMoneyInput, formData, toast, confirmDialog } from '../../service/ui.service.js';
import { rupiah, parseNumber } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';

export default {
  path: '/finance/akun',
  title: 'Akun & Hutang',
  render(el) {
    const draw = () => {
      const assets = fin.listAccounts('asset');
      const liabilities = fin.listAccounts('liability');
      const row = (a) => `
        <li class="acc-row" data-edit="${a.id}">
          <div class="grow"><strong>${esc(a.name)}</strong><div class="muted small">${esc(a.group)}</div></div>
          <strong class="${a.type === 'liability' ? 'text-rose' : ''}">${rupiah(fin.accountBalance(a))}</strong>
          <span class="muted">›</span>
        </li>`;

      el.innerHTML = `
        ${pageHeader({ title: 'Akun & Hutang', subtitle: 'Sumber data neraca keluarga', emoji: '🏦', tone: 'sky', back: '#/finance/neraca' })}
        <section class="card">
          <div class="card__head"><h2>🏦 Aset</h2><button class="btn btn--soft btn--sm" data-add="asset">+ Tambah</button></div>
          <ul class="acc-list">${assets.map(row).join('')}</ul>
          <p class="muted small">Saldo = saldo awal + pemasukan − pengeluaran.</p>
        </section>
        <section class="card">
          <div class="card__head"><h2>📌 Hutang / Kewajiban</h2><button class="btn btn--soft btn--sm" data-add="liability">+ Tambah</button></div>
          ${liabilities.length ? `<ul class="acc-list">${liabilities.map(row).join('')}</ul>` : `<p class="muted small center">Tidak ada hutang 🎉</p>`}
        </section>`;

      el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => edit({ type: b.dataset.add })));
      el.querySelectorAll('[data-edit]').forEach((r) => r.addEventListener('click', () => edit(fin.listAccounts().find((a) => a.id === r.dataset.edit))));
    };

    const edit = (acc) => {
      const isLiab = acc.type === 'liability';
      const groups = isLiab ? fin.LIABILITY_GROUPS : fin.ASSET_GROUPS;
      const sheet = openSheet({
        title: acc.id ? 'Edit Akun' : isLiab ? 'Tambah Hutang' : 'Tambah Aset',
        body: `
          <form class="form" data-acc>
            <label class="field"><span>Nama</span><input class="input" name="name" required value="${esc(acc.name || '')}" placeholder="${isLiab ? 'cth. KPR Rumah' : 'cth. BCA, GoPay'}" /></label>
            <label class="field"><span>Jenis</span><select class="input" name="group">${options(groups, acc.group)}</select></label>
            <label class="field"><span>${isLiab ? 'Sisa hutang saat ini' : 'Saldo awal'}</span>
              <div class="money money--sm"><span>Rp</span><input name="opening" inputmode="numeric" value="${acc.opening ? Number(acc.opening).toLocaleString('id-ID') : ''}" placeholder="0" /></div>
            </label>
            <button class="btn btn--primary btn--block" type="submit">💾 Simpan</button>
            ${acc.id ? `<button class="btn btn--danger-soft btn--block" type="button" data-del>🗑️ Hapus</button>` : ''}
          </form>`,
      });
      const form = sheet.el.querySelector('[data-acc]');
      bindMoneyInput(form.opening);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = formData(form);
        fin.saveAccount({ ...(acc.id ? { id: acc.id } : {}), type: acc.type, name: d.name.trim(), group: d.group, opening: parseNumber(d.opening) });
        sheet.close();
        toast('✅ Akun tersimpan');
        draw();
      });
      sheet.el.querySelector('[data-del]')?.addEventListener('click', async () => {
        sheet.close();
        if (await confirmDialog(`Hapus akun "${acc.name}"?`, { okText: 'Hapus', danger: true })) {
          fin.deleteAccount(acc.id);
          toast('Akun dihapus');
          draw();
        }
      });
    };

    draw();
  },
};
