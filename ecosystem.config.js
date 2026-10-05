// PM2 config for the VPS.   Start: pm2 start ecosystem.config.js && pm2 save
// After editing .env:        pm2 restart ecosystem.config.js --update-env
// Keep ONE instance in fork mode: the app runs its own 10-minute email job, so two copies would send every email twice.
const fs = require('fs');
const path = require('path');

// The settings file (vps.env from Akmal), saved as .env next to this file. chmod 600; .gitignore keeps it out of git.
const ENV_FILE = path.join(__dirname, '.env');
const env = {};
for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

module.exports = {
  apps: [{
    name: 'eyelevel-interview',
    script: 'vps/server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    restart_delay: 5000,
    env,
  }],
};
