# AetherCommand — Standalone

Game Director Command Center. **No Base44 required.** Runs 100% locally.

## Stack
- **Frontend:** React 18 + Vite + Tailwind CSS + Framer Motion
- **Backend:** Node.js + Express (replaces Base44 functions)
- **DB:** SQLite via better-sqlite3 (replaces Base44 entities)
- **AI:** OpenRouter (GPT-4o / Claude), Groq (fast routing)
- **3D:** Tripo3D, **Images:** StabilityAI, **Voice:** ElevenLabs

## Quick start

```bash
git clone https://github.com/AntPac432/AetherCommand
cd AetherCommand
cp .env.example .env          # fill in your API keys
npm install
npm run dev                   # starts Vite (port 5173) + Express (port 3001)
```

## .env keys
| Key | Where to get it |
|---|---|
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| `GROQ_API_KEY` | https://console.groq.com/keys |
| `GITHUB_TOKEN` | GitHub → Settings → Developer settings → PAT |
| `TRIPO3D_API_KEY` | https://platform.tripo3d.ai |
| `STABILITY_API_KEY` | https://platform.stability.ai |
| `GOOGLE_API_KEY` | Google AI Studio → API keys |
| `ELEVENLABS_API_KEY` | https://elevenlabs.io/app/settings/api-keys |
| `WEBHOOK_TOKEN` | Any random string you choose |

## Desktop app (Tauri)
```bash
npm install --save-dev @tauri-apps/cli
npx tauri init
npx tauri build
```
