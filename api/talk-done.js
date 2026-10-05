// POST /api/talk-done {c, conversationId, attempt} -> reads the finished conversation from ElevenLabs,
// writes the result to the Sheet, and says whether the candidate should go on to scheduling.
const g = require('../lib/google');
const t = require('../lib/talk');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  try {
    const { c, conversationId, attempt } = req.body || {};
    const f = await g.findByCode(c);
    if (!f) return res.json({ ok: false, msg: 'This link is not valid.' });
    const { r, col, head, row1 } = f;
    const get = (n) => (r[col(n)] || '').trim();
    if (get('Talked At')) return res.json({ ok: true, done: true, completed: true, interested: get('Confirmed Interest').toLowerCase() !== 'no' });

    const id = String(conversationId || '').trim();
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return res.json({ ok: false, msg: 'Conversation not found.' });
    const conv = await t.eleven(`/v1/convai/conversations/${id}`);
    if (conv.agent_id && conv.agent_id !== t.AGENT()) return res.json({ ok: false, msg: 'Conversation not found.' });
    // the conversation must have been started with THIS candidate's code
    if (!JSON.stringify(conv.conversation_initiation_client_data || {}).includes(String(c).trim())) {
      return res.json({ ok: false, msg: 'Conversation not found.' });
    }
    if (['initiated', 'in-progress', 'processing'].includes(conv.status)) return res.json({ ok: true, done: false });

    const dc = (conv.analysis && conv.analysis.data_collection_results) || {};
    const analysisReady = Object.keys(dc).length > 0;
    if (!analysisReady && Number(attempt || 0) < 12) return res.json({ ok: true, done: false });

    const userTurns = (conv.transcript || []).filter((x) => x.role === 'user' && String(x.message || '').trim()).length;
    if (userTurns < 3) {
      await g.updateRow(row1, head, { 'AI Chat Status': `Ended early (${g.istStamp()}), can retry` });
      return res.json({ ok: true, done: true, completed: false });
    }

    const val = (k) => (dc[k] ? dc[k].value : undefined);
    const interested = val('interested');
    const onsite = val('office_ok');                       // willing to work from the office?
    const travelOk = val('travel_ok');
    // no interview slot for anyone who says no to on-site work
    const confirmed = interested === false || onsite === false ? 'No' : interested === true ? 'Yes' : 'Unclear';
    const said = (k) => { const x = val(k); return x === undefined || x === null || x === false ? '' : String(x); };
    const kind = said('candidate_status').toLowerCase();
    const fresher = kind.includes('fresh') || kind.includes('student') ? 'Fresher' : kind.includes('work') || kind.includes('employ') ? 'Working' : '';
    const shown = ['current_location', 'travel_ok', 'office_ok', 'candidate_status', 'current_ctc', 'expected_ctc', 'joining_date', 'role_answer', 'portfolio', 'callback_time', 'red_flags'];
    const notes = shown.filter((k) => dc[k] && val(k) !== undefined && val(k) !== null && val(k) !== '')
      .map((k) => `${k.replace(/_/g, ' ')}: ${val(k)}`).join('\n');
    const summary = [(conv.analysis && conv.analysis.transcript_summary) || '', notes].filter(Boolean).join('\n\n').slice(0, 3000);

    const where = said('current_location') + (travelOk === false ? ' (travel: not comfortable)' : '');
    await g.updateRow(row1, head, {
      'AI Chat Status': onsite === false ? 'Talked: not willing to work on-site' : confirmed === 'No' ? 'Talked: not interested' : 'Talked',
      'Location (Chennai)': where, 'Fresher / Working': fresher, 'Current CTC (said)': said('current_ctc'), 'Expected CTC (said)': said('expected_ctc'),
      'Joining Date (said)': said('joining_date'), 'On-site OK?': onsite === true ? 'Yes' : onsite === false ? 'No' : '',
      'AI Chat Summary': summary,
      'Confirmed Interest': confirmed,
      'Talked At': g.istStamp(),
      'Conversation ID': id,
    });
    res.json({ ok: true, done: true, completed: true, interested: confirmed !== 'No' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Something went wrong. Please refresh the page.' });
  }
};
