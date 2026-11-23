/**
 * Grafik SVG sederhana (tanpa library): batang & garis.
 * - Satu seri, warna aksen; grid & sumbu samar.
 * - Ketuk batang / titik → rincian tampil di panel bawah grafik (area sentuh lebih besar dari tandanya).
 */
import { esc } from '../../service/ui.service.js';

const H = 190;
const PAD = { top: 16, right: 10, bottom: 26, left: 46 };

/** Angka sumbu yang "rapi" (0, 50rb, 100rb, …). */
function niceTicks(min, max, count = 4) {
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** Label sumbu singkat: 1,2jt · 350rb · 9.500 */
export function axisLabel(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace('.', ',')}jt`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}rb`;
  return String(Math.round(v));
}

function frame(el, ticks, y, w) {
  return ticks
    .map((t) => `<line class="chart__grid" x1="${PAD.left}" x2="${w - PAD.right}" y1="${y(t)}" y2="${y(t)}"/>
      <text class="chart__axis" x="${PAD.left - 6}" y="${y(t) + 4}" text-anchor="end">${axisLabel(t)}</text>`)
    .join('');
}

/** Panel rincian di bawah grafik (tidak menutupi batang / titik). */
function tooltip(wrap, hint) {
  const tip = document.createElement('div');
  tip.className = 'chart__tip';
  tip.innerHTML = `<span class="muted">${esc(hint)}</span>`;
  wrap.appendChild(tip);
  return {
    show: (html) => (tip.innerHTML = html),
    hide: () => (tip.innerHTML = `<span class="muted">${esc(hint)}</span>`),
  };
}

/**
 * Grafik batang.
 * data: [{ label, value, tip }] · opts: { avg: true, ariaLabel }
 */
export function barChart(el, data, { avg = true, ariaLabel = 'Grafik batang' } = {}) {
  const w = Math.max(280, el.clientWidth || 320);
  const max = Math.max(...data.map((d) => d.value), 0);
  const ticks = niceTicks(0, max || 1);
  const top = ticks[ticks.length - 1];
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v) => PAD.top + plotH - (v / top) * plotH;
  const slot = (w - PAD.left - PAD.right) / data.length;
  const bw = Math.min(36, slot * 0.62);
  const cx = (i) => PAD.left + slot * i + slot / 2;
  const every = data.length > 8 ? 2 : 1;
  const nonZero = data.filter((d) => d.value > 0);
  const mean = nonZero.length ? nonZero.reduce((s, d) => s + d.value, 0) / nonZero.length : 0;

  const bars = data
    .map((d, i) => {
      if (d.value <= 0) return '';
      const x = cx(i) - bw / 2;
      const yy = y(d.value);
      const h = H - PAD.bottom - yy;
      const r = Math.min(4, h, bw / 2);
      // sudut membulat hanya di ujung atas, menempel ke garis dasar
      return `<path class="chart__bar" data-i="${i}" d="M${x},${H - PAD.bottom} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${H - PAD.bottom} Z"/>`;
    })
    .join('');
  const labels = data
    .map((d, i) => (i % every === (data.length - 1) % every ? `<text class="chart__axis" x="${cx(i)}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>` : ''))
    .join('');
  const hits = data.map((d, i) => `<rect class="chart__hit" data-i="${i}" x="${PAD.left + slot * i}" y="${PAD.top}" width="${slot}" height="${plotH}"/>`).join('');
  const avgLine =
    avg && mean > 0 && nonZero.length > 1
      ? `<line class="chart__avg" x1="${PAD.left}" x2="${w - PAD.right}" y1="${y(mean)}" y2="${y(mean)}"/>
         <text class="chart__avg-label" x="${w - PAD.right}" y="${y(mean) - 5}" text-anchor="end">rata² ${axisLabel(mean)}</text>`
      : '';

  el.innerHTML = `<div class="chart"><svg width="${w}" height="${H}" role="img" aria-label="${esc(ariaLabel)}">
    ${frame(el, ticks, y, w)}
    <line class="chart__base" x1="${PAD.left}" x2="${w - PAD.right}" y1="${H - PAD.bottom}" y2="${H - PAD.bottom}"/>
    ${bars}${avgLine}${labels}${hits}</svg></div>`;

  const wrap = el.querySelector('.chart');
  const tip = tooltip(wrap, 'Ketuk batang untuk melihat rinciannya');
  let active = -1;
  const select = (i) => {
    active = i === active ? -1 : i;
    wrap.querySelectorAll('.chart__bar').forEach((b) => b.classList.toggle('is-dim', active >= 0 && Number(b.dataset.i) !== active));
    active >= 0 ? tip.show(data[active].tip) : tip.hide();
  };
  wrap.querySelectorAll('.chart__hit').forEach((r) => r.addEventListener('click', () => select(Number(r.dataset.i))));
  return { select };
}

/**
 * Grafik garis waktu.
 * points: [{ date:'YYYY-MM-DD', value, tip }] (urut tanggal) · opts: { ariaLabel }
 */
export function lineChart(el, points, { ariaLabel = 'Grafik garis' } = {}) {
  const w = Math.max(280, el.clientWidth || 320);
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const spread = hi - lo || hi * 0.1 || 1;
  const ticks = niceTicks(Math.max(0, lo - spread * 0.25), hi + spread * 0.25);
  const t0 = ticks[0];
  const t1 = ticks[ticks.length - 1];
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v) => PAD.top + plotH - ((v - t0) / (t1 - t0)) * plotH;
  const time = (p) => new Date(p.date + 'T00:00:00').getTime();
  const x0 = time(points[0]);
  const x1 = time(points[points.length - 1]);
  const inner = w - PAD.left - PAD.right - 16;
  const x = (p) => (x1 === x0 ? PAD.left + 8 + inner / 2 : PAD.left + 8 + ((time(p) - x0) / (x1 - x0)) * inner);

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const dots = points.map((p, i) => `<circle class="chart__dot" data-i="${i}" cx="${x(p)}" cy="${y(p.value)}" r="4.5"/>`).join('');
  const short = (d) => {
    const [, m, dd] = d.split('-').map(Number);
    return `${dd}/${m}`;
  };
  const xLabels = (points.length > 1 ? [points[0], points[points.length - 1]] : [points[0]])
    .map((p, i, a) => `<text class="chart__axis" x="${x(p)}" y="${H - 8}" text-anchor="${a.length > 1 ? (i ? 'end' : 'start') : 'middle'}">${short(p.date)}</text>`)
    .join('');

  el.innerHTML = `<div class="chart"><svg width="${w}" height="${H}" role="img" aria-label="${esc(ariaLabel)}">
    ${frame(el, ticks, y, w)}
    <line class="chart__cross hidden" y1="${PAD.top}" y2="${H - PAD.bottom}"/>
    ${points.length > 1 ? `<path class="chart__line" d="${path}"/>` : ''}
    ${dots}${xLabels}
    <rect class="chart__hit" x="${PAD.left}" y="${PAD.top}" width="${w - PAD.left - PAD.right}" height="${plotH}"/></svg></div>`;

  const wrap = el.querySelector('.chart');
  const svg = wrap.querySelector('svg');
  const cross = wrap.querySelector('.chart__cross');
  const tip = tooltip(wrap, 'Ketuk grafik untuk melihat harga');
  const select = (i) => {
    const p = points[i];
    cross.setAttribute('x1', x(p));
    cross.setAttribute('x2', x(p));
    cross.classList.remove('hidden');
    wrap.querySelectorAll('.chart__dot').forEach((d) => d.classList.toggle('is-on', Number(d.dataset.i) === i));
    tip.show(p.tip);
  };
  // titik terdekat dari posisi jari
  const nearest = (evt) => {
    const px = evt.clientX - svg.getBoundingClientRect().left;
    let best = 0;
    points.forEach((p, i) => Math.abs(x(p) - px) < Math.abs(x(points[best]) - px) && (best = i));
    select(best);
  };
  wrap.querySelector('.chart__hit').addEventListener('click', nearest);
  wrap.querySelector('.chart__hit').addEventListener('pointermove', (e) => e.pointerType === 'mouse' && nearest(e));
  select(points.length - 1);
}
