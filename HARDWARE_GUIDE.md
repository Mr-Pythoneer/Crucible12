# Hardware & model sorting guide

Two axes: **what power tier is your machine**, and **what do you want it to do**. Find your tier once in the table below, then jump to the purpose section that matches your task — coding, daily-driver chat, professional/reasoning work, creative writing, or vision. Same downloads work across [`tiers/`](tiers), [`setup/`](setup), and the [desktop app](desktop) — this is just the index that tells you which file to grab.

**Freshness note:** every model below was checked live against the Hugging Face API (release dates, real parameter counts, confirmed GGUF availability) — not pulled from memory or "best of 2026" blog posts, many of which list models with fabricated benchmark numbers. Sizes are computed from those real parameter counts at `Q4_K_M` (~0.6 bytes/param), not measured on every listed card/chip — expect to tune `--n-cpu-moe` / context size / quant for your exact box. "Comfortable" = model + ~16-32K context fits with headroom. "Tight" = it fits, but you're near the ceiling and may need to lower context or accept some CPU offload. This list will go stale again — re-verify before trusting it blindly in another few months.

## Find your tier

| Tier | GPU VRAM | Apple Silicon (unified mem) | CPU-only RAM | Example hardware |
|---|---|---|---|---|
| **1 — Light** | 4-8GB | 8-18GB | 8-16GB | Intel Arc B580 (12GB, ~$249 — best budget pick for this tier), RTX 3050/4050/4060, GTX 1660; M1-M4 base Macs; Snapdragon X/X2 ARM laptops (CPU-only — no GPU backend in stock llama.cpp release builds yet) |
| **2 — Standard** | 10-16GB | 24GB | 32GB+ | RTX 3060 12GB, RTX 4060 Ti 16GB (~$424, closest to MSRP), RTX 4070/4070 Ti, RTX 5070, Radeon RX 9070/9070 XT (current AMD flagship, 16GB GDDR6); 24GB MacBook Air/Pro |
| **3 — Power** | 20-24GB | 32-48GB | — *(CPU-only can't realistically reach this tier — speed, not RAM, becomes the wall)* | RTX 3090/3090 Ti (used market "value king" for 24GB), RTX 4090, Intel Arc Pro B70 (32GB, professional card); 32-48GB Mac |
| **4 — Max** | 32GB+ VRAM, 32GB+ system RAM | 64GB | — | RTX 5090 (32GB — performance king, but ~$3,949 as of mid-2026 due to memory shortages, far above its $1,999 launch price); 64GB Mac (Studio/MacBook Pro) |
| **5 — Extreme** | 32GB+ VRAM, 64GB+ system RAM, or multi-GPU | 96GB+ (Mac Studio Ultra) | — | RTX 5090 + 96GB+ RAM, dual-GPU workstations, Mac Studio Ultra |

**Laptop GPUs often ship with less VRAM than their desktop namesake** — confirmed directly: desktop RTX 5090 is 32GB/21,760 CUDA cores, the RTX 5090 *Laptop* GPU is only 24GB/10,496 CUDA cores. Sort by the VRAM column, not the model name. AMD cards use the same model/quant picks via llama.cpp's Vulkan backend (the `tiers/` "Vulkan (any GPU)" option); llama.cpp's official releases also now ship dedicated ROCm (AMD) and SYCL (Intel Arc) backends that outperform generic Vulkan on those GPUs specifically — not wired into this project yet, noted as a possible future improvement. The long-rumored "RTX 50 Super" refresh (more VRAM on existing cards) has been repeatedly delayed and is not shipping as of this guide's last check — don't wait for it.

---

## Coding (agentic, tool-calling)

The Qwen-Coder ladder this project is built around hasn't actually gone stale at the small end — there's still no smaller Qwen3-Coder dense model than 30B, so Qwen2.5-Coder remains the right pick below that size (confirmed: no newer small dense coder release from Qwen as of this check).

| Tier | Model | Quant | Size | Notes |
|---|---|---|---|---|
| 1 | Qwen2.5-Coder-3B-Instruct | `Q4_K_M` | ~1.9GB | Floor of this project — weak tool-calling, nothing smaller to fall back to. |
| 1 (upper end) | Qwen2.5-Coder-7B-Instruct | `Q4_K_M` | ~4.4GB | Noticeably more reliable than 3B for multi-step edits. |
| 2 | Qwen2.5-Coder-14B-Instruct | `Q4_K_M` | ~9GB | Best quality-per-GB dense coder at this size. |
| 3 | Qwen3-Coder-30B-A3B-Instruct | `UD-Q4_K_XL` | ~19GB | MoE, ~3B active/token — big step up in tool-calling reliability. |
| 3 (dense alt) | Devstral-Small-2-24B-Instruct-2512 | `Q4_K_M` | ~14.4GB | Mistral's purpose-built coding model (Nov 2025) — a dense alternative if you'd rather not deal with MoE CPU-offload tuning. |
| 4 | Qwen3-Coder-Next (`crucible` preset) | `UD-Q4_K_XL` | ~46GB | 80B total / 3B active MoE split across GPU + RAM. Still the current release (Jan 2026) — no successor yet. |
| 4 (max quant) | Qwen3-Coder-Next (`max` preset) | `UD-Q6_K_XL` | ~73GB | Same model, near-lossless quant. |
| 5 | Qwen3-Coder-480B-A35B-Instruct | `Q4_K_M` | ~288GB | The actual Qwen-Coder flagship (480B total / 35B active). Needs a 512GB-class Mac Studio Ultra or equivalent — genuinely extreme, included for completeness. |

## Daily driver (general chat, writing, quick Q&A, summarizing)

Qwen3 has moved to **Qwen3.5/3.6** and Google to **Gemma 4** since this project's earlier picks — both confirmed current via live release dates.

| Tier | Model | Quant | Size | Notes |
|---|---|---|---|---|
| 1 | Qwen3.5-4B | `Q4_K_M` | ~2.4GB | Replaces the earlier Qwen3-4B pick. |
| 2 | Qwen3.5-9B | `Q4_K_M` | ~5.4GB | Alt: Gemma-4-12B-it (~7.2GB) for a different "voice." |
| 3 | Qwen3.6-27B | `Q4_K_M` | ~16.7GB | Alt: Gemma-4-31B-it (~19.6GB) if you want the larger Google model instead. |
| 4 | Qwen3.6-35B-A3B | `Q4_K_M` | ~21.6GB | MoE — fast, snappy responses since only ~3B activates per token. Alt: Gemma-4-26B-A4B-it (~16GB), a smaller MoE that's also comfortable at tier 3. |
| 5 | Mistral-Medium-3.5-128B | `Q4_K_M` | ~77GB | Dense flagship-class general model. GLM-5.2 (753B) and Kimi-K2.6 (1.06T total params) are the current open-weight chat leaderboard toppers, but at ~450GB-635GB even at Q4 they're datacenter-scale, not realistic for any home setup — noted here so you know they exist, not as something to actually download. |

## Professional / reasoning (research synthesis, analysis, math, technical writing)

Qwen3.5/3.6 are **hybrid reasoning models** — the same checkpoints above can run in "thinking" mode via the chat template's `enable_thinking` flag, no separate download needed. The picks below are for dedicated reasoning-only checkpoints instead.

| Tier | Model | Quant | Size | Notes |
|---|---|---|---|---|
| 1 | Qwen3.5-4B (thinking mode enabled) | `Q4_K_M` | ~2.4GB | Same file as the daily-driver pick — toggle reasoning via the chat template, not a separate download. |
| 2 | DeepSeek-R1-Distill-Qwen-14B | `Q4_K_M` | ~9GB | Still the standard small dedicated-reasoning checkpoint — no newer small distill has replaced it as of this check, despite being from early 2025. |
| 3 | QwQ-32B or DeepSeek-R1-Distill-Qwen-32B | `Q4_K_M` | ~19GB | Same vintage/caveat as above — both still exist and are still the practical pick at this size. |
| 4 | Qwen3-Next-80B-A3B-Thinking | `UD-Q4_K_XL` | ~49GB | Dedicated reasoning MoE (Dec 2025) — same sizing pattern as Qwen3-Coder-Next, fits the same hardware. |
| 5 | DeepSeek-V3.2-Speciale | `Q4_K_M` | ~411GB | DeepSeek's dedicated reasoning specialist (685B total params). Needs serious workstation-class RAM — GLM-5.2 and Kimi-K2.6 (see Daily driver) cover this tier too but are even larger. |

## Creative writing (fiction, roleplay, brainstorming)

| Tier | Model | Quant | Size | Notes |
|---|---|---|---|---|
| 1 | Qwen3.5-4B | `Q4_K_M` | ~2.4GB | Same pick as daily-driver tier 1 — no dedicated creative-tuned model fits comfortably this small. |
| 2 | Gemma-4-12B-it | `Q4_K_M` | ~7.2GB | Google's tuning tends to read more "voiced" than Qwen's at this size. |
| 3 | Gemma-4-31B-it | `Q4_K_M` | ~19.6GB | Alt: Qwen3.6-27B if you want more factual grounding mixed into the prose. |
| 4 | Mistral-Medium-3.5-128B | `Q4_K_M` | ~77GB | Mistral's line is generally favored for prose variety over Qwen/Gemma's instruct tunes. |
| 5 | GLM-5.2 | `Q4_K_M` | ~452GB | Current open-weight leaderboard topper for general writing quality — same datacenter-scale caveat as the daily-driver tier-5 entry. |

## Vision / multimodal (images + text)

**Qwen2.5-VL has been superseded by Qwen3-VL** (confirmed: Qwen3-VL ships native GGUF straight from the Qwen org, no third-party requantization needed). Everything else on this list is text-only — switch here if you need a model that can actually look at screenshots, photos, or diagrams. Check your llama-server build includes multimodal (`mtmd`) support.

| Tier | Model | Quant | Size | Notes |
|---|---|---|---|---|
| 1 | Qwen3-VL-4B-Instruct | `Q4_K_M` | ~2.7GB | Basic image understanding — captions, simple OCR. |
| 2 | Qwen3-VL-8B-Instruct | `Q4_K_M` | ~5.3GB | Comfortable jump in accuracy for diagrams/charts/UI screenshots. |
| 3 | Qwen3-VL-32B-Instruct | `Q4_K_M` | ~20GB | Best quality-per-GB vision model on this list. |
| 4-5 | Qwen3-VL-235B-A22B-Instruct | `Q4_K_M` | ~141GB | Flagship-class MoE vision model — needs tier-5 headroom. A `-Thinking` variant exists too if you want step-by-step visual reasoning. |

---

## Where these come from

- **Coding tiers (1-4)** mirror `tiers/README.md` and `desktop/src/main/presets.js` exactly — same repos, same quants. Tier 5 and the Devstral alt are new additions, not yet wired into the desktop app's picker or `tiers/run-*.ps1` scripts.
- **Daily-driver, professional/reasoning, creative-writing, and vision tiers** aren't wired into the desktop app or `tiers/` scripts at all — they're plain Hugging Face GGUF downloads (search `unsloth` or `bartowski` + the model name, or use the Qwen org's own GGUF repos directly for the VL line).
- Every model name/size above was verified against the live Hugging Face API on the date this guide was last updated — not against blog "best models of 2026" roundups, several of which surfaced real model names mixed with what looked like fabricated benchmark figures. Re-verify before trusting this list blindly months from now; the *tier sizing* (what fits in how much VRAM/RAM) stays useful even after specific model picks go stale.
