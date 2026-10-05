// Runs the same pages and API handlers as the Vercel deployment, on a plain Node server for a VPS.
//   public/        -> the web page      api/*.js -> /api/<name>      lib/ -> shared code (unchanged)
// Listens on 127.0.0.1 only: put nginx (or any reverse proxy) with HTTPS in front of it.
const path = require('path');
const fs = require('fs');
const express = require('express');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;

const REQUIRED = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'HR_REFRESH_TOKEN', 'SHEET_ID',
  'ELEVENLABS_API_KEY', 'ELEVENLABS_AGENT_ID', 'ANTHROPIC_API_KEY', 'CRON_SECRET', 'APP_URL'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) { console.error('Missing environment variables: ' + missing.join(', ')); process.exit(1); }

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'same-origin');          // the candidate's code is in the URL: never leak it
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Permissions-Policy', 'microphone=(self)');  // the AI conversation needs the microphone
  next();
});
app.use(express.json({ limit: '50kb' }));

app.get('/healthz', (req, res) => res.json({ ok: true }));

for (const f of fs.readdirSync(path.join(ROOT, 'api')).filter((x) => x.endsWith('.js'))) {
  const handler = require(path.join(ROOT, 'api', f));
  app.all('/api/' + f.slice(0, -3), async (req, res) => {
    try { await handler(req, res); } catch (e) { console.error(f, e); if (!res.headersSent) res.status(500).json({ ok: false }); }
  });
}

app.use(express.static(path.join(ROOT, 'public'), {
  maxAge: '1d',
  setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); },
}));
app.use((req, res) => res.status(404).type('text').send('Not found'));

app.listen(PORT, '127.0.0.1', () => console.log(`Interview site listening on 127.0.0.1:${PORT} (${process.env.APP_URL})`));

// Scheduler: every 10 minutes run /api/cron (read new applications, new-lead emails, AI-recruiter links, reminders,
// interview invitations, interviewer notifications and schedules).
// Set DISABLE_INTERNAL_CRON=1 if you would rather call /api/cron from the system crontab (see the guide).
if (process.env.DISABLE_INTERNAL_CRON !== '1') {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/cron`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
      const j = await r.json();
      if ((j.applications && j.applications.added) || j.leadEmails || j.interviewerDay || j.links || j.reminder1 || j.reminder2 || j.invitations || j.expired || (j.errors && j.errors.length) || !j.ok) console.log('cron', JSON.stringify(j));
    } catch (e) { console.error('cron tick failed:', e.message); }
    finally { running = false; }
  };
  setTimeout(() => { tick(); setInterval(tick, 10 * 60 * 1000); }, 30 * 1000);
  console.log('Internal scheduler on: every 10 minutes');
}
