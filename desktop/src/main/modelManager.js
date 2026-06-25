const fs = require("fs");
const path = require("path");
const { getPreset } = require("./presets");

// Lists+downloads GGUF weights from Hugging Face for a preset, with resumable,
// progress-reporting downloads (Range requests) — the cross-platform equivalent
// of setup/02-download-models.ps1's Invoke-WebRequest -Resume logic.

async function listFiles(preset) {
  const res = await fetch(`https://huggingface.co/api/models/${preset.hfRepo}`, {
    headers: { "User-Agent": "Crucible12-Desktop" },
  });
  if (!res.ok) throw new Error(`Hugging Face API error ${res.status} for ${preset.hfRepo}`);
  const info = await res.json();
  const files = (info.siblings || [])
    .map((s) => s.rfilename)
    .filter((name) => name.endsWith(".gguf") && preset.hfPattern.test(name));
  if (!files.length) {
    throw new Error(
      `No files matched in ${preset.hfRepo}. Browse https://huggingface.co/${preset.hfRepo}/tree/main and check the pattern in presets.js.`
    );
  }
  return files;
}

function presetDir(modelsDir, presetId) {
  return path.join(modelsDir, presetId);
}

function isDownloaded(modelsDir, presetId) {
  const dir = presetDir(modelsDir, presetId);
  if (!fs.existsSync(dir)) return false;
  const ggufs = fs.readdirSync(dir).filter((f) => f.endsWith(".gguf") && !f.endsWith(".part"));
  return ggufs.length > 0;
}

function findModelFile(modelsDir, presetId) {
  const dir = presetDir(modelsDir, presetId);
  if (!fs.existsSync(dir)) return null;
  const ggufs = fs.readdirSync(dir).filter((f) => f.endsWith(".gguf"));
  // multi-part shards: load the first part, llama.cpp follows the rest automatically
  const first = ggufs.find((f) => /-00001-of-/.test(f)) || ggufs[0];
  return first ? path.join(dir, first) : null;
}

async function downloadFile(url, outPath, onProgress, signal) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const tmpPath = outPath + ".part";
  let startByte = 0;
  if (fs.existsSync(tmpPath)) {
    startByte = fs.statSync(tmpPath).size;
  }

  const headers = { "User-Agent": "Crucible12-Desktop" };
  if (startByte > 0) headers.Range = `bytes=${startByte}-`;

  const res = await fetch(url, { headers, redirect: "follow", signal });
  if (!res.ok && res.status !== 206) {
    if (res.status === 416) {
      // already fully downloaded
      fs.renameSync(tmpPath, outPath);
      return;
    }
    throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  }

  const resumed = res.status === 206;
  const totalHeader = res.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) + (resumed ? startByte : 0) : null;

  const fileHandle = fs.createWriteStream(tmpPath, { flags: resumed ? "a" : "w" });
  let downloaded = resumed ? startByte : 0;
  let lastEmit = 0;
  const EMIT_INTERVAL_MS = 200; // throttle progress — emitting per-chunk floods IPC and the renderer,
                                 // worst on flaky/Wi-Fi connections that yield many small chunks

  for await (const chunk of res.body) {
    const canWriteMore = fileHandle.write(chunk);
    downloaded += chunk.length;
    if (!canWriteMore) {
      await new Promise((resolve) => fileHandle.once("drain", resolve));
    }
    const now = Date.now();
    if (onProgress && now - lastEmit >= EMIT_INTERVAL_MS) {
      lastEmit = now;
      onProgress({ downloaded, total });
    }
  }
  if (onProgress) onProgress({ downloaded, total }); // final update so the UI lands on 100%
  await new Promise((resolve, reject) => {
    fileHandle.end((err) => (err ? reject(err) : resolve()));
  });

  fs.renameSync(tmpPath, outPath);
}

async function downloadPreset(presetId, modelsDir, onProgress) {
  const preset = getPreset(presetId);
  const files = await listFiles(preset);
  const dir = presetDir(modelsDir, presetId);

  let fileIndex = 0;
  for (const file of files) {
    fileIndex++;
    const outPath = path.join(dir, path.basename(file));
    if (fs.existsSync(outPath)) continue; // already have it
    const url = `https://huggingface.co/${preset.hfRepo}/resolve/main/${file}`;

    let attempt = 0;
    const maxAttempts = 6;
    while (true) {
      attempt++;
      try {
        await downloadFile(url, outPath, (p) => {
          if (onProgress) {
            onProgress({
              file,
              fileIndex,
              fileCount: files.length,
              downloaded: p.downloaded,
              total: p.total,
            });
          }
        });
        break;
      } catch (err) {
        if (attempt >= maxAttempts) throw err;
        await new Promise((r) => setTimeout(r, Math.min(60000, 5000 * attempt)));
      }
    }
  }
}

function deletePreset(modelsDir, presetId) {
  const dir = presetDir(modelsDir, presetId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = { listFiles, isDownloaded, findModelFile, downloadPreset, deletePreset, presetDir };
