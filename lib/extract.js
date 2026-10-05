// Reads one application email (body + attached CV), asks Claude to extract the details and score the fit,
// then applies Akmal's recommendation rule in code (so the rule is exactly the same every time).
const fs = require('fs');
const path = require('path');
const g = require('./google');

const MODEL = () => process.env.EXTRACT_MODEL || 'claude-haiku-4-5';   // Haiku for all reading work (Akmal, 5 Oct 2026)
const ROLES = fs.readFileSync(path.join(__dirname, 'roles.txt'), 'utf8');

// ---------------- reading the email ----------------
const decode = (data) => Buffer.from(String(data || ''), 'base64url').toString('utf8');
function htmlToText(s) {
  return s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<\/t[dh]>/gi, ' : ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
function* walk(part) { yield part; for (const p of part.parts || []) yield* walk(p); }
const header = (msg, name) => ((msg.payload.headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase()) || {}).value || '';

async function attachmentText(msgId, part) {
  const fn = (part.filename || '').toLowerCase();
  if (!/\.(pdf|docx|txt)$/.test(fn)) return '';
  const attId = part.body && part.body.attachmentId;
  let buf;
  if (attId) buf = Buffer.from((await g.getAttachment(msgId, attId)).data, 'base64url');
  else if (part.body && part.body.data) buf = Buffer.from(part.body.data, 'base64url');
  else return '';
  try {
    if (fn.endsWith('.pdf')) return String((await require('pdf-parse/lib/pdf-parse.js')(buf, { max: 6 })).text || '');
    if (fn.endsWith('.docx')) return String((await require('mammoth').extractRawText({ buffer: buf })).value || '');
    return buf.toString('utf8');
  } catch (e) { return `[could not read ${fn}: ${String(e.message).slice(0, 80)}]`; }
}

async function readEmail(id) {
  const msg = await g.getMessage(id);
  const plain = [], htm = [], cvNames = [], cvText = [];
  for (const p of walk(msg.payload)) {
    const mt = p.mimeType || '', data = p.body && p.body.data;
    if (p.filename) { cvNames.push(p.filename); cvText.push(await attachmentText(id, p)); }
    else if (data && mt === 'text/plain') plain.push(decode(data));
    else if (data && mt === 'text/html') htm.push(decode(data));
  }
  const body = plain.join('\n').trim() || htmlToText(htm.join('\n'));
  return {
    id, threadId: msg.threadId, date: g.istStamp(new Date(Number(msg.internalDate))),
    from: header(msg, 'From'), subject: header(msg, 'Subject'),
    body: body.slice(0, 12000), cvNames, cvText: cvText.filter(Boolean).join('\n\n').slice(0, 15000),
  };
}

// ---------------- asking Claude ----------------
const FIELDS = {
  name: '', phone: 'E.164 if possible, else as written', email: '',
  role_applied: 'the role exactly as the candidate applied for, max 6 words, no commentary',
  city: 'the city they live in, as stated', total_experience_years: 'number or ""',
  current_company: '', current_designation: '', highest_education: 'degree + specialisation', institution: '',
  graduation_year: '', key_skills: 'comma separated, max 10', current_ctc: '', expected_ctc: '', notice_period: '',
  portfolio_links: 'portfolio, LinkedIn, Behance, GitHub, comma separated',
  fit_score: 'integer 1-10 for how well they fit the role (see scoring)',
  must_haves_met: 'true or false: does the application show the must-have for this role (see must-haves)',
  must_have_note: 'if false, what is missing, short. Else ""',
  why: 'ONE short sentence on why the score is what it is',
  strengths: 'max 3, short, semicolon separated', gaps: 'max 3, short, semicolon separated',
  is_application: 'true/false. false for spam, vendor pitches, newsletters, non-job form submissions',
};

const SYSTEM = `You extract candidate data from job applications sent to EyeLevel Growth Studio, a Chennai marketing agency. Use only what is in the email and CV. Never invent. Leave a field as an empty string when it is not stated. Then score fit against the matching role below. Return ONE JSON object and nothing else.

SCORING (integer 1-10, be consistent):
9-10: exceptional, proven work that directly matches the role. 7-8: good fit, relevant skills and visible proof of work. 5-6: partial fit, some relevant skills but thin proof. 1-4: weak or unrelated.
Internship roles: judge on skills, projects and portfolio, not years of experience.
Do NOT lower the score because of the candidate's city or because they live outside Chennai. Do not lower it because of expected pay either.

MUST-HAVES (set must_haves_met=false when missing, and say what is missing in must_have_note):
- Developer roles (front end, back end, any developer): a GitHub profile, live project links, or clearly described real projects.
- Graphic design and visualizer roles: a portfolio link (Behance, Dribbble, Drive, a website or similar).
- Video roles (video editor, video intern): a showreel or portfolio link.
- Social media roles: samples of social content they managed, or links to the pages or handles.
- Content and copywriting roles: writing samples or links.
- All other roles: must_haves_met = true.

Open roles:
${ROLES}`;

async function extractCandidate(m) {
  const user = `Fields to return (key: guidance):\n${JSON.stringify(FIELDS, null, 1)}\n\nEMAIL FROM: ${m.from}\nSUBJECT: ${m.subject}\nDATE: ${m.date}\n\nEMAIL BODY:\n${m.body}\n\nATTACHMENTS: ${m.cvNames.join(', ') || 'none'}\nCV TEXT:\n${m.cvText || '[no readable CV]'}`;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL(), max_tokens: 4000, system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: user }] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`Anthropic ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
      const raw = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    } catch (e) { lastErr = e; await new Promise((res) => setTimeout(res, 1500 * (attempt + 1))); }
  }
  throw lastErr;
}

// ---------------- the recommendation rule (decided by Akmal, 5 Oct 2026) ----------------
// Proceed: score 7 or more AND the must-haves are met. Hold: 5-6, or 7+ with a must-have missing. Reject: 4 or below.
// City is never used.
function decide(x) {
  const s = Number(x.fit_score);
  if (!Number.isFinite(s)) return { recommendation: '', why: '' };
  const ok = !(x.must_haves_met === false || String(x.must_haves_met).toLowerCase() === 'false');
  const line = String(x.why || '').trim();
  if (s >= 7 && ok) return { recommendation: 'PROCEED', why: `Score ${s}/10, meets the cutoff of 7. ${line}`.trim() };
  if (s >= 7) return { recommendation: 'HOLD', why: `Score ${s}/10, but a must-have is missing: ${x.must_have_note || 'work samples'}.` };
  if (s >= 5) return { recommendation: 'HOLD', why: `Score ${s}/10, below the cutoff of 7. ${line}`.trim() };
  return { recommendation: 'REJECT', why: `Score ${s}/10, well below the cutoff of 7. ${line}`.trim() };
}

module.exports = { readEmail, extractCandidate, decide };
