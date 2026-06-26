# Crucible12

A local, fully-offline AI stack that fits the hardware you actually have — from a CPU-only laptop up to a maxed-out RTX 5090. No API keys, no cloud, no usage limits — your hardware does the work.

Not sure what your machine can run? See **[`HARDWARE_GUIDE.md`](HARDWARE_GUIDE.md)** — a lookup table by GPU/CPU/Mac, no need to dig through the desktop app's picker or `tiers/` first.

There are two ways in:

- **[`desktop/`](desktop)** — a cross-platform Electron app (macOS, Linux, Windows) with a built-in model picker and chat UI. Pick a preset, it downloads the model and the llama.cpp runtime, and you're chatting locally. Grab a build from the [releases page](https://github.com/Mr-Pythoneer/Crucible12/releases/latest) or the [project site](https://mr-pythoneer.github.io/Crucible12/).
- **PowerShell scripts (Windows)** — `setup/` and [`tiers/`](tiers) wire the same models into [OpenCode](https://github.com/anomalyco/opencode), the terminal-native coding agent, instead of a chat window. This is how the project started: tuned specifically for one high-end machine (RTX 5090 + Ryzen 9 9950X3D + 64GB DDR5-6400), described below. That tier still exists — it's just not the only one anymore. `tiers/` covers everything from a no-GPU laptop up to 16GB-VRAM cards with the same script-based approach.

> [!IMPORTANT]
> **None of these builds are code-signed** — there's no paid Apple Developer ID or Windows Authenticode/EV certificate behind this project (both cost real money and a verified legal identity). That single fact causes different friction on each OS:
>
> - **macOS:** every download will say `"Crucible12" is damaged and can't be opened.`, with no "Open Anyway" option anywhere, including System Settings. **Before opening the `.dmg`**, run this in Terminal — needed **every time you download a new copy**, the quarantine flag is per-file:
>   ```
>   xattr -cr ~/Downloads/Crucible12*.dmg
>   ```
>   Then open the dmg and drag the app to Applications as normal.
> - **Windows:** SmartScreen's "unknown publisher" warning has a real bypass — "More info" → "Run anyway" — no extra steps needed. But unsigned NSIS installers also get caught by Windows Defender's (and other antivirus engines') heuristics for "unsigned, brand-new, self-extracting installer," which can mean an actual detection/quarantine, not just a warning. If that happens:
>   1. Try the **portable** build instead (`Crucible12-<version>-portable.exe` on the [releases page](https://github.com/Mr-Pythoneer/Crucible12/releases/latest)) — it doesn't install anything (no registry writes, no uninstaller), which avoids the installer-pattern heuristic that flags NSIS the most.
>   2. If Defender already quarantined the file: Windows Security → Virus & threat protection → Protection history → restore it, or add an exclusion for the file/folder.
>   3. This is a false positive, not an actual problem with the file — building real trust with SmartScreen/AV reputation systems takes either a paid certificate or enough clean downloads over time; neither is instant. You can also report it directly to Microsoft: https://www.microsoft.com/en-us/wdsi/filesubmission.

Crucible12 doesn't reinvent the agent loop. It pairs a llama.cpp inference backend with models picked to fit whatever you're running them on, and either OpenCode or a from-scratch chat UI on top, so the whole thing is a handful of commands (or one app install) instead of an afternoon of yak-shaving. The rest of this README covers the original big-rig PowerShell build in detail — for the desktop app or the lesser-hardware tiers, see their own READMEs linked above.

## Why this isn't just "run Ollama"

Most local-LLM guides tell you to pick a model that fits in VRAM and stop there — which leaves 64GB of system RAM and a 16-core CPU sitting idle. The default **`crucible`** preset deliberately doesn't do that:

| Component | Spec | Role |
|---|---|---|
| RTX 5090 | 32GB GDDR7, ~1.79 TB/s bandwidth, Blackwell (sm_120) | Holds attention layers, shared experts, and most routed experts — anything on the hot path |
| Ryzen 9 9950X3D | 16C/32T Zen 5, dual-CCD (one with 3D V-Cache) | Computes the MoE experts that don't fit on the GPU |
| 64GB DDR5-6400 CL32 | ~45-48GB/s realistic dual-channel bandwidth | Holds the overflow experts — capacity the GPU alone can't provide |

The model that makes this work is **[Qwen3-Coder-Next](https://huggingface.co/Qwen/Qwen3-Coder-Next)**: an 80B-parameter MoE model with only ~3B active parameters per token, purpose-built by the Qwen team for local coding agents, with native 256K context. Because so few parameters activate per token, llama.cpp's `--n-cpu-moe` flag can park a slice of the expert weights in system RAM with only a modest speed cost — the GPU stays fast, the RAM adds capacity you'd otherwise pay for in quality. This is the one trick that actually uses all three components together instead of just the GPU.

The default preset, **`crucible`**, runs this model at **Q4_K_XL** — fast, reliable, with plenty of RAM headroom. If you'd rather trade a little speed for near-lossless quality there's a **`max`** preset (same model at Q6), a fully-GPU-resident **`fast`** preset, and a **`reasoning`** secondary — see [Presets](#presets) and ["Is this really the most powerful?"](#is-this-really-the-most-powerful) below.

> 🌐 **Interactive setup picker:** [mr-pythoneer.github.io/Crucible12](https://mr-pythoneer.github.io/Crucible12/) — choose a preset and it generates the exact commands for you.
> 📥 **Download:** [clone or grab the ZIP](https://github.com/Mr-Pythoneer/Crucible12/archive/refs/heads/main.zip).

## Architecture

```
 ┌────────────┐   HTTP, OpenAI-compatible    ┌──────────────────────────┐
 │  OpenCode  │ ────────────────────────────▶│       llama-server       │
 │ (terminal  │◀──────────────────────────── │  (llama.cpp, CUDA build)  │
 │   agent)   │      tool calls + text       └─────────────┬────────────┘
 └────────────┘                                             │
                                              ┌──────────────┴──────────────┐
                                              │                             │
                                        RTX 5090 (32GB VRAM)         9950X3D + 64GB RAM
                                   attention / shared experts /     overflow MoE experts
                                      most routed experts           (--n-cpu-moe N)
```

OpenCode handles the actual agent work — reading/editing files, running shell commands, planning multi-step changes, git integration, its terminal UI. Crucible12 only supplies the model it talks to and the machine-specific tuning around it.

## Presets

Four presets, each a single launch script + matching OpenCode config. **They run one at a time** — none of the big ones coexist in 96GB of memory.

| | `crucible` ⭐ default | `max` | `fast` | `reasoning` (secondary) |
|---|---|---|---|---|
| Model | Qwen3-Coder-Next 80B/3B-active | Qwen3-Coder-Next 80B/3B-active | Qwen3-Coder-30B-A3B | gpt-oss-120b 117B/5.1B-active |
| Quant | `UD-Q4_K_XL` (~46GB) | `UD-Q6_K_XL` (~73GB) | `UD-Q4_K_XL` (~18GB) | native MXFP4 (~60GB) |
| Placement | GPU + RAM hybrid | GPU + RAM hybrid | Fully GPU-resident | GPU + RAM hybrid |
| Est. tok/s* | ~45-60 | ~35-48 | fastest | ~30 |
| Best for | **Balanced default — fast + reliable** | Near-lossless quality | Lowest latency, frees CPU/RAM | Hard one-shot reasoning |
| Script / config | `run-crucible.ps1` · `opencode.crucible.json` | `run-max.ps1` · `opencode.max.json` | `run-fast.ps1` · `opencode.fast.json` | `run-reasoning.ps1` · `opencode.reasoning.json` |

<sub>*Estimated generation tok/s on this exact hardware, extrapolated from RTX 5090 / same-class anchors — not a direct Coder-Next-on-5090 measurement. Confirm with `llama-bench` on your box. Generation is **RAM-bandwidth-bound** for the hybrid presets, so **DDR5 EXPO must be on** (see below).</sub>

Switching presets is just running a different launch script and copying the matching config — see [Quick Start](#quick-start-windows-11).

## Is this really the most powerful?

Short answer: the default **`crucible`** (Q4) is the balanced pick, but **`max` (the same model at Q6) is the most powerful config that stays a fast, reliable agentic coder on this hardware** — and it is *not* simply "the biggest model that fits," which is the distinction that matters. Switch to `max` whenever you want maximum quality; the default stays Q4 for speed and headroom.

The trap with local MoE inference + CPU offload is that once expert weights spill into system RAM, **generation speed tracks _active_ parameters per token (and RAM bandwidth), not total model size.** A model with 3B active stays fast with half its experts in DDR5; a model with 22-37B active crawls. So the biggest models are technically loadable but practically useless here. Ranked for *agentic coding on this exact box*:

| Rank | Config | Verdict |
|---|---|---|
| **1** | **Qwen3-Coder-Next @ Q6_K_XL** (`max`) | Best capability-per-usable-speed. Same RL-tuned-for-tool-use model as `crucible`, near-lossless quant (UD KL-divergence ~0.14 vs ~0.41 at Q4 — ~3× lower), **identical** tool-calling reliability, still ~35-48 tok/s. |
| 2 | Qwen3-Coder-Next @ Q4 (`crucible`) | Fastest hybrid, most RAM headroom, proven. Only "beaten" because Q6 reclaims quality cheaply. |
| 3 | gpt-oss-120b MXFP4 (`reasoning`) | Strongest raw one-shot coder/reasoner that fits (Blackwell accelerates MXFP4). Demoted for *agentic* use: tool-calling leans on OpenAI's Harmony format and is flaky in OpenCode ([#7185](https://github.com/anomalyco/opencode/issues/7185)). Keep as a secondary. |
| 4 | GLM-4.5-Air 106B/12B | Fits (~68GB) but 12B active → 2-4× slower (~12-18 tok/s) for roughly par quality. A sidegrade. |
| 5 | Qwen3-235B-A22B @ Q2/IQ2 | Largest that *loads*, but 22B active → ~6-11 tok/s, and sub-2-bit erodes the tool-call/JSON reliability an agent needs. Worst of both axes. |
| 6 | GLM-4.6 355B / DeepSeek-V3/R1 671B | **Don't fit.** Smallest quants are 135-140GB vs ~82GB usable. Wrong machine. |

If you want raw model quality over agent reliability for a one-off hard problem, fire up the `reasoning` preset. For everything else, `max` is the pick. To go bigger you'd need more VRAM (an RTX PRO 6000 / 96GB card) or a second GPU — not more system RAM.

## Quick start (Windows 11)

Run these from PowerShell, in the repo root, in order:

```powershell
git clone https://github.com/Mr-Pythoneer/Crucible12.git
cd Crucible12

# 1. Get a CUDA-enabled llama.cpp build (downloads the latest prebuilt release)
.\setup\01-install-llamacpp.ps1

# 2. Download model weights (default = the "crucible" preset, ~46GB;
#    use -Preset max | fast | reasoning | all for others)
.\setup\02-download-models.ps1 -Preset crucible

# 3. Install OpenCode
.\setup\03-install-opencode.ps1
```

> **Before you run anything: enable DDR5 EXPO/XMP in your BIOS.** The hybrid presets are RAM-bandwidth-bound during generation — without EXPO, throughput can collapse ~3× (measured ~10 → 30 tok/s purely from enabling it). This is the single highest-impact setting on this machine.

Then, in one window, start the inference server (leave it running):

```powershell
.\setup\run-crucible.ps1   # or run-max.ps1 / run-fast.ps1 / run-reasoning.ps1
```

In a second window, confirm it's actually using the GPU (and, for `crucible`, the CPU/RAM too):

```powershell
.\setup\benchmark.ps1
```

You should see GPU utilization spike during generation and a tokens/sec figure printed. If GPU utilization stays low, see Troubleshooting below.

Finally, point OpenCode at the running server and launch it:

```powershell
copy config\opencode.crucible.json opencode.json   # match whichever server you started
opencode
```

Inside OpenCode, run `/models` and pick the local provider/model, then start coding. Use **Tab** to switch between `plan` (read-only, suggests changes) and `build` (full-access, makes them) modes.

## Tuning knobs

**DDR5 EXPO/XMP (BIOS)** — the highest-impact knob, and it's not in any script. The hybrid presets stream MoE experts from system RAM every token, so generation speed is bandwidth-bound; enabling EXPO is worth up to ~3× throughput. Turn it on before benchmarking anything.

**`--n-cpu-moe N`** — how many leading MoE layers' *expert* weights get pushed to system RAM. Everything else (dense/attention/shared-expert weights, plus experts beyond layer N) stays on the GPU. Defaults differ per preset because bigger weights need more offload: `run-max.ps1` defaults to `26` (Q6 is ~23GB larger than Q4), `run-crucible.ps1` to `16`, `run-reasoning.ps1` to `20`. These are starting points, not measured optima (built without a GPU on hand):
- If `llama-server` fails to start with a CUDA out-of-memory error, **increase** `-CpuMoe`.
- If it starts cleanly and `nvidia-smi` shows several GB of VRAM still free, **decrease** it for more GPU-resident experts (faster). Aim for VRAM sitting ~30GB, leaving a few GB of headroom for the KV cache to grow into during long sessions.

**`--ctx-size`** — longer context costs VRAM (for the KV cache) on top of the model weights. Both presets quantize the KV cache (`q8_0`) specifically to make room for more context within 32GB.

**Swapping models entirely** — edit the `$presets` table in `setup/02-download-models.ps1` to point at a different Hugging Face repo/quant pattern, and adjust the launch scripts' flags to match. Worth trying on this hardware: `gpt-oss-120b` (natively MXFP4-quantized, which the 5090's Blackwell tensor cores accelerate directly) or `GLM-4.5-Air` — both viable "go bigger" alternatives to Qwen3-Coder-Next. Check Hugging Face for current GGUF releases; the local-model landscape moves fast and whatever is best by the time you read this may not be what's documented here.

**Sampling params** — set per the model authors' own recommendations (`crucible`: temp 1.0/top_p 0.95/min_p 0.01/top_k 40; `fast`: temp 0.7/top_p 0.8/top_k 20/repeat_penalty 1.05). Re-check each model's card if you swap versions — these change between releases.

## Troubleshooting

- **CUDA out-of-memory on startup** — increase `-CpuMoe` (crucible preset) or reduce `-CtxSize`.
- **Low tokens/sec on a hybrid preset** — first check **DDR5 EXPO is enabled in BIOS** (single biggest cause; ~3× difference). Then confirm your NVIDIA driver supports Blackwell/RTX 50-series (you need one new enough for CUDA 12.8+), and that `01-install-llamacpp.ps1` picked a `*cuda*` asset, not a CPU-only build.
- **GPU utilization near 0% in `benchmark.ps1`** — the model isn't actually on the GPU: check the `-ngl 99` flag survived and the CUDA build loaded (llama-server prints the CUDA device at startup).
- **`reasoning` preset (gpt-oss-120b) emits reasoning but never calls tools** — this is the known Harmony tool-calling issue ([OpenCode #7185](https://github.com/anomalyco/opencode/issues/7185)); use a recent llama.cpp build (b8967+), keep `--jinja`, and prefer a Qwen3-Coder-Next preset for agentic loops. gpt-oss is best for one-shot reasoning, not multi-tool agent runs.
- **OpenCode's tool calls fail or use hallucinated arguments** — make sure `--jinja` is present in the launch command (it's in both presets by default — needed for the model's tool-calling chat template to be applied correctly). Local models, even agentic-tuned ones, are less consistent at tool-calling than top-tier hosted models; if `crucible` is unreliable for a particular workflow, try `fast` (smaller, often more consistent) before assuming the harness is broken.
- **`02-download-models.ps1` finds no matching files** — Hugging Face quant filenames change between uploads; the script prints the repo URL it tried, browse `/tree/main` there and adjust the `-Pattern`/repo in the script.
- **`npm`/`node` not found** — `03-install-opencode.ps1` installs Node via `winget` automatically; open a new PowerShell window afterward so PATH updates take effect.
- **Download keeps restarting from 0% after a dropped connection** — `02-download-models.ps1` retries with resume automatically, but resume requires PowerShell 6.1+; run scripts via `pwsh`, not the legacy `powershell.exe` (Windows PowerShell 5.1), or it'll silently re-download from scratch each retry.

## Don't have a 5090?

This repo is built for one specific machine, but [`tiers/`](tiers/) has toned-down configs for lesser hardware — 16GB-VRAM GPUs, 8-12GB-VRAM GPUs, and CPU-only/laptop setups, each reusing the same `setup/` install/download scripts with different models and flags. They're repo-only (not on the [project site](https://mr-pythoneer.github.io/Crucible12/), which stays focused on the 5090 build) — see [`tiers/README.md`](tiers/README.md) for setup and the honest caveats (smaller models there are noticeably less reliable at tool-calling).

## What I verified vs. what you need to verify

This was built and pushed from a Mac with no NVIDIA GPU and no Windows shell — there was no way to actually run `llama-server`, download the multi-gigabyte model weights, or confirm OpenCode talks to the local model end-to-end from there. What's covered:

- All JSON configs are syntax-validated.
- All flags/defaults are grounded in the current llama.cpp, OpenCode, and Qwen3-Coder-Next/30B-A3B documentation (checked live, not from memory).

What only you can confirm, on the actual machine: that the CUDA build installs and loads the model, that the GPU/CPU split behaves as described, and that real-world tok/s and tool-calling reliability are good enough for your workflow. `setup/benchmark.ps1` exists specifically to make that one command instead of a manual investigation.

## Repo layout

```
Crucible12/
├── setup/
│   ├── 01-install-llamacpp.ps1   # CUDA llama.cpp build
│   ├── 02-download-models.ps1    # GGUF weights for any/all presets (resumable downloads)
│   ├── 03-install-opencode.ps1   # OpenCode CLI
│   ├── run-crucible.ps1          # launch llama-server, crucible (Q4) preset — DEFAULT
│   ├── run-max.ps1               # launch llama-server, max (Q6) preset
│   ├── run-fast.ps1              # launch llama-server, fast preset
│   ├── run-reasoning.ps1         # launch llama-server, gpt-oss-120b secondary
│   └── benchmark.ps1             # tok/s + GPU utilization check
├── config/
│   ├── opencode.crucible.json    # OpenCode -> local server, crucible preset
│   ├── opencode.max.json         # OpenCode -> local server, max preset
│   ├── opencode.fast.json        # OpenCode -> local server, fast preset
│   └── opencode.reasoning.json   # OpenCode -> local server, reasoning secondary
├── tiers/                        # PowerShell configs for lesser hardware (CPU-only up to 16GB VRAM)
│   └── README.md
├── desktop/                      # cross-platform Electron app (mac/Linux/Windows), see desktop/README.md
│   ├── src/main/                 # presets, settings, model+runtime downloaders, llama-server manager
│   ├── src/renderer/             # chat UI, model picker, setup view
│   └── README.md
├── .github/workflows/
│   └── build-desktop.yml         # builds the desktop app for all 3 OSes on every push, releases on tag
├── docs/
│   └── index.html                # GitHub Pages landing page — desktop app + all hardware tiers
├── LICENSE
└── NOTICE                        # credits for OpenCode / llama.cpp / Qwen / Unsloth
```

## Credits

Built on top of [OpenCode](https://github.com/anomalyco/opencode) (MIT), [llama.cpp](https://github.com/ggml-org/llama.cpp) (MIT), the Qwen team's [Qwen3-Coder-Next](https://huggingface.co/Qwen/Qwen3-Coder-Next) and [Qwen3-Coder-30B-A3B-Instruct](https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct), and [Unsloth](https://huggingface.co/unsloth)'s GGUF quantizations. See [NOTICE](NOTICE) for full attribution. Crucible12's own scripts, configs, and docs are MIT-licensed — see [LICENSE](LICENSE).
