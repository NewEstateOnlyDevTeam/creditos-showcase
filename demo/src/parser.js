// Parse an IdentityIQ 3-bureau report (saved as .html) into the REPORT shape the
// engine uses — entirely in the browser; the file never leaves this device.
//
// Reads table cells column by column (flat text drops blank bureau cells and
// shifts values into the wrong bureau), then reconciles each bureau's account
// balances, account count and inquiry count against the report's own Summary.
//
// Deliberately keeps no name, date of birth or street address: only how many
// name parts each bureau shows, whether the DOB is full or year-only, and the
// "CITY, ST ZIP" line of each address.
const BUREAUS = ['TU', 'EX', 'EQ'];
const BUREAU_NAMES = { TransUnion: 'TU', Experian: 'EX', Equifax: 'EQ' };
const MONTHS = Object.fromEntries(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => [m, i + 1]));
const FIELD_KEYS = {
  'Account #:': 'number', 'Account Type:': 'type', 'Account Type - Detail:': 'detail', 'Bureau Code:': 'responsibility',
  'Account Status:': 'status', 'Monthly Payment:': 'payment', 'Date Opened:': 'opened', 'Balance:': 'balance',
  'No. of Months (terms):': 'terms', 'High Credit:': 'highCredit', 'Credit Limit:': 'limit', 'Past Due:': 'pastDue',
  'Payment Status:': 'payStatus', 'Last Reported:': 'lastReported', 'Comments:': 'comments',
  'Date Last Active:': 'lastActive', 'Date of Last Payment:': 'lastPayment',
};
const MONEY = new Set(['payment', 'balance', 'highCredit', 'limit', 'pastDue']);
const SUMMARY = ['Total Accounts:', 'Open Accounts:', 'Closed Accounts:', 'Delinquent:', 'Derogatory:', 'Collection:',
  'Balances:', 'Payments:', 'Public Records:', 'Inquiries(2 years):'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
/** Visible text nodes under el (never script/style), in document order. */
function strings(el) {
  const out = [];
  const w = el.ownerDocument.createTreeWalker(el, 4 /* SHOW_TEXT */);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    let p = n.parentNode, skip = false;
    while (p && p !== el.parentNode) { if (SKIP.has(p.nodeName)) { skip = true; break; } p = p.parentNode; }
    if (!skip) out.push(n.nodeValue);
  }
  return out;
}
const text = (el) => clean(strings(el).join(' '));
const lines = (el) => strings(el).join('\n').split('\n').map(clean).filter(Boolean);
const cellValue = (td) => { const v = text(td).replace(/\s+-$/, ''); return v === '' || v === '-' ? null : v; };
const money = (v) => (v == null ? null : Number(v.replace(/[$,]/g, '')));
const tds = (tr) => [...tr.children].filter((c) => c.nodeName === 'TD');

function cityLine(td) {
  const ls = lines(td);
  const joined = [];
  ls.forEach((line, i) => {
    if (line.endsWith(',') && i + 1 < ls.length) joined.push(`${line} ${ls[i + 1]}`);
    else if (line.includes(',')) joined.push(line);
  });
  const hit = joined.find((j) => /,\s*[A-Z]{2}\b/.test(j));
  if (!hit) return null;
  const zip = ls.find((l) => /^\d{5}(-\d{4})?$/.test(l))?.slice(0, 5) ?? '';
  return `${hit} ${zip}`.trim();
}

function* rows4(table) {
  for (const tr of table.querySelectorAll('tr')) {
    const cells = tds(tr);
    if (cells.length === 4) yield [text(cells[0]), cells.slice(1)];
  }
}

function slug(name, taken) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let key = base, n = 2;
  while (taken.has(key)) key = `${base}-${n++}`;
  taken.add(key);
  return key;
}

function parseFlags(page) {
  const flags = { TU: [], EX: [], EQ: [] };
  const m = page.match(/SECURITY FREEZE[^:]*\):\s*((?:TRANSUNION|EXPERIAN|EQUIFAX|,|AND|\s)+)/);
  if (m) for (const [name, b] of [['TRANSUNION', 'TU'], ['EXPERIAN', 'EX'], ['EQUIFAX', 'EQ']]) if (m[1].includes(name)) flags[b].push('Security freeze');
  const stmt = page.match(/Customer Statement([\s\S]*?)(?:Personal Information|\{\{)/);
  if (stmt) {
    const parts = stmt[1].split(/(TransUnion|Experian|Equifax):/);
    for (let i = 1; i + 1 < parts.length; i += 2) {
      const b = BUREAU_NAMES[parts[i]], body = parts[i + 1];
      const since = body.match(/BEGINNING (\d{2})-(\d{2})-(\d{2})/);
      if (body.includes('SECURITY ALERT')) {
        flags[b].push(since ? `ID security alert until ${since[1]}/${since[2]}/20${String(Number(since[3]) + 1).padStart(2, '0')}` : 'ID security alert');
      }
      if (body.includes('INITIAL ALERT')) flags[b].push('Initial fraud alert');
    }
  }
  return Object.fromEntries(BUREAUS.map((b) => [b, flags[b].join(' · ') || null]));
}

function parseHistory(table) {
  const trs = [...table.querySelectorAll('tr')];
  const monthCells = [...trs[0].querySelectorAll('td')].slice(1);
  const yearCells = [...trs[1].querySelectorAll('td')].slice(1);
  const months = [];
  monthCells.forEach((m, i) => {
    if (!yearCells[i]) return;
    const mon = MONTHS[text(m).slice(0, 3)];
    const yr = text(yearCells[i]);
    if (mon && /^\d{2}$/.test(yr)) months.push(`20${yr}-${String(mon).padStart(2, '0')}`);
  });
  const grid = { months };
  for (const tr of trs.slice(2)) {
    const cells = [...tr.querySelectorAll('td')];
    if (!cells.length) continue;
    const who = BUREAU_NAMES[text(cells[0])];
    if (who) grid[who] = cells.slice(1, months.length + 1).map(cellValue);
  }
  return grid;
}

/** Friendly error for anything that isn't an IdentityIQ 3-bureau report. */
export class ReportError extends Error {}

export function parseIdentityIQ(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const page = clean(strings(doc.body || doc.documentElement).join(' '));
  if (!/TransUnion/.test(page) || !/Experian/.test(page) || !/Equifax/.test(page)) {
    throw new ReportError('This doesn’t look like a 3-bureau report (TransUnion, Experian and Equifax). Save the full IdentityIQ report page as .html and try again.');
  }
  const out = {
    meta: {
      source: 'IdentityIQ Three Bureau Credit Report',
      reference: page.match(/Reference #:\s*(\w+)/)?.[1] ?? null,
      reportDate: page.match(/Report Date:\D*(\d{2}\/\d{2}\/\d{4})/)?.[1] ?? null,
      scoreModel: 'VantageScore 3.0',
    },
    scores: {}, summary: { TU: {}, EX: {}, EQ: {} }, personal: {}, flags: {}, accounts: [], inquiries: [],
  };
  if (!out.meta.reportDate) throw new ReportError('No report date found — is this the full IdentityIQ report page (not a PDF or a single section)?');

  for (const t of doc.querySelectorAll('table.rpt_table4column')) {
    for (const [label, cells] of rows4(t)) {
      const vals = cells.map(cellValue);
      if (label === 'Credit Score:') {
        out.scores = Object.fromEntries(BUREAUS.map((b, i) => [b, vals[i] ? parseInt(vals[i], 10) : null]).filter(([, v]) => Number.isFinite(v)));
      } else if (SUMMARY.includes(label)) {
        const key = label.toLowerCase().split('(')[0].replace(/[^a-z]/g, '');
        BUREAUS.forEach((b, i) => { const v = vals[i]; out.summary[b][key] = v && v.includes('$') ? money(v) : parseInt(v || 0, 10) || 0; });
      } else if (label === 'Name:') {
        out.personal.nameParts = Object.fromEntries(BUREAUS.map((b, i) => [b, vals[i] ? vals[i].split(/\s+/).length : 0]));
      } else if (label === 'Current Address(es):') {
        out.personal.currentCity = Object.fromEntries(BUREAUS.map((b, i) => [b, cityLine(cells[i])]));
      } else if (label === 'Previous Address(es):') {
        out.personal.previousCity = Object.fromEntries(BUREAUS.map((b, i) => [b, cityLine(cells[i])]));
      } else if (label === 'Employers:') {
        out.personal.employers = Object.fromEntries(BUREAUS.map((b, i) => [b, lines(cells[i]).filter((x) => x !== '-')]));
      } else if (label === 'Date of Birth:') {
        out.personal.dobPrecision = Object.fromEntries(BUREAUS.map((b, i) => [b, vals[i] ? (vals[i].includes('/') ? 'full' : 'year') : null]));
      }
    }
  }
  if (!Number.isFinite(out.summary.TU.balances)) {
    throw new ReportError('Couldn’t find the Summary section. Open the complete IdentityIQ 3-bureau report, then save the page as “Web Page, Complete” or “HTML”.');
  }
  out.personal = {
    nameParts: { TU: 0, EX: 0, EQ: 0 }, dobPrecision: { TU: null, EX: null, EQ: null },
    currentCity: { TU: null, EX: null, EQ: null }, previousCity: { TU: null, EX: null, EQ: null },
    employers: { TU: [], EX: [], EQ: [] }, ...out.personal,
  };
  out.flags = parseFlags(page);

  // One pass in document order: remember the latest sub_header before each table
  // (the account's name), exactly like BeautifulSoup's find_previous.
  const all = [...doc.body.querySelectorAll('*')];
  let lastHeader = null;
  const headerOf = new Map(), order = new Map();
  all.forEach((el, i) => {
    order.set(el, i);
    if (/sub_header/.test(el.getAttribute('class') || '')) lastHeader = el;
    if (el.nodeName === 'TABLE') headerOf.set(el, lastHeader ? text(lastHeader) : null);
  });
  const histTables = all.filter((el) => el.nodeName === 'TABLE' && el.classList.contains('addr_hsrty'));
  const tables = [...doc.querySelectorAll('table.rpt_content_table.rpt_content_header.rpt_table4column')]
    .filter((t) => text(t).includes('Account #') && headerOf.get(t));
  const headers = tables.map((t) => headerOf.get(t));
  const dupes = new Set(headers.filter((h, i) => headers.indexOf(h) !== i));
  const taken = new Set();
  for (const t of tables) {
    const header = headerOf.get(t);
    const m = header.match(/^(.*?)\s*\(Original Creditor:\s*(.*)\)/);
    const [creditor, originalCreditor] = m ? [m[1], m[2]] : [header, null];
    const acct = { creditor, originalCreditor, bureaus: { TU: {}, EX: {}, EQ: {} } };
    for (const [label, cells] of rows4(t)) {
      const key = FIELD_KEYS[label];
      if (!key) continue;
      BUREAUS.forEach((b, i) => {
        let v = cellValue(cells[i]);
        if (key === 'comments' && v) v = lines(cells[i]);
        acct.bureaus[b][key] = MONEY.has(key) ? money(v) : v;
      });
    }
    for (const b of BUREAUS) if (!acct.bureaus[b].number) acct.bureaus[b] = null;
    // The next history grid in document order — only if it belongs to this account.
    const at = order.get(t);
    const hist = histTables.find((h) => order.get(h) > at);
    acct.history = hist && headerOf.get(hist) === header ? parseHistory(hist) : null;
    const detail = BUREAUS.map((b) => acct.bureaus[b]?.detail).find(Boolean) || '';
    acct.key = slug(creditor + (dupes.has(header) ? '-' + detail : ''), taken);
    out.accounts.push(acct);
  }
  if (!out.accounts.length) throw new ReportError('No accounts found in this report. Make sure the whole report finished loading before you saved it.');

  const marker = strings(doc.body).find((s) => s.includes('Creditor Name'));
  let inq = null;
  if (marker) {
    const w = doc.createTreeWalker(doc.body, 4);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.includes('Creditor Name')) { inq = n.parentNode.closest('table'); break; }
  }
  for (const tr of inq ? inq.querySelectorAll('tr') : []) {
    const v = [...tr.querySelectorAll('td')].map(cellValue);
    if (v.length === 4 && BUREAU_NAMES[v[3]]) out.inquiries.push({ name: v[0], type: v[1], date: v[2], bureau: BUREAU_NAMES[v[3]] });
  }

  // Reconcile against the report's own Summary. Problems become warnings the UI shows.
  const warnings = [];
  for (const b of BUREAUS) {
    const s = out.summary[b];
    const total = out.accounts.reduce((sum, a) => sum + (a.bureaus[b]?.balance || 0), 0);
    s.reconciled = Math.abs(total - (s.balances || 0)) < 0.01;
    if (!s.reconciled) warnings.push(`${b}: account balances add up to $${total.toLocaleString('en-US')} but the summary says $${(s.balances || 0).toLocaleString('en-US')}`);
    const n = out.accounts.filter((a) => a.bureaus[b]).length;
    if (n !== s.totalaccounts) { s.reconciled = false; warnings.push(`${b}: ${n} accounts read, summary says ${s.totalaccounts}`); }
    const q = out.inquiries.filter((i) => i.bureau === b).length;
    if (q !== s.inquiries) warnings.push(`${b}: ${q} inquiries read, summary says ${s.inquiries}`);
  }
  out.meta.warnings = warnings;
  return out;
}
