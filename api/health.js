// GET /api/health  (Authorization: Bearer $CRON_SECRET) -> checks every outside service the system depends on.
// Point an uptime monitor at it so a revoked Google login or a bad key is noticed before candidates are.
const g = require('../lib/google');

module.exports = async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ ok: false });
  const checks = {};
  const run = async (name, fn) => { try { await fn(); checks[name] = 'ok'; } catch (e) { checks[name] = 'FAILED: ' + String(e.message).slice(0, 80); } };
  await run('google_login', async () => { await g.recruiters(); });
  await run('sheet', async () => { const { rows } = await g.readApps(); if (!rows.length) throw new Error('empty'); });
  await run('gmail_hr_mailbox', async () => { await g.listMessageIds('newer_than:1d', 1); });
  await run('elevenlabs', async () => {
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${process.env.ELEVENLABS_AGENT_ID}`, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
    if (!r.ok) throw new Error('status ' + r.status);
  });
  await run('anthropic', async () => {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.EXTRACT_MODEL || 'claude-haiku-4-5', max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error?.message || 'status ' + r.status);
  });
  const ok = Object.values(checks).every((v) => v === 'ok');
  res.status(ok ? 200 : 503).json({ ok, checks });
};
