<p align="center">
  <img src="https://raw.githubusercontent.com/pigeonthroat-hash/Spectrum/main/src/assets/logo.png" alt="Spectrum Logo" width="140" />
</p>

<h1 align="center">Spectrum</h1>

<p align="center">
  <strong>An AI-native code editor built around free &amp; local models</strong><br>
  Monaco · Agent tools · Inline diffs · WebLLM · Ollama · Groq · OpenRouter
</p>


<p align="center">
<a href="https://pigeonthroat-hash.github.io/Spectrum/">
  <img src="https://img.shields.io/badge/LIVE%20DEMO-555555?style=for-the-badge&logo=github&logoColor=white&labelColor=555555" alt="Live Demo" />
</a>
  <a href="https://github.com/pigeonthroat-hash/Spectrum/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT" />
  </a>
  <img src="https://img.shields.io/badge/Version-0.1.0-3fb950?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Status-Beta-yellow?style=for-the-badge" alt="Beta" />
</p>

---

## Why Spectrum?

Most AI coding tools lock you into expensive cloud models or complex local setups.  
**Spectrum** is designed from the ground up to make high-quality AI coding accessible:

- Run powerful models **entirely in the browser** (WebLLM + WebGPU)
- Use **Ollama** for fully private local inference
- Fall back to free cloud endpoints (Groq, OpenRouter free tier)
- Full agentic editing with reviewable diffs
- Clean, dark, VS Code / Cursor-inspired UI that works on desktop **and** mobile

> Spectrum is currently in **public beta (v0.1)**. Core editing + AI workflows are solid; deeper filesystem, terminal, and indexing features are on the roadmap.

---

## Live Demo

**Try it right now (no install):**  
[https://pigeonthroat-hash.github.io/Spectrum/](https://pigeonthroat-hash.github.io/Spectrum/)

Browser models download on first use and are cached by your browser.

---

## Core Features

### Editor & Workspace
| Feature | Details |
|---------|---------|
| **3-panel layout** | File Explorer · Monaco Editor · AI Sidebar |
| **Monaco Editor** | Full syntax highlighting, multi-tab, dirty state, language detection |
| **Inline Diffs** | Green/red Monaco DiffEditor with Accept / Reject / Accept All |
| **Auto-Apply** | Optional automatic application of agent changes |
| **Drag & Drop** | Files & folders into the explorer |
| **Image Viewer** | Built-in preview for common image formats |
| **Python in browser** | Pyodide support + agent can execute Python |
| **Mobile layout** | Dedicated mobile view modes (Explorer / Editor / Chat) |
| **Resizable & dockable panels** | Drag to swap left/right panels, collapse, maximize |

### AI Capabilities
| Mode | Behavior |
|------|----------|
| **Agent** | Full tool-using agent that can explore, edit, and create files |
| **Plan** | Writes a numbered plan only — no code or tool calls |
| **Debug** | Finds likely root cause + suggests one minimal fix |
| **Ask** | Pure Q&A — never proposes or makes file edits |

**Agent Tools** (available in Agent mode):
- `list_files` — project file tree
- `read_file` — read specific lines or whole file
- `search_files` — text search across project
- `create_file` — create new files only
- `edit_file` — precise find/replace (exact match required)
- `write_file` — full file rewrite (still goes through review)
- `remember` / `forget` — persistent notes across chats
- Python execution block (`<python>...</python>`)

All file-modifying actions produce a **reviewable diff** unless Auto-Apply is enabled.

### Model Providers (Free-first)
| Provider | Models | Notes |
|----------|--------|-------|
| **Browser (WebLLM)** | Llama 3.2 1B / 3B, Phi-3.5 mini, Gemma 4 E4B (experimental) | Runs 100% in-browser via WebGPU. Models cached after first download. |
| **Ollama** | Gemma 2/4 (E2B–31B), Qwen2.5-Coder 7B, DeepSeek Coder V2 16B + any you pull | Fully local & private |
| **Groq** | GPT-OSS 20B / 120B | Extremely fast cloud inference (free API key) |
| **OpenRouter** | All currently free models | Live-fetched list of `$0` models only |

Default model on first launch: `Llama 3.2 3B` (browser).

---

## Screenshots / UI Highlights

- Dark GitHub-inspired theme (`#0d1117` / `#161b22`)
- Top bar with logo, version badge, panel toggles, account & settings
- Status bar showing save state + “Free models enabled”
- Chat styles: Classic or Liquid
- Keyboard shortcuts fully supported

---

## Quick Start

### 1. Web Development (recommended)

```bash
git clone https://github.com/pigeonthroat-hash/Spectrum.git
cd Spectrum
npm install
npm run dev
```

Open → [http://localhost:5173](http://localhost:5173)

### 2. Electron (desktop with filesystem access)

```bash
npm run electron:dev
```

### 3. Optional: Supabase (cloud projects + auth)

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
```

Restart the dev server. Account button + Cloud Projects panel become available.

### 4. Production Build

```bash
npm run build          # standard
npm run build:gh       # for GitHub Pages (correct base path)
npm run electron:build # packaged desktop app
```

---

## Deploy to GitHub Pages

```bash
npm install
npm run deploy
```

Then in your repository:
**Settings → Pages → Source: Deploy from a branch → `gh-pages` / root**

Your site will be live at:  
`https://YOUR_USERNAME.github.io/Spectrum/`

> If the repo name is different, update the `base` path in `vite.config.ts`.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + B` | Toggle File Explorer |
| `Ctrl/Cmd + Alt + B` | Toggle AI Sidebar |
| (More coming) | — |

---

## Architecture Overview

```
src/
├── components/          # UI layer (FileExplorer, CodeEditor, AISidebar, InlineDiff…)
├── lib/
│   ├── ai/              # WebLLM engine + streaming
│   ├── agent/           # Tool execution, protocol, memory, auto-apply, decisions
│   ├── providers/       # Ollama, Groq, OpenAI-compatible clients
│   ├── files/           # Storage abstraction
│   ├── storage/         # Local + cloud backends
│   ├── python/          # Pyodide integration
│   └── tools/           # Extensible tool registry
├── store/               # Zustand (persisted settings + runtime state)
electron/                # Desktop main + preload
supabase/                # Optional backend schema
```

**State management:** Zustand with selective persistence (model, panel sizes, layout preferences).  
**Storage:** Abstracted backend — local by default, Supabase for cloud projects.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 19 + TypeScript |
| Editor | Monaco Editor |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| AI (browser) | `@mlc-ai/web-llm` |
| AI (local) | Ollama |
| AI (cloud) | Groq / OpenRouter |
| Desktop | Electron 34 |
| Backend (optional) | Supabase |
| Python | Pyodide |
| Build | Vite 8 + TypeScript |

---

## Roadmap

### Near-term
- [ ] Native filesystem access via Electron IPC
- [ ] Integrated terminal (xterm.js + node-pty)
- [ ] Codebase indexing + `@file` / `@folder` mentions
- [ ] Tab autocomplete
- [ ] Multi-file agent tools & planning
- [ ] Rules / `AGENTS.md` support

### Longer-term
- [ ] Diff history & undo stack improvements
- [ ] Custom model endpoints
- [ ] Plugin / tool marketplace
- [ ] Collaborative editing

---

## Contributing

Spectrum is open source and early-stage. Contributions, bug reports, and feature ideas are very welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-thing`)
3. Commit your changes
4. Open a Pull Request

Please keep the free/local-first philosophy in mind.

---

## License

MIT License © 2026 [pigeonthroat-hash](https://github.com/pigeonthroat-hash)

---

<p align="center">
  Built with ❤️ for free and open AI coding tools.<br>
  <em>Run models on your machine. Own your workflow.</em>
</p>
