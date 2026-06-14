import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
const TRIPO_BASE = 'https://api.tripo3d.ai/v2/openapi';
async function tripoRequest(path, method = 'GET', body = null) {
  const apiKey = Deno.env.get('TRIPO3D_API_KEY');
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${TRIPO_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(`Tripo3D API error ${res.status}: ${JSON.stringify(data)}`);
  return data;
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { prompt, checkStatus, taskId, refineTaskId, deleteTaskId } = await req.json();
    if (checkStatus && taskId) {
      const result = await tripoRequest(`/task/${taskId}`);
      const task = result.data;
      if (task.status === 'success') { const modelUrl = task.output?.model || task.output?.pbr_model || ''; return Response.json({ ok: true, status: 'success', modelUrl, taskId }); }
      if (task.status === 'failed' || task.status === 'cancelled') return Response.json({ ok: false, status: task.status, taskId });
      return Response.json({ ok: true, status: task.status, progress: task.progress || 0, taskId });
    }
    if (deleteTaskId) return Response.json({ ok: true, deleted: deleteTaskId });
    if (!prompt) return Response.json({ error: 'prompt is required' }, { status: 400 });
    const taskBody = refineTaskId
      ? { type: 'refine_draft', draft_model_task_id: refineTaskId, prompt, model_version: 'v2.5-20250123', face_limit: 10000, texture: true, pbr: true }
      : { type: 'text_to_model', prompt, model_version: 'v2.5-20250123', face_limit: 10000, texture: true, pbr: true, quad: false };
    const submitResult = await tripoRequest('/task', 'POST', taskBody);
    const newTaskId = submitResult.data.task_id;
    return Response.json({ ok: true, taskId: newTaskId, status: 'queued', prompt });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
});
