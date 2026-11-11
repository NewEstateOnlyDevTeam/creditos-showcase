// A fictional three-bureau report for the "Try the demo" button. Every name,
// number and place here is invented — it only exists to show what the engine
// finds. Its shape matches what src/parser.js returns for a real file.

const REPORT_DATE = '08/15/2026';
// History grid: newest month first, 24 months, like IdentityIQ.
const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const t = 2026 * 12 + 7 - i;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
});
/** Build one bureau's row: fn('YYYY-MM') → 'OK' | '30' | … | 'CO' | null. */
const row = (fn) => MONTHS.map(fn);
const between = (m, from, to) => m >= from && m <= to;

const base = {
  number: null, type: 'Revolving', detail: 'Credit Card', responsibility: 'Individual', status: 'Open', payment: 0,
  opened: null, balance: 0, terms: '0', highCredit: 0, limit: 0, pastDue: 0, payStatus: 'Current',
  lastReported: '08/01/2026', comments: null, lastActive: null, lastPayment: null,
};
const acct = (d) => ({ ...base, ...d });
// over[b] === null means that bureau doesn't report the account.
const same = (d, over = {}) => Object.fromEntries(['TU', 'EX', 'EQ'].map((b) => [b, over[b] === null ? null : acct({ ...d, ...over[b] })]));

const accounts = [
  {
    // Open card near its limit → utilization quick win.
    creditor: 'NORTHWIND BANK', originalCreditor: null,
    bureaus: same({ number: '51234567****', opened: '03/01/2022', balance: 1840, highCredit: 1960, limit: 2000, payment: 55, lastActive: '08/01/2026', lastPayment: '07/28/2026' }),
    history: { months: MONTHS, TU: row(() => 'OK'), EX: row(() => 'OK'), EQ: row(() => 'OK') },
  },
  {
    // Authorized user on someone else's card that went bad → removable on request.
    creditor: 'BLUE HARBOR CARD SVCS', originalCreditor: null,
    bureaus: {
      TU: acct({ number: '41110000****', responsibility: 'Authorized User', status: 'Derogatory', payStatus: 'Collection/Chargeoff', opened: '06/01/2019', balance: 1120, highCredit: 1500, limit: 1500, pastDue: 1120, lastActive: '11/01/2025', lastPayment: '10/15/2025', lastReported: '07/31/2026' }),
      EX: null, EQ: null,
    },
    history: { months: MONTHS, TU: row((m) => (m >= '2026-03' ? 'CO' : m === '2026-02' ? '120' : m === '2026-01' ? '90' : m === '2025-12' ? '60' : m === '2025-11' ? '30' : 'OK')), EX: null, EQ: null },
  },
  {
    // Collection with no original creditor; the two bureaus tell different stories.
    creditor: 'SUMMIT RECOVERY GROUP', originalCreditor: null,
    bureaus: {
      TU: null,
      EX: acct({ number: 'SRG88210****', type: 'Collection', detail: 'Collection', status: 'Derogatory', payStatus: 'Collection/Chargeoff', opened: '01/01/2026', balance: 612, highCredit: 612, pastDue: 612, lastActive: '06/01/2026' }),
      EQ: acct({ number: 'SRG88210****', type: 'Open Account', detail: 'Collection', status: 'Derogatory', payStatus: 'Late 120 Days', opened: '01/01/2026', balance: 612, highCredit: 612, pastDue: 612, lastActive: '02/01/2026' }),
    },
    history: { months: MONTHS, TU: null, EX: row((m) => (m >= '2026-02' ? 'CO' : null)), EQ: row((m) => (m >= '2026-02' ? 'OK' : null)) },
  },
  {
    // Repossessed car: an activity date years after the last payment, plus the deficiency.
    creditor: 'PINECREST AUTO FINANCE', originalCreditor: null,
    bureaus: same(
      { number: '7700123456****', type: 'Installment', detail: 'Auto Loan', status: 'Derogatory', payStatus: 'Collection/Chargeoff', terms: '72', opened: '05/01/2021', balance: 9460, highCredit: 21400, pastDue: 9460, lastPayment: '02/10/2023', comments: ['Merchandise was taken back by credit grantor; there may be a balance due.'] },
      { TU: { lastActive: '04/30/2026', comments: ['Dispute resolved; reported by grantor'] }, EX: { lastActive: '03/01/2023' }, EQ: null },
    ),
    history: { months: MONTHS, TU: row(() => 'CO'), EX: row(() => 'CO'), EQ: null },
  },
  {
    // Current one month, 60 days late the next — no 30-day late in between.
    creditor: 'MAPLE LENDING', originalCreditor: null,
    bureaus: same({ number: 'ML40021****', type: 'Installment', detail: 'Unsecured loan', opened: '09/01/2024', balance: 1380, highCredit: 2500, terms: '24', payment: 118, pastDue: 118, payStatus: 'Late 60 Days', lastActive: '06/01/2026', lastPayment: '05/20/2026' }),
    history: { months: MONTHS, ...Object.fromEntries(['TU', 'EX', 'EQ'].map((b) => [b, row((m) => (m < '2024-09' ? null : m === '2026-08' ? '60' : m === '2026-07' ? '60' : 'OK'))])) },
  },
  {
    // Charged-off card: bureaus disagree on when it went late; on-time months after the charge-off.
    creditor: 'ORBIT FINTECH', originalCreditor: null,
    bureaus: same(
      { number: '60110099****', status: 'Derogatory', payStatus: 'Collection/Chargeoff', opened: '02/01/2023', balance: 640, highCredit: 700, limit: 500, pastDue: 320, lastActive: '12/01/2024', lastPayment: '12/05/2024' },
      { EQ: { lastActive: '01/01/2025' } },
    ),
    history: {
      months: MONTHS,
      TU: row((m) => (m >= '2025-06' ? 'CO' : m === '2025-05' ? '120' : m === '2025-04' ? '90' : m === '2025-03' ? '60' : m === '2025-02' ? '30' : 'OK')),
      EX: row((m) => (m >= '2025-05' ? 'CO' : m === '2025-04' ? '120' : m === '2025-03' ? '90' : m === '2025-02' ? '60' : m === '2025-01' ? '30' : 'OK')),
      EQ: row((m) => (between(m, '2025-02', '2025-05') ? ['30', '60', '90', '120'][Number(m.slice(5)) - 2] : m >= '2025-06' && m <= '2025-09' ? 'CO' : 'OK')),
    },
  },
  {
    // Point-of-sale loan: balance above the amount financed, not updated in years.
    creditor: 'CEDAR POINT PAY', originalCreditor: null,
    bureaus: { TU: acct({ number: 'CPP31177****', type: 'Installment', detail: 'Installment sales contract', status: 'Derogatory', payStatus: 'Collection/Chargeoff', terms: '12', opened: '01/01/2023', balance: 410, highCredit: 350, pastDue: 410, lastReported: '06/30/2024', lastActive: '06/30/2024', lastPayment: '03/15/2024' }), EX: null, EQ: null },
    history: null,
  },
  {
    // A collection that looks consistent — verify before paying (quick win, not a dispute).
    creditor: 'ATLAS COLLECTION AGENCY', originalCreditor: 'CITYLINK TELECOM',
    bureaus: { ...same({ number: 'ACA55102****', type: 'Open Account', detail: 'Collection', status: 'Derogatory', payStatus: 'Collection/Chargeoff', opened: '03/01/2025', balance: 285, highCredit: 285, pastDue: 285, lastActive: '10/01/2024' }), EX: null },
    history: null,
  },
  {
    // Open card, one old 30-day late, current since → goodwill letter.
    creditor: 'GRANITE STATE BANK', originalCreditor: null,
    bureaus: same({ number: '37820011****', opened: '08/01/2020', balance: 240, highCredit: 900, limit: 3000, payment: 25, lastActive: '08/01/2026', lastPayment: '07/20/2026' }),
    history: { months: MONTHS, TU: row((m) => (m === '2025-03' ? '30' : 'OK')), EX: row((m) => (m === '2025-03' ? '30' : 'OK')), EQ: row((m) => (m === '2025-03' ? '30' : 'OK')) },
  },
  {
    // Clean, open auto loan.
    creditor: 'RIVERSTONE CU', originalCreditor: null,
    bureaus: same({ number: '90021****', type: 'Installment', detail: 'Auto Loan', opened: '10/01/2024', balance: 11250, highCredit: 16800, terms: '60', payment: 312, lastActive: '08/01/2026', lastPayment: '07/30/2026' }),
    history: { months: MONTHS, ...Object.fromEntries(['TU', 'EX', 'EQ'].map((b) => [b, row((m) => (m < '2024-10' ? null : 'OK'))])) },
  },
  {
    // Paid-off student loan.
    creditor: 'LANTERN STUDENT LOANS', originalCreditor: null,
    bureaus: same({ number: 'LSL10044****', type: 'Installment', detail: 'Student loan', status: 'Paid', opened: '09/01/2016', balance: 0, highCredit: 8200, terms: '120', lastActive: '02/01/2025', lastPayment: '02/01/2025' }),
    history: { months: MONTHS, ...Object.fromEntries(['TU', 'EX', 'EQ'].map((b) => [b, row((m) => (m > '2025-02' ? null : 'OK'))])) },
  },
].map((a) => ({ ...a, key: a.creditor.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));

const inquiries = [
  ['NORTHWIND BANK', 'Credit Card', '07/22/2026', 'EX'], ['QUICKCASH ONLINE', null, '07/02/2026', 'EX'],
  ['RIVERSTONE CU', 'Auto Financing', '09/28/2024', 'TU'], ['RIVERSTONE CU', 'Auto Financing', '09/28/2024', 'EX'],
  ['BRIGHTLINE AUTO', 'Auto Financing', '09/27/2024', 'EQ'], ['METRO RENTALS', null, '05/14/2026', 'TU'],
  ['SUNNYVALE FURNITURE', null, '04/03/2026', 'EQ'],
  ['BRIGHTLINE AUTO', 'Auto Financing', '09/27/2024', 'EX'], ['SUMMIT MOTORS CAPITAL', 'Auto Financing', '09/27/2024', 'EX'],
  ['FASTLANE AUTO CREDIT', 'Auto Financing', '09/27/2024', 'EX'], ['NORTHWIND BANK', 'Credit Card', '01/10/2025', 'EX'],
].map(([name, type, date, bureau]) => ({ name, type, date, bureau }));

// The summary block is derived from the accounts so the demo reconciles like a real file.
const B = ['TU', 'EX', 'EQ'];
const summary = Object.fromEntries(B.map((b) => {
  const on = accounts.map((a) => a.bureaus[b]).filter(Boolean);
  const derog = on.filter((d) => /Derogatory|Collection|Chargeoff/.test(d.status + d.payStatus)).length;
  return [b, {
    totalaccounts: on.length, openaccounts: on.filter((d) => d.status === 'Open').length,
    closedaccounts: on.filter((d) => d.status !== 'Open').length, delinquent: on.filter((d) => /Late/.test(d.payStatus)).length,
    derogatory: derog, collection: on.filter((d) => d.detail === 'Collection').length,
    balances: on.reduce((s, d) => s + d.balance, 0), payments: on.reduce((s, d) => s + d.payment, 0),
    publicrecords: 0, inquiries: inquiries.filter((q) => q.bureau === b).length, reconciled: true,
  }];
}));

export const DEMO_REPORT = {
  meta: { source: 'Demo report (fictional)', reference: 'DEMO', reportDate: REPORT_DATE, scoreModel: 'VantageScore 3.0', warnings: [], demo: true },
  scores: { TU: 548, EX: 571, EQ: 596 },
  summary,
  personal: {
    nameParts: { TU: 3, EX: 2, EQ: 3 },
    dobPrecision: { TU: 'full', EX: 'year', EQ: 'full' },
    currentCity: { TU: 'LAKEVIEW, OH 43331', EX: 'LAKEVIEW, OH 43331', EQ: 'MILLBROOK, OH 43315' },
    previousCity: { TU: 'MILLBROOK, OH 43315', EX: 'MILLBROOK, OH 43315', EQ: null },
    employers: { TU: ['EXAMPLE LOGISTICS'], EX: [], EQ: [] },
  },
  flags: { TU: 'Security freeze', EX: null, EQ: null },
  accounts,
  inquiries,
};
