function renderChatView() {
  const main = document.getElementById("mainPanel");
  main.innerHTML = "";

  const topbar = document.createElement("div");
  topbar.className = "topbar";
  const chip = document.createElement("div");
  chip.className = "model-chip";
  const activePreset = state.presets.find((p) => p.id === state.serverStatus.activePresetId);
  chip.innerHTML = `<span class="chip-label">${activePreset ? activePreset.label + " — " + activePreset.model : "No model running — click to choose one"}</span><span class="chevron">▾</span>`;
  chip.onclick = () => openModelPicker();
  topbar.appendChild(chip);
  main.appendChild(topbar);

  const conv = activeConversation();

  if (!conv || conv.messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <div class="big">Crucible12</div>
      <div class="hint">Fully local, fully offline. Pick a model with the chip above, then start typing — nothing leaves this machine.</div>
    `;
    main.appendChild(empty);
  } else {
    const messages = document.createElement("div");
    messages.className = "messages";
    messages.id = "messagesScroll";
    const inner = document.createElement("div");
    inner.className = "messages-inner";
    for (const msg of conv.messages) {
      inner.appendChild(renderMessage(msg));
    }
    messages.appendChild(inner);
    main.appendChild(messages);
    requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  }

  main.appendChild(renderComposer());
  wireCopyButtons(main);
}

function renderMessage(msg) {
  const row = document.createElement("div");
  row.className = "msg " + msg.role;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (msg.role === "user") {
    bubble.textContent = msg.content;
  } else {
    bubble.innerHTML = msg.content ? window.renderMarkdown(msg.content) : '<span class="typing-dots"><span></span><span></span><span></span></span>';
  }
  row.appendChild(bubble);
  return row;
}

function renderComposer() {
  const wrap = document.createElement("div");
  wrap.className = "composer-wrap";
  const composer = document.createElement("div");
  composer.className = "composer";

  const textarea = document.createElement("textarea");
  textarea.id = "composerInput";
  textarea.rows = 1;
  textarea.placeholder = state.serverStatus.state === "running" ? "Message Crucible12…" : "Start a server first (Setup & models)…";
  textarea.disabled = state.sending;
  textarea.oninput = () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(160, textarea.scrollHeight) + "px";
  };
  textarea.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  composer.appendChild(textarea);

  const row = document.createElement("div");
  row.className = "composer-row";
  const pill = document.createElement("div");
  pill.className = "composer-model-pill";
  const activePreset = state.presets.find((p) => p.id === state.serverStatus.activePresetId);
  pill.textContent = activePreset ? activePreset.label : "Choose a model";
  pill.onclick = () => openModelPicker();
  row.appendChild(pill);

  const sendBtn = document.createElement("button");
  sendBtn.className = "send-btn";
  sendBtn.textContent = "↑";
  sendBtn.disabled = state.sending || state.serverStatus.state !== "running";
  sendBtn.onclick = sendMessage;
  row.appendChild(sendBtn);

  composer.appendChild(row);
  wrap.appendChild(composer);
  return wrap;
}

function wireCopyButtons(root) {
  root.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.onclick = () => {
      const target = document.getElementById(btn.dataset.copyTarget);
      navigator.clipboard.writeText(target ? target.textContent : "").then(() => {
        btn.textContent = "Copied";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1500);
      });
    };
  });
}

async function sendMessage() {
  const textarea = document.getElementById("composerInput");
  const text = textarea.value.trim();
  if (!text || state.sending) return;
  if (state.serverStatus.state !== "running") return;

  let conv = activeConversation();
  if (!conv) {
    conv = { id: newConversationId(), title: "New chat", messages: [] };
    state.conversations.unshift(conv);
    state.activeConversationId = conv.id;
  }
  conv.messages.push({ role: "user", content: text });
  if (conv.messages.length === 1) conv.title = text.slice(0, 48);
  conv.messages.push({ role: "assistant", content: "" });
  state.sending = true;
  render();
  persistActiveConversation();

  const port = state.settings.port;
  const assistantMsg = conv.messages[conv.messages.length - 1];

  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conv.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        temperature: 0.7,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Server returned HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            assistantMsg.content += delta;
            updateLastBubble(assistantMsg.content);
          }
        } catch {
          // partial/non-JSON line — ignore, next chunk will complete it
        }
      }
    }
  } catch (err) {
    assistantMsg.content += `\n\n*[error: ${err.message}]*`;
    updateLastBubble(assistantMsg.content);
  }

  state.sending = false;
  persistActiveConversation();
  render();
}

function updateLastBubble(content) {
  const messages = document.getElementById("messagesScroll");
  if (!messages) return;
  const bubbles = messages.querySelectorAll(".msg.assistant .bubble");
  const last = bubbles[bubbles.length - 1];
  if (last) {
    last.innerHTML = window.renderMarkdown(content);
    wireCopyButtons(last);
    messages.scrollTop = messages.scrollHeight;
  }
}
