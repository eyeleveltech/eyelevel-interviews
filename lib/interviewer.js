// Tells the assigned interviewer about a booking, puts them on the calendar slot, and keeps Akmal in copy.
// Also handles a reassignment: the new person is notified and the old one is taken off the slot.
const g = require('./google');
const e = require('./email');

const ADMIN = /^akmal/i;

// `f` = { rows, col, head, row1, r } for the candidate's row, `slotKey` like "2026-10-06 11:00"
async function notify(f, slotKey, { reassigned = false, prevSlotKey = '' } = {}) {
  const { rows, col, head, row1, r } = f;
  const get = (n) => (r[col(n)] || '').trim();
  const recs = await g.recruiters();
  const admin = recs.find((x) => ADMIN.test(x.name));
  const rec = recs.find((x) => x.name === get('Assigned Recruiter')) || admin;
  if (!rec) throw new Error('no recruiter to notify');

  const pk = g.prettyKey(slotKey);
  const m = e.interviewerEmail({
    first: rec.name.split(' ')[0], name: get('Name'), phone: get('Phone'), email: get('Email'), role: get('Role Applied'),
    day: pk.day, time: pk.time, score: get('Fit Score /10'), recommendation: get('AI Recommendation'),
    strengths: get('Strengths'), gaps: get('Gaps'), location: get('Location (Chennai)'), status: get('Fresher / Working'),
    currentCtc: get('Current CTC (said)'), expectedCtc: get('Expected CTC (said)'), joining: get('Joining Date (said)'),
    summary: get('AI Chat Summary').split('\n')[0].slice(0, 400),
    sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.SHEET_ID}/edit#gid=0&range=A${row1}`, reassigned,
  });
  const cc = admin && admin.email.toLowerCase() !== rec.email.toLowerCase() ? admin.email : '';

  // previous interviewer (if any) comes off the slot unless they still have another candidate in it
  const prev = (get('Interviewer Notified').match(/<([^>]+)>/) || [])[1];
  if (prev && prev.toLowerCase() !== rec.email.toLowerCase()) {
    const prevName = (recs.find((x) => x.email.toLowerCase() === prev.toLowerCase()) || {}).name;
    const si = col('Interview Slot'), ai = col('Assigned Recruiter');
    const stillHas = rows.some((x, i) => i > 0 && i + 1 !== row1 && (x[si] || '').trim() === slotKey && (x[ai] || '').trim() === prevName);
    if (!stillHas) await g.patchGuests(slotKey, { remove: prev }).catch((err) => console.error('calendar remove', err.message));
  }

  // candidate moved to another slot: the interviewer leaves the old one unless they still have someone in it
  if (prevSlotKey && prevSlotKey !== slotKey) {
    const si = col('Interview Slot'), ai = col('Assigned Recruiter');
    const stillHas = rows.some((x, i) => i > 0 && i + 1 !== row1 && (x[si] || '').trim() === prevSlotKey && (x[ai] || '').trim() === rec.name);
    if (!stillHas) await g.patchGuests(prevSlotKey, { remove: rec.email }).catch((err) => console.error('calendar leave', err.message));
  }

  // stamp first, send second: if the send fails the stamp is undone, and a failed write can never cause repeat emails
  const before = get('Interviewer Notified');
  await g.updateRow(row1, head, { 'Interviewer Notified': `${rec.name} <${rec.email}> | ${g.istStamp()}` });
  try { await g.sendMail(rec.email, m.subject, m.html, m.text, cc); }
  catch (err) { await g.updateRow(row1, head, { 'Interviewer Notified': before }); throw err; }
  await g.patchGuests(slotKey, { add: rec.email }).catch((err) => console.error('calendar add', err.message));
  return rec;
}

module.exports = { notify };
