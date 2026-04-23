/* ═══════════════════════════════════════════════════════
   CLAW DevOps Agent v3 — agent.js
   Agentic loop com tool_result CORRETO.
   BUG FIXES:
   1. tool_result sempre enviado mesmo para high-risk tools
   2. Histórico sanitizado antes de cada nova conversa
   3. tool_result content nunca vazio (API rejeita string vazia)
   4. Ao iniciar nova mensagem, valida histórico antes de enviar
═══════════════════════════════════════════════════════ */

const AGENT_TOOLS = [
  { name:"github_read_file",       description:"Lê o conteúdo de um arquivo do repositório GitHub.", input_schema:{ type:"object", properties:{ path:{type:"string"}, branch:{type:"string"} }, required:["path"] } },
  { name:"github_list_files",      description:"Lista arquivos e pastas de um diretório do repositório.", input_schema:{ type:"object", properties:{ path:{type:"string"}, branch:{type:"string"} } } },
  { name:"github_list_branches",   description:"Lista todas as branches do repositório.", input_schema:{ type:"object", properties:{ limit:{type:"number"} } } },
  { name:"github_list_commits",    description:"Lista os commits mais recentes de uma branch.", input_schema:{ type:"object", properties:{ branch:{type:"string"}, limit:{type:"number"}, path:{type:"string"} } } },
  { name:"github_list_issues",     description:"Lista as issues do repositório GitHub.", input_schema:{ type:"object", properties:{ state:{type:"string",enum:["open","closed","all"]}, limit:{type:"number"}, label:{type:"string"} } } },
  { name:"github_list_prs",        description:"Lista Pull Requests do repositório.", input_schema:{ type:"object", properties:{ state:{type:"string",enum:["open","closed","all"]}, limit:{type:"number"} } } },
  { name:"github_get_commit",      description:"Obtém detalhes de um commit específico.", input_schema:{ type:"object", properties:{ sha:{type:"string"} }, required:["sha"] } },
  { name:"render_get_logs",        description:"Busca os logs mais recentes do Render.com.", input_schema:{ type:"object", properties:{ lines:{type:"number"}, filter:{type:"string"} } } },
  { name:"render_get_metrics",     description:"Obtém métricas do serviço Render.", input_schema:{ type:"object", properties:{ period:{type:"string",enum:["1h","24h","7d"]} } } },
  { name:"supabase_list_tables",   description:"Lista todas as tabelas do banco Supabase.", input_schema:{ type:"object", properties:{} } },
  { name:"supabase_run_query",     description:"Executa uma query SELECT no Supabase.", input_schema:{ type:"object", properties:{ sql:{type:"string"} }, required:["sql"] } },
  { name:"analyze_error",          description:"Analisa um erro e sugere correção.", input_schema:{ type:"object", properties:{ error_message:{type:"string"}, stack_trace:{type:"string"}, file_path:{type:"string"} }, required:["error_message"] } },
  { name:"github_create_or_update_file", description:"[ALTO RISCO] Cria ou atualiza um arquivo no GitHub.", input_schema:{ type:"object", properties:{ path:{type:"string"}, content:{type:"string"}, message:{type:"string"}, branch:{type:"string"} }, required:["path","content","message"] } },
  { name:"github_delete_file",     description:"[ALTO RISCO] Deleta um arquivo do repositório.", input_schema:{ type:"object", properties:{ path:{type:"string"}, message:{type:"string"}, branch:{type:"string"} }, required:["path","message"] } },
  { name:"github_create_branch",   description:"[ALTO RISCO] Cria uma nova branch.", input_schema:{ type:"object", properties:{ branch:{type:"string"}, from:{type:"string"} }, required:["branch"] } },
  { name:"github_push_multiple_files", description:"[ALTO RISCO] Push de múltiplos arquivos em um commit.", input_schema:{ type:"object", properties:{ branch:{type:"string"}, message:{type:"string"}, files:{type:"array",items:{type:"object",properties:{path:{type:"string"},content:{type:"string"}},required:["path","content"]}} }, required:["branch","message","files"] } },
  { name:"github_create_pr",       description:"[ALTO RISCO] Cria um Pull Request.", input_schema:{ type:"object", properties:{ title:{type:"string"}, branch:{type:"string"}, base:{type:"string"}, description:{type:"string"} }, required:["title","branch"] } },
  { name:"github_merge_pr",        description:"[ALTO RISCO] Faz merge de um Pull Request.", input_schema:{ type:"object", properties:{ pr_number:{type:"number"}, merge_method:{type:"string",enum:["merge","squash","rebase"]}, message:{type:"string"} }, required:["pr_number"] } },
  { name:"github_close_issue",     description:"[ALTO RISCO] Fecha uma issue.", input_schema:{ type:"object", properties:{ issue_number:{type:"number"}, comment:{type:"string"} }, required:["issue_number"] } },
  { name:"render_trigger_deploy",  description:"[ALTO RISCO] Dispara redeploy no Render.", input_schema:{ type:"object", properties:{ reason:{type:"string"}, service_id:{type:"string"} }, required:["reason"] } },
  { name:"supabase_run_migration", description:"[ALTO RISCO] Executa migration SQL no Supabase.", input_schema:{ type:"object", properties:{ name:{type:"string"}, sql:{type:"string"} }, required:["name","sql"] } },
  { name:"edit_file",              description:"[ALTO RISCO] Edita arquivo no editor local.", input_schema:{ type:"object", properties:{ path:{type:"string"}, new_content:{type:"string"}, description:{type:"string"} }, required:["path","new_content","description"] } },
];

const HIGH_RISK_TOOLS_SET = new Set([
  "github_create_or_update_file","github_delete_file","github_create_branch",
  "github_push_multiple_files","github_create_pr","github_merge_pr","github_close_issue",
  "render_trigger_deploy","supabase_run_migration","edit_file",
]);

/* ── SYSTEM PROMPT ───────────────────────────────────── */
function buildSystemPrompt(){
  const g=STATE.ghStatus, r=STATE.renderStatus, sb=STATE.sbStatus;
  return `Você é o Claw DevOps Agent v3 — agente autônomo de infraestrutura.

CONEXÕES:
${KEYS.anthropic?"✓ Claude AI":"✗ Claude AI"}
${KEYS.github?"✓ GitHub ("+( KEYS.githubRepo||"sem repo")+")":"✗ GitHub"}
${KEYS.render?"✓ Render.com":"✗ Render"}
${KEYS.supabase?"✓ Supabase":"✗ Supabase"}

ESTADO:
- GitHub: branch ${g.branch}, último commit "${g.lastCommit}" (${g.sha}), CI: ${g.ci}, ${g.openPRs} PRs, ${g.issues} issues
- Render: ${r.status}, url: ${r.url}, último deploy: ${r.lastDeploy}
- Supabase: ${sb.status} (${sb.latency}ms), ${sb.tables} tabelas
- Erros ativos: ${STATE.errors.length} | Aprovações pendentes: ${STATE.pending.length}
- Arquivos em memória: ${Object.keys(STATE.files).length>0?Object.keys(STATE.files).join(", "):"nenhum"}

REGRAS:
- Tools LOW RISK (github_read_file, github_list_*, github_get_commit, render_get_*, supabase_list_*, supabase_run_query, analyze_error): execute automaticamente
- Tools HIGH RISK: enfileire para aprovação humana — SEMPRE retorne tool_result mesmo para high-risk
- Sempre liste arquivos antes de ler/editar se não souber o caminho exato
- Seja direto e técnico. Português brasileiro.`;
}

/* ── GITHUB API ──────────────────────────────────────── */
async function githubFetch(path,method="GET",body=null){
  if(!KEYS.github) throw new Error("GitHub token não configurado");
  const repo=KEYS.githubRepo||"";
  const base=repo?`https://api.github.com/repos/${repo}`:"https://api.github.com";
  const opts={method,headers:{Authorization:"Bearer "+KEYS.github,Accept:"application/vnd.github+json","Content-Type":"application/json"}};
  if(body) opts.body=JSON.stringify(body);
  const res=await fetch(base+path,opts);
  const text=await res.text();
  let data; try{ data=JSON.parse(text); }catch(e){ data={message:text}; }
  if(!res.ok) throw new Error("GitHub "+res.status+": "+(data.message||text.substring(0,120)));
  return data;
}
async function githubGetFileSha(path,branch="main"){
  try{ const f=await githubFetch(`/contents/${encodeURIComponent(path)}?ref=${branch}`); return f.sha||null; }catch(e){ return null; }
}

/* ── RENDER / SUPABASE API ───────────────────────────── */
async function renderFetch(path,method="GET",body=null){
  if(!KEYS.render) throw new Error("Render key não configurada");
  const opts={method,headers:{Authorization:"Bearer "+KEYS.render,"Content-Type":"application/json"}};
  if(body) opts.body=JSON.stringify(body);
  const res=await fetch("https://api.render.com/v1"+path,opts);
  if(!res.ok) throw new Error("Render API "+res.status);
  return res.json();
}
async function supabaseFetch(path,method="GET",body=null){
  if(!KEYS.supabase||!KEYS.supabaseUrl) throw new Error("Supabase não configurado");
  const url=KEYS.supabaseUrl.replace(/\/$/,"")+path;
  const opts={method,headers:{apikey:KEYS.supabase,Authorization:"Bearer "+KEYS.supabase,"Content-Type":"application/json"}};
  if(body) opts.body=JSON.stringify(body);
  const res=await fetch(url,opts);
  if(!res.ok) throw new Error("Supabase API "+res.status);
  return res.json();
}

/* ── EXECUTE TOOL ────────────────────────────────────── */
async function executeTool(toolName,input){
  if(!KEYS.github&&toolName.startsWith("github_")) return "⚠ GitHub Token não configurado. Vá em ⚙ API KEYS para configurar.";
  try{
    switch(toolName){
      case "github_read_file": {
        const branch=input.branch||"main";
        const file=await githubFetch(`/contents/${input.path}?ref=${branch}`);
        const content=atob(file.content.replace(/\n/g,""));
        STATE.files[input.path]=content; STATE._fileShas[input.path]=file.sha;
        addLog("info","EDITOR",`Carregado: ${input.path}`);
        return `✓ ${input.path} (${branch}) — ${file.size} bytes\n\n\`\`\`\n${content.substring(0,3000)}${content.length>3000?"\n...(truncado)":""}\n\`\`\``;
      }
      case "github_list_files": {
        const branch=input.branch||"main"; const path=input.path||"";
        const items=await githubFetch(`/contents/${path}?ref=${branch}`);
        const list=Array.isArray(items)?items:[items];
        return `📁 /${path} (${branch}):\n\n`+list.map(i=>`${i.type==="dir"?"📂":"📄"} ${i.name}${i.type==="file"?" ("+i.size+"b)":""}`).join("\n");
      }
      case "github_list_branches": {
        const branches=await githubFetch(`/branches?per_page=${input.limit||30}`);
        return `🌿 Branches (${branches.length}):\n\n`+branches.map(b=>`${b.name===STATE.ghStatus.branch?"→ ":"  "}${b.name}  [${b.commit.sha.substring(0,7)}]`).join("\n");
      }
      case "github_list_commits": {
        const branch=input.branch||"main",limit=input.limit||20;
        let url=`/commits?sha=${branch}&per_page=${limit}`;
        if(input.path) url+=`&path=${input.path}`;
        const commits=await githubFetch(url);
        return `📜 Commits em ${branch}:\n\n`+commits.map(c=>`[${c.sha.substring(0,7)}] ${c.commit.author.date.substring(0,10)} — ${c.commit.message.split("\n")[0]} (${c.commit.author.name})`).join("\n");
      }
      case "github_list_issues": {
        const state=input.state||"open",limit=input.limit||20;
        let url=`/issues?state=${state}&per_page=${limit}`;
        if(input.label) url+=`&labels=${input.label}`;
        const issues=await githubFetch(url);
        if(!issues.length) return `✓ Nenhuma issue ${state}.`;
        return `🐛 Issues ${state} (${issues.length}):\n\n`+issues.map(i=>`#${i.number} [${(i.labels||[]).map(l=>l.name).join(",")||"sem label"}] ${i.title}\n   ${i.user.login} · ${i.created_at.substring(0,10)}`).join("\n\n");
      }
      case "github_list_prs": {
        const state=input.state||"open",limit=input.limit||20;
        const prs=await githubFetch(`/pulls?state=${state}&per_page=${limit}`);
        if(!prs.length) return `✓ Nenhum PR ${state}.`;
        return `🔀 PRs ${state} (${prs.length}):\n\n`+prs.map(p=>`#${p.number} ${p.title}\n   ${p.head.ref} → ${p.base.ref} | ${p.user.login} · ${p.created_at.substring(0,10)}`).join("\n\n");
      }
      case "github_get_commit": {
        const commit=await githubFetch(`/commits/${input.sha}`);
        const files=(commit.files||[]).map(f=>`  ${f.status.padEnd(8)} ${f.filename} (+${f.additions}/-${f.deletions})`).join("\n");
        return `📦 ${commit.sha.substring(0,7)} — ${commit.commit.author.name} (${commit.commit.author.date.substring(0,10)})\n${commit.commit.message}\n\nArquivos:\n${files}`;
      }
      case "render_get_logs": {
        if(!KEYS.render||!KEYS.renderService) return "⚠ Configure RENDER_API_KEY e RENDER_SERVICE_ID.";
        const res=await fetch(`https://api.render.com/v1/services/${KEYS.renderService}/logs?limit=${input.lines||100}`,{headers:{Authorization:"Bearer "+KEYS.render}});
        if(!res.ok) return "⚠ Render logs: HTTP "+res.status;
        const data=await res.json();
        const lines=(data.logs||data||[]).slice(0,100).map(l=>`[${l.level||"INFO"}] ${l.timestamp||""} ${l.message||l}`).join("\n");
        return lines||"Nenhum log encontrado.";
      }
      case "render_get_metrics": {
        if(!KEYS.render||!KEYS.renderService) return "⚠ Configure RENDER_API_KEY e RENDER_SERVICE_ID.";
        const svc=await renderFetch(`/services/${KEYS.renderService}`); const s=svc.service||svc;
        return `Serviço: ${s.name||"—"}\nStatus: ${s.suspended?"suspended":"active"}\nURL: ${s.serviceDetails?.url||s.url||"—"}\nRegião: ${s.serviceDetails?.region||"—"}`;
      }
      case "supabase_list_tables": {
        if(!KEYS.supabase||!KEYS.supabaseUrl) return "⚠ Supabase não configurado.";
        const data=await supabaseFetch("/rest/v1/"); return JSON.stringify(data,null,2);
      }
      case "supabase_run_query": {
        if(!KEYS.supabase||!KEYS.supabaseUrl) return "⚠ Supabase não configurado.";
        const data=await supabaseFetch("/rest/v1/rpc/execute_sql","POST",{query:input.sql}); return JSON.stringify(data,null,2);
      }
      case "analyze_error":
        return `Análise: "${input.error_message}"\n\nPossíveis causas:\n- Acesso a propriedade de objeto null/undefined\n- Variável não inicializada\n\nSugestão: use optional chaining (?.) e verifique inicializações.\n\nPara análise detalhada, leia o arquivo com github_read_file.`;
      case "github_create_or_update_file": {
        const branch=input.branch||"main"; const content=btoa(unescape(encodeURIComponent(input.content)));
        const sha=await githubGetFileSha(input.path,branch);
        const body={message:input.message,content,branch}; if(sha) body.sha=sha;
        const result=await githubFetch(`/contents/${input.path}`,"PUT",body);
        const action=sha?"atualizado":"criado";
        STATE.files[input.path]=input.content; STATE._fileShas[input.path]=result.content?.sha;
        addLog("success","GITHUB",`Arquivo ${action}: ${input.path} [${result.commit?.sha?.substring(0,7)||"?"}]`);
        return `✅ Arquivo ${action}!\n${input.path}\nBranch: ${branch}\nCommit: ${result.commit?.sha?.substring(0,7)||"?"}`;
      }
      case "github_delete_file": {
        const branch=input.branch||"main"; const sha=await githubGetFileSha(input.path,branch);
        if(!sha) return `⚠ Arquivo não encontrado: ${input.path}`;
        const result=await githubFetch(`/contents/${input.path}`,"DELETE",{message:input.message,sha,branch});
        delete STATE.files[input.path]; addLog("success","GITHUB",`Deletado: ${input.path}`);
        return `🗑 ${input.path} deletado. Commit: ${result.commit?.sha?.substring(0,7)||"?"}`;
      }
      case "github_create_branch": {
        const from=input.from||"main"; const src=await githubFetch(`/branches/${from}`);
        await githubFetch(`/git/refs`,"POST",{ref:`refs/heads/${input.branch}`,sha:src.commit.sha});
        addLog("success","GITHUB",`Branch criada: ${input.branch}`);
        return `🌿 Branch criada: ${input.branch} ← ${from} [${src.commit.sha.substring(0,7)}]`;
      }
      case "github_push_multiple_files": {
        const branch=input.branch||"main"; const files=input.files||[];
        if(!files.length) return "⚠ Nenhum arquivo fornecido.";
        const branchData=await githubFetch(`/branches/${branch}`);
        const baseTree=branchData.commit.commit.tree.sha; const baseSha=branchData.commit.sha;
        const treeItems=await Promise.all(files.map(async f=>{ const blob=await githubFetch(`/git/blobs`,"POST",{content:btoa(unescape(encodeURIComponent(f.content))),encoding:"base64"}); return {path:f.path,mode:"100644",type:"blob",sha:blob.sha}; }));
        const tree=await githubFetch(`/git/trees`,"POST",{base_tree:baseTree,tree:treeItems});
        const commit=await githubFetch(`/git/commits`,"POST",{message:input.message,tree:tree.sha,parents:[baseSha]});
        await githubFetch(`/git/refs/heads/${branch}`,"PATCH",{sha:commit.sha});
        files.forEach(f=>{ STATE.files[f.path]=f.content; });
        addLog("success","GITHUB",`Push: ${files.length} arquivo(s) → ${branch} [${commit.sha.substring(0,7)}]`);
        return `🚀 Push realizado!\nBranch: ${branch} | Commit: ${commit.sha.substring(0,7)}\n${files.map(f=>"  ✓ "+f.path).join("\n")}`;
      }
      case "github_create_pr": {
        const pr=await githubFetch(`/pulls`,"POST",{title:input.title,head:input.branch,base:input.base||"main",body:input.description||""});
        STATE.ghStatus.openPRs++; addLog("success","GITHUB",`PR criado: #${pr.number}`);
        return `🔀 PR #${pr.number}: ${pr.title}\n${pr.head.ref} → ${pr.base.ref}\n${pr.html_url}`;
      }
      case "github_merge_pr": {
        const method=input.merge_method||"squash";
        const result=await githubFetch(`/pulls/${input.pr_number}/merge`,"PUT",{merge_method:method,commit_message:input.message||""});
        addLog("success","GITHUB",`PR #${input.pr_number} merged`);
        return `✅ PR #${input.pr_number} merged (${method})! Commit: ${result.sha?.substring(0,7)||"?"}`;
      }
      case "github_close_issue": {
        if(input.comment) await githubFetch(`/issues/${input.issue_number}/comments`,"POST",{body:input.comment});
        await githubFetch(`/issues/${input.issue_number}`,"PATCH",{state:"closed"});
        addLog("success","GITHUB",`Issue #${input.issue_number} fechada`);
        return `✅ Issue #${input.issue_number} fechada!`;
      }
      case "render_trigger_deploy": {
        if(!KEYS.render||!KEYS.renderService) return "⚠ Configure RENDER_API_KEY e RENDER_SERVICE_ID.";
        const result=await renderFetch(`/services/${KEYS.renderService}/deploys`,"POST",{});
        addLog("success","RENDER",`Deploy: ${result.deploy?.id||"?"}`);
        return `🚀 Deploy iniciado! ID: ${result.deploy?.id||"?"}\nMotivo: ${input.reason}`;
      }
      case "supabase_run_migration":
        return "⚠ Migration SQL requer backend Node.js com acesso admin ao Supabase.";
      case "edit_file":
        STATE.files[input.path]=input.new_content; STATE.modifiedFiles.add(input.path);
        addLog("success","EDITOR",`Editado localmente: ${input.path}`);
        return `✅ Arquivo editado localmente: ${input.path}\n${input.description}\n\nVá à aba Editor → ⬆ COMMIT para subir ao GitHub.`;
      default:
        return `⚠ Tool "${toolName}" não implementada.`;
    }
  }catch(e){
    addLog("warn","TOOL",`${toolName} falhou: ${e.message}`);
    return `⚠ Erro em ${toolName}: ${e.message}`;
  }
}

/* ── DESCRIBE ACTION ─────────────────────────────────── */
function describeAction(toolName,input){
  const descs={
    github_create_or_update_file:`Criar/atualizar: ${input.path}\nBranch: ${input.branch||"main"}\nCommit: "${input.message}"`,
    github_delete_file:`Deletar: ${input.path}\nBranch: ${input.branch||"main"}`,
    github_create_branch:`Nova branch: ${input.branch} ← ${input.from||"main"}`,
    github_push_multiple_files:`Push de ${(input.files||[]).length} arquivo(s) → ${input.branch}\nCommit: "${input.message}"`,
    github_create_pr:`PR: "${input.title}"\n${input.branch} → ${input.base||"main"}`,
    github_merge_pr:`Merge PR #${input.pr_number} (${input.merge_method||"squash"})`,
    github_close_issue:`Fechar issue #${input.issue_number}`,
    render_trigger_deploy:`Redeploy: ${input.reason}`,
    supabase_run_migration:`Migration: ${input.name}\n${(input.sql||"").substring(0,120)}`,
    edit_file:`Editar: ${input.path}\n${input.description||""}`,
  };
  return descs[toolName]||JSON.stringify(input).substring(0,200);
}

function enqueueFileEdit(input){
  STATE.pending.push({
    id:"edit-"+Date.now(), toolName:"edit_file", risk:"high", autoGenerated:false,
    description:`Editar: ${input.path}\n${input.description||""}`,
    input,
    onApprove:()=>{
      STATE.files[input.path]=input.new_content; STATE.modifiedFiles.add(input.path);
      if(STATE.activeFile===input.path){ const ta=_el("code-editor"); if(ta) ta.value=input.new_content; }
      addLog("success","EDITOR",`Editado: ${input.path}`);
    }
  });
  Bus.emit("badges-update");
}

/* ────────────────────────────────────────────────────────
   ══ AGENTIC LOOP — BUG FIX CORE ══
   
   PROBLEMA ORIGINAL:
   A API Anthropic exige que após qualquer mensagem do assistente
   contendo `tool_use` blocks, a próxima mensagem do usuário DEVE
   conter `tool_result` para CADA `tool_use`, com content não-vazio.
   
   O bug acontecia em 2 situações:
   1. Tools high-risk quebravam o loop sem enviar tool_result
   2. Na 2ª mensagem do usuário, o histórico ainda continha
      a última resposta assistant com tool_use sem tool_result
   
   FIX: sanitizeHistory() remove o último par inválido antes de
   cada nova chamada à API. E SEMPRE enviamos tool_result para
   TODAS as tools, incluindo high-risk.
──────────────────────────────────────────────────────── */

/**
 * Remove do histórico qualquer mensagem de assistant no final
 * que contenha tool_use sem o correspondente tool_result na sequência.
 * Isso evita o erro "tool_use ids found without tool_result blocks".
 */
function sanitizeHistory(history){
  if(history.length===0) return history;
  const last=history[history.length-1];
  // Se a última mensagem é do assistente e tem tool_use sem tool_result após ela
  if(last.role==="assistant" && Array.isArray(last.content)){
    const hasToolUse=last.content.some(b=>b.type==="tool_use");
    if(hasToolUse){
      // Não há tool_result após — remove o último turno do assistente
      return history.slice(0,-1);
    }
  }
  return history;
}

async function sendAgent(){
  const inputEl=_el("agent-input");
  const msg=(inputEl?inputEl.value:"").trim();
  if(!msg||STATE.agentLoading) return;

  if(!isConfigured()){
    STATE.agentMsgs.push({role:"assistant",text:"⚠ Configure a Anthropic API Key primeiro.\n\nClique em ⚙ API KEYS no cabeçalho."});
    renderChatMessages(); return;
  }

  inputEl.value=""; inputEl.style.height="";
  STATE.agentLoading=true;

  // ★ FIX 1: Sanitiza histórico antes de adicionar nova mensagem
  STATE.agentHistory=sanitizeHistory(STATE.agentHistory);

  STATE.agentHistory.push({role:"user",content:msg});
  STATE.agentMsgs.push({role:"user",text:msg});
  renderChatMessages(); setAgentLoading(true);
  addLog("info","AGENT",`Input: "${msg.substring(0,70)}${msg.length>70?"...":""}"`);

  try{
    let fullReply="";
    const MAX_ITER=15;

    for(let iter=0;iter<MAX_ITER;iter++){
      // 1. Chama API
      const response=await fetch(ANTHROPIC_API,{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":KEYS.anthropic,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:MODEL,max_tokens:4096,system:buildSystemPrompt(),tools:AGENT_TOOLS,messages:STATE.agentHistory})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error?.message||"Erro na API: "+response.status);

      // 2. Salva resposta do assistente no histórico
      STATE.agentHistory.push({role:"assistant",content:data.content});

      // 3. Extrai texto e tool_use blocks
      const toolUses=[];
      for(const block of data.content||[]){
        if(block.type==="text")     fullReply+=block.text;
        if(block.type==="tool_use") toolUses.push(block);
      }

      // 4. ★ FIX CRITICAL: Se há toolUses, SEMPRE processar (mesmo com end_turn)
      //    antes de quebrar o loop. Caso contrário fica tool_use sem tool_result.
      if(toolUses.length===0) break;

      // 5. ★ FIX CORE: Executa TODAS as tools e coleta tool_results
      //    Inclusive high-risk — sempre retorna tool_result não-vazio
      const toolResults=[];
      let allHighRisk=true;

      for(const tu of toolUses){
        const isHigh=HIGH_RISK_TOOLS_SET.has(tu.name);
        let toolResult;

        if(isHigh){
          allHighRisk=true;
          addLog("warn","AGENT",`Tool: ${tu.name} → ALTO RISCO`);

          // ★ FIX 2: tool_result NUNCA vazio — API rejeita string vazia
          toolResult="Ação enfileirada para aprovação humana. Aguardando confirmação do usuário antes de executar.";

          if(tu.name==="edit_file"&&tu.input.path&&tu.input.new_content){
            enqueueFileEdit(tu.input);
            fullReply+=`\n\n⏳ **edit_file** (${tu.input.path}) → aba Aprovações.`;
          }else{
            const actionId="act-"+Date.now()+"-"+Math.random().toString(36).slice(2,5);
            STATE.pending.push({
              id:actionId,toolName:tu.name,risk:"high",autoGenerated:false,
              description:describeAction(tu.name,tu.input),
              input:tu.input,
              onApprove:async()=>{
                const result=await executeTool(tu.name,tu.input);
                addLog("success","APPROVAL",`${tu.name}: ${result.substring(0,80)}`);
                STATE.agentMsgs.push({role:"assistant",text:`✅ **${tu.name}** executado:\n\n${result}`});
                renderChatMessages();
              }
            });
            Bus.emit("badges-update");
            fullReply+=`\n\n⏳ **${tu.name}** → aba Aprovações.\n_${describeAction(tu.name,tu.input).split("\n")[0]}_`;
          }
        }else{
          allHighRisk=false;
          addLog("info","AGENT",`Tool: ${tu.name} → executando`);
          try{ toolResult=await executeTool(tu.name,tu.input); }
          catch(e){ toolResult="Erro: "+e.message; }
          fullReply+=`\n\n🔧 **${tu.name}:**\n${toolResult}`;
          addLog("success",tu.name.toUpperCase().replace(/_/g,"-"),"OK");
        }

        // ★ FIX 3: Sempre adiciona tool_result, com content garantidamente não-vazio
        toolResults.push({
          type:"tool_result",
          tool_use_id:tu.id,
          content:toolResult||"Processado."
        });
      }

      // 6. Adiciona todos os tool_results no histórico como mensagem do user
      STATE.agentHistory.push({role:"user",content:toolResults});

      // 7. ★ FIX 5: Se TODAS eram high-risk OU API sinalizou end_turn, para
      if(allHighRisk || data.stop_reason==="end_turn") break;
    }

    if(!fullReply) fullReply="Concluído.";
    STATE.agentMsgs.push({role:"assistant",text:fullReply});

  }catch(err){
    STATE.agentMsgs.push({role:"assistant",text:"Erro ao conectar ao agente: "+err.message+"\n\nVerifique: API key configurada? (⚙ API KEYS)"});
    addLog("error","AGENT","Falha: "+err.message);
  }

  STATE.agentLoading=false; setAgentLoading(false); renderChatMessages();
}

/* ── CHAT UI ─────────────────────────────────────────── */
function renderAgentTab(){ renderChatMessages(); }

function renderChatMessages(){
  const container=_el("chat-messages"); if(!container) return;
  container.innerHTML=STATE.agentMsgs.map(m=>`
    <div class="msg-wrap ${m.role}">
      <div class="msg-bubble ${m.role}">
        ${m.role==="assistant"?`<div class="msg-label">✦ AGENTE</div>`:""}
        ${escHtml(m.text)}
      </div>
    </div>`).join("");
  container.scrollTop=container.scrollHeight;
}

function setAgentLoading(loading){
  const btn=_el("agent-send"),think=_el("agent-thinking"),b=_el("agent-status-badge");
  if(btn){ btn.disabled=loading; btn.textContent=loading?"···":"ENVIAR →"; }
  if(think) think.classList.toggle("show",loading);
  if(b){
    b.style.display=loading?"inline-flex":"none";
    b.textContent=loading?"PENSANDO...":"PRONTO";
    b.style.background=loading?"rgba(245,166,35,.12)":"rgba(15,217,138,.12)";
    b.style.color=loading?COLORS.yellow:COLORS.green;
    b.style.border=`1px solid ${loading?COLORS.yellow:COLORS.green}30`;
  }
}

function setAgentPrompt(text){ const el=_el("agent-input"); if(el){el.value=text;el.focus();} }
function analyzeError(msg)   { switchTab("agent"); setAgentPrompt("Analise e corrija este erro: "+msg); }
function openErrorInEditor(m){ switchTab("editor"); const a=_el("ai-edit-instruction"); if(a) a.value="Corrija o bug: "+m.substring(0,100); }
function analyzeFromAlert()  { if(STATE.lastAlertMsg) analyzeError(STATE.lastAlertMsg); dismissAlert(); }
function dismissAlert()      { _el("critical-alert").classList.remove("show"); }

// Auto-resize textarea
function agentInputResize(el){ el.style.height=""; el.style.height=Math.min(el.scrollHeight,120)+"px"; }

// Enter para enviar (Shift+Enter = nova linha)
function agentInputKeydown(e){
  if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendAgent(); }
}

Bus.on("critical-error",(entry)=>{
  STATE.lastAlertMsg=entry.message;
  const alertMsg=_el("alert-msg"); if(alertMsg) alertMsg.textContent=entry.message.substring(0,120);
  const alert=_el("critical-alert"); if(alert){ alert.classList.add("show"); setTimeout(()=>alert.classList.remove("show"),8000); }
});
