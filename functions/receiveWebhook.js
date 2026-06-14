import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
// Inbound webhook handler — receives build_status, agent_task, chat_response payloads
// Full source in Base44 dashboard → Code → Functions → receiveWebhook
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Token' } });
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { type, agentId, agentName, status, progress, currentTask, buildLog, buildDuration } = body;
    if (type === 'build_status') {
      const buildStatusList = await base44.asServiceRole.entities.BuildStatus.list();
      const buildRecord = buildStatusList[0];
      const data = { status: status || 'idle', lastUpdated: new Date().toISOString(), buildLog: buildLog || '', buildDuration: buildDuration || 0 };
      if (buildRecord) await base44.asServiceRole.entities.BuildStatus.update(buildRecord.id, data);
      else await base44.asServiceRole.entities.BuildStatus.create(data);
      if (status === 'success' || status === 'failed') {
        await base44.asServiceRole.entities.BuildHistory.create({ status, commitSha: body.commitSha || '', commitMessage: body.commitMessage || '', duration: buildDuration || null, buildLog: (buildLog || '').slice(0, 2000), triggeredBy: body.triggeredBy || 'OdysseusLocal' });
      }
      return Response.json({ success: true, type: 'build_status', status });
    }
    if (type === 'agent_task' || agentId) {
      const existing = await base44.asServiceRole.entities.AgentTask.filter({ agentId });
      if (existing && existing.length > 0) await base44.asServiceRole.entities.AgentTask.update(existing[0].id, { agentName: agentName || existing[0].agentName, status: status || 'idle', progress: progress !== undefined ? progress : existing[0].progress, currentTask: currentTask || existing[0].currentTask, lastUpdated: new Date().toISOString() });
      else await base44.asServiceRole.entities.AgentTask.create({ agentId, agentName: agentName || 'Unknown Agent', status: status || 'running', progress: progress || 0, currentTask: currentTask || 'Initializing...', lastUpdated: new Date().toISOString() });
      if (status === 'success' || status === 'error') await base44.asServiceRole.entities.AgentTaskLog.create({ agentId, agentName: agentName || 'Unknown Agent', agentIcon: body.agentIcon || '', taskDescription: currentTask || 'Task completed', status, duration: body.duration || null, completedAt: new Date().toISOString() });
      return Response.json({ success: true, type: 'agent_task', agentId, status });
    }
    if (type === 'chat_response') { await base44.asServiceRole.entities.ChatMessage.create({ role: 'assistant', content: body.content || '[No response content]' }); return Response.json({ success: true, type: 'chat_response' }); }
    return Response.json({ error: 'Unknown type' }, { status: 400 });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
});
