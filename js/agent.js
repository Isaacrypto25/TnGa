/* ═══════════════════════════════════════════════════════
   CLAW DEVOPS AGENT v2 — agent.js
   Claude AI chat: tool use, risk classification, real API calls
   GitHub: read, create, update, delete files, push, branches, commits, PRs
═══════════════════════════════════════════════════════ */

const AGENT_TOOLS = [
  // ── READ / INFO (LOW RISK) ────────────────────────
  {
    name: "github_read_file",
    description: "Lê o conteúdo de um arquivo do repositório GitHub.",
    input_schema: { type:"object", properties: {
      path:   { type:"string", description:"Caminho do arquivo (ex: src/server.js)" },
      branch: { type:"string", description:"Branch (padrão: main)" }
    }, required:["path"] }
  },
  {
    name: "github_list_files",
    description: "Lista arquivos e pastas de um diretório do repositório.",
    input_schema: { type:"object", properties: {
      path:   { type:"string", description:"Diretório (vazio = raiz)" },
      branch: { type:"string", description:"Branch (padrão: main)" }
    }}
  },
  {
    name: "github_list_branches",
    description: "Lista todas as branches do repositório.",
    input_schema: { type:"object", properties: {
      limit: { type:"number", description:"Máximo de branches (padrão 30)" }
    }}
  },
  {
    name: "github_list_commits",
    description: "Lista os commits mais recentes de uma branch.",
    input_schema: { type:"object", properties: {
      branch: { type:"string", description:"Branch (padrão: main)" },
      limit:  { type:"number", description:"Número de commits (padrão 20)" },
      path:   { type:"string", description:"Filtrar commits de um arquivo específico (opcional)" }
    }}
  },
  {
    name: "github_list_issues",
    description: "Lista as issues do repositório GitHub.",
    input_schema: { type:"object", properties: {
      state: { type:"string", enum:["open","closed","all"], description:"Estado (padrão: open)" },
      limit: { type:"number", description:"Máximo de issues (padrão 20)" },
      label: { type:"string", description:"Filtrar por label (ex: bug)" }
    }}
  },
  {
    name: "github_list_prs",
    description: "Lista Pull Requests do repositório.",
    input_schema: { type:"object", properties: {
      state: { type:"string", enum:["open","closed","all"], description:"Estado (padrão: open)" },
      limit: { type:"number", description:"Máximo de PRs (padrão 20)" }
    }}
  },
  {
    name: "github_get_commit",
    description: "Obtém detalhes de um commit específico (arquivos alterados, diff).",
    input_schema: { type:"object", properties: {
      sha: { type:"string", description:"SHA do commit" }
    }, required:["sha"] }
  },
  {
    name: "render_get_logs",
    description: "Busca os logs mais recentes do Render.com.",
    input_schema: { type:"object", properties: {
      lines:  { type:"number", description:"Número de linhas (padrão 100)" },
      filter: { type:"string", description:"Filtro de texto" }
    }}
  },
  {
    name: "render_get_metrics",
    description: "Obtém métricas de CPU, memória e requests do Render.",
    input_schema: { type:"object", properties: {
      period: { type:"string", enum:["1h","24h","7d"], description:"Período de análise" }
    }}
  },
  {
    name: "supabase_list_tables",
    description: "Lista todas as tabelas do banco Supabase.",
    input_schema: { type:"object", properties: {} }
  },
  {
    name: "supabase_run_query",
    description: "Executa uma query SELECT somente-leitura no Supabase.",
    input_schema: { type:"object", properties: {
      sql: { type:"string", description:"Query SQL SELECT" }
    }, required:["sql"] }
  },
  {
    name: "analyze_error",
    description: "Analisa um erro, identifica a causa raiz e sugere correção de código.",
    input_schema: { type:"object", properties: {
      error_message: { type:"string", description:"Mensagem de erro completa" },
      stack_trace:   { type:"string", description:"Stack trace (opcional)" },
      file_path:     { type:"string", description:"Arquivo onde ocorreu o erro (opcional)" }
    }, required:["error_message"] }
  },

  // ── WRITE / HIGH RISK ─────────────────────────────
  {
    name: "github_create_or_update_file",
    description: "[ALTO RISCO] Cria ou atualiza (commit + push) um único arquivo diretamente em uma branch do GitHub.",
    input_schema: { type:"object", properties: {
      path:    { type:"string",  description:"Caminho do arquivo (ex: src/utils.js)" },
      content: { type:"string",  description:"Conteúdo completo do arquivo" },
      message: { type:"string",  description:"Mensagem do commit" },
      branch:  { type:"string",  description:"Branch de destino (padrão: main)" }
    }, required:["path","content","message"] }
  },
  {
    name: "github_delete_file",
    description: "[ALTO RISCO] Deleta um arquivo do repositório GitHub via commit.",
    input_schema: { type:"object", properties: {
      path:    { type:"string", description:"Caminho do arquivo a deletar" },
      message: { type:"string", description:"Mensagem do commit de deleção" },
      branch:  { type:"string", description:"Branch (padrão: main)" }
    }, required:["path","message"] }
  },
  {
    name: "github_create_branch",
    description: "[ALTO RISCO] Cria uma nova branch a partir de outra (ou de main).",
    input_schema: { type:"object", properties: {
      branch: { type:"string", description:"Nome da nova branch" },
      from:   { type:"string", description:"Branch de origem (padrão: main)" }
    }, required:["branch"] }
  },
  {
    name: "github_push_multiple_files",
    description: "[ALTO RISCO] Faz push de múltiplos arquivos em um único commit para uma branch. Use para reestruturações grandes.",
    input_schema: { type:"object", properties: {
      branch:  { type:"string", description:"Branch de destino" },
      message: { type:"string", description:"Mensagem do commit" },
      files: {
        type: "array",
        description: "Lista de arquivos a commitar",
        items: { type:"object", properties: {
          path:    { type:"string", description:"Caminho do arquivo" },
          content: { type:"string", description:"Conteúdo completo do arquivo" }
        }, required:["path","content"] }
      }
    }, required:["branch","message","files"] }
  },
  {
    name: "github_create_pr",
    description: "[ALTO RISCO] Cria um Pull Request no GitHub.",
    input_schema: { type:"object", properties: {
      title:       { type:"string", description:"Título do PR" },
      branch:      { type:"string", description:"Branch de origem" },
      base:        { type:"string", description:"Branch de destino (padrão: main)" },
      description: { type:"string", description:"Descrição detalhada das mudanças" }
    }, required:["title","branch"] }
  },
  {
    name: "github_merge_pr",
    description: "[ALTO RISCO] Faz merge de um Pull Request.",
    input_schema: { type:"object", properties: {
      pr_number:    { type:"number", description:"Número do PR" },
      merge_method: { type:"string", enum:["merge","squash","rebase"], description:"Método de merge (padrão: squash)" },
      message:      { type:"string", description:"Mensagem do merge commit (opcional)" }
    }, required:["pr_number"] }
  },
  {
    name: "github_close_issue",
    description: "[ALTO RISCO] Fecha uma issue do repositório.",
    input_schema: { type:"object", properties: {
      issue_number: { type:"number", description:"Número da issue" },
      comment:      { type:"string", description:"Comentário antes de fechar (opcional)" }
    }, required:["issue_number"] }
  },
  {
    name: "render_trigger_deploy",
    description: "[ALTO RISCO] Dispara um redeploy do serviço no Render.com.",
    input_schema: { type:"object", properties: {
      reason:     { type:"string", description:"Motivo do redeploy" },
      service_id: { type:"string", description:"ID do serviço (opcional)" }
    }, required:["reason"] }
  },
  {
    name: "supabase_run_migration",
    description: "[ALTO RISCO] Executa uma migration SQL de alteração de schema no Supabase.",
    input_schema: { type:"object", properties: {
      name: { type:"string", description:"Nome da migration" },
      sql:  { type:"string", description:"SQL da migration (ALTER TABLE, CREATE INDEX, etc.)" }
    }, required:["name","sql"] }
  },
  {
    name: "edit_file",
    description: "[ALTO RISCO] Edita um arquivo localmente no editor visual (não faz push ao GitHub).",
    input_schema: { type:"object", properties: {
      path:        { type:"string", description:"Caminho do arquivo" },
      new_content: { type:"string", description:"Conteúdo completo novo" },
      description: { type:"string", description:"Descrição da mudança" }
    }, required:["path","new_content","description"] }
  },
];

const HIGH_RISK_TOOLS_SET = new Set([
  "github_create_or_update_file",
  "github_delete_file",
  "github_create_branch",
  "github_push_multiple_files",
  "github_create_pr",
  "github_merge_pr",
  "github_close_issue",
  "render_trigger_deploy",
  "supabase_run_migration",
  "edit_file",
]);

/* ── SYSTEM PROMPT ───────────────────────────────── */
function buildSystemPrompt() {
  const m=STATE.metrics, g=STATE.ghStatus, r=STATE.renderStatus, sb=STATE.sbStatus;
  const conns = [
    KEYS.anthropic ? "✓ Claude AI" : "✗ Claude AI (não configurado)",
    KEYS.github    ? `✓ GitHub${KEYS.githubRepo ? " (" + KEYS.githubRepo + ")" : ""}` : "✗ GitHub (não configurado)",
    KEYS.render    ? "✓ Render.com"  : "✗ Render (não configurado)",
    KEYS.supabase  ? "✓ Supabase"   : "✗ Supabase (não configurado)",
  ].join("\n");

  return `Você é o Claw DevOps Agent — agente autônomo de infraestrutura para um projeto Node.js/Express.

CONEXÕES ATIVAS:
${conns}

ESTADO ATUAL DO AMBIENTE:
- GitHub: branch ${g.branch}, commit "${g.lastCommit}" (${g.sha}), CI: ${g.ci}, ${g.openPRs} PRs abertos, ${g.issues} issues
- Render.com: ${r.status}, uptime ${r.uptime}, URL: ${r.url}, último deploy ${r.lastDeploy}
- Supabase: ${sb.status} (${sb.latency}ms), ${sb.tables} tabelas, ${sb.rows} registros, ${sb.connections} conexões
- Métricas: CPU ${m.cpu.toFixed(0)}% | Memória ${m.mem.toFixed(0)}% | Disco ${m.disk.toFixed(0)}% | Net ${m.net.toFixed(0)}%
- Erros ativos: ${STATE.errors.length} | Aprovações pendentes: ${STATE.pending.length}

ARQUIVOS EM EDIÇÃO LOCAL:
${Object.keys(STATE.files).length > 0 ? Object.keys(STATE.files).join(", ") : "Nenhum arquivo carregado ainda."}

OPERAÇÕES GITHUB DISPONÍVEIS:
LOW RISK (executa automaticamente):
  github_read_file         → lê conteúdo de um arquivo
  github_list_files        → lista arquivos/pastas de um diretório
  github_list_branches     → lista todas as branches
  github_list_commits      → histórico de commits de uma branch
  github_list_issues       → lista issues (open/closed/all)
  github_list_prs          → lista Pull Requests
  github_get_commit        → detalhes de um commit específico

HIGH RISK (enfileira para aprovação humana):
  github_create_or_update_file → cria/atualiza arquivo + commit direto
  github_delete_file           → deleta arquivo + commit
  github_create_branch         → cria nova branch
  github_push_multiple_files   → commit de múltiplos arquivos de uma vez (reestruturações)
  github_create_pr             → abre Pull Request
  github_merge_pr              → faz merge de PR
  github_close_issue           → fecha issue

OUTROS HIGH RISK:
  render_trigger_deploy    → redeploy no Render
  supabase_run_migration   → migration SQL
  edit_file                → edita arquivo no editor local (sem push)

FLUXO RECOMENDADO:
1. Mudança simples/rápida → github_create_or_update_file direto na branch
2. Feature/refactor grande → github_create_branch → github_push_multiple_files → github_create_pr
3. Revisão de histórico → github_list_commits + github_get_commit
4. Limpeza → github_delete_file

Seja técnico, direto e objetivo. Explique brevemente o raciocínio antes de cada ferramenta. Português brasileiro.`;
}

/* ── REAL API CALLS ──────────────────────────────── */
async function githubFetch(path, method="GET", body=null) {
  if (!KEYS.github) throw new Error("GitHub token não configurado");
  const repo = KEYS.githubRepo || "";
  const base = repo ? `https://api.github.com/repos/${repo}` : "https://api.github.com";
  const opts = {
    method,
    headers: {
      Authorization: "Bearer " + KEYS.github,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(base + path, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { data = { message: text }; }
  if (!res.ok) throw new Error("GitHub " + res.status + ": " + (data.message || text.substring(0,120)));
  return data;
}

async function githubGetFileSha(path, branch="main") {
  try {
    const f = await githubFetch(`/contents/${encodeURIComponent(path)}?ref=${branch}`);
    return f.sha || null;
  } catch(e) { return null; }
}

async function renderFetch(path, method="GET", body=null) {
  if (!KEYS.render) throw new Error("Render key não configurada");
  const opts = { method, headers: { Authorization: "Bearer " + KEYS.render, "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch("https://api.render.com/v1" + path, opts);
  if (!res.ok) throw new Error("Render API " + res.status);
  return res.json();
}

async function supabaseFetch(path, method="GET", body=null) {
  if (!KEYS.supabase || !KEYS.supabaseUrl) throw new Error("Supabase não configurado");
  const url  = KEYS.supabaseUrl.replace(/\/$/, "") + path;
  const opts = { method, headers: { apikey: KEYS.supabase, Authorization: "Bearer " + KEYS.supabase, "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error("Supabase API " + res.status);
  return res.json();
}

/* ── EXECUTE TOOLS ───────────────────────────────── */
async function executeTool(toolName, input) {
  if (!KEYS.github && toolName.startsWith("github_")) {
    return mockToolResult(toolName, input) + "\n\n⚠ [MOCK] Configure GitHub Token para operações reais.";
  }

  try {
    switch (toolName) {

      // ── READ ──────────────────────────────────────
      case "github_read_file": {
        const branch = input.branch || "main";
        const file   = await githubFetch(`/contents/${input.path}?ref=${branch}`);
        const content = atob(file.content.replace(/\n/g, ""));
        STATE.files[input.path] = content;
        addLog("info", "EDITOR", `Arquivo carregado: ${input.path}`);
        return `✓ ${input.path} (branch: ${branch}) — ${file.size} bytes\n\n\`\`\`\n${content.substring(0,2000)}${content.length>2000?"\n...(truncado)":""}\n\`\`\``;
      }

      case "github_list_files": {
        const branch = input.branch || "main";
        const path   = input.path   || "";
        const items  = await githubFetch(`/contents/${path}?ref=${branch}`);
        const list   = Array.isArray(items) ? items : [items];
        return `📁 /${path} (${branch}):\n\n` +
          list.map(i => `${i.type==="dir"?"📂":"📄"} ${i.name}${i.type==="file"?" ("+i.size+"b)":""}`).join("\n");
      }

      case "github_list_branches": {
        const limit    = input.limit || 30;
        const branches = await githubFetch(`/branches?per_page=${limit}`);
        return `🌿 Branches (${branches.length}):\n\n` +
          branches.map(b => `${b.name===STATE.ghStatus.branch?"→ ":"  "}${b.name}  [${b.commit.sha.substring(0,7)}]`).join("\n");
      }

      case "github_list_commits": {
        const branch  = input.branch || "main";
        const limit   = input.limit  || 20;
        let url = `/commits?sha=${branch}&per_page=${limit}`;
        if (input.path) url += `&path=${input.path}`;
        const commits = await githubFetch(url);
        return `📜 Commits em ${branch}${input.path?" / "+input.path:""}:\n\n` +
          commits.map(c =>
            `[${c.sha.substring(0,7)}] ${c.commit.author.date.substring(0,10)} — ${c.commit.message.split("\n")[0]} (${c.commit.author.name})`
          ).join("\n");
      }

      case "github_list_issues": {
        const state = input.state || "open";
        const limit = input.limit || 20;
        let url = `/issues?state=${state}&per_page=${limit}`;
        if (input.label) url += `&labels=${input.label}`;
        const issues = await githubFetch(url);
        if (!issues.length) return `✓ Nenhuma issue ${state} encontrada.`;
        return `🐛 Issues ${state} (${issues.length}):\n\n` +
          issues.map(i =>
            `#${i.number} [${(i.labels||[]).map(l=>l.name).join(",")||"sem label"}] ${i.title}\n   ${i.user.login} · ${i.created_at.substring(0,10)}`
          ).join("\n\n");
      }

      case "github_list_prs": {
        const state = input.state || "open";
        const limit = input.limit || 20;
        const prs   = await githubFetch(`/pulls?state=${state}&per_page=${limit}`);
        if (!prs.length) return `✓ Nenhum PR ${state}.`;
        return `🔀 Pull Requests ${state} (${prs.length}):\n\n` +
          prs.map(p =>
            `#${p.number} ${p.title}\n   ${p.head.ref} → ${p.base.ref} | ${p.user.login} · ${p.created_at.substring(0,10)}`
          ).join("\n\n");
      }

      case "github_get_commit": {
        const commit = await githubFetch(`/commits/${input.sha}`);
        const files  = (commit.files||[]).map(f =>
          `  ${f.status.padEnd(8)} ${f.filename} (+${f.additions}/-${f.deletions})`
        ).join("\n");
        return `📦 Commit: ${commit.sha.substring(0,7)}\nAutor: ${commit.commit.author.name}\nData: ${commit.commit.author.date.substring(0,10)}\nMensagem: ${commit.commit.message}\n\nArquivos (${commit.files?.length||0}):\n${files}`;
      }

      // ── WRITE ─────────────────────────────────────
      case "github_create_or_update_file": {
        const branch  = input.branch || "main";
        const content = btoa(unescape(encodeURIComponent(input.content)));
        const sha     = await githubGetFileSha(input.path, branch);
        const body    = { message: input.message, content, branch };
        if (sha) body.sha = sha;
        const result  = await githubFetch(`/contents/${input.path}`, "PUT", body);
        const action  = sha ? "atualizado" : "criado";
        STATE.files[input.path] = input.content;
        addLog("success", "GITHUB", `Arquivo ${action}: ${input.path} [${result.commit?.sha?.substring(0,7)||"?"}]`);
        return `✅ Arquivo ${action}!\n\nArquivo: ${input.path}\nBranch: ${branch}\nCommit: ${result.commit?.sha?.substring(0,7)||"?"}\nMensagem: "${input.message}"`;
      }

      case "github_delete_file": {
        const branch = input.branch || "main";
        const sha    = await githubGetFileSha(input.path, branch);
        if (!sha) return `⚠ Arquivo não encontrado: ${input.path} (branch: ${branch})`;
        const result = await githubFetch(`/contents/${input.path}`, "DELETE", { message: input.message, sha, branch });
        delete STATE.files[input.path];
        if (STATE.activeFile === input.path) STATE.activeFile = null;
        addLog("success", "GITHUB", `Arquivo deletado: ${input.path}`);
        return `🗑 Arquivo deletado!\n\nArquivo: ${input.path}\nBranch: ${branch}\nCommit: ${result.commit?.sha?.substring(0,7)||"?"}\nMensagem: "${input.message}"`;
      }

      case "github_create_branch": {
        const from      = input.from || "main";
        const srcBranch = await githubFetch(`/branches/${from}`);
        const sha       = srcBranch.commit.sha;
        await githubFetch(`/git/refs`, "POST", { ref: `refs/heads/${input.branch}`, sha });
        addLog("success", "GITHUB", `Branch criada: ${input.branch} ← ${from}`);
        return `🌿 Branch criada!\n\nNova branch: ${input.branch}\nA partir de: ${from} [${sha.substring(0,7)}]`;
      }

      case "github_push_multiple_files": {
        const branch = input.branch || "main";
        const files  = input.files  || [];
        if (!files.length) return "⚠ Nenhum arquivo fornecido.";

        const branchData = await githubFetch(`/branches/${branch}`);
        const baseTree   = branchData.commit.commit.tree.sha;
        const baseSha    = branchData.commit.sha;

        // Create blobs
        const treeItems = await Promise.all(files.map(async (f) => {
          const blob = await githubFetch(`/git/blobs`, "POST", {
            content:  btoa(unescape(encodeURIComponent(f.content))),
            encoding: "base64"
          });
          return { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
        }));

        // Create tree
        const tree = await githubFetch(`/git/trees`, "POST", { base_tree: baseTree, tree: treeItems });

        // Create commit
        const commit = await githubFetch(`/git/commits`, "POST", {
          message: input.message, tree: tree.sha, parents: [baseSha]
        });

        // Update ref
        await githubFetch(`/git/refs/heads/${branch}`, "PATCH", { sha: commit.sha });

        files.forEach(f => { STATE.files[f.path] = f.content; });
        addLog("success", "GITHUB", `Push: ${files.length} arquivo(s) → ${branch} [${commit.sha.substring(0,7)}]`);
        return `🚀 Push realizado!\n\nBranch: ${branch}\nCommit: ${commit.sha.substring(0,7)}\nMensagem: "${input.message}"\n\nArquivos (${files.length}):\n${files.map(f=>"  ✓ "+f.path).join("\n")}`;
      }

      case "github_create_pr": {
        const pr = await githubFetch(`/pulls`, "POST", {
          title: input.title,
          head:  input.branch,
          base:  input.base || "main",
          body:  input.description || ""
        });
        STATE.ghStatus.openPRs++;
        addLog("success", "GITHUB", `PR criado: #${pr.number} — ${pr.title}`);
        return `🔀 Pull Request criado!\n\nPR #${pr.number}: ${pr.title}\n${pr.head.ref} → ${pr.base.ref}\nURL: ${pr.html_url}`;
      }

      case "github_merge_pr": {
        const method = input.merge_method || "squash";
        const result = await githubFetch(`/pulls/${input.pr_number}/merge`, "PUT", {
          merge_method: method,
          commit_message: input.message || ""
        });
        STATE.ghStatus.openPRs = Math.max(0, STATE.ghStatus.openPRs - 1);
        addLog("success", "GITHUB", `PR #${input.pr_number} merged (${method})`);
        return `✅ PR #${input.pr_number} merged!\nMétodo: ${method}\nCommit: ${result.sha?.substring(0,7)||"?"}`;
      }

      case "github_close_issue": {
        if (input.comment) {
          await githubFetch(`/issues/${input.issue_number}/comments`, "POST", { body: input.comment });
        }
        await githubFetch(`/issues/${input.issue_number}`, "PATCH", { state: "closed" });
        STATE.ghStatus.issues = Math.max(0, STATE.ghStatus.issues - 1);
        addLog("success", "GITHUB", `Issue #${input.issue_number} fechada`);
        return `✅ Issue #${input.issue_number} fechada!${input.comment?"\nComentário: "+input.comment:""}`;
      }

      // ── RENDER ────────────────────────────────────
      case "render_get_logs": {
        if (!KEYS.render || !KEYS.renderService) return mockToolResult(toolName, input);
        const res = await fetch(`https://api.render.com/v1/services/${KEYS.renderService}/logs?limit=${input.lines||100}`, {
          headers: { Authorization: "Bearer " + KEYS.render }
        });
        if (!res.ok) return mockToolResult(toolName, input);
        const data = await res.json();
        const lines = (data.logs || data || []).map(l => `[${l.level||"INFO"}] ${l.message}`).join("\n");
        return lines || mockToolResult(toolName, input);
      }

      case "render_get_metrics": {
        if (!KEYS.render || !KEYS.renderService) return mockToolResult(toolName, input);
        const svc = await renderFetch(`/services/${KEYS.renderService}`);
        return `Serviço: ${svc.service?.name||"—"}\nStatus: ${svc.service?.suspended?"suspended":"active"}\n` + mockToolResult(toolName, input);
      }

      case "render_trigger_deploy": {
        if (!KEYS.render || !KEYS.renderService) return "⚠ Configure RENDER_API_KEY e RENDER_SERVICE_ID.";
        const result = await renderFetch(`/services/${KEYS.renderService}/deploys`, "POST", {});
        addLog("success", "RENDER", `Deploy disparado: ${result.deploy?.id||"?"}`);
        return `🚀 Deploy iniciado!\nID: ${result.deploy?.id||"?"}\nMotivo: ${input.reason}`;
      }

      // ── SUPABASE ──────────────────────────────────
      case "supabase_list_tables": {
        if (!KEYS.supabase || !KEYS.supabaseUrl) return mockToolResult(toolName, input);
        const data = await supabaseFetch("/rest/v1/?select=*");
        return JSON.stringify(data, null, 2);
      }

      case "supabase_run_query": {
        if (!KEYS.supabase || !KEYS.supabaseUrl) return mockToolResult(toolName, input);
        const data = await supabaseFetch("/rest/v1/rpc/execute_sql", "POST", { query: input.sql });
        return JSON.stringify(data, null, 2);
      }

      case "supabase_run_migration":
        return "⚠ Migration SQL requer backend Node.js com supabase-js admin. Crie um endpoint seguro no servidor para executar DDL.";

      case "analyze_error":
        return mockToolResult(toolName, input);

      case "edit_file":
        return mockToolResult(toolName, input);

      default:
        return mockToolResult(toolName, input);
    }
  } catch(e) {
    addLog("warn", "TOOL", `${toolName} falhou: ${e.message}`);
    return `⚠ Erro: ${e.message}\n\n[Fallback mock]\n` + mockToolResult(toolName, input);
  }
}

/* ── MOCK RESULTS ────────────────────────────────── */
function mockToolResult(toolName, input) {
  const m = STATE.metrics;
  const map = {
    render_get_logs:              `[INFO] Server running on port 3000\n[INFO] GET /api/users 200 42ms\n[WARN] Memory usage: 78%\n[ERROR] TypeError: Cannot read properties of undefined (reading 'userId') at auth.js:42\n[INFO] GET /health 200 1ms`,
    render_get_metrics:           `Período: ${input.period||"1h"}\nCPU: ${m.cpu.toFixed(0)}%\nMemória: ${m.mem.toFixed(0)}%\nRequests: 142 req/min | P99: 89ms`,
    github_list_files:            `📄 package.json (1.2kb)\n📄 README.md (3.4kb)\n📂 src\n📂 backend\n📂 frontend\n📂 database`,
    github_list_branches:         `→ main  [abc1234]\n  develop  [def5678]\n  feature/jwt  [ghi9012]\n  autofix/error-001  [jkl3456]`,
    github_list_commits:          `[abc1234] 2025-04-21 — fix: auth middleware (João)\n[def5678] 2025-04-20 — feat: rate limiting (Maria)\n[ghi9012] 2025-04-19 — chore: update deps (João)`,
    github_list_issues:           `#12 [bug] Memory leak no worker process\n#15 [enhancement] Rate limiting em prod\n#18 [bug] Paginação na API /users`,
    github_list_prs:              `#47 fix: auto-correção de unhandled promise\n   autofix/error-001 → main`,
    github_get_commit:            `Commit: abc1234\nAutor: Dev · 2025-04-21\nMensagem: fix: auth middleware\nArquivos: src/auth.js (+12/-3)`,
    supabase_list_tables:         `users — 12,432 rows | RLS: ON\nsessions — 89,201 rows | RLS: ON\nposts — 3,891 rows | RLS: ON`,
    supabase_run_query:           `[{ "id": 1, "email": "user@ex.com" }]`,
    analyze_error:                `Causa raiz: Variável undefined antes da verificação.\nFix: user?.id em vez de user.id\nLinha: auth.js:42\nRisco de regressão: Baixo`,
    edit_file:                    `Arquivo editado: ${input.path||"?"} — ${input.description||""}`,
    github_create_or_update_file: `[MOCK] Arquivo ${input.path} → branch ${input.branch||"main"}: "${input.message}"`,
    github_delete_file:           `[MOCK] Arquivo ${input.path} seria deletado (branch: ${input.branch||"main"})`,
    github_create_branch:         `[MOCK] Branch "${input.branch}" seria criada a partir de ${input.from||"main"}`,
    github_push_multiple_files:   `[MOCK] ${(input.files||[]).length} arquivo(s) em "${input.message}" → ${input.branch}`,
    github_create_pr:             `[MOCK] PR "${input.title}": ${input.branch} → ${input.base||"main"}`,
    github_merge_pr:              `[MOCK] PR #${input.pr_number} merged (${input.merge_method||"squash"})`,
    github_close_issue:           `[MOCK] Issue #${input.issue_number} fechada`,
  };
  return map[toolName] || "Executado (mock).";
}

/* ── MAIN SEND ───────────────────────────────────── */
async function sendAgent() {
  const inputEl = _el("agent-input");
  const msg = (inputEl ? inputEl.value : "").trim();
  if (!msg || STATE.agentLoading) return;

  if (!isConfigured()) {
    STATE.agentMsgs.push({ role:"assistant", text:"\u26a0 Configure a Anthropic API Key primeiro.\n\nClique em \u2699 API KEYS no cabe\u00e7alho." });
    renderChatMessages();
    return;
  }

  inputEl.value = "";
  STATE.agentLoading = true;
  STATE.agentHistory.push({ role:"user", content: msg });
  STATE.agentMsgs.push({ role:"user", text: msg });
  renderChatMessages();
  setAgentLoading(true);
  addLog("info", "AGENT", `Input: "${msg.substring(0,70)}${msg.length>70?"...":""}"`);

  try {
    let fullReply = "";
    let iterations = 0;
    const MAX_ITER = 10;

    // Agentic loop — continua enquanto o modelo retornar tool_use
    while (iterations++ < MAX_ITER) {
      const response = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": KEYS.anthropic,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: MODEL, max_tokens: 4096,
          system: buildSystemPrompt(),
          tools:  AGENT_TOOLS,
          messages: STATE.agentHistory
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Erro na API: " + response.status);

      // Salva resposta do assistente no hist\u00f3rico ANTES de processar tools
      STATE.agentHistory.push({ role:"assistant", content: data.content });

      // Coleta texto e tool_use blocks
      const toolUses = [];
      for (const block of data.content || []) {
        if (block.type === "text")     fullReply += block.text;
        if (block.type === "tool_use") toolUses.push(block);
      }

      // Se n\u00e3o h\u00e1 tool_use, o modelo terminou
      if (toolUses.length === 0 || data.stop_reason === "end_turn") break;

      // Executa cada tool e coleta os tool_result
      const toolResults = [];

      for (const tu of toolUses) {
        const isHigh = HIGH_RISK_TOOLS_SET.has(tu.name);

        if (isHigh) {
          addLog("warn", "AGENT", `Tool: ${tu.name} \u2192 ALTO RISCO \u2014 aguardando aprova\u00e7\u00e3o`);

          const pendingMsg = "A\u00e7\u00e3o enfileirada para aprova\u00e7\u00e3o humana. O usu\u00e1rio deve aprovar na aba Aprova\u00e7\u00f5es.";

          if (tu.name === "edit_file" && tu.input.path && tu.input.new_content) {
            enqueueFileEdit(tu.input);
            fullReply += `\n\n\u23f3 **edit_file** (${tu.input.path}) enfileirado \u2192 aba Aprova\u00e7\u00f5es.`;
          } else {
            const actionId = "act-" + Date.now() + "-" + Math.random().toString(36).slice(2,5);
            STATE.pending.push({
              id:            actionId,
              toolName:      tu.name,
              risk:          "high",
              autoGenerated: false,
              description:   describeAction(tu.name, tu.input),
              input:         tu.input,
              onApprove:     async () => {
                const result = await executeTool(tu.name, tu.input);
                addLog("success", "APPROVAL", `${tu.name}: ${result.substring(0,80)}`);
                STATE.agentMsgs.push({ role:"assistant", text:`\u2705 **${tu.name}** aprovado e executado:\n\n${result}` });
                renderChatMessages();
              }
            });
            Bus.emit("badges-update");
            fullReply += `\n\n\u23f3 **${tu.name}** enfileirado para aprova\u00e7\u00e3o \u2192 aba Aprova\u00e7\u00f5es.\n_${describeAction(tu.name, tu.input).split("\n")[0]}_`;
          }

          toolResults.push({ type:"tool_result", tool_use_id: tu.id, content: pendingMsg });

        } else {
          addLog("info", "AGENT", `Tool: ${tu.name} \u2192 executando`);
          let result;
          try {
            result = await executeTool(tu.name, tu.input);
          } catch(e) {
            result = "Erro ao executar tool: " + e.message;
          }

          fullReply += `\n\n\ud83d\udd27 **${tu.name}:**\n${result}`;
          addLog("success", tu.name.toUpperCase().replace(/_/g,"-"), "OK");

          toolResults.push({ type:"tool_result", tool_use_id: tu.id, content: result });
        }
      }

      // Adiciona os tool_results no hist\u00f3rico para o pr\u00f3ximo turno
      STATE.agentHistory.push({ role:"user", content: toolResults });

      // Se todos eram high-risk (enfileirados), para o loop
      const allHighRisk = toolUses.every(tu => HIGH_RISK_TOOLS_SET.has(tu.name));
      if (allHighRisk) break;
    }

    if (!fullReply) fullReply = "Entendido. N\u00e3o h\u00e1 mais nada a executar.";
    STATE.agentMsgs.push({ role:"assistant", text: fullReply });

  } catch(err) {
    STATE.agentMsgs.push({ role:"assistant", text: "Erro ao conectar ao agente: " + err.message + "\n\nVerifique: API key configurada? (\u2699 API KEYS)" });
    addLog("error", "AGENT", "Falha: " + err.message);
  }

  STATE.agentLoading = false;
  setAgentLoading(false);
  renderChatMessages();
}

/* ── DESCRIBE ACTION (for approval cards) ─────────── */
function describeAction(toolName, input) {
  const descs = {
    github_create_or_update_file: `Criar/atualizar: ${input.path}\nBranch: ${input.branch||"main"}\nCommit: "${input.message}"`,
    github_delete_file:           `Deletar: ${input.path}\nBranch: ${input.branch||"main"}\nCommit: "${input.message}"`,
    github_create_branch:         `Nova branch: ${input.branch}\nA partir de: ${input.from||"main"}`,
    github_push_multiple_files:   `Push de ${(input.files||[]).length} arquivo(s) → ${input.branch}\nCommit: "${input.message}"\n${(input.files||[]).map(f=>"  "+f.path).join("\n")}`,
    github_create_pr:             `PR: "${input.title}"\n${input.branch} → ${input.base||"main"}`,
    github_merge_pr:              `Merge PR #${input.pr_number} (${input.merge_method||"squash"})`,
    github_close_issue:           `Fechar issue #${input.issue_number}${input.comment?"\nComentário: "+input.comment:""}`,
    render_trigger_deploy:        `Redeploy: ${input.reason}`,
    supabase_run_migration:       `Migration: ${input.name}\n${(input.sql||"").substring(0,120)}`,
    edit_file:                    `Editar local: ${input.path}\n${input.description||""}`,
  };
  return descs[toolName] || JSON.stringify(input).substring(0,200);
}

function enqueueFileEdit(input) {
  STATE.pending.push({
    id: "edit-" + Date.now(), toolName: "edit_file", risk: "high", autoGenerated: false,
    description: `Editar arquivo local: ${input.path}\n${input.description||""}`,
    input,
    onApprove: () => {
      STATE.files[input.path] = input.new_content;
      if (STATE.activeFile === input.path) loadFileInEditor(input.path);
      addLog("success", "EDITOR", `Arquivo editado: ${input.path}`);
    }
  });
  Bus.emit("badges-update");
}

/* ── CHAT UI ─────────────────────────────────────── */
function renderAgentTab() { renderChatMessages(); }

function renderChatMessages() {
  const container = _el("chat-messages");
  if (!container) return;
  container.innerHTML = STATE.agentMsgs.map(m =>
    `<div class="msg-wrap ${m.role}">
      <div class="msg-bubble ${m.role}">
        ${m.role === "assistant" ? `<div class="msg-label">✦ AGENTE</div>` : ""}
        ${escHtml(m.text)}
      </div>
    </div>`
  ).join("");
  container.scrollTop = container.scrollHeight;
}

function setAgentLoading(loading) {
  const btn = _el("agent-send"), think = _el("agent-thinking"), b = _el("agent-status-badge");
  if (btn)   { btn.disabled = loading; btn.textContent = loading ? "···" : "ENVIAR →"; }
  if (think) think.classList.toggle("show", loading);
  if (b) {
    b.textContent      = loading ? "PENSANDO..." : "PRONTO";
    b.style.background = loading ? "rgba(245,166,35,.12)" : "rgba(15,217,138,.12)";
    b.style.color      = loading ? COLORS.yellow : COLORS.green;
    b.style.border     = `1px solid ${loading ? COLORS.yellow : COLORS.green}30`;
  }
}

function setAgentPrompt(text) { const el=_el("agent-input"); if(el){el.value=text;el.focus();} }
function analyzeError(msg)    { switchTab("agent"); setAgentPrompt("Analise e corrija este erro: " + msg); }
function openErrorInEditor(m) { switchTab("editor"); const a=_el("ai-edit-instruction"); if(a) a.value="Corrija o bug: "+m.substring(0,100); }
function analyzeFromAlert()   { if(STATE.lastAlertMsg) analyzeError(STATE.lastAlertMsg); dismissAlert(); }
function dismissAlert()       { _el("critical-alert").classList.remove("show"); }

Bus.on("critical-error", (entry) => {
  STATE.lastAlertMsg = entry.message;
  _el("alert-msg").textContent = entry.message.substring(0,120);
  _el("critical-alert").classList.add("show");
  setTimeout(() => _el("critical-alert").classList.remove("show"), 8000);
});
