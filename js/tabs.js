/* ═══════════════════════════════════════════════════════
   CLAW DEVOPS AGENT v2 — tabs.js
   Tab routing + render functions for all panels
═══════════════════════════════════════════════════════ */

const TABS = [
  { id:"dashboard",  icon:"⬡", label:"Dashboard" },
  { id:"github",     icon:"◈", label:"GitHub"    },
  { id:"render",     icon:"◉", label:"Render"    },
  { id:"supabase",   icon:"◆", label:"Supabase"  },
  { id:"logs",       icon:"≡", label:"Logs"      },
  { id:"errors",     icon:"⚠", label:"Erros",    badge:"error"    },
  { id:"approvals",  icon:"◎", label:"Aprovações",badge:"approval" },
  { id:"agent",      icon:"✦", label:"Agente"    },
  { id:"editor",     icon:"✎", label:"Editor"    },
];

function buildTabs() {
  const container = _el("tabs");
  container.innerHTML = TABS.map(t => `
    <button class="tab-btn${t.id === STATE.tab ? " active" : ""}"
            onclick="switchTab('${t.id}')" data-tab="${t.id}">
      <span class="tab-icon">${t.icon}</span>
      ${t.label.toUpperCase()}
      ${t.badge === "error"    ? `<span id="tab-err-badge" class="tab-badge hidden" style="background:var(--red);color:#fff;"></span>`    : ""}
      ${t.badge === "approval" ? `<span id="tab-app-badge" class="tab-badge hidden" style="background:var(--yellow);color:#000;"></span>` : ""}
    </button>`).join("");
}

function switchTab(tabId) {
  STATE.tab = tabId;
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabId));
  document.querySelectorAll("[id^='tab-']").forEach(el => { if (!el.id.endsWith("-badge")) el.style.display = "none"; });
  const pane = _el("tab-" + tabId);
  if (pane) pane.style.display = "";
  renderTab(tabId);
}

function renderTab(tabId) {
  switch(tabId) {
    case "dashboard":  renderDashboard();  break;
    case "github":     renderGithub();     break;
    case "render":     renderRenderTab();  break;
    case "supabase":   renderSupabase();   break;
    case "logs":       renderLogsTab();    break;
    case "errors":     renderErrors();     break;
    case "approvals":  renderApprovals();  break;
    case "agent":      renderAgentTab();   break;
    case "editor":     renderEditorTab();  break;
  }
}

/* ── BADGES ──────────────────────────────────────── */
function updateBadges() {
  const errBadge  = _el("tab-err-badge");
  const appBadge  = _el("tab-app-badge");
  const pendCount = _el("pending-count");
  const lb1 = _el("log-count-badge");
  const lb2 = _el("log-count-badge2");
  if (errBadge)  { errBadge.textContent  = STATE.errors.length;  errBadge.classList.toggle("hidden",  STATE.errors.length  === 0); }
  if (appBadge)  { appBadge.textContent  = STATE.pending.length; appBadge.classList.toggle("hidden",  STATE.pending.length === 0); }
  if (pendCount) pendCount.textContent   = STATE.pending.length;
  if (lb1) lb1.textContent = STATE.logs.length + " logs";
  if (lb2) lb2.textContent = STATE.logs.length + " logs";
}
Bus.on("badges-update", updateBadges);

/* ── DASHBOARD ───────────────────────────────────── */
function renderDashboard() {
  const g=STATE.ghStatus, r=STATE.renderStatus, sb=STATE.sbStatus, m=STATE.metrics;
  _el("dash-metrics").innerHTML =
    metricBox("GitHub CI",    g.ci,               statusColor(g.ci),               "branch: " + g.branch) +
    metricBox("Render",       r.status,            statusColor(r.status),            r.uptime + " uptime") +
    metricBox("Supabase",     sb.status,           statusColor(sb.status),           sb.latency + "ms latência") +
    metricBox("Erros 24h",    STATE.errors.length, STATE.errors.length > 0 ? COLORS.red   : COLORS.green, STATE.errors.length > 0 ? "requer atenção" : "tudo normal") +
    metricBox("Pendentes",    STATE.pending.length,STATE.pending.length > 0 ? COLORS.yellow: COLORS.green,"ações aguardando") +
    metricBox("CPU",          Math.round(m.cpu)+"%", cpuColor(m.cpu), "Render worker");
  _renderMetricBars("dash-bars");
  _el("workflows-list").innerHTML = STATE.workflows.map(w =>
    listRow(statusColor(w.status), w.status === "running", w.name, w.ago + " · " + w.duration, badge(w.status))
  ).join("");
  _renderDashLogPreview();
}

function _renderDashLogPreview() {
  const el = _el("dash-log-preview"); if (!el) return;
  el.innerHTML = STATE.logs.slice(-10).map(l =>
    `<div class="log-entry">
      <span class="log-time">${l.time}</span>
      <span class="log-src" style="color:${levelColor(l.level)}">[${escHtml(l.source)}]</span>
      <span class="log-msg" style="color:${l.level==="error"?COLORS.red:l.level==="warn"?COLORS.yellow:l.level==="success"?COLORS.green:COLORS.text}">${escHtml(l.message)}</span>
    </div>`
  ).join("");
}

function _renderMetricBars(containerId) {
  const m = STATE.metrics, el = _el(containerId); if (!el) return;
  el.innerHTML =
    progressBar("CPU",        m.cpu,  cpuColor(m.cpu)) +
    progressBar("Memória",    m.mem,  m.mem > 85 ? COLORS.red : m.mem > 65 ? COLORS.yellow : COLORS.cyan) +
    progressBar("Disco",      m.disk, COLORS.purple) +
    progressBar("Network In", m.net,  COLORS.accent);
}

Bus.on("metrics-update", () => {
  if (STATE.tab === "dashboard") _renderMetricBars("dash-bars");
  if (STATE.tab === "render")    _renderMetricBars("render-bars");
});
Bus.on("log-new", () => { if (STATE.tab === "dashboard") _renderDashLogPreview(); });

/* ── GITHUB ──────────────────────────────────────── */
function renderGithub() {
  const g = STATE.ghStatus;
  _el("github-metrics").innerHTML =
    metricBox("Branch", g.branch) + metricBox("Último Commit", g.lastCommit) + metricBox("SHA", g.sha) +
    metricBox("CI Status", g.ci, statusColor(g.ci)) + metricBox("PRs Abertos", g.openPRs) + metricBox("Issues Open", g.issues);
  _el("pr-list").innerHTML = [
    { title:"feat: JWT refresh token",       branch:"feature/jwt",       status:"open",    reviews:2 },
    { title:"fix: Supabase connection pool", branch:"fix/pool",          status:"pending", reviews:0 },
    { title:"autofix/error-001 [AGENTE]",    branch:"autofix/error-001", status:"open",    reviews:0 },
  ].map(pr => listRow(statusColor(pr.status), false, pr.title, "← " + pr.branch + " · " + pr.reviews + " reviews", badge(pr.status))).join("");
  _el("issues-list").innerHTML = [
    { title:"Memory leak no worker process",    priority:"high"   },
    { title:"Rate limiting não funciona em prod", priority:"medium" },
    { title:"Paginação na API /users",          priority:"low"    },
  ].map(i => listRow(statusColor(i.priority), false, i.title, null, badge(i.priority))).join("");
}

/* ── RENDER TAB ──────────────────────────────────── */
function renderRenderTab() {
  const r = STATE.renderStatus;
  _el("render-metrics").innerHTML =
    metricBox("Status", r.status, statusColor(r.status)) + metricBox("Uptime", r.uptime) +
    metricBox("URL", r.url) + metricBox("Região", r.region) +
    metricBox("Último Deploy", r.lastDeploy) + metricBox("Plano", "Starter");
  _renderMetricBars("render-bars");
  _el("deploys-list").innerHTML = [
    { commit:"abc1234", msg:"fix: auth middleware",  status:"live",    time:"há 2h", dur:"3m 42s" },
    { commit:"def5678", msg:"feat: rate limiting",   status:"success", time:"há 6h", dur:"4m 01s" },
    { commit:"ghi9012", msg:"chore: update deps",    status:"failed",  time:"há 1d", dur:"1m 23s" },
  ].map(d => listRow(statusColor(d.status), false, d.msg, d.commit + " · " + d.time + " · " + d.dur, badge(d.status))).join("");
}

/* ── SUPABASE ────────────────────────────────────── */
function renderSupabase() {
  const sb = STATE.sbStatus;
  _el("sb-metrics").innerHTML =
    metricBox("Status", sb.status, statusColor(sb.status)) +
    metricBox("Latência", sb.latency + "ms", sb.latency > 1000 ? COLORS.red : undefined) +
    metricBox("Tabelas", sb.tables) + metricBox("Registros", sb.rows) +
    metricBox("Storage", sb.storage) + metricBox("Connections", sb.connections);
  _el("tables-list").innerHTML = [
    { name:"users",            rows:"12,432",  size:"8.2 MB",  rls:true  },
    { name:"sessions",         rows:"89,201",  size:"34.1 MB", rls:true  },
    { name:"posts",            rows:"3,891",   size:"12.7 MB", rls:true  },
    { name:"analytics_events", rows:"421,002", size:"67.4 MB", rls:false },
  ].map(t =>
    `<div class="list-row">
      <code style="color:var(--accent);flex:1;font-size:10px;">${escHtml(t.name)}</code>
      <span class="row-sub">${escHtml(t.rows)}</span>
      <span class="row-sub" style="margin-left:10px;">${escHtml(t.size)}</span>
      <span style="margin-left:10px;">${badge(t.rls ? "RLS ON" : "RLS OFF", t.rls ? COLORS.green : COLORS.red)}</span>
    </div>`
  ).join("");
}

/* ── LOGS ────────────────────────────────────────── */
function renderLogsTab() {
  const scroll = _el("log-scroll"); if (!scroll) return;
  scroll.innerHTML = STATE.logs.map(l =>
    `<div class="log-entry">
      <span class="log-time">${l.time}</span>
      <span class="log-src" style="color:${levelColor(l.level)}">[${escHtml(l.source)}]</span>
      <span class="log-msg" style="color:${l.level==="error"?COLORS.red:l.level==="warn"?COLORS.yellow:l.level==="success"?COLORS.green:COLORS.text}">${escHtml(l.message)}</span>
    </div>`
  ).join("");
  scroll.scrollTop = scroll.scrollHeight;
  updateBadges();
}

Bus.on("log-new", (entry) => {
  if (STATE.tab !== "logs") return;
  const scroll = _el("log-scroll"); if (!scroll) return;
  const div = document.createElement("div");
  div.className = "log-entry";
  div.innerHTML = `
    <span class="log-time">${entry.time}</span>
    <span class="log-src" style="color:${levelColor(entry.level)}">[${escHtml(entry.source)}]</span>
    <span class="log-msg" style="color:${entry.level==="error"?COLORS.red:entry.level==="warn"?COLORS.yellow:entry.level==="success"?COLORS.green:COLORS.text}">${escHtml(entry.message)}</span>`;
  scroll.appendChild(div);
  scroll.scrollTop = scroll.scrollHeight;
});

/* ── ERRORS ──────────────────────────────────────── */
function renderErrors() {
  _el("errors-title").textContent = "⚠ " + STATE.errors.length + " erros detectados";
  const list = _el("errors-list");
  if (STATE.errors.length === 0) {
    list.innerHTML = `<div class="card"><div class="empty-state"><span class="empty-icon">✓</span>Nenhum erro detectado</div></div>`;
    return;
  }
  list.innerHTML = [...STATE.errors].reverse().map(e =>
    `<div class="card danger">
      <div class="flex justify-between mb-12">
        <span class="text-xs text-dim">${e.time} · ${escHtml(e.source)}</span>
        ${badge("error", COLORS.red)}
      </div>
      <div style="color:var(--red);font-size:11px;margin-bottom:12px;line-height:1.7;">${escHtml(e.message)}</div>
      <div class="flex gap-8">
        <button class="btn-analyze" onclick="analyzeError('${escAttr(e.message)}')">🤖 ANALISAR COM AGENTE</button>
        <button class="btn-analyze" onclick="openErrorInEditor('${escAttr(e.message)}')" style="background:var(--purple-dim);border-color:rgba(156,125,245,.3);color:var(--purple);">✎ EDITAR ARQUIVO</button>
      </div>
    </div>`
  ).join("");
}

function clearErrors() { STATE.errors = []; renderErrors(); Bus.emit("badges-update"); }
Bus.on("log-new", (entry) => { if (STATE.tab === "errors" && entry.level === "error") renderErrors(); });

/* ── APPROVALS ───────────────────────────────────── */
function renderApprovals() {
  const list = _el("approvals-list");
  if (STATE.pending.length === 0) {
    list.innerHTML = `<div class="card"><div class="empty-state"><span class="empty-icon">✓</span>Nenhuma ação pendente</div></div>`;
    return;
  }
  list.innerHTML = STATE.pending.map(a =>
    `<div class="card warning glow">
      <div class="flex justify-between items-center mb-12">
        <div>
          <div class="flex gap-8 mb-8">
            ${badge("ALTO RISCO", COLORS.red)}
            ${a.autoGenerated ? badge("AUTO-GERADO", COLORS.yellow) : ""}
          </div>
          <code style="color:var(--yellow);font-size:13px;">${escHtml(a.toolName)}</code>
        </div>
        <span class="text-xs text-dim">ID: ${escHtml(a.id)}</span>
      </div>
      <div style="color:var(--text);font-size:11px;margin-bottom:14px;line-height:1.7;background:var(--bg2);border-radius:6px;padding:12px;border:1px solid var(--border);">
        ${escHtml(a.description)}
        ${a.input ? `<pre style="color:var(--text-dim);font-size:10px;margin-top:8px;white-space:pre-wrap;word-break:break-word;">${escHtml(JSON.stringify(a.input,null,2))}</pre>` : ""}
      </div>
      <div class="flex gap-10">
        <button class="btn-approve" onclick="approveAction('${escAttr(a.id)}')">✓ APROVAR E EXECUTAR</button>
        <button class="btn-reject"  onclick="rejectAction('${escAttr(a.id)}')">✗ REJEITAR</button>
      </div>
    </div>`
  ).join("");
}

function approveAction(id) {
  const action = STATE.pending.find(a => a.id === id);
  STATE.pending = STATE.pending.filter(a => a.id !== id);
  if (action) { if (action.onApprove) action.onApprove(); addLog("success", "APPROVAL", "Ação aprovada e executada: " + action.toolName); }
  renderApprovals(); Bus.emit("badges-update");
}

function rejectAction(id) {
  STATE.pending = STATE.pending.filter(a => a.id !== id);
  addLog("warn", "APPROVAL", "Ação rejeitada: " + id);
  renderApprovals(); Bus.emit("badges-update");
}
