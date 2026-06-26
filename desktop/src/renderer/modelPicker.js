const GROUP_LABELS = {
  cpu: "CPU only",
  gpu: "Single GPU tiers",
  big: "Big rigs (MoE, GPU + RAM)",
  custom: "Your Hugging Face models",
};

let pickerUnsubscribe = null;
let downloadingId = null;

// "Add from Hugging Face" sub-form state — separate from the preset
// download state above since these models aren't in state.presets until
// after a successful download.
let hfFormOpen = false;
let hfSearchBusy = false;
let hfSearchError = null;
let hfSearchResults = null; // { repoId, files: [{ key, parts, sizeBytes, label }] } | null
let hfDownloadingKey = null;

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
    if (row) {
      row.textContent = progress.total
        ? `${(progress.downloaded / 1e9).toFixed(1)} / ${(progress.total / 1e9).toFixed(1)}GB`
        : `${(progress.downloaded / 1e9).toFixed(1)}GB`;
    }
    // Custom-model downloads can't be matched by preset id up front (the id
    // is only computed once the main process resolves it) — but only one HF
    // download can be in flight from this form at a time, so just route any
    // progress event to whichever result row is currently marked downloading.
    if (hfDownloadingKey) {
      const hfRow = document.querySelector(`[data-hf-result="${hfDownloadingKey}"] .preset-progress`);
      if (hfRow) {
        const filePart = progress.fileCount > 1 ? ` (file ${progress.fileIndex}/${progress.fileCount})` : "";
        hfRow.textContent =
          (progress.total
            ? `${(progress.downloaded / 1e9).toFixed(1)} / ${(progress.total / 1e9).toFixed(1)}GB`
            : `${(progress.downloaded / 1e9).toFixed(1)}GB`) + filePart;
      }
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

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "btn secondary";
  toggleBtn.style.marginBottom = "10px";
  toggleBtn.textContent = hfFormOpen ? "− Add model from Hugging Face" : "+ Add model from Hugging Face";
  toggleBtn.onclick = () => {
    hfFormOpen = !hfFormOpen;
    if (!hfFormOpen) {
      hfSearchResults = null;
      hfSearchError = null;
    }
    renderPickerBody();
  };
  body.appendChild(toggleBtn);

  if (hfFormOpen) renderHfForm(body);

  const groups = ["cpu", "gpu", "big", "custom"];
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

function renderHfForm(body) {
  const card = document.createElement("div");
  card.className = "setup-card";
  card.style.marginBottom = "10px";

  const repoRow = document.createElement("div");
  repoRow.className = "field-row";
  repoRow.innerHTML = `
    <label>HF repo</label>
    <input type="text" id="hfRepoInput" placeholder="org/model-name">
  `;
  const searchBtn = document.createElement("button");
  searchBtn.className = "btn secondary";
  searchBtn.textContent = hfSearchBusy ? "Searching…" : "Search";
  searchBtn.disabled = hfSearchBusy;
  repoRow.appendChild(searchBtn);
  card.appendChild(repoRow);

  const repoInput = repoRow.querySelector("#hfRepoInput");
  if (hfSearchResults) repoInput.value = hfSearchResults.repoId;
  const doSearch = () => searchHf(repoInput.value.trim());
  searchBtn.onclick = doSearch;
  repoInput.onkeydown = (e) => { if (e.key === "Enter") doSearch(); };

  const hint = document.createElement("div");
  hint.style.fontSize = "12px";
  hint.style.color = "var(--text-dim)";
  hint.style.marginBottom = "8px";
  hint.textContent = 'e.g. "bartowski/Qwen2.5-Coder-7B-Instruct-GGUF" — browse huggingface.co for any GGUF repo.';
  card.appendChild(hint);

  if (hfSearchError) {
    const err = document.createElement("div");
    err.style.color = "var(--err, #e5534b)";
    err.style.fontSize = "12.5px";
    err.style.marginBottom = "8px";
    err.textContent = hfSearchError;
    card.appendChild(err);
  }

  if (hfSearchResults) {
    if (!hfSearchResults.files.length) {
      const empty = document.createElement("div");
      empty.style.fontSize = "12.5px";
      empty.style.color = "var(--text-dim)";
      empty.textContent = "No .gguf files found in that repo.";
      card.appendChild(empty);
    } else {
      for (const file of hfSearchResults.files) {
        card.appendChild(renderHfResultRow(hfSearchResults.repoId, file));
      }
    }
  }

  body.appendChild(card);
}

function renderHfResultRow(repoId, file) {
  const row = document.createElement("div");
  row.className = "preset-row";
  row.dataset.hfResult = file.key;

  const info = document.createElement("div");
  info.className = "preset-info";
  info.innerHTML = `
    <div class="preset-name">${file.label}</div>
    <div class="preset-model">${repoId} · ${formatBytes(file.sizeBytes)}</div>
  `;
  row.appendChild(info);

  const progress = document.createElement("div");
  progress.className = "preset-progress";
  row.appendChild(progress);

  const action = document.createElement("button");
  action.className = "preset-action";
  if (hfDownloadingKey === file.key) {
    action.textContent = "Downloading…";
    action.disabled = true;
  } else if (hfDownloadingKey) {
    action.textContent = "Download";
    action.disabled = true; // only one HF download from this form at a time
  } else {
    action.textContent = "Download";
    action.onclick = () => downloadHfResult(repoId, file);
  }
  row.appendChild(action);
  return row;
}

async function searchHf(repoId) {
  if (!repoId) return;
  hfSearchBusy = true;
  hfSearchError = null;
  renderPickerBody();
  try {
    const files = await window.crucible.customModels.search(repoId);
    hfSearchResults = { repoId, files };
  } catch (err) {
    hfSearchResults = null;
    hfSearchError = err.message;
  }
  hfSearchBusy = false;
  renderPickerBody();
}

async function downloadHfResult(repoId, file) {
  hfDownloadingKey = file.key;
  renderPickerBody();
  try {
    await window.crucible.customModels.add({
      repoId,
      parts: file.parts,
      label: file.label,
      sizeBytes: file.sizeBytes,
    });
    await refreshPresets();
    hfFormOpen = false;
    hfSearchResults = null;
  } catch (err) {
    alert("Download failed: " + err.message);
  } finally {
    hfDownloadingKey = null;
    // The progress listener sets downloadingId from every event it sees, including
    // this download's — clear it too, or the finished row gets stuck on "Downloading…"
    // forever since only startDownload()'s own flow normally resets it.
    downloadingId = null;
    renderPickerBody();
    render(); // refresh Setup/Chat too — same reasoning as startDownload below
  }
}

async function removeCustomModel(presetId) {
  if (!confirm("Remove this model and delete its downloaded files?")) return;
  try {
    await window.crucible.customModels.remove(presetId);
    await refreshPresets();
  } catch (err) {
    alert("Couldn't remove model: " + err.message);
  }
  renderPickerBody();
  render();
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

  const isActiveRunning = preset.id === state.serverStatus.activePresetId && state.serverStatus.state === "running";

  if (preset.group === "custom" && !isActiveRunning) {
    const removeBtn = document.createElement("button");
    removeBtn.className = "preset-action";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = () => removeCustomModel(preset.id);
    row.appendChild(removeBtn);
  }

  const action = document.createElement("button");
  action.className = "preset-action";

  const isDownloadingThis = downloadingId === preset.id;

  if (isActiveRunning) {
    action.textContent = "Running";
    action.disabled = true;
  } else if (isDownloadingThis) {
    action.textContent = "Downloading…";
    action.disabled = true;
  } else if (preset.group === "custom" && !preset.downloaded) {
    // Custom models only get added after a successful download, so this means
    // the files went missing on disk afterward (e.g. moved/cleared manually).
    // There's no stored file list to redownload from — Download here would just
    // hit "Unknown preset" in the main process. Removing the stale entry is the
    // only real recovery; re-adding means searching Hugging Face again.
    action.textContent = "Missing";
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
  render(); // refresh the underlying Setup/Chat view too — its Start button etc. depend on
            // preset.downloaded, which just changed, and they don't auto-refresh on their own
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
