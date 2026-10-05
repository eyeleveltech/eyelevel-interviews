// New applications: read from hr@ -> extract + score -> add to the Sheet -> tell the assigned recruiter.
const g = require('./google');
const x = require('./extract');
const e = require('./email');

const GMAIL_QUERY = '(from:tmmnotifyacc@gmail.com subject:"New Application") OR (has:attachment -from:eyelevelstudio.in -from:naukri.com subject:(application OR resume OR cv OR job OR applying OR internship OR intern))';
const EARLIEST = process.env.EARLIEST_DATE || '2026-08-01';
const sheetUrl = (row1) => `https://docs.google.com/spreadsheets/d/${process.env.SHEET_ID}/edit#gid=0&range=A${row1}`;

// ---------- who gets which application (rules live on the Recruiters tab) ----------
async function routing() {
  const rules = []; let fallback = 'Akmal Billekar';
  for (const [k, w] of await g.getValues('Recruiters!E2:F60')) {
    const key = (k || '').trim().toLowerCase(), who = (w || '').trim();
    if (!key || !who) continue;
    if (key === '(anything else)') fallback = who; else rules.push([key, who]);
  }
  return { rules, fallback };
}
const assign = (role, { rules, fallback }) => {
  const r = String(role || '').toLowerCase();
  const hit = rules.find(([k]) => r.includes(k));
  return hit ? hit[1] : fallback;
};

function toRow(m, c, head, route, opts) {
  const dec = x.decide(c);
  const d = {
    'Received': m.date.slice(0, 10), 'Source': opts.test ? 'TEST' : (m.from.includes('tmmnotifyacc') ? 'Website form' : 'Direct email'),
    'Name': c.name, 'Phone': c.phone, 'Email': c.email, 'Role Applied': c.role_applied, 'City': c.city,
    'Total Exp (yrs)': c.total_experience_years, 'Current Company': c.current_company, 'Current Designation': c.current_designation,
    'Highest Education': c.highest_education, 'Institution': c.institution, 'Grad Year': c.graduation_year, 'Key Skills': c.key_skills,
    'Current CTC (CV)': c.current_ctc, 'Expected CTC (CV)': c.expected_ctc, 'Notice Period (CV)': c.notice_period,
    'Portfolio / LinkedIn': c.portfolio_links, 'CV Attached': m.cvNames.length ? 'Yes: ' + m.cvNames.join(', ') : 'No',
    'Fit Score /10': c.fit_score, 'AI Recommendation': dec.recommendation, 'Why': dec.why, 'Strengths': c.strengths, 'Gaps': c.gaps,
    'Assigned Recruiter': opts.test ? 'Akmal Billekar' : assign(c.role_applied, route),
    'Bring Laptop?': 'Yes', 'AI Chat Status': 'Not contacted',
    'Gmail Link': `https://mail.google.com/mail/u/?authuser=hr@eyelevelstudio.in#all/${m.threadId}`,
    'Message ID': opts.test ? `TEST-ING-${m.id}` : m.id,
  };
  return head.map((h) => (d[h] === undefined || d[h] === null ? '' : d[h]));
}

// ---------- repeat applicants: same email OR same phone ----------
async function recomputeDuplicates() {
  const { rows, col } = await g.readApps();
  const data = rows.slice(1);
  const parent = data.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const seen = new Map();
  data.forEach((r, i) => {
    if ((r[col('Source')] || '') === 'TEST') return;
    const keys = [];
    const em = (r[col('Email')] || '').trim().toLowerCase(), ph = String(r[col('Phone')] || '').replace(/\D/g, '').slice(-10);
    if (em) keys.push('e:' + em); if (ph.length === 10) keys.push('p:' + ph);
    for (const k of keys) { if (seen.has(k)) parent[find(i)] = find(seen.get(k)); else seen.set(k, i); }
  });
  const groups = new Map();
  data.forEach((r, i) => { if ((r[col('Source')] || '') === 'TEST') return; const k = find(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  const time = (i) => { const d = new Date(data[i][col('Received')]); return isNaN(d) ? 0 : d.getTime(); };
  const day = (i) => { const d = new Date(data[i][col('Received')]); return isNaN(d) ? String(data[i][col('Received')]).slice(0, 10) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const ord = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
  const out = data.map(() => ['']);
  for (const m of groups.values()) {
    if (m.length < 2) continue;
    m.sort((a, b) => time(a) - time(b) || a - b);
    m.forEach((i, pos) => { out[i][0] = pos === 0 ? `1st of ${m.length} applications` : `${ord(pos + 1)} application (before: ${m.slice(0, pos).map((j) => `${day(j)}, ${data[j][col('Role Applied')]}`).join('; ')})`; });
  }
  const L = g.colLetter(col('Duplicate?'));
  await g.putValues(`Applications!${L}2:${L}${data.length + 1}`, out);
}

// ---------- step 1: read new applications into the Sheet ----------
async function ingest({ limit = Number(process.env.INGEST_LIMIT) || 40, full = false, dryRun = false, only = '', test = false, budgetMs = Number(process.env.INGEST_BUDGET_MS) || 30000 } = {}) {
  const t0 = Date.now();
  const { rows, col } = await g.readApps();
  const head = rows[0];
  const done = new Set(rows.slice(1).map((r) => (r[col('Message ID')] || '').trim()));
  const skipped = await g.skippedIds();
  const ids = only ? [only] : (await g.listMessageIds(`(${GMAIL_QUERY}) after:${EARLIEST.replace(/-/g, '/')}${full ? '' : ' newer_than:7d'}`)).reverse();
  const todo = only ? ids : ids.filter((id) => !done.has(id) && !skipped.has(id));
  const out = { found: ids.length, todo: todo.length, remaining: todo.length, added: 0, skipped: 0, names: [], errors: [] };
  if (dryRun || !todo.length) return out;

  const route = await routing();
  const newRows = [], skipRows = [];
  for (let i = 0; i < todo.length; i += 3) {
    if (Date.now() - t0 > budgetMs || newRows.length + skipRows.length >= limit) break;
    const res = await Promise.all(todo.slice(i, i + 3).map(async (id) => {
      try {
        const m = await x.readEmail(id);
        if (!only && m.date.slice(0, 10) < EARLIEST) return { skip: [id, 'too_old', m.subject.slice(0, 80), m.date] };
        const c = await x.extractCandidate(m);
        if (String(c.is_application).toLowerCase() === 'false') return { skip: [id, 'not_application', m.subject.slice(0, 80), m.date] };
        return { m, c };
      } catch (err) { out.errors.push(`${id}: ${String(err.message).slice(0, 110)}`); return null; }
    }));
    for (const r of res) {
      if (!r) continue;
      if (r.skip) skipRows.push(r.skip);
      else { newRows.push(toRow(r.m, r.c, head, route, { test })); out.names.push(`${r.c.name} | ${r.c.role_applied} | ${r.c.fit_score}/10`); }
    }
  }
  await g.appendRows(newRows);          // rows first, so a crash can never lose an application
  await g.addSkipped(skipRows);
  if (newRows.length) await recomputeDuplicates();
  out.added = newRows.length; out.skipped = skipRows.length;
  // a systemic failure (no credit, bad key, rate limit) means the work is NOT done; a one-off bad email does not hold things up
  out.systemic = out.errors.some((m) => /credit balance|401|403|429|overloaded|api key/i.test(m));
  const oneOff = out.systemic ? 0 : out.errors.length;
  out.remaining = Math.max(0, todo.length - newRows.length - skipRows.length - oneOff);
  return out;
}

// ---------- step 2: tell the assigned recruiter "a new lead has come in" ----------
async function notifyLeads({ inWindow, maxSends = 10 }) {
  if (!inWindow) return { sent: 0 };
  const { rows, col } = await g.readApps();
  const head = rows[0];
  const recs = await g.recruiters();
  const admin = recs.find((r) => /^akmal/i.test(r.name));
  const groups = new Map();
  rows.forEach((r, i) => {
    if (i === 0 || (r[col('Lead Notified')] || '').trim() || !(r[col('Message ID')] || '').trim()) return;
    const who = recs.find((p) => p.name === (r[col('Assigned Recruiter')] || '').trim()) || admin;
    if (!who) return;
    if (!groups.has(who.name)) groups.set(who.name, { who, items: [] });
    groups.get(who.name).items.push({ r, row1: i + 1 });
  });
  let sent = 0;
  const lead = (r) => ({ name: r[col('Name')], role: r[col('Role Applied')], score: r[col('Fit Score /10')], recommendation: r[col('AI Recommendation')], why: r[col('Why')], strengths: r[col('Strengths')], gaps: r[col('Gaps')], city: r[col('City')], expected: r[col('Expected CTC (CV)')], portfolio: r[col('Portfolio / LinkedIn')], received: r[col('Received')] });
  async function guarded(items, send) {
    // stamp first (ONE request for all rows), send second; if the send fails the stamps are undone the same way
    const stamp = `Emailed ${g.istStamp()}`;
    await g.updateCells(head, items.map((it) => ({ row1: it.row1, col: 'Lead Notified', value: stamp })));
    try { await send(); }
    catch (err) {
      try { await g.updateCells(head, items.map((it) => ({ row1: it.row1, col: 'Lead Notified', value: '' }))); }
      catch (e2) { console.error('could not undo lead stamps', e2.message); }
      throw err;
    }
  }
  for (const { who, items } of groups.values()) {
    if (sent >= maxSends) break;
    const first = who.name.split(' ')[0];
    if (items.length <= 3) {
      for (const it of items) {
        if (sent >= maxSends) break;
        const m = e.newLeadEmail({ first, lead: lead(it.r), sheetUrl: sheetUrl(it.row1), viewUrl: who.view });
        await guarded([it], () => g.sendMail(who.email, m.subject, m.html, m.text)); sent++;
      }
    } else {
      const m = e.leadDigestEmail({ first, leads: items.map((it) => lead(it.r)), viewUrl: who.view || sheetUrl(items[0].row1) });
      await guarded(items, () => g.sendMail(who.email, m.subject, m.html, m.text)); sent++;
    }
  }
  return { sent };
}

// ---------- step 3: each interviewer's schedule for today, from 07:00 IST ----------
async function interviewerDayReminders({ now, hour }) {
  if (hour < 7) return { sent: 0 };
  const today = g.istStamp(now).slice(0, 10);
  const { rows, col } = await g.readApps();
  const recs = await g.recruiters();
  const admin = recs.find((r) => /^akmal/i.test(r.name));
  let sent = 0;
  for (const rec of recs) {
    if (rec.sentFor === today) continue;
    const items = rows.slice(1).filter((r) => (r[col('Interview Slot')] || '').trim().startsWith(today) && (r[col('Assigned Recruiter')] || '').trim() === rec.name)
      .sort((a, b) => a[col('Interview Slot')].localeCompare(b[col('Interview Slot')]))
      .map((r) => { const pk = g.prettyKey(r[col('Interview Slot')].trim()); return { time: pk.time, name: r[col('Name')], role: r[col('Role Applied')], phone: r[col('Phone')], email: r[col('Email')] }; });
    if (!items.length) continue;
    const m = e.interviewerDayEmail({ first: rec.name.split(' ')[0], day: g.prettyKey(`${today} 10:00`).day, items });
    const cc = admin && admin.email.toLowerCase() !== rec.email.toLowerCase() ? admin.email : '';
    await g.setRecruiterCell(rec.row, 'H', today);              // stamp first, undo if the send fails
    try { await g.sendMail(rec.email, m.subject, m.html, m.text, cc); sent++; }
    catch (err) { await g.setRecruiterCell(rec.row, 'H', ''); throw err; }
  }
  return { sent };
}

module.exports = { ingest, notifyLeads, interviewerDayReminders, recomputeDuplicates, routing, assign };
