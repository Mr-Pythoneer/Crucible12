// Minimal, dependency-free markdown -> HTML renderer for chat messages.
// Deliberately small in scope: fenced code blocks (with a language label + copy
// button), inline code, bold/italic, links, headers, and lists. No remote fonts,
// no CDN scripts — everything in this app works fully offline.

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return out;
}

function renderBlock(block) {
  const lines = block.split("\n");
  // headers
  const headerMatch = lines[0] && lines[0].match(/^(#{1,4})\s+(.*)$/);
  if (headerMatch && lines.length === 1) {
    const level = headerMatch[1].length + 2; // start at h3 to stay visually modest in a chat bubble
    return `<h${level}>${renderInline(headerMatch[2])}</h${level}>`;
  }
  // unordered list
  if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
    const items = lines.map((l) => `<li>${renderInline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("");
    return `<ul>${items}</ul>`;
  }
  // ordered list
  if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
    const items = lines.map((l) => `<li>${renderInline(l.replace(/^\s*\d+\.\s+/, ""))}</li>`).join("");
    return `<ol>${items}</ol>`;
  }
  return `<p>${lines.map(renderInline).join("<br>")}</p>`;
}

let codeBlockCounter = 0;

function renderCodeBlock(lang, code) {
  codeBlockCounter++;
  const id = `code-block-${codeBlockCounter}`;
  return `<div class="code-block">
    <div class="code-block-header">
      <span class="code-lang">${escapeHtml(lang || "text")}</span>
      <button class="copy-btn" data-copy-target="${id}">Copy</button>
    </div>
    <pre><code id="${id}">${escapeHtml(code)}</code></pre>
  </div>`;
}

function renderMarkdown(text) {
  if (!text) return "";
  const fenceRe = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let html = "";
  let match;
  while ((match = fenceRe.exec(text))) {
    const before = text.slice(lastIndex, match.index);
    html += before
      .split(/\n{2,}/)
      .filter((b) => b.trim())
      .map(renderBlock)
      .join("");
    html += renderCodeBlock(match[1], match[2].replace(/\n$/, ""));
    lastIndex = fenceRe.lastIndex;
  }
  const rest = text.slice(lastIndex);
  html += rest
    .split(/\n{2,}/)
    .filter((b) => b.trim())
    .map(renderBlock)
    .join("");
  return html;
}

window.renderMarkdown = renderMarkdown;
