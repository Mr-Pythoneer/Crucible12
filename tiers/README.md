# Other hardware tiers

The main repo (`setup/`, `config/`) is tuned for one specific machine: RTX 5090 (32GB) + Ryzen 9 9950X3D + 64GB DDR5-6400. These are toned-down variants for everyone else — lower-VRAM GPUs, or no dedicated GPU at all. They're **not** part of the [interactive picker on the project site](https://mr-pythoneer.github.io/Crucible12/) (that page stays focused on the 5090 build this repo was actually designed for) — find them here in the repo instead.

Same honesty note as the rest of the project, doubled: these were written without access to *any* of these hardware tiers (the main repo was already built blind to the 5090 — this is one level blinder). Treat the defaults as reasonable starting points from general community benchmarks, not measured numbers. Expect to tune `--n-cpu-moe` / context size / quant choice for your actual box.

| Tier | GPU | RAM | Model | Quant | Size | Script | Config |
|---|---|---|---|---|---|---|---|
| 16GB VRAM | RTX 4070 Ti Super / 4080 / 5070 Ti / 5080-class | 32GB+ | Qwen3-Coder-30B-A3B-Instruct | `UD-Q4_K_XL` | ~18-20GB | `run-16gb.ps1` | `opencode.16gb.json` |
| 8-12GB VRAM | RTX 3060 / 4060 / 5060-class | 16GB+ | Qwen2.5-Coder-7B-Instruct | `Q4_K_M` | ~4.4GB | `run-8gb.ps1` | `opencode.8gb.json` |
| No GPU / laptop | — (CPU-only) | 16GB+ | Qwen2.5-Coder-7B-Instruct | `Q4_K_M` | ~4.4GB | `run-cpu.ps1` | `opencode.cpu.json` |

## Setup

From the **repo root** (not this folder), reuse the main install + download scripts, just pick the matching preset:

```powershell
.\setup\01-install-llamacpp.ps1        # skip this for the CPU tier if you'd rather grab a CPU-only build manually — see run-cpu.ps1's header
.\setup\02-download-models.ps1 -Preset fast    # for the 16GB tier
.\setup\02-download-models.ps1 -Preset small   # for the 8GB or CPU tier
.\setup\03-install-opencode.ps1
```

Then launch from this folder:

```powershell
cd tiers
.\run-16gb.ps1      # or .\run-8gb.ps1 / .\run-cpu.ps1
```

And point OpenCode at it the same way as the main repo:

```powershell
copy tiers\opencode.16gb.json opencode.json    # match whichever tier you ran
opencode
```

## Caveats specific to these tiers

- **7B-class models (8GB/CPU tiers) are noticeably less reliable at tool-calling** than the 30B+/80B presets in the main repo. Local models in general get worse at agentic tool-use as they shrink — expect to double-check edits more on multi-step tasks.
- **The 16GB tier is genuinely tight.** Qwen3-Coder-30B-A3B at Q4 is ~18-20GB, a bit over 16GB VRAM alone — `run-16gb.ps1` defaults `--n-cpu-moe 6` to spill a little into RAM. If you still hit CUDA out-of-memory, raise it; if you have VRAM to spare, lower it or bump `-CtxSize`.
- **The CPU tier has no GPU dependency at all** — you don't need `setup/01-install-llamacpp.ps1`'s CUDA build; grab a plain CPU release from the [llama.cpp releases page](https://github.com/ggml-org/llama.cpp/releases) instead (an asset *without* "cuda" in the name) and point `-ServerExe` at it. Expect single-digit to low-double-digit tokens/sec depending on the CPU.
- All three reuse the main repo's model-download machinery (`setup/02-download-models.ps1 -Preset fast|small`) — no separate downloader needed.
