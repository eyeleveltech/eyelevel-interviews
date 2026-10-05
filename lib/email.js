// Branded HTML emails (table layout + inline styles so Gmail/Outlook/phones render them).
// One visual system with public/index.html: forest #163027, logo lime #d0e898, logo yellow #ffe600, paper #eef1ea.
const { ADDRESS, MAP, BASE } = require('./google');

const LOGO = `${BASE}/eyelevel-logo.png`;
const SITE = 'https://theeyelevelstudio.com';
const PRIVACY = 'https://theeyelevelstudio.com/privacy-policy';
const TERMS = 'https://theeyelevelstudio.com/terms-and-condition';
const SANS = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;";
const LABEL = `${SANS}font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5f6b64;font-weight:bold;`;

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function shell({ preheader, eyebrow, headline, inner, reason, internal }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef1ea;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1ea;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;${SANS}color:#14201b;">
<tr><td style="background:#163027;border-radius:14px 14px 0 0;padding:28px 40px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><img src="${LOGO}" width="84" alt="EyeLevel Growth Studio" style="display:block;border:0;width:84px;height:auto;color:#d0e898;font-size:16px;font-weight:bold;"></td>
    <td align="right" style="${SANS}font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9fb5a7;font-weight:bold;">Talent Acquisition</td>
  </tr></table>
</td></tr>
<tr><td style="background:#163027;padding:34px 40px 36px;">
  <div style="${SANS}font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#d0e898;font-weight:bold;">${eyebrow}</div>
  <div style="${SANS}font-size:30px;line-height:35px;font-weight:bold;color:#ffffff;letter-spacing:-0.5px;margin-top:12px;">${headline}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr><td width="44" height="4" style="background:#ffe600;font-size:0;line-height:0;">&nbsp;</td></tr></table>
</td></tr>
<tr><td style="background:#ffffff;padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table>
</td></tr>
${internal ? `<tr><td style="background:#ffffff;border-top:1px solid #e3e8df;border-radius:0 0 14px 14px;padding:24px 40px 28px;${SANS}font-size:12px;line-height:19px;color:#6f7a73;"><b style="color:#14201b;">This is an internal, automatically generated email</b> from the EyeLevel recruitment system. Candidate details are confidential: please do not forward this email.</td></tr>` : `<tr><td style="background:#ffffff;border-top:1px solid #e3e8df;border-radius:0 0 14px 14px;padding:24px 40px 28px;${SANS}font-size:12px;line-height:19px;color:#6f7a73;">
  <b style="color:#14201b;">This is an automatically generated email</b> from the EyeLevel Growth Studio recruitment system. ${reason} For any questions, reply to this email or write to <a href="mailto:hr@eyelevelstudio.in" style="color:#163027;">hr@eyelevelstudio.in</a>.<br><br>
  Your application information is handled in accordance with our <a href="${PRIVACY}" style="color:#163027;">Privacy Policy</a>.
</td></tr>`}
<tr><td align="center" style="padding:22px 20px 0;${SANS}font-size:12px;line-height:20px;color:#6f7a73;">
  <a href="${SITE}" style="color:#163027;font-weight:bold;text-decoration:none;">theeyelevelstudio.com</a> &nbsp;|&nbsp; <a href="${PRIVACY}" style="color:#6f7a73;">Privacy Policy</a> &nbsp;|&nbsp; <a href="${TERMS}" style="color:#6f7a73;">Terms &amp; Conditions</a><br>
  &copy; 2026 EyeLevel Growth Studio, Ekkatuthangal, Chennai 600032
</td></tr>
</table></td></tr></table></body></html>`;
}

// ---------- shared blocks ----------
const para = (html, top = 34) => `<tr><td style="padding:${top}px 40px 8px;${SANS}font-size:15px;line-height:24px;">${html}</td></tr>`;

const button = (href, text) => `<tr><td style="padding:22px 40px 10px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#163027;border-radius:10px;">
    <a href="${href}" style="display:inline-block;padding:15px 30px;${SANS}font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${text}</a>
  </td></tr></table>
</td></tr>
<tr><td style="padding:0 40px 28px;${SANS}font-size:12px;line-height:19px;color:#6f7a73;">
  If the button does not work, copy this link into your browser:<br><a href="${href}" style="color:#163027;word-break:break-all;">${href}</a>
</td></tr>`;

const step = (n, title, body) => `<tr><td width="46" valign="top" style="padding:0 0 16px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="30" height="30" align="center" style="background:#163027;border-radius:15px;${SANS}font-size:13px;font-weight:bold;color:#d0e898;">${n}</td></tr></table></td>
  <td valign="top" style="padding:4px 0 16px;${SANS}font-size:14px;line-height:21px;color:#14201b;"><b>${title}</b><br><span style="color:#5f6b64;">${body}</span></td></tr>`;

const steps = (title, items) => `<tr><td style="padding:6px 40px 14px;">
  <div style="${LABEL}margin-bottom:16px;">${title}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items.map((x, i) => step(i + 1, x[0], x[1])).join('')}</table>
</td></tr>`;

const detail = (k, v) => `<tr><td width="120" valign="top" style="padding:12px 0;border-bottom:1px solid #e3e8df;${LABEL}line-height:21px;">${k}</td>
  <td valign="top" style="padding:12px 0;border-bottom:1px solid #e3e8df;${SANS}font-size:14px;line-height:21px;color:#14201b;">${v}</td></tr>`;

const details = (rows) => `<tr><td style="padding:0 40px 30px;">
  <div style="${LABEL}margin-bottom:4px;">Details</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e8df;">${rows.map((r) => detail(r[0], r[1])).join('')}</table>
</td></tr>`;

const bringRow = (title, body, strong) => `<tr>
  <td width="26" valign="top" style="padding:${strong ? '14px 0 14px 16px' : '9px 0 9px 16px'};${SANS}font-size:14px;color:#163027;font-weight:bold;">&#9656;</td>
  <td valign="top" style="padding:${strong ? '14px 16px 14px 0' : '9px 16px 9px 0'};${SANS}font-size:14px;line-height:21px;color:#14201b;"><b>${title}</b>${body ? `<br><span style="color:#5f6b64;">${body}</span>` : ''}</td>
</tr>`;

function bringBlock(laptop) {
  return `<tr><td style="padding:0 40px 30px;">
  <div style="${LABEL}margin-bottom:10px;">What to bring</div>
  ${laptop ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbd6;border-left:4px solid #ffe600;margin-bottom:6px;">${bringRow('Your laptop (required)', 'After the interview you will complete a short practical task on your own laptop. Please make sure it is fully charged and has the software you normally work with.', true)}</table>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bringRow('An updated copy of your CV', '')}${bringRow('Your portfolio or work samples', 'Where applicable to the role.')}</table>
</td></tr>`;
}

const contactBlock = (c) => (c && c.name && c.phone) ? `<tr><td style="padding:0 40px 26px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7ee;border-left:4px solid #163027;border-radius:0 10px 10px 0;"><tr><td style="padding:16px 22px;">
    <div style="${LABEL}">Your contact at EyeLevel</div>
    <div style="${SANS}font-size:17px;line-height:24px;font-weight:bold;color:#163027;margin-top:4px;">${esc(c.name)}</div>
    <div style="${SANS}font-size:14px;line-height:22px;color:#14201b;"><a href="tel:${esc(String(c.phone).replace(/[^+\d]/g, ''))}" style="color:#14201b;text-decoration:none;">${esc(c.phone)}</a></div>
  </td></tr></table>
</td></tr>` : '';
const contactText = (c) => (c && c.name && c.phone) ? `Your contact at EyeLevel: ${c.name}, ${c.phone}\n` : '';

const signoff = `<tr><td style="padding:0 40px 34px;${SANS}font-size:14px;line-height:23px;color:#14201b;">
  Warm regards,<br><b>Talent Acquisition Team</b><br>EyeLevel Growth Studio
</td></tr>`;

const venueRows = (role) => [
  ['Position', `<b>${esc(role)}</b>`],
  ['Format', 'In-person interview, about 1 hour'],
  ['Availability', 'Monday to Saturday, 10:00 AM to 5:00 PM IST'],
  ['Venue', `${esc(ADDRESS)}<br><a href="${MAP}" style="color:#163027;font-weight:bold;">View on Google Maps</a>`],
];

const plain = (s) => s.replace(/\n[ \t]+/g, '\n');

// ---------- 1. Shortlisted: talk to the AI recruiter (first email) ----------
function linkEmail({ first, role, link, until }) {
  const inner = [
    para(`Dear ${esc(first)},<br><br>Congratulations. After reviewing your application for the <b>${esc(role)}</b> position at EyeLevel Growth Studio, we have <b>shortlisted you for the first round</b>.<br><br>Our AI recruiter, <b>Tara</b>, would like to interview you. It is a short voice conversation of about 5 minutes, and you can take it on your phone or laptop whenever it suits you.`),
    button(link, 'Start your first-round interview'),
    steps('How it works', [
      ['Open the link and allow your microphone', 'Use earphones in a quiet place for the best experience.'],
      ['Talk to Tara for about 5 minutes', 'This is an AI-generated conversation. It is transcribed and recorded for assessment purposes.'],
      ['Choose your interview slot straight after', 'If it is a good fit, you can schedule your in-person interview on the same page.'],
    ]),
    `<tr><td style="padding:0 40px 28px;${SANS}font-size:14px;line-height:22px;color:#14201b;">Your link is personal to you and stays active until <b>${esc(until)}</b>.</td></tr>`,
    signoff,
  ].join('');
  const html = shell({
    preheader: `You are shortlisted for the first round of the ${role} position.`,
    eyebrow: 'You have been shortlisted', headline: 'You are shortlisted for the first round.', inner,
    reason: 'You are receiving it because you applied for a position with us.',
  });
  const text = plain(`Dear ${first},

Congratulations. After reviewing your application for the ${role} position at EyeLevel Growth Studio, we have shortlisted you for the first round.

Our AI recruiter, Tara, would like to interview you. It is a short voice conversation of about 5 minutes, and you can take it on your phone or laptop whenever it suits you.

Start your first-round interview: ${link}

Please note: this is an AI-generated conversation. It is transcribed and recorded for assessment purposes. Allow your microphone when asked, and use earphones in a quiet place. If it is a good fit, you can schedule your in-person interview on the same page.

Your link is personal to you and stays active until ${until}.

Warm regards,
Talent Acquisition Team
EyeLevel Growth Studio

--
This is an automatically generated email from the EyeLevel Growth Studio recruitment system. For questions, reply to this email or write to hr@eyelevelstudio.in.
Privacy Policy: ${PRIVACY}`);
  return { subject: `You are shortlisted: first-round interview with our AI recruiter | ${role}`, html, text };
}

// ---------- 2. Reminders (n = 1 or 2) ----------
function reminderEmail({ first, role, link, until, n }) {
  const last = n === 2;
  const inner = [
    para(`Dear ${esc(first)},<br><br>${last
      ? `This is a final reminder about your application for the <b>${esc(role)}</b> position. Your conversation link expires on <b>${esc(until)}</b>, and after that we will not be able to take your application forward.`
      : `You have not had the chance to speak with our AI recruiter yet. Your application for the <b>${esc(role)}</b> position is still open, and the conversation takes only about 5 minutes.`}<br><br>You can start whenever it suits you, on your phone or laptop. Your link is active until <b>${esc(until)}</b>.`),
    button(link, 'Start your first-round interview'),
    signoff,
  ].join('');
  const html = shell({
    preheader: last ? `Final reminder: your link expires on ${until}.` : 'Your application is still open. It takes about 5 minutes.',
    eyebrow: last ? 'Final reminder' : 'Reminder', headline: last ? 'Your link expires soon.' : 'Your application is still open.', inner,
    reason: 'You are receiving it because you applied for a position with us and have not yet completed the conversation.',
  });
  const text = plain(`Dear ${first},

${last ? `This is a final reminder about your application for the ${role} position. Your conversation link expires on ${until}.` : `You have not had the chance to speak with our AI recruiter yet. Your application for the ${role} position is still open, and the conversation takes only about 5 minutes.`}

Start your first-round interview: ${link}
Your link is active until ${until}.

Warm regards,
Talent Acquisition Team
EyeLevel Growth Studio

--
This is an automatically generated email from the EyeLevel Growth Studio recruitment system. For questions, reply to this email or write to hr@eyelevelstudio.in.
Privacy Policy: ${PRIVACY}`);
  return { subject: last ? `Final reminder: your AI recruiter link expires on ${until} | ${role}` : `Reminder: your conversation with our AI recruiter | ${role}`, html, text };
}

// ---------- 3. Interview invitation (sent only if they said yes but have not booked) ----------
function invitationEmail({ first, role, link, laptop = true }) {
  const inner = [
    para(`Dear ${esc(first)},<br><br>Thank you for speaking with our AI recruiter. As confirmed during the conversation, we are pleased to invite you to an in-person interview for the <b>${esc(role)}</b> position at EyeLevel Growth Studio.<br><br>You have not scheduled your slot yet. Please choose a time that suits you using the button below.`),
    button(link, 'Schedule your interview'),
    steps('What happens next', [
      ['Schedule your slot', 'Choose a date and time on the scheduling page.'],
      ['Receive your confirmation', 'A confirmation email and a calendar invitation are sent as soon as you submit.'],
      ['Attend in person', 'Meet our team at the EyeLevel Growth Studio office in Ekkatuthangal, Chennai.'],
    ]),
    details(venueRows(role)),
    bringBlock(laptop),
    `<tr><td style="padding:0 40px 14px;${SANS}font-size:14px;line-height:23px;">We look forward to meeting you.</td></tr>`,
    signoff,
  ].join('');
  const html = shell({
    preheader: `Interview invitation for the ${role} position. Please schedule your slot.`,
    eyebrow: 'Interview invitation', headline: 'You are invited to interview with us.', inner,
    reason: 'You are receiving it because you applied for a position with us and confirmed your interest in a conversation with our AI recruiter.',
  });
  const text = plain(`Dear ${first},

Thank you for speaking with our AI recruiter. As confirmed during the conversation, we are pleased to invite you to an in-person interview for the ${role} position at EyeLevel Growth Studio. You have not scheduled your slot yet.

Schedule your interview: ${link}

Position: ${role}
Format: In-person interview, about 1 hour
Availability: Monday to Saturday, 10:00 AM to 5:00 PM IST
Venue: ${ADDRESS}
Map: ${MAP}

${laptop ? 'PLEASE BRING YOUR LAPTOP: after the interview you will complete a short practical task on your own laptop. Make sure it is fully charged.\n\n' : ''}Also bring an updated copy of your CV and your portfolio or work samples, where applicable.

We look forward to meeting you.

Warm regards,
Talent Acquisition Team
EyeLevel Growth Studio

--
This is an automatically generated email from the EyeLevel Growth Studio recruitment system. For questions, reply to this email or write to hr@eyelevelstudio.in.
Privacy Policy: ${PRIVACY}`);
  return { subject: `Interview Invitation: ${role}${laptop ? ' | Please Bring Your Laptop' : ' | EyeLevel Growth Studio'}`, html, text };
}

// ---------- 4. Booking confirmation ----------
function confirmEmail({ first, role, day, time, laptop = true, contact }) {
  const [dow, rest] = String(day).split(', ');
  const [dnum, mon] = String(rest || '').split(' ');
  const inner = [
    para(`Dear ${esc(first)},<br><br>Thank you for scheduling your interview for the <b>${esc(role)}</b> position. Your slot is confirmed, and a calendar invitation has been sent to this email address.`),
    `<tr><td style="padding:22px 40px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d9dfd5;border-radius:12px;"><tr>
    <td width="112" align="center" valign="middle" style="background:#163027;border-radius:11px 0 0 11px;padding:20px 8px;">
      <div style="${SANS}font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#d0e898;font-weight:bold;">${esc(mon)}</div>
      <div style="${SANS}font-size:44px;line-height:48px;font-weight:bold;color:#ffffff;">${esc(dnum)}</div>
      <div style="${SANS}font-size:12px;color:#9fb5a7;">${esc(dow)}</div>
    </td>
    <td valign="middle" style="padding:18px 22px;">
      <div style="${LABEL}">Your interview</div>
      <div style="${SANS}font-size:21px;line-height:27px;font-weight:bold;color:#14201b;margin-top:5px;">${esc(time)}</div>
      <div style="${SANS}font-size:13px;line-height:20px;color:#5f6b64;margin-top:3px;">India Standard Time &nbsp;|&nbsp; In person &nbsp;|&nbsp; About 1 hour</div>
    </td>
  </tr></table>
</td></tr>`,
    `<tr><td style="padding:0 40px 30px;">
  <div style="${LABEL}margin-bottom:8px;">Venue</div>
  <div style="${SANS}font-size:14px;line-height:22px;color:#14201b;">${esc(ADDRESS)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr><td style="border:1px solid #163027;border-radius:8px;">
    <a href="${MAP}" style="display:inline-block;padding:9px 16px;${SANS}font-size:13px;font-weight:bold;color:#163027;text-decoration:none;">View on Google Maps</a>
  </td></tr></table>
</td></tr>`,
    contactBlock(contact),
    bringBlock(laptop),
    `<tr><td style="padding:0 40px 30px;${SANS}font-size:14px;line-height:23px;color:#14201b;">Please arrive 10 minutes before your scheduled time. To change your slot, open the scheduling link from our earlier email and select another time.<br><br>We look forward to meeting you.</td></tr>`,
    signoff,
  ].join('');
  const html = shell({
    preheader: `Confirmed for ${day}, ${time} IST. ${laptop ? 'Please bring your laptop.' : ''}`,
    eyebrow: 'Interview confirmed', headline: 'Your interview is confirmed.', inner,
    reason: 'You are receiving it because you scheduled an interview slot with us.',
  });
  const text = plain(`Dear ${first},\n\nThank you for scheduling your interview for the ${role} position at EyeLevel Growth Studio. Your slot is confirmed.\n\nDate: ${day}\nTime: ${time} IST\nFormat: In person, about 1 hour\nVenue: ${ADDRESS}\nMap: ${MAP}\n${contactText(contact)}\n${laptop ? 'PLEASE BRING YOUR LAPTOP: after the interview you will complete a short practical task on your own laptop.\n\n' : ''}Also bring an updated copy of your CV and your portfolio or work samples, where applicable. Please arrive 10 minutes early.\n\nWarm regards,\nTalent Acquisition Team\nEyeLevel Growth Studio\n\n--\nThis is an automatically generated email from the EyeLevel Growth Studio recruitment system. For questions, reply to this email or write to hr@eyelevelstudio.in.\nPrivacy Policy: ${PRIVACY}`);
  return { subject: `Interview Confirmed: ${day}, ${time} IST${laptop ? ' | Please Bring Your Laptop' : ''}`, html, text };
}

// ---------- 5. Morning of the interview ----------
function dayOfEmail({ first, role, day, time, laptop = true, contact }) {
  const inner = [
    para(`Dear ${esc(first)},<br><br>This is a reminder that you have an interview <b>today</b> for the <b>${esc(role)}</b> position at EyeLevel Growth Studio.`),
    `<tr><td style="padding:22px 40px 8px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7ee;border-left:4px solid #163027;border-radius:0 10px 10px 0;">
    <tr><td style="padding:20px 24px;">
      <div style="${LABEL}">Today, ${esc(day)}</div>
      <div style="${SANS}font-size:26px;line-height:32px;font-weight:bold;color:#163027;margin-top:6px;">${esc(time)} IST</div>
      <div style="${SANS}font-size:14px;line-height:22px;color:#14201b;margin-top:12px;"><b>EyeLevel Growth Studio</b><br>${esc(ADDRESS.replace('Eyelevel Growth Studio, ', ''))}</div>
    </td></tr>
  </table>
</td></tr>`,
    `<tr><td style="padding:18px 40px 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#163027;border-radius:10px;">
    <a href="${MAP}" style="display:inline-block;padding:14px 28px;${SANS}font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Get directions</a>
  </td></tr></table>
</td></tr>`,
    contactBlock(contact),
    bringBlock(laptop),
    `<tr><td style="padding:0 40px 14px;${SANS}font-size:14px;line-height:23px;color:#14201b;">Please arrive 10 minutes before your scheduled time. If something has come up and you cannot make it, reply to this email as early as you can.</td></tr>`,
    signoff,
  ].join('');
  const html = shell({
    preheader: `Today at ${time} IST at EyeLevel Growth Studio, Ekkatuthangal.`,
    eyebrow: 'Interview today', headline: 'Your interview is today.', inner,
    reason: 'You are receiving it because you have an interview scheduled with us today.',
  });
  const text = plain(`Dear ${first},

This is a reminder that you have an interview today for the ${role} position at EyeLevel Growth Studio.

Today, ${day}
Time: ${time} IST
Venue: ${ADDRESS}
Directions: ${MAP}

${laptop ? 'PLEASE BRING YOUR LAPTOP: after the interview you will complete a short practical task on your own laptop. Make sure it is fully charged.\n\n' : ''}Also bring an updated copy of your CV and your portfolio or work samples, where applicable. Please arrive 10 minutes early. If you cannot make it, reply to this email as early as you can.

Warm regards,
Talent Acquisition Team
EyeLevel Growth Studio

--
This is an automatically generated email from the EyeLevel Growth Studio recruitment system. For questions, reply to this email or write to hr@eyelevelstudio.in.
Privacy Policy: ${PRIVACY}`);
  return { subject: `Today: your interview at EyeLevel Growth Studio, ${time} IST`, html, text };
}

// ---------- 6. Internal: tell the assigned interviewer a candidate has booked ----------
function interviewerEmail({ first, name, phone, email, role, day, time, score, recommendation, strengths, gaps, location, status, currentCtc, expectedCtc, joining, summary, sheetUrl, reassigned }) {
  const row = (k, v) => v ? `<tr><td width="150" valign="top" style="padding:9px 0;border-bottom:1px solid #e3e8df;${LABEL}line-height:20px;">${k}</td><td valign="top" style="padding:9px 0;border-bottom:1px solid #e3e8df;${SANS}font-size:14px;line-height:21px;color:#14201b;">${esc(v)}</td></tr>` : '';
  const table = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e8df;">${rows.join('')}</table>`;
  const inner = [
    para(`Hi ${esc(first)},<br><br>${reassigned ? 'An interview has been <b>assigned to you</b>.' : '<b>' + esc(name) + '</b> has booked an interview slot, and you are the assigned interviewer.'} Details below.`),
    `<tr><td style="padding:22px 40px 8px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7ee;border-left:4px solid #163027;border-radius:0 10px 10px 0;"><tr><td style="padding:18px 22px;">
    <div style="${LABEL}">${esc(day)}</div>
    <div style="${SANS}font-size:24px;line-height:30px;font-weight:bold;color:#163027;margin-top:4px;">${esc(time)} IST</div>
    <div style="${SANS}font-size:14px;color:#14201b;margin-top:8px;">${esc(role)} &nbsp;|&nbsp; In person, EyeLevel Growth Studio, Ekkatuthangal</div>
  </td></tr></table>
</td></tr>`,
    `<tr><td style="padding:14px 40px 8px;"><div style="${LABEL}margin-bottom:6px;">Candidate</div>${table([row('Name', name), row('Phone', phone), row('Email', email)])}</td></tr>`,
    `<tr><td style="padding:14px 40px 8px;"><div style="${LABEL}margin-bottom:6px;">AI review of the application</div>${table([row('Fit score', score ? `${score} / 10 (${recommendation || 'no suggestion'})` : ''), row('Strengths', strengths), row('Gaps', gaps)])}</td></tr>`,
    `<tr><td style="padding:14px 40px 8px;"><div style="${LABEL}margin-bottom:6px;">What the candidate told Tara</div>${table([row('Location', location), row('Fresher / working', status), row('Current CTC', currentCtc), row('Expected CTC', expectedCtc), row('Joining', joining), row('Summary', summary)])}</td></tr>`,
    `<tr><td style="padding:18px 40px 8px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#163027;border-radius:10px;"><a href="${sheetUrl}" style="display:inline-block;padding:13px 26px;${SANS}font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Open in the Sheet</a></td></tr></table>
</td></tr>`,
    `<tr><td style="padding:14px 40px 30px;${SANS}font-size:13px;line-height:21px;color:#5f6b64;">Not the right interviewer? Change <b>Assigned Recruiter</b> for this candidate in the Sheet. The new person is notified and the calendar is updated.</td></tr>`,
  ].join('');
  const html = shell({
    preheader: `${name} booked ${day}, ${time} IST for ${role}.`,
    eyebrow: reassigned ? 'Interview assigned to you' : 'Interview booked', headline: reassigned ? 'A candidate is assigned to you.' : 'A candidate booked an interview.', inner,
    reason: '', internal: true,
  });
  const text = plain(`Hi ${first},

${reassigned ? 'An interview has been assigned to you.' : name + ' has booked an interview slot, and you are the assigned interviewer.'}

When: ${day}, ${time} IST (in person, EyeLevel Growth Studio, Ekkatuthangal)
Role: ${role}

Candidate: ${name}
Phone: ${phone}
Email: ${email}

AI review: ${score ? score + ' / 10 (' + (recommendation || '') + ')' : 'n/a'}
Strengths: ${strengths || '-'}
Gaps: ${gaps || '-'}

Told Tara:
Location: ${location || '-'}
Fresher / working: ${status || '-'}
Current CTC: ${currentCtc || '-'}
Expected CTC: ${expectedCtc || '-'}
Joining: ${joining || '-'}

Open in the Sheet: ${sheetUrl}
Not the right interviewer? Change "Assigned Recruiter" in the Sheet. The new person is notified.

Internal email. Candidate details are confidential.`);
  return { subject: `${reassigned ? 'Interview assigned to you' : 'Interview booked'}: ${name} | ${role} | ${day}, ${time} IST`, html, text };
}

// ---------- 7. Internal: a new lead has come in ----------
const TAG = { PROCEED: ['#e2f0d4', '#2c5a12'], HOLD: ['#fdf0cf', '#7a5a08'], REJECT: ['#f8dcd6', '#8a2a1a'] };
const tag = (rec) => { const [bg, fg] = TAG[rec] || ['#e8ece6', '#3b4a42']; return `<span style="display:inline-block;background:${bg};color:${fg};border-radius:6px;padding:3px 10px;${SANS}font-size:12px;font-weight:bold;letter-spacing:1px;">${esc(rec || 'NO SUGGESTION')}</span>`; };
const irow = (k, v) => v ? `<tr><td width="140" valign="top" style="padding:9px 0;border-bottom:1px solid #e3e8df;${LABEL}line-height:20px;">${k}</td><td valign="top" style="padding:9px 0;border-bottom:1px solid #e3e8df;${SANS}font-size:14px;line-height:21px;color:#14201b;">${v}</td></tr>` : '';
const itable = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e8df;">${rows.join('')}</table>`;
const btn = (href, text, solid = true) => `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-block;margin:0 10px 10px 0;"><tr><td style="background:${solid ? '#163027' : '#ffffff'};border:1px solid #163027;border-radius:10px;"><a href="${href}" style="display:inline-block;padding:13px 24px;${SANS}font-size:14px;font-weight:bold;color:${solid ? '#ffffff' : '#163027'};text-decoration:none;">${text}</a></td></tr></table>`;

function newLeadEmail({ first, lead, sheetUrl, viewUrl }) {
  const inner = [
    para(`Hi ${esc(first)},<br><br>A new application has come in for <b>${esc(lead.role)}</b>, and it is assigned to you.<br><br><b>Please check the candidate and update the Shortlisted status</b> in the Sheet: Shortlisted, On hold or Not shortlisted. The candidate is contacted only after you mark <b>Shortlisted</b>.`),
    `<tr><td style="padding:22px 40px 6px;"><div style="${LABEL}margin-bottom:6px;">${esc(lead.name)} &nbsp; ${tag(lead.recommendation)}</div>${itable([irow('AI fit score', lead.score ? esc(lead.score) + ' / 10' : ''), irow('Why', esc(lead.why)), irow('Strengths', esc(lead.strengths)), irow('Gaps', esc(lead.gaps))])}</td></tr>`,
    `<tr><td style="padding:14px 40px 6px;"><div style="${LABEL}margin-bottom:6px;">Application</div>${itable([irow('City', esc(lead.city)), irow('Expected pay (CV)', esc(lead.expected)), irow('Portfolio / links', esc(lead.portfolio)), irow('Received', esc(lead.received))])}</td></tr>`,
    `<tr><td style="padding:18px 40px 30px;">${btn(sheetUrl, 'Open this candidate')}${viewUrl ? btn(viewUrl, 'My candidates', false) : ''}</td></tr>`,
  ].join('');
  const html = shell({ preheader: `${lead.name} applied for ${lead.role}. AI: ${lead.score}/10 ${lead.recommendation}.`, eyebrow: 'New lead', headline: 'A new application has come in.', inner, reason: '', internal: true });
  const text = plain(`Hi ${first},

A new application has come in for ${lead.role}, and it is assigned to you.

Please check the candidate and update the Shortlisted status in the Sheet (Shortlisted, On hold or Not shortlisted). The candidate is contacted only after you mark Shortlisted.

${lead.name}: AI ${lead.score}/10, ${lead.recommendation}
Why: ${lead.why}
Strengths: ${lead.strengths || '-'}
Gaps: ${lead.gaps || '-'}
City: ${lead.city || '-'} | Expected pay (CV): ${lead.expected || '-'}
Links: ${lead.portfolio || '-'}

Open this candidate: ${sheetUrl}
${viewUrl ? 'My candidates: ' + viewUrl : ''}

Internal email. Candidate details are confidential.`);
  return { subject: `New lead: ${lead.name} | ${lead.role} | AI ${lead.score}/10 ${lead.recommendation || ''}`.trim(), html, text };
}

function leadDigestEmail({ first, leads, viewUrl }) {
  const sorted = leads.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const shown = sorted.slice(0, 30);
  const more = sorted.length - shown.length;
  const rows = shown.map((l) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e3e8df;${SANS}font-size:14px;line-height:20px;color:#14201b;"><b>${esc(l.name)}</b><br><span style="color:#5f6b64;">${esc(l.role)}${l.city ? ' | ' + esc(l.city) : ''}</span></td><td align="right" valign="top" style="padding:10px 0;border-bottom:1px solid #e3e8df;white-space:nowrap;${SANS}font-size:14px;">${esc(l.score || '-')} / 10 &nbsp; ${tag(l.recommendation)}</td></tr>`).join('');
  const inner = [
    para(`Hi ${esc(first)},<br><br><b>${leads.length} new applications</b> have come in and are assigned to you.<br><br><b>Please check each candidate and update the Shortlisted status</b> in the Sheet. A candidate is contacted only after you mark <b>Shortlisted</b>. The best matches are listed first.`),
    `<tr><td style="padding:18px 40px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e8df;">${rows}</table>${more > 0 ? `<div style="${SANS}font-size:13px;color:#5f6b64;padding-top:12px;">and ${more} more. Open your candidates to see all of them.</div>` : ''}</td></tr>`,
    `<tr><td style="padding:18px 40px 30px;">${btn(viewUrl, 'Open my candidates')}</td></tr>`,
  ].join('');
  const html = shell({ preheader: `${leads.length} new applications assigned to you.`, eyebrow: 'New leads', headline: `${leads.length} new applications for you.`, inner, reason: '', internal: true });
  const text = plain(`Hi ${first},

${leads.length} new applications have come in and are assigned to you. Please check each candidate and update the Shortlisted status in the Sheet. A candidate is contacted only after you mark Shortlisted.

${shown.map((l) => `- ${l.name} | ${l.role} | ${l.score || '-'}/10 ${l.recommendation || ''}`).join('\n')}${more > 0 ? `\nand ${more} more` : ''}

Open my candidates: ${viewUrl}

Internal email. Candidate details are confidential.`);
  return { subject: `${leads.length} new applications assigned to you`, html, text };
}

// ---------- 8. Internal: today's interviews, sent to each interviewer in the morning ----------
function interviewerDayEmail({ first, day, items }) {
  const rows = items.map((it) => `<tr><td width="150" valign="top" style="padding:12px 0;border-bottom:1px solid #e3e8df;${SANS}font-size:14px;line-height:20px;font-weight:bold;color:#163027;">${esc(it.time)}</td><td valign="top" style="padding:12px 0;border-bottom:1px solid #e3e8df;${SANS}font-size:14px;line-height:21px;color:#14201b;"><b>${esc(it.name)}</b><br><span style="color:#5f6b64;">${esc(it.role)}</span><br>${esc(it.phone)}${it.email ? ' | ' + esc(it.email) : ''}</td></tr>`).join('');
  const n = items.length;
  const inner = [
    para(`Hi ${esc(first)},<br><br>You have <b>${n} interview${n > 1 ? 's' : ''} scheduled today</b>, ${esc(day)}, in person at EyeLevel Growth Studio, Ekkatuthangal. Candidates have been asked to bring their laptop for the practical task.`),
    `<tr><td style="padding:18px 40px 6px;"><div style="${LABEL}margin-bottom:6px;">Today's schedule (IST)</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e8df;">${rows}</table></td></tr>`,
    `<tr><td style="padding:16px 40px 30px;${SANS}font-size:13px;line-height:21px;color:#5f6b64;">Venue: ${esc(ADDRESS)}<br>Changed plans? Update <b>Assigned Recruiter</b> in the Sheet and the new person is notified.</td></tr>`,
  ].join('');
  const html = shell({ preheader: `${n} interview${n > 1 ? 's' : ''} today, starting ${items[0].time.split(' to ')[0]}.`, eyebrow: 'Interviews today', headline: `You have ${n} interview${n > 1 ? 's' : ''} today.`, inner, reason: '', internal: true });
  const text = plain(`Hi ${first},

You have ${n} interview${n > 1 ? 's' : ''} scheduled today, ${day}, in person at EyeLevel Growth Studio.

${items.map((it) => `${it.time} IST: ${it.name} | ${it.role} | ${it.phone}`).join('\n')}

Venue: ${ADDRESS}

Internal email. Candidate details are confidential.`);
  return { subject: `Today: ${n} interview${n > 1 ? 's' : ''} scheduled | ${day}`, html, text };
}

function alertEmail({ title, lines }) {
  const inner = [
    para(lines.map((l) => esc(l)).join('<br><br>')),
    `<tr><td style="padding:10px 40px 30px;${SANS}font-size:13px;color:#5f6b64;">Nothing is lost: the applications stay in the mailbox and are read automatically once this is fixed.</td></tr>`,
  ].join('');
  const html = shell({ preheader: title, eyebrow: 'Action needed', headline: title, inner, reason: '', internal: true });
  return { subject: `Action needed: ${title}`, html, text: lines.join('\n\n') };
}

module.exports = { alertEmail, linkEmail, reminderEmail, invitationEmail, confirmEmail, dayOfEmail, interviewerEmail, newLeadEmail, leadDigestEmail, interviewerDayEmail, esc };
