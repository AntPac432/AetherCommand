import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const conversationHistory = [];
const MAX_HISTORY = 20;
let pingCache = { result: false, ts: 0 };
const PING_TTL_MS = 30_000;
const NGROK_URL = 'https://pushcart-silica-slackness.ngrok-free.app';

// NOTE: Replace NGROK_URL with your own ngrok endpoint in Settings → ODYSSEUS NGROK ENDPOINT URL
// The full system prompt is in the original source. See sendMcpCommand.js in Base44 dashboard → Code → Functions.

async function queryOpenRouter(messages, model = 'openai/gpt-4o') {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': 'https://gamedirector.base44.app', 'X-Title': 'Game Director Command Center' },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 8192 })
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`OpenRouter error ${res.status}: ${err}`); }
  const data = await res.json();
  return data.choices[0].message.content;
}

async function pingLocalAgent({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - pingCache.ts < PING_TTL_MS) return pingCache.result;
  try {
    const res = await fetch(NGROK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1', 'User-Agent': 'OdysseusBackend/1.0' }, body: JSON.stringify({ command: 'status' }), signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('not ok');
    const text = await res.text();
    if (text.trim().startsWith('<')) throw new Error('html');
    JSON.parse(text);
    pingCache = { result: true, ts: now };
    return true;
  } catch {
    pingCache = { result: false, ts: now };
    return false;
  }
}

async function dispatchToLocalAgent(command) {
  const res = await fetch(NGROK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1', 'User-Agent': 'OdysseusBackend/1.0' }, body: JSON.stringify({ command }), signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Agent ${res.status}: ${text.slice(0, 100)}`);
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { command, clearHistory, directDispatch, checkAgentStatus } = body;
    if (checkAgentStatus) { const online = await pingLocalAgent({ force: true }); return Response.json({ online }); }
    if (clearHistory) { conversationHistory.length = 0; return Response.json({ ok: true, response: 'Conversation history cleared.' }); }
    if (!command) return Response.json({ error: 'No command provided' }, { status: 400 });
    if (directDispatch) { try { const data = await dispatchToLocalAgent(command); return Response.json({ ok: true, result: data }); } catch (err) { return Response.json({ ok: false, error: err.message }, { status: 502 }); } }
    const localOnline = await pingLocalAgent();
    const messages = [{ role: 'system', content: 'You are Odysseus, the central command AI for the Apothic game development project.' + (localOnline ? ' HOST: ONLINE.' : ' HOST: OFFLINE.') }, ...conversationHistory.slice(-20), { role: 'user', content: command }];
    const reply = await queryOpenRouter(messages);
    conversationHistory.push({ role: 'user', content: command }, { role: 'assistant', content: reply });
    if (conversationHistory.length > MAX_HISTORY * 2) conversationHistory.splice(0, 2);
    return Response.json({ ok: true, response: reply, localAgentOnline: localOnline });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
