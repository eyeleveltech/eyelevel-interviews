// Shared bits for the AI-recruiter conversation (ElevenLabs agent opened in the browser).
const KEY = () => process.env.ELEVENLABS_API_KEY;
const AGENT = () => process.env.ELEVENLABS_AGENT_ID;
const LINK_VALID_MS = 7 * 24 * 3600 * 1000;

const ROLE_QUESTIONS = [
  ['frontend', 'Tell me about one website or app you have built. What did you use to build it?'],
  ['social media', 'Which brand\'s Instagram do you think is doing really well right now, and why?'],
  ['graphic', 'Which design tools do you use most, and have you used any AI image tools?'],
  ['video', 'What editing software do you use, and what kind of videos have you edited most?'],
  ['copy', 'Have you written social media or ad copy before? For which brand or project?'],
  ['creative', 'Tell me about one campaign or brand project you led that you are proud of.'],
];
const roleQuestion = (role) => {
  const r = String(role || '').toLowerCase();
  const hit = ROLE_QUESTIONS.find(([k]) => r.includes(k));
  return hit ? hit[1] : 'What part of this role are you most excited about?';
};

// the variables the agent's script uses ({{first_name}}, {{role}} ...)
function agentVars(get, code) {
  const exp = get('Total Exp (yrs)');
  const name = get('Name');
  return {
    candidate_name: name,
    first_name: (name.split(' ')[0] || 'there'),
    role: get('Role Applied') || 'the role you applied for',
    applied_date: (get('Received') || '').slice(0, 10),
    exp_hint: exp ? `Your application mentions about ${exp} years. Can you confirm that?` : 'Do you have any work or internship experience in this area?',
    role_question: roleQuestion(get('Role Applied')),
    booking_code: code, // lets /api/talk-done confirm a conversation belongs to this candidate
  };
}

async function eleven(path, opts = {}) {
  const r = await fetch(`https://api.elevenlabs.io${path}`, { ...opts, headers: { 'xi-api-key': KEY(), ...(opts.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`ElevenLabs ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

module.exports = { KEY, AGENT, LINK_VALID_MS, agentVars, eleven };
