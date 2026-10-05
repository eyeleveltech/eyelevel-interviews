// POST /api/talk-start {c} -> a short-lived signed URL so the browser can talk to the agent.
// The agent itself is private (authentication on): nobody can start a conversation without this.
const g = require('../lib/google');
const t = require('../lib/talk');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  try {
    const code = String((req.body || {}).c || '').trim();
    if ((req.body || {}).consent !== true) return res.json({ ok: false, msg: 'Please tick the consent box before you start.' });
    const f = await g.findByCode(code);
    if (!f) return res.json({ ok: false, msg: 'This link is not valid.' });
    const { r, col, head, row1 } = f;
    const get = (n) => (r[col(n)] || '').trim();
    const linkSent = g.parseStamp(get('Link Sent'));
    if (!linkSent) return res.json({ ok: false, msg: 'This link is not active yet.' });
    if (get('Talked At')) return res.json({ ok: false, done: true });
    if (Date.now() - linkSent.getTime() > t.LINK_VALID_MS) return res.json({ ok: false, expired: true });

    const j = await t.eleven(`/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(t.AGENT())}`);
    if (!j.signed_url) throw new Error('no signed url');
    await g.updateRow(row1, head, { 'AI Chat Status': `In conversation (${g.istStamp()})`, 'AI Consent At': g.istStamp() });
    res.json({ ok: true, signedUrl: j.signed_url, vars: t.agentVars(get, code) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'The conversation could not be started. Please try again in a minute.' });
  }
};
