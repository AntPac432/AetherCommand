const TRIPO_BASE = 'https://api.tripo3d.ai/v2/openapi';

async function tripoReq(path, method = 'GET', body = null) {
  const key = process.env.TRIPO3D_API_KEY;
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${TRIPO_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(`Tripo3D ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

export async function tripo3dOp({ prompt, checkStatus, taskId, refineTaskId }) {
  if (checkStatus && taskId) {
    const r = await tripoReq(`/task/${taskId}`);
    const task = r.data;
    if (task.status === 'success') return { ok: true, status: 'success', modelUrl: task.output?.model || task.output?.pbr_model || '', taskId };
    if (task.status === 'failed' || task.status === 'cancelled') return { ok: false, status: task.status, taskId };
    return { ok: true, status: task.status, progress: task.progress || 0, taskId };
  }
  if (!prompt) throw new Error('prompt required');
  const taskBody = refineTaskId
    ? { type: 'refine_draft', draft_model_task_id: refineTaskId, prompt, model_version: 'v2.5-20250123', face_limit: 10000, texture: true, pbr: true }
    : { type: 'text_to_model', prompt, model_version: 'v2.5-20250123', face_limit: 10000, texture: true, pbr: true };
  const res = await tripoReq('/task', 'POST', taskBody);
  return { ok: true, taskId: res.data.task_id, status: 'queued', prompt };
}
