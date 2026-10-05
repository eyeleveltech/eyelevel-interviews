#!/usr/bin/env python3
"""
Akmal runs this on his Mac to produce the production settings file for the VPS.
It reads the existing keys, writes ONE file (chmod 600) and prints only the NAMES of what it wrote.

    python3 HR_RECRUITER/booking_site/vps/make_env.py --domain interview.theeyelevelstudio.com

Then move the file to the server over a secure channel (scp, or a password manager's secure share).
Never send it by email, WhatsApp or chat. Delete your copy once the server is running.
"""
import argparse, json, os, secrets, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HR = os.path.abspath(os.path.join(HERE, '..', '..'))
ROOT = os.path.dirname(HR)

ap = argparse.ArgumentParser()
ap.add_argument('--domain', required=True, help='e.g. interview.theeyelevelstudio.com (no https://)')
ap.add_argument('--out', default=os.path.join(HERE, 'vps.env'))
a = ap.parse_args()

env = {}
for line in open(os.path.join(ROOT, 'CONNECTIONS', '.env')):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
token = json.load(open(os.path.join(HR, '.hr_gmail_token.json')))
cfg = json.load(open(os.path.join(HR, 'config.json')))

vals = {
    'PORT': '3000',
    'APP_URL': 'https://' + a.domain.strip().strip('/'),
    'GOOGLE_CLIENT_ID': env['GOOGLE_CLIENT_ID'],
    'GOOGLE_CLIENT_SECRET': env['GOOGLE_CLIENT_SECRET'],
    'HR_REFRESH_TOKEN': token['refresh_token'],
    'SHEET_ID': cfg['sheet_id'],
    'ELEVENLABS_API_KEY': env['ELEVENLABS_API_KEY'],
    'ELEVENLABS_AGENT_ID': env['ELEVENLABS_AGENT_ID'],
    'ANTHROPIC_API_KEY': env['ANTHROPIC_API_KEY'],
    'EXTRACT_MODEL': 'claude-haiku-4-5',
    'LEAD_EMAILS': 'off',
    'INGEST_BUDGET_MS': '240000',
    'CRON_SECRET': secrets.token_urlsafe(32),
}
missing = [k for k, v in vals.items() if not v]
if missing:
    sys.exit('Missing values for: ' + ', '.join(missing))
fd = os.open(a.out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write('\n'.join(f'{k}={v}' for k, v in vals.items()) + '\n')
print('Wrote', a.out, '(permissions 600) with:', ', '.join(vals))
print('Now move it to the server securely, and delete this copy afterwards.')
