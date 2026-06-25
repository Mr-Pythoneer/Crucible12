const { ipcMain, dialog, BrowserWindow } = require("electron");
const path = require("path");
const settings = require("./settings");
const { PRESETS, getPreset } = require("./presets");
const modelManager = require("./modelManager");
const runtimeManager = require("./runtimeManager");
const conversationStore = require("./conversationStore");
const { ServerManager } = require("./serverManager");

const serverManager = new ServerManager();

function broadcast(channel, ...args) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args);
  }
}

serverManager.on("state", (state, code) => broadcast("server-state", { state, code }));
serverManager.on("log", (text) => broadcast("server-log", text));

function registerIpc() {
  ipcMain.handle("settings:get", () => settings.load());
  ipcMain.handle("settings:set", (_e, partial) => settings.save(partial));
  ipcMain.handle("settings:choose-folder", async (_e, defaultPath) => {
    const res = await dialog.showOpenDialog({
      defaultPath,
      properties: ["openDirectory", "createDirectory"],
    });
    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle("system:info", () => ({
    platform: process.platform,
    arch: process.arch,
  }));

  ipcMain.handle("presets:list", () => {
    const s = settings.load();
    return PRESETS.map((p) => ({
      ...p,
      hfPattern: undefined,
      downloaded: modelManager.isDownloaded(s.modelsDir, p.id),
    }));
  });

  ipcMain.handle("presets:download", async (e, presetId) => {
    const s = settings.load();
    const winId = e.sender.id;
    await modelManager.downloadPreset(presetId, s.modelsDir, (progress) => {
      const win = BrowserWindow.fromId(winId);
      if (win) win.webContents.send("model-download-progress", { presetId, ...progress });
    });
    return true;
  });

  ipcMain.handle("presets:delete", (_e, presetId) => {
    const s = settings.load();
    modelManager.deletePreset(s.modelsDir, presetId);
    return true;
  });

  ipcMain.handle("runtime:status", () => {
    const s = settings.load();
    const exe = runtimeManager.findServerBinary(s.runtimeDir);
    return { ready: !!exe, path: exe };
  });

  ipcMain.handle("runtime:ensure", async (e, backend) => {
    const s = settings.load();
    const winId = e.sender.id;
    const exe = await runtimeManager.ensureRuntime(s.runtimeDir, backend, (progress) => {
      const win = BrowserWindow.fromId(winId);
      if (win) win.webContents.send("runtime-progress", progress);
    });
    return exe;
  });

  ipcMain.handle("server:start", async (_e, { presetId, overrides }) => {
    const s = settings.load();
    const preset = getPreset(presetId);
    const modelPath = modelManager.findModelFile(s.modelsDir, presetId);
    if (!modelPath) throw new Error("Model not downloaded yet.");
    const exePath = runtimeManager.findServerBinary(s.runtimeDir);
    if (!exePath) throw new Error("llama.cpp runtime not installed yet.");
    if (serverManager.proc) await serverManager.stop();
    settings.save({ selectedPreset: presetId });
    serverManager.start({ exePath, preset, modelPath, port: s.port, overrides });
    return true;
  });

  ipcMain.handle("server:stop", () => serverManager.stop());
  ipcMain.handle("server:status", () => serverManager.getStatus());

  ipcMain.handle("conversations:list", () => conversationStore.load());
  ipcMain.handle("conversations:save", (_e, conversation) => conversationStore.upsert(conversation));
  ipcMain.handle("conversations:delete", (_e, id) => conversationStore.remove(id));
}

function stopServerOnQuit() {
  serverManager.stop();
}

module.exports = { registerIpc, stopServerOnQuit };
