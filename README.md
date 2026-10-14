# Spectrum

Spectrum is an AI code editor with free model support (Gemma, Qwen, DeepSeek via Ollama, Groq, OpenRouter, etc.).

## Features (v0.1)

- **3-panel layout**: File Explorer · Monaco Code Editor · AI Sidebar
- **Chat / Agent / Composer** modes
- **Green / red diffs** (Monaco DiffEditor)
- Multi-model selector (free models prioritized)
- Zustand state + Tailwind dark theme
- Electron-ready for full filesystem + terminal access

## Live Demo (GitHub Pages)

Once deployed: `https://YOUR_USERNAME.github.io/spectrum/`

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deploy to GitHub Pages

### 1. Create the repo on GitHub
- Go to https://github.com/new
- Name it `spectrum` (or any name — update the base path if different)
- Keep it public
- **Do not** initialize with README / .gitignore (we already have them)

### 2. Push this project

```bash
cd spectrum
git init
git add .
git commit -m "Initial commit: Spectrum v0.1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/spectrum.git
git push -u origin main
```

### 3. Install deploy helper & push to Pages

```bash
npm install
npm install -D gh-pages
npm run deploy
```

This builds with the correct base path and pushes the `dist/` folder to the `gh-pages` branch.

### 4. Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `gh-pages` / `/ (root)`
4. Save

After 1–2 minutes your site will be live at:

`https://YOUR_USERNAME.github.io/spectrum/`

> **Note:** If your repo name is not `spectrum`, edit `vite.config.ts` and change the base path string to match (`'/your-repo-name/'`).

## Electron (desktop with full FS)

```bash
npm run electron:dev
```

## Roadmap

1. Real Ollama / OpenRouter / Groq providers
2. Native FS via Electron IPC
3. Terminal (xterm + node-pty)
4. Codebase indexing + @ mentions
5. Tab autocomplete
6. Multi-file agent tools
7. Rules / AGENTS.md support

Built with ❤️ for Spectrum.
