/* ═══════════════════════════════════════════════════════
   CLAW DEVOPS AGENT v2 — apikeys.js
   API Key management: modal, test, save, load
═══════════════════════════════════════════════════════ */

function openApiModal() {
  loadKeysIntoForm();
  _el("api-modal-overlay").classList.add("show");
}

function closeApiModal() {
  _el("api-modal-overlay").classList.remove("show");
}

function loadKeysIntoForm() {
  _el("key-anthropic").value      = KEYS.anthropic     || "";
  _el("key-github").value         = KEYS.github        || "";
  _el("key-github-repo").value    = KEYS.githubRepo    || "";
  _el("key-render").value         = KEYS.render        || "";
  _el("key-render-service").value = KEYS.renderService || "";
  _el("key-supabase-url").value   = KEYS.supabaseUrl   || "";
  _el("key-supabase").value       = KEYS.supabase      || "";
  updateFormStatuses();
}

function toggleVisibility(inputId, btn) {
  const inp = _el(inputId);
  inp.type = inp.type === "password" ? "text" : "password";
  btn.textContent = inp.type === "password" ? "👁" : "🙈";
}

function onKeyInput(service) {
  setKeyStatus(service, "none", "editando...");
}

function setKeyStatus(service, status, text) {
  KEY_STATUS[service] = status;
  const dotEl = _el("status-" + service);
  const txtEl = _el("text-status-" + service);
  if (dotEl) dotEl.className = "api-status-indicator " + status;
  if (txtEl) {
    txtEl.textContent = text || "";
    txtEl.style.color = status === "ok"   ? COLORS.green  :
                        status === "fail" ? COLORS.red    :
                        status === "loading" ? COLORS.yellow : COLORS.textDim;
  }
}

function updateFormStatuses() {
  if (KEYS.anthropic) setKeyStatus("anthropic", KEYS.anthropic.length > 10 ? "ok" : "none", KEYS.anthropic.length > 10 ? "✓ salva" : "");
  if (KEYS.github)    setKeyStatus("github",    KEYS.github.length > 5    ? "ok" : "none", KEYS.github.length > 5    ? "✓ salvo" : "");
  if (KEYS.render)    setKeyStatus("render",    KEYS.render.length > 5    ? "ok" : "none", KEYS.render.length > 5    ? "✓ salvo" : "");
  if (KEYS.supabase)  setKeyStatus("supabase",  KEYS.supabase.length > 10 ? "ok" : "none", KEYS.supabase.length > 10 ? "✓ salva" : "");
}

/* ── TEST FUNCTIONS ─────────────────────────────── */
async function testAnthropicKey() {
  const key = _el("key-anthropic").value.trim();
  if (!key) { alert("Cole sua Anthropic API Key primeiro."); return; }
  const btn = _el("test-anthropic");
  btn.disabled = true; btn.textContent = "TESTANDO...";
  setKeyStatus("anthropic", "loading", "testando...");
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 16, messages: [{ role: "user", content: "ping" }] })
    });
    const data = await res.json();
    if (res.ok && data.content) {
      setKeyStatus("anthropic", "ok", "✓ válida");
      _el("key-anthropic").className = "api-input valid";
    } else {
      setKeyStatus("anthropic", "fail", "✗ " + (data.error?.message || res.status));
      _el("key-anthropic").className = "api-input error";
    }
  } catch(e) {
    setKeyStatus("anthropic", "fail", "✗ erro de rede");
    _el("key-anthropic").className = "api-input error";
  }
  btn.disabled = false; btn.textContent = "TESTAR";
}

async function testGithubKey() {
  const key  = _el("key-github").value.trim();
  const repo = _el("key-github-repo").value.trim();
  if (!key) { alert("Cole seu GitHub Token primeiro."); return; }
  const btn = _el("test-github");
  btn.disabled = true; btn.textContent = "TESTANDO...";
  setKeyStatus("github", "loading", "testando...");
  try {
    const url = repo ? `https://api.github.com/repos/${repo}` : "https://api.github.com/user";
    const res = await fetch(url, { headers: { Authorization: "Bearer " + key } });
    if (res.ok) {
      const data = await res.json();
      const label = repo ? (data.full_name || repo) : (data.login || "ok");
      setKeyStatus("github", "ok", "✓ " + label);
      _el("key-github").className = "api-input valid";
    } else {
      setKeyStatus("github", "fail", "✗ " + res.status);
      _el("key-github").className = "api-input error";
    }
  } catch(e) {
    setKeyStatus("github", "fail", "✗ erro de rede");
    _el("key-github").className = "api-input error";
  }
  btn.disabled = false; btn.textContent = "TESTAR";
}

async function testRenderKey() {
  const key = _el("key-render").value.trim();
  if (!key) { alert("Cole sua Render API Key primeiro."); return; }
  const btn = _el("test-render");
  btn.disabled = true; btn.textContent = "TESTANDO...";
  setKeyStatus("render", "loading", "testando...");
  try {
    const res = await fetch("https://api.render.com/v1/services?limit=1", {
      headers: { Authorization: "Bearer " + key }
    });
    if (res.ok) {
      setKeyStatus("render", "ok", "✓ conectado");
      _el("key-render").className = "api-input valid";
    } else {
      setKeyStatus("render", "fail", "✗ " + res.status);
      _el("key-render").className = "api-input error";
    }
  } catch(e) {
    setKeyStatus("render", "fail", "✗ erro de rede");
    _el("key-render").className = "api-input error";
  }
  btn.disabled = false; btn.textContent = "TESTAR";
}

async function testSupabaseKey() {
  const url = _el("key-supabase-url").value.trim();
  const key  = _el("key-supabase").value.trim();
  if (!url || !key) { alert("Preencha URL e Service Key do Supabase."); return; }
  const btn = _el("test-supabase");
  btn.disabled = true; btn.textContent = "TESTANDO...";
  setKeyStatus("supabase", "loading", "testando...");
  try {
    const res = await fetch(url.replace(/\/$/, "") + "/rest/v1/", {
      headers: { apikey: key, Authorization: "Bearer " + key }
    });
    if (res.ok || res.status === 200) {
      setKeyStatus("supabase", "ok", "✓ conectado");
      _el("key-supabase").className = "api-input valid";
    } else {
      setKeyStatus("supabase", "fail", "✗ " + res.status);
      _el("key-supabase").className = "api-input error";
    }
  } catch(e) {
    setKeyStatus("supabase", "fail", "✗ erro de rede");
    _el("key-supabase").className = "api-input error";
  }
  btn.disabled = false; btn.textContent = "TESTAR";
}

/* ── SAVE / CLEAR ────────────────────────────────── */
function saveApiKeys() {
  KEYS.anthropic     = _el("key-anthropic").value.trim();
  KEYS.github        = _el("key-github").value.trim();
  KEYS.githubRepo    = _el("key-github-repo").value.trim();
  KEYS.render        = _el("key-render").value.trim();
  KEYS.renderService = _el("key-render-service").value.trim();
  KEYS.supabaseUrl   = _el("key-supabase-url").value.trim();
  KEYS.supabase      = _el("key-supabase").value.trim();
  persistKeys();

  const banner = _el("api-saved-banner");
  banner.style.display = "flex";
  setTimeout(() => banner.style.display = "none", 3000);

  updateConnStatus();

  if (isConfigured()) {
    _el("setup-screen").classList.remove("show");
    _el("config-btn").classList.add("configured");
    _el("config-btn").textContent = "✓ KEYS";
    addLog("success", "CONFIG", "API Keys salvas — agente conectado");
  }
}

function clearAllKeys() {
  if (!confirm("Tem certeza? Isso apagará todas as API Keys salvas.")) return;
  Object.keys(KEYS).forEach(k => KEYS[k] = "");
  localStorage.removeItem("claw_api_keys");
  loadKeysIntoForm();
  updateConnStatus();
  _el("config-btn").classList.remove("configured");
  _el("config-btn").textContent = "⚙ API KEYS";
}

/* ── CONNECTION STATUS CHIPS ─────────────────────── */
function updateConnStatus() {
  const chips = [
    { label:"Claude",   ok: KEYS.anthropic.length  > 10 },
    { label:"GitHub",   ok: KEYS.github.length     > 5  },
    { label:"Render",   ok: KEYS.render.length     > 5  },
    { label:"Supabase", ok: KEYS.supabase.length   > 10 },
  ];
  _el("conn-status").innerHTML = chips.map(c => `
    <span class="conn-chip ${c.ok ? "ok" : "none"}">
      <span style="width:5px;height:5px;border-radius:50%;background:${c.ok ? "var(--green)" : "var(--text-dim)"};display:inline-block;"></span>
      ${c.label}
    </span>`).join("");
}
