<p align="center">
  <img src="https://raw.githubusercontent.com/pigeonthroat-hash/Spectrum/main/src/assets/logo.png" alt="Spectrum Logo" width="140" />
</p>

<h1 align="center">Spectrum</h1>

<p align="center">
  <strong>An AI-native code editor built around free &amp; local models</strong><br>
  Monaco · Agent tools · Per-change review · WebLLM · Ollama · Groq · OpenRouter
</p>

<p align="center">
<a href="https://pigeonthroat-hash.github.io/Spectrum/">
  <img src="https://img.shields.io/badge/LIVE%20DEMO-555555?style=for-the-badge&logo=github&logoColor=white&labelColor=555555" alt="Live Demo" />
</a>
  <a href="https://github.com/pigeonthroat-hash/Spectrum/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT" />
  </a>
  <img src="https://img.shields.io/badge/Version-0.1.0-f0a93b?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Status-Beta-yellow?style=for-the-badge" alt="Beta" />
</p>

---

## Why Spectrum?

Most AI coding tools lock you into expensive cloud models or complex local setups.
**Spectrum** is built to make high-quality AI coding accessible:

- Run models **entirely in the browser** (WebLLM + WebGPU)
- Use **Ollama** for fully private local inference
- Use free cloud endpoints (**Groq**, OpenRouter free models)
- Full agentic editing, where every change is reviewed before it lands
- A calm, warm dark interface that works on desktop and mobile

> Spectrum is in **public beta (v0.1)**. Editing, the agent, per-change review, and saved chats are working. Terminal, Git, codebase indexing, and the Composer and Bug Finder tabs are still to come.

---

## Live Demo

**Try it now, no install:** [https://pigeonthroat-hash.github.io/Spectrum/](https://pigeonthroat-hash.github.io/Spectrum/)

Browser models download on first use and are cached by your browser.

---

## Core Features

### Workspace & Editor

| Feature | Details |
|---------|---------|
| **Three-panel layout** | Explorer · Monaco editor · Chat, with a bottom output panel under the editor |
| **Workspaces** | Cloud projects (Supabase) or a local workspace. Opening one unlocks the file tools. |
| **Monaco editor** | Syntax highlighting, multiple tabs, unsaved-change markers, language detection. Bundled with the app, so it doesn't depend on a CDN. |
| **Per-change review** | Accept or reject one change at a time, with a floating bar showing `1/4`, previous/next, Reject and Accept |
| **Whole-file review** | Keep All / Undo All for every pending change at once |
| **Hidden folders** | Folders starting with a dot (such as `.spectrum/`) are kept out of the explorer and the `@` menu |
| **Output panel** | Runs Python and shows its output |
| **Python in the browser** | Pyodide, served from this site. Scripts can read project files with `open()`. Changes go through review. |
| **Image viewer** | Built-in preview for common image formats |
| **Panels** | Resize, collapse, close, and swap sides. Panels slide in and out. |

### Chat

| Feature | Details |
|---------|---------|
| **Modes** | **Agent** (uses tools and edits files), **Plan** (a numbered plan only), **Debug** (likely cause plus one minimal fix), **Ask** (questions only, no edits) |
| **No workspace?** | Only **Ask** is available. The agent can create a workspace if you ask for one, and then opens it. |
| **Saved chats** | Each chat is saved in the workspace, in a hidden `.spectrum/chats/` folder. The chat list has a Sessions view, and past chats appear when a chat is empty. |
| **Chat aging** | After 2 weeks, tool output is removed. After 1 month, a chat is reduced to a summary. After 6 months, it's deleted. This runs when a workspace opens. |
| **To-dos** | The agent can keep a short list for multi-step tasks, with a "N of M completed" count |
| **Review card** | Under each reply that changed files: one row per file with `+N −M`, and a Review link |
| **Used files** | The files a reply read are listed at the end of the reply |
| **Steps** | Tool calls are grouped as "Completed N steps", closed by default |
| **Run approval** | Before Python runs, you choose: Run once, Run for this message, Run for this session, Always run, or Decline |
| **Attachments** | `@` mentions and Add Context attach files. They show as chips on your message. |
| **Dictation** | The microphone button turns speech into text. Works in Chrome and Edge. |
| **Stop** | Stops a reply, and cancels any run waiting for approval |
| **Chat style** | **Classic** (flat box) or **Liquid glass** (see below) |

#### Liquid glass chat box

In Liquid mode, the chat's input box is a glass pane. The library is [`@ybouane/liquidglass`](https://github.com/ybouane/liquidglass) (MIT). It bends the messages behind the box, and it can be dragged anywhere on screen.

- **Inside the panel**, the glass bends the messages behind it.
- **Outside the panel**, there's nothing to bend, so the box shows as a dark overlay with a faint glass rim.
- **Dragging:** hold the empty row above the `+`. Let go within about 40px of where it started, and it glides back into place.
- Classic and Liquid use the same scrolling and layout. Only the look of the box differs.

> The top bar's search pill is still a plain bar. Liquid glass there is planned.

### Agent Tools

Available in Agent mode when a workspace is open:

- `list_files`: the project file tree
- `read_file`: read a whole file, or specific lines
- `search_files`: text search across the project
- `create_file`: create a new file (goes through review)
- `edit_file`: exact find-and-replace (goes through review)
- `write_file`: full rewrite, or a new file (goes through review)
- `set_todos`: keep a to-do list for multi-step work
- `create_workspace`: create and open a workspace, only when you ask for one
- `remember` / `forget`: notes that persist for the project
- `run_python`: run Python code (asks first, unless you've chosen to always run)

Every file change is a **reviewable diff** unless **Apply Automatically** is on.

### Settings

- **Apply Automatically Forever:** apply proposed edits and new files without asking
- **Run Automatically Forever:** run code without asking. The same setting as the Run menu.
- **Chat box style:** Classic or Liquid glass
- **Models:** the default model, and browser models
- **Memory:** view, edit, and delete the notes the AI saved for this project
- **Shortcuts:** a list of the keyboard shortcuts below

### Model Providers (free-first)

| Provider | Models | Notes |
|----------|--------|-------|
| **Browser (WebLLM)** | Llama 3.2 1B / 3B, Phi-3.5 mini, Gemma 4 E4B (experimental) | Runs in the browser with WebGPU. Cached after the first download. |
| **Ollama** | Gemma, Qwen2.5-Coder, DeepSeek Coder, and any model you pull | Fully local and private |
| **Groq** | GPT-OSS 20B / 120B | Fast cloud inference. Needs a free key and sign-in. Requests are limited per day. |
| **OpenRouter** | Free models | Live list of models priced at $0 |

Default model on first launch: `Llama 3.2 3B` (browser).

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + B` | Toggle the explorer |
| `Ctrl + Alt + B` | Toggle the chat |
| `Ctrl + S` | Save the file |
| `Ctrl + Enter` | Accept the current change |
| `Ctrl + Backspace` | Reject the current change |
| `Alt + ↓` | Next change |
| `Alt + ↑` | Previous change |

The change shortcuts work while a file is under review, and they're ignored while you type in the chat.

---

## Quick Start

### 1. Web development (recommended)

```bash
git clone https://github.com/pigeonthroat-hash/Spectrum.git
cd Spectrum
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

`npm install` also sets up the Python runtime. The `predev` and `prebuild` steps copy Pyodide from `node_modules/pyodide` into `public/pyodide`. That folder is generated, so it isn't committed.

### 2. Optional: Supabase (cloud projects and sign-in)

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
```

Restart the dev server. The account button and Cloud Projects become available.

### 3. Production build

```bash
npm run build          # standard
npm run build:gh       # for GitHub Pages (correct base path)
npm run electron:build # packaged desktop app
```

### 4. Electron (desktop)

```bash
npm run electron:dev
```

The Electron shell is in place. Native filesystem and terminal access are still on the roadmap.

---

## Deploy to GitHub Pages

```bash
npm install
npm run deploy
```

Then in your repository: **Settings → Pages → Source: Deploy from a branch → `gh-pages` / root**.

Your site will be at `https://YOUR_USERNAME.github.io/Spectrum/`.

> If the repository name differs, update the `base` path in `vite.config.ts`.

---

## Architecture Overview

```
src/
├── components/          # UI: chat, editor, explorer, footer, glass, review bar…
├── lib/
│   ├── agent/           # Tool execution, protocol, approvals, review, memory
│   ├── chats/           # Saved chats, aging, the chat list
│   ├── review/          # Per-change diffs and accept/reject
│   ├── python/          # Pyodide worker and file bridge
│   ├── providers/       # Groq usage and requests
│   ├── tools/           # Tool registry and toggles
│   ├── storage/         # Local and cloud file storage
│   └── monacoLoader.ts  # Bundles Monaco and the warm editor theme
├── store/               # Zustand state
scripts/
└── copy-pyodide.mjs     # Copies the Python runtime into public/
electron/                # Desktop shell
supabase/                # Optional backend schema and Groq edge function
```

**State:** Zustand, with selective persistence (model, layout, and preferences).
**Storage:** local by default, Supabase for cloud projects.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 19 + TypeScript |
| Editor | Monaco Editor (bundled) |
| Styling | Tailwind CSS v4, a warm dark palette with an amber accent |
| State | Zustand |
| AI (browser) | `@mlc-ai/web-llm` |
| AI (local) | Ollama |
| AI (cloud) | Groq, OpenRouter |
| Glass effect | `@ybouane/liquidglass` (MIT) |
| Python | Pyodide (bundled from npm) |
| Desktop | Electron 34 |
| Backend (optional) | Supabase |
| Build | Vite 8 + TypeScript |

---

## Roadmap

### Next
- [ ] Phase 5: checkpoints per message, and a usage meter in the chat header
- [ ] Notices with larger close buttons, and a clear "Close workspace" action
- [ ] Download a workspace as a `.zip`
- [ ] File sizes in the explorer
- [ ] Rounded, floating panels
- [ ] Ctrl+P Quick Open
- [ ] Liquid glass on the top bar

### Later
- [ ] Composer and Bug Finder tabs (placeholders for now)
- [ ] Source Control: changes, commit, Git graph, blame
- [ ] Codebase indexing and semantic search
- [ ] Integrated terminal (xterm.js, with node-pty in Electron)
- [ ] Native filesystem access via Electron IPC
- [ ] Tab autocomplete
- [ ] Rules / `AGENTS.md` support

---

## Contributing

Spectrum is open source and early-stage. Contributions, bug reports, and feature ideas are very welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-thing`)
3. Commit your changes
4. Open a pull request

Please keep the free and local-first philosophy in mind.

---

## License

MIT License © 2026 [pigeonthroat-hash](https://github.com/pigeonthroat-hash)

Third-party libraries keep their own licenses. Liquid glass uses `@ybouane/liquidglass` (MIT).

---

<p align="center">
  Built with care for free and open AI coding tools.<br>
  <em>Run models on your machine. Own your workflow.</em>
</p>
