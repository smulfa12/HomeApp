/**
 * Form transaksi (dipakai Input Income & Input Expense).
 */
import { esc, options, bindMoneyInput, formData, toast } from '../../service/ui.service.js';
import { today, parseNumber } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';

export function transactionFormHtml(type, { amount = '', date = today(), note = '', category } = {}) {
  const cats = type === 'income' ? fin.INCOME_CATEGORIES : fin.EXPENSE_CATEGORIES;
  const selected = category || cats[0].name;
  const tone = type === 'income' ? 'mint' : 'peach';
  return `
    <form class="card form" data-tx-form autocomplete="off">
      <label class="field">
        <span>Nominal</span>
        <div class="money tone-${tone}">
          <span>Rp</span>
          <input name="amount" inputmode="numeric" placeholder="0" required value="${esc(amount)}" />
        </div>
      </label>
      <div class="field">
        <span>Kategori</span>
        <div class="cat-grid">
          ${cats
            .map(
              (c) => `
            <label class="cat-pill tone-${tone}">
              <input type="radio" name="category" value="${esc(c.name)}" ${c.name === selected ? 'checked' : ''} />
              <span>${c.emoji}</span><small>${esc(c.name)}</small>
            </label>`
            )
            .join('')}
        </div>
      </div>
      <div class="grid-2">
        <label class="field">
          <span>Tanggal</span>
          <input class="input" type="date" name="date" value="${esc(date)}" required />
        </label>
        <label class="field">
          <span>${type === 'income' ? 'Masuk ke' : 'Dibayar dari'}</span>
          <select class="input" name="accountId">${options(fin.listAccounts('asset'), null, { valueKey: 'id', labelKey: (a) => `${fin.accountIcon(a)} ${a.name}` })}</select>
          <a class="link small" href="#/finance/akun">+ Tambah dompet / rekening</a>
        </label>
      </div>
      <label class="field">
        <span>Catatan</span>
        <input class="input" name="note" value="${esc(note)}" placeholder="${type === 'income' ? 'cth. Gaji November' : 'cth. Belanja bulanan'}" />
      </label>
      <button class="btn ${type === 'income' ? 'btn--primary' : 'btn--peach'} btn--block" type="submit">
        💾 Simpan ${type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
      </button>
    </form>`;
}

/** Pasang perilaku form. `extra()` boleh mengembalikan field tambahan (mis. source). */
export function bindTransactionForm(root, type, { onSaved, extra = () => ({}) } = {}) {
  const form = root.querySelector('[data-tx-form]');
  bindMoneyInput(form.amount);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = formData(form);
    try {
      const tx = fin.addTransaction({ ...data, ...extra(), type, amount: parseNumber(data.amount) });
      toast(`✅ ${type === 'income' ? 'Pemasukan' : 'Pengeluaran'} tersimpan`);
      onSaved?.(tx);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  return form;
}
