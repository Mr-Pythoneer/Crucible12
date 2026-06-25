function renderSidebar() {
  const list = document.getElementById("convList");
  list.innerHTML = "";
  for (const conv of state.conversations) {
    const item = document.createElement("div");
    item.className = "conv-item" + (conv.id === state.activeConversationId ? " active" : "");
    const label = document.createElement("span");
    label.textContent = conv.title || "New chat";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";
    item.appendChild(label);

    const del = document.createElement("span");
    del.className = "conv-del";
    del.textContent = "✕";
    del.onclick = (e) => {
      e.stopPropagation();
      deleteConversation(conv.id);
    };
    item.appendChild(del);

    item.onclick = () => openConversation(conv.id);
    list.appendChild(item);
  }
  renderSidebarStatus();
}

function renderSidebarStatus() {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");
  const s = state.serverStatus.state;
  dot.className = "status-dot " + s;
  const preset = state.presets.find((p) => p.id === state.serverStatus.activePresetId);
  if (s === "running") text.textContent = preset ? preset.label : "Server running";
  else if (s === "starting") text.textContent = "Starting…";
  else if (s === "error") text.textContent = "Server error";
  else text.textContent = "Server stopped";
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("newChatBtn").onclick = newChat;
  document.getElementById("setupLink").onclick = () => setView("setup");
  document.getElementById("serverStatusLink").onclick = () => setView("setup");
});
