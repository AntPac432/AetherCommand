import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Zap, Activity } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import AppShell from '@/components/layout/AppShell';
import SystemClock from '@/components/layout/SystemClock';
import TaskTree from '@/components/tasktree/TaskTree';
import DirectorChat from '@/components/chat/DirectorChat';
import VaultFeed from '@/components/vault/VaultFeed';
import SettingsModal from '@/components/settings/SettingsModal';
import TaskLogPanel from '@/components/tasktree/TaskLogPanel';
import UE5Panel from '@/components/ue5/UE5Panel';
import WhoIsOnline from '@/components/presence/WhoIsOnline';
import AssetLibraryPanel from '@/components/assets/AssetLibraryPanel';
import BuildHistoryPanel from '@/components/vault/BuildHistoryPanel';
import FileBrowserPanel from '@/components/files/FileBrowserPanel';

function BuildMonitor({ buildStatus }) {
  const status = buildStatus?.status || 'idle';
  const cfgMap = {
    idle:     { color: '#2A2A3A', label: 'IDLE',     glow: 'none' },
    building: { color: '#00EEFF', label: 'BUILDING', glow: '0 0 10px rgba(0,238,255,0.2)' },
    success:  { color: '#3DFF5C', label: 'SUCCESS',  glow: '0 0 10px rgba(61,255,92,0.2)'  },
    failed:   { color: '#FF2D55', label: 'FAILED',   glow: '0 0 10px rgba(255,45,85,0.2)'  },
  };
  const cfg = cfgMap[status] || cfgMap.idle;
  return (
    <div className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.04)', boxShadow: cfg.glow }}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${status === 'building' ? 'animate-pulse-glow' : ''}`} style={{ backgroundColor: cfg.color, boxShadow: status !== 'idle' ? `0 0 6px ${cfg.color}` : 'none' }} />
        <span className="font-orbitron text-[8px] font-bold tracking-[0.18em]" style={{ color: cfg.color }}>BUILD · {cfg.label}</span>
      </div>
      <div className="flex items-center gap-3">
        {buildStatus?.buildDuration != null && <span className="font-mono text-[7px]" style={{ color: '#2A2A3A' }}>{buildStatus.buildDuration}s</span>}
        {buildStatus?.lastUpdated && <span className="font-mono text-[7px]" style={{ color: '#2A2A3A' }}>{new Date(buildStatus.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
    </div>
  );
}

const SETTINGS_KEY = 'gdcc_settings';
function loadSettings() { try { const raw = localStorage.getItem(SETTINGS_KEY); return raw ? JSON.parse(raw) : { mcpEndpoint: '', webhookToken: '', githubPollInterval: '60' }; } catch { return { mcpEndpoint: '', webhookToken: '', githubPollInterval: '60' }; } }
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

const DEFAULT_AGENTS = [
  { name: 'Odysseus', icon: 'brain', description: 'Main AI — OpenRouter multi-model (GPT-4o / Claude 3.5). Commands the fleet.', endpointUrl: '', isDefault: true, sortOrder: 0 },
  { name: 'Host', icon: 'local', description: 'odysseus_agent.py on your machine — shell, build, git, file writes', endpointUrl: 'https://pushcart-silica-slackness.ngrok-free.app', isDefault: true, sortOrder: 1 },
  { name: 'Tripo3D', icon: 'tripo', description: 'AI 3D mesh generation — text to game-ready GLB meshes', endpointUrl: '', isDefault: true, sortOrder: 2 },
  { name: 'Cursor', icon: 'cursor', description: 'Code auditor — reviews & validates code before GitHub push', endpointUrl: '', isDefault: true, sortOrder: 3 },
  { name: 'ElevenLabs', icon: 'brain', description: 'AI voice generation — NPC dialogue, narration, ambient audio', endpointUrl: '', isDefault: true, sortOrder: 4 },
  { name: 'StabilityAI', icon: 'brain', description: 'AI image generation — textures, concept art, UI sprites, skyboxes', endpointUrl: '', isDefault: true, sortOrder: 5 },
];

const RIGHT_TABS = [
  { id: 'vault', label: 'VAULT', color: '#C84BFF', glow: 'rgba(200,75,255,0.3)' },
  { id: 'assets', label: 'ASSETS', color: '#00EEFF', glow: 'rgba(0,238,255,0.3)' },
  { id: 'files', label: 'FILES', color: '#3DFF5C', glow: 'rgba(61,255,92,0.3)' },
  { id: 'buildlog', label: 'BUILDS', color: '#FFB800', glow: 'rgba(255,184,0,0.3)' },
];

export default function CommandCenter() {
  const qc = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [appSettings, setAppSettings] = useState(loadSettings);
  const [rightTab, setRightTab] = useState(() => localStorage.getItem('gdcc_rightTab') || 'vault');
  const setRightTabPersist = useCallback((tab) => { setRightTab(tab); localStorage.setItem('gdcc_rightTab', tab); }, []);
  const vaultRefetchRef = useRef(null);
  const [hostOnline, setHostOnline] = useState(null);

  useEffect(() => {
    const check = async () => {
      try { const res = await base44.functions.invoke('sendMcpCommand', { checkAgentStatus: true }); setHostOnline(res.data?.online === true); }
      catch { setHostOnline(false); }
    };
    check();
    const interval = setInterval(check, 45000);
    return () => clearInterval(interval);
  }, []);

  const { data: latestCommit } = useQuery({ queryKey: ['latestCommitSha'], queryFn: async () => { const res = await base44.functions.invoke('githubOps', { action: 'get_commits', perPage: 1 }); const commits = res.data?.result; return Array.isArray(commits) && commits[0]?.sha ? commits[0].sha.slice(0, 7) : null; }, refetchInterval: 30000, staleTime: 30000 });
  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list('sortOrder', 50), staleTime: 30000, refetchInterval: 30000 });

  useEffect(() => {
    (async () => {
      const list = await base44.entities.Agent.list('sortOrder', 50);
      const seen = new Map(); const toDelete = [];
      for (const a of list) { if (seen.has(a.name)) toDelete.push(a.id); else seen.set(a.name, a); }
      if (toDelete.length > 0) await Promise.all(toDelete.map(id => base44.entities.Agent.delete(id)));
      const existingNames = [...seen.keys()];
      const missing = DEFAULT_AGENTS.filter(d => !existingNames.includes(d.name));
      if (missing.length > 0) { await Promise.all(missing.map(a => base44.entities.Agent.create(a))); qc.invalidateQueries({ queryKey: ['agents'] }); }
    })();
  }, []);

  const createAgentMutation = useMutation({ mutationFn: (data) => base44.entities.Agent.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }) });
  const prevTaskStatusRef = useRef({});
  const { data: agentTasks = [] } = useQuery({ queryKey: ['agentTasks'], queryFn: async () => { const tasks = await base44.entities.AgentTask.list('-lastUpdated', 50); const seen = new Map(); for (const t of tasks) { if (!seen.has(t.agentName)) seen.set(t.agentName, t); } return [...seen.values()]; }, refetchInterval: 15000 });

  useEffect(() => {
    for (const task of agentTasks) {
      const prev = prevTaskStatusRef.current[task.agentName];
      if (prev && prev !== task.status) {
        if (task.status === 'success') toast.success(`${task.agentName} completed`, { description: task.currentTask || '', duration: 4000 });
        else if (task.status === 'error') toast.error(`${task.agentName} failed`, { description: task.currentTask || '', duration: 5000 });
      }
      prevTaskStatusRef.current[task.agentName] = task.status;
    }
  }, [agentTasks]);

  const [messages, setMessages] = useState([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  useEffect(() => {
    let unsub;
    base44.entities.ChatMessage.list('created_date', 100).then(initial => { setMessages(initial); setMessagesLoaded(true); });
    unsub = base44.entities.ChatMessage.subscribe((event) => {
      if (event.type === 'create') setMessages(prev => [...prev, event.data]);
      else if (event.type === 'update') setMessages(prev => prev.map(m => m.id === event.id ? event.data : m));
      else if (event.type === 'delete') setMessages(prev => prev.filter(m => m.id !== event.id));
    });
    return () => unsub && unsub();
  }, []);

  const handleNewMessage = useCallback(async (msg) => { await base44.entities.ChatMessage.create(msg); }, []);
  const { data: buildStatusList = [] } = useQuery({ queryKey: ['buildStatus'], queryFn: () => base44.entities.BuildStatus.list('-lastUpdated', 1), refetchInterval: 20000 });
  const buildStatus = buildStatusList[0] || null;
  const { data: taskLogs = [] } = useQuery({ queryKey: ['agentTaskLogs'], queryFn: () => base44.entities.AgentTaskLog.list('-created_date', 100), refetchInterval: 30000 });
  const deleteTaskLogMutation = useMutation({ mutationFn: (id) => base44.entities.AgentTaskLog.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['agentTaskLogs'] }) });
  const clearTaskLogs = useCallback(async () => { await Promise.all(taskLogs.map((l) => base44.entities.AgentTaskLog.delete(l.id))); qc.invalidateQueries({ queryKey: ['agentTaskLogs'] }); qc.invalidateQueries({ queryKey: ['agentTasks'] }); }, [taskLogs, qc]);
  const deleteAgentMutation = useMutation({ mutationFn: (id) => base44.entities.Agent.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }) });
  const handleAddAgent = useCallback((agentData) => { createAgentMutation.mutate({ ...agentData, isDefault: false, sortOrder: agents.length }); }, [agents.length]);
  const handleDeleteAgent = useCallback((id) => { deleteAgentMutation.mutate(id); }, []);
  const handleSaveSettings = useCallback((s) => { setAppSettings(s); saveSettings(s); }, []);
  const pollInterval = useMemo(() => parseInt(appSettings.githubPollInterval || '60', 10) * 1000, [appSettings.githubPollInterval]);

  return (
    <div style={{ backgroundColor: '#04040A', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Top header */}
      <div className="flex items-center justify-between px-5 flex-shrink-0" style={{ background: 'linear-gradient(90deg, #060D12 0%, #060610 40%, #0B0812 100%)', borderBottom: '1px solid rgba(0,238,255,0.14)', boxShadow: '0 1px 0 rgba(0,238,255,0.05), 0 8px 40px rgba(0,0,0,0.85)', height: '56px', minHeight: '56px' }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg animate-pulse-glow-cyan" style={{ background: 'linear-gradient(135deg, rgba(0,238,255,0.15), rgba(0,238,255,0.05))', border: '1px solid rgba(0,238,255,0.4)', boxShadow: '0 0 20px rgba(0,238,255,0.2)' }}>
              <Zap size={16} style={{ color: '#00EEFF', filter: 'drop-shadow(0 0 6px rgba(0,238,255,0.8))' }} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-orbitron text-[13px] font-bold tracking-[0.22em] animate-flicker leading-none" style={{ color: '#00EEFF', textShadow: '0 0 16px rgba(0,238,255,0.8), 0 0 48px rgba(0,238,255,0.25)' }}>GAME DIRECTOR</span>
              <span className="font-mono text-[8px] tracking-[0.4em] uppercase leading-none" style={{ color: 'rgba(0,238,255,0.35)' }}>APOTHIC · COMMAND CENTER</span>
            </div>
          </div>
          <div className="h-7 w-px mx-1" style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,245,255,0.22), transparent)' }} />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: latestCommit ? 'rgba(61,255,92,0.06)' : 'rgba(0,0,0,0.4)', border: `1px solid ${latestCommit ? 'rgba(61,255,92,0.28)' : 'rgba(255,255,255,0.05)'}` }}>
            <div className={latestCommit ? 'animate-pulse-glow' : ''} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: latestCommit ? '#3DFF5C' : '#1E1E2A', boxShadow: latestCommit ? '0 0 8px #3DFF5C' : 'none', flexShrink: 0 }} />
            <span className="font-mono text-[9px] tracking-wider font-semibold" style={{ color: latestCommit ? '#3DFF5C' : '#3A3A4A' }}>{latestCommit ? `SHA · ${latestCommit}` : 'NO SYNC'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SystemClock />
          <div className="h-5 w-px mx-1" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)' }} />
          <WhoIsOnline />
          <div className="h-5 w-px" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)' }} />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: 'rgba(200,75,255,0.08)', border: '1px solid rgba(200,75,255,0.22)', boxShadow: '0 0 12px rgba(200,75,255,0.08)' }}>
            <Activity size={10} style={{ color: '#C84BFF', filter: 'drop-shadow(0 0 4px rgba(200,75,255,0.6))' }} />
            <span className="font-orbitron text-[9px] font-bold tracking-widest" style={{ color: '#C84BFF', textShadow: '0 0 10px rgba(200,75,255,0.5)' }}>{agents.length} AGENTS</span>
          </div>
          <div className="h-5 w-px" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)' }} />
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-4 py-1.5 rounded-md transition-all" style={{ background: 'rgba(0,238,255,0.06)', border: '1px solid rgba(0,238,255,0.25)', color: '#00EEFF' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,238,255,0.14)'; e.currentTarget.style.borderColor = 'rgba(0,238,255,0.6)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,238,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,238,255,0.25)'; }}>
            <Settings size={12} style={{ filter: 'drop-shadow(0 0 4px rgba(0,238,255,0.5))' }} />
            <span className="font-orbitron text-[9px] font-bold tracking-widest">SETTINGS</span>
          </button>
        </div>
      </div>
      <div style={{ height: 'calc(100vh - 56px)' }}>
        <AppShell
          left={<TaskTree agents={agents} agentTasks={agentTasks} hostOnline={hostOnline} onAddAgent={handleAddAgent} onDeleteAgent={handleDeleteAgent} />}
          center={<DirectorChat messages={messages} messagesLoaded={messagesLoaded} onNewMessage={handleNewMessage} agents={agents} assets={[]} templates={[]} />}
          right={
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center flex-shrink-0" style={{ background: 'linear-gradient(90deg, #0F0A18 0%, #0C0A14 100%)', borderBottom: '1px solid rgba(200,75,255,0.16)', padding: '0 4px', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                {RIGHT_TABS.map(tab => { const active = rightTab === tab.id; return (
                  <button key={tab.id} onClick={() => setRightTabPersist(tab.id)} className="flex-1 py-2.5 font-orbitron text-[8px] font-semibold tracking-[0.18em] transition-all relative" style={{ color: active ? tab.color : '#2E2E40', backgroundColor: active ? `${tab.color}10` : 'transparent', borderBottom: active ? `2px solid ${tab.color}` : '2px solid transparent', textShadow: active ? `0 0 10px ${tab.glow}` : 'none' }}>{tab.label}</button>
                ); })}
              </div>
              <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {rightTab === 'vault' && <VaultFeed pollInterval={pollInterval} refetchRef={vaultRefetchRef} />}
                {rightTab === 'assets' && <AssetLibraryPanel />}
                {rightTab === 'files' && <FileBrowserPanel />}
                {rightTab === 'buildlog' && <BuildHistoryPanel />}
              </div>
              <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(200,75,255,0.25), rgba(0,238,255,0.15), transparent)', flexShrink: 0 }} />
              <div className="flex-shrink-0"><UE5Panel /><BuildMonitor buildStatus={buildStatus} /></div>
              <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(57,255,20,0.2), transparent)', flexShrink: 0 }} />
              <div style={{ height: '180px', flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <TaskLogPanel logs={taskLogs} agents={agents} onClearLogs={clearTaskLogs} onDeleteLog={(id) => deleteTaskLogMutation.mutate(id)} />
              </div>
            </div>
          }
        />
      </div>
      {showSettings && <SettingsModal settings={appSettings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
