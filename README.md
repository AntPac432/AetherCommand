# AetherCommand

**Game Director Command Center** — autonomous AI agent orchestration for Unreal Engine 5 game development.

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + Framer Motion
- **Backend:** Base44 (serverless functions, entity DB, auth)
- **AI:** OpenRouter (GPT-4o / Claude 3.5 Sonnet), Groq
- **3D:** Tripo3D (text-to-GLB mesh generation)
- **Images:** StabilityAI (texture & concept art generation)
- **VCS:** GitHub API (commit feed, file browser, live SHA)

## Agents

| Agent | Role |
|-------|------|
| Odysseus | Main AI orchestrator — routes commands to the fleet |
| Host | Local machine agent (shell, git, file writes via ngrok) |
| Tripo3D | AI 3D mesh generation |
| Cursor | Code auditor |
| ElevenLabs | Voice / NPC dialogue generation |
| StabilityAI | Texture & concept art generation |

## Quick Start

```bash
git clone https://github.com/AntPac432/AetherCommand
cd AetherCommand
npm install

# Copy and fill in your env vars
cp .env.example .env

npm run dev
```

Open http://localhost:5173

## Architecture

```
src/
  pages/          # Top-level route pages
  components/
    chat/         # Director's Console (chat UI, typewriter, voice, macros)
    tasktree/     # Agent Fleet sidebar (lanes, logs, task tree)
    vault/        # GitHub commit feed & build history
    assets/       # Asset library (GLB, textures, audio)
    files/        # Remote file browser
    layout/       # AppShell, SystemClock
    settings/     # Settings modal
    presence/     # Who's Online
    ue5/          # UE5 control panel
  functions/      # Base44 backend (serverless Deno)
    sendMcpCommand.js   — Odysseus AI + local agent routing
    githubOps.js        — GitHub API operations
    tripo3d.js          — Tripo3D mesh generation
    receiveWebhook.js   — Inbound webhook handler
```

## Desktop App (Tauri)

To package as a native .exe / .dmg:

```bash
npm install --save-dev @tauri-apps/cli
npx tauri init
npx tauri build
```

## License

MIT
