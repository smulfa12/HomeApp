/**
 * Bills — tagihan rutin. Atur sekali, lalu tiap jatuh tempo tinggal "Bayar":
 * pengeluaran otomatis tercatat di Keuangan dan tagihan bulan itu jadi lunas.
 */
import { pageHeader, esc, openSheet, bindMoneyInput, toast, confirmDialog, emptyState, options } from '../../service/ui.service.js';
import { rupiah, parseNumber, today, thisMonth, addMonths, monthLabel, dateLabel, daysUntil } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';
import * as bill from '../../service/bill.service.js';

/** Teks status singkat untuk satu tagihan di satu bulan. */
export function statusText(x) {
  if (x.payment) return [`✅ Lunas ${x.payment.date ? dateLabel(x.payment.date) : ''}`, 'ok'];
  const d = daysUntil(x.due);
  if (d < 0) return [`⚠️ Terlambat ${-d} hari`, 'danger'];
  if (d === 0) return ['⏰ Jatuh tempo hari ini', 'warn'];
  if (d <= 3) return [`⏰ ${d} hari lagi`, 'warn'];
  return [`Jatuh tempo ${dateLabel(x.due)}`, 'info'];
}

/** Baris tagihan (dipakai juga di Home). */
export function billRow(x, { compact = false } = {}) {
  const [text, tone] = statusText(x);
  return `
    <li class="bill-row" data-bill="${x.bill.id}" data-month="${x.month}">
      <span class="bill-row__icon">${esc(x.bill.icon || '🧾')}</span>
      <div class="bill-row__main">
        <b>${esc(x.bill.name)}${x.month !== thisMonth() ? ` <small class="muted">${monthLabel(x.month)}</small>` : ''}</b>
        <small class="text-${tone}">${text}</small>
      </div>
      <div class="bill-row__side">
        <b>${rupiah(x.payment?.amount || x.bill.amount)}</b>
        ${x.payment ? '' : `<button class="btn btn--primary btn--sm" data-pay="${x.bill.id}" data-month="${x.month}">Bayar</button>`}
      </div>
    </li>`;
}

/** Sheet pembayaran. Dipakai halaman Bills & Home. */
export function openPaySheet(billId, month, onDone) {
  const b = bill.getBill(billId);
  if (!b) return;
  const accounts = fin.listAccounts('asset');
  const sheet = openSheet({
    title: `${b.icon || '🧾'} Bayar ${b.name}`,
    body: `
      <form class="form" data-payform autocomplete="off">
        <p class="muted small">${monthLabel(month)} · jatuh tempo ${dateLabel(bill.dueDate(b, month))}</p>
        <label class="field"><span>Jumlah dibayar</span>
          <div class="money tone-peach"><span>Rp</span><input name="amount" inputmode="numeric" value="${b.amount.toLocaleString('id-ID')}" /></div>
        </label>
        <div class="grid-2">
          <label class="field"><span>Dibayar dari</span><select class="input" name="accountId">${options(accounts, b.accountId || accounts[0]?.id, { valueKey: 'id', labelKey: (a) => `${fin.accountIcon(a)} ${a.name}` })}</select></label>
          <label class="field"><span>Tanggal</span><input class="input" type="date" name="date" value="${today()}" required /></label>
        </div>
        <label class="switch-row"><input type="checkbox" name="already" /> <span>Sudah dibayar & dicatat sebelumnya (tanpa pengeluaran baru)</span></label>
        <button class="btn btn--primary btn--block" type="submit">💸 Bayar & Catat Pengeluaran</button>
      </form>`,
  });
  const f = sheet.el.querySelector('[data-payform]');
  bindMoneyInput(f.amount);
  f.already.addEventListener('change', () => {
    f.querySelector('[type=submit]').textContent = f.already.checked ? '✅ Tandai Lunas' : '💸 Bayar & Catat Pengeluaran';
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      if (f.already.checked) bill.markPaid(billId, month);
      else bill.pay(billId, month, { amount: parseNumber(f.amount.value), accountId: f.accountId.value, date: f.date.value });
      sheet.close();
      toast(f.already.checked ? '✅ Ditandai lunas' : `✅ ${b.name} lunas, pengeluaran tercatat`);
      onDone?.();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

export default {
  path: '/finance/tagihan',
  title: 'Bills',
  render(el) {
    const draw = () => {
      const now = thisMonth();
      const sum = bill.monthSummary(now);
      const overdue = bill.dueSoon(0).filter((x) => x.month < now);
      const thisList = bill.billsForMonth(now);
      const nextList = bill.billsForMonth(addMonths(now, 1));
      const all = bill.listBills({ includeArchived: true });
      const pct = sum.count ? Math.round((sum.paidCount / sum.count) * 100) : 0;

      el.innerHTML = `
        ${pageHeader({ title: 'Bills', subtitle: 'Tagihan rutin: atur sekali, tinggal bayar', emoji: '📅', tone: 'butter', back: '#/finance' })}
        <button class="btn btn--primary btn--block" data-add>➕ Tambah Tagihan</button>

        ${all.length ? `
        <section class="card">
          <div class="card__head"><h2>${monthLabel(now)}</h2><span class="muted small">${sum.paidCount}/${sum.count} lunas</span></div>
          <div class="bar"><span style="width:${pct}%"></span></div>
          <div class="kv"><span>Total tagihan</span><strong>${rupiah(sum.total)}</strong></div>
          <div class="kv"><span>Belum dibayar</span><strong class="${sum.remaining ? 'text-danger' : ''}">${rupiah(sum.remaining)}</strong></div>
        </section>` : ''}

        ${overdue.length ? `<section class="card card--alert"><h2>⚠️ Tunggakan bulan lalu</h2><ul class="bill-list">${overdue.map((x) => billRow(x)).join('')}</ul></section>` : ''}

        ${all.length ? `
        <section class="card">
          <h2>🗓️ Bulan ini</h2>
          ${thisList.length ? `<ul class="bill-list">${thisList.map((x) => billRow(x)).join('')}</ul>` : '<p class="muted small">Tidak ada tagihan bulan ini.</p>'}
        </section>
        ${nextList.length ? `
        <section class="card">
          <h2>⏭️ Bulan depan</h2>
          <ul class="mini-list">${nextList.map((x) => `<li><span>${esc(x.bill.icon)} ${esc(x.bill.name)} <small class="muted">${dateLabel(x.due)}</small></span><span>${rupiah(x.bill.amount)}</span></li>`).join('')}</ul>
        </section>` : ''}
        <section class="card">
          <h2>⚙️ Atur tagihan</h2>
          <ul class="mini-list">${all.map((b) => `
            <li><button class="link-row" data-edit="${b.id}">
              <span>${esc(b.icon)} ${esc(b.name)}${b.archived ? ' <span class="badge badge--info">diarsip</span>' : ''}<small>${bill.intervalLabel(b.intervalMonths)} · tgl ${b.dueDay} · ${esc(b.category)}</small></span>
              <span>${rupiah(b.amount)} ›</span></button></li>`).join('')}</ul>
        </section>` : `<section class="card">${emptyState('📅', 'Belum ada tagihan', 'Contoh: listrik tiap tanggal 20, internet tanggal 5, cicilan KPR tanggal 25, SPP tiap bulan.')}</section>`}`;

      el.querySelector('[data-add]').addEventListener('click', () => openForm());
      el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openForm(bill.getBill(b.dataset.edit))));
      el.querySelectorAll('[data-pay]').forEach((b) =>
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          openPaySheet(b.dataset.pay, b.dataset.month, draw);
        })
      );
      el.querySelectorAll('.bill-row').forEach((row) =>
        row.addEventListener('click', async () => {
          const b = bill.getBill(row.dataset.bill);
          const p = bill.payment(b, row.dataset.month);
          if (!p) return;
          const msg = p.tx
            ? `Batalkan pembayaran ${b.name} ${monthLabel(row.dataset.month)}? Pengeluaran ${rupiah(p.amount)} yang tercatat ikut dihapus.`
            : `Batalkan tanda lunas ${b.name} ${monthLabel(row.dataset.month)}?`;
          if (!(await confirmDialog(msg, { okText: 'Batalkan', danger: true }))) return;
          bill.unpay(b.id, row.dataset.month);
          toast('Pembayaran dibatalkan');
          draw();
        })
      );
    };

    const openForm = (b = null) => {
      const cats = fin.getCategories('expense');
      const accounts = fin.listAccounts('asset');
      let icon = b?.icon || '💡';
      const sheet = openSheet({
        title: b ? `✏️ ${b.name}` : '➕ Tagihan Baru',
        body: `
          <form class="form" data-billform autocomplete="off">
            <label class="field"><span>Nama tagihan</span><input class="input" name="name" maxlength="40" required placeholder="cth. Listrik PLN" value="${esc(b?.name || '')}" /></label>
            <div class="icon-pick">${bill.BILL_ICONS.map((i) => `<button type="button" class="icon-pick__item ${i === icon ? 'on' : ''}" data-icon="${i}" aria-label="Ikon ${i}">${i}</button>`).join('')}</div>
            <label class="field"><span>Jumlah (perkiraan)</span>
              <div class="money tone-peach"><span>Rp</span><input name="amount" inputmode="numeric" placeholder="0" value="${b ? b.amount.toLocaleString('id-ID') : ''}" /></div>
            </label>
            <div class="grid-2">
              <label class="field"><span>Jatuh tempo tgl</span><input class="input" type="number" name="dueDay" min="1" max="31" required value="${b?.dueDay || ''}" placeholder="1–31" /></label>
              <label class="field"><span>Berulang</span><select class="input" name="intervalMonths">${bill.INTERVALS.map(([k, l]) => `<option value="${k}" ${k === (b?.intervalMonths || 1) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            </div>
            <div class="grid-2">
              <label class="field"><span>Kategori</span><select class="input" name="category">${options(cats, b?.category || cats.find((c) => /listrik/i.test(c.name))?.name, { valueKey: 'name', labelKey: (c) => `${c.emoji} ${c.name}` })}</select></label>
              <label class="field"><span>Biasa dibayar dari</span><select class="input" name="accountId"><option value="">— pilih saat bayar —</option>${options(accounts, b?.accountId, { valueKey: 'id', labelKey: (a) => `${fin.accountIcon(a)} ${a.name}` })}</select></label>
            </div>
            <label class="field"><span>Mulai ditagih (bulan)</span><input class="input" type="month" name="startMonth" value="${b?.startMonth || thisMonth()}" required /></label>
            <label class="field"><span>Catatan</span><input class="input" name="note" maxlength="80" placeholder="cth. ID pelanggan 1234…" value="${esc(b?.note || '')}" /></label>
            <button class="btn btn--primary btn--block" type="submit">💾 Simpan</button>
            ${b ? `<div class="row gap-sm">
              <button type="button" class="btn btn--soft grow" data-archive>${b.archived ? '📤 Aktifkan lagi' : '📦 Arsipkan'}</button>
              <button type="button" class="btn btn--danger-soft grow" data-del>🗑️ Hapus</button>
            </div>` : ''}
          </form>`,
      });
      const f = sheet.el.querySelector('[data-billform]');
      bindMoneyInput(f.amount);
      f.querySelectorAll('[data-icon]').forEach((x) =>
        x.addEventListener('click', () => {
          icon = x.dataset.icon;
          f.querySelectorAll('[data-icon]').forEach((y) => y.classList.toggle('on', y === x));
        })
      );
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          bill.saveBill({
            id: b?.id, icon, name: f.name.value, amount: parseNumber(f.amount.value), dueDay: f.dueDay.value,
            intervalMonths: f.intervalMonths.value, category: f.category.value, accountId: f.accountId.value,
            startMonth: f.startMonth.value, note: f.note.value, archived: b?.archived,
          });
          sheet.close();
          toast('💾 Tagihan disimpan');
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      f.querySelector('[data-archive]')?.addEventListener('click', () => {
        bill.setBillArchived(b.id, !b.archived);
        sheet.close();
        toast(b.archived ? 'Tagihan aktif lagi' : '📦 Tagihan diarsipkan');
        draw();
      });
      f.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmDialog(`Hapus tagihan "${b.name}"? Pengeluaran yang sudah dibayar tetap ada di Keuangan.`, { okText: 'Hapus', danger: true }))) return;
        bill.deleteBill(b.id);
        sheet.close();
        toast('Tagihan dihapus');
        draw();
      });
    };

    draw();
  },
};
