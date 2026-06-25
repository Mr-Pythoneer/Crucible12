let runtimeProgressUnsub = null;
let serverLogUnsub = null;
let runtimeBusy = false;
let runtimeProgressText = "";

function renderSetupView() {
  const main = document.getElementById("mainPanel");
  main.innerHTML = "";

  const topbar = document.createElement("div");
  topbar.className = "topbar";
  topbar.innerHTML = `<div class="model-chip" style="cursor:default"><span class="chip-label">Setup &amp; models</span></div>`;
  main.appendChild(topbar);

  const view = document.createElement("div");
  view.className = "setup-view";
  const inner = document.createElement("div");
  inner.className = "setup-inner";
  inner.innerHTML = `
    <h1>Setup &amp; models</h1>
    <div class="sub">Everything here runs locally — nothing is uploaded except the one-time model/runtime download from Hugging Face / GitHub.</div>
  `;

  inner.appendChild(renderRuntimeCard());
  inner.appendChild(renderModelsCard());
  inner.appendChild(renderStorageCard());
  inner.appendChild(renderServerCard());

  view.appendChild(inner);
  main.appendChild(view);

  if (!serverLogUnsub) {
    const MAX_LOG_CHARS = 50000; // unbounded textContent growth over a long-running server is a real leak
    serverLogUnsub = window.crucible.server.onLog((text) => {
      const box = document.getElementById("serverLogBox");
      if (box) {
        box.textContent += text;
        if (box.textContent.length > MAX_LOG_CHARS) {
          box.textContent = box.textContent.slice(-MAX_LOG_CHARS);
        }
        box.scrollTop = box.scrollHeight;
      }
    });
  }
}

function renderRuntimeCard() {
  const card = document.createElement("div");
  card.className = "setup-card";
  card.id = "runtimeCard";
  const isWin = state.systemInfo.platform === "win32";
  const isLinux = state.systemInfo.platform === "linux";
  const backendOptions = isWin
    ? [["cuda", "NVIDIA (CUDA)"], ["vulkan", "Vulkan (any GPU)"], ["cpu", "CPU only"]]
    : isLinux
    ? [["vulkan", "Vulkan (any GPU)"], ["cpu", "CPU only"]]
    : null;

  card.innerHTML = `
    <h3>1. Inference engine (llama.cpp)</h3>
    <p>Downloads the matching prebuilt llama-server for your OS from the official llama.cpp releases. One-time, a few MB to a few hundred MB depending on backend.</p>
    ${backendOptions ? `<div class="backend-options" id="backendOptions">${backendOptions
      .map(
        ([val, label]) =>
          `<label><input type="radio" name="backend" value="${val}" ${val === (state.settings[isWin ? "winBackend" : "linuxBackend"]) ? "checked" : ""}><span>${label}</span></label>`
      )
      .join("")}</div><div style="height:10px"></div>` : ""}
    <div class="setup-row">
      <button class="btn" id="installRuntimeBtn">Checking…</button>
      <span id="runtimeStatusText" style="font-size:12.5px;color:var(--text-dim)"></span>
    </div>
  `;
  refreshRuntimeStatus(card);

  if (backendOptions) {
    card.querySelectorAll('input[name="backend"]').forEach((el) => {
      el.onchange = () => {
        const key = isWin ? "winBackend" : "linuxBackend";
        window.crucible.settings.set({ [key]: el.value });
        state.settings[key] = el.value;
      };
    });
  }
  return card;
}

async function refreshRuntimeStatus(card) {
  const btn = card.querySelector("#installRuntimeBtn");
  const statusText = card.querySelector("#runtimeStatusText");
  const status = await window.crucible.runtime.status();
  if (status.ready) {
    btn.textContent = "Reinstall";
    btn.classList.add("secondary");
    statusText.textContent = "Ready — " + status.path;
  } else {
    btn.textContent = "Install";
    btn.classList.remove("secondary");
    statusText.textContent = runtimeProgressText || "Not installed yet.";
  }
  btn.disabled = runtimeBusy;
  btn.onclick = () => installRuntime(card);
}

async function installRuntime(card) {
  runtimeBusy = true;
  const isWin = state.systemInfo.platform === "win32";
  const backend = isWin ? state.settings.winBackend : state.settings.linuxBackend;
  await refreshRuntimeStatus(card);

  if (!runtimeProgressUnsub) {
    runtimeProgressUnsub = window.crucible.runtime.onProgress((p) => {
      const statusText = card.querySelector("#runtimeStatusText");
      if (!statusText) return;
      if (p.stage === "querying-release") runtimeProgressText = "Checking latest llama.cpp release…";
      else if (p.stage === "downloading") {
        const pct = p.total ? ` (${((p.downloaded / p.total) * 100).toFixed(0)}%)` : "";
        runtimeProgressText = `Downloading ${p.asset}${pct}`;
      } else if (p.stage === "extracting") runtimeProgressText = `Extracting ${p.asset}…`;
      statusText.textContent = runtimeProgressText;
    });
  }

  try {
    await window.crucible.runtime.ensure(backend);
    runtimeProgressText = "";
  } catch (err) {
    runtimeProgressText = "Failed: " + err.message;
  }
  runtimeBusy = false;
  refreshRuntimeStatus(card);
}

function renderModelsCard() {
  const card = document.createElement("div");
  card.className = "setup-card";
  card.innerHTML = `
    <h3>2. Pick a model</h3>
    <p>From a 3B CPU-only model up to an 80B MoE split across GPU and RAM — pick whatever fits your hardware.</p>
    <div class="setup-row"><button class="btn" id="openPickerBtn">Open model picker</button></div>
  `;
  card.querySelector("#openPickerBtn").onclick = () => openModelPicker();
  return card;
}

function renderStorageCard() {
  const card = document.createElement("div");
  card.className = "setup-card";
  card.innerHTML = `
    <h3>Storage &amp; network</h3>
    <div class="field-row">
      <label>Models folder</label>
      <input type="text" id="modelsDirInput" value="${state.settings.modelsDir}" readonly>
      <button class="btn secondary" id="chooseModelsDirBtn">Change…</button>
    </div>
    <div class="field-row">
      <label>Runtime folder</label>
      <input type="text" id="runtimeDirInput" value="${state.settings.runtimeDir}" readonly>
      <button class="btn secondary" id="chooseRuntimeDirBtn">Change…</button>
    </div>
    <div class="field-row">
      <label>Server port</label>
      <input type="text" id="portInput" value="${state.settings.port}">
    </div>
  `;
  card.querySelector("#chooseModelsDirBtn").onclick = async () => {
    const dir = await window.crucible.settings.chooseFolder(state.settings.modelsDir);
    if (dir) {
      await window.crucible.settings.set({ modelsDir: dir });
      state.settings.modelsDir = dir;
      card.querySelector("#modelsDirInput").value = dir;
      await refreshPresets();
    }
  };
  card.querySelector("#chooseRuntimeDirBtn").onclick = async () => {
    const dir = await window.crucible.settings.chooseFolder(state.settings.runtimeDir);
    if (dir) {
      await window.crucible.settings.set({ runtimeDir: dir });
      state.settings.runtimeDir = dir;
      card.querySelector("#runtimeDirInput").value = dir;
    }
  };
  card.querySelector("#portInput").onchange = async (e) => {
    const port = parseInt(e.target.value, 10) || 8080;
    await window.crucible.settings.set({ port });
    state.settings.port = port;
  };
  return card;
}

function renderServerCard() {
  const card = document.createElement("div");
  card.className = "setup-card";
  const preset = state.presets.find((p) => p.id === state.settings.selectedPreset);
  card.innerHTML = `
    <h3>Server</h3>
    <p>${preset ? `Selected model: <strong>${preset.label}</strong> (${preset.model})` : "No model selected yet — use the picker above."}</p>
    <div class="setup-row" style="margin-bottom:12px">
      <button class="btn" id="startServerBtn" ${!preset || !preset.downloaded ? "disabled" : ""}>Start</button>
      <button class="btn secondary" id="stopServerBtn">Stop</button>
      <span style="font-size:12.5px;color:var(--text-dim)">${state.serverStatus.state}</span>
    </div>
    <div class="log-box" id="serverLogBox"></div>
  `;
  card.querySelector("#startServerBtn").onclick = async () => {
    try {
      await window.crucible.server.start(state.settings.selectedPreset, {});
      await refreshServerStatus();
      renderSetupView();
    } catch (err) {
      alert("Couldn't start server: " + err.message);
    }
  };
  card.querySelector("#stopServerBtn").onclick = async () => {
    await window.crucible.server.stop();
    await refreshServerStatus();
    renderSetupView();
  };
  return card;
}
