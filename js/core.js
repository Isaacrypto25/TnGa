/* ═══════════════════════════════════════════════════════
   CLAW DEVOPS AGENT v2 — core.js
   Global state, constants, helpers, event bus
═══════════════════════════════════════════════════════ */

const ANTHROPIC_API   = "https://api.anthropic.com/v1/messages";
const MODEL           = "claude-sonnet-4-5";
const HIGH_RISK_TOOLS = ["github_create_pr","render_trigger_deploy","supabase_run_migration"];

const COLORS = {
  green:"#0fd98a",  greenDim:"rgba(15,217,138,0.12)",
  red:"#f43060",    redDim:"rgba(244,48,96,0.12)",
  yellow:"#f5a623", yellowDim:"rgba(245,166,35,0.12)",
  cyan:"#18d4f0",   cyanDim:"rgba(24,212,240,0.10)",
  purple:"#9c7df5", purpleDim:"rgba(156,125,245,0.12)",
  accent:"#2f78f0", accentDim:"rgba(47,120,240,0.12)",
  text:"#c0d0e8",   textDim:"#3d5570", textMid:"#6a8aaa",
};

/* ── API KEYS ──────────────────────────────────────── */
const KEYS = {
  anthropic:"", github:"", githubRepo:"",
  render:"",    renderService:"",
  supabaseUrl:"", supabase:"",
};
const KEY_STATUS = { anthropic:"none", github:"none", render:"none", supabase:"none" };

function loadKeys() {
  try { Object.assign(KEYS, JSON.parse(localStorage.getItem("claw_api_keys") || "{}")); } catch(e) {}
}
function persistKeys() { localStorage.setItem("claw_api_keys", JSON.stringify(KEYS)); }
function isConfigured() { return KEYS.anthropic.length > 10; }

/* ── GLOBAL STATE ─────────────────────────────────── */
const STATE = {
  tab: "dashboard",
  metrics:      { cpu:null, mem:null, disk:null, net:null },
  ghStatus:     { branch:"—", lastCommit:"—", sha:"—", ci:"—", openPRs:"—", issues:"—" },
  renderStatus: { status:"—", uptime:"—", url:"—", lastDeploy:"—", region:"—" },
  sbStatus:     { status:"—", latency:null, tables:"—", rows:"—", storage:"—", connections:"—" },
  workflows:    [],
  logs:[], errors:[],
  pending:[],
  agentMsgs:[
    { role:"assistant", text:"Claw DevOps Agent online.\n\nCarregando dados reais do GitHub, Render e Supabase...\n\nO que deseja fazer?" }
  ],
  agentHistory:[], agentLoading:false,
  files:{}, activeFile:null, modifiedFiles:new Set(),
  lastAlertMsg:null,
};

/* ── EVENT BUS ────────────────────────────────────── */
const Bus = {
  _l:{},
  on(e,fn)  { (this._l[e]=this._l[e]||[]).push(fn); },
  off(e,fn) { this._l[e]=(this._l[e]||[]).filter(f=>f!==fn); },
  emit(e,d) { (this._l[e]||[]).forEach(fn=>fn(d)); },
};

/* ── HELPERS ─────────────────────────────────────── */
function escHtml(s){ return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function escAttr(s){ return String(s??"").replace(/'/g,"\\'").replace(/[<>]/g,""); }
function _el(id){ return document.getElementById(id); }

function statusColor(s=""){
  const l=s.toLowerCase();
  if(/live|ok|success|passing|connected|active/.test(l)) return COLORS.green;
  if(/fail|error|down|crash|critical/.test(l))           return COLORS.red;
  if(/pending|running|deploy|building|warn|high/.test(l)) return COLORS.yellow;
  if(/medium/.test(l))                                    return COLORS.cyan;
  return COLORS.purple;
}
function levelColor(lvl){ return {info:COLORS.cyan,warn:COLORS.yellow,error:COLORS.red,success:COLORS.green,agent:COLORS.purple}[lvl]||COLORS.text; }
function timePT(){ return new Date().toLocaleTimeString("pt-BR",{hour12:false}); }
function badge(text,color){ const c=color||statusColor(text); return `<span class="badge" style="background:${c}18;color:${c};border:1px solid ${c}30;">${escHtml(text)}</span>`; }
function dot(color,pulse=false){ const g=`box-shadow:0 0 8px ${color};`; return `<span class="dot${pulse?" pulse":""}" style="background:${color};${pulse?g:""}"></span>`; }
function metricBox(label,value,color,sub){ const c=color||COLORS.text; return `<div class="metric-box"><div class="m-label">${escHtml(label)}</div><div class="m-value" style="color:${c}">${escHtml(String(value))}</div>${sub?`<div class="m-sub">${escHtml(sub)}</div>`:""}</div>`; }
function progressBar(label,value,color){ const c=color||COLORS.accent; const v=Math.min(100,Math.max(0,Math.round(value))); return `<div class="progress-wrap"><div class="progress-header"><span>${escHtml(label)}</span><span style="color:${c}">${v}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${v}%;background:${c};"></div></div></div>`; }
function listRow(dc,pulse,title,sub,right){ return `<div class="list-row">${dot(dc,pulse)}<div class="row-main"><div class="row-title">${escHtml(title)}</div>${sub?`<div class="row-sub">${escHtml(sub)}</div>`:""}</div>${right||""}</div>`; }
function cpuColor(cpu){ return cpu>80?COLORS.red:cpu>60?COLORS.yellow:COLORS.green; }

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "agora";
  if (mins < 60)  return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `há ${days}d`;
}

/* ── LOG SYSTEM ─────────────────────────────────── */
function addLog(level,source,message){
  const entry={id:Date.now()+Math.random(),level,source,message,time:timePT()};
  STATE.logs.push(entry);
  if(STATE.logs.length>600) STATE.logs=STATE.logs.slice(-600);
  if(level==="error"){
    STATE.errors.push(entry);
    if(STATE.errors.length>100) STATE.errors=STATE.errors.slice(-100);
    Bus.emit("critical-error",entry);
  }
  Bus.emit("log-new",entry);
  Bus.emit("badges-update");
}

/* ── FETCH REAL DATA ─────────────────────────────── */

async function fetchGitHubStatus() {
  if (!KEYS.github || !KEYS.githubRepo) return;
  const repo = KEYS.githubRepo;
  const headers = {
    Authorization: "Bearer " + KEYS.github,
    Accept: "application/vnd.github+json"
  };
  try {
    addLog("info", "GITHUB", `Buscando dados reais: ${repo}`);

    // Branch padrão + último commit
    const [repoData, prsData, issuesData] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}`, { headers }).then(r => r.json()),
      fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=1`, { headers }).then(r => r.json()),
      fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=1`, { headers }).then(r => r.json()),
    ]);

    const branch = repoData.default_branch || "main";

    // Último commit da branch padrão
    const commitData = await fetch(
      `https://api.github.com/repos/${repo}/commits?sha=${branch}&per_page=1`, { headers }
    ).then(r => r.json());

    const lastCommit = commitData[0]?.commit?.message?.split("\n")[0] || "—";
    const sha        = commitData[0]?.sha?.substring(0, 7) || "—";
    const commitDate = commitData[0]?.commit?.author?.date;

    // Contar PRs e issues reais
    const prsCount    = Array.isArray(prsData)    ? prsData.length    : "?";
    const issuesCount = Array.isArray(issuesData) ? issuesData.length : "?";

    // CI status (último check run)
    let ci = "—";
    try {
      const checks = await fetch(
        `https://api.github.com/repos/${repo}/commits/${commitData[0]?.sha}/check-runs`, { headers }
      ).then(r => r.json());
      const runs = checks.check_runs || [];
      if (runs.length > 0) {
        const allOk = runs.every(r => r.conclusion === "success");
        const anyFail = runs.some(r => r.conclusion === "failure");
        ci = anyFail ? "failing" : allOk ? "passing" : runs[0].status;
      }
    } catch(e) { ci = "—"; }

    STATE.ghStatus = {
      branch,
      lastCommit,
      sha,
      ci,
      openPRs: prsCount,
      issues:  issuesCount,
      updatedAt: commitDate,
    };

    addLog("success", "GITHUB", `branch: ${branch} | commit: ${sha} | PRs: ${prsCount} | issues: ${issuesCount} | CI: ${ci}`);
    Bus.emit("status-update");

    // Buscar workflows (GitHub Actions)
    try {
      const wfRuns = await fetch(
        `https://api.github.com/repos/${repo}/actions/runs?per_page=5`, { headers }
      ).then(r => r.json());
      STATE.workflows = (wfRuns.workflow_runs || []).map(w => ({
        name:     w.name,
        status:   w.conclusion || w.status,
        duration: w.updated_at && w.created_at
          ? `${Math.round((new Date(w.updated_at) - new Date(w.created_at)) / 60000)}min`
          : "—",
        ago: timeAgo(w.updated_at),
      }));
      Bus.emit("status-update");
    } catch(e) {}

  } catch(e) {
    addLog("warn", "GITHUB", "Erro ao buscar status: " + e.message);
  }
}

async function fetchRenderStatus() {
  if (!KEYS.render || !KEYS.renderService) return;
  try {
    addLog("info", "RENDER", "Buscando status real do serviço...");
    const res = await fetch(
      `https://api.render.com/v1/services/${KEYS.renderService}`,
      { headers: { Authorization: "Bearer " + KEYS.render } }
    );
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const svc  = data.service || data;

    // Último deploy
    let lastDeploy = "—";
    try {
      const deploys = await fetch(
        `https://api.render.com/v1/services/${KEYS.renderService}/deploys?limit=1`,
        { headers: { Authorization: "Bearer " + KEYS.render } }
      ).then(r => r.json());
      const d = Array.isArray(deploys) ? deploys[0]?.deploy : deploys.deploy;
      lastDeploy = d?.finishedAt ? timeAgo(d.finishedAt) : d?.status || "—";
    } catch(e) {}

    STATE.renderStatus = {
      status:     svc.suspended ? "suspended" : "live",
      uptime:     "—",  // Render não expõe uptime via API
      url:        svc.serviceDetails?.url || svc.url || "—",
      lastDeploy,
      region:     svc.serviceDetails?.region || svc.region || "—",
    };

    addLog("success", "RENDER", `status: ${STATE.renderStatus.status} | url: ${STATE.renderStatus.url} | deploy: ${lastDeploy}`);
    Bus.emit("status-update");
  } catch(e) {
    addLog("warn", "RENDER", "Erro ao buscar status: " + e.message);
  }
}

async function fetchSupabaseStatus() {
  if (!KEYS.supabase || !KEYS.supabaseUrl) return;
  try {
    addLog("info", "SUPABASE", "Verificando conexão...");
    const t0  = Date.now();
    const res = await fetch(
      KEYS.supabaseUrl.replace(/\/$/, "") + "/rest/v1/",
      { headers: { apikey: KEYS.supabase, Authorization: "Bearer " + KEYS.supabase } }
    );
    const latency = Date.now() - t0;

    if (!res.ok && res.status !== 400) throw new Error("HTTP " + res.status);

    // Listar tabelas via information_schema
    let tables = "—", rows = "—";
    try {
      const tRes = await fetch(
        KEYS.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/get_tables",
        { method: "POST", headers: { apikey: KEYS.supabase, Authorization: "Bearer " + KEYS.supabase, "Content-Type": "application/json" }, body: "{}" }
      );
      if (tRes.ok) {
        const tData = await tRes.json();
        tables = Array.isArray(tData) ? tData.length : "—";
      }
    } catch(e) {}

    STATE.sbStatus = {
      status:      "connected",
      latency,
      tables,
      rows,
      storage:     "—",
      connections: "—",
    };

    addLog("success", "SUPABASE", `connected | latência: ${latency}ms | tabelas: ${tables}`);
    Bus.emit("status-update");
  } catch(e) {
    STATE.sbStatus = { ...STATE.sbStatus, status: "error" };
    addLog("warn", "SUPABASE", "Erro ao conectar: " + e.message);
    Bus.emit("status-update");
  }
}

/* ── REFRESH PERIÓDICO ───────────────────────────── */
async function refreshAllStatus() {
  await Promise.allSettled([
    fetchGitHubStatus(),
    fetchRenderStatus(),
    fetchSupabaseStatus(),
  ]);
}

// Atualiza ao carregar e a cada 2 minutos
function startRealDataPolling() {
  if (!KEYS.github && !KEYS.render && !KEYS.supabase) return;
  refreshAllStatus();
  setInterval(refreshAllStatus, 120_000);
}
