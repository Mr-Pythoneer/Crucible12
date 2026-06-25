// Top-level state + view router. Keeps things framework-free: a single state
// object, a few render functions (sidebar.js / chat.js / setup.js / modelPicker.js),
// re-rendered on demand rather than reactively — simple enough at this scale.

const state = {
  view: "chat", // "chat" | "setup"
  conversations: [],
  activeConversationId: null,
  presets: [],
  serverStatus: { state: "stopped", activePresetId: null },
  settings: null,
  systemInfo: null,
  sending: false,
};

function activeConversation() {
  return state.conversations.find((c) => c.id === state.activeConversationId) || null;
}

function newConversationId() {
  return "c" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function refreshPresets() {
  state.presets = await window.crucible.presets.list();
}

async function refreshServerStatus() {
  state.serverStatus = await window.crucible.server.status();
  renderSidebarStatus();
}

function setView(view) {
  state.view = view;
  render();
}

function newChat() {
  const conv = { id: newConversationId(), title: "New chat", messages: [] };
  state.conversations.unshift(conv);
  state.activeConversationId = conv.id;
  state.view = "chat";
  render();
}

function openConversation(id) {
  state.activeConversationId = id;
  state.view = "chat";
  render();
}

async function deleteConversation(id) {
  await window.crucible.conversations.delete(id);
  state.conversations = state.conversations.filter((c) => c.id !== id);
  if (state.activeConversationId === id) state.activeConversationId = null;
  render();
}

function persistActiveConversation() {
  const conv = activeConversation();
  if (conv) window.crucible.conversations.save(conv);
}

function render() {
  renderSidebar();
  if (state.view === "setup") {
    renderSetupView();
  } else {
    renderChatView();
  }
}

async function boot() {
  state.settings = await window.crucible.settings.get();
  state.systemInfo = await window.crucible.system.info();
  state.conversations = await window.crucible.conversations.list();
  await refreshPresets();
  await refreshServerStatus();

  if (!state.activeConversationId && state.conversations.length) {
    state.activeConversationId = state.conversations[0].id;
  }

  const runtimeStatus = await window.crucible.runtime.status();
  if (!runtimeStatus.ready || !state.settings.selectedPreset) {
    state.view = "setup";
  }

  window.crucible.server.onState(async ({ state: s }) => {
    state.serverStatus.state = s;
    renderSidebarStatus();
    if (state.view === "setup") renderSetupView();
  });

  render();
}

document.addEventListener("DOMContentLoaded", boot);
