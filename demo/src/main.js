import { analyze, B, BUREAU, money, fmtMi, mi, REPORT_MI } from './engine.js';
import { Orrery, displayName } from './scene.js';
import { Sanctuary, ZODIAC } from './sanctuary.js';
import { diffReports } from './importer.js';
import { parseIdentityIQ, ReportError } from './parser.js';
import { plan } from './planner.js';
import { sfx, setSound, ascensionScore } from './sound.js';
import { TimeChart } from './timechart.js';
import { PLAYBOOK, PLAYBOOK_REVIEWED, PLAYBOOK_REVIEW_NOTE, SOURCES, BUREAU_ADDRESSES, ADDRESS_NOTE, LETTER_HEADER, CREDITOR_HEADER, LETTER_FOOTER } from '../data/legal.js';
import { DEMO_REPORT } from '../data/demo.js';

// ------------------------------------------------------------------ state
// Everything lives in this browser's localStorage: the parsed report and the
// user's progress. Nothing is uploaded anywhere.
const KEY = 'creditos.public.v1';
const REPORT_KEY = 'creditos.public.report.v1';
const state = (() => {
  const base = { disputes: {}, quick: {}, sound: true, booted: false };
  try { return { ...base, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { return base; }
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } };

// ------------------------------------------------------------------ welcome
// DEMO is stored as a marker, so it always matches the current code.
function storedReport() {
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    if (raw === 'DEMO') return DEMO_REPORT;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function currentSource() {
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    if (raw === 'DEMO') return 'DEMO';
    return raw ? 'USER' : 'NONE';
  } catch { return 'NONE'; }
}
// ------------------------------------------------------------------ consent
// One-time acknowledgement before any report is read. Kept in its own key so the
// user's saved progress is never touched. Bump the version when the terms change.
const CONSENT_KEY = 'creditos.public.consent.v1';
function consent() {
  try { if (localStorage.getItem(CONSENT_KEY)) return Promise.resolve(); } catch { /* private mode: ask every visit */ }
  const el = document.getElementById('consent');
  el.hidden = false;
  const boxes = [...el.querySelectorAll('input[type=checkbox]')];
  const go = el.querySelector('#consent-go');
  const sync = () => { go.disabled = !boxes.every((b) => b.checked); };
  boxes.forEach((b) => b.addEventListener('change', sync));
  sync();
  return new Promise((resolve) => {
    go.addEventListener('click', () => {
      try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: 1, at: new Date().toISOString() })); } catch { /* ok */ }
      el.hidden = true;
      resolve();
    });
  });
}
await consent();
function welcome() {
  const el = document.getElementById('welcome');
  el.hidden = false;
  const err = el.querySelector('#welcome-error');
  const busy = (on) => el.classList.toggle('busy', on);
  return new Promise((resolve) => {
    const done = (report, stored) => {
      try { localStorage.setItem(REPORT_KEY, stored); }
      catch { err.textContent = 'This browser would not save the report (private mode?). It will work until you close the tab.'; }
      el.classList.add('leaving');
      setTimeout(() => { el.hidden = true; }, 400);
      resolve(report);
    };
    const read = async (file) => {
      if (!file) return;
      err.textContent = '';
      if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') {
        err.textContent = `“${file.name}” is not a web page. Save the report as .html (see step 2) and try again.`;
        return;
      }
      busy(true);
      await new Promise((r) => setTimeout(r, 30)); // let the spinner paint before the parse blocks
      try {
        const report = parseIdentityIQ(await file.text());
        done(report, JSON.stringify(report));
      } catch (e) {
        err.textContent = e instanceof ReportError ? e.message : 'Something went wrong reading that file. Make sure it is the full 3-bureau report page.';
        if (!(e instanceof ReportError)) console.error(e);
      } finally { busy(false); }
    };
    el.querySelector('#welcome-file').addEventListener('change', (e) => read(e.target.files[0]));
    el.querySelector('#welcome-demo').addEventListener('click', () => done(DEMO_REPORT, 'DEMO'));
    const drop = el.querySelector('#welcome-drop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); read(e.dataTransfer.files[0]); });
  });
}
// Hosted investor demo: always the fictional demo report, no uploads.
try { localStorage.setItem(REPORT_KEY, 'DEMO'); } catch { /* private mode */ }
void storedReport; void welcome;
const report = DEMO_REPORT;

// Progress belongs to one report: a different file starts a fresh plan.
const reportSig = `${report.meta.reference}|${report.meta.reportDate}`;
if (state.reportSig !== reportSig) {
  Object.assign(state, { reportSig, disputes: {}, quick: {}, lastImport: null });
  save();
}

const model = analyze(report);
const { DISPUTES, ROUNDS, QUICK_WINS } = plan(report, model);
const personalDispute = DISPUTES.find((d) => d.personal) || null;
const byKey = new Map(model.accounts.map((a) => [a.key, a]));
const disputeFor = new Map(DISPUTES.filter((d) => d.account).map((d) => [d.account, d]));
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STATUS = [['todo', 'To do'], ['mailed', 'Mailed'], ['deleted', 'Deleted'], ['corrected', 'Fixed'], ['verified', 'Verified']];
const statusOf = (id, b) => state.disputes[id]?.[b] ?? { s: 'todo' };
const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD (not UTC)
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
setSound(state.sound);

// ------------------------------------------------------------------ scene
const orrery = new Orrery({
  canvas: $('#scene'),
  labelHost: $('#labels'),
  model,
  hooks: {
    onSelect: (key) => { if (key) { sfx.select(); openInspector(key); } else if (current) closeInspector(); },
    onHover: (key) => { if (key) sfx.hover(); },
    onShatter: (key, b) => {
      sfx.win();
      toast(`✦ ${displayName(byKey.get(key))} marked deleted at ${BUREAU[b].name} (your status)`, 'win');
    },
    onHealth: (h) => renderHealth(h),
  },
});
window.__orrery = orrery; // debug handle for console inspection

// ------------------------------------------------------------------ dials
function gauge(score, color) {
  const a0 = -210, a1 = 30, t = (score - 300) / 550;
  const pt = (deg, r = 34) => [43 + r * Math.cos((deg * Math.PI) / 180), 42 + r * Math.sin((deg * Math.PI) / 180)];
  const arc = (from, to) => {
    const [x0, y0] = pt(from), [x1, y1] = pt(to);
    return `M${x0},${y0} A34,34 0 ${to - from > 180 ? 1 : 0} 1 ${x1},${y1}`;
  };
  const end = a0 + (a1 - a0) * t;
  const [kx, ky] = pt(end);
  return `<svg viewBox="0 0 86 70"><defs><linearGradient id="g-${color}" x1="0" x2="1"><stop offset="0" stop-color="#ff2d55"/><stop offset=".55" stop-color="#ffd479"/><stop offset="1" stop-color="${color}"/></linearGradient></defs>
    <path d="${arc(a0, a1)}" stroke="rgba(255,255,255,.09)" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="${arc(a0, end)}" stroke="url(#g-${color})" stroke-width="7" fill="none" stroke-linecap="round" style="filter:drop-shadow(0 0 5px ${color})"/>
    <circle cx="${kx}" cy="${ky}" r="4.5" fill="#fff" style="filter:drop-shadow(0 0 6px #fff)"/>
    <text x="43" y="47" text-anchor="middle" font-size="17" font-weight="800" fill="#fff">${score}</text>
    <text x="43" y="62" text-anchor="middle" font-size="7" fill="#6c7699" letter-spacing="1">300–850</text></svg>`;
}
function renderDials() {
  const { scores, summary, flags } = model.report;
  $('#dials').innerHTML = B.map((b) => `
    <div class="dial glass" style="--c:${BUREAU[b].color}">
      ${gauge(scores[b], BUREAU[b].color)}
      <div><div class="who">${BUREAU[b].name}</div>
        <div class="meta"><b>${summary[b].derogatory}</b> derogatory · ${summary[b].collection} collection<br>${money(summary[b].balances)} reported · ${summary[b].inquiries} inquiries</div>
        ${flags[b] ? `<span class="flag">${esc(flags[b])}</span>` : ''}
      </div>
    </div>`).join('') + `
    <div class="health glass" id="health">
      <div class="row"><span>Clean-file progress</span><span class="big" id="health-pct">0%</span></div>
      <div class="bar"><i id="health-bar"></i></div>
      <div class="sub" id="health-sub"></div>
    </div>`;
}
renderDials();

// An account is still negative while any bureau that reports it negatively still has it.
function aliveNegatives(atMi = timeMi()) {
  return model.accounts.filter((a) => {
    if (!a.negBureaus.length) return false;
    if (a.fall?.falloff != null && atMi >= a.fall.falloff) return false;
    const d = disputeFor.get(a.key);
    return a.negBureaus.some((b) => !(d && statusOf(d.id, b).s === 'deleted'));
  });
}
function renderHealth(h) {
  const pct = Math.round(h * 100);
  const el = $('#health-pct'); if (!el) return;
  el.textContent = pct + '%';
  $('#health-bar').style.width = Math.max(2, pct) + '%';
  $('#health-bar').style.backgroundPosition = `${pct}% 0`; // red → gold → teal as it fills
  const alive = aliveNegatives();
  $('#health-sub').innerHTML = `${alive.length} negative accounts still on file · ${money(alive.reduce((s, a) => s + a.balance, 0))}<br><span style="opacity:.7">Share of negative bureau entries removed or corrected — not a score prediction.</span>`;
  renderTimeStats();
  refreshTimeChart();
}

// ------------------------------------------------------------------ time machine
const lastFall = Math.max(0, ...model.accounts.map((a) => a.fall?.falloff || 0));
const END_MI = Math.max(REPORT_MI + 24, Math.ceil((lastFall + 6) / 12) * 12);
const range = $('#time-range');
range.max = END_MI - REPORT_MI;
const timeMi = () => REPORT_MI + Number(range.value);
const timeChart = new TimeChart($('#time-chart'), {
  onScrub: (m) => {
    if (Number(range.value) === m - REPORT_MI) return;
    range.value = m - REPORT_MI;
    range.dispatchEvent(new Event('input'));
  },
  onHover: (h) => renderChartTip(h),
});
// Year labels sit where the slider thumb's center lands (the thumb is 20px wide), same as the chart.
function renderTicks() {
  const span = END_MI - REPORT_MI;
  let html = '';
  for (let y = Math.ceil(REPORT_MI / 12); y * 12 <= END_MI; y++) {
    html += `<span style="left:calc(10px + (100% - 20px) * ${(y * 12 - REPORT_MI) / span})">${String(y).slice(2)}</span>`;
  }
  $('#time-ticks').innerHTML = html;
}

// Best case for the chart: every dispute still open ends in deletion when its answer is due —
// ~35 days after mailing (as in dueText), or on the ROUNDS schedule (Week 1 / 6 / 11) if not mailed yet.
const ANSWER_DAYS = 35;
function answerMi(d, b) {
  const e = statusOf(d.id, b);
  if (e.s === 'deleted') return -Infinity;
  if (e.s === 'corrected') return Infinity; // fixed, stays on file
  let t;
  if (e.s === 'mailed' && e.d) {
    const [y, m, dd] = e.d.split('-').map(Number);
    t = new Date(y, m - 1, dd + ANSWER_DAYS);
  } else {
    const week = Number(/\d+/.exec(ROUNDS.find((r) => r.id === d.round)?.when || '')?.[0] || 1);
    const n = new Date();
    t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + (week - 1) * 7 + ANSWER_DAYS);
  }
  return Math.max(REPORT_MI, t.getFullYear() * 12 + t.getMonth());
}
function bestCaseAlive(atMi) {
  return aliveNegatives(atMi).filter((a) => {
    const d = disputeFor.get(a.key);
    return !d || a.negBureaus.some((b) => !d.bureaus.includes(b) || atMi < answerMi(d, b));
  });
}
let chartModel = null;
function refreshTimeChart() {
  const onFile = [], best = [], dollars = [];
  for (let m = REPORT_MI; m <= END_MI; m++) {
    const alive = aliveNegatives(m);
    onFile.push(alive.length);
    dollars.push(alive.reduce((s, a) => s + a.balance, 0));
    best.push(bestCaseAlive(m).length);
  }
  const offBy = new Map();
  for (const a of aliveNegatives(REPORT_MI)) {
    const f = a.fall?.falloff;
    if (f > REPORT_MI && f <= END_MI) offBy.set(f, [...(offBy.get(f) || []), displayName(a)]);
  }
  const answers = DISPUTES.filter((d) => d.account).flatMap((d) => d.bureaus.map((b) => answerMi(d, b))).filter(Number.isFinite);
  chartModel = {
    start: REPORT_MI, end: END_MI, dollars,
    series: [
      { label: 'on file', rgb: '239,35,60', values: onFile, fill: true },
      { label: 'hypothetical: if every dispute succeeded', short: 'hypothetical', rgb: '94,234,212', values: best, dash: [3, 3], width: 1.25 },
    ],
    markers: [...offBy].map(([mi, names]) => ({ mi, names })),
    band: answers.length ? { from: REPORT_MI, to: Math.max(...answers) } : null,
  };
  timeChart.setData(chartModel);
  const zeroAt = (vals) => (vals.indexOf(0) < 0 ? null : REPORT_MI + vals.indexOf(0));
  $('#time-chart').setAttribute('aria-label', `Negative accounts on file by month: ${onFile[0]} now${zeroAt(onFile) != null ? `, none left by ${fmtMi(zeroAt(onFile))}` : ''}. If every open dispute is won: ${zeroAt(best) != null ? `none left by ${fmtMi(zeroAt(best))}` : `${best.at(-1)} left`}.`);
}
function renderChartTip(h) {
  const tip = $('#time-tip');
  if (!h || !chartModel) { tip.hidden = true; return; }
  const i = h.mi - REPORT_MI;
  const [on, best] = chartModel.series.map((s) => s.values[i]);
  const off = chartModel.markers.filter((m) => Math.abs(m.mi - h.mi) <= 1).sort((a, b) => Math.abs(a.mi - h.mi) - Math.abs(b.mi - h.mi))[0];
  tip.innerHTML = `<b>${fmtMi(h.mi)}</b>
    <span class="t-on${h.series === 0 ? ' snap' : ''}">${on} on file · ${money(chartModel.dollars[i])}</span>
    <span class="t-best${h.series === 1 ? ' snap' : ''}">${best} hypothetical, if every dispute succeeded</span>
    ${off ? `<span class="t-off">▼ ${fmtMi(off.mi)} ages off: ${off.names.map(esc).join(', ')}</span>` : ''}`;
  tip.hidden = false;
  // Fixed to the viewport, just above the dock (the glass dock clips anything that overflows it).
  const c = $('#time-chart').getBoundingClientRect();
  const w = tip.offsetWidth;
  tip.style.bottom = `${innerHeight - $('#timedock').getBoundingClientRect().top + 8}px`;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - 8 - w, c.left + h.x - w / 2))}px`;
}
function renderTimeStats() {
  const alive = aliveNegatives();
  $('#time-read').textContent = fmtMi(timeMi());
  range.setAttribute('aria-valuetext', fmtMi(timeMi()));
  $('#time-stats').innerHTML = alive.length
    ? `<b>${alive.length}</b> negatives · ${money(alive.reduce((s, a) => s + a.balance, 0))} on negative accounts`
    : '<span class="good">✦ every negative has aged off or been removed</span>';
}
let lastTick = null;
range.addEventListener('input', () => {
  orrery.setTime(timeMi());
  timeChart.setTime(timeMi());
  renderTimeStats();
  if (lastTick !== range.value) { sfx.tick(); lastTick = range.value; }
});
let playing = null;
$('#time-play').addEventListener('click', () => {
  if (playing) { clearInterval(playing); playing = null; $('#time-play').textContent = '▶'; return; }
  if (Number(range.value) >= Number(range.max)) range.value = 0;
  $('#time-play').textContent = '❚❚';
  playing = setInterval(() => {
    range.value = Number(range.value) + 1;
    range.dispatchEvent(new Event('input'));
    if (Number(range.value) >= Number(range.max)) { clearInterval(playing); playing = null; $('#time-play').textContent = '▶'; }
  }, 110);
});
$('#time-reset').addEventListener('click', () => { range.value = 0; range.dispatchEvent(new Event('input')); });
renderTicks();
// Restore saved dispute outcomes into the scene (after the time machine exists).
for (const d of DISPUTES) {
  if (!d.account) continue;
  for (const b of d.bureaus) {
    const s = statusOf(d.id, b).s;
    if (['deleted', 'corrected', 'verified'].includes(s)) orrery.setBureauState(d.account, b, s);
  }
}
orrery.setTime(timeMi());
timeChart.setTime(timeMi());
renderTimeStats();
refreshTimeChart();

// ------------------------------------------------------------------ inspector
const inspector = $('#inspector');
const MATRIX = [
  ['number', 'Account #'], ['detail', 'Type'], ['responsibility', 'Responsibility'], ['status', 'Status'], ['payStatus', 'Pay status'],
  ['balance', 'Balance', 'money'], ['pastDue', 'Past due', 'money'], ['highCredit', 'High credit', 'money'], ['limit', 'Limit', 'money'],
  ['terms', 'Terms'], ['opened', 'Opened', 'date'], ['lastActive', 'Last active', 'date'], ['lastPayment', 'Last payment', 'date'], ['lastReported', 'Last reported', 'date'],
];

function matrixHTML(a) {
  const rows = MATRIX.map(([k, label, kind]) => {
    const vals = B.map((b) => (a.bureaus[b] ? a.bureaus[b][k] : undefined));
    const norm = (v) => (kind === 'date' ? mi(v) : kind === 'money' ? v : String(v ?? '').replace(/\*+$/, ''));
    const present = vals.filter((v) => v !== undefined);
    const diff = k !== 'number' && k !== 'lastReported' && new Set(present.map((v) => JSON.stringify(norm(v)))).size > 1;
    const cells = vals.map((v) => (v === undefined ? '<td class="na">not reported</td>' : `<td>${kind === 'money' ? money(v) : esc(v ?? '—')}</td>`)).join('');
    return `<tr class="${diff ? 'diff' : ''}"><td>${label}</td>${cells}</tr>`;
  }).join('');
  return `<table class="matrix"><tr><th></th>${B.map((b) => `<th class="b-${b}">${b}</th>`).join('')}</tr>${rows}</table>`;
}

function historyHTML(a) {
  const h = a.history;
  if (!h || !B.some((b) => h[b]?.some(Boolean))) return '<div class="fall">No payment history reported.</div>';
  const months = [...h.months].reverse();
  const rows = B.map((b) => {
    const vals = [...(h[b] || [])].reverse();
    return `<span class="lab" style="color:${BUREAU[b].color}">${b}</span>` +
      months.map((m, i) => `<span class="c" data-v="${vals[i] ?? ''}" data-t="${fmtMi(Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1)} · ${vals[i] ?? 'no data'}"></span>`).join('');
  }).join('');
  const first = months[0], last = months.at(-1);
  const lab = (m) => fmtMi(Number(m.slice(0, 4)) * 12 + Number(m.slice(5)) - 1);
  return `<div class="hist">${rows}<div class="axis"><span>${lab(first)}</span><span>oldest → newest</span><span>${lab(last)}</span></div></div>
    <div class="hist-key"><span><i data-v="OK"></i>on time</span><span><i data-v="30"></i>30</span><span><i data-v="60"></i>60</span><span><i data-v="90"></i>90</span><span><i data-v="120"></i>120+</span><span><i data-v="CO"></i>charged off</span><span><i></i>no data</span></div>`;
}

function findingsHTML(list, withAcct = false) {
  if (!list.length) return '<div class="fall">No anomalies detected in the raw data for this item.</div>';
  return list.map((f) => `
    <div class="finding" ${withAcct && f.account ? `data-acct="${f.account}"` : withAcct ? 'data-acct="__core"' : ''}>
      <span class="sev ${f.severity}"></span>
      <div>${withAcct ? `<div class="acct">${f.account ? esc(displayName(byKey.get(f.account))) : 'Personal information'} · ${f.severity}</div>` : ''}
        <b>${esc(f.title)}</b><pre>${esc(f.detail)}</pre>
        <div class="who">${f.bureaus.map((b) => BUREAU[b].short).join(' · ')}</div></div>
    </div>`).join('');
}

function dueText(entry) {
  if (entry.s !== 'mailed' || !entry.d) return '';
  const [y, m, dd] = entry.d.split('-').map(Number);
  const due = new Date(y, m - 1, dd + 35);
  const n = new Date();
  const days = Math.round((due - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
  return days < 0 ? `<span class="due over">${-days}d overdue → escalate</span>` : `<span class="due">due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${days}d</span>`;
}

function statusRows(d) {
  return d.bureaus.map((b) => {
    const e = statusOf(d.id, b);
    return `<div class="status-row" data-d="${d.id}" data-b="${b}">
      <span class="bn" style="color:${BUREAU[b].color}">${b}</span>
      <div class="seg" role="group" aria-label="${d.id} ${BUREAU[b].name} status">${STATUS.map(([s, l]) => `<button data-s="${s}" class="${e.s === s ? 'on' : ''}" aria-pressed="${e.s === s}">${l}</button>`).join('')}</div>
      <div class="due">${e.s === 'mailed' ? `<input type="date" value="${e.d || ''}" data-date aria-label="Date mailed to ${BUREAU[b].name}">` : ''}${dueText(e)}${e.s === 'mailed' && e.d ? `<button class="cal-btn" data-act="ics" data-d="${d.id}" data-b="${b}" title="Add the due date to your calendar" aria-label="Add ${d.id} ${BUREAU[b].name} due date to calendar">📅</button>` : ''}</div>
    </div>`;
  }).join('');
}

function disputeBoxHTML(d) {
  return `<div class="dispute-box">
    <div class="sec-title"><span>Mission ${d.id} · ${d.round}</span>${d.attorney ? '<span class="chip att">🧑‍⚖️ attorney track</span>' : ''}</div>
    <h4>${esc(d.title)}</h4>
    <p>${esc(d.action)}</p>
    <div class="odds"><span>Odds</span><div class="track"><i style="width:${Math.round(d.odds * 100)}%"></i></div><span>${esc(d.oddsLabel)}</span></div>
    <div class="laws">${d.law.map((l) => `<span class="chip law">${esc(l)}</span>`).join('')}</div>
    ${statusRows(d)}
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" data-letter="${d.id}">✉ Open letters</button></div>
  </div>`;
}

let current = null;
function openInspector(key) {
  current = key;
  closeSheet(false);
  renderInspector(key);
  inspector.classList.add('open');
  inspector.inert = false;
  orrery.select(key);
}
function renderInspector(key) {
  let html;
  if (key === '__core') {
    const { scores, inquiries, flags } = model.report;

    const inq = B.map((b) => `<span class="chip b-${b}">${b} ${inquiries.filter((q) => q.bureau === b).length} inquiries</span>`).join(' ');
    html = `<div class="insp-head"><div class="kicker">Score core · identity</div><h2>Your file</h2>
      <div class="sub">${B.map((b) => `<span class="chip b-${b}">${b} ${scores[b]}</span>`).join('')}</div></div>
      <div class="insp-body">
        <div><div class="sec-title">Identity anomalies</div>${findingsHTML(model.personal)}</div>
        ${personalDispute ? disputeBoxHTML(personalDispute) : '<div class="dispute-box"><h4>Identity looks consistent</h4><p>All three bureaus agree on your name, address and date of birth — no correction letter needed.</p></div>'}
        <div><div class="sec-title">Hard inquiries (2 yrs)</div>${inq}<p class="fall" style="margin-top:8px">The glowing dust orbiting each ring is one hard inquiry. Only dispute inquiries you never authorized (15 U.S.C. § 1681b(f)) — dealer applications you made count as authorized.</p></div>
        <div><div class="sec-title">File flags</div>${B.map((b) => flags[b] ? `<div class="fall"><b style="font-size:12px;color:${BUREAU[b].color}">${BUREAU[b].name}</b> — ${esc(flags[b])}</div>` : '').join('')}</div>
        <p class="fall">The core's color comes from your average score (${Math.round(B.reduce((s, b) => s + scores[b], 0) / 3)}). Its plasma calms and turns teal as negative entries are removed.</p>
      </div>`;
  } else {
    const a = byKey.get(key);
    const d = disputeFor.get(key);
    const f = a.findings.filter((x) => x.severity !== 'info');
    const fall = a.fall;
    html = `<div class="insp-head"><div class="kicker">${esc(a.kind)} · reported by ${a.reporting.join(' · ')}</div>
      <h2>${esc(displayName(a))}</h2>
      <div class="sub"><span class="chip ${a.neg ? 'neg' : 'pos'}">${a.neg ? 'negative' : 'positive'}</span>
        <span class="chip">${money(a.balance)}</span>${a.originalCreditor ? `<span class="chip">orig. ${esc(a.originalCreditor)}</span>` : ''}
        ${f.length ? `<span class="chip" style="color:var(--hot)">${f.length} anomalies</span>` : ''}</div></div>
      <div class="insp-body">
        ${d ? disputeBoxHTML(d) : a.neg ? '<div class="dispute-box"><h4>No dispute planned</h4><p>No inconsistency strong enough to dispute was found in the report data. See Missions → Round 0 for other options (goodwill letter, pay-for-delete, or waiting it out).</p></div>' : '<div class="dispute-box"><h4>Keep this one</h4><p>Positive account — never dispute it for deletion. Open, on-time accounts are what rebuild the score.</p></div>'}
        <div><div class="sec-title"><span>Anomaly engine</span><span>${f.length}</span></div>${findingsHTML(f)}</div>
        <div><div class="sec-title"><span>Tri-merge matrix</span><span>≠ = bureaus disagree</span></div>${matrixHTML(a)}</div>
        <div><div class="sec-title">24-month history</div>${historyHTML(a)}</div>
        ${fall ? `<div><div class="sec-title">Time limit (15 U.S.C. § 1681c)</div><div class="fall">${fall.falloff
          ? `${fall.lateOnly ? 'The late-payment mark' : 'This item'} typically ages off ${fall.bound ? 'no later than' : 'around'} <b>${fmtMi(fall.falloff)}</b>${fall.legalMax !== fall.falloff ? ` · legal limit about ${fmtMi(fall.legalMax)}` : ''}<br>Estimated from: ${esc(fall.basis)} · confidence ${fall.confidence}`
          : `<b>${esc(fall.basis)}</b>`}</div></div>` : ''}
      </div>`;
  }
  inspector.innerHTML = `<button class="close-x" aria-label="Close">✕</button>${html}`;
}
function closeInspector() {
  current = null;
  inspector.classList.remove('open');
  inspector.inert = true;
  orrery.select(null);
}
inspector.addEventListener('click', (e) => {
  if (e.target.closest('.close-x')) closeInspector();
});

// status + letter buttons work in the inspector and the missions sheet
document.addEventListener('click', (e) => {
  const seg = e.target.closest('.seg button');
  if (seg) {
    const row = seg.closest('.status-row');
    setStatus(row.dataset.d, row.dataset.b, seg.dataset.s);
    return;
  }
  const lb = e.target.closest('[data-letter]');
  if (lb) { openTab('letters', lb.dataset.letter); return; }
  const cb = e.target.closest('[data-copy]');
  if (cb) { copyText(composeLetter(DISPUTES.find((d) => d.id === cb.dataset.copy), 'bureau', DISPUTES.find((d) => d.id === cb.dataset.copy).bureaus[0])); return; }
  const focus = e.target.closest('[data-focus]');
  if (focus) { openTab('orbit'); openInspector(focus.dataset.focus); return; }
  const fa = e.target.closest('.scan-list .finding');
  if (fa) { openTab('orbit'); openInspector(fa.dataset.acct); }
});
document.addEventListener('change', (e) => {
  if (!e.target.matches('[data-date]')) return;
  const row = e.target.closest('.status-row');
  const cur = statusOf(row.dataset.d, row.dataset.b);
  state.disputes[row.dataset.d] = { ...state.disputes[row.dataset.d], [row.dataset.b]: { ...cur, d: e.target.value } };
  save();
  rerender();
});

function setStatus(id, b, s) {
  const prev = statusOf(id, b);
  const entry = { s, d: s === 'mailed' ? (prev.s === 'mailed' && prev.d ? prev.d : today()) : prev.d };
  state.disputes[id] = { ...state.disputes[id], [b]: entry };
  save();
  const d = DISPUTES.find((x) => x.id === id);
  if (d.account) orrery.setBureauState(d.account, b, ['deleted', 'corrected', 'verified'].includes(s) ? s : null);
  if (s === 'deleted' && !d.account) { sfx.win(); toast(`✦ ${d.title} — ${BUREAU[b].name} updated`, 'win'); }
  else if (s === 'corrected') { sfx.select(); toast(`${d.title}: ${BUREAU[b].name} corrected`); }
  else if (s === 'verified') toast(`${BUREAU[b].name} "verified" it → request their method of verification (§ 1681i(a)(7)) and re-dispute with new evidence.`);
  else if (s === 'mailed') { sfx.select(); toast(`Mailed to ${BUREAU[b].name} — due in ~35 days. Tap 📅 to put it on your calendar.`); }
  rerender();
}
function rerender() {
  const a = document.activeElement;
  const focusSel = a?.closest?.('.status-row') ? `.status-row[data-d="${a.closest('.status-row').dataset.d}"][data-b="${a.closest('.status-row').dataset.b}"] ${a.matches('[data-date]') ? '[data-date]' : `[data-s="${a.dataset.s}"]`}` : null;
  if (current) {
    const scroll = $('.insp-body', inspector)?.scrollTop;
    renderInspector(current);
    const body = $('.insp-body', inspector); if (body && scroll) body.scrollTop = scroll;
  }
  if (activeTab === 'missions') renderMissions();
  if (activeTab === 'letters') renderLetters(lastLetter.id, lastLetter.target);
  syncSanct();
  if (typeof checkDeadlines === 'function') refreshDueBadge();
  if (activeTab === 'sanctuary') renderHouse();
  renderHealth(orrery.health);
  if (focusSel) document.querySelector(focusSel)?.focus();
}

// ------------------------------------------------------------------ sheets
const sheet = $('#sheet');
let activeTab = 'sanctuary';
function openTab(tab, arg) {
  activeTab = tab;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const inSanct = tab === 'sanctuary';
  document.body.classList.toggle('mode-sanct', inSanct);
  sanct.setActive(inSanct);
  if (inSanct) {
    if (current) closeInspector();
    sheet.classList.remove('open'); sheet.inert = true;
    orrery.setPaused(true);
    renderHouse();
    if (state.ascendPending && N) setTimeout(() => ascend(false), 900);
    return;
  }
  if (tab === 'orbit') { closeSheet(); return; }
  if (current) closeInspector();
  $('#labels').inert = true;
  orrery.setPaused(true); // the sheet covers the scene — stop rendering it
  ({ missions: renderMissions, scanner: renderScanner, letters: () => renderLetters(arg), playbook: renderPlaybook })[tab]();
  sheet.classList.add('open');
  sheet.inert = false;
  $('#hint').style.opacity = 0;
  sfx.whoosh();
}
function closeSheet(resetTab = true) {
  document.body.classList.remove('mode-sanct');
  sanct.setActive(false);
  $('#labels').inert = false;
  orrery.setPaused(false);
  sheet.classList.remove('open');
  sheet.inert = true;
  if (resetTab) activeTab = 'orbit';
  if (resetTab || activeTab !== 'orbit') {
    activeTab = 'orbit';
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'orbit'));
  }
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) openTab(b.dataset.tab); });

function quickWins() {
  const extra = [];
  for (const b of B) {
    const until = (model.report.flags[b] || '').match(/until (\d{2}\/\d{2}\/\d{4})/)?.[1];
    if (until) extra.push({ id: `q-alert-${b}`, title: `${BUREAU[b].name} ID security alert ends ${until}`, why: `After that date lenders no longer have to verify it's you before opening credit. If you still want that protection, contact ${BUREAU[b].name} to place a new alert before it lapses.` });
  }
  return [...extra, ...QUICK_WINS];
}
function renderMissions() {
  const keep = $('.sheet-body', sheet)?.scrollTop;
  const won = DISPUTES.flatMap((d) => d.bureaus.map((b) => statusOf(d.id, b).s)).filter((s) => s === 'deleted' || s === 'corrected').length;
  const total = DISPUTES.reduce((s, d) => s + d.bureaus.length, 0);
  sheet.innerHTML = `
    <div class="sheet-head"><div><h1>Missions <span>· ${won}/${total} bureau entries won</span></h1>
      <p>Mark each letter as you mail it — the due date counts down 35 days (30-day investigation + mail). Marking an entry <b>Deleted</b> shatters its crystal in orbit.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="import">⇪ Import new report</button><button class="btn" data-act="report">📄 My report</button><button class="btn" data-act="ics-all">📅 All due dates</button><button class="btn" data-act="notify">🔔 Alerts</button><button class="btn" data-act="backup">⤓ Backup</button><button class="btn" data-act="restore">⤒ Restore</button></div></div>
    ${backupNote()}
    <div class="sheet-body">
      <div class="sec-title">Round 0 · do these first — no dispute needed</div>
      <div class="quick">${quickWins().map((q) => `<button class="qw ${state.quick[q.id] ? 'done' : ''}" data-q="${q.id}" role="checkbox" aria-checked="${!!state.quick[q.id]}"><span class="box" aria-hidden="true">${state.quick[q.id] ? '✓' : ''}</span><span><b>${esc(q.title)}</b><span>${esc(q.why)}</span></span></button>`).join('')}</div>
      <div class="rounds">${ROUNDS.map((r) => `
        <div class="round"><h3 style="color:${r.id === 'R1' ? 'var(--tu)' : r.id === 'R2' ? 'var(--ex)' : 'var(--eq)'}">${r.name} · ${r.when}</h3><div class="rn">${esc(r.note)}</div>
          ${DISPUTES.filter((d) => d.round === r.id).sort((a, b) => a.priority - b.priority).map((d) => {
            const allWon = d.bureaus.every((b) => ['deleted', 'corrected'].includes(statusOf(d.id, b).s));
            return `<div class="mission ${allWon ? 'won' : ''}">
              <div class="top"><div><div class="id">${d.id} · priority ${d.priority}${d.account ? ' · ' + money(byKey.get(d.account).balance) : ''}</div><h4>${esc(d.title)}</h4></div>${d.attorney ? '<span class="chip att">🧑‍⚖️</span>' : ''}</div>
              <div class="odds"><div class="track"><i style="width:${Math.round(d.odds * 100)}%"></i></div><span>${esc(d.oddsLabel)}</span></div>
              ${statusRows(d)}
              <div class="acts"><button class="btn" data-focus="${d.account || '__core'}">◎ Focus</button><button class="btn" data-letter="${d.id}">✉ Letter</button></div>
            </div>`;
          }).join('')}
        </div>`).join('')}</div>
    </div>`;
  if (keep) $('.sheet-body', sheet).scrollTop = keep;
}
sheet.addEventListener('click', (e) => {
  const q = e.target.closest('[data-q]');
  if (q) { state.quick[q.dataset.q] = !state.quick[q.dataset.q]; save(); if (state.quick[q.dataset.q]) sfx.select(); renderMissions(); $(`[data-q="${q.dataset.q}"]`, sheet)?.focus(); return; }
  if (e.target.closest('[data-tab-orbit]')) openTab('orbit');
  const rt = e.target.closest('[data-route]');
  if (rt) {
    const id = Number(rt.dataset.route);
    openRoutes.has(id) ? openRoutes.delete(id) : openRoutes.add(id);
    $('.play-grid', sheet).innerHTML = playbookCards();
    $(`[data-route="${id}"]`, sheet)?.focus();
    return;
  }
  if (e.target.closest('#play-all')) {
    const all = openRoutes.size !== PLAYBOOK.length;
    openRoutes.clear();
    if (all) PLAYBOOK.forEach((_, i) => openRoutes.add(i));
    renderPlaybook();
    $('#play-all', sheet)?.focus();
    return;
  }
  const flt = e.target.closest('[data-sev]');
  if (flt) renderScanner(flt.dataset.sev, true);
  const li = e.target.closest('[data-li]');
  if (li) renderLetters(li.dataset.li, li.dataset.target);
  const tgt = e.target.closest('[data-target]');
  if (tgt && !li) renderLetters(tgt.dataset.for, tgt.dataset.target);
  if (e.target.closest('#copy-letter')) copyText($('#paper').dataset.plain);
  if (e.target.closest('#print-letter')) { $('#print-area').textContent = $('#paper').dataset.plain; window.print(); }
});

function renderScanner(filter = 'all', refilter = false) {
  const f = model.findings;
  const counts = Object.fromEntries(['critical', 'high', 'medium', 'low'].map((s) => [s, f.filter((x) => x.severity === s).length]));
  const list = filter === 'all' ? f : f.filter((x) => x.severity === filter);
  sheet.innerHTML = `
    ${refilter ? '' : '<div class="scanline" aria-hidden="true"></div>'}
    <div class="sheet-head"><div><h1>Anomaly Scanner <span>· ${f.length} findings</span></h1>
      <p>Every finding is computed from the raw report cells — months the bureaus report differently, skipped late stages, conflicting dates and statuses. They are grounds to ask for verification, not proof of error. Click one to fly to the account.</p></div>
      <div class="scan-stats">${['critical', 'high', 'medium', 'low'].map((s) => `<button class="stat ${s}" data-sev="${filter === s ? 'all' : s}" style="${filter === s ? 'outline:1px solid rgba(255,255,255,.4)' : ''}"><b>${counts[s]}</b><span>${s}</span></button>`).join('')}</div></div>
    <div class="sheet-body scan-list">${findingsHTML(list, true)}</div>`;
}

function composeLetter(d, kind, target) {
  if (kind === 'bureau') return fill(`${LETTER_HEADER}\n\n${BUREAU_ADDRESSES[target]}\n\n${d.letters?.[target] ?? d.letter}\n\n${LETTER_FOOTER}`);
  const x = d.extras[Number(target)];
  return fill(`${CREDITOR_HEADER}\n\n${x.to}\n\n${x.body}\n\nSincerely,\n\n[SIGNATURE]\n[FULL LEGAL NAME]`);
}
function renderLetters(id = DISPUTES[0]?.id, target) {
  if (!DISPUTES.length) {
    sheet.innerHTML = `<div class="sheet-head"><div><h1>Letter Vault</h1><p>No disputes were generated from this report — the three bureaus report your accounts consistently. Check Missions → Round 0 for what you can still do.</p></div></div>`;
    return;
  }
  lastLetter = { id, target };
  const listScroll = $('.letter-list', sheet)?.scrollTop;
  const d = DISPUTES.find((x) => x.id === id) || DISPUTES[0];
  const tgt = target ?? d.bureaus[0];
  const isExtra = !B.includes(tgt);
  const plain = composeLetter(d, isExtra ? 'extra' : 'bureau', tgt);
  const marked = esc(plain).replace(/\[([^\]]+)\]/g, '<mark>[$1]</mark>');
  sheet.innerHTML = `
    <div class="sheet-head"><div><h1>Letter Vault <span>· certified mail, one bureau per envelope</span></h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px"><button class="btn" data-act="profile">👤 My info${profileComplete() ? ' ✓' : ''}</button>${ROUNDS.map((r) => `<button class="btn" data-act="print-round" data-round="${r.id}">🖨 Print ${r.name}</button>`).join('')}</div>
      <p>Fill every <mark style="background:#fff1b8;color:#7a4b00;border-radius:3px;padding:0 3px">[BRACKET]</mark> by hand. Attach ID, proof of address, and the highlighted report page. Never send originals. Your full SSN goes only to the three bureaus — never to a creditor or collector. ${esc(ADDRESS_NOTE)}</p></div></div>
    <div class="sheet-body"><div class="letters">
      <div class="letter-list">${DISPUTES.slice().sort((a, b) => a.priority - b.priority).map((x) => `<button class="letter-item ${x.id === d.id ? 'active' : ''}" data-li="${x.id}"><b>${x.id} · ${esc(x.title)}</b><span>${x.round} · to ${x.bureaus.join(', ')}${x.extras.length ? ' + creditor' : ''}</span></button>`).join('')}</div>
      <div class="paper-wrap">
        <div class="paper-tools">
          ${d.bureaus.map((b) => `<button class="chip b-${b}" data-for="${d.id}" data-target="${b}" style="${tgt === b ? 'background:rgba(255,255,255,.14)' : ''}">→ ${BUREAU[b].name}</button>`).join('')}
          ${d.extras.map((x, i) => `<button class="chip law" data-for="${d.id}" data-target="${i}" style="${String(tgt) === String(i) ? 'background:rgba(255,212,121,.2)' : ''}">→ ${esc(x.label.split('→')[1] || x.label)}</button>`).join('')}
          <span style="flex:1"></span>
          <button class="btn" id="copy-letter">Copy</button><button class="btn primary" id="print-letter">Print</button>
        </div>
        <div class="paper" id="paper">${marked}</div>
        ${isExtra ? '' : `<div class="letter-status glass-soft"><div class="sec-title"><span>Status · ${esc(BUREAU[tgt].name)}</span><span>tap as you go</span></div>${statusRows({ ...d, bureaus: [tgt] })}</div>`}
      </div>
    </div></div>`;
  $('#paper').dataset.plain = plain;
  $('#print-area').textContent = plain; // so ⌘P prints this letter too
  if (listScroll) $('.letter-list', sheet).scrollTop = listScroll;
}

let playQuery = '';
const openRoutes = new Set();
function playbookCards() {
  const q = playQuery.trim().toLowerCase();
  const cards = PLAYBOOK.map((r, id) => ({ r, id })).filter(({ r }) => !q || `${r.title} ${r.law} ${r.text}`.toLowerCase().includes(q));
  if (!cards.length) return '<p class="play-empty">No routes match “' + esc(playQuery) + '”. Try “collector”, “identity”, “car” or “score”.</p>';
  return cards.map(({ r, id }) => {
    const open = openRoutes.has(id);
    return `<article class="route ${open ? 'open' : ''}"><div class="ic">${r.icon}</div><h4>${esc(r.title)}</h4><span class="chip law">${esc(r.law)}</span><p class="${open ? '' : 'clamp'}">${esc(r.text)}</p><button class="more-btn" data-route="${id}" aria-expanded="${open}">${open ? 'Show less' : 'Read more'}</button></article>`;
  }).join('');
}
function renderPlaybook() {
  sheet.innerHTML = `
    <div class="sheet-head"><div><h1>Rights Playbook <span>· how the law works</span></h1>
      <p>The honest rule first: no law forces an accurate, verifiable negative off early. These are the routes for everything that is inaccurate, incomplete, unverifiable or not yours — and the leverage for the rest. Anyone charging upfront to "remove everything" violates the Credit Repair Organizations Act (15 U.S.C. § 1679b(b)).</p>
      <div class="play-tools"><input type="search" id="play-q" value="${esc(playQuery)}" placeholder="Search routes: identity theft, collector, car…" aria-label="Search the playbook" /><button class="btn" id="play-all">${openRoutes.size === PLAYBOOK.length ? 'Collapse all' : 'Expand all'}</button></div>
      <p class="fine">Reviewed ${esc(PLAYBOOK_REVIEWED)}. ${esc(PLAYBOOK_REVIEW_NOTE)}</p></div></div>
    <div class="sheet-body">
      <div class="play-grid">${playbookCards()}</div>
      <details class="sources"><summary class="sec-title">Sources (${SOURCES.length})</summary>${SOURCES.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(t)}</a>`).join('<br>')}</details>
      <p class="disclaimer">General information, not legal advice. For 🧑‍⚖️ items talk to an FCRA/FDCPA consumer attorney — fee-shifting means strong cases are often taken at no cost to you.</p>
    </div>`;
}
sheet.addEventListener('input', (e) => {
  if (e.target.id !== 'play-q') return;
  playQuery = e.target.value;
  const grid = $('.play-grid', sheet);
  if (grid) grid.innerHTML = playbookCards();
});

// ------------------------------------------------------------------ santuario
// The disputes are the Zodiac Houses, climbed in priority order (up to 12).
const HOUSES = DISPUTES.slice().sort((a, b) => a.priority - b.priority).slice(0, 12);
const N = HOUSES.length;
const houseState = (d) => {
  const ss = d.bureaus.map((b) => statusOf(d.id, b).s);
  const won = (x) => x === 'deleted' || x === 'corrected';
  if (ss.every(won)) return 'won';
  if (ss.some((x) => x === 'verified')) return 'verified';
  if (ss.some(won)) return 'partial';
  if (ss.some((x) => x === 'mailed')) return 'mailed';
  return 'todo';
};
let houseIdx = 0;
const sanct = N ? new Sanctuary({
  canvas: $('#sanct'),
  houses: HOUSES,
  hooks: {
    onArrive: (i) => { houseIdx = i; sfx.select(); renderHouse(); },
    onConquer: (i) => {
      sfx.win();
      const el = $('#conquer');
      el.innerHTML = `<div class="c-sign">${ZODIAC[i][0]}&#xFE0E;</div><b>¡CASA DE ${ZODIAC[i][1].toUpperCase()} CONQUISTADA!</b><span>${esc(HOUSES[i].title)}</span>`;
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
      // The last house just fell: the Ascension plays (once), here or next time the Santuario opens.
      if (!state.ascended && HOUSES.every((d) => houseState(d) === 'won')) {
        state.ascended = true; state.ascendPending = true; save();
        if (activeTab === 'sanctuary') setTimeout(() => ascend(false), 2600);
      }
    },
    onCine: (t) => cineOverlay(t),
    onCineEnd: () => {
      const el = $('#cine');
      document.body.classList.remove('cine');
      el.classList.add('out');
      setTimeout(() => { el.hidden = true; el.classList.remove('on', 'out'); }, 950);
    },
  },
}) : { setActive() {}, setStates() {}, goTo() {} };

// ------------------------------------------------------------------ Ascension
// Trailer lines, timed to the shots in src/ascension.js.
const CINE_LINES = [[0.35, 2.0, 'Every dispute, a flame.'], [2.65, 4.45, 'Every flame, a step.'], [5.55, 6.85, 'Until the record is clean.'], [7.25, 8.3, 'Rise.', true]];
let cineScore = null;
function ascend(preview) {
  if (!N || sanct.cine.playing) return;
  state.ascendPending = false; save();
  if (activeTab !== 'sanctuary') openTab('sanctuary');
  $('#cine-tag').textContent = preview ? 'Preview · what finishing looks like' : `✦ All ${N} houses conquered`;
  $('#cine-sub').textContent = preview ? `Your future · all ${N} houses conquered` : `All ${N} houses conquered · clean record`;
  cineOverlay(0);
  const el = $('#cine');
  el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('on');
  document.body.classList.add('cine');
  cineScore = ascensionScore(N);
  sanct.cine.play({ preview });
  $('#cine-skip').focus();
}
function cineOverlay(t) {
  const f = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const L = CINE_LINES.find(([a, b]) => t >= a && t < b), line = $('#cine-line');
  if (line.textContent !== (L?.[2] || '')) line.textContent = L?.[2] || '';
  line.classList.toggle('big', !!L?.[3]);
  line.style.opacity = L ? Math.min(f(L[0], L[0] + 0.35), 1 - f(L[1] - 0.35, L[1])) : 0;
  if (L && !L[3]) line.style.letterSpacing = `${0.26 + 0.12 * f(L[0], L[1])}em`;
  else line.style.letterSpacing = '';
  $('#cine-white').style.opacity = f(8.2, 8.9);
  const title = $('#cine-title');
  title.style.opacity = f(8.9, 9.3);
  title.style.transform = `scale(${1.08 - 0.08 * f(8.9, 9.9)})`;
}
function skipAscension() {
  if (!sanct.cine?.playing) return;
  cineScore?.stop();
  sanct.cine.skip();
}
$('#cine-skip').addEventListener('click', skipAscension);
$('#ascend-btn').addEventListener('click', () => ascend(!HOUSES.every((d) => houseState(d) === 'won')));
if (!N) document.querySelector('#tabs [data-tab="sanctuary"]').hidden = true;
function syncSanct() {
  if (!N) return;
  const states = HOUSES.map(houseState);
  sanct.setStates(states);
  const won = states.filter((x) => x === 'won').length;
  const btn = $('#ascend-btn'), all = won === N;
  btn.classList.toggle('ready', all);
  btn.title = all ? 'Every house is won. Watch your Ascension.' : 'Preview the ending: what it looks like when every house is won';
  $('#fire-clock').innerHTML = `<h3>Reloj de Fuego · ${won}/${N}</h3><div class="fire-ring">${HOUSES.map((d, i) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    return `<button class="flame ${i === houseIdx ? 'here' : ''}" data-s="${states[i]}" data-house="${i}" style="left:${95 + Math.cos(a) * 80}px;top:${95 + Math.sin(a) * 80}px" title="${ZODIAC[i][1]} · ${esc(d.title)}" aria-label="House ${i + 1}, ${ZODIAC[i][1]}: ${states[i]}">${ZODIAC[i][0]}&#xFE0E;</button>`;
  }).join('')}<div class="core"><div><b>${won}</b>houses won</div></div></div>`;
}
function renderHouse() {
  if (!N) return;
  syncSanct();
  const d = HOUSES[houseIdx], [sign, name] = ZODIAC[houseIdx];
  const a = d.account ? byKey.get(d.account) : null;
  const st = houseState(d);
  const msg = { todo: 'The house is dark. Mail the letters to light its flame.', mailed: 'Letters are out — the bureaus have ~30 days to answer.', partial: 'Part of this house has fallen. Keep going.', won: '✦ House conquered. Its flame burns gold.', verified: 'They "verified" it — ask how (§ 1681i(a)(7)) and come back with new evidence.' }[st];
  $('#house-card').innerHTML = `
    <div class="sign">${sign}&#xFE0E;</div>
    <div class="kicker">Casa ${houseIdx + 1} de ${N} · ${name} · ${d.round}</div>
    <h2>${esc(d.title)}</h2>
    ${a ? `<div class="sub" style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0"><span class="chip neg">${money(a.balance)}</span>${a.reporting.map((b) => `<span class="chip b-${b}">${b}</span>`).join('')}</div>` : ''}
    <p>${esc(d.action)}</p>
    <p><b>${msg}</b></p>
    <div class="odds"><span>Odds</span><div class="track"><i style="width:${Math.round(d.odds * 100)}%"></i></div><span>${esc(d.oddsLabel)}</span></div>
    ${statusRows(d)}
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn primary" data-letter="${d.id}">✉ Letters</button>${d.account ? `<button class="btn" data-focus="${d.account}">◎ See in Orbit</button>` : `<button class="btn" data-focus="__core">◎ See in Orbit</button>`}</div>`;
  $('#house-where').textContent = `${sign}︎ ${name} · ${houseIdx + 1}/${N}`;
}
$('#house-prev').addEventListener('click', () => !sanct.cine?.playing && sanct.goTo((sanct.index ?? houseIdx) - 1));
$('#house-next').addEventListener('click', () => !sanct.cine?.playing && sanct.goTo((sanct.index ?? houseIdx) + 1));
$('#fire-clock').addEventListener('click', (e) => { const f = e.target.closest('[data-house]'); if (f) sanct.goTo(Number(f.dataset.house)); });
document.addEventListener('keydown', (e) => {
  if (activeTab !== 'sanctuary' || sanct.cine?.playing || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'ArrowRight') sanct.goTo((sanct.index ?? houseIdx) + 1);
  if (e.key === 'ArrowLeft') sanct.goTo((sanct.index ?? houseIdx) - 1);
});

// ------------------------------------------------------------------ palette
const pal = $('#palette'), palIn = $('#palette-input'), palRes = $('#palette-results');
const palItems = [
  ...model.accounts.map((a) => ({ label: displayName(a), sub: `${a.neg ? 'negative' : 'positive'} · ${a.reporting.join('/')} · ${money(a.balance)}`, run: () => { openTab('orbit'); openInspector(a.key); } })),
  { label: 'Your file (identity + inquiries)', sub: 'score core', run: () => { openTab('orbit'); openInspector('__core'); } },
  ...DISPUTES.map((d) => ({ label: `${d.id} · ${d.title}`, sub: `letter · ${d.round}`, run: () => openTab('letters', d.id) })),
  { label: 'Import new credit report', sub: 'compare & auto-detect wins', run: importReport },
  { label: 'Your report & data', sub: 'load a different report · delete my data', run: openReportPanel },
  { label: 'Back up progress', sub: 'download a file', run: backup },
  { label: 'My info for letters', sub: 'fill the brackets', run: openProfile },
  ...[...(N ? ['sanctuary'] : []), 'orbit', 'missions', 'scanner', 'letters', 'playbook'].map((t) => ({ label: t[0].toUpperCase() + t.slice(1), sub: 'tab', run: () => openTab(t) })),
];
let palSel = 0, palList = [];
function renderPalette() {
  const q = palIn.value.trim().toLowerCase();
  palList = palItems.filter((i) => !q || (i.label + ' ' + i.sub).toLowerCase().includes(q)).slice(0, 12);
  palSel = Math.min(palSel, Math.max(0, palList.length - 1));
  palRes.innerHTML = palList.map((i, n) => `<div class="pr ${n === palSel ? 'active' : ''}" data-n="${n}" id="pr-${n}" role="option" aria-selected="${n === palSel}">${esc(i.label)}<span>${esc(i.sub)}</span></div>`).join('');
  palIn.setAttribute('aria-activedescendant', palList.length ? `pr-${palSel}` : '');
  palRes.children[palSel]?.scrollIntoView({ block: 'nearest' });
}
let palReturn = null;
function openPalette() { palReturn = document.activeElement; pal.classList.add('open'); pal.inert = false; palIn.value = ''; palSel = 0; renderPalette(); setTimeout(() => palIn.focus(), 30); }
function closePalette() { pal.classList.remove('open'); pal.inert = true; palReturn?.focus?.(); }
palIn.addEventListener('input', () => { palSel = 0; renderPalette(); });
palIn.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { palSel = Math.min(palList.length - 1, palSel + 1); renderPalette(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { palSel = Math.max(0, palSel - 1); renderPalette(); e.preventDefault(); }
  if (e.key === 'Enter' && palList[palSel]) { closePalette(); palList[palSel].run(); }
});
palRes.addEventListener('click', (e) => { const r = e.target.closest('.pr'); if (r) { closePalette(); palList[Number(r.dataset.n)].run(); } });
pal.addEventListener('click', (e) => { if (e.target === pal) closePalette(); });
$('#palette-btn').addEventListener('click', openPalette);

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (!$('#boot').classList.contains('done')) return; // not behind the boot screen
    pal.classList.contains('open') ? closePalette() : openPalette();
  }
  // Keyboard activation for the clickable scanner findings.
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.scan-list .finding')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape') {
    if (sanct.cine?.playing) skipAscension();
    else if (pal.classList.contains('open')) closePalette();
    else if (sheet.classList.contains('open')) openTab('orbit');
    else if (current) closeInspector();
  }
});

// ------------------------------------------------------------------ misc
$('#sound-btn').classList.toggle('off', !state.sound);
$('#sound-btn').setAttribute('aria-pressed', String(state.sound));
$('#sound-btn').addEventListener('click', () => {
  state.sound = !state.sound; save(); setSound(state.sound);
  $('#sound-btn').classList.toggle('off', !state.sound);
  $('#sound-btn').setAttribute('aria-pressed', String(state.sound));
  if (state.sound) sfx.select();
});
$('#spin').addEventListener('click', () => {
  const on = orrery.spin === false;
  orrery.setSpin(on);
  $('#spin').setAttribute('aria-pressed', String(!on));
  $('#spin').classList.toggle('off', !on);
});
if (reduceMotion()) { orrery.setSpin(false); $('#spin').setAttribute('aria-pressed', 'true'); $('#spin').classList.add('off'); }

document.addEventListener('pointermove', (e) => {
  const g = e.target.closest?.('.glass');
  if (!g) return;
  const r = g.getBoundingClientRect();
  g.style.setProperty('--mx', `${e.clientX - r.left}px`);
  g.style.setProperty('--my', `${e.clientY - r.top}px`);
}, { passive: true });

let hinted = false;
setTimeout(() => { hinted = true; $('#hint').style.opacity = 0; }, 14000);
$('#scene').addEventListener('pointerdown', () => { if (!hinted) { hinted = true; $('#hint').style.opacity = 0; } });

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = `toast glass ${kind}`;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Letter copied — fill the [BRACKETS] before mailing.'); }
  catch { toast('Copy blocked by the browser — use Print instead.'); }
}

$('#scan-count').textContent = model.findings.filter((f) => f.severity === 'critical').length || '';
const reconciled = B.every((b) => model.report.summary[b].reconciled);
const pill = $('#recon-pill');
pill.textContent = report.meta.demo ? 'DEMO · fictional' : reconciled ? '✓ reconciled 3/3' : '⚠ check totals';
pill.classList.toggle('ok', !report.meta.demo && reconciled);
pill.classList.toggle('warn', !!report.meta.demo || !reconciled);
pill.title = report.meta.demo ? 'You are looking at a made-up demo report. Click to load your own.'
  : reconciled ? "Each bureau's account balances add up exactly to the report's own totals"
  : `Some totals did not add up — double-check against your report:\n${(report.meta.warnings || []).join('\n')}`;
pill.addEventListener('click', openReportPanel);

// ------------------------------------------------------------------ boot
(async function boot() {
  const log = $('#boot-log');
  const { summary, meta } = model.report;
  const crit = model.findings.filter((f) => f.severity === 'critical').length;
  const lines = [
    ['', `> CREDIT/OS — initializing`],
    [meta.demo ? 'warn' : '', `> ${meta.demo ? 'DEMO report (fictional people and creditors)' : 'your report'} · ${meta.reportDate} · ${meta.scoreModel || 'score model not shown'}`],
    ['ok', `> read ${model.accounts.length} accounts × 3 bureaus cell-by-cell, in this browser ......... ok`],
    [B.every((b) => summary[b].reconciled) ? 'ok' : 'warn', `> reconciling  ${B.map((b) => `${b} ${money(summary[b].balances)} ${summary[b].reconciled ? '✓' : '⚠'}`).join('  ')}`],
    ...(meta.warnings || []).map((w) => ['warn', `>   ⚠ ${w}`]),
    ['bad', `> anomaly engine: ${model.findings.length} findings · ${crit} critical`],
    ['warn', `> ${DISPUTES.length} dispute missions planned · ${model.report.inquiries.length} inquiries in orbit`],
    ['', '> entering orbit_'],
  ];
  const fast = state.booted || reduceMotion();
  let done = false;
  const onKey = (e) => { if (e.key === 'Enter' || e.key === 'Escape') finish(); };
  const finish = () => {
    if (done) return; done = true;
    document.removeEventListener('keydown', onKey);
    $('#boot').classList.add('done');
    orrery.startIntro();
    state.booted = true; save();
  };
  $('#boot-skip').addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  for (const [cls, text] of lines) {
    if (done) break;
    const span = document.createElement('span');
    span.className = cls;
    log.appendChild(span);
    if (fast) { span.textContent = text + '\n'; await wait(90); continue; }
    for (let i = 0; i <= text.length; i += 2) { if (done) break; span.textContent = text.slice(0, i); await wait(9); }
    span.textContent = text + '\n';
    await wait(170);
  }
  await wait(fast ? 250 : 650);
  finish();
})();
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ------------------------------------------------------------------ your info, printing, backup, import
// Name/address/DOB stay in this browser's storage. The SSN is never stored: it
// lives in memory only and must be re-entered each session.
let sessionSSN = '';
const profile = () => state.profile || {};
const profileComplete = () => !!(profile().name && profile().street && profile().cityStateZip && profile().dob);
function fill(text) {
  const p = profile();
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return text
    .replaceAll('[FULL LEGAL NAME]', p.name || '[FULL LEGAL NAME]')
    .replaceAll('[STREET ADDRESS]', p.street || '[STREET ADDRESS]')
    .replaceAll('[CITY, STATE ZIP]', p.cityStateZip || '[CITY, STATE ZIP]')
    .replaceAll('[DOB]', p.dob || '[DOB]')
    .replaceAll('[FULL SSN]', sessionSSN || '[FULL SSN]')
    .replaceAll('[DATE]', date);
}

function modal(html, onSubmit) {
  let m = $('#modal');
  if (!m) { m = document.createElement('div'); m.id = 'modal'; m.className = 'palette-wrap'; document.body.appendChild(m); }
  m.innerHTML = `<form class="palette glass modal-card" role="dialog" aria-modal="true">${html}</form>`;
  m.classList.add('open');
  const close = () => m.classList.remove('open');
  m.onclick = (e) => { if (e.target === m || e.target.closest('[data-close]')) { e.preventDefault(); close(); } };
  m.querySelector('form').onsubmit = (e) => { e.preventDefault(); if (onSubmit(new FormData(e.target)) !== false) close(); };
  m.querySelector('input, button')?.focus();
}

function openProfile() {
  const p = profile();
  modal(`<h2>👤 Your info for the letters</h2>
    <p class="fall">Name, address and date of birth are saved in this browser only. Your SSN is <b>never saved</b> — it stays in memory until you close the tab, and goes only into letters to the three bureaus.</p>
    <label>Full legal name<input name="name" value="${esc(p.name)}" autocomplete="name" required></label>
    <label>Street address (where you live now)<input name="street" value="${esc(p.street)}" autocomplete="address-line1" required></label>
    <label>City, state ZIP<input name="cityStateZip" value="${esc(p.cityStateZip)}" autocomplete="off" placeholder="Springfield, IL 62701" required></label>
    <label>Date of birth<input name="dob" value="${esc(p.dob)}" placeholder="MM/DD/YYYY" required></label>
    <label>Full SSN (this session only)<input name="ssn" value="${esc(sessionSSN)}" inputmode="numeric" autocomplete="off" placeholder="optional — or write it by hand"></label>
    <div class="modal-acts"><button class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div>`, (f) => {
    state.profile = { name: f.get('name').trim(), street: f.get('street').trim(), cityStateZip: f.get('cityStateZip').trim(), dob: f.get('dob').trim() };
    sessionSSN = f.get('ssn').replace(/[^\d-]/g, '');
    save();
    toast('Letters now fill in your info.');
    if (activeTab === 'letters') renderLetters(lastLetter.id, lastLetter.target);
  });
}
let lastLetter = { id: DISPUTES[0]?.id, target: undefined };

function printRound(roundId) {
  const ds = DISPUTES.filter((d) => d.round === roundId).sort((a, b) => a.priority - b.priority);
  const pages = [];
  const check = ['CERTIFIED MAIL CHECKLIST — ' + ROUNDS.find((r) => r.id === roundId).name, ''];
  for (const d of ds) {
    for (const b of d.bureaus) { pages.push(composeLetter(d, 'bureau', b)); check.push(`[ ] ${d.id} → ${BUREAU[b].name}   tracking #: ______________`); }
    d.extras.forEach((x, i) => { pages.push(composeLetter(d, 'extra', i)); check.push(`[ ] ${d.id} → ${x.to.split('\n')[0]}   tracking #: ______________`); });
  }
  check.push('', 'Each envelope: copy of ID, proof of address, highlighted report page. Certified mail, return receipt.',
    'SSN goes only to the three bureaus. Keep copies of everything. Mark each one "Mailed" in the app.');
  $('#print-area').innerHTML = [check.join('\n'), ...pages].map((t) => `<div class="print-page">${esc(t)}</div>`).join('');
  const left = pages.filter((t) => /\[(FULL LEGAL NAME|STREET ADDRESS|CITY, STATE ZIP|DOB)\]/.test(t)).length;
  if (left) toast(`${left} letters still have blank personal fields — add them in 👤 My info or fill by hand.`);
  window.print();
}

function backupNote() {
  const last = state.lastBackup;
  const days = last ? Math.floor((Date.now() - new Date(last)) / 864e5) : null;
  const touched = Object.keys(state.disputes).length > 0;
  if (!touched) return '';
  if (days == null || days > 7) return `<div class="backup-warn">⚠ ${days == null ? 'No backup yet' : `Last backup ${days} days ago`} — your progress lives only in this browser. <button class="btn" data-act="backup">⤓ Back up now</button></div>`;
  return '';
}
function backup() {
  // The report itself is included so a restore on another device needs no re-upload.
  // DEMO stays a marker so it always matches the current code.
  const reportRef = report.meta.demo ? 'DEMO' : report;
  const data = { app: 'credit-os-public', version: 1, exportedAt: new Date().toISOString(), reportSig,
    report: reportRef, disputes: state.disputes, quick: state.quick, profile: state.profile || null };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `credit-os-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  state.lastBackup = new Date().toISOString(); save();
  toast('Backup downloaded. It has no SSN, but it does contain your report — keep it somewhere private.');
  if (activeTab === 'missions') renderMissions();
}
function pickFile(accept, cb) {
  const i = document.createElement('input');
  i.type = 'file'; i.accept = accept;
  i.onchange = () => i.files[0] && i.files[0].text().then(cb);
  i.click();
}
function restore() {
  pickFile('.json,application/json', (txt) => {
    let data;
    try { data = JSON.parse(txt); } catch { toast('That file is not a valid backup.'); return; }
    if (data.app !== 'credit-os-public' || typeof data.disputes !== 'object' || !data.report) { toast('That file is not a CREDIT/OS backup.'); return; }
    modal(`<h2>⤒ Restore backup?</h2><p class="fall">From ${esc(new Date(data.exportedAt).toLocaleString())}. This replaces the dispute statuses and checklist in this browser.</p>
      <div class="modal-acts"><button class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Restore</button></div>`, () => {
      try { localStorage.setItem(REPORT_KEY, data.report === 'DEMO' ? 'DEMO' : JSON.stringify(data.report)); } catch { toast('This browser would not save the report.'); return false; }
      state.disputes = data.disputes; state.quick = data.quick || {}; if (data.profile) state.profile = data.profile;
      state.reportSig = data.reportSig; state.lastBackup = data.exportedAt; save();
      location.reload();
    });
  });
}

function importReport() {
  pickFile('.html,.htm,text/html', (html) => {
    let fresh;
    try { fresh = parseIdentityIQ(html); } catch (err) { toast(err instanceof ReportError ? err.message : 'Could not read that file.'); return; }
    fresh.date = fresh.meta.reportDate;
    const same = fresh.date === model.report.meta.reportDate;
    const daysSinceMailed = (id, b) => { const e = statusOf(id, b); return e.d ? (Date.now() - new Date(e.d + 'T00:00')) / 864e5 : 0; };
    const sugg = diffReports({ baseline: model.report, fresh, disputes: DISPUTES, statusOf, daysSinceMailed });
    const label = { deleted: 'Deleted ✦', corrected: 'Fixed', verified: 'Verified' };
    modal(`<h2>⇪ New report · ${esc(fresh.date || 'unknown date')}</h2>
      ${same ? '<p class="backup-warn">This report has the same date as your current one — pull a fresh report 30–45 days after mailing.</p>' : ''}
      <p class="fall">Compared with ${esc(model.report.meta.reportDate)}: ${fresh.accounts.length} accounts found. ${sugg.length ? 'Review each change before applying.' : 'No changes on your disputed accounts yet.'}</p>
      <div class="sugg-list">${sugg.map((x, n) => `<label class="sugg"><input type="checkbox" name="s${n}" ${x.soft ? '' : 'checked'}>
        <span><b>${esc(displayName(byKey.get(x.account)))} · ${BUREAU[x.bureau].name}</b> → ${label[x.to]}<br><small>${esc(x.why)}</small></span></label>`).join('')}</div>
      <div class="modal-acts"><button class="btn" data-close>Close</button>${sugg.length ? '<button class="btn primary" type="submit">Apply checked</button>' : ''}</div>`, (f) => {
      const picked = sugg.filter((_, n) => f.get('s' + n));
      picked.forEach((x) => setStatus(x.id, x.bureau, x.to));
      state.lastImport = { date: fresh.date, at: new Date().toISOString() }; save();
      toast(`${picked.length} update${picked.length === 1 ? '' : 's'} applied from the new report.`);
    });
  });
}

document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (!act) return;
  ({ profile: openProfile, 'print-round': () => printRound(act.dataset.round), backup, restore, import: importReport, report: openReportPanel })[act.dataset.act]?.();
});

// Load a different report, or wipe everything this app stored in the browser.
function openReportPanel() {
  const m = report.meta;
  modal(`<h2>📄 Your report</h2>
    <p class="fall">${m.demo ? '<b>Demo report</b> — fictional people and creditors, for exploring the app.' : `IdentityIQ report dated <b>${esc(m.reportDate)}</b> · ${model.accounts.length} accounts.`}
      It is stored only in this browser — nothing was uploaded.</p>
    ${(m.warnings || []).length ? `<div class="backup-warn">⚠ Some totals did not add up. Double-check these against your report:<br>${m.warnings.map(esc).join('<br>')}</div>` : ''}
    <div class="modal-acts" style="flex-wrap:wrap;justify-content:flex-start">
      <button class="btn primary" type="button" data-rp="switch">⇄ Reset the demo</button>
      <button class="btn" type="button" data-rp="wipe">🗑 Delete my data</button>
      <span style="flex:1"></span><button class="btn" data-close>Close</button></div>
    <p class="fall" style="margin-top:10px">A different report starts a new plan (dispute progress is reset — back it up first). To check results of letters you mailed, use <b>Missions → Import new report</b> instead.</p>`, () => false);
  $('#modal').querySelector('[data-rp="switch"]').onclick = () => {
    if (Object.keys(state.disputes).length && !confirm('Start over with a different report? Your dispute progress for this report will be cleared.')) return;
    try { localStorage.removeItem(REPORT_KEY); } catch { /* ignore */ }
    location.reload();
  };
  $('#modal').querySelector('[data-rp="wipe"]').onclick = () => {
    if (!confirm('Delete your report, your info and all progress from this browser? This cannot be undone (download a backup first if you want one).')) return;
    try { localStorage.removeItem(REPORT_KEY); localStorage.removeItem(KEY); } catch { /* ignore */ }
    sessionSSN = '';
    location.reload();
  };
}

// ------------------------------------------------------------------ deadline reminders
// Due dates live only in this browser, so reminders go to the user's own calendar
// (.ics with an alert) and to in-app / system notifications when the app opens.
const dueDate = (e) => { const [y, m, d] = e.d.split('-').map(Number); return new Date(y, m - 1, d + 35); };
function mailedEntries() {
  return DISPUTES.flatMap((d) => d.bureaus.map((b) => ({ d, b, e: statusOf(d.id, b) })))
    .filter((x) => x.e.s === 'mailed' && x.e.d);
}
const icsDate = (dt) => `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
const icsEsc = (t) => t.replace(/[\\,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
function icsEvent({ d, b, e }) {
  const due = dueDate(e), next = new Date(due); next.setDate(next.getDate() + 1);
  const what = `${d.id} · ${d.title} → ${BUREAU[b].name}`;
  const desc = `Mailed ${e.d}. The 30-day reinvestigation window (plus mail time) ends today.\n` +
    `If ${BUREAU[b].name} hasn't answered or the item is unchanged: pull a new report, import it in CREDIT/OS, ` +
    `then request their method of verification (15 U.S.C. 1681i(a)(7)) and file a CFPB complaint at consumerfinance.gov/complaint.`;
  return ['BEGIN:VEVENT', `UID:${d.id}-${b}-${e.d}@credit-os-public`, `DTSTAMP:${icsDate(new Date())}T090000`,
    `DTSTART;VALUE=DATE:${icsDate(due)}`, `DTEND;VALUE=DATE:${icsDate(next)}`,
    `SUMMARY:${icsEsc('Credit dispute due: ' + what)}`, `DESCRIPTION:${icsEsc(desc)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT9H', `DESCRIPTION:${icsEsc('Dispute response due: ' + what)}`, 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P2DT15H', `DESCRIPTION:${icsEsc('3 days left: ' + what)}`, 'END:VALARM',
    'END:VEVENT'].join('\r\n');
}
function downloadICS(entries, name) {
  if (!entries.length) { toast('Nothing mailed yet — mark a letter "Mailed" first.'); return; }
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CREDIT-OS Public//EN', 'CALSCALE:GREGORIAN', ...entries.map(icsEvent), 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${entries.length} due date${entries.length === 1 ? '' : 's'} saved — open the file to add ${entries.length === 1 ? 'it' : 'them'} to Calendar.`);
}
function checkDeadlines(system = false) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const soon = mailedEntries().map((x) => ({ ...x, days: Math.round((dueDate(x.e) - now) / 864e5) })).filter((x) => x.days <= 3);
  const over = soon.filter((x) => x.days < 0), near = soon.filter((x) => x.days >= 0);
  const btn = document.querySelector('#tabs [data-tab="missions"]');
  btn.querySelector('.due-badge')?.remove();
  if (soon.length) btn.insertAdjacentHTML('beforeend', `<span class="count due-badge" title="Dispute deadlines">${soon.length}</span>`);
  if (!soon.length) return;
  const msg = over.length
    ? `⏰ ${over.length} dispute${over.length === 1 ? ' is' : 's are'} past the 35-day mark — pull a new report and escalate.`
    : `⏰ ${near.length} dispute deadline${near.length === 1 ? '' : 's'} in the next 3 days.`;
  toast(msg);
  if (system && 'Notification' in window && Notification.permission === 'granted' && state.lastNotified !== today()) {
    new Notification('CREDIT/OS — dispute deadlines', { body: msg.replace('⏰ ', '') });
    state.lastNotified = today(); save();
  }
}
function refreshDueBadge() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const n = mailedEntries().filter((x) => Math.round((dueDate(x.e) - now) / 864e5) <= 3).length;
  const btn = document.querySelector('#tabs [data-tab="missions"]');
  btn.querySelector('.due-badge')?.remove();
  if (n) btn.insertAdjacentHTML('beforeend', `<span class="count due-badge" title="Dispute deadlines">${n}</span>`);
}
async function enableNotifications() {
  if (!('Notification' in window)) { toast('This browser does not support notifications — use 📅 calendar reminders.'); return; }
  const p = await Notification.requestPermission();
  toast(p === 'granted' ? 'Alerts on: you’ll get a notification when you open the app near a deadline. For reminders when it’s closed, use 📅.' : 'Notifications blocked — use 📅 calendar reminders instead.');
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act="ics"], [data-act="ics-all"], [data-act="notify"]');
  if (!a) return;
  if (a.dataset.act === 'notify') return enableNotifications();
  if (a.dataset.act === 'ics-all') return downloadICS(mailedEntries(), `credit-disputes-due-${today()}.ics`);
  const d = DISPUTES.find((x) => x.id === a.dataset.d);
  downloadICS([{ d, b: a.dataset.b, e: statusOf(d.id, a.dataset.b) }], `${d.id}-${a.dataset.b}-due.ics`);
});
setTimeout(() => checkDeadlines(true), 6000); // after the boot sequence

openTab(N ? 'sanctuary' : 'orbit');
