import { db, newId } from './db.js';

const conversationHistory = [];
const MAX_HISTORY = 20;
let pingCache = { result: false, ts: 0 };
const PING_TTL_MS = 30_000;

function getNgrokUrl() {
  // Check DB for override, else fall back to env
  const row = db.prepare("SELECT value FROM agent_tasks WHERE agentId = 'ngrok_url'").get();
  return row?.value || process.env.NGROK_URL || 'http://localhost:8765';
}

const SYSTEM_PROMPT = `You are Odysseus, the central command AI for the Apothic game development project.

PROJECT: Apothic — Unreal Engine 5.5
REPO: https://github.com/${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}

AGENT DISPATCH FORMAT:
- Local shell/build/git: <dispatch agent="OdysseusLocal">command</dispatch>
- 3D model generation:   <dispatch agent="Tripo3D">prompt: describe mesh</dispatch>
- Voice/NPC audio:       <dispatch agent="ElevenLabs">voice_id: ID | text: dialogue</dispatch>
- Image/texture:         <dispatch agent="StabilityAI">prompt: description</dispatch>
- Web search:            <search>query here</search>

PIPELINE FORMAT (write code + commit + build in one shot):
pipeline:
path: Source/Apothic/MyFile.cpp
commit: feat: short message
build: Development
---
[file content]`;

async function queryOpenRouter(messages, model = 'openai/gpt-4o') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': 'http://localhost:5173', 'X-Title': 'AetherCommand' },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 8192 })
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function performWebSearch(query) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return '[Search unavailable: GOOGLE_API_KEY not set]';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: `Search the web and answer: ${query}` }] }], tools: [{ googleSearch: {} }] })
  });
  const data = await res.json();
  try { return data.candidates[0].content.parts[0].text; } catch { return '[No search results]'; }
}

function selectModel(command) {
  const lower = command.toLowerCase();
  if (/\b(c\+\+|class|implement|header|\.cpp|\.h|uclass|ufunction|architecture|refactor|subsystem)\b/.test(lower))
    return 'anthropic/claude-3.5-sonnet';
  return 'openai/gpt-4o';
}

export async function pingLocalAgent({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - pingCache.ts < PING_TTL_MS) return pingCache.result;
  const url = getNgrokUrl();
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }, body: JSON.stringify({ command: 'status' }), signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    if (!res.ok || text.trim().startsWith('<')) throw new Error('bad');
    JSON.parse(text);
    pingCache = { result: true, ts: now };
    return true;
  } catch {
    pingCache = { result: false, ts: now };
    return false;
  }
}

export async function dispatchDirect(command) {
  const url = getNgrokUrl();
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }, body: JSON.stringify({ command }), signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Agent ${res.status}: ${text.slice(0, 100)}`);
  return JSON.parse(text);
}

function updateAgentStatus(agentName, status, currentTask, progress = 0) {
  const existing = db.prepare('SELECT id FROM agent_tasks WHERE agentName = ?').get(agentName);
  if (existing) {
    db.prepare('UPDATE agent_tasks SET status=?, currentTask=?, progress=?, lastUpdated=? WHERE id=?').run(status, currentTask, progress, new Date().toISOString(), existing.id);
  } else {
    db.prepare('INSERT INTO agent_tasks (id, agentId, agentName, status, currentTask, progress, lastUpdated) VALUES (?,?,?,?,?,?,?)').run(newId(), agentName, agentName, status, currentTask, progress, new Date().toISOString());
  }
}

export async function sendCommand(command, db, newId) {
  const localOnline = await pingLocalAgent();
  const selectedModel = selectModel(command);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + (localOnline ? '\n\nSTATUS: OdysseusLocal ONLINE.' : '\n\nSTATUS: OdysseusLocal OFFLINE.') + `\nACTIVE MODEL: ${selectedModel}` },
    ...conversationHistory.slice(-MAX_HISTORY * 2),
    { role: 'user', content: command }
  ];

  let reply = await queryOpenRouter(messages, selectedModel);

  // Handle <search>
  const searchMatch = reply.match(/<search>(.*?)<\/search>/s);
  if (searchMatch) {
    const results = await performWebSearch(searchMatch[1].trim());
    messages.push({ role: 'assistant', content: reply });
    messages.push({ role: 'user', content: `[WEB SEARCH RESULTS]:\n${results}\n\nNow respond to the original request using these results.` });
    reply = await queryOpenRouter(messages, selectedModel);
  }

  // Handle <dispatch>
  const dispatchMatches = [...reply.matchAll(/<dispatch agent="([^"]+)">([sS]*?)<\/dispatch>/g)];
  if (dispatchMatches.length > 0) {
    const dispatchResults = await Promise.all(dispatchMatches.map(async ([, agentName, task]) => {
      const t = task.trim();

      if (agentName === 'OdysseusLocal' || agentName === 'Cursor') {
        if (!localOnline) return `[OdysseusLocal OFFLINE — cannot run: ${t.slice(0, 60)}]`;
        try {
          updateAgentStatus('OdysseusLocal', 'running', t.slice(0, 80), 20);
          const result = await dispatchDirect(t);
          const ok = result?.success !== false;
          updateAgentStatus('OdysseusLocal', ok ? 'success' : 'error', (result?.output || t).slice(0, 80), ok ? 100 : 0);
          return `[OdysseusLocal ${ok ? 'done' : 'failed'}: ${(result?.output || '').slice(0, 200)}]`;
        } catch (err) {
          updateAgentStatus('OdysseusLocal', 'error', err.message.slice(0, 80), 0);
          return `[OdysseusLocal error: ${err.message}]`;
        }
      }

      if (agentName === 'Tripo3D') {
        const prompt = t.replace(/^prompt:\s*/i, '').trim();
        try {
          const { tripo3dOp } = await import('./tripo.js');
          updateAgentStatus('Tripo3D', 'running', `Generating: ${prompt.slice(0, 50)}`, 10);
          const submitRes = await tripo3dOp({ prompt });
          const taskId = submitRes?.taskId;
          if (!taskId) throw new Error('No taskId');
          let modelUrl = null;
          for (let i = 0; i < 48; i++) {
            await new Promise(r => setTimeout(r, 5000));
            const poll = await tripo3dOp({ checkStatus: true, taskId });
            updateAgentStatus('Tripo3D', 'running', `Generating… ${poll.progress || 0}%`, Math.round(15 + (poll.progress || 0) * 0.8));
            if (poll.status === 'success') { modelUrl = poll.modelUrl; break; }
            if (poll.status === 'failed') throw new Error('Tripo3D task failed');
          }
          if (!modelUrl) throw new Error('Timed out');
          updateAgentStatus('Tripo3D', 'success', `Done: ${prompt.slice(0, 50)}`, 100);
          db.prepare('INSERT INTO asset_library (id, name, type, url, taskId, prompt, agentName) VALUES (?,?,?,?,?,?,?)').run(newId(), prompt.slice(0, 60), 'model', modelUrl, taskId, prompt, 'Tripo3D');
          return `[Tripo3D: model ready — ${modelUrl}]`;
        } catch (err) {
          updateAgentStatus('Tripo3D', 'error', err.message.slice(0, 60), 0);
          return `[Tripo3D error: ${err.message}]`;
        }
      }

      if (agentName === 'StabilityAI') {
        const stabilityKey = process.env.STABILITY_API_KEY;
        if (!stabilityKey) return '[StabilityAI: STABILITY_API_KEY not set in .env]';
        const promptMatch = t.match(/prompt:\s*([^|]+)/i);
        const prompt = promptMatch ? promptMatch[1].trim() : t;
        try {
          updateAgentStatus('StabilityAI', 'running', `Generating: ${prompt.slice(0, 50)}`, 20);
          const imgRes = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${stabilityKey}`, 'Accept': 'application/json' },
            body: JSON.stringify({ text_prompts: [{ text: prompt, weight: 1 }], cfg_scale: 7, height: 1024, width: 1024, steps: 30, samples: 1 })
          });
          if (!imgRes.ok) throw new Error(`StabilityAI ${imgRes.status}`);
          const imgData = await imgRes.json();
          const b64str = imgData.artifacts?.[0]?.base64;
          if (!b64str) throw new Error('No image data');
          // Save to disk in uploads/
          const { writeFileSync, mkdirSync } = await import('fs');
          const { join, dirname } = await import('path');
          const { fileURLToPath } = await import('url');
          const uploadsDir = join(dirname(fileURLToPath(import.meta.url)), '../uploads');
          mkdirSync(uploadsDir, { recursive: true });
          const fname = `stability-${newId()}.png`;
          const buf = Buffer.from(b64str, 'base64');
          writeFileSync(join(uploadsDir, fname), buf);
          const imageUrl = `/api/files/${fname}`;
          updateAgentStatus('StabilityAI', 'success', `Done: ${prompt.slice(0, 40)}`, 100);
          db.prepare('INSERT INTO asset_library (id, name, type, url, prompt, agentName) VALUES (?,?,?,?,?,?)').run(newId(), prompt.slice(0, 60), 'texture', imageUrl, prompt, 'StabilityAI');
          return `[StabilityAI: image ready — ${imageUrl}]`;
        } catch (err) {
          updateAgentStatus('StabilityAI', 'error', err.message.slice(0, 60), 0);
          return `[StabilityAI error: ${err.message}]`;
        }
      }

      if (agentName === 'ElevenLabs') {
        const elevenKey = process.env.ELEVENLABS_API_KEY;
        if (!elevenKey) return '[ElevenLabs: ELEVENLABS_API_KEY not set in .env]';
        const voiceMatch = t.match(/voice_id:\s*([^|]+)\|?\s*text:\s*(.*)/is);
        const voiceId = voiceMatch ? voiceMatch[1].trim() : '21m00Tcm4TlvDq8ikWAM';
        const text = voiceMatch ? voiceMatch[2].trim() : t;
        try {
          updateAgentStatus('ElevenLabs', 'running', `Generating voice: ${text.slice(0, 50)}`, 20);
          const audioRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenKey },
            body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8 } })
          });
          if (!audioRes.ok) throw new Error(`ElevenLabs ${audioRes.status}`);
          const buf = Buffer.from(await audioRes.arrayBuffer());
          const { writeFileSync, mkdirSync } = await import('fs');
          const { join, dirname } = await import('path');
          const { fileURLToPath } = await import('url');
          const uploadsDir = join(dirname(fileURLToPath(import.meta.url)), '../uploads');
          mkdirSync(uploadsDir, { recursive: true });
          const fname = `voice-${newId()}.mp3`;
          writeFileSync(join(uploadsDir, fname), buf);
          const audioUrl = `/api/files/${fname}`;
          updateAgentStatus('ElevenLabs', 'success', `Voice ready: ${text.slice(0, 40)}`, 100);
          db.prepare('INSERT INTO asset_library (id, name, type, url, prompt, agentName) VALUES (?,?,?,?,?,?)').run(newId(), text.slice(0, 60), 'audio', audioUrl, text, 'ElevenLabs');
          return `[ElevenLabs: voice ready — ${audioUrl}]`;
        } catch (err) {
          updateAgentStatus('ElevenLabs', 'error', err.message.slice(0, 60), 0);
          return `[ElevenLabs error: ${err.message}]`;
        }
      }

      return `[Unknown agent: ${agentName}]`;
    }));

    messages.push({ role: 'assistant', content: reply });
    messages.push({ role: 'user', content: dispatchResults.join('\n') + '\n\nBriefly summarize what was done and any results.' });
    reply = await queryOpenRouter(messages, selectedModel);
  }

  conversationHistory.push({ role: 'user', content: command }, { role: 'assistant', content: reply });
  if (conversationHistory.length > MAX_HISTORY * 2) conversationHistory.splice(0, 2);

  return { ok: true, response: reply, localAgentOnline: localOnline, modelUsed: selectedModel };
}
