const { spawn } = require("child_process");
const { EventEmitter } = require("events");

// Spawns/monitors llama-server with the args appropriate for a given preset —
// the desktop equivalent of setup/run-*.ps1 and tiers/run-*.ps1. One server runs
// at a time (mirrors the "run one preset at a time, they don't coexist in memory"
// rule from the PowerShell scripts).

class ServerManager extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.logs = [];
    this.state = "stopped"; // stopped | starting | running | error
    this.activePresetId = null;
    this.port = null;
  }

  buildArgs(preset, modelPath, port, overrides = {}) {
    const ctx = overrides.ctx || preset.ctxDefault;
    const args = [
      "--model", modelPath,
      "--host", "127.0.0.1",
      "--port", String(port),
      "-ngl", String(preset.ngl),
      "--ctx-size", String(ctx),
      "--flash-attn", "on",
      "--jinja",
    ];
    if (preset.cpuMoe !== null && preset.cpuMoe !== undefined) {
      const cpuMoe = overrides.cpuMoe !== undefined ? overrides.cpuMoe : preset.cpuMoe;
      if (cpuMoe > 0) args.push("--n-cpu-moe", String(cpuMoe));
    }
    if (preset.cacheQuant) {
      args.push("--cache-type-k", "q8_0", "--cache-type-v", "q8_0");
    }
    if (preset.reasoningEffort) {
      args.push("--chat-template-kwargs", JSON.stringify({ reasoning_effort: preset.reasoningEffort }));
    }
    args.push("--temp", "0.7", "--top-p", "0.8", "--top-k", "20", "--repeat-penalty", "1.05");
    return args;
  }

  start({ exePath, preset, modelPath, port, overrides }) {
    if (this.proc) {
      throw new Error("A server is already running — stop it first.");
    }
    const args = this.buildArgs(preset, modelPath, port, overrides);
    this.logs = [];
    this.state = "starting";
    this.activePresetId = preset.id;
    this.port = port;
    this.emit("state", this.state);

    this.proc = spawn(exePath, args, { stdio: ["ignore", "pipe", "pipe"] });

    const onData = (chunk) => {
      const text = chunk.toString();
      this.logs.push(text);
      if (this.logs.length > 2000) this.logs.shift();
      this.emit("log", text);
      if (this.state === "starting" && /HTTP server listening|server is listening|main loop/i.test(text)) {
        this.state = "running";
        this.emit("state", this.state);
      }
    };
    this.proc.stdout.on("data", onData);
    this.proc.stderr.on("data", onData);

    this.proc.on("exit", (code) => {
      this.proc = null;
      this.state = code === 0 || code === null ? "stopped" : "error";
      this.emit("state", this.state, code);
    });

    this.proc.on("error", (err) => {
      this.logs.push(`[spawn error] ${err.message}\n`);
      this.state = "error";
      this.emit("state", this.state);
      this.emit("log", `[spawn error] ${err.message}\n`);
    });

    // Fallback readiness check: poll /health in case the log pattern doesn't match
    // this llama.cpp build's exact wording.
    this._pollHealth();

    return true;
  }

  async _pollHealth() {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (!this.proc) return;
      if (this.state === "running") return;
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/health`);
        if (res.ok) {
          this.state = "running";
          this.emit("state", this.state);
          return;
        }
      } catch {
        // not up yet
      }
    }
  }

  stop() {
    if (!this.proc) return false;
    this.proc.kill();
    return true;
  }

  getStatus() {
    return {
      state: this.state,
      activePresetId: this.activePresetId,
      port: this.port,
      logs: this.logs.join(""),
    };
  }
}

module.exports = { ServerManager };
