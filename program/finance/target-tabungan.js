/**
 * Target Tabungan
 * Target nabung (dana darurat, rumah, sekolah, …) yang dikaitkan ke satu
 * atau lebih rekening. Progres = jumlah saldo rekening-rekening tersebut.
 */
import { pageHeader, esc, openSheet, bindMoneyInput, toast, confirmDialog, emptyState, celebrate } from '../../service/ui.service.js';
import { rupiah, rupiahShort, parseNumber, monthLabel, thisMonth } from '../../service/format.service.js';
import * as fin from '../../service/finance.service.js';

const monthOf = (iso) => (iso ? monthLabel(iso.slice(0, 7)) : '');

function progressTone(p) {
  if (p.done) return 'ok';
  if (p.onTrack === false) return 'warn';
  return 'goal';
}

function goalCard(g) {
  const p = fin.goalProgress(g);
  const tone = progressTone(p);
  const accounts = p.parts
    .map(
      (x) => `<span class="goal-acc ${x.shared.length ? 'goal-acc--shared' : ''}" title="${x.shared.length ? `Juga dipakai: ${esc(x.shared.map((s) => s.name).join(', '))}` : ''}">
        ${fin.accountIcon(x.account)} ${esc(x.account.name)} <b>${rupiahShort(x.balance)}</b>${x.shared.length ? ' ⚠️' : ''}</span>`
    )
    .join('');

  let plan = '';
  if (p.done) plan = `<p class="goal-line goal-line--ok">🎉 Target tercapai! Lebih ${rupiah(p.saved - p.target)}</p>`;
  else {
    if (g.deadline) {
      plan += `<p class="goal-line">📅 Tenggat ${monthOf(g.deadline)} · ${
        p.monthsLeft > 0 ? `perlu nabung <b>${rupiah(p.monthlyNeeded)}/bulan</b>` : '<b>tenggat sudah lewat</b>'
      }</p>`;
    }
    plan += p.monthlyPace > 0
      ? `<p class="goal-line">📈 Rata-rata naik ${rupiah(p.monthlyPace)}/bulan → perkiraan tercapai <b>${monthOf(p.eta)}</b> ${p.onTrack === true ? '✅' : p.onTrack === false ? '⚠️ terlambat dari tenggat' : ''}</p>`
      : `<p class="goal-line muted">📈 Saldo belum bertambah dalam 3 bulan terakhir</p>`;
  }

  return `
    <article class="goal ${g.archived ? 'goal--archived' : ''}" data-goal="${g.id}">
      <div class="goal__head" data-edit="${g.id}" role="button" tabindex="0">
        <span class="goal__icon">${esc(g.icon || '🐷')}</span>
        <div class="grow">
          <h3>${esc(g.name)}</h3>
          <p class="muted small">${rupiah(p.saved)} dari ${rupiah(p.target)}</p>
        </div>
        <strong class="goal__pct goal__pct--${tone}">${p.pct}%</strong>
      </div>
      <div class="goal-bar goal-bar--${tone}">
        <span style="width:${Math.min(p.pct, 100)}%"></span>
        ${fin.GOAL_MILESTONES.slice(0, 3).map((m) => `<i style="left:${m}%"></i>`).join('')}
      </div>
      ${p.done ? '' : `<p class="goal-line"><b>Kurang ${rupiah(p.remaining)}</b></p>`}
      ${plan}
      <div class="goal-accs">${accounts || '<span class="muted small">Belum ada rekening terkait</span>'}</div>
      ${g.note ? `<p class="muted small">📝 ${esc(g.note)}</p>` : ''}
      ${!p.done && !g.archived && p.parts[0] ? `<a class="btn btn--soft btn--sm goal__add" href="#/finance/transfer?to=${p.parts[0].account.id}">➕ Tambah tabungan</a>` : ''}
    </article>`;
}

export default {
  path: '/finance/target',
  title: 'Target Tabungan',
  render(el) {
    const draw = () => {
      const active = fin.listGoals();
      const archived = fin.listGoals({ includeArchived: true }).filter((g) => g.archived);
      const done = active.filter((g) => fin.goalProgress(g).done).length;

      el.innerHTML = `
        ${pageHeader({ title: 'Target Tabungan', subtitle: active.length ? `${active.length} target · ${done} tercapai` : 'Nabung untuk tujuan keluarga', emoji: '🐷', tone: 'rose', back: '#/finance' })}

        <button class="btn btn--primary btn--block" data-add>➕ Target Baru</button>

        ${active.length ? active.map(goalCard).join('') : `<div class="card">${emptyState('🐷', 'Belum ada target', 'Contoh: Dana Darurat Rp 30 juta di BCA Tabungan + Deposito.')}</div>`}

        ${archived.length ? `
        <details class="card archived-box">
          <summary>🗄️ Diarsipkan (${archived.length})</summary>
          ${archived.map(goalCard).join('')}
        </details>` : ''}`;

      el.querySelector('[data-add]').addEventListener('click', () => edit({}));
      el.querySelectorAll('[data-edit]').forEach((h) => {
        const open = () => edit(fin.getGoal(h.dataset.edit));
        h.addEventListener('click', open);
        h.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open()));
      });

      // Rayakan milestone baru (25/50/75/100%) — sekali per milestone
      for (const g of active) {
        const m = fin.checkMilestone(g);
        if (m) {
          celebrate(m === 100 ? `🎉 ${g.name} TERCAPAI!` : `🎉 ${g.name} sudah ${m}%!`);
          break;
        }
      }
    };

    const edit = (goal) => {
      const isNew = !goal.id;
      const assets = fin.listAccounts('asset');
      let icon = goal.icon || '🛟';
      const selected = new Set(goal.accountIds || []);
      const tip = fin.suggestEmergencyFund();

      const sheet = openSheet({
        title: isNew ? 'Target Baru' : `Edit ${goal.name}`,
        body: `
          <form class="form" data-goal-form autocomplete="off">
            <label class="field"><span>Nama target *</span>
              <input class="input" name="name" required maxlength="40" value="${esc(goal.name || '')}" placeholder="cth. Dana Darurat, DP Rumah, Umroh" />
            </label>

            <div class="field"><span>Ikon</span>
              <div class="icon-pick">
                ${fin.GOAL_ICONS.map((i) => `<button type="button" class="icon-pick__item ${i === icon ? 'on' : ''}" data-icon="${i}" aria-label="Ikon ${i}">${i}</button>`).join('')}
              </div>
            </div>

            <label class="field"><span>Nominal target *</span>
              <div class="money tone-rose"><span>Rp</span><input name="target" inputmode="numeric" required placeholder="0"
                value="${goal.targetAmount ? Number(goal.targetAmount).toLocaleString('id-ID') : ''}" /></div>
            </label>
            ${tip ? `<button type="button" class="tip-btn" data-tip>💡 Saran dana darurat: <b>${rupiah(tip.suggested)}</b><br/><small>6 × rata-rata pengeluaran ${rupiah(tip.monthly)}/bulan</small></button>` : ''}

            <div class="field"><span>Disimpan di (boleh lebih dari 1) *</span>
              ${assets.length ? `<div class="acc-check">
                ${assets
                  .map((a) => {
                    const shared = fin.goalsUsingAccount(a.id, goal.id);
                    return `
                  <label class="acc-check__row">
                    <input type="checkbox" value="${a.id}" ${selected.has(a.id) ? 'checked' : ''} data-acc />
                    <span class="acc-check__box"></span>
                    <span class="acc-check__icon">${fin.accountIcon(a)}</span>
                    <span class="grow">${esc(a.name)}${shared.length ? `<small class="acc-check__warn">⚠️ juga dipakai: ${esc(shared.map((s) => s.name).join(', '))}</small>` : ''}</span>
                    <b>${rupiahShort(fin.accountBalance(a))}</b>
                  </label>`;
                  })
                  .join('')}
              </div>` : `<p class="muted small">Belum ada rekening. <a class="link" href="#/finance/akun">Tambah dulu</a></p>`}
              <p class="muted small" data-sum></p>
            </div>

            <label class="field"><span>Tenggat (opsional)</span>
              <input class="input" type="month" name="deadline" min="${thisMonth()}" value="${goal.deadline ? goal.deadline.slice(0, 7) : ''}" />
            </label>

            <label class="field"><span>Catatan</span>
              <input class="input" name="note" maxlength="80" value="${esc(goal.note || '')}" placeholder="opsional" />
            </label>

            <button class="btn btn--primary btn--block" type="submit">💾 Simpan Target</button>
            ${isNew ? '' : `
              <button class="btn btn--soft btn--block" type="button" data-archive>${goal.archived ? '♻️ Aktifkan lagi' : '🗄️ Arsipkan'}</button>
              <button class="btn btn--danger-soft btn--block" type="button" data-del>🗑️ Hapus Target</button>`}
          </form>`,
      });

      const form = sheet.el.querySelector('[data-goal-form]');
      bindMoneyInput(form.target);

      const updateSum = () => {
        const ids = [...form.querySelectorAll('[data-acc]:checked')].map((c) => c.value);
        const sum = ids.reduce((s, id) => s + fin.accountBalance(fin.getAccount(id)), 0);
        const target = parseNumber(form.target.value);
        form.querySelector('[data-sum]').innerHTML = ids.length
          ? `Terkumpul saat ini <b>${rupiah(sum)}</b>${target ? ` (${Math.round((sum / target) * 100)}%)` : ''}`
          : '';
      };
      form.querySelectorAll('[data-acc]').forEach((c) => c.addEventListener('change', updateSum));
      form.target.addEventListener('input', updateSum);
      updateSum();

      form.querySelectorAll('[data-icon]').forEach((b) =>
        b.addEventListener('click', () => {
          icon = b.dataset.icon;
          form.querySelectorAll('[data-icon]').forEach((x) => x.classList.toggle('on', x === b));
        })
      );
      form.querySelector('[data-tip]')?.addEventListener('click', () => {
        form.target.value = tip.suggested.toLocaleString('id-ID');
        if (!form.name.value) form.name.value = 'Dana Darurat';
        updateSum();
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          fin.saveGoal({
            id: goal.id,
            name: form.name.value,
            icon,
            targetAmount: parseNumber(form.target.value),
            accountIds: [...form.querySelectorAll('[data-acc]:checked')].map((c) => c.value),
            deadline: form.deadline.value ? `${form.deadline.value}-01` : '',
            note: form.note.value,
            archived: goal.archived || false,
          });
          sheet.close();
          toast('✅ Target tersimpan');
          draw();
        } catch (err) {
          toast(err.message, 'error');
        }
      });

      sheet.el.querySelector('[data-archive]')?.addEventListener('click', () => {
        fin.setGoalArchived(goal.id, !goal.archived);
        sheet.close();
        toast(goal.archived ? '♻️ Target aktif lagi' : '🗄️ Target diarsipkan');
        draw();
      });
      sheet.el.querySelector('[data-del]')?.addEventListener('click', async () => {
        sheet.close();
        if (await confirmDialog(`Hapus target "${goal.name}"? Saldo rekening tidak berubah.`, { okText: 'Hapus', danger: true })) {
          fin.deleteGoal(goal.id);
          toast('Target dihapus');
          draw();
        }
      });
    };

    draw();
  },
};
