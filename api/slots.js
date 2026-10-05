// GET /api/slots?c=<booking code>  ->  candidate, which phase of the flow they are in, open slots
const g = require('../lib/google');
const { LINK_VALID_MS } = require('../lib/talk');

module.exports = async (req, res) => {
  try {
    const f = await g.findByCode(req.query.c);
    if (!f) return res.status(200).json({ valid: false });
    const { rows, col, r } = f;
    const get = (n) => (r[col(n)] || '').trim();
    const si = col('Interview Slot');
    const counts = {};
    rows.slice(1).forEach((x) => { const k = (x[si] || '').trim(); if (k) counts[k] = (counts[k] || 0) + 1; });
    const s = await g.settings();

    const linkSent = g.parseStamp(get('Link Sent'));
    const talked = get('Talked At');
    let phase = 'book';                       // links sent by hand, or earlier invitations
    if (talked) phase = get('Confirmed Interest').toLowerCase() === 'no' ? 'declined' : 'book';
    else if (linkSent) phase = Date.now() - linkSent.getTime() > LINK_VALID_MS ? 'expired' : 'talk';

    const rec = (await g.recruiters().catch(() => [])).find((x) => x.name === get('Assigned Recruiter'));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      valid: true, phase, declineReason: get('On-site OK?').toLowerCase() === 'no' ? 'onsite' : 'interest',
      until: linkSent ? g.istStamp(new Date(linkSent.getTime() + LINK_VALID_MS)).slice(0, 10) : '',
      first: get('Name').split(' ')[0],
      name: get('Name'),
      email: get('Email'),
      phone: get('Phone').replace(/\D/g, '').slice(-10),
      role: get('Role Applied'),
      current: get('Interview Slot'),
      laptop: (get('Bring Laptop?') || 'Yes').toLowerCase() !== 'no',
      contact: rec && rec.phone ? { name: rec.name, phone: rec.phone } : null,
      cap: s.cap,
      slots: g.openSlots(s, counts),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ valid: false, error: 'Something went wrong. Please try again.' });
  }
};
