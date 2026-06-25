const fs = require("fs");
const path = require("path");
const os = require("os");
const AdmZip = require("adm-zip");
const tar = require("tar");

// Downloads + extracts a prebuilt llama.cpp release for the current OS/arch,
// the cross-platform equivalent of setup/01-install-llamacpp.ps1. Verified asset
// naming against the live GitHub releases API: macOS/Linux ship .tar.gz, Windows
// ships .zip, and Windows CUDA builds need a SECOND "cudart-*" zip merged into the
// same folder (the CUDA runtime DLLs aren't bundled in the main asset) — a common
// gotcha if you only grab the one zip.

const RELEASES_API = "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest";

async function fetchLatestRelease() {
  const res = await fetch(RELEASES_API, { headers: { "User-Agent": "Crucible12-Desktop" } });
  if (!res.ok) throw new Error(`GitHub releases API error ${res.status}`);
  const json = await res.json();
  return {
    tag: json.tag_name,
    assets: (json.assets || []).map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size })),
  };
}

function pickByRegex(assets, regex) {
  const matches = assets.filter((a) => regex.test(a.name));
  return matches.length ? matches[0] : null;
}

function pickCudaPair(assets) {
  const re = /^llama-.*-bin-win-cuda-([\d.]+)-x64\.zip$/i;
  const matches = assets
    .map((a) => ({ asset: a, m: a.name.match(re) }))
    .filter((x) => x.m)
    .map((x) => ({ asset: x.asset, version: x.m[1] }))
    .sort((a, b) => parseFloat(a.version) - parseFloat(b.version));
  if (!matches.length) return null;
  const chosen = matches[0];
  const cudart = assets.find((a) => a.name === `cudart-llama-bin-win-cuda-${chosen.version}-x64.zip`);
  return { main: chosen.asset, cudart: cudart || null, version: chosen.version };
}

// backend: "cuda" | "vulkan" | "cpu" — only meaningful on win/linux; macOS always uses
// the official build (Metal acceleration is built in, no separate backend asset).
function selectAssets(assets, platform, arch, backend) {
  if (platform === "darwin") {
    const a = pickByRegex(assets, arch === "arm64" ? /bin-macos-arm64\.tar\.gz$/ : /bin-macos-x64\.tar\.gz$/);
    if (!a) throw new Error(`No macOS ${arch} build found in the latest llama.cpp release.`);
    return { kind: "tar", parts: [a] };
  }
  if (platform === "linux") {
    if (arch === "arm64") {
      const a = pickByRegex(assets, /bin-ubuntu-arm64\.tar\.gz$/);
      if (!a) throw new Error("No Linux arm64 build found in the latest llama.cpp release.");
      return { kind: "tar", parts: [a] };
    }
    const a =
      backend === "vulkan"
        ? pickByRegex(assets, /bin-ubuntu-vulkan-x64\.tar\.gz$/)
        : pickByRegex(assets, /bin-ubuntu-x64\.tar\.gz$/);
    if (!a) throw new Error(`No Linux x64 ${backend} build found in the latest llama.cpp release.`);
    return { kind: "tar", parts: [a] };
  }
  if (platform === "win32") {
    if (arch === "arm64") {
      const a = pickByRegex(assets, /bin-win-cpu-arm64\.zip$/);
      if (!a) throw new Error("No Windows arm64 build found in the latest llama.cpp release.");
      return { kind: "zip", parts: [a] };
    }
    if (backend === "cuda") {
      const pair = pickCudaPair(assets);
      if (!pair) throw new Error("No Windows CUDA build found in the latest llama.cpp release.");
      const parts = [pair.main];
      if (pair.cudart) parts.push(pair.cudart);
      return { kind: "zip", parts };
    }
    const a =
      backend === "vulkan"
        ? pickByRegex(assets, /bin-win-vulkan-x64\.zip$/)
        : pickByRegex(assets, /bin-win-cpu-x64\.zip$/);
    if (!a) throw new Error(`No Windows x64 ${backend} build found in the latest llama.cpp release.`);
    return { kind: "zip", parts: [a] };
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

async function downloadToFileOnce(url, outPath, onProgress) {
  const res = await fetch(url, { headers: { "User-Agent": "Crucible12-Desktop" } });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  const total = Number(res.headers.get("content-length") || 0) || null;
  let downloaded = 0;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const fileHandle = fs.createWriteStream(outPath);
  let lastEmit = 0;
  const EMIT_INTERVAL_MS = 200; // see modelManager.js — per-chunk emits flood IPC on slower/Wi-Fi connections

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
  if (onProgress) onProgress({ downloaded, total });
  await new Promise((resolve, reject) => fileHandle.end((err) => (err ? reject(err) : resolve())));

  if (total !== null && downloaded !== total) {
    throw new Error(`Download incomplete: got ${downloaded} of ${total} bytes`);
  }
}

async function downloadToFile(url, outPath, onProgress) {
  let attempt = 0;
  const maxAttempts = 5;
  while (true) {
    attempt++;
    try {
      await downloadToFileOnce(url, outPath, onProgress);
      return;
    } catch (err) {
      fs.rmSync(outPath, { force: true }); // partial/corrupt file — don't let a retry append to it
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, Math.min(30000, 3000 * attempt)));
    }
  }
}

function extract(kind, archivePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (kind === "tar") {
    tar.extract({ file: archivePath, cwd: destDir, sync: true });
  } else {
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(destDir, true);
  }
}

function findServerBinary(runtimeDir) {
  const target = process.platform === "win32" ? "llama-server.exe" : "llama-server";
  const stack = [runtimeDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === target) return full;
    }
  }
  return null;
}

let ensureRuntimeInFlight = null;

async function ensureRuntime(runtimeDir, backend, onProgress) {
  const existing = findServerBinary(runtimeDir);
  if (existing) return existing;

  // Re-entrancy guard: if a second call comes in while one's already running
  // (e.g. a stray double-click past the UI's own disabled-button guard), share
  // the same in-flight promise instead of racing two extractions into the same dir.
  if (ensureRuntimeInFlight) return ensureRuntimeInFlight;

  ensureRuntimeInFlight = (async () => {
    const platform = process.platform;
    const arch = process.arch;
    if (onProgress) onProgress({ stage: "querying-release" });
    const release = await fetchLatestRelease();
    const selection = selectAssets(release.assets, platform, arch, backend);

    const tmpDir = path.join(os.tmpdir(), `crucible12-runtime-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      for (const part of selection.parts) {
        if (onProgress) onProgress({ stage: "downloading", asset: part.name });
        const archivePath = path.join(tmpDir, part.name);
        await downloadToFile(part.url, archivePath, (p) =>
          onProgress && onProgress({ stage: "downloading", asset: part.name, ...p })
        );
        if (onProgress) onProgress({ stage: "extracting", asset: part.name });
        extract(selection.kind, archivePath, runtimeDir);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const exe = findServerBinary(runtimeDir);
    if (!exe) throw new Error("Extracted llama.cpp release but couldn't find llama-server inside it.");
    if (process.platform !== "win32") {
      fs.chmodSync(exe, 0o755);
    }
    return exe;
  })();

  try {
    return await ensureRuntimeInFlight;
  } finally {
    ensureRuntimeInFlight = null;
  }
}

module.exports = { ensureRuntime, findServerBinary, fetchLatestRelease, selectAssets };
