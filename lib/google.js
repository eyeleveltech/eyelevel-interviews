// Google API helpers for the booking site. Everything runs as hr@eyelevelstudio.in
// via an OAuth refresh token stored in Vercel env vars (never in the repo).
const {
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, HR_REFRESH_TOKEN, SHEET_ID,
} = process.env;

const TZ_OFFSET_MIN = 330; // IST, no DST
const BASE = (process.env.APP_URL || 'https://eyelevel-interviews.vercel.app').replace(/\/$/, '');
const CAL_NAME = 'EyeLevel Interviews';
const ADDRESS = 'Eyelevel Growth Studio, 43, 2nd Cross Street, 2nd Main Road, Navarathna Garden, Defence Colony, Ekkatuthangal, Chennai, Tamil Nadu 600032';
const MAP = 'https://share.google/7tEkFGERhbnKeHfYC';

let cached = { token: null, exp: 0, calId: null };

async function token() {
  if (cached.token && Date.now() < cached.exp) return cached.token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: HR_REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google auth failed');
  cached.token = j.access_token;
  cached.exp = Date.now() + (j.expires_in - 60) * 1000;
  return cached.token;
}

// Recent Sheet reads are remembered for a few seconds. Many candidates opening their link at once would otherwise
// blow Google's 60-reads-a-minute limit. Callers asking at the same moment share one request. Any Sheet write clears it.
const _cache = new Map();
function memo(key, ttlMs, fn) {
  const e = _cache.get(key);
  if (e && e.exp > Date.now()) return e.p;
  const p = fn();
  _cache.set(key, { exp: Date.now() + ttlMs, p });
  p.catch(() => _cache.delete(key));
  return p;
}

async function api(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 300)}`);
  if (opts.method && opts.method !== 'GET' && String(url).includes('sheets.googleapis.com')) _cache.clear();
  return text ? JSON.parse(text) : {};
}

const SHEETS = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

function colLetter(i) {
  let s = ''; i += 1;
  while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

function readApps() {
  return memo('apps', 8000, async () => {
    const j = await api(`${SHEETS}/values/${encodeURIComponent('Applications!A1:BZ')}`);
    const rows = j.values || [];
    const head = rows[0] || [];
    const col = (n) => head.indexOf(n);
    return { rows, col };
  });
}

async function setCell(row1, colIdx, value) {
  const a1 = `Applications!${colLetter(colIdx)}${row1}`;
  await api(`${SHEETS}/values/${encodeURIComponent(a1)}?valueInputOption=RAW`, {
    method: 'PUT', body: JSON.stringify({ values: [[value]] }),
  });
}

function settings() { return memo('settings', 60000, settingsRaw); }
async function settingsRaw() {
  const j = await api(`${SHEETS}/values/${encodeURIComponent("'Slot Settings'!B2:B7")}`);
  const v = (j.values || []).map((r) => r[0]);
  return {
    cap: (v[0] === undefined || String(v[0]).trim() === '') ? 10 : Math.max(0, Number(v[0]) || 0),   // 0 = no limit on candidates per slot
    days: Number(v[1]) || 14,
    openDays: String(v[2] || '1,2,3,4,5,6').split(',').map(Number),
    first: Number(v[3]) || 10,
    last: Number(v[4]) || 16,
    blocked: String(v[5] || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

// --- IST time helpers (slot keys look like "2026-10-06 10:00", IST) ---
const pad = (n) => String(n).padStart(2, '0');
function istParts(d) {
  const t = new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() };
}
function keyToDate(key) {
  const [ymd, hm] = key.split(' ');
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh, mm] = hm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - TZ_OFFSET_MIN * 60000);
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const h12 = (h) => `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
function prettyKey(key) {
  const [ymd, hm] = key.split(' ');
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const h = Number(hm.split(':')[0]);
  return { day: `${DAYS[dow]}, ${d} ${MONTHS[m - 1]}`, time: `${h12(h)} to ${h12(h + 1)}` };
}

function openSlots(s, counts) {
  const now = Date.now();
  const out = [];
  for (let i = 0; i <= s.days; i++) {
    const p = istParts(new Date(now + i * 86400000));
    const dow = p.dow === 0 ? 7 : p.dow;
    const ymd = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
    if (!s.openDays.includes(dow) || s.blocked.includes(ymd)) continue;
    for (let h = s.first; h <= s.last; h++) {
      const key = `${ymd} ${pad(h)}:00`;
      if (keyToDate(key).getTime() < now + 2 * 3600000) continue; // 2h notice
      out.push({ key, left: s.cap > 0 ? s.cap - (counts[key] || 0) : 1e6, ...prettyKey(key) });
    }
  }
  return out;
}

// --- Calendar: one shared event per slot on hr@'s "EyeLevel Interviews" calendar ---
const CAL = 'https://www.googleapis.com/calendar/v3';
async function calendarId() {
  if (cached.calId) return cached.calId;
  const list = await api(`${CAL}/users/me/calendarList?maxResults=250`);
  let c = (list.items || []).find((x) => x.summary === CAL_NAME);
  if (!c) c = await api(`${CAL}/calendars`, { method: 'POST', body: JSON.stringify({ summary: CAL_NAME, timeZone: 'Asia/Kolkata' }) });
  cached.calId = c.id;
  return c.id;
}

async function slotEvent(key, create) {
  const cal = encodeURIComponent(await calendarId());
  const q = new URLSearchParams({ privateExtendedProperty: `slot=${key}`, singleEvents: 'true' });
  const found = await api(`${CAL}/calendars/${cal}/events?${q}`);
  if (found.items && found.items.length) return found.items[0];
  if (!create) return null;
  const start = keyToDate(key);
  return api(`${CAL}/calendars/${cal}/events`, {
    method: 'POST',
    body: JSON.stringify({
      summary: 'EyeLevel Growth Studio: Interview',
      location: ADDRESS,
      description: `In-person interview at EyeLevel Growth Studio.\nMap: ${MAP}\nPlease bring your laptop (you will do a short practical task on it after the interview), your CV and portfolio / work samples.`,
      start: { dateTime: start.toISOString(), timeZone: 'Asia/Kolkata' },
      end: { dateTime: new Date(start.getTime() + 3600000).toISOString(), timeZone: 'Asia/Kolkata' },
      guestsCanSeeOtherGuests: false,
      extendedProperties: { private: { slot: key } },
    }),
  });
}

async function moveGuest(email, fromKey, toKey, prevEmail) {
  const cal = encodeURIComponent(await calendarId());
  const gone = (prevEmail || email || '').toLowerCase();
  if (fromKey && gone) {
    const old = await slotEvent(fromKey, false);
    if (old) {
      const attendees = (old.attendees || []).filter((a) => a.email.toLowerCase() !== gone);
      await api(`${CAL}/calendars/${cal}/events/${old.id}?sendUpdates=all`, { method: 'PATCH', body: JSON.stringify({ attendees }) });
    }
  }
  const ev = await slotEvent(toKey, true);
  if (email) {
    const attendees = (ev.attendees || []).filter((a) => a.email.toLowerCase() !== email.toLowerCase());
    attendees.push({ email });
    await api(`${CAL}/calendars/${cal}/events/${ev.id}?sendUpdates=all`, { method: 'PATCH', body: JSON.stringify({ attendees }) });
  }
}

// --- Gmail (HTML) ---
function b64url(s) { return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function sendMail(to, subject, html, text, cc) {
  const boundary = 'b' + Date.now();
  const mime = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    'From: EyeLevel Growth Studio HR <hr@eyelevelstudio.in>',
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', '', text, '',
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', '', html, '',
    `--${boundary}--`,
  ].join('\r\n');
  await api('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', body: JSON.stringify({ raw: b64url(mime) }) });
}

// "2026-10-05 15:30" in IST <-> Date. Used for the timestamps written to the Sheet.
function istStamp(d = new Date()) {
  const t = new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}
function parseStamp(s) {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(s || '').trim()) ? keyToDate(String(s).trim()) : null;
}
function istHour(d = new Date()) { return new Date(d.getTime() + TZ_OFFSET_MIN * 60000).getUTCHours(); }

// write several cells of one Sheet row at once: updates = { 'Column Name': value }
async function updateRow(row1, head, updates) {
  const data = Object.entries(updates).filter(([k]) => head.indexOf(k) >= 0).map(([k, v]) => ({
    range: `Applications!${colLetter(head.indexOf(k))}${row1}`, values: [[v]],
  }));
  if (data.length) await api(`${SHEETS}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }) });
}

// write one column on MANY rows in a single request (a request per row blows Google's 60-writes-a-minute limit)
async function updateCells(head, entries) {
  const idx = head.indexOf(entries.length ? entries[0].col : '');
  if (idx < 0) return;
  for (let i = 0; i < entries.length; i += 400) {
    const data = entries.slice(i, i + 400).map((e) => ({ range: `Applications!${colLetter(idx)}${e.row1}`, values: [[e.value]] }));
    await api(`${SHEETS}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }) });
  }
}

// find a candidate row by booking code
async function findByCode(code) {
  const { rows, col } = await readApps();
  const ci = col('Booking Code');
  const c = String(code || '').trim();
  const idx = c && ci >= 0 ? rows.findIndex((r, i) => i > 0 && (r[ci] || '').trim() === c) : -1;
  return idx < 0 ? null : { rows, col, head: rows[0], idx, row1: idx + 1, r: rows[idx] };
}

// The Recruiters tab: A name | B email | C phone | D handles | (E,F routing rules) | G "my candidates" link | H schedule email sent for (date)
function recruiters() { return memo('recruiters', 30000, recruitersRaw); }
async function recruitersRaw() {
  const j = await api(`${SHEETS}/values/${encodeURIComponent('Recruiters!A2:H30')}`);
  return (j.values || []).map((r, i) => ({ name: (r[0] || '').trim(), email: (r[1] || '').trim(), phone: (r[2] || '').trim(), view: (r[6] || '').trim(), sentFor: (r[7] || '').trim(), row: i + 2 }))
    .filter((r) => r.name && r.email);
}
async function setRecruiterCell(row, colLetterStr, value) {
  await api(`${SHEETS}/values/${encodeURIComponent(`Recruiters!${colLetterStr}${row}`)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [[value]] }) });
}

// ---- Gmail reading (the hr@ mailbox) ----
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
async function listMessageIds(q, maxPages = 6) {
  const ids = []; let token = '';
  for (let i = 0; i < maxPages; i++) {
    const j = await api(`${GMAIL}/messages?maxResults=200&q=${encodeURIComponent(q)}${token ? `&pageToken=${token}` : ''}`);
    (j.messages || []).forEach((m) => ids.push(m.id));
    token = j.nextPageToken; if (!token) break;
  }
  return ids;
}
const getMessage = (id) => api(`${GMAIL}/messages/${id}?format=full`);
const getAttachment = (msgId, attId) => api(`${GMAIL}/messages/${msgId}/attachments/${attId}`);

// ---- Sheet helpers for the reader ----
async function appendRows(rows) {
  if (!rows.length) return;
  await api(`${SHEETS}/values/${encodeURIComponent('Applications!A1')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: rows }) });
}
async function getValues(range) { return (await api(`${SHEETS}/values/${encodeURIComponent(range)}`)).values || []; }
async function putValues(range, values) {
  await api(`${SHEETS}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values }) });
}
async function skippedIds() { return new Set((await getValues("'Skipped Emails'!A2:A5000")).map((r) => r[0])); }
async function addSkipped(list) {
  if (!list.length) return;
  await api(`${SHEETS}/values/${encodeURIComponent("'Skipped Emails'!A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: list }) });
}

// add / remove a person on the shared event of one interview slot
async function patchGuests(key, change) {
  const ev = await slotEvent(key, change.add);
  if (!ev) return;
  const cal = encodeURIComponent(await calendarId());
  let attendees = (ev.attendees || []).slice();
  if (change.add && !attendees.some((a) => a.email.toLowerCase() === change.add.toLowerCase())) attendees.push({ email: change.add });
  if (change.remove) attendees = attendees.filter((a) => a.email.toLowerCase() !== change.remove.toLowerCase());
  await api(`${CAL}/calendars/${cal}/events/${ev.id}?sendUpdates=all`, { method: 'PATCH', body: JSON.stringify({ attendees }) });
}

module.exports = { updateCells, recruiters, setRecruiterCell, listMessageIds, getMessage, getAttachment, appendRows, getValues, putValues, skippedIds, addSkipped, colLetter, patchGuests, BASE, istStamp, parseStamp, istHour, updateRow, findByCode, readApps, setCell, settings, openSlots, prettyKey, moveGuest, sendMail, ADDRESS, MAP };
