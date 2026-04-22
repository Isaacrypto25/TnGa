/* ═══════════════════════════════════════════════════════
   CLAW DevOps Agent v3 — editor.js
   BUG FIX: Editor lista SOMENTE arquivos do repositório GitHub
   configurado, nunca arquivos do sistema/skills.
   Ao trocar de repo, limpa STATE.files e recarrega.
═══════════════════════════════════════════════════════ */

function renderEditorTab(){
  // ★ FIX: Se não há repo configurado, mostra aviso e limpa lista
  if(!KEYS.github||!KEYS.githubRepo){
    const fl=_el("file-list");
    if(fl) fl.innerHTML=`<div style="padding:12px;color:var(--text-dim);font-size:10px;line-height:1.8;">Configure GitHub Token e Repo em<br>⚙ API KEYS para navegar arquivos.</div>`;
    return;
  }
  // Busca do GitHub, ignorando STATE.files para a árvore
  fetchGitHubFileTree(STATE._fileTreePath||"");
  if(STATE.activeFile&&STATE.files[STATE.activeFile]!==undefined){
    loadFileInEditor(STATE.activeFile);
  }
}

/* ── FETCH FILE TREE FROM GITHUB ────────────────────── */
async function fetchGitHubFileTree(path){
  if(!KEYS.github||!KEYS.githubRepo){
    const fl=_el("file-list");
    if(fl) fl.innerHTML=`<div style="padding:12px;color:var(--text-dim);font-size:10px;">Configure GitHub nas ⚙ API KEYS.</div>`;
    return;
  }

  const branch=STATE.ghStatus.branch||"main";
  const apiPath=path
    ?`https://api.github.com/repos/${KEYS.githubRepo}/contents/${path}?ref=${branch}`
    :`https://api.github.com/repos/${KEYS.githubRepo}/contents?ref=${branch}`;

  const fl=_el("file-list");
  if(fl) fl.innerHTML=`<div style="padding:12px;color:var(--text-dim);font-size:10px;">Carregando...</div>`;

  try{
    const res=await fetch(apiPath,{headers:{Authorization:"Bearer "+KEYS.github,Accept:"application/vnd.github+json"}});
    const items=await res.json();

    // ★ FIX: Valida que a resposta é do repo correto (array de items do GitHub)
    if(!Array.isArray(items)){
      // Pode ser erro de autenticação ou repo inválido
      const msg=items?.message||"Resposta inesperada";
      if(fl) fl.innerHTML=`<div style="padding:12px;color:var(--red);font-size:10px;">Erro: ${escHtml(msg)}</div>`;
      addLog("warn","EDITOR","Erro ao carregar tree: "+msg);
      return;
    }

    // Ordena: pastas primeiro, depois arquivos
    items.sort((a,b)=>{ if(a.type===b.type) return a.name.localeCompare(b.name); return a.type==="dir"?-1:1; });
    STATE._fileTreePath=path||"";
    renderFileTreeItems(items,path||"");
  }catch(e){
    if(fl) fl.innerHTML=`<div style="padding:12px;color:var(--red);font-size:10px;">Erro: ${escHtml(e.message)}</div>`;
    addLog("warn","EDITOR","Erro ao carregar tree: "+e.message);
  }
}

function renderFileTreeItems(items,currentPath){
  const list=_el("file-list"); if(!list) return;
  let html="";

  // Botão de voltar se estiver numa subpasta
  if(currentPath){
    const parent=currentPath.includes("/")?currentPath.substring(0,currentPath.lastIndexOf("/")):"";
    html+=`<div class="file-item" onclick="fetchGitHubFileTree('${escAttr(parent)}')" style="color:var(--text-dim);">← voltar</div>`;
  }

  html+=items.map(item=>{
    const isDir=item.type==="dir";
    const isLoaded=STATE.files[item.path]!==undefined;
    const isActive=STATE.activeFile===item.path;
    const isModified=STATE.modifiedFiles.has(item.path);
    return `<div class="file-item ${isActive?"active":""}" onclick="${isDir?`fetchGitHubFileTree('${escAttr(item.path)}')`:`loadFileFromGitHub('${escAttr(item.path)}')`}">
      ${isModified?`<span class="file-modified-dot"></span>`:`<span style="width:5px"></span>`}
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${isDir?"📂 ":isLoaded?"📄 ":"  "}${escHtml(item.name)}</span>
      ${isDir?`<span style="color:var(--text-dim);font-size:9px;">›</span>`:""}
    </div>`;
  }).join("");

  list.innerHTML=html;
}

/* ── LOAD FILE FROM GITHUB ──────────────────────────── */
async function loadFileFromGitHub(path){
  // Se já está em memória, só abre
  if(STATE.files[path]!==undefined){ loadFileInEditor(path); return; }

  const branch=STATE.ghStatus.branch||"main";
  const fn=_el("editor-filename"); if(fn) fn.textContent=path+" (carregando...)";

  try{
    const res=await fetch(`https://api.github.com/repos/${KEYS.githubRepo}/contents/${path}?ref=${branch}`,
      {headers:{Authorization:"Bearer "+KEYS.github,Accept:"application/vnd.github+json"}});
    const data=await res.json();
    if(!res.ok) throw new Error(data.message||"HTTP "+res.status);
    const content=atob(data.content.replace(/\n/g,""));
    STATE.files[path]=content;
    STATE._fileShas[path]=data.sha;
    addLog("success","EDITOR",`Carregado: ${path}`);
    loadFileInEditor(path);
    // Rerender tree para mostrar ícone de carregado
    fetchGitHubFileTree(STATE._fileTreePath||"");
  }catch(e){
    if(fn) fn.textContent="Erro ao carregar: "+path;
    addLog("error","EDITOR","Erro ao carregar "+path+": "+e.message);
  }
}

/* ── LOAD FILE IN EDITOR ────────────────────────────── */
function loadFileInEditor(path){
  STATE.activeFile=path;
  const ta=_el("code-editor"); if(!ta) return;
  ta.value=STATE.files[path]||"";
  const fn=_el("editor-filename"); if(fn) fn.textContent=path;
  const mb=_el("editor-modified-badge"); if(mb) mb.textContent=STATE.modifiedFiles.has(path)?"● MODIFICADO":"";
  updateEditorStats();
  const commitBtn=_el("editor-commit-btn");
  if(commitBtn) commitBtn.style.display=KEYS.github?"inline-flex":"none";
}

function onEditorInput(){
  if(!STATE.activeFile) return;
  STATE.files[STATE.activeFile]=_el("code-editor").value;
  STATE.modifiedFiles.add(STATE.activeFile);
  const mb=_el("editor-modified-badge"); if(mb) mb.textContent="● MODIFICADO";
  updateEditorStats();
}

function updateEditorStats(){
  const ta=_el("code-editor"); if(!ta) return;
  const lines=_el("editor-stat-lines"); if(lines) lines.textContent=ta.value.split("\n").length+" linhas";
  const chars=_el("editor-stat-chars"); if(chars) chars.textContent=ta.value.length+" chars";
}

function saveCurrentFile(){
  if(!STATE.activeFile) return;
  STATE.modifiedFiles.delete(STATE.activeFile);
  const mb=_el("editor-modified-badge"); if(mb) mb.textContent="";
  const es=_el("editor-status"); if(es){ es.textContent="Salvo "+timePT(); setTimeout(()=>{ if(es) es.textContent=""; },3000); }
  addLog("success","EDITOR","Salvo localmente: "+STATE.activeFile);
}

function addNewFile(){
  const name=prompt("Nome do arquivo (ex: backend/routes/auth.js):");
  if(!name||!name.trim()) return;
  STATE.files[name.trim()]="// "+name.trim()+"\n";
  STATE.modifiedFiles.add(name.trim());
  loadFileInEditor(name.trim());
}

function handleEditorKeydown(e){
  if(e.ctrlKey&&e.key==="s"){ e.preventDefault(); saveCurrentFile(); return; }
  if(e.key==="Tab"){
    e.preventDefault();
    const ta=e.target, start=ta.selectionStart, end=ta.selectionEnd;
    ta.value=ta.value.substring(0,start)+"  "+ta.value.substring(end);
    ta.selectionStart=ta.selectionEnd=start+2;
    onEditorInput();
  }
}

/* ── COMMIT TO GITHUB ───────────────────────────────── */
async function commitCurrentFile(){
  if(!STATE.activeFile){ alert("Nenhum arquivo selecionado."); return; }
  if(!KEYS.github||!KEYS.githubRepo){ alert("Configure GitHub Token e Repo nas ⚙ API KEYS."); return; }
  const msg=prompt("Mensagem do commit:","update: "+STATE.activeFile);
  if(!msg) return;
  const btn=_el("editor-commit-btn");
  if(btn){ btn.disabled=true; btn.textContent="⏳ COMMITANDO..."; }
  const branch=STATE.ghStatus.branch||"main";
  const content=btoa(unescape(encodeURIComponent(STATE.files[STATE.activeFile])));
  const sha=STATE._fileShas?.[STATE.activeFile]||null;
  try{
    const body={message:msg,content,branch}; if(sha) body.sha=sha;
    const res=await fetch(`https://api.github.com/repos/${KEYS.githubRepo}/contents/${STATE.activeFile}`,
      {method:"PUT",headers:{Authorization:"Bearer "+KEYS.github,Accept:"application/vnd.github+json","Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await res.json();
    if(!res.ok) throw new Error(data.message||"HTTP "+res.status);
    STATE._fileShas[STATE.activeFile]=data.content?.sha;
    STATE.modifiedFiles.delete(STATE.activeFile);
    const mb=_el("editor-modified-badge"); if(mb) mb.textContent="";
    const es=_el("editor-status"); if(es){ es.textContent="✓ Commit "+data.commit?.sha?.substring(0,7); setTimeout(()=>{ if(es) es.textContent=""; },4000); }
    addLog("success","GITHUB",`Commit: ${STATE.activeFile} [${data.commit?.sha?.substring(0,7)}] — "${msg}"`);
  }catch(e){
    addLog("error","EDITOR","Commit falhou: "+e.message);
    alert("Erro ao fazer commit: "+e.message);
  }
  if(btn){ btn.disabled=false; btn.textContent="⬆ COMMIT"; }
}

/* ── AI EDIT ────────────────────────────────────────── */
async function applyAiEdit(){
  const instruction=_el("ai-edit-instruction").value.trim();
  if(!instruction||!STATE.activeFile){ alert("Selecione um arquivo e descreva a mudança."); return; }
  if(!isConfigured()){ alert("Configure a Anthropic API Key (⚙ API KEYS)."); return; }
  const btn=document.querySelector(".ai-edit-btn");
  if(btn){ btn.disabled=true; btn.textContent="✦ APLICANDO..."; }
  addLog("info","AGENT",`AI Edit em ${STATE.activeFile}: ${instruction.substring(0,60)}`);
  try{
    const currentContent=STATE.files[STATE.activeFile]||"";
    const res=await fetch(ANTHROPIC_API,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":KEYS.anthropic,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:MODEL,max_tokens:4096,messages:[{role:"user",content:`Você é um assistente de código. O arquivo atual é:\n\nArquivo: ${STATE.activeFile}\n\`\`\`\n${currentContent}\n\`\`\`\n\nInstrução: ${instruction}\n\nResponda APENAS com o código completo e atualizado do arquivo, sem explicações, sem markdown, sem backticks. Apenas o código puro.`}]})
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.error?.message||"Erro "+res.status);
    const newContent=data.content?.[0]?.text||"";
    if(newContent){
      STATE.files[STATE.activeFile]=newContent; STATE.modifiedFiles.add(STATE.activeFile);
      const ta=_el("code-editor"); if(ta) ta.value=newContent;
      const mb=_el("editor-modified-badge"); if(mb) mb.textContent="● MODIFICADO";
      const inst=_el("ai-edit-instruction"); if(inst) inst.value="";
      updateEditorStats(); addLog("success","AGENT","AI Edit aplicado em "+STATE.activeFile);
    }
  }catch(e){ addLog("error","AGENT","AI Edit falhou: "+e.message); alert("Erro ao aplicar IA: "+e.message); }
  if(btn){ btn.disabled=false; btn.textContent="✦ APLICAR IA"; }
}

/* ── LIMPAR ESTADO AO TROCAR REPO ───────────────────── */
// Chamado após salvar novas API keys para evitar cache de arquivos do repo antigo
function clearEditorState(){
  STATE.files={}; STATE.activeFile=null; STATE.modifiedFiles=new Set();
  STATE._fileShas={}; STATE._fileTreePath="";
  const ta=_el("code-editor"); if(ta) ta.value="";
  const fn=_el("editor-filename"); if(fn) fn.textContent="Nenhum arquivo selecionado";
  const mb=_el("editor-modified-badge"); if(mb) mb.textContent="";
  addLog("info","EDITOR","Estado do editor limpo — novo repositório configurado");
}
