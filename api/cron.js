// Runs every 10 minutes. Needs: Authorization: Bearer $CRON_SECRET.
//  0. new applications in hr@   -> extract, score, add to the Sheet; then email the assigned recruiter "a new lead has come in"
//  A. rows marked Shortlisted          -> email the "talk to our AI recruiter" link
//  B. link not used after 24h          -> reminder 1;   24h after that -> reminder 2;   after 7 days -> expired
//  C. said yes, not booked in 30 min   -> email the interview invitation with the booking link
//  D. interview is today (from 07:00)  -> morning reminder with time + address (skipped if they booked today)
// Emails to candidates go out 08:00-21:00 IST only (the invitation in C is a reply to their action, so any time).
const crypto = require('crypto');
const g = require('../lib/google');
const e = require('../lib/email');
const { LINK_VALID_MS } = require('../lib/talk');
const { notify } = require('../lib/interviewer');
const apps = require('../lib/applications');

const HOUR = 3600 * 1000;
const MAX_SENDS = 30; // per run; the next run continues

module.exports = async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false });
  }
  const now = new Date();
  const hour = g.istHour(now);
  const inWindow = hour >= 8 && hour < 21;
  const out = { links: 0, reminder1: 0, reminder2: 0, invitations: 0, expired: 0, errors: [] };
  const admin0 = (await g.recruiters().catch(() => [])).find((x) => /^akmal/i.test(x.name));
  // 0. applications -> Sheet -> recruiter email (each part isolated so one failure never blocks the rest)
  let backlog = false;
  try {
    const ing = await apps.ingest({ full: req.query && req.query.full === '1' });
    out.applications = { found: ing.found, todo: ing.todo, added: ing.added, skipped: ing.skipped, remaining: ing.remaining };
    backlog = ing.remaining > 0;
    ing.errors.forEach((x) => out.errors.push('ingest ' + x));
  } catch (err) { out.errors.push('ingest: ' + String(err.message).slice(0, 120)); }
  // tell Akmal (once a day) when the AI cannot read applications because the account is out of credit
  if (out.errors.some((m) => /credit balance/i.test(m)) && admin0) {
    try {
      const today = g.istStamp(now).slice(0, 10);
      const sent = ((await g.getValues('Recruiters!J2'))[0] || [''])[0];
      if (sent !== today) {
        const m = e.alertEmail({ title: 'New applications cannot be read: AI credit has run out', lines: ['The Claude (Anthropic) account that reads and scores applications has no credit left, so new applications are waiting unread.', 'Please top up at console.anthropic.com, under Plans & Billing. They will be read automatically in the next run, and the recruiters will then get their new-lead emails.'] });
        await g.sendMail(admin0.email, m.subject, m.html, m.text);
        await g.setRecruiterCell(2, 'J', today);
      }
    } catch (err) { out.errors.push('alert: ' + String(err.message).slice(0, 80)); }
  }
  // Lead emails to recruiters stay OFF until LEAD_EMAILS=on, and wait while a backlog is still being read (one summary, not dozens)
  if (process.env.LEAD_EMAILS === 'on' && !backlog) {
    try { out.leadEmails = (await apps.notifyLeads({ inWindow })).sent; } catch (err) { out.errors.push('leads: ' + String(err.message).slice(0, 120)); }
  } else out.leadEmails = 'off';
  try {
    const { rows, col } = await g.readApps();
    const head = rows[0];
    let budget = MAX_SENDS;
    const recs = await g.recruiters();
    const admin = recs.find((x) => /^akmal/i.test(x.name));

    // stamp first, send second; if the send fails, undo the stamp. Prevents double sends if two runs overlap.
    async function guarded(row1, stampCols, status, send) {
      const clear = Object.fromEntries(Object.keys(stampCols).map((k) => [k, '']));
      clear['AI Chat Status'] = (rows[row1 - 1][col('AI Chat Status')] || '');
      await g.updateRow(row1, head, { ...stampCols, ...(status ? { 'AI Chat Status': status } : {}) });
      try { await send(); budget--; return true; }
      catch (err) { out.errors.push(`row ${row1}: ${String(err.message).slice(0, 120)}`); await g.updateRow(row1, head, clear); return false; }
    }

    for (let i = 1; i < rows.length && budget > 0; i++) {
      const r = rows[i], row1 = i + 1;
      const get = (n) => (r[col(n)] || '').trim();
      const email = get('Email');
      if (!email) continue;
      const first = (get('Name').split(' ')[0] || 'there');
      const role = get('Role Applied') || 'the role you applied for';

      // A. send the talk link
      if (get('Shortlisted').toLowerCase() === 'shortlisted' && !get('Link Sent')) {
        if (!inWindow) continue;
        const code = get('Booking Code') || crypto.randomBytes(9).toString('base64url');
        const until = g.istStamp(new Date(now.getTime() + LINK_VALID_MS)).slice(0, 10);
        const m = e.linkEmail({ first, role, link: `${g.BASE}/?c=${code}`, until });
        if (await guarded(row1, { 'Booking Code': code, 'Link Sent': g.istStamp(now) }, 'Link sent', () => g.sendMail(email, m.subject, m.html, m.text))) out.links++;
        continue;
      }

      // E. interviewer not told yet, or 'Assigned Recruiter' was changed in the Sheet after booking
      const slotKey = get('Interview Slot');
      if (slotKey) {
        const st = g.parseStamp(slotKey);
        const told = ((get('Interviewer Notified').match(/<([^>]+)>/) || [])[1] || '').toLowerCase();
        const want = ((recs.find((x) => x.name === get('Assigned Recruiter')) || admin || {}).email || '').toLowerCase();
        if (st && st.getTime() > now.getTime() && want && told !== want) {
          try { await notify({ rows, col, head, row1, r }, slotKey, { reassigned: !!told }); budget--; out.interviewers = (out.interviewers || 0) + 1; }
          catch (err) { out.errors.push(`interviewer row ${row1}: ${String(err.message).slice(0, 100)}`); }
          continue;
        }
      }

      // D. morning-of reminder (applies to every booked candidate)
      if (slotKey && !get('Day-of Reminder Sent') && hour >= 7) {
        const start = g.parseStamp(slotKey);
        const today = g.istStamp(now).slice(0, 10);
        const booked = g.parseStamp(get('Booked At'));
        if (start && slotKey.slice(0, 10) === today && start.getTime() - now.getTime() > 60 * 60000
            && (!booked || g.istStamp(booked).slice(0, 10) < today)) {
          const pk = require('../lib/google').prettyKey(slotKey);
          const laptop = (get('Bring Laptop?') || 'Yes').toLowerCase() !== 'no';
          const cr = recs.find((x) => x.name === get('Assigned Recruiter'));
          const m = e.dayOfEmail({ first, role, day: pk.day, time: pk.time, laptop, contact: cr ? { name: cr.name, phone: cr.phone } : null });
          if (await guarded(row1, { 'Day-of Reminder Sent': g.istStamp(now) }, null, () => g.sendMail(email, m.subject, m.html, m.text))) out.dayOf = (out.dayOf || 0) + 1;
          continue;
        }
      }

      const linkSent = g.parseStamp(get('Link Sent'));
      if (!linkSent) continue;
      const talked = get('Talked At');

      if (!talked) {
        const age = now.getTime() - linkSent.getTime();
        if (age > LINK_VALID_MS) {
          if (!/^Expired/.test(get('AI Chat Status'))) { await g.updateRow(row1, head, { 'AI Chat Status': 'Expired: no response' }); out.expired++; }
          continue;
        }
        const code = get('Booking Code');
        const until = g.istStamp(new Date(linkSent.getTime() + LINK_VALID_MS)).slice(0, 10);
        const link = `${g.BASE}/?c=${code}`;
        if (!get('Reminder 1 Sent') && age >= 24 * HOUR && inWindow) {
          const m = e.reminderEmail({ first, role, link, until, n: 1 });
          if (await guarded(row1, { 'Reminder 1 Sent': g.istStamp(now) }, 'Reminder 1 sent', () => g.sendMail(email, m.subject, m.html, m.text))) out.reminder1++;
        } else if (get('Reminder 1 Sent') && !get('Reminder 2 Sent') && inWindow) {
          const t1 = g.parseStamp(get('Reminder 1 Sent'));
          if (t1 && now.getTime() - t1.getTime() >= 24 * HOUR) {
            const m = e.reminderEmail({ first, role, link, until, n: 2 });
            if (await guarded(row1, { 'Reminder 2 Sent': g.istStamp(now) }, 'Reminder 2 sent', () => g.sendMail(email, m.subject, m.html, m.text))) out.reminder2++;
          }
        }
        continue;
      }

      // C. said yes (or unclear) but has not booked after 30 minutes
      if (get('Confirmed Interest').toLowerCase() !== 'no' && !get('Interview Slot') && !get('Invitation Email Sent')) {
        const t = g.parseStamp(talked);
        if (t && now.getTime() - t.getTime() >= 30 * 60000) {
          const laptop = (get('Bring Laptop?') || 'Yes').toLowerCase() !== 'no';
          const m = e.invitationEmail({ first, role, link: `${g.BASE}/?c=${get('Booking Code')}`, laptop });
          if (await guarded(row1, { 'Invitation Email Sent': g.istStamp(now) }, null, () => g.sendMail(email, m.subject, m.html, m.text))) out.invitations++;
        }
      }
    }
    try { out.interviewerDay = (await apps.interviewerDayReminders({ now, hour })).sent; } catch (err) { out.errors.push('interviewer day: ' + String(err.message).slice(0, 120)); }
    res.status(200).json({ ok: true, inWindow, ...out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err.message).slice(0, 200), ...out });
  }
};
