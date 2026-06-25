const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("crucible", {
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (partial) => ipcRenderer.invoke("settings:set", partial),
    chooseFolder: (defaultPath) => ipcRenderer.invoke("settings:choose-folder", defaultPath),
  },
  system: {
    info: () => ipcRenderer.invoke("system:info"),
  },
  presets: {
    list: () => ipcRenderer.invoke("presets:list"),
    download: (presetId) => ipcRenderer.invoke("presets:download", presetId),
    delete: (presetId) => ipcRenderer.invoke("presets:delete", presetId),
    onDownloadProgress: (cb) => {
      const listener = (_e, payload) => cb(payload);
      ipcRenderer.on("model-download-progress", listener);
      return () => ipcRenderer.removeListener("model-download-progress", listener);
    },
  },
  runtime: {
    status: () => ipcRenderer.invoke("runtime:status"),
    ensure: (backend) => ipcRenderer.invoke("runtime:ensure", backend),
    onProgress: (cb) => {
      const listener = (_e, payload) => cb(payload);
      ipcRenderer.on("runtime-progress", listener);
      return () => ipcRenderer.removeListener("runtime-progress", listener);
    },
  },
  server: {
    start: (presetId, overrides) => ipcRenderer.invoke("server:start", { presetId, overrides }),
    stop: () => ipcRenderer.invoke("server:stop"),
    status: () => ipcRenderer.invoke("server:status"),
    onState: (cb) => {
      const listener = (_e, payload) => cb(payload);
      ipcRenderer.on("server-state", listener);
      return () => ipcRenderer.removeListener("server-state", listener);
    },
    onLog: (cb) => {
      const listener = (_e, text) => cb(text);
      ipcRenderer.on("server-log", listener);
      return () => ipcRenderer.removeListener("server-log", listener);
    },
  },
  conversations: {
    list: () => ipcRenderer.invoke("conversations:list"),
    save: (conversation) => ipcRenderer.invoke("conversations:save", conversation),
    delete: (id) => ipcRenderer.invoke("conversations:delete", id),
  },
});
