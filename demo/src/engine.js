// Anomaly engine: derives every cross-bureau discrepancy and impossible
// sequence straight from the raw report cells, so nothing shown in the UI is a
// hand-typed claim. The report comes from the user's own file (src/parser.js)
// or the fictional demo — call analyze(report) before anything else.
let REPORT = null;

export const B = ['TU', 'EX', 'EQ'];
export const BUREAU = {
  TU: { name: 'TransUnion', short: 'TU', color: '#38bdf8' },
  EX: { name: 'Experian', short: 'EX', color: '#a78bfa' },
  EQ: { name: 'Equifax', short: 'EQ', color: '#34d399' },
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Month index = year * 12 + (month - 1)
export const mi = (s) => {
  if (!s) return null;
  const [m, , y] = s.split('/').map(Number);
  return y * 12 + (m - 1);
};
const hmi = (s) => { const [y, m] = s.split('-').map(Number); return y * 12 + (m - 1); };
export const fmtMi = (i) => (i == null ? '—' : `${MON[i % 12]} ${Math.floor(i / 12)}`);
export const money = (n) => (n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US'));
export let REPORT_MI = null;

const LEVEL = { OK: 0, 30: 1, 60: 2, 90: 3, 120: 4, 150: 5, 180: 6 };
const STAGE = [null, '30', '60', '90', '120', '150', '180'];
const DEROG = /Collection|Chargeoff|Derogatory/i;
const reporting = (a) => B.filter((b) => a.bureaus[b]);

/** Does this bureau report the account negatively? (Negativity is per bureau:
 *  Equifax can report an account Paid/Current while TransUnion calls it Derogatory.) */
export function negOn(a, b) {
  const d = a.bureaus[b];
  if (!d) return false;
  return DEROG.test(d.status || '') || DEROG.test(d.payStatus || '') || /Late/.test(d.payStatus || '')
    || (a.history?.[b] || []).some((v) => v && v !== 'OK');
}
export const negBureaus = (a) => reporting(a).filter((b) => negOn(a, b));
export const isNegative = (a) => negBureaus(a).length > 0;
const isChargedOff = (a) => kindOf(a) === 'collection'
  || reporting(a).some((b) => /Collection|Chargeoff/i.test(a.bureaus[b].payStatus || '') || /Derogatory/i.test(a.bureaus[b].status || ''));

const primary = (a) => a.bureaus[reporting(a)[0]];
export const balanceOf = (a) => Math.max(...reporting(a).map((b) => a.bureaus[b].balance || 0));
export const kindOf = (a) => {
  const d = primary(a);
  if (reporting(a).some((b) => /^Collection/i.test(a.bureaus[b].detail || '') || /^Collection/i.test(a.bureaus[b].type || ''))) return 'collection';
  if (/Installment/i.test(d.type || '')) return 'installment';
  if (/Revolving|Credit Line/i.test(d.type || '')) return 'revolving';
  return 'open';
};

/** Chronological history for one bureau: [{m, v}] oldest → newest, reported cells only. */
function chrono(a, b) {
  const h = a.history;
  if (!h?.[b]) return [];
  return h.months.map((m, i) => ({ m: hmi(m), v: h[b][i] })).filter((x) => x.v).reverse();
}

/** The most recent run of consecutive non-OK months (the delinquency that matters now). */
function latestRun(seq) {
  let end = -1;
  for (let i = seq.length - 1; i >= 0; i--) if (seq[i].v !== 'OK') { end = i; break; }
  if (end < 0) return null;
  let start = end;
  while (start > 0 && seq[start - 1].v !== 'OK' && seq[start].m - seq[start - 1].m === 1) start--;
  return { first: seq[start], last: seq[end], endIdx: end, atWindowStart: start === 0 };
}

/**
 * Estimated date of first delinquency (DOFD) and when the item ages off.
 * - falloff: DOFD + 7 years — when bureaus typically remove it.
 * - legalMax: for charge-offs/collections the law allows 7 years starting 180 days after
 *   the delinquency began (15 U.S.C. § 1681c(c)(1)), i.e. about 6 months later.
 * - bound 'no-later-than' when the report only shows that the delinquency started by then.
 */
export function estimateFallOff(a) {
  const negs = negBureaus(a);
  if (!negs.length) return null;
  if (negs.every((b) => a.bureaus[b].responsibility === 'Authorized User')) {
    return { dofd: null, falloff: null, legalMax: null, basis: 'Authorized user — removable now', confidence: 'n/a' };
  }
  const co = isChargedOff(a);
  const collection = kindOf(a) === 'collection';
  const exact = [], bounds = [];
  for (const b of negs) {
    const d = a.bureaus[b];
    const run = latestRun(chrono(a, b));
    if (run) {
      const { m, v } = run.first;
      if (LEVEL[v]) {
        const c = { m: m - LEVEL[v], basis: `${BUREAU[b].short} ${v}-day late in ${fmtMi(m)}` };
        (run.atWindowStart || v === '180' ? bounds : exact).push(c);
      } else {
        // Already charged off when the history window starts: charge-offs follow at least ~120 days late.
        bounds.push({ m: m - 4, basis: `${BUREAU[b].short} already charged off in ${fmtMi(m)}` });
      }
    }
    const lp = mi(d.lastPayment), la = mi(d.lastActive);
    const late = (d.payStatus || '').match(/Late (\d+)/)?.[1];
    if (late && LEVEL[late] && lp != null && (/Paid/i.test(d.status || '') || d.balance === 0)) {
      exact.push({ m: lp - LEVEL[late], basis: `${BUREAU[b].short} "${d.payStatus}" when paid off ${fmtMi(lp)}` });
    } else if (co && lp != null) {
      exact.push({ m: lp + 1, basis: `${BUREAU[b].short} last payment ${fmtMi(lp)}` });
    } else if (co && !collection && la != null && !d.lastPayment) {
      exact.push({ m: la + 1, basis: `${BUREAU[b].short} last active ${fmtMi(la)}` });
    }
  }
  let best = exact.length ? exact.reduce((x, y) => (y.m < x.m ? y : x)) : null;
  let bound = false;
  const tightest = bounds.length ? bounds.reduce((x, y) => (y.m < x.m ? y : x)) : null;
  if (tightest && (!best || tightest.m < best.m)) { best = tightest; bound = true; }
  if (!best) {
    if (collection) {
      const opened = Math.min(...reporting(a).map((b) => mi(a.bureaus[b].opened)).filter((x) => x != null));
      if (!Number.isFinite(opened)) return { dofd: null, falloff: null, legalMax: null, basis: 'Not enough data to estimate', confidence: 'low' };
      return { dofd: null, falloff: opened + 84, legalMax: opened + 90, bound: true, basis: `Delinquency date not reported — the debt was already delinquent when placed for collection (${fmtMi(opened)})`, confidence: 'low' };
    }
    return { dofd: null, falloff: null, legalMax: null, basis: 'Not enough data to estimate', confidence: 'low' };
  }
  return {
    dofd: best.m, falloff: best.m + 84, legalMax: best.m + (co ? 90 : 84), bound, basis: best.basis,
    confidence: collection || bound ? 'low' : 'medium',
    lateOnly: !co, // an account that is current again: only the late mark ages off, not the account
  };
}

// ---------------------------------------------------------------- findings
const FIELDS = [
  ['balance', 'Balance', 'money'], ['pastDue', 'Past due', 'money'], ['highCredit', 'High credit', 'money'],
  ['limit', 'Credit limit', 'money'], ['status', 'Account status', 'text'], ['payStatus', 'Payment status', 'text'],
  ['terms', 'Terms', 'text'], ['detail', 'Type detail', 'text'],
  ['opened', 'Date opened', 'month'], ['lastActive', 'Last active', 'month'], ['lastPayment', 'Last payment', 'month'],
];
export const SEVERITY = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function fieldFindings(a, neg) {
  const out = [];
  const bs = reporting(a);
  if (bs.length < 2) return out;
  for (const [k, label, kind] of FIELDS) {
    const vals = Object.fromEntries(bs.map((b) => [b, a.bureaus[b][k] ?? null]));
    const norm = (v) => (kind === 'month' ? mi(v) : v);
    const distinct = new Set(bs.map((b) => JSON.stringify(norm(vals[b]))));
    if (distinct.size < 2) continue;
    const present = bs.filter((b) => vals[b] != null);
    const conflict = new Set(present.map((b) => JSON.stringify(norm(vals[b])))).size > 1;
    const show = bs.map((b) => `${BUREAU[b].short} ${kind === 'money' ? money(vals[b]) : vals[b] ?? '—'}`).join(' · ');
    let sev = 'low';
    if (k === 'terms' && present.some((b) => String(vals[b]) === '0')) sev = 'low';
    else if (neg) {
      if (['lastActive', 'lastPayment'].includes(k)) sev = 'high';
      else if (['status', 'payStatus'].includes(k)) sev = 'high';
      else if (kind === 'money') sev = 'medium';
      else sev = k === 'opened' ? 'low' : 'medium';
    } else if (k === 'limit') sev = 'low';
    else sev = 'info';
    if (!conflict) {
      const missing = bs.filter((b) => vals[b] == null).map((b) => BUREAU[b].short).join('/');
      out.push({ rule: 'missing', field: k, severity: neg ? 'low' : 'info', bureaus: bs, title: `${label} not reported by ${missing}`, detail: show });
      continue;
    }
    out.push({ rule: 'mismatch', field: k, severity: sev, bureaus: bs, title: `${label} differs across bureaus`, detail: show });
  }
  return out;
}

function ruleFindings(a, neg) {
  const out = [];
  for (const b of reporting(a)) {
    const d = a.bureaus[b];
    const opened = mi(d.opened);
    const negB = negOn(a, b);
    // A collection's "opened" date is when the collector got the debt, so earlier
    // payments to the original creditor are normal — only check original-creditor accounts.
    if (kindOf(a) !== 'collection') {
      const early = ['lastPayment', 'lastActive'].filter((k) => opened != null && mi(d[k]) != null && mi(d[k]) < opened);
      if (early.length) {
        out.push({ rule: 'before-open', severity: 'critical', bureaus: [b], title: 'Payment or activity dated before the account opened',
          detail: `${BUREAU[b].name}: ${early.map((k) => `${k === 'lastPayment' ? 'last payment' : 'last active'} ${d[k]}`).join(', ')} vs opened ${d.opened}` });
      }
    }
    if (d.responsibility === 'Authorized User' && negB) {
      out.push({ rule: 'au-derog', severity: 'critical', bureaus: [b], title: 'Derogatory account where you are only an authorized user',
        detail: `${BUREAU[b].name}: Bureau Code "Authorized User", ${d.payStatus}, ${money(d.pastDue)} past due — an AU is not liable` });
    }
    if (/Derogatory/i.test(d.status || '') && d.payStatus === 'Current') {
      out.push({ rule: 'status-conflict', severity: 'high', bureaus: [b], title: 'Status says Derogatory, payment status says Current',
        detail: `${BUREAU[b].name}: status "${d.status}" vs payment status "${d.payStatus}"` });
    }
    // "Paid" + "Late 60" can be a legitimate paid-but-was-late rating; flag it only when
    // this bureau's own history shows no late payment to back it up.
    if (/Paid/i.test(d.status || '') && /Late/.test(d.payStatus || '') && !(a.history?.[b] || []).some((v) => v && v !== 'OK')) {
      out.push({ rule: 'status-conflict', severity: 'medium', bureaus: [b], title: `Paid account rated "${d.payStatus}" with no late payment in its history`,
        detail: `${BUREAU[b].name}: status "${d.status}", payment status "${d.payStatus}", no late month shown` });
    }
    if (/Installment/i.test(d.type || '') && d.balance > (d.highCredit || Infinity) && d.highCredit > 0) {
      out.push({ rule: 'over-financed', severity: 'medium', bureaus: [b], title: 'Balance exceeds the amount financed — ask for an itemization',
        detail: `${BUREAU[b].name}: balance ${money(d.balance)} > original ${money(d.highCredit)} on ${d.terms}-month terms` });
    }
    if (DEROG.test(d.payStatus || '') && d.pastDue != null && d.balance != null && d.pastDue !== d.balance) {
      out.push({ rule: 'balance-pastdue', severity: 'medium', bureaus: [b], title: 'Charged-off balance ≠ past-due amount',
        detail: `${BUREAU[b].name}: balance ${money(d.balance)} vs past due ${money(d.pastDue)}` });
    }
    const lr = mi(d.lastReported);
    if (negB && lr != null && REPORT_MI - lr >= 24 && (d.pastDue || 0) > 0) {
      out.push({ rule: 'stale', severity: 'medium', bureaus: [b], title: 'Past-due balance not updated in 2+ years',
        detail: `${BUREAU[b].name}: last reported ${d.lastReported} with ${money(d.pastDue)} past due` });
    }
    const la = mi(d.lastActive), lp = mi(d.lastPayment);
    if (negB && la != null && lp != null && la - lp >= 12) {
      const note = (d.comments || []).find((c) => /dispute/i.test(c));
      out.push({ rule: 'activity-gap', severity: 'high', bureaus: [b], title: 'Recent activity date on an account with no payment in years — verify the delinquency date',
        detail: `${BUREAU[b].name}: last active ${d.lastActive}, last payment ${d.lastPayment} (${la - lp} months apart)${note ? `. Comment on file: “${note}” — the date may reflect that dispute` : ''}` });
    }
    // History sequence checks
    const seq = chrono(a, b);
    for (let i = 1; i < seq.length; i++) {
      const p = seq[i - 1], c = seq[i];
      if (c.m - p.m !== 1) continue;
      const lp_ = LEVEL[p.v], lc = LEVEL[c.v];
      if (lp_ != null && lc != null && lc - lp_ > 1) {
        out.push({ rule: 'skipped-stage', severity: 'high', bureaus: [b], title: `Goes from ${p.v === 'OK' ? 'current' : p.v + ' days late'} to ${c.v} days late with no ${STAGE[lp_ + 1]}-day late reported`,
          detail: `${BUREAU[b].name}: ${fmtMi(p.m)} ${p.v} → ${fmtMi(c.m)} ${c.v}. Ask the creditor to verify the missed due date.` });
      }
    }
    const run = latestRun(seq);
    const coNow = DEROG.test(d.payStatus || '') || /Late/.test(d.payStatus || '');
    if (coNow && seq.length) {
      if (!run) {
        out.push({ rule: 'history-contradiction', severity: 'high', bureaus: [b], title: 'History shows only on-time months on a derogatory account',
          detail: `${BUREAU[b].name}: ${seq.length} months "OK" (${fmtMi(seq[0].m)}–${fmtMi(seq.at(-1).m)}) while status is "${d.payStatus}"` });
      } else {
        const okAfter = seq.slice(run.endIdx + 1).filter((x) => x.v === 'OK');
        if (okAfter.length && /Collection|Chargeoff/i.test(d.payStatus || '')) {
          out.push({ rule: 'history-contradiction', severity: 'high', bureaus: [b], title: 'On-time months reported after the charge-off',
            detail: `${BUREAU[b].name}: ${okAfter.length} months "OK" (${fmtMi(okAfter[0].m)}–${fmtMi(okAfter.at(-1).m)}) after ${run.last.v} in ${fmtMi(run.last.m)}, status "${d.payStatus}"` });
        }
      }
    }
  }
  // First-delinquency month disagreement across bureaus
  const firsts = reporting(a).map((b) => {
    const r = latestRun(chrono(a, b));
    return r && LEVEL[r.first.v] && !r.atWindowStart ? { b, m: r.first.m, v: r.first.v } : null;
  }).filter(Boolean);
  if (firsts.length > 1 && new Set(firsts.map((f) => f.m - LEVEL[f.v])).size > 1) {
    out.push({ rule: 'dofd-mismatch', severity: 'high', bureaus: firsts.map((f) => f.b), title: 'Bureaus disagree on when the delinquency started',
      detail: firsts.map((f) => `${BUREAU[f.b].short} first ${f.v}-day late ${fmtMi(f.m)}`).join(' · ') });
  }
  // Same month, different story: one bureau says on time, another says late/charged off.
  if (a.history) {
    const spans = [];
    a.history.months.map((m, i) => ({ m: hmi(m), i })).reverse().forEach(({ m, i }) => {
      const vals = reporting(a).map((b) => [b, a.history[b]?.[i]]).filter(([, v]) => v);
      const ok = vals.filter(([, v]) => v === 'OK'), bad = vals.filter(([, v]) => v !== 'OK');
      if (!ok.length || !bad.length) return;
      const sig = bad.map(([b, v]) => `${BUREAU[b].short} ${v}`).join(', ') + ' vs ' + ok.map(([b]) => BUREAU[b].short).join('/') + ' OK';
      const last = spans.at(-1);
      if (last && last.sig === sig && last.to === m - 1) last.to = m; else spans.push({ sig, from: m, to: m, bs: vals.map(([b]) => b) });
    });
    if (spans.length) {
      out.push({ rule: 'month-conflict', severity: 'high', bureaus: [...new Set(spans.flatMap((x) => x.bs))], title: 'Same month reported differently by the bureaus',
        detail: spans.map((x) => `${fmtMi(x.from)}${x.to !== x.from ? '–' + fmtMi(x.to) : ''}: ${x.sig}`).join('\n') });
    }
  }
  const collection = kindOf(a) === 'collection';
  if (collection && neg && !a.originalCreditor) {
    out.push({ rule: 'no-oc', severity: 'high', bureaus: reporting(a), title: 'Collection with no original creditor reported',
      detail: 'Neither bureau names the original creditor. Ask the collector to identify it and the date of first delinquency.' });
  }
  return out;
}

/** Collapse the same rule firing on several bureaus into one finding. */
function merge(list) {
  const map = new Map();
  for (const f of list) {
    const k = f.rule + '|' + f.title;
    const m = map.get(k);
    if (!m) { map.set(k, { ...f, details: [f.detail] }); continue; }
    m.bureaus = [...new Set([...m.bureaus, ...f.bureaus])];
    m.details.push(f.detail);
  }
  return [...map.values()].map((f) => ({ ...f, detail: f.details.join('\n') }));
}

export function personalFindings() {
  const p = REPORT.personal, out = [];
  if (new Set(Object.values(p.nameParts)).size > 1) {
    out.push({ rule: 'pii', severity: 'medium', bureaus: B, title: 'Name reported differently',
      detail: B.map((b) => `${BUREAU[b].short} ${p.nameParts[b]} name parts`).join(' · ') });
  }
  const city = (v) => (v || '').replace(/-\d{4}$/, '');
  if (new Set(B.map((b) => city(p.currentCity[b]))).size > 1) {
    out.push({ rule: 'pii', severity: 'medium', bureaus: B, title: 'Current address differs',
      detail: B.map((b) => `${BUREAU[b].short} ${p.currentCity[b] ?? '—'}`).join(' · ') });
  }
  const emp = (b) => (p.employers[b] || []).join(', ');
  if (new Set(B.map(emp)).size > 1) {
    out.push({ rule: 'pii', severity: 'low', bureaus: B, title: 'Employers listed on one bureau only',
      detail: B.map((b) => `${BUREAU[b].short} ${emp(b) || 'none'}`).join(' · ') });
  }
  const yearOnly = B.filter((b) => p.dobPrecision?.[b] === 'year');
  if (yearOnly.length) {
    out.push({ rule: 'pii', severity: 'low', bureaus: yearOnly, title: 'Date of birth shows only the year',
      detail: B.map((b) => `${BUREAU[b].short} ${p.dobPrecision?.[b] === 'full' ? 'full date' : p.dobPrecision?.[b] === 'year' ? 'year only' : 'not shown'}`).join(' · ') });
  }
  return out;
}

export function analyze(report) {
  REPORT = report;
  REPORT_MI = mi(report.meta.reportDate);
  const accounts = REPORT.accounts.map((a) => {
    const neg = isNegative(a);
    const findings = [...merge(ruleFindings(a, neg)), ...fieldFindings(a, neg)]
      .sort((x, y) => SEVERITY[y.severity] - SEVERITY[x.severity]);
    const heat = findings.reduce((s, f) => s + SEVERITY[f.severity], 0);
    return { ...a, neg, negBureaus: negBureaus(a), kind: kindOf(a), balance: balanceOf(a), reporting: reporting(a), findings, heat, fall: estimateFallOff(a) };
  });
  // Several accounts from one creditor: tell them apart by kind, then by number.
  const byCred = {};
  for (const a of accounts) (byCred[a.creditor] ||= []).push(a);
  for (const group of Object.values(byCred)) {
    if (group.length < 2) continue;
    const KIND = { installment: 'Loan', revolving: 'Card', collection: 'Collection', open: 'Account' };
    for (const a of group) a.tag = KIND[a.kind];
    for (const a of group) {
      if (group.filter((x) => x.tag === KIND[a.kind]).length < 2) continue;
      const num = (a.bureaus[a.reporting[0]].number || '').replace(/\*+$/, '').slice(-4);
      a.tag = `${KIND[a.kind]}${num ? ' ' + num : ' ' + (group.indexOf(a) + 1)}`;
    }
  }
  const personal = personalFindings();
  const all = [
    ...personal.map((f) => ({ ...f, account: null })),
    ...accounts.flatMap((a) => a.findings.filter((f) => f.severity !== 'info').map((f) => ({ ...f, account: a.key }))),
  ].sort((x, y) => SEVERITY[y.severity] - SEVERITY[x.severity]);
  return { report: REPORT, accounts, personal, findings: all };
}
