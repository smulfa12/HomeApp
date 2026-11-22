/**
 * 6. Budget + Realisasi Keuangan
 * Atur budget per kategori per bulan, bandingkan dengan pengeluaran nyata.
 */
import { pageHeader, esc, openSheet, bindMoneyInput, toast, emptyState } from '../../service/ui.service.js';
import { rupiah, thisMonth, monthLabel, addMonths, parseNumber } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';

function statusOf(pct) {
  if (pct > 100) return { cls: 'danger', label: 'Over budget' };
  if (pct >= 80) return { cls: 'warn', label: 'Hampir habis' };
  return { cls: 'ok', label: 'Aman' };
}

export default {
  path: '/finance/budget',
  title: 'Budget vs Actual',
  render(el, params) {
    let month = params.month || thisMonth();

    const draw = () => {
      const data = fin.budgetVsActual(month);
      const pctTotal = data.totalBudget ? Math.round((data.totalSpent / data.totalBudget) * 100) : 0;

      el.innerHTML = `
        ${pageHeader({ title: 'Budget vs Actual', subtitle: 'Rencana vs pengeluaran nyata', emoji: '🎯', tone: 'butter', back: '#/finance' })}

        <div class="month-switch">
          <button class="icon-btn" data-m="-1" aria-label="Bulan sebelumnya">‹</button>
          <strong>${monthLabel(month)}</strong>
          <button class="icon-btn" data-m="1" aria-label="Bulan berikutnya">›</button>
        </div>

        <section class="hero-num tone-butter">
          <span>Sisa budget</span>
          <strong>${rupiah(data.remaining)}</strong>
          <small>Terpakai ${rupiah(data.totalSpent)} dari ${rupiah(data.totalBudget)} (${pctTotal}%)</small>
          <div class="bar bar--light"><span style="width:${Math.min(pctTotal, 100)}%"></span></div>
        </section>

        <div class="row gap-sm">
          <button class="btn btn--primary grow" data-edit>✏️ Atur Budget</button>
          <button class="btn btn--soft grow" data-copy>📄 Salin bulan lalu</button>
        </div>
        <a class="link-card" href="#/finance/kategori?type=expense&from=budget">🗂️ Budget Categories (tambah / ubah / urutkan) <span>›</span></a>

        <section class="card">
          ${
            data.rows.length
              ? `<ul class="budget-list">
                  ${data.rows
                    .map((r) => {
                      const st = statusOf(r.pct);
                      return `
                    <li>
                      <div class="row between">
                        <strong>${fin.categoryEmoji('expense', r.category)} ${esc(r.category)}</strong>
                        <span class="badge badge--${st.cls}">${r.budget ? `${r.pct}%` : 'Tanpa budget'}</span>
                      </div>
                      <div class="bar bar--${st.cls}"><span style="width:${Math.min(r.pct, 100)}%"></span></div>
                      <div class="row between small muted">
                        <span>Realisasi ${rupiah(r.spent)}</span>
                        <span>Budget ${rupiah(r.budget)}</span>
                      </div>
                      <div class="small ${r.remaining < 0 ? 'text-rose' : 'text-mint'}">${r.remaining < 0 ? `Lebih ${rupiah(-r.remaining)}` : `Sisa ${rupiah(r.remaining)}`}</div>
                    </li>`;
                    })
                    .join('')}
                </ul>`
              : emptyState('🎯', 'Belum ada budget', 'Atur budget per kategori agar pengeluaran lebih terkontrol.')
          }
        </section>`;

      el.querySelectorAll('[data-m]').forEach((b) =>
        b.addEventListener('click', () => {
          month = addMonths(month, Number(b.dataset.m));
          draw();
        })
      );
      el.querySelector('[data-copy]').addEventListener('click', () => {
        const prev = addMonths(month, -1);
        if (!Object.keys(fin.getBudget(prev)).length) return toast(`Budget ${monthLabel(prev)} masih kosong`, 'warn');
        fin.copyBudget(prev, month);
        toast('📄 Budget bulan lalu disalin');
        draw();
      });
      el.querySelector('[data-edit]').addEventListener('click', openEditor);
    };

    const openEditor = () => {
      const plan = fin.getBudget(month);
      const sheet = openSheet({
        title: `Budget ${monthLabel(month)}`,
        body: `
          <form class="form" data-budget>
            ${fin.getCategories('expense').map(
              (c) => `
              <label class="budget-input">
                <span>${c.emoji} ${esc(c.name)}</span>
                <div class="money money--sm"><span>Rp</span><input name="${esc(c.name)}" inputmode="numeric" placeholder="0" value="${plan[c.name] || ''}" /></div>
              </label>`
            ).join('')}
            <button class="btn btn--primary btn--block" type="submit">💾 Simpan Budget</button>
          </form>`,
      });
      const form = sheet.el.querySelector('[data-budget]');
      form.querySelectorAll('input').forEach(bindMoneyInput);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        form.querySelectorAll('input').forEach((i) => fin.setBudget(month, i.name, parseNumber(i.value)));
        sheet.close();
        toast('✅ Budget tersimpan');
        draw();
      });
    };

    draw();
  },
};
