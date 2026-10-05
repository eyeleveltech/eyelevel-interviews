# EyeLevel Interview Site: VPS deployment guide

For the developer who will host this on EyeLevel's own server. Estimated time: 45 to 60 minutes.

## 0. Quick path: Ubuntu server that already runs Apache (about 15 minutes)

The main website's server answers as Apache on Ubuntu, so use this. One script does steps 4 to 7 of this guide for you, and it only ever adds a **new** Apache site for `interview.theeyelevelstudio.com`. It does not edit any other site, and it tests the Apache configuration before reloading (if the test fails it removes its own file and leaves everything as it was).

**Akmal, on his Mac (once):**
```bash
python3 HR_RECRUITER/booking_site/vps/make_env.py --domain interview.theeyelevelstudio.com
```

**Move two files to the server** (the settings file contains secrets, so use `scp` or a password manager's secure share, never email or chat):
```bash
scp HR_RECRUITER/eyelevel-interviews-vps.zip HR_RECRUITER/booking_site/vps/vps.env YOUR_USER@SERVER_IP:/tmp/
```

**Developer, in GoDaddy:** add an **A record**: Name `interview`, Value = the server's IP, TTL 600. (If the booking site goes on the same server as the main website, that IP is 91.108.105.155.)

**Developer, on the server:**
```bash
unzip -p /tmp/eyelevel-interviews-vps.zip vps/install-ubuntu-apache.sh > /tmp/install.sh
sudo bash /tmp/install.sh --zip /tmp/eyelevel-interviews-vps.zip --env /tmp/vps.env --email YOUR_EMAIL --dry-run   # read what it will do
sudo bash /tmp/install.sh --zip /tmp/eyelevel-interviews-vps.zip --env /tmp/vps.env --email YOUR_EMAIL             # the real run
shred -u /tmp/vps.env
```
- If the DNS record is not visible yet, the script installs everything except the HTTPS certificate and tells you so. Run it again once `nslookup interview.theeyelevelstudio.com` shows the IP.
- To switch the site off again: `sudo bash /tmp/install.sh --rollback` (the main website is never touched).
- The script finishes with a test summary. Everything should say OK, including the deep check (Google login, Sheet, hr@ mailbox, ElevenLabs, Claude).

The rest of this guide explains each step in detail, for troubleshooting or a manual install.

## 1. What this is

A small Node.js app (Node 18 or newer, tested logic runs on 20 LTS). It does four jobs:

| Part | What it does |
|---|---|
| Web page (`public/index.html`) | The page candidates open from their email. They talk to "Tara", the AI recruiter, in the browser, then pick an interview slot. |
| API (`api/*.js`) | `/api/slots`, `/api/talk-start`, `/api/talk-done`, `/api/book`, plus `/api/cron` (the scheduled job). |
| Scheduler | Every 10 minutes, `/api/cron` reads new job applications from the hr@ mailbox (CV included) and adds them to the Sheet with an AI score, emails the assigned recruiter that a new lead has come in, sends the AI-recruiter link emails, reminders (24h and 48h), expiry (7 days), interview invitations, and the morning-of-interview reminder (from 7:00 AM IST). It is built into the server, no crontab needed. |
| Data | **No database.** All candidate data lives in a Google Sheet (EyeLevel HR Applications). The server is stateless, so there is nothing to back up on the VPS. |

It talks to: Google Sheets, Google Calendar and Gmail (acting as hr@eyelevelstudio.in), ElevenLabs (the AI voice agent) and Anthropic (Claude, which reads and scores each application).

## 2. What Akmal does first (before the developer starts)

1. **The address is `interview.theeyelevelstudio.com`.** It does not exist yet; the developer creates it in step 3.
2. **Generate the settings file** on his Mac:
   ```bash
   python3 HR_RECRUITER/booking_site/vps/make_env.py --domain interview.theeyelevelstudio.com
   ```
   This writes `vps.env` (it contains secrets). **Send it to the developer over a secure channel only** (`scp`, or a password manager's secure share). **Never by email, WhatsApp or chat.** Delete the copy on his Mac afterwards.
3. **Send the package**: `HR_RECRUITER/eyelevel-interviews-vps.zip` (contains no secrets).

## 3. Server requirements

- Ubuntu 22.04 or 24.04 (any Linux with systemd works), 1 vCPU, 1 GB RAM is plenty.
- Public IP, with inbound **80 and 443** open. Port 3000 stays internal.
- **Outbound HTTPS** allowed to: `oauth2.googleapis.com`, `sheets.googleapis.com`, `www.googleapis.com`, `gmail.googleapis.com`, `api.elevenlabs.io`, `api.anthropic.com`.
- **DNS (GoDaddy).** The domain's DNS is at GoDaddy (nameservers `ns07/ns08.domaincontrol.com`). Add one record: GoDaddy > My Products > theeyelevelstudio.com > DNS > Add New Record:
  - Type **A**, Name **interview**, Value **the VPS's public IP**, TTL 600 seconds.
  - If the booking site goes on the same server as the main website, that IP is **91.108.105.155** (what `theeyelevelstudio.com` points to today). Use the real IP of whichever server runs it.
  - Check with `nslookup interview.theeyelevelstudio.com` (it should show the IP; allow up to 30 minutes).
- **Is the server already running Apache?** The main website's server answers as Apache 2.4 on Ubuntu. If you install this on that same server, **do not install nginx** (it would fight Apache for ports 80 and 443). Use the Apache option in step 4.5.

(Candidates' browsers also load `cdn.jsdelivr.net`, `fonts.googleapis.com` and connect directly to `wss://api.elevenlabs.io`. That traffic never touches the server.)

## 4. Install

Run as root. The address is `interview.theeyelevelstudio.com`; replace `YOUR_EMAIL` with an address for certificate notices.

```bash
# 4.1 packages and Node 20  (fresh server: also install nginx, certbot and ufw; see the note below)
apt update && apt install -y unzip curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
node -v        # should print v20.x

# FRESH server only (skip all of this on the existing Apache server):
# apt install -y nginx certbot python3-certbot-nginx ufw
# ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable

# 4.2 service user and app files
adduser --system --group --home /opt/eyelevel-interviews eyelevel
unzip -o /tmp/eyelevel-interviews-vps.zip -d /opt/eyelevel-interviews
cd /opt/eyelevel-interviews && npm ci --omit=dev
chown -R eyelevel:eyelevel /opt/eyelevel-interviews

# 4.3 secrets (file received from Akmal at /tmp/vps.env)
install -m 600 -o root -g root /tmp/vps.env /etc/eyelevel-interviews.env
shred -u /tmp/vps.env
grep -c = /etc/eyelevel-interviews.env      # should print 13 (13 settings)

# 4.4 run it as a service
cp /opt/eyelevel-interviews/vps/eyelevel-interviews.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now eyelevel-interviews
systemctl status eyelevel-interviews --no-pager
curl -s http://127.0.0.1:3000/healthz    # {"ok":true}

# 4.5 web server + HTTPS: choose ONE.

# 4.5a  Server already runs Apache (the main website's server):
apt install -y certbot python3-certbot-apache
a2enmod proxy proxy_http
cp /opt/eyelevel-interviews/vps/apache-site.conf /etc/apache2/sites-available/interview.conf
a2ensite interview && apachectl configtest && systemctl reload apache2
certbot --apache -d interview.theeyelevelstudio.com --redirect -m YOUR_EMAIL --agree-tos --no-eff-email

# 4.5b  Fresh server with nothing on ports 80/443:
apt install -y nginx certbot python3-certbot-nginx
cp /opt/eyelevel-interviews/vps/nginx-site.conf /etc/nginx/sites-available/eyelevel-interviews
ln -s /etc/nginx/sites-available/eyelevel-interviews /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d interview.theeyelevelstudio.com --redirect -m YOUR_EMAIL --agree-tos --no-eff-email
```

If the app refuses to start, the log names the missing setting: `journalctl -u eyelevel-interviews -e`.

## 5. Check it works

| Test | Expected |
|---|---|
| `curl -s https://interview.theeyelevelstudio.com/healthz` | `{"ok":true}` |
| `curl -s https://interview.theeyelevelstudio.com/api/slots?c=invalid` | `{"valid":false}` |
| `curl -s -o /dev/null -w "%{http_code}" https://interview.theeyelevelstudio.com/api/cron` | `401` (the job is password-protected) |
| Open `https://interview.theeyelevelstudio.com/?c=invalid` in a browser | Page with EyeLevel logo and "This scheduling link is not valid" |
| `curl -sI https://interview.theeyelevelstudio.com/` | Headers include `Referrer-Policy: same-origin` and `Permissions-Policy: microphone=(self)` |
| Browser shows a padlock | Certificate valid |

Then ask Akmal to mark the TEST row **Shortlisted** in the Sheet. Within 10 minutes a test email arrives; its link must open on `interview.theeyelevelstudio.com`, and the microphone prompt must appear when "Start conversation" is pressed.

## 5b. Settings you can add later (optional)

Add these lines to `/etc/eyelevel-interviews.env`, then `systemctl restart eyelevel-interviews`:

| Setting | Meaning |
|---|---|
| `LEAD_EMAILS` | "A new lead has come in" emails to the assigned recruiters. **Currently `off`: paused by Akmal on 5 Oct 2026.** Set it to `on` only when Akmal says so. |
| `INGEST_BUDGET_MS=240000` | How long one 10-minute run may spend reading new applications. Recommended on the VPS (default is 30 seconds, which suits Vercel). |

## 6. Cutting over from the temporary Vercel site

The site currently runs at `eyelevel-interviews.vercel.app`. Emails already sent contain that address, so **leave the Vercel project in place** (free) so old links keep working. Both versions read and write the same Sheet.

**Important:** only one scheduler should run. When the VPS is confirmed working, tell Akmal / Claude to **remove the cron entry from Vercel** (`vercel.json`) so emails are not sent twice. New emails automatically use `APP_URL` from the settings file.

## 7. Day-to-day operations

```bash
journalctl -u eyelevel-interviews -f          # live log (lines starting "cron" mean emails were sent)
systemctl restart eyelevel-interviews          # after changing the settings file
```

- **Update the code:** unzip the new package over `/opt/eyelevel-interviews`, run `npm ci --omit=dev` in `/opt/eyelevel-interviews`, then `systemctl restart eyelevel-interviews`.
- **Monitoring:** point an uptime monitor (UptimeRobot or similar) at `https://interview.theeyelevelstudio.com/healthz` (is the server up). Also add a second monitor on `https://interview.theeyelevelstudio.com/api/health` with the header `Authorization: Bearer <CRON_SECRET from the settings file>`. It checks the Google login, the Sheet, the hr@ mailbox, ElevenLabs and Claude, and returns HTTP 503 if any of them fails, so a revoked login or an empty Claude balance is noticed before candidates are.
- **Google sign-in expiry:** the site acts as hr@eyelevelstudio.in with a long-lived token. If it ever stops working (the page shows "Something went wrong" and the log says `Google auth failed`), Akmal re-runs `python3 HR_RECRUITER/hr_gmail_auth.py` on his Mac (sign in as hr@), runs `make_env.py` again, and the developer replaces `HR_REFRESH_TOKEN` in `/etc/eyelevel-interviews.env` and restarts the service.
- **Security updates:** `apt install unattended-upgrades` is recommended.

## 8. Security notes

- Secrets live only in `/etc/eyelevel-interviews.env` (root-only, mode 600). Nothing secret is in the code or the zip.
- The app listens on `127.0.0.1:3000` only; the web server (Apache or nginx) is the single public entry. With nginx, API requests are also rate-limited; on Apache, `fail2ban` is a sensible addition.
- Each candidate's link carries a random code. The conversation agent in ElevenLabs is private: conversations can only start through the server, which checks the code first.
- Candidate personal data (name, email, phone, answers, recordings) is stored in the Google Sheet and in ElevenLabs, not on this server. The site's privacy policy is `https://theeyelevelstudio.com/privacy-policy`.

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Service exits immediately | A setting is missing in `/etc/eyelevel-interviews.env`; the log names it |
| 502 / 503 error | The service is down: `systemctl status eyelevel-interviews` |
| Certbot says it cannot verify the domain | The DNS record is missing or not propagated yet (`nslookup interview.theeyelevelstudio.com`) |
| Main website stops loading after install | nginx was installed on an Apache server. Remove nginx, use step 4.5a |
| Page loads, slots never appear | Google token problem: see "Google sign-in expiry" |
| "Start conversation" does nothing | Microphone blocked in the browser, or the page is not on HTTPS |
| Emails are not sent | `journalctl -u eyelevel-interviews`; outbound HTTPS to `gmail.googleapis.com` may be blocked |
| Emails sent twice | The Vercel cron is still active (section 6) |
| Link emails arrive late | Link and reminder emails only go out 08:00 to 21:00 IST by design |

## 10. Files in the package

```
public/index.html      the candidate page          api/*.js     the endpoints
public/eyelevel-logo.png                           lib/*.js     Sheets, Calendar, Gmail, emails
vps/server.js          the server (Express)        vps/nginx-site.conf or vps/apache-site.conf, vps/eyelevel-interviews.service
vps/.env.example       the list of settings        vps/make_env.py   (Akmal runs this, not the developer)
```
