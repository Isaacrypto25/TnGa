/* ═══════════════════════════════════════════════════════
   CLAW DEVOPS AGENT v2 — editor.js
   Real-time file editor with AI-powered edits via Claude
═══════════════════════════════════════════════════════ */

const DEFAULT_FILES = {
  "backend/server.js": `/**
 * CLAW DEVOPS AGENT — Backend Server
 * Node.js / Express
 */
const express = require("express");
const cors    = require("cors");
const http    = require("http");

const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(\`🦀 Claw Agent backend rodando na porta \${PORT}\`);
});
`,
  "backend/routes/agent.js": `/**
 * ROUTE: /api/agent
 * Processa mensagens do chat e executa ferramentas
 */
const express   = require("express");
const router    = express.Router();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

router.post("/chat", async (req, res) => {
  const { messages, systemContext } = req.body;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1800,
      system: systemContext,
      messages,
    });
    res.json({ content: response.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`,
  "frontend/index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Frontend</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <h1>Frontend App</h1>
  </div>
  <script src="app.js"></script>
</body>
</html>
`,
  "frontend/style.css": `/* Frontend Styles */
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, sans-serif;
  background: #0a0a0a;
  color: #fff;
}
#app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
`,
  "database/schema.sql": `-- Database Schema
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`,
};

/* ── RENDER EDITOR TAB ──────────────────────────── */
function renderEditorTab() {
  if (Object.keys(STATE.files).length === 0) {
    Object.assign(STATE.files, DEFAULT_FILES);
  }
  renderFileTree();
  if (!STATE.activeFile && Object.keys(STATE.files).length > 0) {
    loadFileInEditor(Object.keys(STATE.files)[0]);
  }
}

function renderFileTree() {
  const list = _el("file-list");
  if (!list) return;
  list.innerHTML = Object.keys(STATE.files).map(path => {
    const modified = STATE.modifiedFiles.has(path);
    const active   = STATE.activeFile === path;
    const parts    = path.split("/");
    const filename = parts[parts.length - 1];
    const dir      = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    return `<div class="file-item ${active ? "active" : ""}" onclick="loadFileInEditor('${escAttr(path)}')">
      ${modified ? `<span class="file-modified-dot"></span>` : `<span style="width:5px"></span>`}
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${dir ? `<span style="font-size:8px;color:var(--text-dim);">${escHtml(dir)}/</span>` : ""}${escHtml(filename)}
      </span>
    </div>`;
  }).join("");
}

function loadFileInEditor(path) {
  STATE.activeFile = path;
  const ta = _el("code-editor");
  if (!ta) return;
  ta.value = STATE.files[path] || "";
  _el("editor-filename").textContent = path;
  _el("editor-modified-badge").textContent = STATE.modifiedFiles.has(path) ? "● MODIFICADO" : "";
  updateEditorStats();
  renderFileTree();
}

function onEditorInput() {
  if (!STATE.activeFile) return;
  STATE.files[STATE.activeFile] = _el("code-editor").value;
  STATE.modifiedFiles.add(STATE.activeFile);
  _el("editor-modified-badge").textContent = "● MODIFICADO";
  updateEditorStats();
}

function updateEditorStats() {
  const ta = _el("code-editor");
  if (!ta) return;
  _el("editor-stat-lines").textContent = ta.value.split("\n").length + " linhas";
  _el("editor-stat-chars").textContent = ta.value.length + " chars";
}

function saveCurrentFile() {
  if (!STATE.activeFile) return;
  STATE.modifiedFiles.delete(STATE.activeFile);
  _el("editor-modified-badge").textContent = "";
  _el("editor-status").textContent = "Salvo " + timePT();
  addLog("success", "EDITOR", "Arquivo salvo: " + STATE.activeFile);
  renderFileTree();
  setTimeout(() => { const s=_el("editor-status"); if(s) s.textContent=""; }, 3000);
}

function addNewFile() {
  const name = prompt("Nome do arquivo (ex: backend/routes/auth.js):");
  if (!name || !name.trim()) return;
  STATE.files[name.trim()] = "// " + name.trim() + "\n";
  loadFileInEditor(name.trim());
  renderFileTree();
}

function handleEditorKeydown(e) {
  if (e.ctrlKey && e.key === "s") { e.preventDefault(); saveCurrentFile(); return; }
  if (e.key === "Tab") {
    e.preventDefault();
    const ta = e.target, start = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + "  " + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = start + 2;
    onEditorInput();
  }
}

/* ── AI EDIT ─────────────────────────────────────── */
async function applyAiEdit() {
  const instruction = _el("ai-edit-instruction").value.trim();
  if (!instruction || !STATE.activeFile) { alert("Selecione um arquivo e descreva a mudança."); return; }
  if (!isConfigured()) { alert("Configure a Anthropic API Key primeiro (⚙ API KEYS)."); return; }

  const btn = document.querySelector(".ai-edit-btn");
  btn.disabled = true; btn.textContent = "✦ APLICANDO...";
  addLog("info", "AGENT", `AI Edit em ${STATE.activeFile}: ${instruction.substring(0,60)}`);

  try {
    const currentContent = STATE.files[STATE.activeFile] || "";
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": KEYS.anthropic,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: `Você é um assistente de código. O arquivo atual é:\n\nArquivo: ${STATE.activeFile}\n\`\`\`\n${currentContent}\n\`\`\`\n\nInstrução: ${instruction}\n\nResponda APENAS com o código completo e atualizado do arquivo, sem explicações, sem markdown, sem backticks. Apenas o código puro.`
        }]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Erro " + res.status);
    const newContent = data.content?.[0]?.text || "";
    if (newContent) {
      STATE.files[STATE.activeFile] = newContent;
      STATE.modifiedFiles.add(STATE.activeFile);
      _el("code-editor").value = newContent;
      _el("editor-modified-badge").textContent = "● MODIFICADO";
      updateEditorStats();
      addLog("success", "AGENT", "AI Edit aplicado em " + STATE.activeFile);
    }
  } catch(e) {
    addLog("error", "AGENT", "AI Edit falhou: " + e.message);
    alert("Erro ao aplicar IA: " + e.message);
  }
  btn.disabled = false; btn.textContent = "✦ APLICAR IA";
}
