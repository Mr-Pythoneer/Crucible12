const GROUP_LABELS = { cpu: "CPU only", gpu: "Single GPU tiers", big: "Big rigs (MoE, GPU + RAM)" };

let pickerUnsubscribe = null;
let downloadingId = null;

function formatBytes(n) {
  if (!n) return "";
  const gb = n / 1e9;
  return gb >= 1 ? `${gb.toFixed(1)}GB` : `${(n / 1e6).toFixed(0)}MB`;
}

function openModelPicker() {
  closeModelPicker();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modelPickerOverlay";
  overlay.onclick = (e) => { if (e.target === overlay) closeModelPicker(); };

  const modal = document.createElement("div");
  modal.className = "modal";

  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `<h2>Choose a model</h2>`;
  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.textContent = "✕";
  closeBtn.onclick = closeModelPicker;
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = document.createElement("div");
  body.className = "modal-body";
  body.id = "modelPickerBody";
  modal.appendChild(body);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  renderPickerBody();

  pickerUnsubscribe = window.crucible.presets.onDownloadProgress((progress) => {
    downloadingId = progress.presetId;
    const row = document.querySelector(`[data-preset-row="${progress.presetId}"] .preset-progress`);
    if (row && progress.total) {
      row.textContent = `${(progress.downloaded / 1e9).toFixed(1)} / ${(progress.total / 1e9).toFixed(1)}GB`;
    } else if (row) {
      row.textContent = `${(progress.downloaded / 1e9).toFixed(1)}GB`;
    }
  });
}

function closeModelPicker() {
  const overlay = document.getElementById("modelPickerOverlay");
  if (overlay) overlay.remove();
  if (pickerUnsubscribe) { pickerUnsubscribe(); pickerUnsubscribe = null; }
}

function renderPickerBody() {
  const body = document.getElementById("modelPickerBody");
  if (!body) return;
  body.innerHTML = "";
  const groups = ["cpu", "gpu", "big"];
  for (const group of groups) {
    const presetsInGroup = state.presets.filter((p) => p.group === group);
    if (!presetsInGroup.length) continue;
    const label = document.createElement("div");
    label.className = "group-label";
    label.textContent = GROUP_LABELS[group];
    body.appendChild(label);
    for (const preset of presetsInGroup) {
      body.appendChild(renderPresetRow(preset));
    }
  }
}

function renderPresetRow(preset) {
  const row = document.createElement("div");
  row.className = "preset-row" + (preset.id === state.serverStatus.activePresetId ? " selected" : "");
  row.dataset.presetRow = preset.id;

  const info = document.createElement("div");
  info.className = "preset-info";
  info.innerHTML = `
    <div class="preset-name">${preset.label}</div>
    <div class="preset-model">${preset.model} · ${formatBytes(preset.approxSizeGB * 1e9)}</div>
    <div class="preset-req">${preset.requirement}</div>
  `;
  row.appendChild(info);

  const progress = document.createElement("div");
  progress.className = "preset-progress";
  row.appendChild(progress);

  const action = document.createElement("button");
  action.className = "preset-action";

  const isActiveRunning = preset.id === state.serverStatus.activePresetId && state.serverStatus.state === "running";
  const isDownloadingThis = downloadingId === preset.id;

  if (isActiveRunning) {
    action.textContent = "Running";
    action.disabled = true;
  } else if (isDownloadingThis) {
    action.textContent = "Downloading…";
    action.disabled = true;
  } else if (!preset.downloaded) {
    action.textContent = `Download`;
    action.onclick = () => startDownload(preset.id);
  } else {
    action.textContent = "Use";
    action.classList.add("primary");
    action.onclick = () => useModel(preset.id);
  }
  row.appendChild(action);
  return row;
}

async function startDownload(presetId) {
  downloadingId = presetId;
  renderPickerBody();
  try {
    await window.crucible.presets.download(presetId);
    await refreshPresets();
  } catch (err) {
    alert("Download failed: " + err.message);
  }
  downloadingId = null;
  renderPickerBody();
}

async function useModel(presetId) {
  const runtimeStatus = await window.crucible.runtime.status();
  if (!runtimeStatus.ready) {
    closeModelPicker();
    setView("setup");
    return;
  }
  try {
    await window.crucible.server.start(presetId, {});
    await refreshServerStatus();
    renderPickerBody();
    render();
  } catch (err) {
    alert("Couldn't start server: " + err.message);
  }
}
