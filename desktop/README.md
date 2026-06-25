# Crucible12 Desktop

A cross-platform desktop app for running local LLMs entirely offline — pick a model sized to your hardware (3B on a laptop CPU up to an 80B MoE split across a big GPU + system RAM), and chat with it in a simple, focused UI. No API keys, nothing leaves your machine except the one-time model/runtime download.

This is the desktop counterpart to the PowerShell scripts in [`setup/`](../setup) and [`tiers/`](../tiers) at the repo root — same presets, same llama.cpp backend, but cross-platform (macOS, Linux, Windows) with a GUI instead of a terminal.

## Running from source

```bash
cd desktop
npm install
npm start
```

First run takes you to **Setup**: install the llama.cpp runtime for your platform (one click), then open the model picker and download a preset sized to your hardware. Everything downloads to a `Crucible12` folder under your Documents by default — changeable in Setup.

## Building installers

```bash
npm run build:mac     # arm64 .dmg (Apple Silicon)
npm run build:win     # x64 .exe (nsis installer)
npm run build:linux   # x64 .AppImage
```

Output lands in `release/`. **These are unsigned builds** — there's no Apple Developer ID or Windows Authenticode certificate behind this project, so macOS Gatekeeper and Windows SmartScreen will both flag the app on first launch:

- **macOS:** right-click the app → Open, or allow it in System Settings → Privacy & Security.
- **Windows:** click "More info" → "Run anyway" on the SmartScreen prompt.

This is normal for an indie open-source app without a paid code-signing certificate — not a sign anything's wrong.

The Mac build defaults to **arm64 only** (Apple Silicon) — no Intel Mac target is published. If you're on an Intel Mac, building `--mac --x64` yourself should work but is untested.

## Architecture

- `src/main/` — Electron main process: preset registry (`presets.js`), settings persistence, the Hugging Face model downloader (`modelManager.js`, resumable via Range requests), the llama.cpp runtime downloader (`runtimeManager.js`, picks the right release asset for your OS/arch/GPU backend), and the `llama-server` process manager (`serverManager.js`).
- `src/preload.js` — the only bridge between renderer and main (`contextIsolation: true`, `nodeIntegration: false`).
- `src/renderer/` — plain HTML/CSS/JS UI, no framework/bundler. Chat streams directly from the renderer to `http://127.0.0.1:<port>/v1/chat/completions` (llama-server's OpenAI-compatible API).

## What's verified vs. not

Tested for real on Apple Silicon macOS during development: app boots cleanly (verified via a headless console-error check), the llama.cpp runtime downloader correctly selects, downloads, and extracts the macOS arm64 release asset and the resulting `llama-server` binary executes, and `npm run build:mac` produces a working signed-ad-hoc `.dmg` whose app bundle launches.

**Not personally tested:** the Windows and Linux runtime-asset selection logic (verified only against the live GitHub releases API's asset *names*, not by actually downloading/running on those OSes) and the `build:win`/`build:linux` packaging steps. [`.github/workflows/build-desktop.yml`](../.github/workflows/build-desktop.yml) builds all three platforms on GitHub's own runners on every push to `desktop/` — check the Actions tab for real Windows/Linux build results, and treat early reports of issues there as expected, not surprising.
