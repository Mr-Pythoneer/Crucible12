# Hardware & model sorting guide

Two axes: **what power tier is your machine**, and **what do you want it to do**. Find your tier once in the table below, then jump to the purpose section that matches your task — coding, daily-driver chat, professional/reasoning work, creative writing, or vision. Same downloads work across [`tiers/`](tiers), [`setup/`](setup), and the [desktop app](desktop) — this is just the index that tells you which file to grab.

Same honesty note as the rest of this project: sizes are computed from public GGUF file sizes and VRAM/RAM specs, not measured on every listed card/chip — expect to tune `--n-cpu-moe` / context size / quant for your exact box. "Comfortable" = model + ~16-32K context fits with headroom. "Tight" = it fits, but you're near the ceiling and may need to lower context or accept some CPU offload.

## Find your tier

| Tier | GPU VRAM | Apple Silicon (unified mem) | CPU-only RAM | Example hardware |
|---|---|---|---|---|
| **1 — Light** | 4-8GB | 8-18GB | 8-16GB | RTX 3050/4050/4060, GTX 1660, RX 7600; M1/M2/M3/M4 base Macs; any laptop with no dGPU |
| **2 — Standard** | 10-16GB | 24GB | 32GB+ | RTX 3060 12GB, RTX 4070/4070 Ti, RTX 5070, RX 7700/7800 XT; 24GB MacBook Air/Pro |
| **3 — Power** | 20-24GB | 32-48GB | — *(CPU-only can't realistically reach this tier — speed, not RAM, becomes the wall)* | RTX 3090/3090 Ti, RTX 4090, RX 7900 XT/XTX; 32-48GB Mac |
| **4 — Max** | 32GB+ VRAM, 32GB+ system RAM | 64GB | — | RTX 5090; 64GB Mac (Studio/MacBook Pro) |
| **5 — Extreme** | 32GB+ VRAM, 64GB+ system RAM, or multi-GPU | 96-128GB+ (Mac Studio Ultra) | — | RTX 5090 + 96GB+ RAM, dual-GPU workstations, Mac Studio Ultra |

**Laptop GPUs often ship with less VRAM than their desktop namesake** (mobile RTX 4090 is 16GB, not 24GB; mobile RTX 4070 is 8GB, not 12GB) — sort by the VRAM column, not the model name. AMD cards use the same model/quant picks via llama.cpp's Vulkan backend (the `tiers/` "Vulkan (any GPU)" option).

---

## Coding (agentic, tool-calling)

The models this whole project is built around — see the main [README](README.md) and [`tiers/README.md`](tiers/README.md) for the full rationale.

| Tier | Model | Quant | Size | Notes |
|---|---|---|---|---|
| 1 | Qwen2.5-Coder-3B-Instruct | `Q4_K_M` | ~1.9GB | Floor of this project — weak tool-calling, nothing smaller to fall back to. |
| 1 (upper end, 6-8GB/16GB) | Qwen2.5-Coder-7B-Instruct | `Q4_K_M` | ~4.4GB | Noticeably more reliable than 3B for multi-step edits. |
| 2 | Qwen2.5-Coder-14B-Instruct | `Q4_K_M` | ~9GB | Best quality-per-GB dense coder here. |
| 3 | Qwen3-Coder-30B-A3B-Instruct | `UD-Q4_K_XL` | ~19GB | MoE, ~3B active/token — big step up in tool-calling reliability over the dense tiers. |
| 4 | Qwen3-Coder-Next (`crucible` preset) | `UD-Q4_K_XL` | ~46GB | 80B total / 3B active MoE split across GPU + RAM. This project's original target build. |
| 5 | Qwen3-Coder-Next (`max` preset) | `UD-Q6_K_XL` | ~73GB | Same model, near-lossless quant — ~10-25% slower than `crucible` for better quality. |

## Daily driver (general chat, writing, quick Q&A, summarizing)

Not coding-specialized — better general knowledge and conversational tone than the Coder line, at the cost of agentic tool-calling.

| Tier | Model | Quant | Size | Notes |
|---|---|---|---|---|
| 1 | Qwen3-4B-Instruct-2507 | `Q4_K_M` | ~2.5GB | Alt: Llama-3.2-3B-Instruct (~1.9GB) if you want Meta's tuning instead. |
| 2 | Qwen3-14B | `Q4_K_M` | ~9GB | Alt: Gemma-3-12B-it (~7GB) — Google's tuning, slightly different "voice." |
| 3 | Qwen3-32B | `Q4_K_M` | ~19GB | Alt: Mistral-Small-3.2-24B-Instruct (~14GB) if 32B is too tight on your card. |
| 4 | Qwen3-30B-A3B-Instruct-2507 | `UD-Q4_K_XL` | ~18GB | MoE — fast, snappy responses even on tier-4 hardware since only ~3B activates per token. |
| 5 | Llama-3.3-70B-Instruct | `Q4_K_M` | ~40GB | Dense flagship-class general model — higher quality ceiling than the MoE pick above if you have RAM to spare. |

## Professional / reasoning (research synthesis, analysis, math, technical writing)

Models tuned or distilled specifically for step-by-step reasoning — slower per-answer (they "think" before responding) but more reliable on multi-step logic, math, and dense technical material than the daily-driver line.

| Tier | Model | Quant | Size | Notes |
|---|---|---|---|---|
| 1 | Qwen3-4B-Thinking-2507 | `Q4_K_M` | ~2.5GB | Alt: DeepSeek-R1-Distill-Qwen-7B (~4.4GB) if you can stretch to the top of tier 1. |
| 2 | DeepSeek-R1-Distill-Qwen-14B | `Q4_K_M` | ~9GB | Distilled reasoning traces from R1 onto a 14B base — a real step up from generic chat models on logic-heavy tasks. |
| 3 | QwQ-32B | `Q4_K_M` | ~19GB | Purpose-built dense reasoning model — alt: DeepSeek-R1-Distill-Qwen-32B, similar size and class. |
| 4 | gpt-oss-120b (`reasoning` preset) | native `MXFP4` | ~60GB | Already in this repo's desktop app/`tiers` — strongest raw reasoner that fits, but flakier at tool-calling per its own notes; keep as a secondary, not your only model. |
| 5 | Qwen3-235B-A22B-Thinking-2507 | `Q3_K_XL`/`UD-Q4_K_XL` | ~110-130GB | Flagship-class MoE reasoner. Needs the RAM headroom of a 96GB+ Mac Studio or equivalent workstation — aspirational for most setups, included for completeness. |

## Creative writing (fiction, roleplay, brainstorming)

Models that lean toward prose variety and "voice" over factual precision or code correctness.

| Tier | Model | Quant | Size | Notes |
|---|---|---|---|---|
| 1 | Qwen3-4B-Instruct-2507 | `Q4_K_M` | ~2.5GB | Same pick as the daily-driver tier-1 — no dedicated creative-tuned model fits comfortably this small. |
| 2 | Mistral-Nemo-12B-Instruct | `Q4_K_M` | ~7GB | Mistral's line is generally favored for prose variety over the Qwen/Llama instruct tunes. |
| 3 | Mistral-Small-3.2-24B-Instruct | `Q4_K_M` | ~14GB | Alt: Qwen3-32B if you want more factual grounding mixed into the prose. |
| 4 | Llama-3.3-70B-Instruct | `Q4_K_M` | ~40GB | Same pick as daily-driver tier 5 — strong general writing quality. |
| 5 | Qwen3-235B-A22B-Instruct-2507 | `Q3_K_XL`/`UD-Q4_K_XL` | ~110-130GB | Same RAM caveat as the tier-5 reasoning pick — only if you have the headroom. |

## Vision / multimodal (images + text)

Everything above is text-only. If you need a model that can actually look at screenshots, photos, or diagrams, switch to the Qwen2.5-VL line — same llama.cpp backend, GGUF quants exist, but check your llama-server build includes multimodal (`mtmd`) support.

| Tier | Model | Quant | Size | Notes |
|---|---|---|---|---|
| 1 | Qwen2.5-VL-3B-Instruct | `Q4_K_M` | ~2.2GB | Basic image understanding — captions, simple OCR. |
| 2 | Qwen2.5-VL-7B-Instruct | `Q4_K_M` | ~4.8GB | Comfortable jump in accuracy for diagrams/charts/UI screenshots. |
| 3 | Qwen2.5-VL-32B-Instruct | `Q4_K_M` | ~20GB | Best quality-per-GB vision model on this list. |
| 4-5 | Qwen2.5-VL-72B-Instruct | `Q4_K_M` | ~45GB | Largest in the line — needs tier-4 headroom or above. |

---

## Where these come from

- **Coding tiers** mirror `tiers/README.md` and `desktop/src/main/presets.js` exactly — same repos, same quants, no changes.
- **Daily-driver, professional/reasoning, creative-writing, and vision tiers are new** to this chart and aren't wired into the desktop app's picker or `tiers/run-*.ps1` scripts yet — they're plain Hugging Face GGUF downloads (search `bartowski` or `unsloth` + the model name on Hugging Face, same as the coding models in this repo).
- Model landscape moves fast — these are current as of this guide's writing. If a model here has been superseded, the *tier sizing* (what fits in how much VRAM/RAM) stays useful even after the specific pick goes stale.
