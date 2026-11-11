// Time Machine chart: how many negative accounts stay on file, month by month.
// Zero dependencies — one <canvas>. Techniques re-implemented from open-source charting libraries:
//   d3-array ticks (ISC)                        — "nice" steps: 1, 2 or 5 × 10^n
//   uPlot stepped paths (MIT)                   — step-after path; area = stroke path closed to the baseline; devicePixelRatio canvas
//   TradingView lightweight-charts (Apache-2.0) — pixel-snapped crosshair, magnet to the nearest series,
//                                                 3-stage "last value" pulse, arrow markers
//   Apache ECharts markArea (Apache-2.0)        — a shaded band behind the series

const MONO = getComputedStyle(document.documentElement).getPropertyValue('--mono').trim() || 'ui-monospace, monospace';
const PAD_X = 10; // half the slider thumb, so month m sits exactly under the thumb at m
const PAD_T = 13, PAD_B = 3;
const TAU = Math.PI * 2;

// lightweight-charts last-price animation: one 2600 ms period split into grow / fade / rest.
const PULSE_MS = 2600;
const PULSE = [
  { end: 0.25, r: [4, 10], fill: [0.25, 0], stroke: [0.4, 0.8] },
  { end: 0.525, r: [10, 14], fill: [0, 0], stroke: [0.8, 0] },
];
const PULSE_SCALE = 0.75; // the dock chart is short; the library's radii assume a full pane

const lerp = (a, b, k) => a + (b - a) * k;
const rgba = (rgb, a) => `rgba(${rgb},${a})`;

// d3-array tickIncrement: the step closest to (stop - start) / count, snapped to 1/2/5 × 10^n.
export function niceStep(start, stop, count) {
  const step = (stop - start) / Math.max(1, count);
  const power = Math.floor(Math.log10(step));
  const error = step / 10 ** power;
  const factor = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
  return factor * 10 ** power;
}

export class TimeChart {
  // series: [{ label, rgb: 'r,g,b', values: [one per month from start..end], fill?, dash? }]
  // markers: [{ mi, names: [] }] · band: { from, to } | null
  constructor(canvas, { onScrub, onHover } = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.onScrub = onScrub;
    this.onHover = onHover;
    this.d = null;
    this.t = 0;
    this.hover = null;
    this.w = this.h = 0;
    this.dpr = 1;
    this.raf = 0;
    this.motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    new ResizeObserver(() => this.resize()).observe(canvas);
    document.addEventListener('visibilitychange', () => this.loop());

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      canvas.setPointerCapture(e.pointerId);
      this.dragging = true;
      this.onScrub?.(this.miAt(e.offsetX));
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.dragging) this.onScrub?.(this.miAt(e.offsetX));
      this.hoverAt(e.offsetX, e.offsetY);
    });
    const up = () => { this.dragging = false; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', () => {
      if (this.dragging) return;
      this.hover = null;
      this.onHover?.(null);
      this.draw();
    });
  }

  setData(d) {
    this.d = d;
    const max = Math.max(1, ...d.series.flatMap((s) => s.values));
    const step = Math.max(1, niceStep(0, max, 2)); // counts are whole accounts
    this.yMax = Math.ceil(max / step) * step;
    this.ticks = [];
    for (let v = step; v <= this.yMax; v += step) this.ticks.push(v);
    if (this.hover) this.hover = this.pick(this.hover.mi, this.hover.py);
    this.draw();
  }

  setTime(mi) { this.t = mi; this.draw(); }

  resize() {
    // Layout size, not getBoundingClientRect(): the dock can be mid-transform when it appears.
    this.dpr = window.devicePixelRatio || 1;
    this.w = this.cv.clientWidth;
    this.h = this.cv.clientHeight;
    // uPlot: back the canvas with device pixels, draw in CSS pixels.
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.draw();
    this.loop();
  }

  // ---------------------------------------------------------------- scales
  x(mi) { return PAD_X + ((mi - this.d.start) / (this.d.end - this.d.start)) * (this.w - 2 * PAD_X); }
  y(v) { return this.h - PAD_B - (v / this.yMax) * (this.h - PAD_T - PAD_B); }
  miAt(px) {
    const { start, end } = this.d;
    const k = (px - PAD_X) / (this.w - 2 * PAD_X);
    return Math.max(start, Math.min(end, Math.round(start + k * (end - start))));
  }
  val(s, mi) { return s.values[Math.max(0, Math.min(s.values.length - 1, mi - this.d.start))]; }

  // lightweight-charts magnet: snap to the month, then to whichever series value is closest to the pointer.
  pick(mi, py) {
    const snap = this.d.series
      .map((s, i) => ({ i, v: this.val(s, mi), dy: Math.abs(this.y(this.val(s, mi)) - py) }))
      .sort((a, b) => a.dy - b.dy || a.i - b.i)[0];
    return { mi, py, series: snap.i, value: snap.v };
  }
  hoverAt(px, py) {
    if (!this.d) return;
    const mi = this.miAt(px);
    this.hover = this.pick(mi, py);
    this.onHover?.({ ...this.hover, x: this.x(mi) });
    this.draw();
  }

  // ---------------------------------------------------------------- drawing
  loop() {
    if (this.raf || !this.motion) return;
    const tick = (now) => {
      this.raf = 0;
      if (document.hidden || !this.w || !this.cv.isConnected) return; // resize()/visibilitychange restart it
      this.draw(now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  // lightweight-charts crosshair: whole device pixels, +0.5 for odd widths, so 1px lines stay sharp.
  crisp(x0, y0, x1, y1, color, dash) {
    const { ctx, dpr } = this;
    const lw = Math.max(1, Math.floor(dpr));
    const off = lw % 2 ? 0.5 : 0;
    const vertical = x0 === x1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    ctx.setLineDash(dash ? dash.map((v) => v * dpr) : []);
    ctx.beginPath();
    if (vertical) {
      const X = Math.round(x0 * dpr) + off;
      ctx.moveTo(X, y0 * dpr); ctx.lineTo(X, y1 * dpr);
    } else {
      const Y = Math.round(y0 * dpr) + off;
      ctx.moveTo(x0 * dpr, Y); ctx.lineTo(x1 * dpr, Y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // uPlot stepped (align = 1): hold each value until the next month, then drop straight down.
  stepPath(values) {
    const path = new Path2D();
    let py = this.y(values[0]);
    path.moveTo(this.x(this.d.start), py);
    for (let i = 1; i < values.length; i++) {
      if (values[i] === values[i - 1]) continue;
      const x1 = this.x(this.d.start + i), y1 = this.y(values[i]);
      path.lineTo(x1, py);
      path.lineTo(x1, y1);
      py = y1;
    }
    path.lineTo(this.x(this.d.end), py);
    return path;
  }

  draw(now = performance.now()) {
    const { ctx, d } = this;
    if (!d || !this.w || !this.h) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const top = PAD_T, base = this.y(0), left = this.x(d.start), right = this.x(d.end);

    // ECharts markArea: the dispute window, where the best case can drop.
    if (d.band && d.band.to > d.band.from) {
      const x0 = this.x(d.band.from), x1 = this.x(Math.min(d.end, d.band.to));
      ctx.fillStyle = 'rgba(94,234,212,.08)';
      ctx.fillRect(x0, top - 4, x1 - x0, base - top + 4);
    }

    // d3 nice ticks: faint grid + labels. Like lightweight-charts' price axis, a label that
    // would sit under the live point (now at the left edge) is hidden rather than overlapped.
    const nowX = this.x(this.t), nowY = this.y(this.val(d.series[0], this.t));
    ctx.font = `600 9px ${MONO}`;
    ctx.textBaseline = 'middle';
    for (const v of this.ticks) {
      const yy = this.y(v);
      this.crisp(left, yy, right, yy, 'rgba(255,255,255,.07)', [2, 3]);
      const label = String(v);
      if (nowX - 8 < 1 + ctx.measureText(label).width && Math.abs(nowY - yy) < 11) continue;
      ctx.fillStyle = 'rgba(143,152,187,.85)';
      ctx.textAlign = 'left';
      ctx.fillText(label, 1, yy);
    }
    this.crisp(left, base, right, base, 'rgba(255,255,255,.12)');

    // Series — area first so both lines stay on top.
    const paths = d.series.map((s) => this.stepPath(s.values));
    d.series.forEach((s, i) => {
      if (!s.fill) return;
      const area = new Path2D(paths[i]); // uPlot: fill = copy of the stroke, closed to the baseline
      area.lineTo(right, base);
      area.lineTo(left, base);
      area.closePath();
      const g = ctx.createLinearGradient(0, top, 0, base);
      g.addColorStop(0, rgba(s.rgb, 0.38));
      g.addColorStop(1, rgba(s.rgb, 0.02));
      ctx.fillStyle = g;
      ctx.fill(area);
    });
    ctx.lineJoin = 'round';
    for (let i = d.series.length - 1; i >= 0; i--) {
      const s = d.series[i];
      ctx.setLineDash(s.dash || []);
      ctx.lineWidth = s.width || 1.5;
      ctx.strokeStyle = rgba(s.rgb, 1);
      ctx.shadowColor = rgba(s.rgb, 0.6);
      ctx.shadowBlur = s.fill ? 6 : 0;
      ctx.stroke(paths[i]);
    }
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // lightweight-charts arrowDown markers: where accounts age off (7 years after first delinquency).
    const main = d.series[0];
    for (const m of d.markers) {
      const xm = this.x(m.mi), ym = this.y(this.val(main, m.mi - 1)) - 3;
      const s = m.names.length > 1 ? 4.5 : 3.5;
      ctx.beginPath();
      ctx.moveTo(xm - s, ym - s * 1.4);
      ctx.lineTo(xm + s, ym - s * 1.4);
      ctx.lineTo(xm, ym);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Legend, top right — short labels when the long ones would run past the y labels.
    ctx.font = `600 9px ${MONO}`;
    ctx.textAlign = 'right';
    const fits = d.series.reduce((w, s) => w + ctx.measureText(s.label).width + 26, 0) < right - left - 24;
    let lx = right;
    for (let i = d.series.length - 1; i >= 0; i--) {
      const s = d.series[i];
      const text = fits ? s.label : s.short || s.label;
      ctx.fillStyle = 'rgba(170,180,212,.9)';
      ctx.fillText(text, lx, 5);
      lx -= ctx.measureText(text).width + 4;
      ctx.setLineDash(s.dash || []);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgba(s.rgb, 1);
      ctx.beginPath(); ctx.moveTo(lx - 12, 5); ctx.lineTo(lx, 5); ctx.stroke();
      ctx.setLineDash([]);
      lx -= 22;
    }

    // Hover crosshair (dashed) with the magnet dot.
    const h = this.hover;
    if (h && !this.dragging) {
      const hx = this.x(h.mi), hy = this.y(h.value);
      this.crisp(hx, top - 4, hx, base, 'rgba(255,255,255,.35)', [3, 3]);
      this.crisp(left, hy, right, hy, 'rgba(255,255,255,.18)', [3, 3]);
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, TAU);
      ctx.fillStyle = rgba(d.series[h.series].rgb, 1);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.fill(); ctx.stroke();
    }

    // "Now" on the time machine: solid crosshair + pulsing point + value pill.
    const tx = this.x(this.t), tv = this.val(main, this.t), ty = this.y(tv);
    this.crisp(tx, top - 4, tx, base, 'rgba(255,255,255,.6)');
    if (this.motion) {
      const k = (now % PULSE_MS) / PULSE_MS;
      let from = 0;
      for (const st of PULSE) {
        if (k < st.end) {
          const q = (k - from) / (st.end - from);
          ctx.beginPath();
          ctx.arc(tx, ty, lerp(st.r[0], st.r[1], q) * PULSE_SCALE, 0, TAU);
          ctx.fillStyle = rgba(main.rgb, lerp(st.fill[0], st.fill[1], q));
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = rgba(main.rgb, lerp(st.stroke[0], st.stroke[1], q));
          ctx.stroke();
          break;
        }
        from = st.end;
      }
    }
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(2, (main.width || 1.5) * 1.5), 0, TAU); // lightweight-charts center dot
    ctx.fillStyle = rgba(main.rgb, 1);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    const label = String(tv);
    ctx.font = `700 9.5px ${MONO}`;
    const tw = ctx.measureText(label).width + 8;
    const flip = tx + 8 + tw > right;
    const px = flip ? tx - 8 - tw : tx + 8;
    const py = Math.max(top - 4, Math.min(base - 13, ty - 6.5));
    ctx.fillStyle = rgba(main.rgb, 0.92);
    ctx.beginPath();
    ctx.roundRect(px, py, tw, 13, 6.5);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, px + tw / 2, py + 7);
  }
}
