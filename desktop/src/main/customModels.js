const fs = require("fs");
const path = require("path");
const { downloadFile, presetDir } = require("./modelManager");

// Lets a user point this app at an arbitrary Hugging Face repo and download a
// GGUF straight off the site, instead of being limited to the built-in presets
// in presets.js. Reuses modelManager's downloadFile (parallel Range-request
// segments) and on-disk layout (one folder per model id) so custom models work
// with the rest of the app — server launch, deletion, etc. — for free.

const UA = "Crucible12-Desktop";
const SHARD_RE = /^(.*)-(\d{5})-of-(\d{5})\.gguf$/i;

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// repoId like "org/model-name" — browse https://huggingface.co/<repoId>/tree/main
// to find one if you're not sure of the exact id.
async function searchRepo(repoId) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repoId)) {
    throw new Error('Expected a Hugging Face repo id like "org/model-name".');
  }
  const res = await fetch(`https://huggingface.co/api/models/${repoId}/tree/main?recursive=true`, {
    headers: { "User-Agent": UA },
  });
  if (res.status === 404) {
    throw new Error(`No Hugging Face repo found at "${repoId}" — check the org/name spelling.`);
  }
  if (!res.ok) throw new Error(`Hugging Face API error ${res.status} for ${repoId}`);
  const entries = await res.json();
  const files = entries.filter((e) => e.type === "file" && e.path.toLowerCase().endsWith(".gguf"));
  if (!files.length) {
    throw new Error(`No .gguf files found in ${repoId} — this repo may not ship GGUF weights.`);
  }

  // Multi-part shards (e.g. model-00001-of-00003.gguf) are one logical model —
  // group them so the user picks/downloads the whole set with one click.
  const groups = new Map();
  for (const f of files) {
    const m = f.path.match(SHARD_RE);
    const key = m ? `${m[1]}-of-${m[3]}.gguf` : f.path;
    if (!groups.has(key)) groups.set(key, { parts: [], sizeBytes: 0 });
    const g = groups.get(key);
    g.parts.push(f.path);
    g.sizeBytes += f.size || 0;
  }

  return Array.from(groups.entries())
    .map(([key, g]) => {
      const parts = g.parts.sort();
      return {
        key,
        parts,
        sizeBytes: g.sizeBytes,
        label: parts.length > 1 ? `${parts[0]} (${parts.length} parts)` : parts[0],
      };
    })
    .sort((a, b) => a.sizeBytes - b.sizeBytes);
}

function computeId(repoId, parts) {
  const base = parts[0].replace(/\.gguf$/i, "").replace(SHARD_RE, "$1");
  return `custom-${slugify(repoId)}-${slugify(base)}`;
}

async function addCustomModel({ repoId, parts, label }, modelsDir, onProgress) {
  const id = computeId(repoId, parts);
  const dir = presetDir(modelsDir, id);
  let fileIndex = 0;
  for (const part of parts) {
    fileIndex++;
    const outPath = path.join(dir, path.basename(part));
    if (fs.existsSync(outPath)) continue; // already have it — e.g. retried after a partial multi-part download
    const url = `https://huggingface.co/${repoId}/resolve/main/${part}`;
    await downloadFile(url, outPath, (p) => {
      if (onProgress) {
        onProgress({ fileIndex, fileCount: parts.length, downloaded: p.downloaded, total: p.total });
      }
    });
  }
  return {
    id,
    label: label || parts[0],
    model: parts[0],
    hfRepo: repoId,
    custom: true,
  };
}

module.exports = { searchRepo, computeId, addCustomModel };
