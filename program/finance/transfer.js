/**
 * Transfer antar dompet / rekening.
 * Memindahkan saldo tanpa dihitung sebagai pemasukan / pengeluaran.
 * Bisa juga untuk bayar hutang / kartu kredit atau memakai paylater.
 */
import { pageHeader, esc, bindMoneyInput, toast, confirmDialog, periodFilter, emptyState, openSheet } from '../../service/ui.service.js';
import { rupiah, parseNumber, today, dateLabel } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';

function accountOptions(selected, excludeId) {
  const group = (label, list) =>
    list.length
      ? `<optgroup label="${label}">${list
          .map((a) => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''} ${a.id === excludeId ? 'disabled' : ''}>${fin.accountIcon(a)} ${esc(a.name)}</option>`)
          .join('')}</optgroup>`
      : '';
  // akun arsip hanya muncul bila sedang dipilih (mengedit transfer lama)
  const list = (type) => fin.listAccounts(type, { includeArchived: true }).filter((a) => !a.archived || a.id === selected);
  return group('Uang & Aset', list('asset')) + group('Hutang & Cicilan', list('liability'));
}

export default {
  path: '/finance/transfer',
  title: 'Transfer',
  autoRefresh: false,
  render(el, params) {
    const assets = fin.listAccounts('asset');
    // ?to=ID → dibuka dari tombol "Tambah tabungan" di Target Tabungan
    let toId = params.to && fin.getAccount(params.to) ? params.to : assets[1]?.id || '';
    // asal: bila tujuan dipilih otomatis, ambil rekening lain dengan saldo terbesar
    const others = assets.filter((a) => a.id !== toId);
    const liquid = (a) => (fin.LIQUID_GROUPS.includes(a.group) ? 1 : 0); // kas, bank, e-wallet didahulukan
    if (params.to) others.sort((a, b) => liquid(b) - liquid(a) || fin.accountBalance(b) - fin.accountBalance(a));
    let fromId = others[0]?.id || '';
    let range;

    el.innerHTML = `
      ${pageHeader({ title: 'Transfer', subtitle: 'Pindahkan uang antar dompet & rekening', emoji: '🔁', tone: 'sky', back: '#/finance' })}

      ${assets.length < 2 ? `<div class="notice tone-butter">💡 Butuh minimal 2 dompet / rekening. <a class="link" href="#/finance/akun">Tambah dompet / rekening</a></div>` : ''}

      <form class="card form" data-tf autocomplete="off">
        <div class="tf-box">
          <label class="field"><span>Dari</span>
            <select class="input" name="from" data-from></select>
          </label>
          <p class="tf-balance" data-from-bal></p>
          <button type="button" class="tf-swap" data-swap aria-label="Tukar asal dan tujuan">⇅</button>
          <label class="field"><span>Ke</span>
            <select class="input" name="to" data-to></select>
          </label>
          <p class="tf-balance" data-to-bal></p>
        </div>
        <div class="tf-kind" data-kind></div>

        <label class="field"><span>Nominal</span>
          <div class="money tone-sky"><span>Rp</span><input name="amount" inputmode="numeric" placeholder="0" required /></div>
        </label>
        <div class="grid-2">
          <label class="field"><span>Biaya admin (opsional)</span>
            <div class="money money--sm"><span>Rp</span><input name="fee" inputmode="numeric" placeholder="0" /></div>
          </label>
          <label class="field"><span>Tanggal</span>
            <input class="input" type="date" name="date" value="${today()}" required />
          </label>
        </div>
        <div class="chips chips--wrap" data-fees>
          ${[0, 2500, 6500].map((v) => `<button type="button" class="chip" data-fee="${v}">${v ? `Admin ${rupiah(v)}` : 'Gratis'}</button>`).join('')}
        </div>
        <label class="field"><span>Catatan</span>
          <input class="input" name="note" maxlength="80" placeholder="cth. Isi saldo GoPay, Tarik tunai ATM" />
        </label>
        <button class="btn btn--sky btn--block" type="submit">🔁 Transfer</button>
      </form>

      <section class="card">
        <div class="card__head"><h2>🕘 Riwayat transfer</h2></div>
        <div data-period></div>
        <div data-history></div>
      </section>`;

    const form = el.querySelector('[data-tf]');
    const fromSel = el.querySelector('[data-from]');
    const toSel = el.querySelector('[data-to]');
    bindMoneyInput(form.amount);
    bindMoneyInput(form.fee);

    const balLabel = (id) => {
      const a = fin.getAccount(id);
      if (!a) return '';
      return a.type === 'liability' ? `Sisa hutang ${rupiah(fin.accountBalance(a))}` : `Saldo ${rupiah(fin.accountBalance(a))}`;
    };

    const syncSelects = () => {
      fromSel.innerHTML = accountOptions(fromId, toId);
      toSel.innerHTML = accountOptions(toId, fromId);
      el.querySelector('[data-from-bal]').textContent = balLabel(fromId);
      el.querySelector('[data-to-bal]').textContent = balLabel(toId);
      const kind = fin.transferKind(fin.getAccount(fromId), fin.getAccount(toId));
      const hint = {
        'Bayar hutang': '💸 Bayar hutang: saldo berkurang, sisa hutang ikut berkurang.',
        'Pinjam / pakai limit': '⏳ Pakai limit / pinjam: saldo bertambah, hutang ikut bertambah.',
        'Pindah hutang': '🔀 Pindah hutang dari satu akun ke akun lain.',
        'Pindah saldo': '🔁 Pindah saldo: tidak dihitung sebagai pemasukan / pengeluaran.',
      }[kind];
      el.querySelector('[data-kind]').textContent = hint || '';
    };

    fromSel.addEventListener('change', () => {
      fromId = fromSel.value;
      syncSelects();
    });
    toSel.addEventListener('change', () => {
      toId = toSel.value;
      syncSelects();
    });
    el.querySelector('[data-swap]').addEventListener('click', () => {
      [fromId, toId] = [toId, fromId];
      syncSelects();
    });
    el.querySelectorAll('[data-fee]').forEach((b) =>
      b.addEventListener('click', () => {
        form.fee.value = Number(b.dataset.fee) ? Number(b.dataset.fee).toLocaleString('id-ID') : '';
        el.querySelectorAll('[data-fee]').forEach((x) => x.classList.toggle('chip--on', x === b));
      })
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseNumber(form.amount.value);
      const fee = parseNumber(form.fee.value);
      const from = fin.getAccount(fromId);
      if (from?.type === 'asset' && amount + fee > fin.accountBalance(from)) {
        const ok = await confirmDialog(
          `Saldo ${from.name} (${rupiah(fin.accountBalance(from))}) kurang dari ${rupiah(amount + fee)}. Saldo akan jadi minus. Tetap transfer?`,
          { okText: 'Tetap transfer' }
        );
        if (!ok) return;
      }
      try {
        fin.addTransfer({ fromId, toId, amount, fee, date: form.date.value, note: form.note.value });
        toast(`✅ ${rupiah(amount)} dipindahkan ke ${fin.getAccount(toId).name}`);
        form.amount.value = '';
        form.fee.value = '';
        form.note.value = '';
        el.querySelectorAll('[data-fee]').forEach((x) => x.classList.remove('chip--on'));
        syncSelects();
        drawHistory();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    const history = el.querySelector('[data-history]');
    const drawHistory = () => {
      if (!range) return;
      const rows = fin.listTransfers(range);
      const name = (id) => {
        const a = fin.getAccount(id);
        return a ? `${fin.accountIcon(a)} ${esc(a.name)}` : '❔ (akun dihapus)';
      };
      history.innerHTML = rows.length
        ? `<ul class="tx-list">${rows
            .map(
              (t) => `
            <li class="tx-list__row" data-edit="${t.id}" role="button" tabindex="0">
              <span class="tx-list__icon tone-sky">🔁</span>
              <div class="grow">
                <div class="tx-list__title tf-route">${name(t.accountId)} → ${name(t.toAccountId)}</div>
                <div class="muted small">${dateLabel(t.date)} · ${fin.transferKind(fin.getAccount(t.accountId), fin.getAccount(t.toAccountId))}${t.fee ? ` · admin ${rupiah(t.fee)}` : ''}${t.note ? ` · ${esc(t.note)}` : ''}</div>
              </div>
              <div class="tx-list__amt text-sky">${rupiah(t.amount)}</div>
              <span class="tx-list__edit" aria-hidden="true">✏️</span>
            </li>`
            )
            .join('')}</ul>`
        : emptyState('🔁', 'Belum ada transfer', 'Transfer pada periode ini akan muncul di sini.');
      history.querySelectorAll('[data-edit]').forEach((row) => {
        const open = () => editTransfer(rows.find((t) => t.id === row.dataset.edit));
        row.addEventListener('click', open);
        row.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open()));
      });
    };

    const editTransfer = (t) => {
      let eFrom = t.accountId;
      let eTo = t.toAccountId;
      const sheet = openSheet({
        title: 'Edit Transfer',
        body: `
          <form class="form" data-tf-edit autocomplete="off">
            <label class="field"><span>Dari</span><select class="input" name="from"></select></label>
            <label class="field"><span>Ke</span><select class="input" name="to"></select></label>
            <label class="field"><span>Nominal</span>
              <div class="money tone-sky"><span>Rp</span><input name="amount" inputmode="numeric" required value="${Number(t.amount).toLocaleString('id-ID')}" /></div>
            </label>
            <div class="grid-2">
              <label class="field"><span>Biaya admin</span>
                <div class="money money--sm"><span>Rp</span><input name="fee" inputmode="numeric" placeholder="0" value="${t.fee ? Number(t.fee).toLocaleString('id-ID') : ''}" /></div>
              </label>
              <label class="field"><span>Tanggal</span><input class="input" type="date" name="date" value="${esc(t.date)}" required /></label>
            </div>
            <label class="field"><span>Catatan</span><input class="input" name="note" maxlength="80" value="${esc(t.note || '')}" /></label>
            <button class="btn btn--sky btn--block" type="submit">💾 Simpan Perubahan</button>
            <button class="btn btn--danger-soft btn--block" type="button" data-del>🗑️ Hapus Transfer</button>
          </form>`,
      });
      const f = sheet.el.querySelector('[data-tf-edit]');
      const fill = () => {
        f.from.innerHTML = accountOptions(eFrom, eTo);
        f.to.innerHTML = accountOptions(eTo, eFrom);
      };
      fill();
      f.from.addEventListener('change', () => ((eFrom = f.from.value), fill()));
      f.to.addEventListener('change', () => ((eTo = f.to.value), fill()));
      bindMoneyInput(f.amount);
      bindMoneyInput(f.fee);
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          fin.updateTransfer(t.id, { fromId: eFrom, toId: eTo, amount: parseNumber(f.amount.value), fee: parseNumber(f.fee.value), date: f.date.value, note: f.note.value });
          sheet.close();
          toast('✅ Transfer diperbarui');
          syncSelects();
          drawHistory();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      f.querySelector('[data-del]').addEventListener('click', async () => {
        sheet.close();
        if (!(await confirmDialog('Hapus transfer ini? Saldo kedua akun akan kembali seperti semula.', { okText: 'Hapus', danger: true }))) return;
        fin.deleteTransfer(t.id);
        toast('Transfer dihapus');
        syncSelects();
        drawHistory();
      });
    };

    syncSelects();
    periodFilter(el.querySelector('[data-period]'), (r) => {
      range = r;
      drawHistory();
    });
  },
};
