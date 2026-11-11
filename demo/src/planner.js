// Turns the anomaly engine's findings into a dispute plan: missions, rounds,
// letters and "Round 0" quick wins — generated for whoever's report is loaded.
//
// Letter rules (same as the hand-reviewed originals):
// - state only what the report shows; the consumer confirms anything else in
//   [BRACKETS] before mailing
// - no admissions of the debt, no promises to pay
// - inferences are phrased as requests to verify, never as accusations
import { B, BUREAU, SEVERITY, money } from './engine.js';
import { prettyName, displayName } from './scene.js';
import { ROUNDS } from '../data/legal.js';

const NAME = (b) => BUREAU[b].name;
const MIN_SEV = SEVERITY.medium;
const REPO = /repossess|taken back by (the )?credit grantor|voluntar(y|ily) surrender/i;
// Letters spell out bureau names and drop notes meant only for the user.
const forLetter = (s) => s
  .replace(/\bTU\b/g, 'TransUnion').replace(/\bEX\b/g, 'Experian').replace(/\bEQ\b/g, 'Equifax')
  .replace(/\bCO\b/g, 'charged off').replace(/≠/g, 'does not match')
  .replace(/\.? ?Comment on file: “[^”]*” — the date may reflect that dispute/g, '');
const andList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

// What to ask for, per rule. Titles/details come from the engine and describe the report.
const ASK = {
  'before-open': 'A payment or activity date cannot come before the account was opened. Please verify every date on this account.',
  'status-conflict': 'Please report one accurate, consistent status.',
  'over-financed': 'Please verify the balance with an itemization from the furnisher.',
  'balance-pastdue': 'Please verify both amounts.',
  stale: 'Please verify the current balance and status.',
  'activity-gap': 'Please verify the date of first delinquency furnished under 15 U.S.C. § 1681s-2(a)(5).',
  'skipped-stage': 'Please verify the exact due date that was missed; if it cannot be verified, correct or delete that entry.',
  'history-contradiction': 'Please verify the payment history and the status.',
  'dofd-mismatch': 'Please verify the date of first delinquency (15 U.S.C. § 1681s-2(a)(5)).',
  'month-conflict': 'Please verify each of these months.',
  'no-oc': 'Please verify the original creditor and the date of first delinquency.',
  mismatch: 'At least one of these is inaccurate. Please verify which.',
};
const HEADLINE = {
  'au-derog': 'authorized user', 'before-open': 'dates before the account opened', 'status-conflict': 'contradictory status',
  'skipped-stage': 'late mark with a skipped stage', 'history-contradiction': 'history contradicts the status',
  'dofd-mismatch': 'conflicting delinquency date', 'month-conflict': 'bureaus disagree month by month', 'activity-gap': 'conflicting activity dates',
  'over-financed': 'balance above amount financed', 'balance-pastdue': 'balance ≠ past due', stale: 'stale past-due balance',
  'no-oc': 'no original creditor', mismatch: 'bureaus report it differently',
};
const DATE_RULES = new Set(['dofd-mismatch', 'activity-gap', 'history-contradiction', 'month-conflict', 'before-open']);
const DIRECT_RULES = new Set(['skipped-stage', 'status-conflict', 'dofd-mismatch', 'history-contradiction', 'activity-gap', 'before-open', 'month-conflict', 'over-financed']);

/** The lines of a finding's detail that concern bureau b (details are one line per bureau when merged). */
function linesFor(f, b) {
  const names = B.map(NAME);
  return f.detail.split('\n').filter((l) => {
    const who = names.find((n) => l.startsWith(n + ':'));
    return !who || who === NAME(b);
  }).map((l) => l.replace(new RegExp(`^${NAME(b)}:\\s*`), ''))
    .map((l) => l.replace(/\s*Ask the creditor to verify the missed due date\.?/, '').replace(/\s*Ask the collector to identify it and the date of first delinquency\.?/, ''));
}
const cleanTitle = (t) => t.replace(/\s+—\s+(ask|verify) .*$/i, '');

function bullet(f, b) {
  const ls = linesFor(f, b);
  if (!ls.length) return null;
  const facts = f.rule === 'no-oc' ? 'No original creditor is reported for this collection account.' : `${cleanTitle(f.title)}: ${ls.join('; ')}`;
  const text = forLetter(facts);
  return `• ${text}${/[.!?]$/.test(text) ? '' : '.'} ${ASK[f.rule] || ''}`.trim();
}

const numberOn = (a, b) => a.bureaus[b]?.number || a.bureaus[a.reporting[0]]?.number || '[ACCOUNT NUMBER]';

function accountDispute(a) {
  const findings = a.findings.filter((f) => SEVERITY[f.severity] >= MIN_SEV || f.rule === 'au-derog');
  const au = findings.find((f) => f.rule === 'au-derog');
  if (!findings.length) return null;
  const top = au || findings[0];
  const name = displayName(a);
  const bureaus = (au ? au.bureaus : a.negBureaus.length ? a.negBureaus : a.reporting).filter((b) => a.bureaus[b]);
  const collection = a.kind === 'collection';
  const repo = B.some((b) => (a.bureaus[b]?.comments || []).some((c) => REPO.test(c)));
  const rules = new Set(findings.map((f) => f.rule));

  const letters = {};
  for (const b of bureaus) {
    const d = a.bureaus[b];
    const re = `Re: Dispute — ${prettyName(a.creditor)}, account ${numberOn(a, b)}${d.balance ? `, balance ${money(d.balance)}` : ''}`;
    if (au) {
      letters[b] = `${re}\n\nThis account is reported with Bureau Code "Authorized User". I am an authorized user only and am not contractually liable for it. It is reported as ${d.payStatus || d.status || 'negative'}${d.pastDue ? ` with ${money(d.pastDue)} past due` : ''}.\n\n[IF DONE: On [DATE YOU CALLED] I asked the card issuer to remove me as an authorized user.]\n\nPlease remove this tradeline from my file under 15 U.S.C. §§ 1681e(b) and 1681i(a)(5)(A).`;
      continue;
    }
    const bullets = findings.filter((f) => f.bureaus.includes(b)).map((f) => bullet(f, b)).filter(Boolean).slice(0, 8);
    letters[b] = `${re}\n\nI dispute the accuracy and completeness of this ${collection ? 'collection ' : ''}account as you report it.\n\n${bullets.join('\n')}\n\nPlease reinvestigate under 15 U.S.C. § 1681i(a)(1), forward this dispute and my enclosures to the furnisher under § 1681i(a)(2), and correct or delete this account under § 1681i(a)(5)(A) if it cannot be fully verified.`;
  }

  const law = ['§ 1681e(b)', '§ 1681i(a)(5)(A)'];
  if ([...rules].some((r) => DATE_RULES.has(r))) law.push('§ 1681s-2(a)(5)');
  if (rules.has('activity-gap')) law.push('§ 1681c(c)(1)');
  if (rules.has('over-financed') || rules.has('stale')) law.push('§ 1681s-2(a)(1)–(2)');
  if (!collection && !au && [...rules].some((r) => DIRECT_RULES.has(r))) law.push('12 CFR § 1022.43');
  if (collection) law.push('§ 1692e(8)', '§ 1692g');
  if (repo) law.push('UCC § 9-616');

  const extras = [];
  const num = numberOn(a, bureaus[0]);
  if (collection) {
    extras.push({
      to: '[COLLECTOR NAME AND MAILING ADDRESS — from its letter to you, or its website]',
      label: `Dispute + information request → ${prettyName(a.creditor)}`,
      body: `Re: Account ${num}\n\nI dispute this debt. Please provide the name of the original creditor, an itemization of the amount you claim, and the date of first delinquency.\n\nIf you contend you sent me a validation notice, please send a copy and the date it was mailed. If I am within the validation period, 15 U.S.C. § 1692g(b) requires you to stop collection until you mail verification.\n\nIf you report this debt to any credit bureau, 15 U.S.C. § 1692e(8) requires you to report it as disputed.`,
    });
  } else if (!au && [...rules].some((r) => DIRECT_RULES.has(r))) {
    const all = findings.filter((f) => DIRECT_RULES.has(f.rule)).slice(0, 6).map((f) => forLetter(`• ${cleanTitle(f.title)}: ${f.detail.replace(/\s*Ask the creditor to verify the missed due date\.?/g, '').split('\n').join('; ')}`));
    extras.push({
      to: '[CREDITOR NAME AND DISPUTE ADDRESS — on your statement or the creditor’s website]',
      label: `Direct dispute → ${prettyName(a.creditor)}`,
      body: `Re: Direct dispute under 12 CFR § 1022.43 — account ${num}\n\nThe credit bureaus show the following for this account:\n${all.join('\n')}\n\nPlease investigate what you furnish and correct it with ${andList(bureaus.map(NAME))} — or send me the records that show it is accurate.`,
    });
  }
  if (repo) {
    extras.push({
      to: '[LENDER NAME AND MAILING ADDRESS]',
      label: `Deficiency explanation request → ${prettyName(a.creditor)}`,
      body: `Re: Account ${num}\n\nPlease send me a written explanation of how the deficiency you claim on this account was calculated (UCC § 9-616 as adopted in my state), including the date and price of the sale of the collateral, and copies of the notices you sent me before the sale (UCC §§ 9-611–9-614).`,
    });
  }

  const maxSev = Math.max(...findings.map((f) => SEVERITY[f.severity]));
  const strong = findings.filter((f) => SEVERITY[f.severity] >= SEVERITY.high).length;
  const [odds, oddsLabel] = au ? [0.9, 'Very high']
    : maxSev >= SEVERITY.critical ? [0.7, 'High']
      : strong >= 3 ? [0.6, 'Medium-high']
        : maxSev >= SEVERITY.high ? [0.5, 'Medium']
          : [0.35, 'Low-medium'];
  const action = au ? 'Remove the authorized-user tradeline. Call the card issuer first and ask them to take you off the account.'
    : collection ? 'Make them verify the original creditor, delinquency date and amount — or delete.'
      : rules.has('skipped-stage') && strong < 2 ? 'Make the creditor prove the missed due date. If it verifies: send a goodwill letter instead.'
        : `Make each bureau verify what it reports${bureaus.length > 1 ? ' — they already disagree with each other' : ''}. Correct it or delete it.`;

  return {
    account: a.key, title: `${name} — ${HEADLINE[top.rule] || 'reporting errors'}`, bureaus, odds, oddsLabel,
    law, action, letters, extras, attorney: repo, score: odds * 100 + a.heat + (au ? 100 : 0),
  };
}

function personalDispute(report, model) {
  if (!model.personal.length) return null;
  const p = report.personal, has = (t) => model.personal.some((f) => f.title.startsWith(t));
  const paras = { TU: [], EX: [], EQ: [] };
  if (has('Name')) {
    const max = Math.max(...B.map((b) => p.nameParts[b] || 0));
    for (const b of B) if ((p.nameParts[b] || 0) < max) paras[b].push('Please update my file so my name reads exactly: [FULL LEGAL NAME]. [ONLY IF YOU HAVE A LEGAL MIDDLE NAME: Your file leaves out my middle name.]');
  }
  if (has('Current address')) {
    const city = (b) => (p.currentCity[b] || '').replace(/-\d{4}$/, '');
    const count = {};
    for (const b of B) if (city(b)) count[city(b)] = (count[city(b)] || 0) + 1;
    const mode = Object.entries(count).find(([, n]) => n >= 2)?.[0];
    for (const b of B) {
      if (mode && city(b) === mode) continue;
      paras[b].push(`Your file lists ${city(b) || 'no address'} as my current address. [ONLY IF THAT IS NOT WHERE YOU LIVE NOW:] My current address is [STREET ADDRESS], [CITY, STATE ZIP]. Please update it and keep the old one as a previous address (15 U.S.C. § 1681e(b)).`);
    }
  }
  if (has('Employers')) {
    for (const b of B) {
      const list = p.employers[b] || [];
      if (list.length) paras[b].push(`You list ${list.length === 1 ? 'this employer' : 'these employers'}: ${list.map((e) => `"${e}"`).join(', ')}. [ONLY IF INACCURATE: Please remove the employer entries that are not accurate.]`);
    }
  }
  for (const b of B) if (p.dobPrecision?.[b] === 'year') paras[b].push('Please record my full date of birth, [DOB] — your file shows only the year.');
  const bureaus = B.filter((b) => paras[b].length);
  if (!bureaus.length) return null;
  const letters = Object.fromEntries(bureaus.map((b) => [b, `Re: Correction of identifying information\n\n${paras[b].join('\n\n')}\n\nPlease reinvestigate under 15 U.S.C. § 1681i(a)(1).`]));
  return {
    account: null, personal: true, title: 'Personal information', bureaus, odds: 0.9, oddsLabel: 'High (correction)',
    law: ['15 U.S.C. § 1681e(b)', '§ 1681i(a)(1)'],
    action: 'One letter per bureau so all three show the same name, current address and full date of birth. Mail these first, alone — accounts are matched to you by this information.',
    letters, extras: [],
  };
}

export function plan(report, model) {
  const personal = personalDispute(report, model);
  const accounts = model.accounts.filter((a) => a.neg).map(accountDispute).filter(Boolean).sort((x, y) => y.score - x.score);
  const list = [...(personal ? [personal] : []), ...accounts];
  const r1 = personal ? 5 : 4;
  const DISPUTES = list.map((d, i) => ({
    ...d, id: `D${i + 1}`, priority: i + 1, round: i < r1 ? 'R1' : i < r1 + 5 ? 'R2' : 'R3',
  }));
  const used = new Set(DISPUTES.map((d) => d.round));
  return { DISPUTES, ROUNDS: ROUNDS.filter((r) => used.has(r.id)), QUICK_WINS: quickWins(report, model, DISPUTES) };
}

function quickWins(report, model, disputes) {
  const out = [];
  const disputed = new Set(disputes.map((d) => d.account));
  const isOpen = (a) => a.reporting.some((b) => /^Open/i.test(a.bureaus[b].status || ''));
  for (const a of model.accounts) {
    if (a.kind !== 'revolving' || !isOpen(a)) continue;
    const b = a.reporting.find((x) => a.bureaus[x].limit > 0);
    if (!b) continue;
    const { balance, limit } = a.bureaus[b];
    if (balance / limit > 0.3) {
      out.push({ id: `q-pay-${a.key}`, title: `Pay ${displayName(a)} from ${money(balance)} to under ${money(Math.floor(limit * 0.1))}`,
        why: `${Math.round((balance / limit) * 100)}% of a ${money(limit)} limit. Pay before the statement closes — utilization updates monthly and has no memory.` });
    }
  }
  for (const a of model.accounts) {
    if (a.findings.some((f) => f.rule === 'au-derog')) {
      out.push({ id: `q-au-${a.key}`, title: `Call ${displayName(a)}: remove me as an authorized user`,
        why: 'An authorized user is not liable. Once you are off the account, its negative history usually disappears from your report.' });
    }
  }
  const open = model.accounts.filter((a) => isOpen(a) && a.kind !== 'collection');
  if (open.length) {
    out.push({ id: 'q-autopay', title: `Autopay on ${open.slice(0, 5).map(displayName).join(', ')}${open.length > 5 ? ` + ${open.length - 5} more` : ''}`,
      why: 'One new late payment on an open account costs more than any dispute wins. Set at least the minimum on autopay.' });
  }
  const inq = Object.fromEntries(B.map((b) => [b, report.inquiries.filter((q) => q.bureau === b).length]));
  const worst = B.reduce((x, y) => (inq[y] > inq[x] ? y : x));
  if (inq[worst] >= 6) {
    out.push({ id: 'q-pause', title: 'Pause new credit applications', why: `${inq[worst]} ${NAME(worst)} inquiries in 2 years. Each application adds one — and car dealers often send one application to many lenders.` });
  }
  for (const a of model.accounts) {
    if (a.kind === 'collection' && a.neg && !disputed.has(a.key)) {
      out.push({ id: `q-coll-${a.key}`, title: `Before paying ${displayName(a)}: get it in writing`,
        why: 'Ask the collector for an itemization and the original creditor. If you decide to pay, get a written pay-for-delete agreement first. In many states a payment or written promise can restart the time limit to be sued on an old debt.' });
    }
  }
  for (const a of model.accounts) {
    if (a.neg && a.kind !== 'collection' && !disputed.has(a.key) && a.fall?.lateOnly && isOpen(a)) {
      out.push({ id: `q-good-${a.key}`, title: `Goodwill letter to ${displayName(a)}`,
        why: 'This account is in good standing now. A short, polite letter asking them to remove the old late mark as a courtesy sometimes works — it is a request, not a dispute.' });
    }
  }
  out.push({ id: 'q-fraud', title: 'Decide honestly: is any account not yours?',
    why: 'If so, report it at IdentityTheft.gov — with that report the bureaus must block it within 4 business days (15 U.S.C. § 1681c-2). Never use it for real debts.' });
  for (const b of B) {
    if (/freeze/i.test(report.flags?.[b] || '')) {
      out.push({ id: `q-freeze-${b}`, title: `Keep the ${NAME(b)} freeze ON`, why: 'A security freeze only limits who can pull your report — it does not stop disputes. Never mail your freeze PIN to anyone.' });
    }
  }
  out.push({ id: 'q-acr', title: 'Bookmark AnnualCreditReport.com', why: 'Free reports from all three bureaus — use them to check each dispute’s result before paying for anything.' });
  return out;
}
