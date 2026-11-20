/**
 * Dompet & Rekening — kelola tempat penyimpanan uang keluarga
 * (dompet, bank, e-wallet, tabungan, emas, piutang, aset) dan hutang.
 * Bisa dibuka dari menu Atur maupun dari Neraca.
 */
import { pageHeader, esc, openSheet, bindMoneyInput, formData, toast, confirmDialog, emptyState } from '../../service/ui.service.js';
import { rupiah, parseNumber } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';

const maskNumber = (n) => (n && n.length > 4 ? `•••• ${n.slice(-4)}` : n);

export default {
  path: '/finance/akun',
  title: 'Dompet & Rekening',
  render(el, params) {
    const back = params.from === 'settings' ? '#/settings' : params.from === 'neraca' ? '#/finance/neraca' : '#/finance';

    const row = (a) => `
      <li class="acc-row ${a.archived ? 'acc-row--archived' : ''}" data-edit="${a.id}" role="button" tabindex="0">
        <span class="acc-row__icon tone-${a.type === 'liability' ? 'rose' : 'lavender'}">${fin.accountIcon(a)}</span>
        <div class="grow">
          <strong>${esc(a.name)}</strong>
          <div class="muted small">${esc(a.group)}${a.number ? ` · ${esc(maskNumber(a.number))}` : ''}</div>
        </div>
        <strong class="acc-row__bal ${a.type === 'liability' ? 'text-rose' : ''}">${rupiah(fin.accountBalance(a))}</strong>
        <span class="muted">›</span>
      </li>`;

    const draw = () => {
      const all = fin.listAccounts(null, { includeArchived: true });
      const active = all.filter((a) => !a.archived);
      const archived = all.filter((a) => a.archived);
      const assets = active.filter((a) => a.type === 'asset');
      const liabilities = active.filter((a) => a.type === 'liability');
      const totalAssets = assets.reduce((s, a) => s + fin.accountBalance(a), 0);
      const totalDebt = liabilities.reduce((s, a) => s + fin.accountBalance(a), 0);

      el.innerHTML = `
        ${pageHeader({ title: 'Dompet & Rekening', subtitle: 'Tempat menyimpan uang keluarga', emoji: '💳', tone: 'lavender', back })}

        <section class="stat-row">
          <div class="stat tone-lavender"><span>Total uang & aset</span><strong class="small-num">${rupiah(totalAssets)}</strong></div>
          <div class="stat tone-rose"><span>Total hutang</span><strong class="small-num">${rupiah(totalDebt)}</strong></div>
        </section>

        <a class="link-card" href="#/finance/transfer">🔁 Transfer antar dompet / bayar hutang <span>›</span></a>

        <section class="card">
          <div class="card__head"><h2>💰 Uang & Aset</h2><button class="btn btn--primary btn--sm" data-add="asset">+ Tambah</button></div>
          ${assets.length ? `<ul class="acc-list">${assets.map(row).join('')}</ul>` : emptyState('👛', 'Belum ada', 'Tambahkan dompet, rekening, atau e-wallet.')}
          <p class="muted small">Saldo = saldo awal + pemasukan − pengeluaran yang dicatat di akun tersebut.</p>
        </section>

        <section class="card">
          <div class="card__head"><h2>📌 Hutang & Cicilan</h2><button class="btn btn--soft btn--sm" data-add="liability">+ Tambah</button></div>
          ${liabilities.length ? `<ul class="acc-list">${liabilities.map(row).join('')}</ul>` : `<p class="muted small center">Tidak ada hutang 🎉</p>`}
        </section>

        ${archived.length ? `
        <details class="card archived-box">
          <summary>🗄️ Diarsipkan (${archived.length})</summary>
          <ul class="acc-list">${archived.map(row).join('')}</ul>
        </details>` : ''}`;

      el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => edit({ type: b.dataset.add })));
      el.querySelectorAll('[data-edit]').forEach((r) => {
        const open = () => edit(fin.getAccount(r.dataset.edit));
        r.addEventListener('click', open);
        r.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open()));
      });
    };

    const edit = (acc) => {
      const isLiab = acc.type === 'liability';
      const groups = fin.ACCOUNT_GROUPS[acc.type];
      let group = acc.group || groups[0].name;
      let icon = acc.icon || fin.accountIcon({ ...acc, group });
      let iconTouched = Boolean(acc.icon);
      const txCount = acc.id ? fin.transactionCount(acc.id) : 0;

      const sheet = openSheet({
        title: acc.id ? `Edit ${acc.name}` : isLiab ? 'Tambah Hutang' : 'Tambah Tempat Uang',
        body: `
          <form class="form" data-acc autocomplete="off">
            <label class="field"><span>Nama *</span>
              <input class="input" name="name" required maxlength="40" value="${esc(acc.name || '')}"
                     placeholder="${isLiab ? 'cth. KPR Rumah, Paylater Shopee' : 'cth. BCA Ayah, GoPay Ibu, Celengan'}" />
            </label>

            <div class="field"><span>Jenis</span>
              <div class="chips chips--wrap">
                ${groups.map((g) => `<button type="button" class="chip ${g.name === group ? 'chip--on' : ''}" data-group="${esc(g.name)}">${g.icon} ${esc(g.name)}</button>`).join('')}
              </div>
            </div>

            <div class="field"><span>Ikon</span>
              <div class="icon-pick">
                ${fin.ACCOUNT_ICONS.map((i) => `<button type="button" class="icon-pick__item ${i === icon ? 'on' : ''}" data-icon="${i}" aria-label="Ikon ${i}">${i}</button>`).join('')}
              </div>
            </div>

            ${isLiab ? '' : `
            <label class="field"><span>Nomor rekening / No. HP (opsional)</span>
              <input class="input" name="number" inputmode="numeric" maxlength="30" value="${esc(acc.number || '')}" placeholder="cth. 1234567890" />
            </label>`}

            <label class="field"><span>${isLiab ? 'Sisa hutang saat ini' : 'Saldo awal'}</span>
              <div class="money money--sm"><span>Rp</span><input name="opening" inputmode="numeric" value="${acc.opening ? Number(acc.opening).toLocaleString('id-ID') : ''}" placeholder="0" /></div>
            </label>
            ${acc.id && !isLiab ? `<p class="muted small">Saldo sekarang <strong>${rupiah(fin.accountBalance(acc))}</strong> · ${txCount} transaksi</p>` : ''}

            <label class="field"><span>Catatan</span>
              <input class="input" name="note" maxlength="80" value="${esc(acc.note || '')}" placeholder="opsional, cth. untuk belanja bulanan" />
            </label>

            <button class="btn btn--primary btn--block" type="submit">💾 Simpan</button>
            ${acc.id ? `
              <button class="btn btn--soft btn--block" type="button" data-archive>${acc.archived ? '♻️ Aktifkan lagi' : '🗄️ Arsipkan (sembunyikan)'}</button>
              <button class="btn btn--danger-soft btn--block" type="button" data-del>🗑️ Hapus</button>` : ''}
          </form>`,
      });

      const form = sheet.el.querySelector('[data-acc]');
      bindMoneyInput(form.opening);

      const pickIcon = (value) => {
        icon = value;
        form.querySelectorAll('[data-icon]').forEach((b) => b.classList.toggle('on', b.dataset.icon === value));
      };
      form.querySelectorAll('[data-icon]').forEach((b) =>
        b.addEventListener('click', () => {
          iconTouched = true;
          pickIcon(b.dataset.icon);
        })
      );
      form.querySelectorAll('[data-group]').forEach((b) =>
        b.addEventListener('click', () => {
          group = b.dataset.group;
          form.querySelectorAll('[data-group]').forEach((x) => x.classList.toggle('chip--on', x === b));
          if (!iconTouched) pickIcon(groups.find((g) => g.name === group).icon);
        })
      );

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = formData(form);
        try {
          fin.saveAccount({
            id: acc.id,
            type: acc.type,
            name: d.name,
            group,
            icon,
            number: d.number || '',
            note: d.note,
            opening: parseNumber(d.opening),
            archived: acc.archived || false,
          });
          sheet.close();
          toast('✅ Tersimpan');
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      });

      sheet.el.querySelector('[data-archive]')?.addEventListener('click', () => {
        fin.setArchived(acc.id, !acc.archived);
        sheet.close();
        toast(acc.archived ? '♻️ Akun aktif lagi' : '🗄️ Akun diarsipkan — tidak muncul di pilihan transaksi');
        draw();
      });

      sheet.el.querySelector('[data-del]')?.addEventListener('click', async () => {
        sheet.close();
        if (txCount) {
          const ok = await confirmDialog(`"${acc.name}" dipakai di ${txCount} transaksi, jadi tidak bisa dihapus. Arsipkan saja?`, { okText: 'Arsipkan' });
          if (ok) {
            fin.setArchived(acc.id, true);
            toast('🗄️ Akun diarsipkan');
            draw();
          }
          return;
        }
        if (await confirmDialog(`Hapus "${acc.name}"?`, { okText: 'Hapus', danger: true })) {
          try {
            fin.deleteAccount(acc.id);
            toast('Akun dihapus');
            draw();
          } catch (err) {
            toast(err.message, 'error');
          }
        }
      });
    };

    draw();
  },
};
