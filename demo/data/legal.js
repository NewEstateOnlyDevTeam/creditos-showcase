// Fixed legal content shared by every user: bureau addresses, letter frame,
// the removal playbook and its sources. Federal law only — state rules vary,
// so they are mentioned as "check your state", never cited as if they applied.

export const BUREAU_ADDRESSES = {
  TU: 'TransUnion Consumer Solutions\nP.O. Box 2000\nChester, PA 19016-2000',
  EX: 'Experian\nP.O. Box 4500\nAllen, TX 75013',
  EQ: 'Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374-0256',
};
export const ADDRESS_NOTE = 'Confirm each dispute address on the bureau’s website the week you mail.';

// Bureaus match your file by full SSN — send it only to the three bureaus.
export const LETTER_HEADER = '[FULL LEGAL NAME]\n[STREET ADDRESS]\n[CITY, STATE ZIP]\nDate of birth: [DOB]\nSSN: [FULL SSN]\n[DATE]';
// Creditors and collectors identify you by account number — never send them your SSN.
export const CREDITOR_HEADER = '[FULL LEGAL NAME]\n[STREET ADDRESS]\n[CITY, STATE ZIP]\n[DATE]';

export const LETTER_FOOTER =
  'Enclosed: copy of government ID, proof of current address, and the highlighted page of my credit report.\n\nPlease send me the written results of your reinvestigation, and on request a description of the procedure used to verify this information (15 U.S.C. § 1681i(a)(6)–(7)).\n\nSincerely,\n\n[SIGNATURE]\n[FULL LEGAL NAME]';

export const ROUNDS = [
  { id: 'R1', name: 'Round 1', when: 'Week 1', note: 'Personal information first, then the items with the strongest grounds.' },
  { id: 'R2', name: 'Round 2', when: 'Week 6', note: 'After Round 1 answers arrive (~35 days). The next items.' },
  { id: 'R3', name: 'Round 3', when: 'Week 11', note: 'Everything else. A re-dispute of anything "verified" must add new evidence (a statement, a payment record, a corrected report page). Repeating the same claim usually gets rejected as frivolous under § 1681i(a)(3).' },
];

export const PLAYBOOK = [
  { icon: '🏦', title: 'Not yours / not liable', law: '§ 1681c-2 · AU removal', text: 'Authorized-user accounts come off on request — you are not liable for them. Genuine identity theft: bureaus must block the accounts within 4 business days once you send an FTC Identity Theft Report (IdentityTheft.gov). Never for real debts — a false report is a crime.' },
  { icon: '🔎', title: 'Dispute with the bureaus', law: '§ 1681e(b) · § 1681i', text: '30-day reinvestigation — 45 if you send more information during those 30 days (§ 1681i(a)(1)(B)) or dispute after a free annual report. Inaccurate, incomplete or unverifiable → deleted or corrected. A deleted item can’t come back without certification and written notice to you within 5 business days. Be specific — vague disputes can be rejected as frivolous.' },
  { icon: '🎯', title: 'Dispute with the creditor', law: '§ 1681s-2(a)(8) · 12 CFR § 1022.43', text: 'Dispute straight to the lender about balance, status, dates and limits, at its dispute address. Same ~30-day clock. Once disputed, it must report the item as disputed (§ 1681s-2(a)(3)).' },
  { icon: '⚖️', title: 'Liability = leverage', law: '§ 1681s-2(b) · § 1681n/o · § 1681p', text: 'After a bureau forwards your dispute, the creditor must investigate properly — or you can sue. Willful violations: $100–$1,000 statutory + punitive + attorney’s fees; negligent ones: actual damages + fees. Sue within 2 years of discovery and 5 years of the violation, whichever is earlier. Settlements often include deletion.' },
  { icon: '🧾', title: 'Debt-collector rules', law: '§ 1692g · § 1692e(8) · Reg F § 1006.30(a)', text: 'Dispute in writing within 30 days of receiving their validation notice and they must stop collecting until they verify. Before reporting a debt, a collector must speak with you, or mail/email you and wait a reasonable period (14 days is the safe harbor). A collector that reports a debt it knows you dispute must report it as disputed. Many states add their own collection law with extra damages — check yours.' },
  { icon: '🚗', title: 'Repossession leverage', law: 'UCC §§ 9-611–9-616, 9-625', text: 'Before selling a repossessed car the lender must send proper notice, and on request it must explain how the deficiency was calculated (§ 9-616). In consumer cases violations carry statutory minimum damages (at least the finance charge + 10% of the principal). Every state adopts the UCC with its own section numbers and deadlines can be short — see an attorney early.' },
  { icon: '🤝', title: 'Negotiated deletion', law: 'Contract, not statute', text: 'Pay-for-delete in writing before paying — collectors agree more often than banks. Goodwill letters for single lates on accounts now in good standing. Careful: in many states a payment or a signed written promise can restart the time limit to be sued on an old debt. That lawsuit clock is separate from the 7-year credit-reporting clock.' },
  { icon: '🧯', title: 'Escalate', law: 'CFPB · state attorney general · attorney', text: 'CFPB complaints are forwarded to the company, which is expected to respond, often within about 15 days. A complaint is a record, not a deadline. FCRA/FDCPA attorneys often take strong cases where the violator pays the fees.' },
  { icon: '📊', title: 'Scoring models', law: 'Model-specific · not a legal right', text: 'Lenders use different scores (FICO and VantageScore versions, sometimes with a bureau-specific score). A single cleaned item can move one score and not another. Some newer scoring models use rent, utility or buy-now-pay-later data that not every file includes. Check the score model printed on your report before comparing numbers.' },
  { icon: '⏳', title: 'Time', law: '§ 1681c(a)(4), (c)(1)', text: 'Charge-offs and collections can be reported for 7 years starting 180 days after the delinquency began; bureaus usually remove them about 7 years after it began. Paying doesn’t reset that date, and re-aging it is illegal (§ 1681s-2(a)(5)). Scrub the Time Machine to watch it happen.' },
];

export const PLAYBOOK_REVIEWED = '2026-11-09';
export const PLAYBOOK_REVIEW_NOTE = 'Statutes and regulations checked against linked primary sources where possible. Pending attorney review. Laws change; check the source link before relying on any item.';

export const SOURCES = [
  ['15 U.S.C. § 1681c-2 — identity theft block', 'https://www.law.cornell.edu/uscode/text/15/1681c-2'],
  ['15 U.S.C. § 1681i — reinvestigations', 'https://www.law.cornell.edu/uscode/text/15/1681i'],
  ['15 U.S.C. § 1681s-2 — duties of furnishers', 'https://www.law.cornell.edu/uscode/text/15/1681s-2'],
  ['15 U.S.C. § 1692g — validation of debts', 'https://www.law.cornell.edu/uscode/text/15/1692g'],
  ['12 CFR § 1022.43 — direct disputes', 'https://www.consumerfinance.gov/rules-policy/regulations/1022/43/'],
  ['12 CFR § 1006.30 — passive credit reporting', 'https://www.consumerfinance.gov/rules-policy/regulations/1006/30/'],
  ['CFPB Circular 2022-07 — reasonable investigations', 'https://www.consumerfinance.gov/compliance/circulars/consumer-financial-protection-circular-2022-07-reasonable-investigation-of-consumer-reporting-disputes/'],
  ['UCC § 9-625 — remedies for secured-party noncompliance', 'https://www.law.cornell.edu/ucc/9/9-625'],
  ['CFPB — submit a complaint', 'https://www.consumerfinance.gov/complaint/'],
  ['IdentityTheft.gov — FTC identity theft report', 'https://www.identitytheft.gov/'],
  ['AnnualCreditReport.com — free reports from all three bureaus', 'https://www.annualcreditreport.com/'],
];
