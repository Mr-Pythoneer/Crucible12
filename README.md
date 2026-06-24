# Crucible12

A local, fully-offline AI coding agent stack tuned specifically for one machine: **RTX 5090 (32GB) + Ryzen 9 9950X3D + 64GB DDR5-6400 on Windows 11.** No API keys, no cloud, no usage limits — your hardware does the work.

Crucible12 doesn't reinvent the agent loop. It pairs [OpenCode](https://github.com/anomalyco/opencode) (the current leading open-source, terminal-native coding agent) with a hardware-tuned [llama.cpp](https://github.com/ggml-org/llama.cpp) inference backend, a model chosen specifically to exploit this exact GPU+CPU+RAM combination, and Windows setup scripts so the whole thing is a handful of commands instead of an afternoon of yak-shaving.

## Why this isn't just "run Ollama"

Most local-LLM guides tell you to pick a model that fits in VRAM and stop there — which leaves 64GB of system RAM and a 16-core CPU sitting idle. The default **`crucible`** preset deliberately doesn't do that:

| Component | Spec | Role |
|---|---|---|
| RTX 5090 | 32GB GDDR7, ~1.79 TB/s bandwidth, Blackwell (sm_120) | Holds attention layers, shared experts, and most routed experts — anything on the hot path |
| Ryzen 9 9950X3D | 16C/32T Zen 5, dual-CCD (one with 3D V-Cache) | Computes the MoE experts that don't fit on the GPU |
| 64GB DDR5-6400 CL32 | ~45-48GB/s realistic dual-channel bandwidth | Holds the overflow experts — capacity the GPU alone can't provide |

The model that makes this work is **[Qwen3-Coder-Next](https://huggingface.co/Qwen/Qwen3-Coder-Next)**: an 80B-parameter MoE model with only ~3B active parameters per token, purpose-built by the Qwen team for local coding agents, with native 256K context. Because so few parameters activate per token, llama.cpp's `--n-cpu-moe` flag can park a slice of the expert weights in system RAM with only a modest speed cost — the GPU stays fast, the RAM adds capacity you'd otherwise pay for in quality. This is the one trick that actually uses all three components together instead of just the GPU.

If you'd rather have lower latency than extra capability, there's a second preset, **`fast`**, that loads a fully GPU-resident model with no CPU offload at all.

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

| | `crucible` (default) | `fast` |
|---|---|---|
| Model | Qwen3-Coder-Next (80B total / 3B active MoE) | Qwen3-Coder-30B-A3B-Instruct |
| Quant | `UD-Q4_K_XL` (~46GB) | `UD-Q4_K_XL` (~18-20GB) |
| Placement | GPU + CPU/RAM hybrid via `--n-cpu-moe` | Fully GPU-resident |
| Context | 64K by default (256K native, configurable) | 128K by default (256K native, 1M via Yarn) |
| Best for | Max capability; this is what "fully utilize the hardware" means here | Lowest latency; freeing the CPU/RAM (e.g. to game alongside it) |

Switching presets is just running a different launch script and pointing OpenCode at the matching config — see Quick Start.

## Quick start (Windows 11)

Run these from PowerShell, in the repo root, in order:

```powershell
git clone https://github.com/Mr-Pythoneer/Crucible12.git
cd Crucible12

# 1. Get a CUDA-enabled llama.cpp build (downloads the latest prebuilt release)
.\setup\01-install-llamacpp.ps1

# 2. Download model weights (both presets; pass -Preset crucible or -Preset fast for just one)
.\setup\02-download-models.ps1 -Preset both

# 3. Install OpenCode
.\setup\03-install-opencode.ps1
```

Then, in one window, start the inference server (leave it running):

```powershell
.\setup\run-crucible.ps1        # or .\setup\run-fast.ps1
```

In a second window, confirm it's actually using the GPU (and, for `crucible`, the CPU/RAM too):

```powershell
.\setup\benchmark.ps1
```

You should see GPU utilization spike during generation and a tokens/sec figure printed. If GPU utilization stays low, see Troubleshooting below.

Finally, point OpenCode at the running server and launch it:

```powershell
copy config\opencode.crucible.json opencode.json   # or opencode.fast.json
opencode
```

Inside OpenCode, run `/models` and pick the local provider/model, then start coding. Use **Tab** to switch between `plan` (read-only, suggests changes) and `build` (full-access, makes them) modes.

## Tuning knobs

**`--n-cpu-moe N`** (in `run-crucible.ps1`, default `16`) — how many leading MoE layers' *expert* weights get pushed to system RAM. Everything else (dense/attention/shared-expert weights, plus experts beyond layer N) stays on the GPU. I have no GPU to benchmark this on, so the default is a starting point, not a measured optimum:
- If `llama-server` fails to start with a CUDA out-of-memory error, **increase** `-CpuMoe`.
- If it starts cleanly and `nvidia-smi` shows several GB of VRAM still free, you can **decrease** it for more GPU-resident experts (faster) — leave a few GB of headroom for the KV cache to grow into during long sessions.

**`--ctx-size`** — longer context costs VRAM (for the KV cache) on top of the model weights. Both presets quantize the KV cache (`q8_0`) specifically to make room for more context within 32GB.

**Swapping models entirely** — edit the `$presets` table in `setup/02-download-models.ps1` to point at a different Hugging Face repo/quant pattern, and adjust the launch scripts' flags to match. Worth trying on this hardware: `gpt-oss-120b` (natively MXFP4-quantized, which the 5090's Blackwell tensor cores accelerate directly) or `GLM-4.5-Air` — both viable "go bigger" alternatives to Qwen3-Coder-Next. Check Hugging Face for current GGUF releases; the local-model landscape moves fast and whatever is best by the time you read this may not be what's documented here.

**Sampling params** — set per the model authors' own recommendations (`crucible`: temp 1.0/top_p 0.95/min_p 0.01/top_k 40; `fast`: temp 0.7/top_p 0.8/top_k 20/repeat_penalty 1.05). Re-check each model's card if you swap versions — these change between releases.

## Troubleshooting

- **CUDA out-of-memory on startup** — increase `-CpuMoe` (crucible preset) or reduce `-CtxSize`.
- **Low tokens/sec, GPU utilization near 0% in `benchmark.ps1`** — confirm your NVIDIA driver supports Blackwell/RTX 50-series (you need a driver new enough for CUDA 12.8+); confirm `01-install-llamacpp.ps1` actually picked a `*cuda*` asset and not a CPU-only build.
- **OpenCode's tool calls fail or use hallucinated arguments** — make sure `--jinja` is present in the launch command (it's in both presets by default — needed for the model's tool-calling chat template to be applied correctly). Local models, even agentic-tuned ones, are less consistent at tool-calling than top-tier hosted models; if `crucible` is unreliable for a particular workflow, try `fast` (smaller, often more consistent) before assuming the harness is broken.
- **`02-download-models.ps1` finds no matching files** — Hugging Face quant filenames change between uploads; the script prints the repo URL it tried, browse `/tree/main` there and adjust the `-Pattern`/repo in the script.
- **`npm`/`node` not found** — `03-install-opencode.ps1` installs Node via `winget` automatically; open a new PowerShell window afterward so PATH updates take effect.

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
│   ├── 02-download-models.ps1    # GGUF weights for both presets
│   ├── 03-install-opencode.ps1   # OpenCode CLI
│   ├── run-crucible.ps1          # launch llama-server, crucible preset
│   ├── run-fast.ps1              # launch llama-server, fast preset
│   └── benchmark.ps1             # tok/s + GPU utilization check
├── config/
│   ├── opencode.crucible.json    # OpenCode -> local server, crucible preset
│   └── opencode.fast.json        # OpenCode -> local server, fast preset
├── docs/
│   └── index.html                # GitHub Pages landing page
├── LICENSE
└── NOTICE                        # credits for OpenCode / llama.cpp / Qwen / Unsloth
```

## Credits

Built on top of [OpenCode](https://github.com/anomalyco/opencode) (MIT), [llama.cpp](https://github.com/ggml-org/llama.cpp) (MIT), the Qwen team's [Qwen3-Coder-Next](https://huggingface.co/Qwen/Qwen3-Coder-Next) and [Qwen3-Coder-30B-A3B-Instruct](https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct), and [Unsloth](https://huggingface.co/unsloth)'s GGUF quantizations. See [NOTICE](NOTICE) for full attribution. Crucible12's own scripts, configs, and docs are MIT-licensed — see [LICENSE](LICENSE).
