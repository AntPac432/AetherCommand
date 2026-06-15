import express from 'express';
import { db, newId } from './db.js';
import { sendCommand, pingLocalAgent, dispatchDirect } from './mcp.js';
import { githubOps } from './github.js';
import { tripo3dOp } from './tripo.js';
import { webhookHandler } from './webhook.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: path.join(__dirname, '../uploads/') });

// ── Ensure uploads dir exists ────────────────────────────────────────────
fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });

// ── Messages ─────────────────────────────────────────────────────────────
router.get('/messages', (req, res) => {
  const rows = db.prepare('SELECT * FROM messages ORDER BY created_date ASC LIMIT 200').all();
  res.json(rows);
});

router.post('/messages', (req, res) => {
  const { role, content, agentTarget, metadata } = req.body;
  const id = newId();
  db.prepare('INSERT INTO messages (id, role, content, agentTarget, metadata) VALUES (?, ?, ?, ?, ?)').run(id, role, content, agentTarget || null, metadata || null);
  res.json({ id, role, content, agentTarget, metadata, created_date: new Date().toISOString() });
});

router.delete('/messages', (req, res) => {
  db.prepare('DELETE FROM messages').run();
  res.json({ ok: true });
});

// ── Agents ────────────────────────────────────────────────────────────────
router.get('/agents', (req, res) => {
  res.json(db.prepare('SELECT * FROM agents ORDER BY sortOrder ASC').all());
});

router.post('/agents', (req, res) => {
  const { name, icon, endpointUrl, description, sortOrder } = req.body;
  const id = newId();
  db.prepare('INSERT INTO agents (id, name, icon, endpointUrl, description, isDefault, sortOrder) VALUES (?, ?, ?, ?, ?, 0, ?)').run(id, name, icon || 'brain', endpointUrl || '', description || '', sortOrder ?? 99);
  res.json(db.prepare('SELECT * FROM agents WHERE id = ?').get(id));
});

router.delete('/agents/:id', (req, res) => {
  db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Agent tasks ───────────────────────────────────────────────────────────
router.get('/agent-tasks', (req, res) => {
  res.json(db.prepare('SELECT * FROM agent_tasks ORDER BY lastUpdated DESC').all());
});

// ── Task logs ─────────────────────────────────────────────────────────────
router.get('/task-logs', (req, res) => {
  res.json(db.prepare('SELECT * FROM agent_task_logs ORDER BY created_date DESC LIMIT 100').all());
});

router.delete('/task-logs', (req, res) => {
  db.prepare('DELETE FROM agent_task_logs').run();
  db.prepare("UPDATE agent_tasks SET status='idle', progress=0, currentTask=''").run();
  res.json({ ok: true });
});

router.delete('/task-logs/:id', (req, res) => {
  db.prepare('DELETE FROM agent_task_logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Build status + history ────────────────────────────────────────────────
router.get('/build-status', (req, res) => {
  res.json(db.prepare('SELECT * FROM build_status').get() || {});
});

router.get('/build-history', (req, res) => {
  res.json(db.prepare('SELECT * FROM build_history ORDER BY created_date DESC LIMIT 50').all());
});

// ── Asset library ─────────────────────────────────────────────────────────
router.get('/assets', (req, res) => {
  res.json(db.prepare('SELECT * FROM asset_library ORDER BY created_date DESC LIMIT 200').all());
});

router.delete('/assets/:id', (req, res) => {
  db.prepare('DELETE FROM asset_library WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.patch('/assets/:id', (req, res) => {
  const { importedToUE5 } = req.body;
  db.prepare('UPDATE asset_library SET importedToUE5 = ? WHERE id = ?').run(importedToUE5 ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM asset_library WHERE id = ?').get(req.params.id));
});

// File upload (for ElevenLabs / StabilityAI blobs)
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const publicUrl = `/api/files/${req.file.filename}`;
  res.json({ file_url: publicUrl });
});

router.use('/files', express.static(path.join(__dirname, '../uploads')));

// ── MCP / Odysseus command ────────────────────────────────────────────────
router.post('/command', async (req, res) => {
  const { command, clearHistory, directDispatch, checkAgentStatus } = req.body;
  if (checkAgentStatus) { const online = await pingLocalAgent(); return res.json({ online }); }
  if (clearHistory) { return res.json({ ok: true, response: 'History cleared.' }); }
  if (directDispatch) { try { const r = await dispatchDirect(command); return res.json({ ok: true, result: r }); } catch (e) { return res.status(502).json({ ok: false, error: e.message }); } }
  if (!command) return res.status(400).json({ error: 'No command' });
  const result = await sendCommand(command, db, newId);
  res.json(result);
});

// ── GitHub ────────────────────────────────────────────────────────────────
router.post('/github', async (req, res) => {
  try { res.json(await githubOps(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Tripo3D ───────────────────────────────────────────────────────────────
router.post('/tripo', async (req, res) => {
  try { res.json(await tripo3dOp(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Inbound webhook (from odysseus_agent.py) ──────────────────────────────
router.post('/webhook', webhookHandler(db, newId));

export { router };
