/**
 * Form transaksi (dipakai Input Income & Input Expense) + editor transaksi.
 */
import { esc, options, bindMoneyInput, formData, toast, openSheet, confirmDialog } from '../../service/ui.service.js';
import { today, parseNumber } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';

export function transactionFormHtml(type, { amount = '', date = today(), note = '', category, accountId, editing = false } = {}) {
  const cats = fin.getCategories(type);
  // kategori lama yang sudah disembunyikan tetap bisa dipilih saat mengedit
  if (editing && category && !cats.some((c) => c.name === category)) cats.push({ name: category, emoji: fin.categoryEmoji(type, category) });
  const selected = cats.some((c) => c.name === category) ? category : cats[0].name;
  const accounts = fin.listAccounts('asset');
  if (accountId && !accounts.some((a) => a.id === accountId) && fin.getAccount(accountId)) accounts.push(fin.getAccount(accountId));
  const tone = type === 'income' ? 'mint' : 'peach';
  return `
    <form class="${editing ? '' : 'card '}form" data-tx-form autocomplete="off">
      <label class="field">
        <span>Nominal</span>
        <div class="money tone-${tone}">
          <span>Rp</span>
          <input name="amount" inputmode="numeric" placeholder="0" required value="${esc(amount)}" />
        </div>
      </label>
      <div class="field">
        <span class="row between">Kategori <a class="link small" href="#/finance/kategori?type=${type}">⚙️ Atur kategori</a></span>
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
          <select class="input" name="accountId">${options(accounts, accountId || null, { valueKey: 'id', labelKey: (a) => `${fin.accountIcon(a)} ${a.name}` })}</select>
          ${editing ? '' : `<a class="link small" href="#/finance/akun">+ Tambah dompet / rekening</a>`}
        </label>
      </div>
      <label class="field">
        <span>Catatan</span>
        <input class="input" name="note" value="${esc(note)}" placeholder="${type === 'income' ? 'cth. Gaji November' : 'cth. Belanja bulanan'}" />
      </label>
      <button class="btn ${type === 'income' ? 'btn--primary' : 'btn--peach'} btn--block" type="submit">
        💾 ${editing ? 'Simpan Perubahan' : `Simpan ${type === 'income' ? 'Pemasukan' : 'Pengeluaran'}`}
      </button>
      ${editing ? `<button class="btn btn--danger-soft btn--block" type="button" data-tx-del>🗑️ Hapus Transaksi</button>` : ''}
    </form>`;
}

/**
 * Pasang perilaku form. `extra()` boleh mengembalikan field tambahan (mis. source).
 * `editId` → form mengubah transaksi yang sudah ada.
 */
export function bindTransactionForm(root, type, { onSaved, extra = () => ({}), editId } = {}) {
  const form = root.querySelector('[data-tx-form]');
  bindMoneyInput(form.amount);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = formData(form);
    try {
      const payload = { ...data, ...extra(), type, amount: parseNumber(data.amount) };
      const tx = editId ? fin.updateTransaction(editId, payload) : fin.addTransaction(payload);
      toast(`✅ ${type === 'income' ? 'Pemasukan' : 'Pengeluaran'} ${editId ? 'diperbarui' : 'tersimpan'}`);
      onSaved?.(tx);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  return form;
}

/**
 * Buka editor untuk satu transaksi pemasukan / pengeluaran di bottom sheet.
 * onDone() dipanggil setelah disimpan atau dihapus.
 */
export function openTransactionEditor(txId, { onDone } = {}) {
  const tx = fin.getTransaction(txId);
  if (!tx) return toast('Transaksi tidak ditemukan', 'error');
  if (tx.refId) {
    toast('Ini biaya admin transfer — ubah lewat menu Transfer', 'warn');
    location.hash = '#/finance/transfer';
    return;
  }
  const sheet = openSheet({
    title: tx.type === 'income' ? 'Edit Pemasukan' : 'Edit Pengeluaran',
    body: transactionFormHtml(tx.type, {
      amount: Number(tx.amount).toLocaleString('id-ID'),
      date: tx.date,
      note: tx.note,
      category: tx.category,
      accountId: tx.accountId,
      editing: true,
    }),
  });
  bindTransactionForm(sheet.el, tx.type, {
    editId: tx.id,
    onSaved: () => {
      sheet.close();
      onDone?.();
    },
  });
  sheet.el.querySelector('[data-tx-del]').addEventListener('click', async () => {
    sheet.close();
    if (!(await confirmDialog('Hapus transaksi ini?', { okText: 'Hapus', danger: true }))) return;
    fin.deleteTransaction(tx.id);
    toast('Transaksi dihapus');
    onDone?.();
  });
}
