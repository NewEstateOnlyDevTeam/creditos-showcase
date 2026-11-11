// Compare a NEW report (already parsed by src/parser.js) with the baseline and
// suggest dispute outcomes. Nothing leaves the browser.
const B = ['TU', 'EX', 'EQ'];
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const cell = (td) => { const v = clean(td.textContent).replace(/\s+-$/, ''); return v === '' || v === '-' ? null : v; };
const money = (v) => (v == null ? null : Number(v.replace(/[$,]/g, '')));
const DEROG = /Collection|Chargeoff|Derogatory/i;

const negEntry = (d) => !!d && (DEROG.test(d.status || '') || DEROG.test(d.payStatus || '') || /Late/.test(d.payStatus || ''));
const numKey = (n) => (n || '').replace(/\*+$/, '').slice(0, 6);

/** Find the account in `fresh` that matches a baseline account (same creditor + account-number prefix). */
function match(base, fresh) {
  const cands = fresh.accounts.filter((a) => a.creditor === base.creditor);
  if (cands.length <= 1) return cands[0] ?? null;
  const prefixes = B.map((b) => numKey(base.bureaus[b]?.number)).filter(Boolean);
  return cands.find((a) => B.some((b) => a.bureaus[b] && prefixes.includes(numKey(a.bureaus[b].number)))) ?? null;
}

/**
 * Suggestions: [{ id, account, bureau, from, to, why }]
 * to: 'deleted' (entry gone) | 'corrected' (still there, no longer negative) | 'verified' (unchanged after the response window)
 */
export function diffReports({ baseline, fresh, disputes, statusOf, daysSinceMailed }) {
  const out = [];
  for (const d of disputes) {
    if (!d.account) continue;
    const base = baseline.accounts.find((a) => a.key === d.account);
    const now = match(base, fresh);
    for (const b of d.bureaus) {
      const was = base.bureaus[b];
      if (!was) continue;
      const cur = statusOf(d.id, b).s;
      if (['deleted', 'corrected'].includes(cur)) continue;
      const is = now?.bureaus[b] ?? null;
      if (!is) {
        out.push({ id: d.id, account: d.account, bureau: b, from: cur, to: 'deleted', why: 'No longer on this bureau' });
      } else if (negEntry(was) && !negEntry(is)) {
        out.push({ id: d.id, account: d.account, bureau: b, from: cur, to: 'corrected', why: `Now reported "${is.payStatus || is.status}"` });
      } else {
        const changed = ['balance', 'pastDue', 'highCredit', 'payStatus', 'status'].filter((k) => String(was[k] ?? '') !== String(is[k] ?? ''));
        if (changed.length) out.push({ id: d.id, account: d.account, bureau: b, from: cur, to: 'corrected', why: `Changed: ${changed.join(', ')} — check it's the fix you asked for`, soft: true });
        else if (cur === 'mailed' && daysSinceMailed(d.id, b) >= 30) out.push({ id: d.id, account: d.account, bureau: b, from: cur, to: 'verified', why: 'Unchanged 30+ days after mailing' });
      }
    }
  }
  return out;
}
