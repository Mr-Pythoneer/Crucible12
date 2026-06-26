# Hardware reference chart

A quick lookup: "I have *this* machine, what can it run?" — without opening the desktop app's picker or reading through `tiers/README.md`. Same models/quants as the rest of the repo (`desktop/src/main/presets.js` and `tiers/`), just indexed by hardware instead of by preset name.

Same honesty note as the rest of this project: these are sized from public VRAM/RAM specs and GGUF file sizes, not measured on every listed card — expect to tune `--n-cpu-moe` / context size for your exact box. "Comfortable" means the model + ~16-32K context fits with headroom; "tight" means it fits but you're close to the ceiling and may need to lower context or accept slower mixed CPU+GPU inference.

## NVIDIA / AMD GPUs (desktop & laptop, any OS)

AMD cards run the same models via llama.cpp's Vulkan backend (the `tiers/` "Vulkan (any GPU)" option) — same model/quant column applies, NVIDIA-specific notes aside.

| VRAM | Popular cards | Model | Quant | Size | Notes |
|---|---|---|---|---|---|
| 4-6GB | RTX 3050, RTX 4050 (laptop), GTX 1660 | Qwen2.5-Coder-3B-Instruct | `Q4_K_M` | ~1.9GB | Floor of this project — weak tool-calling, nothing smaller to fall back to. |
| 6-8GB | RTX 3060 Ti, RTX 4060, RTX 4060 (laptop), RTX 5060, RX 7600 | Qwen2.5-Coder-7B-Instruct | `Q4_K_M` | ~4.4GB | Comfortable. Noticeably more reliable than 3B for multi-step edits. |
| 10-12GB | RTX 3060 (12GB), RTX 3080 (10/12GB), RTX 4070, RTX 4070 (laptop), RTX 5070, RX 7700 XT | Qwen2.5-Coder-14B-Instruct | `Q4_K_M` | ~9GB | Comfortable. Best quality-per-GB dense model in this project. |
| 16GB | RTX 4060 Ti 16GB, RTX 4070 Ti Super, RTX 4080, RTX 4080 (laptop), RTX 4090 (laptop), RTX 5070 Ti, RTX 5080, RX 7800 XT, RX 7900 GRE | Qwen3-Coder-30B-A3B-Instruct | `UD-Q4_K_XL` | ~19GB | Tight — set `--n-cpu-moe` (try 6) to spill some MoE experts into system RAM. Big step up in tool-calling reliability over the dense tiers above. |
| 20-24GB | RTX 3090 / 3090 Ti, RTX 4090, RX 7900 XT / XTX | Qwen3-Coder-30B-A3B-Instruct | `UD-Q4_K_XL` | ~19GB | Comfortable, fully GPU-resident (`-ngl 99`, no CPU offload needed). |
| 32GB+ VRAM, 32GB+ system RAM | RTX 5090 | Qwen3-Coder-Next (`crucible` preset) | `UD-Q4_K_XL` | ~46GB | This project's original target machine — 80B total / 3B active MoE split across GPU + RAM. See main [README](README.md) for the full rationale. |
| 32GB VRAM, 48GB+ system RAM | RTX 5090 with RAM to spare | Qwen3-Coder-Next (`max` preset) | `UD-Q6_K_XL` | ~73GB | Near-lossless quant of the same model — ~10-25% slower than `crucible` for better quality. |

**Laptop GPUs run cooler/slower than their desktop namesake and often ship with less VRAM** (e.g. mobile RTX 4090 is 16GB, not 24GB; mobile RTX 4070 is 8GB, not 12GB) — match by the VRAM column, not the model name.

## Apple Silicon (unified memory)

No separate VRAM — llama.cpp's Metal backend draws straight from system RAM, but macOS reserves a chunk for itself. Budget roughly **75% of total RAM** as the usable ceiling for model + context; the rest is for macOS and other apps.

| Total RAM | Usable budget | Model | Quant | Size | Notes |
|---|---|---|---|---|---|
| 8GB | ~6GB | Qwen2.5-Coder-3B-Instruct | `Q4_K_M` | ~1.9GB | About all an 8GB Mac can spare. |
| 16GB | ~12GB | Qwen2.5-Coder-7B-Instruct | `Q4_K_M` | ~4.4GB | Comfortable, with room for a `Q5_K_M` upgrade (~5.4GB) if you want a quality bump. |
| 18GB (M4 base config) | ~13.5GB | Qwen2.5-Coder-7B-Instruct | `Q4_K_M` to `Q6_K` | 4.4-6GB | Comfortable either quant. |
| 24GB | ~18GB | Qwen2.5-Coder-14B-Instruct | `Q4_K_M` | ~9GB | Comfortable, recommended default for this size. The 30B-A3B MoE (~19GB) is right at the ceiling here — don't run it as your daily driver at 24GB. |
| 32GB | ~24GB | Qwen3-Coder-30B-A3B-Instruct | `UD-Q4_K_XL` | ~19GB | Comfortable. First size where the MoE tier's tool-calling jump is safely available on a Mac. |
| 36-48GB | ~27-36GB | Qwen3-Coder-30B-A3B-Instruct | `UD-Q4_K_XL` or `UD-Q6_K_XL` | 19-26GB | Room for the higher-quality quant of the 30B-A3B. |
| 64GB | ~48GB | Qwen3-Coder-Next | `UD-Q4_K_XL` | ~46GB | The `crucible` preset's model, fits unified memory directly — no GPU/RAM split needed like on a PC. |
| 96-128GB+ (Mac Studio) | 72-96GB+ | Qwen3-Coder-Next | `UD-Q6_K_XL` | ~73GB | Comfortable headroom for the near-lossless quant plus a large context window. |

## CPU-only / no dedicated GPU

Same model ladder as the low end of the GPU table — RAM is now the only constraint, and speed (not memory) becomes the limiting factor. Expect single-digit to low-double-digit tokens/sec depending on the CPU; there's no smaller preset to drop to below 3B.

| System RAM | Model | Quant | Size |
|---|---|---|---|
| 8GB+ | Qwen2.5-Coder-3B-Instruct | `Q4_K_M` | ~1.9GB |
| 16GB+ | Qwen2.5-Coder-7B-Instruct | `Q4_K_M` | ~4.4GB |
| 32GB+ | Qwen2.5-Coder-14B-Instruct | `Q4_K_M` | ~9GB |

## Where these come from

- **GPU/CPU tiers** mirror `tiers/README.md` and `desktop/src/main/presets.js` exactly — same repos, same quants.
- **Apple Silicon tiers** are new to this chart (the rest of the project was built/tested on Windows + this Mac, which has no CUDA GPU) — sized from the same model/quant ladder, budgeted against unified-memory headroom rather than VRAM.
- Pick your tier, then either open the [desktop app](desktop)'s model picker (closest preset by VRAM/RAM) or use the matching `tiers/run-*.ps1` script on Windows.
