import { newId } from './db.js';

export function webhookHandler(db, newId) {
  return (req, res) => {
    const expectedToken = process.env.WEBHOOK_TOKEN;
    const receivedToken = req.headers['x-webhook-token'] || req.query.token;
    if (expectedToken && receivedToken !== expectedToken) return res.status(403).json({ error: 'Invalid token' });

    const body = req.body;
    const { type, agentId, agentName, status, progress, currentTask, buildLog, buildDuration } = body;

    if (type === 'build_status') {
      const bs = db.prepare('SELECT id FROM build_status').get();
      if (bs) db.prepare('UPDATE build_status SET status=?, lastUpdated=?, buildLog=?, buildDuration=? WHERE id=?').run(status || 'idle', new Date().toISOString(), buildLog || '', buildDuration || 0, bs.id);
      if (status === 'success' || status === 'failed') {
        db.prepare('INSERT INTO build_history (id, status, commitSha, commitMessage, duration, buildLog, triggeredBy) VALUES (?,?,?,?,?,?,?)').run(newId(), status, body.commitSha || '', body.commitMessage || '', buildDuration || null, (buildLog || '').slice(0, 2000), body.triggeredBy || 'OdysseusLocal');
        const old = db.prepare('SELECT id FROM build_history ORDER BY created_date ASC').all();
        if (old.length > 50) db.prepare('DELETE FROM build_history WHERE id IN (' + old.slice(0, old.length - 50).map(() => '?').join(',') + ')').run(...old.slice(0, old.length - 50).map(r => r.id));
      }
      return res.json({ ok: true, type: 'build_status' });
    }

    if (type === 'agent_task' || agentId) {
      const existing = db.prepare('SELECT id FROM agent_tasks WHERE agentId = ?').get(agentId);
      if (existing) db.prepare('UPDATE agent_tasks SET agentName=?, status=?, progress=?, currentTask=?, lastUpdated=? WHERE id=?').run(agentName || '', status || 'idle', progress !== undefined ? progress : 0, currentTask || '', new Date().toISOString(), existing.id);
      else db.prepare('INSERT INTO agent_tasks (id, agentId, agentName, status, progress, currentTask, lastUpdated) VALUES (?,?,?,?,?,?,?)').run(newId(), agentId, agentName || '', status || 'running', progress || 0, currentTask || '', new Date().toISOString());
      if (status === 'success' || status === 'error') {
        db.prepare('INSERT INTO agent_task_logs (id, agentId, agentName, agentIcon, taskDescription, status, duration, completedAt) VALUES (?,?,?,?,?,?,?,?)').run(newId(), agentId, agentName || '', body.agentIcon || '', currentTask || '', status, body.duration || null, new Date().toISOString());
      }
      return res.json({ ok: true, type: 'agent_task' });
    }

    if (type === 'chat_response') {
      const id = newId();
      db.prepare('INSERT INTO messages (id, role, content) VALUES (?,?,?)').run(id, 'assistant', body.content || '');
      return res.json({ ok: true, type: 'chat_response' });
    }

    res.status(400).json({ error: 'Unknown type' });
  };
}
