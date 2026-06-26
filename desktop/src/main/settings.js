const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const DEFAULTS = () => ({
  modelsDir: path.join(app.getPath("documents"), "Crucible12", "models"),
  runtimeDir: path.join(app.getPath("documents"), "Crucible12", "runtime"),
  port: 8080,
  selectedPreset: null,
  cpuMoeOverrides: {},
  ctxOverrides: {},
  winBackend: "cuda", // cuda | vulkan | cpu — only used on Windows
  linuxBackend: "vulkan", // vulkan | cpu — only used on Linux
  theme: "dark",
  customModels: [], // user-added Hugging Face models — see main/customModels.js
});

let cached = null;

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function load() {
  if (cached) return cached;
  const file = settingsPath();
  let onDisk = {};
  try {
    onDisk = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    // first run or corrupt file — fall through to defaults
  }
  cached = { ...DEFAULTS(), ...onDisk };
  return cached;
}

function save(partial) {
  cached = { ...load(), ...partial };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(cached, null, 2));
  return cached;
}

module.exports = { load, save, settingsPath };
