# Other hardware tiers

The main repo (`setup/`, `config/`) started out tuned for one specific machine: RTX 5090 (32GB) + Ryzen 9 9950X3D + 64GB DDR5-6400. These are PowerShell variants of the same idea for everyone else — lower-VRAM GPUs, or no dedicated GPU at all. The [project site](https://mr-pythoneer.github.io/Crucible12/) links here, but its interactive command generator still only covers the original four big-rig presets — these tiers are simple enough (one model, no real knobs to tune) that a static table does the job. If you'd rather have a GUI than PowerShell, the [desktop app](../desktop) covers this same hardware ladder cross-platform.

Same honesty note as the rest of the project, doubled: these were written without access to *any* of these hardware tiers (the main repo was already built blind to the 5090 — this is one level blinder). Treat the defaults as reasonable starting points from general community benchmarks, not measured numbers. Expect to tune `--n-cpu-moe` / context size / quant choice for your actual box.

The full ladder, smallest to largest — Qwen2.5-Coder ships in 0.5B/1.5B/3B/7B/14B/32B, so there's a real step between 7B and the 30B-A3B MoE used by the main repo's `fast` preset; the 14B tier below fills it instead of stretching 7B onto hardware it doesn't fit:

| Tier | GPU | RAM | Model | Quant | Size | Script | Config |
|---|---|---|---|---|---|---|---|
| No GPU / laptop | — (CPU-only) | 8GB+ | Qwen2.5-Coder-3B-Instruct | `Q4_K_M` | ~1.9GB | `run-cpu.ps1` | `opencode.cpu.json` |
| 4-6GB VRAM | RTX 3050 / older GTX-class | 8GB+ | Qwen2.5-Coder-3B-Instruct | `Q4_K_M` | ~1.9GB | `run-4gb.ps1` | `opencode.4gb.json` |
| 6-8GB VRAM | RTX 3050/4060/5060-class | 16GB+ | Qwen2.5-Coder-7B-Instruct | `Q4_K_M` | ~4.4GB | `run-6gb.ps1` | `opencode.6gb.json` |
| 10-12GB VRAM | RTX 3060 12GB / 4070 / 5070-class | 16GB+ | Qwen2.5-Coder-14B-Instruct | `Q4_K_M` | ~9GB | `run-12gb.ps1` | `opencode.12gb.json` |
| 16GB VRAM | RTX 4070 Ti Super / 4080 / 5070 Ti / 5080-class | 32GB+ | Qwen3-Coder-30B-A3B-Instruct | `UD-Q4_K_XL` | ~18-20GB | `run-16gb.ps1` | `opencode.16gb.json` |

Quality and tool-calling reliability increase down the table — pick the largest tier your VRAM (or patience, on CPU) actually supports.

## Setup

From the **repo root** (not this folder), reuse the main install + download scripts, just pick the matching preset:

```powershell
.\setup\01-install-llamacpp.ps1            # skip for the CPU tier if using a manual CPU-only build — see run-cpu.ps1's header
.\setup\02-download-models.ps1 -Preset tiny      # for the CPU or 4-6GB tier (3B, ~1.9GB)
.\setup\02-download-models.ps1 -Preset small     # for the 6-8GB tier (7B, ~4.4GB)
.\setup\02-download-models.ps1 -Preset medium    # for the 10-12GB tier (14B, ~9GB)
.\setup\02-download-models.ps1 -Preset fast      # for the 16GB tier (30B-A3B, ~18-20GB)
.\setup\03-install-opencode.ps1
```

Then launch from this folder:

```powershell
cd tiers
.\run-16gb.ps1      # or .\run-12gb.ps1 / .\run-6gb.ps1 / .\run-4gb.ps1 / .\run-cpu.ps1
```

And point OpenCode at it the same way as the main repo:

```powershell
copy tiers\opencode.16gb.json opencode.json    # match whichever tier you ran
opencode
```

## Caveats specific to these tiers

- **Smaller models are noticeably less reliable at agentic tool-calling** than the 30B+/80B presets in the main repo, and it gets worse the smaller you go — 14B is a real step down from 30B-A3B, and 7B/3B are a bigger step down still. Expect to double-check edits more on multi-step tasks the further down this table you sit.
- **The 16GB tier is genuinely tight.** Qwen3-Coder-30B-A3B at Q4 is ~18-20GB, a bit over 16GB VRAM alone — `run-16gb.ps1` defaults `--n-cpu-moe 6` to spill a little into RAM. If you still hit CUDA out-of-memory, raise it; if you have VRAM to spare, lower it or bump `-CtxSize`.
- **The 12GB and below tiers are dense models, not MoE** — there's no `--n-cpu-moe` to tune; they either fit fully on the GPU (the point of picking a tier sized to your card) or they don't. If one doesn't fit, drop to the tier below rather than trying to offload a dense model's layers piecemeal.
- **The CPU tier has no GPU dependency at all** — you don't need `setup/01-install-llamacpp.ps1`'s CUDA build; grab a plain CPU release from the [llama.cpp releases page](https://github.com/ggml-org/llama.cpp/releases) instead (an asset *without* "cuda" in the name) and point `-ServerExe` at it. Expect single-digit to low-double-digit tokens/sec even at 3B, depending on the CPU — and there's no smaller preset in this repo to drop to if that's still too slow.
- All tiers reuse the main repo's model-download machinery (`setup/02-download-models.ps1 -Preset tiny|small|medium|fast`) — no separate downloader needed.
