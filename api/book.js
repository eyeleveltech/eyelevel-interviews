// POST /api/book {c, key}  ->  writes the slot to the Sheet, calendar invite, confirmation email.
// Only the candidate who owns the private booking code can book, and only for themselves.
const g = require('../lib/google');
const { confirmEmail } = require('../lib/email');

const { withLock } = require('../lib/lock');

const handle = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  try {
    const { c, key } = req.body || {};
    const sub = {
      name: String((req.body || {}).name || '').trim().slice(0, 80),
      email: String((req.body || {}).email || '').trim().slice(0, 120),
      phone: String((req.body || {}).phone || '').replace(/\D/g, '').slice(-10),
    };
    if (sub.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(sub.email) || !/^[6-9]\d{9}$/.test(sub.phone)) {
      return res.json({ ok: false, msg: 'Enter your full name, a valid email address and a 10-digit mobile number, then submit again.' });
    }
    const code = String(c || '').trim();
    const { rows, col } = await g.readApps();
    const ci = col('Booking Code');
    const idx = code ? rows.findIndex((r, i) => i > 0 && (r[ci] || '').trim() === code) : -1;
    if (idx < 0) return res.json({ ok: false, msg: 'This booking link is not valid. Reply to our email and we will help.' });

    const si = col('Interview Slot');
    const r = rows[idx];
    const prev = (r[si] || '').trim();
    if (prev === key) return res.json({ ok: true, msg: 'You are already booked for this slot.' });

    const counts = {};
    rows.slice(1).forEach((x) => { const k = (x[si] || '').trim(); if (k) counts[k] = (counts[k] || 0) + 1; });
    const slot = g.openSlots(await g.settings(), counts).find((s) => s.key === key);
    if (!slot) return res.json({ ok: false, msg: 'That slot is no longer available. Please pick another.' });
    if (slot.left <= 0) return res.json({ ok: false, msg: 'That slot just filled up. Please pick another.' });

    await g.updateRow(idx + 1, rows[0], { 'Interview Slot': key, 'Booked At': g.istStamp() });
    // the details the candidate submitted on the form are what we confirm to
    const bc = col('Booking Contact');
    const prevEmail = bc >= 0 && r[bc] ? (String(r[bc]).split(' | ')[1] || '').trim() : (r[col('Email')] || '').trim();
    if (bc >= 0) await g.setCell(idx + 1, bc, `${sub.name} | ${sub.email} | ${sub.phone}`);
    const email = sub.email;
    const name = sub.name;
    const role = r[col('Role Applied')] || '';
    // calendar + email failures must not undo a booking already saved in the Sheet
    try { await g.moveGuest(email, prev, key, prevEmail); } catch (e) { console.error('calendar', e); }
    if (email) {
      try {
        const laptop = String(r[col('Bring Laptop?')] || 'Yes').trim().toLowerCase() !== 'no';
        const rec = (await g.recruiters().catch(() => [])).find((x) => x.name === (r[col('Assigned Recruiter')] || '').trim());
        const m = confirmEmail({ first: name.split(' ')[0] || 'there', role, day: slot.day, time: slot.time, laptop, contact: rec ? { name: rec.name, phone: rec.phone } : null });
        await g.sendMail(email, m.subject, m.html, m.text);
      } catch (e) { console.error('mail', e); }
    }
    try { await require('../lib/interviewer').notify({ rows, col, head: rows[0], row1: idx + 1, r }, key, { prevSlotKey: prev }); }
    catch (e) { console.error('interviewer', e); }
    res.json({ ok: true, msg: `Booked for ${slot.day}, ${slot.time}. A confirmation and calendar invite are on the way to ${email || 'you'}.` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Something went wrong. Please try again in a minute.' });
  }
};

module.exports = (req, res) => withLock(() => handle(req, res));
