import type { CalibrationBucket, TrendPoint } from './scoring.ts';
import { escapeHtml } from './utils.ts';

/** Hand-rolled SVG charts — zero dependencies, theme-aware via CSS variables. */

export function calibrationChartSVG(buckets: CalibrationBucket[]): string {
  const W = 560;
  const H = 300;
  const padL = 44;
  const padB = 34;
  const padT = 14;
  const plotW = W - padL - 16;
  const plotH = H - padT - padB;
  const n = buckets.length;
  const groupW = plotW / n;
  const barW = Math.min(44, groupW * 0.34);

  const y = (v: number): number => padT + plotH * (1 - v);

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calibration chart: stated confidence versus actual hit rate" class="chart">`;
  // gridlines
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    s += `<line x1="${padL}" y1="${y(v)}" x2="${W - 16}" y2="${y(v)}" class="grid"/>`;
    s += `<text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end" class="axis">${Math.round(v * 100)}%</text>`;
  }
  // perfect-calibration diagonal
  s += `<line x1="${padL}" y1="${y(0)}" x2="${W - 16}" y2="${y(1)}" class="diagonal" stroke-dasharray="5 5"/>`;

  buckets.forEach((b, i) => {
    const cx = padL + groupW * i + groupW / 2;
    // expected marker: average stated confidence (hollow diamond)
    if (b.avgConfidence !== null) {
      const ey = y(b.avgConfidence);
      s += `<g class="expected" transform="translate(${cx.toFixed(1)},${ey.toFixed(1)})"><rect x="-5" y="-5" width="10" height="10" transform="rotate(45)" class="diamond"/></g>`;
    }
    // actual bar
    if (b.hitRate !== null) {
      const h = Math.max(3, plotH * b.hitRate);
      const over = b.avgConfidence !== null && b.avgConfidence - b.hitRate > 0.12;
      s += `<rect x="${(cx - barW / 2).toFixed(1)}" y="${(y(b.hitRate)).toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" rx="4" class="bar${over ? ' over' : ''}"/>`;
      s += `<text x="${cx.toFixed(1)}" y="${(y(b.hitRate) - 8).toFixed(1)}" text-anchor="middle" class="barval">${Math.round(b.hitRate * 100)}%</text>`;
      s += `<text x="${cx.toFixed(1)}" y="${(H - 18).toFixed(0)}" text-anchor="middle" class="axis">${escapeHtml(b.label)}</text>`;
      s += `<text x="${cx.toFixed(1)}" y="${(H - 6).toFixed(0)}" text-anchor="middle" class="axis dim">n=${b.n}</text>`;
    } else {
      s += `<text x="${cx.toFixed(1)}" y="${(padT + plotH / 2).toFixed(0)}" text-anchor="middle" class="axis dim">no data</text>`;
      s += `<text x="${cx.toFixed(1)}" y="${(H - 18).toFixed(0)}" text-anchor="middle" class="axis">${escapeHtml(b.label)}</text>`;
      s += `<text x="${cx.toFixed(1)}" y="${(H - 6).toFixed(0)}" text-anchor="middle" class="axis dim">n=0</text>`;
    }
  });
  s += '</svg>';
  return s;
}

export function trendChartSVG(points: TrendPoint[]): string {
  const W = 560;
  const H = 220;
  const padL = 44;
  const padB = 28;
  const padT = 16;
  const plotW = W - padL - 16;
  const plotH = H - padT - padB;
  if (points.length === 0) {
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="No resolved predictions yet" class="chart"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="axis dim">Resolve predictions to see your trend</text></svg>`;
  }
  const values = points.map((p) => p.cumulativeBrier);
  const max = Math.max(0.3, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const x = (i: number): number => (points.length === 1 ? padL + plotW / 2 : padL + (plotW * i) / (points.length - 1));
  const y = (v: number): number => padT + plotH * (1 - (v - min) / span);

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative Brier score trend" class="chart">`;
  for (const v of [0, 0.25, 0.5]) {
    if (v < min || v > max) continue;
    s += `<line x1="${padL}" y1="${y(v)}" x2="${W - 16}" y2="${y(v)}" class="grid"/>`;
    s += `<text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end" class="axis">${v.toFixed(2)}</text>`;
  }
  // baseline at 0.25
  if (0.25 >= min && 0.25 <= max) {
    s += `<line x1="${padL}" y1="${y(0.25)}" x2="${W - 16}" y2="${y(0.25)}" class="diagonal" stroke-dasharray="5 5"/>`;
    s += `<text x="${W - 20}" y="${y(0.25) - 6}" text-anchor="end" class="axis dim">coin-flip 0.25</text>`;
  }
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.cumulativeBrier).toFixed(1)}`).join(' ');
  const last = points[points.length - 1] as TrendPoint;
  s += `<path d="${path}" class="trend" fill="none"/>`;
  s += `<circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(last.cumulativeBrier).toFixed(1)}" r="4.5" class="trend-dot"><title>${escapeHtml(last.label)}: ${last.cumulativeBrier.toFixed(3)}</title></circle>`;
  s += `<text x="${padL}" y="${H - 8}" class="axis dim">first resolution → latest (${points.length})</text>`;
  s += '</svg>';
  return s;
}

/** Small inline confidence meter used on journal cards. */
export function confidenceMeter(confidence: number): string {
  const pct = Math.min(99, Math.max(1, confidence));
  return `<span class="meter" aria-label="Confidence ${pct} percent"><span class="meter-fill" style="width:${pct}%"></span></span>`;
}
