/* ═══════════════════════════════════════════════════════
   CLAW DevOps Agent v3 — tabs.js
   Tab routing + render functions para todos os painéis
═══════════════════════════════════════════════════════ */

const TABS = [
  { id:"dashboard", icon:"⬡",  label:"Dash"      },
  { id:"github",    icon:"◈",  label:"GitHub"    },
  { id:"render",    icon:"◉",  label:"Render"    },
  { id:"supabase",  icon:"◆",  label:"Supabase"  },
  { id:"logs",      icon:"≡",  label:"Logs"      },
  { id:"errors",    icon:"⚠",  label:"Erros",    badge:"error"    },
  { id:"approvals", icon:"◎",  label:"Ações",    badge:"approval" },
  { id:"agent",     icon:"✦",  label:"Agente"    },
  { id:"editor",    icon:"✎",  label:"Editor"    },
];

function buildTabs(){
  const container=_el("tabs");
  container.innerHTML=TABS.map(t=>`
    <button class="tab-btn${t.id===STATE.tab?" active":""}" onclick="switchTab('${t.id}')" data-tab="${t.id}">
      <span class="tab-icon">${t.icon}</span>
      <span class="tab-label">${t.label}</span>
      ${t.badge==="error"    ?`<span id="tab-err-badge" class="tab-badge hidden" style="background:var(--red);color:#fff;"></span>`   :""}
      ${t.badge==="approval" ?`<span id="tab-app-badge" class="tab-badge hidden" style="background:var(--yellow);color:#000;"></span>`:""}
    </button>`).join("");
}

function switchTab(tabId){
  STATE.tab=tabId;
  document.querySelectorAll(".tab-btn").forEach(btn=>btn.classList.toggle("active",btn.dataset.tab===tabId));
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
  const pane=_el("panel-"+tabId);
  if(pane) pane.classList.add("active");
  renderTab(tabId);
}

function renderTab(tabId){
  switch(tabId){
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

/* ── BADGES ─────────────────────────────────────────── */
function updateBadges(){
  const errBadge=_el("tab-err-badge"), appBadge=_el("tab-app-badge");
  const pendCount=_el("pending-count");
  if(errBadge){ errBadge.textContent=STATE.errors.length; errBadge.classList.toggle("hidden",STATE.errors.length===0); }
  if(appBadge){ appBadge.textContent=STATE.pending.length; appBadge.classList.toggle("hidden",STATE.pending.length===0); }
  if(pendCount) pendCount.textContent=STATE.pending.length;
}
Bus.on("badges-update",updateBadges);
Bus.on("status-update",()=>{ if(STATE.tab==="dashboard") renderDashboard(); else if(STATE.tab==="github") renderGithub(); else if(STATE.tab==="render") renderRenderTab(); else if(STATE.tab==="supabase") renderSupabase(); });

/* ── DASHBOARD ──────────────────────────────────────── */
function renderDashboard(){
  const g=STATE.ghStatus,r=STATE.renderStatus,sb=STATE.sbStatus;
  _el("dash-metrics").innerHTML=
    metricBox("GitHub CI",   g.ci,               statusColor(g.ci),   "branch: "+g.branch)+
    metricBox("Render",      r.status,            statusColor(r.status),r.url||"—")+
    metricBox("Supabase",    sb.status,           statusColor(sb.status),(sb.latency||"—")+"ms")+
    metricBox("Erros",       STATE.errors.length, STATE.errors.length>0?COLORS.red:COLORS.green,STATE.errors.length>0?"requer atenção":"tudo normal")+
    metricBox("Pendentes",   STATE.pending.length,STATE.pending.length>0?COLORS.yellow:COLORS.green,"ações aguardando")+
    metricBox("Último Deploy",r.lastDeploy,undefined,"Render");
  _renderMetricBars("dash-bars");
  const wl=_el("workflows-list");
  if(wl) wl.innerHTML=STATE.workflows.length?STATE.workflows.map(w=>listRow(statusColor(w.status),w.status==="running",w.name,w.ago+" · "+w.duration,badge(w.status))).join(""):`<div class="empty-state"><span class="empty-icon">◌</span><span class="empty-text">Sem workflows recentes</span></div>`;
  _renderDashLogPreview();
}

function _renderDashLogPreview(){
  const el=_el("dash-log-preview"); if(!el) return;
  el.innerHTML=STATE.logs.slice(-8).map(l=>`<div class="log-entry"><span class="log-time">${l.time}</span><span class="log-src" style="color:${levelColor(l.level)}">[${escHtml(l.source)}]</span><span class="log-msg" style="color:${l.level==="error"?COLORS.red:l.level==="warn"?COLORS.yellow:l.level==="success"?COLORS.green:COLORS.text}">${escHtml(l.message)}</span></div>`).join("");
}

function _renderMetricBars(containerId){
  const m=STATE.metrics,el=_el(containerId); if(!el) return;
  el.innerHTML=
    progressBar("CPU",   m.cpu,  cpuColor(m.cpu||0))+
    progressBar("Memória",m.mem, m.mem>85?COLORS.red:m.mem>65?COLORS.yellow:COLORS.cyan)+
    progressBar("Disco",  m.disk,COLORS.purple)+
    progressBar("Network",m.net, COLORS.accent);
}

Bus.on("metrics-update",()=>{ if(STATE.tab==="dashboard") _renderMetricBars("dash-bars"); if(STATE.tab==="render") _renderMetricBars("render-bars"); });
Bus.on("log-new",()=>{ if(STATE.tab==="dashboard") _renderDashLogPreview(); });

/* ── GITHUB ─────────────────────────────────────────── */
function renderGithub(){
  const g=STATE.ghStatus;
  _el("github-metrics").innerHTML=
    metricBox("Branch",g.branch)+metricBox("Último Commit",g.lastCommit)+metricBox("SHA",g.sha)+
    metricBox("CI Status",g.ci,statusColor(g.ci))+metricBox("PRs Abertos",g.openPRs)+metricBox("Issues",g.issues);
  const prList=_el("pr-list");
  if(prList) prList.innerHTML=STATE.workflows.length?STATE.workflows.map(w=>listRow(statusColor(w.status),w.status==="in_progress",w.name,w.ago+" · "+w.duration,badge(w.status))).join(""):`<div style="padding:12px;color:var(--text-dim);font-size:10px;">Peça ao agente: "liste os PRs abertos"</div>`;
  const iss=_el("issues-list");
  if(iss) iss.innerHTML=`<div style="padding:12px;color:var(--text-dim);font-size:10px;">Peça ao agente: "liste as issues abertas"</div>`;
}

/* ── RENDER TAB ─────────────────────────────────────── */
function renderRenderTab(){
  const r=STATE.renderStatus;
  _el("render-metrics").innerHTML=
    metricBox("Status",r.status,statusColor(r.status))+metricBox("Uptime",r.uptime)+
    metricBox("URL",r.url)+metricBox("Região",r.region)+
    metricBox("Último Deploy",r.lastDeploy)+metricBox("Plano","Starter");
  _renderMetricBars("render-bars");
  const dl=_el("deploys-list");
  if(dl) dl.innerHTML=`<div style="padding:12px;color:var(--text-dim);font-size:10px;">Peça ao agente: "mostre os últimos deploys do Render"</div>`;
}

/* ── SUPABASE ───────────────────────────────────────── */
function renderSupabase(){
  const sb=STATE.sbStatus;
  _el("sb-metrics").innerHTML=
    metricBox("Status",sb.status,statusColor(sb.status))+
    metricBox("Latência",(sb.latency||"—")+"ms",sb.latency>1000?COLORS.red:undefined)+
    metricBox("Tabelas",sb.tables)+metricBox("Registros",sb.rows)+
    metricBox("Storage",sb.storage)+metricBox("Connections",sb.connections);
  const tl=_el("tables-list");
  if(tl) tl.innerHTML=`<div style="padding:12px;color:var(--text-dim);font-size:10px;">Peça ao agente: "liste as tabelas do Supabase"</div>`;
}

/* ── LOGS ───────────────────────────────────────────── */
function renderLogsTab(){
  const scroll=_el("log-scroll"); if(!scroll) return;
  scroll.innerHTML=STATE.logs.map(l=>`<div class="log-entry"><span class="log-time">${l.time}</span><span class="log-src" style="color:${levelColor(l.level)}">[${escHtml(l.source)}]</span><span class="log-msg" style="color:${l.level==="error"?COLORS.red:l.level==="warn"?COLORS.yellow:l.level==="success"?COLORS.green:COLORS.text}">${escHtml(l.message)}</span></div>`).join("");
  scroll.scrollTop=scroll.scrollHeight; updateBadges();
}
Bus.on("log-new",(entry)=>{
  if(STATE.tab!=="logs") return;
  const scroll=_el("log-scroll"); if(!scroll) return;
  const div=document.createElement("div"); div.className="log-entry";
  div.innerHTML=`<span class="log-time">${entry.time}</span><span class="log-src" style="color:${levelColor(entry.level)}">[${escHtml(entry.source)}]</span><span class="log-msg" style="color:${entry.level==="error"?COLORS.red:entry.level==="warn"?COLORS.yellow:entry.level==="success"?COLORS.green:COLORS.text}">${escHtml(entry.message)}</span>`;
  scroll.appendChild(div); scroll.scrollTop=scroll.scrollHeight;
});

/* ── ERRORS ─────────────────────────────────────────── */
function renderErrors(){
  const titleEl=_el("errors-title"); if(titleEl) titleEl.textContent="⚠ "+STATE.errors.length+" erros detectados";
  const list=_el("errors-list"); if(!list) return;
  if(STATE.errors.length===0){ list.innerHTML=`<div class="card success"><div class="empty-state"><span class="empty-icon">✓</span><span class="empty-text">Nenhum erro detectado</span></div></div>`; return; }
  list.innerHTML=[...STATE.errors].reverse().map(e=>`
    <div class="card danger">
      <div class="flex justify-between mb-12">
        <span class="text-xs text-dim">${e.time} · ${escHtml(e.source)}</span>
        ${badge("error",COLORS.red)}
      </div>
      <div style="color:var(--red);font-size:11px;margin-bottom:12px;line-height:1.7;">${escHtml(e.message)}</div>
      <div class="flex gap-8" style="flex-wrap:wrap;">
        <button class="btn-analyze" onclick="analyzeError('${escAttr(e.message)}')">🤖 ANALISAR</button>
        <button class="btn-analyze" onclick="openErrorInEditor('${escAttr(e.message)}')" style="background:var(--purple-dim);border-color:rgba(156,125,245,.3);color:var(--purple);">✎ EDITOR</button>
      </div>
    </div>`).join("");
}
function clearErrors(){ STATE.errors=[]; renderErrors(); Bus.emit("badges-update"); }
Bus.on("log-new",(entry)=>{ if(STATE.tab==="errors"&&entry.level==="error") renderErrors(); });

/* ── APPROVALS ──────────────────────────────────────── */
function renderApprovals(){
  const list=_el("approvals-list"); if(!list) return;
  if(STATE.pending.length===0){ list.innerHTML=`<div class="card success"><div class="empty-state"><span class="empty-icon">✓</span><span class="empty-text">Nenhuma ação pendente</span></div></div>`; return; }
  list.innerHTML=STATE.pending.map(a=>`
    <div class="card warning glow">
      <div class="flex justify-between items-center mb-12">
        <div>
          <div class="flex gap-8 mb-8">${badge("ALTO RISCO",COLORS.red)}${a.autoGenerated?badge("AUTO-GERADO",COLORS.yellow):""}</div>
          <code style="color:var(--yellow);font-size:13px;">${escHtml(a.toolName)}</code>
        </div>
        <span class="text-xs text-dim">ID: ${escHtml(a.id)}</span>
      </div>
      <div style="color:var(--text);font-size:11px;margin-bottom:14px;line-height:1.7;background:var(--bg3);border-radius:var(--r-sm);padding:12px;border:1px solid var(--border);">
        ${escHtml(a.description)}
        ${a.input?`<pre style="color:var(--text-dim);font-size:10px;margin-top:8px;white-space:pre-wrap;word-break:break-word;">${escHtml(JSON.stringify(a.input,null,2))}</pre>`:""}
      </div>
      <div class="flex gap-10" style="flex-wrap:wrap;">
        <button class="btn-approve" onclick="approveAction('${escAttr(a.id)}')">✓ APROVAR E EXECUTAR</button>
        <button class="btn-reject"  onclick="rejectAction('${escAttr(a.id)}')">✗ REJEITAR</button>
      </div>
    </div>`).join("");
}

function approveAction(id){
  const action=STATE.pending.find(a=>a.id===id);
  STATE.pending=STATE.pending.filter(a=>a.id!==id);
  if(action&&action.onApprove) action.onApprove();
  addLog("success","APPROVAL","Aprovado: "+(action?.toolName||id));
  renderApprovals(); Bus.emit("badges-update");
}
function rejectAction(id){
  STATE.pending=STATE.pending.filter(a=>a.id!==id);
  addLog("warn","APPROVAL","Rejeitado: "+id);
  renderApprovals(); Bus.emit("badges-update");
}
