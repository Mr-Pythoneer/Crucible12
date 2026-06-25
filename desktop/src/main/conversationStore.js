const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function storePath() {
  return path.join(app.getPath("userData"), "conversations.json");
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), "utf-8"));
  } catch {
    return [];
  }
}

function saveAll(conversations) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(conversations, null, 2));
}

function upsert(conversation) {
  const all = load();
  const idx = all.findIndex((c) => c.id === conversation.id);
  if (idx >= 0) all[idx] = conversation;
  else all.unshift(conversation);
  saveAll(all);
  return all;
}

function remove(id) {
  const all = load().filter((c) => c.id !== id);
  saveAll(all);
  return all;
}

module.exports = { load, saveAll, upsert, remove };
