# AetherCommand

**Game Director Command Center** — autonomous AI agent orchestration for Unreal Engine 5 development.

## Quick Start

```bash
git clone https://github.com/AntPac432/AetherCommand
cd AetherCommand
cp .env.example .env          # fill in VITE_BASE44_APP_ID
npm install
npm run dev
```

Open http://localhost:5173

## Stack
- **Frontend:** React 18 + Vite + Tailwind CSS + Framer Motion
- **Backend:** Base44 (serverless Deno functions, entity DB, auth)
- **AI:** OpenRouter (GPT-4o / Claude 3.5), Groq (fast routing)
- **3D:** Tripo3D (text-to-GLB mesh generation)
- **Images:** StabilityAI (texture & concept art)
- **VCS:** GitHub API (commit feed, file browser)

## Agents
| Agent | Role |
|---|---|
| Odysseus | Main AI orchestrator — routes commands to the fleet |
| Host | Local PC agent (shell, git, builds via ngrok) |
| Tripo3D | AI 3D mesh generation |
| Cursor | Code auditor |
| ElevenLabs | Voice / NPC dialogue |
| StabilityAI | Texture & concept art |

## Desktop App (Tauri)
```bash
npm install --save-dev @tauri-apps/cli
npx tauri init
npx tauri build    # produces .exe / .dmg / .deb
```
