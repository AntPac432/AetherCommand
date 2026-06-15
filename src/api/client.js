const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export const API = {
  // Messages
  getMessages: () => fetch(`${BASE}/api/messages`).then(r => r.json()),
  createMessage: (data) => fetch(`${BASE}/api/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  clearMessages: () => fetch(`${BASE}/api/messages`, { method: 'DELETE' }).then(r => r.json()),

  // Agents
  getAgents: () => fetch(`${BASE}/api/agents`).then(r => r.json()),
  createAgent: (data) => fetch(`${BASE}/api/agents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  deleteAgent: (id) => fetch(`${BASE}/api/agents/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Tasks
  getAgentTasks: () => fetch(`${BASE}/api/agent-tasks`).then(r => r.json()),
  getTaskLogs: () => fetch(`${BASE}/api/task-logs`).then(r => r.json()),
  clearTaskLogs: () => fetch(`${BASE}/api/task-logs`, { method: 'DELETE' }).then(r => r.json()),
  deleteTaskLog: (id) => fetch(`${BASE}/api/task-logs/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Build
  getBuildStatus: () => fetch(`${BASE}/api/build-status`).then(r => r.json()),
  getBuildHistory: () => fetch(`${BASE}/api/build-history`).then(r => r.json()),

  // Assets
  getAssets: () => fetch(`${BASE}/api/assets`).then(r => r.json()),
  deleteAsset: (id) => fetch(`${BASE}/api/assets/${id}`, { method: 'DELETE' }).then(r => r.json()),
  markAssetImported: (id) => fetch(`${BASE}/api/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importedToUE5: true }) }).then(r => r.json()),

  // Command
  sendCommand: (data) => fetch(`${BASE}/api/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  // GitHub
  github: (data) => fetch(`${BASE}/api/github`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),

  // Tripo
  tripo: (data) => fetch(`${BASE}/api/tripo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
};
