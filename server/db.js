import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const db = new Database(path.join(__dirname, '../aether.db'));

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      agentTarget TEXT,
      metadata TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      endpointUrl TEXT,
      description TEXT,
      isDefault INTEGER DEFAULT 0,
      sortOrder INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS agent_tasks (
      id TEXT PRIMARY KEY,
      agentId TEXT NOT NULL,
      agentName TEXT NOT NULL,
      status TEXT DEFAULT 'idle',
      progress INTEGER DEFAULT 0,
      currentTask TEXT,
      lastUpdated TEXT,
      endpointUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_task_logs (
      id TEXT PRIMARY KEY,
      agentId TEXT,
      agentName TEXT,
      agentIcon TEXT,
      taskDescription TEXT,
      status TEXT,
      duration REAL,
      completedAt TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS build_status (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'idle',
      lastUpdated TEXT,
      buildLog TEXT,
      buildDuration REAL
    );

    CREATE TABLE IF NOT EXISTS build_history (
      id TEXT PRIMARY KEY,
      status TEXT,
      commitSha TEXT,
      commitMessage TEXT,
      duration REAL,
      buildLog TEXT,
      triggeredBy TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS asset_library (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'model',
      url TEXT NOT NULL,
      taskId TEXT,
      prompt TEXT,
      agentName TEXT,
      importedToUE5 INTEGER DEFAULT 0,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default agents
  const defaults = [
    { id: 'agent-odysseus',    name: 'Odysseus',    icon: 'brain',  description: 'Main AI — OpenRouter multi-model (GPT-4o / Claude 3.5)', endpointUrl: '', sortOrder: 0 },
    { id: 'agent-host',        name: 'Host',        icon: 'local',  description: 'odysseus_agent.py on your machine — shell, build, git', endpointUrl: process.env.NGROK_URL || '', sortOrder: 1 },
    { id: 'agent-tripo',       name: 'Tripo3D',     icon: 'tripo',  description: 'AI 3D mesh generation — text to game-ready GLB', endpointUrl: '', sortOrder: 2 },
    { id: 'agent-cursor',      name: 'Cursor',      icon: 'cursor', description: 'Code auditor', endpointUrl: '', sortOrder: 3 },
    { id: 'agent-elevenlabs',  name: 'ElevenLabs',  icon: 'brain',  description: 'AI voice generation', endpointUrl: '', sortOrder: 4 },
    { id: 'agent-stability',   name: 'StabilityAI', icon: 'brain',  description: 'AI image generation', endpointUrl: '', sortOrder: 5 },
  ];
  const insert = db.prepare(`INSERT OR IGNORE INTO agents (id, name, icon, description, endpointUrl, isDefault, sortOrder) VALUES (@id, @name, @icon, @description, @endpointUrl, 1, @sortOrder)`);
  for (const a of defaults) insert.run(a);

  // Ensure single build_status row
  const bs = db.prepare('SELECT id FROM build_status').get();
  if (!bs) db.prepare("INSERT INTO build_status (id, status, lastUpdated, buildLog, buildDuration) VALUES ('bs-1', 'idle', datetime('now'), '', 0)").run();

  console.log('[DB] SQLite initialised — aether.db');
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
