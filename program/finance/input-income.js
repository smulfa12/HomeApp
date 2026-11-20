/**
 * 1. Input Income (Pemasukan)
 */
import { pageHeader, esc } from '../../service/ui.service.js';
import { rupiah, dateLabel } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';
import { transactionFormHtml, bindTransactionForm } from '../shared/transaction-form.js';

export default {
  path: '/finance/income',
  title: 'Input Income',
  render(el) {
    const draw = () => {
      const recent = fin.listTransactions({ type: 'income' }).slice(0, 5);
      el.innerHTML = `
        ${pageHeader({ title: 'Input Income', subtitle: 'Catat setiap pemasukan keluarga', emoji: '💰', tone: 'mint', back: '#/finance' })}
        ${transactionFormHtml('income')}
        ${recent.length ? `
        <section class="card">
          <div class="card__head"><h2>Terakhir dicatat</h2><a class="link" href="#/finance/laporan-pemasukan">Lihat semua</a></div>
          <ul class="tx-list">
            ${recent.map((t) => `
              <li>
                <span class="tx-list__icon tone-mint">${fin.categoryEmoji('income', t.category)}</span>
                <div class="grow"><div class="tx-list__title">${esc(t.note || t.category)}</div><div class="muted small">${dateLabel(t.date)}</div></div>
                <div class="tx-list__amt text-mint">+${rupiah(t.amount)}</div>
              </li>`).join('')}
          </ul>
        </section>` : ''}`;
      bindTransactionForm(el, 'income', { onSaved: draw });
    };
    draw();
  },
};
