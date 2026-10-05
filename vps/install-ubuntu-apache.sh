#!/usr/bin/env bash
# EyeLevel interview site: installer for an Ubuntu 22.04 / 24.04 server that already runs Apache.
#
# What it does (safe to run again, which updates the site):
#   1. checks the server (Ubuntu, Apache running, port 3000 free, DNS) before touching anything
#   2. installs Node 20 (and certbot) if missing
#   3. unpacks the app to /opt/eyelevel-interviews and installs its dependencies
#   4. installs the settings file to /etc/eyelevel-interviews.env (root only)
#   5. runs the app as a systemd service ("eyelevel-interviews") that restarts itself
#   6. adds ONE new Apache site for the domain (a new file; no other site is edited) and reloads Apache gracefully
#   7. gets the HTTPS certificate with certbot
#   8. tests everything and prints a summary
#
# Usage (as root):
#   sudo bash install-ubuntu-apache.sh --zip /tmp/eyelevel-interviews-vps.zip --env /tmp/vps.env --email you@example.com
# Options:
#   --domain NAME    default interview.theeyelevelstudio.com
#   --skip-https     do everything except the certificate (use before the DNS record exists)
#   --dry-run        print what would happen, change nothing
#   --rollback       switch the site off again (Apache site disabled, service stopped); data is not deleted

set -euo pipefail

DOMAIN="interview.theeyelevelstudio.com"; ZIP=""; ENVSRC=""; EMAIL=""; SKIP_HTTPS=0; DRY=0; ROLLBACK=0
APP_DIR=/opt/eyelevel-interviews; ENV_DEST=/etc/eyelevel-interviews.env; SERVICE=eyelevel-interviews; SITE=interview

while [ $# -gt 0 ]; do
  case "$1" in
    --zip) ZIP="$2"; shift 2;; --env) ENVSRC="$2"; shift 2;; --email) EMAIL="$2"; shift 2;;
    --domain) DOMAIN="$2"; shift 2;; --skip-https) SKIP_HTTPS=1; shift;; --dry-run) DRY=1; shift;; --rollback) ROLLBACK=1; shift;;
    -h|--help) sed -n '2,25p' "$0"; exit 0;;
    *) echo "Unknown option: $1"; exit 1;;
  esac
done

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()   { printf '   OK  %s\n' "$*"; }
warn() { printf '   !!  %s\n' "$*"; }
die()  { printf '\n   STOP: %s\n\n' "$*"; exit 1; }
run()  { if [ "$DRY" = 1 ]; then printf '   [dry-run] %s\n' "$*"; else "$@"; fi; }

if [ "$DRY" = 0 ] && [ "$(id -u)" -ne 0 ]; then die "Run this as root: sudo bash $0 ..."; fi

# ---------------------------------------------------------------- rollback
if [ "$ROLLBACK" = 1 ]; then
  say "Rolling back"
  run a2dissite "$SITE" || true
  run apache2ctl configtest
  run systemctl reload apache2
  run systemctl disable --now "$SERVICE" || true
  ok "The interview site is switched off. Your main website was not touched. Nothing was deleted (app in $APP_DIR, settings in $ENV_DEST)."
  exit 0
fi

# ---------------------------------------------------------------- 1. checks
say "1/8 Checking the server"
[ -n "$ZIP" ] && [ -f "$ZIP" ] || die "Give the package with --zip /path/eyelevel-interviews-vps.zip"
[ -n "$ENVSRC" ] && [ -f "$ENVSRC" ] || die "Give the settings file with --env /path/vps.env"
if [ "$SKIP_HTTPS" = 0 ] && [ -z "$EMAIL" ]; then die "Give an email for the certificate with --email you@example.com (or use --skip-https)"; fi

for k in PORT APP_URL GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET HR_REFRESH_TOKEN SHEET_ID ELEVENLABS_API_KEY ELEVENLABS_AGENT_ID ANTHROPIC_API_KEY CRON_SECRET; do
  grep -q "^$k=." "$ENVSRC" || die "The settings file has no value for $k"
done
grep -q "^APP_URL=https://$DOMAIN\$" "$ENVSRC" || warn "APP_URL in the settings file is not https://$DOMAIN. Emails would link to the wrong address."
ok "package and settings file found"

if [ "$DRY" = 0 ]; then
  . /etc/os-release; [ "${ID:-}" = "ubuntu" ] || die "This script is for Ubuntu (this server is ${ID:-unknown})"
  command -v apache2 >/dev/null || die "Apache is not installed. This script is for a server that already runs Apache."
  systemctl is-active --quiet apache2 || die "Apache is installed but not running. Start it first: systemctl start apache2"
  ok "Ubuntu ${VERSION_ID}, Apache is running"
  if ss -ltn 2>/dev/null | grep -q ':3000 ' && ! systemctl is-active --quiet "$SERVICE"; then die "Port 3000 is already used by another program"; fi
  ok "port 3000 is free for the app (it only listens inside the server)"
  MYIP="$(curl -fsS --max-time 8 https://api.ipify.org || true)"; DNSIP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}')"
  if [ -z "$DNSIP" ]; then warn "$DOMAIN does not exist in DNS yet. HTTPS will be skipped; add the DNS record and run this again."; SKIP_HTTPS=1
  elif [ -n "$MYIP" ] && [ "$DNSIP" != "$MYIP" ]; then warn "$DOMAIN points to $DNSIP but this server is $MYIP. HTTPS will be skipped."; SKIP_HTTPS=1
  else ok "$DOMAIN points to this server ($DNSIP)"; fi
fi

# ---------------------------------------------------------------- 2. packages
say "2/8 Installing what is missing"
run apt-get update -y
run apt-get install -y unzip curl ca-certificates
if [ "$DRY" = 1 ] || ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  if [ "$DRY" = 1 ]; then echo "   [dry-run] install Node 20 from NodeSource if node is missing or older than 18"; else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs; fi
fi
[ "$DRY" = 1 ] || ok "Node $(node -v)"
if [ "$SKIP_HTTPS" = 0 ]; then run apt-get install -y certbot python3-certbot-apache; fi

# ---------------------------------------------------------------- 3. app files
say "3/8 Installing the app"
id eyelevel >/dev/null 2>&1 || run adduser --system --group --home "$APP_DIR" --no-create-home eyelevel
if [ "$DRY" = 0 ] && [ -d "$APP_DIR" ]; then
  systemctl stop "$SERVICE" 2>/dev/null || true
  BK="$APP_DIR.bak.$(date +%Y%m%d%H%M%S)"; cp -a "$APP_DIR" "$BK" && ok "previous version kept at $BK"
fi
run mkdir -p "$APP_DIR"
run unzip -oq "$ZIP" -d "$APP_DIR"
if [ "$DRY" = 1 ]; then echo "   [dry-run] cd $APP_DIR && npm ci --omit=dev"; else (cd "$APP_DIR" && npm ci --omit=dev --no-audit --no-fund >/dev/null); fi
run chown -R eyelevel:eyelevel "$APP_DIR"
[ "$DRY" = 1 ] || ok "app files and dependencies in place"

# ---------------------------------------------------------------- 4. settings
say "4/8 Installing the settings file (root only)"
if [ "$DRY" = 0 ] && [ -f "$ENV_DEST" ]; then cp -a "$ENV_DEST" "$ENV_DEST.bak.$(date +%Y%m%d%H%M%S)"; fi
run install -m 600 -o root -g root "$ENVSRC" "$ENV_DEST"
[ "$DRY" = 1 ] || ok "$ENV_DEST (permissions 600). Delete the copy you uploaded: shred -u $ENVSRC"

# ---------------------------------------------------------------- 5. service
say "5/8 Starting the app as a service"
run cp "$APP_DIR/vps/eyelevel-interviews.service" /etc/systemd/system/$SERVICE.service
run systemctl daemon-reload
run systemctl enable --now "$SERVICE"
if [ "$DRY" = 0 ]; then
  for i in $(seq 1 30); do curl -fsS http://127.0.0.1:3000/healthz >/dev/null 2>&1 && break; sleep 1; done
  curl -fsS http://127.0.0.1:3000/healthz >/dev/null 2>&1 || { journalctl -u "$SERVICE" -n 25 --no-pager; die "The app did not start. The log above says why (usually a missing setting)."; }
  ok "the app is running and answers /healthz"
fi

# ---------------------------------------------------------------- 6. apache
say "6/8 Adding the Apache site for $DOMAIN (a new file; no other site is edited)"
run a2enmod proxy proxy_http headers
if [ "$DRY" = 1 ]; then echo "   [dry-run] write /etc/apache2/sites-available/$SITE.conf, apache2ctl configtest, a2ensite $SITE, reload"; else
  sed "s/interview\.theeyelevelstudio\.com/$DOMAIN/g" "$APP_DIR/vps/apache-site.conf" > /etc/apache2/sites-available/$SITE.conf
  if ! apache2ctl configtest 2>&1 | tail -3; then rm -f /etc/apache2/sites-available/$SITE.conf; die "Apache rejected the new site, so I removed it. Apache and your main website are unchanged."; fi
  a2ensite "$SITE" >/dev/null
  if ! apache2ctl configtest >/dev/null 2>&1; then a2dissite "$SITE" >/dev/null; die "Apache config test failed after enabling the site; I switched it back off. Main website unchanged."; fi
  systemctl reload apache2 && ok "Apache reloaded gracefully"
fi

# ---------------------------------------------------------------- 7. https
say "7/8 HTTPS certificate"
if [ "$SKIP_HTTPS" = 1 ]; then warn "skipped. When the DNS record exists, run: certbot --apache -d $DOMAIN --redirect -m YOU@EXAMPLE.COM --agree-tos --no-eff-email"; else
  run certbot --apache -d "$DOMAIN" --redirect -m "$EMAIL" --agree-tos --no-eff-email -n
  if [ "$DRY" = 0 ]; then apache2ctl configtest >/dev/null 2>&1 && systemctl reload apache2; ok "certificate installed, http redirects to https"; fi
fi

# ---------------------------------------------------------------- 8. tests
say "8/8 Testing"
if [ "$DRY" = 1 ]; then echo "   [dry-run] would test: app, Apache routing, https, cron protection, deep health check"; else
  CS="$(grep '^CRON_SECRET=' "$ENV_DEST" | cut -d= -f2-)"
  t() { if [ "$2" = "$3" ]; then ok "$1"; else warn "$1: got '$3', expected '$2'"; FAILED=1; fi; }
  FAILED=0
  t "app answers inside the server"            '{"ok":true}' "$(curl -fsS http://127.0.0.1:3000/healthz || true)"
  t "Apache routes $DOMAIN to the app"         '{"ok":true}' "$(curl -fsS -H "Host: $DOMAIN" http://127.0.0.1/healthz 2>/dev/null || true)"
  t "the scheduled job is password protected"  '401'         "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/cron)"
  [ "$SKIP_HTTPS" = 1 ] || t "https://$DOMAIN works from outside" '{"ok":true}' "$(curl -fsS --max-time 15 https://$DOMAIN/healthz 2>/dev/null || true)"
  echo "   deep check (Google login, Sheet, hr@ mailbox, ElevenLabs, Claude):"
  curl -s --max-time 40 -H "Authorization: Bearer $CS" http://127.0.0.1:3000/api/health | sed 's/^/     /'; echo
  echo
  if [ "$FAILED" = 0 ]; then printf '\033[1m   DONE. The interview site is live.\033[0m\n'; else printf '\033[1m   Installed, but a test above failed. See the troubleshooting table in the guide.\033[0m\n'; fi
  cat <<EOF

   Next:
   - Delete the uploaded settings file:   shred -u $ENVSRC
   - The app runs the 10-minute job by itself. Watch it:   journalctl -u $SERVICE -f
   - Tell Akmal it is live. He then switches off the daily job on Vercel (otherwise emails could be sent twice).
   - To switch the site off again:   sudo bash $0 --rollback
EOF
fi
