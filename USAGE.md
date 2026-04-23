/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLAW DevOps Agent v3 — API Reference & Usage Examples
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este arquivo documenta as novas APIs e como usá-las.
 */

/* ════════════════════════════════════════════════════════════════════════════
   1. UI MANAGEMENT (ui.js)
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * DRAWER MENU CONTROL
 * ────────────────────
 */

// Abrir drawer menu
openDrawer();

// Fechar drawer menu
closeDrawer();

// Toggle drawer (abrir/fechar)
toggleMenu();

// Toggle painel de ferramentas dentro do drawer
toggleDrawerTools();

/**
 * COMMAND PALETTE
 * ───────────────
 */

// Abrir command palette (Ctrl+K também funciona)
openCommandPalette();

// Fechar command palette
closeCommandPalette();

// Adicionar novo comando
COMMANDS.push({
  id: "my-command",
  icon: "🚀",
  title: "Meu Comando",
  desc: "Descrição curta",
  action: () => console.log("Executado!"),
  keys: "Ctrl+Shift+M",
});

// Buscar/filtrar comandos
filterCommands("github"); // busca por título, descrição, id

/**
 * NOTIFICATIONS SYSTEM
 * ────────────────────
 */

// Adicionar notificação
addNotification("Operação concluída", "success", 3000);
// Tipos: "info", "success", "warning", "error"
// Duration em ms (0 = sem auto-dismiss)

// Exemplos:
addNotification("Erro crítico!", "error", 5000);
addNotification("Conectado com sucesso", "success");
addNotification("⚠ Aviso: Taxa alta de CPU", "warning", 6000);

// Remover notificação específica
removeNotification(notificationId);

// Limpar todas as notificações
clearNotifications();

// Abrir/fechar painel de notificações
openNotifications();
closeNotifications();

/**
 * QUICK ACTIONS
 * ─────────────
 */

// Grid de ações rápidas (acessível automaticamente na UI)
showQuickActions();
hideQuickActions();

// Adicionar nova quick action
QUICK_ACTIONS.push({
  icon: "🔐",
  label: "Security Check",
  action: () => runSecurityCheck(),
});

/**
 * KEYBOARD SHORTCUTS
 * ──────────────────
 */

// Atalhos integrados:
// Ctrl+K     → Command Palette
// Ctrl+/     → Mostrar shortcuts
// Ctrl+1-7   → Mudar abas (Dashboard, GitHub, Render, Supabase, Logs, Erros, Chat)
// Ctrl+R     → Atualizar dados
// Ctrl+E     → Exportar
// Ctrl+,     → Configurações

// Dentro do command palette:
// ↑↓         → Navegar
// Enter      → Executar
// Escape     → Fechar

/**
 * GESTURES
 * ────────
 */

// Detecção automática de gestos:
// Swipe Right (do edge esquerdo)  → Abrir drawer
// Swipe Left                      → Fechar drawer

/**
 * THEME MANAGEMENT
 * ────────────────
 */

// Toggle tema (dark ↔ light)
toggleTheme();

// Tema atual
console.log(currentTheme); // "dark" ou "light"

// Aplicar tema específico
applyTheme("light");

/**
 * DATA EXPORT
 * ──────────
 */

// Exportar dados (logs, erros, workflows, status) como JSON
exportData();
// Baixa arquivo: claw-export-[timestamp].json

/* ════════════════════════════════════════════════════════════════════════════
   2. TOOLS & UTILITIES (tools.js)
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * SETTINGS MANAGEMENT
 * ───────────────────
 */

// Carregar configurações do localStorage
loadSettings();

// Modificar setting
updateSetting("theme", "light");
updateSetting("autoRefresh", false);
updateSetting("notificationsEnabled", true);

// Settings disponíveis:
// - theme: "dark" | "light"
// - sidebarCollapsed: boolean
// - autoRefresh: boolean
// - refreshInterval: ms
// - notificationsEnabled: boolean
// - soundEnabled: boolean
// - compactMode: boolean
// - analyticsEnabled: boolean

// Salvar configurações
saveSettings();

// Ouvir mudanças de setting
Bus.on("setting-changed", ({ key, value }) => {
  console.log(`${key} mudou para ${value}`);
});

/**
 * ANALYTICS
 * ─────────
 */

// Rastreamento automático:
// - Sessions: número de vezes que abriu a app
// - Total time: tempo total gasto
// - Actions: ações rastreadas por tipo
// - Errors: número de errors críticos

// Inicializar analytics
initAnalytics();

// Rastrear ação customizada
trackAction("deploy-triggered", { service: "render" });

// Obter dados de analytics
const analytics = getAnalytics();
console.log(analytics);
// {
//   sessions: 5,
//   totalTime: 3600,
//   actions: {
//     "tab-switch": 42,
//     "deploy-triggered": 3,
//   },
//   errors: 2,
//   lastReset: timestamp
// }

// Resetar analytics
resetAnalytics();

/**
 * PERFORMANCE MONITORING
 * ──────────────────────
 */

// Marcar métrica (automático em ações longas)
markMetric("api-call");

// Obter relatório de performance
const report = getPerformanceReport();
console.log(report);
// {
//   uptime: "2m 34s",
//   metrics: { "api-call": {...} },
//   slowActions: [...],
//   memoryUsage: { used: 45, total: 120, limit: 512 }
// }

/**
 * CACHE MANAGEMENT
 * ────────────────
 */

// Cachear dados (com TTL)
cacheSet("github-user", userData, 600000); // 10 min
cacheSet("api-response", response);        // 5 min default

// Recuperar do cache
const user = cacheGet("github-user");

// Deletar do cache
cacheDelete("github-user");

// Limpar todo cache
cacheClear();

// Ver estatísticas do cache
const stats = getCacheStats();
// { validItems: 5, expiredItems: 2, totalSize: 45678 }

/**
 * DATA BACKUP & RESTORE
 * ─────────────────────
 */

// Criar backup manual
createBackup("Pre-deploy backup");

// Listar todos os backups
const backups = listBackups();
backups.forEach(b => {
  console.log(`${b.label} - ${new Date(b.timestamp)}`);
});

// Restaurar backup
restoreBackup(backups[0].timestamp);

// Deletar backup
deleteBackup(backups[0].timestamp);

// ⚠️ Backups automáticos ocorrem a cada hora se analyticsEnabled=true

/**
 * BROWSER & SYSTEM INFO
 * ─────────────────────
 */

// Obter informações do navegador
const browser = getBrowserInfo();
// {
//   browser: "Chrome",
//   version: "120.0",
//   os: "Windows",
//   isMobile: false,
//   isTablet: false,
//   userAgent: "..."
// }

// Obter informações do sistema
const system = getSystemInfo();
// {
//   browser: {...},
//   screen: { width, height, orientation, pixelRatio },
//   features: { localStorage, serviceWorker, notification, ... },
//   connection: { type, downlink, rtt, saveData },
//   memory: { cores, memory }
// }

/**
 * OFFLINE SUPPORT
 * ───────────────
 */

// Verificar se está online
if (isOnline()) {
  console.log("Conectado!");
} else {
  console.log("Offline - modo offline ativado");
}

// Enfileirar ação para offline
queueOfflineAction({ task: "deploy", service: "render" });

// Processador automático quando voltar online
// Escuta eventos:
window.addEventListener("online", () => {
  console.log("Conexão restaurada!");
});

window.addEventListener("offline", () => {
  console.log("Perdeu conexão");
});

/* ════════════════════════════════════════════════════════════════════════════
   3. ADVANCED CSS CLASSES (advanced-features.css)
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * GLASSMORPHISM
 * ─────────────
 */

// <div class="glass">Glassmorphic element</div>

/**
 * NEON EFFECTS
 * ────────────
 */

// <div class="neon-green">Glowing text</div>
// <div class="neon-copper">Copper glow</div>
// <div class="neon-blue">Blue glow</div>
// <div class="glow-box">Glowing box</div>
// <div class="glow-box danger">Red glow</div>

/**
 * MICRO-INTERACTIONS
 * ──────────────────
 */

// <button class="tap-scale">Tap me</button>
// <div class="hover-lift">Hover me</div>
// <div class="pulse-attention">Pulsing element</div>
// <div class="shimmer">Shimmering effect</div>

/**
 * SKELETON LOADING
 * ────────────────
 */

// <div class="skeleton skeleton-text"></div>
// <div class="skeleton skeleton-card"></div>

/**
 * STATUS INDICATORS
 * ────────────────
 */

// <span class="status-indicator online"></span>
// <span class="status-indicator offline"></span>
// <span class="status-indicator idle"></span>

/**
 * BADGES & ANIMATIONS
 * ───────────────────
 */

// <span class="badge badge-pulse">New</span>
// <span class="badge badge-new">Hot</span>

/**
 * FLOATING ACTION BUTTON
 * ──────────────────────
 */

// <button class="fab bottom-right">+</button>

/* ════════════════════════════════════════════════════════════════════════════
   4. BUS EVENTS (Event-driven architecture)
   ════════════════════════════════════════════════════════════════════════════ */

// Escutar tab switch
Bus.on("tab-switched", (tab) => {
  console.log(`Switched to ${tab}`);
  trackAction("tab-switch", { tab });
});

// Escutar novo log
Bus.on("log-new", (entry) => {
  console.log(`[${entry.level}] ${entry.source}: ${entry.message}`);
  if (entry.level === "error") {
    addNotification(entry.message, "error");
  }
});

// Escutar erro crítico
Bus.on("critical-error", (entry) => {
  addNotification(`Critical: ${entry.message}`, "error", 8000);
  trackAction("critical-error");
});

// Escutar mudança de status
Bus.on("status-update", () => {
  console.log("Sistema status atualizado");
});

// Emitir evento customizado
Bus.emit("custom-event", { data: "..." });

/* ════════════════════════════════════════════════════════════════════════════
   5. INTEGRATION EXAMPLES
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * EXAMPLE 1: Criar dashboard customizado
 */
function setupCustomDashboard() {
  // Quando página carregar
  Bus.on("status-update", () => {
    const metrics = {
      github: STATE.ghStatus,
      render: STATE.renderStatus,
      supabase: STATE.sbStatus,
    };
    console.log("Dashboard atualizado:", metrics);
  });
}

/**
 * EXAMPLE 2: Notificação de erro com opção de análise
 */
function setupErrorHandling() {
  Bus.on("critical-error", (entry) => {
    addNotification(`⚠ ${entry.message}`, "error", 0);

    // Opção de análise com agente
    if (confirm("Analisar erro com agente IA?")) {
      switchTab("chat");
      // Enviar para agente analisar
    }
  });
}

/**
 * EXAMPLE 3: Auto-sync com analytics
 */
function setupAutoSync() {
  // Sincronizar analytics a cada 5 min
  setInterval(() => {
    if (SETTINGS.analyticsEnabled) {
      const analytics = getAnalytics();
      console.log("Syncing analytics:", analytics);
      // Enviar para servidor
    }
  }, 300000);

  // Criar backup automático antes de deploy
  Bus.on("deploy-start", () => {
    createBackup("Pre-deploy");
  });
}

/**
 * EXAMPLE 4: Performance monitoring
 */
function setupPerformanceMonitoring() {
  // Mostrar modo compacto se memória alta
  setInterval(() => {
    const report = getPerformanceReport();
    if (report.memoryUsage && report.memoryUsage.used > report.memoryUsage.total * 0.8) {
      updateSetting("compactMode", true);
      addNotification("⚠ Modo compacto ativado (memória alta)", "warning");
    }
  }, 30000);
}

/**
 * EXAMPLE 5: Custom commands
 */
function setupCustomCommands() {
  // Adicionar comando para gerar relatório
  COMMANDS.push({
    id: "generate-report",
    icon: "📊",
    title: "Gerar Relatório",
    desc: "Cria relatório de deployment",
    action: () => {
      const report = getAnalytics();
      exportData();
      addNotification("Relatório gerado!", "success");
    },
    keys: "Ctrl+Shift+R",
  });
}

/**
 * EXAMPLE 6: Sincronização com GitHub
 */
async function setupGitHubIntegration() {
  Bus.on("tab-switched", async (tab) => {
    if (tab === "github") {
      markMetric("github-fetch");
      try {
        await fetchGitHubStatus();
        addNotification("Status do GitHub atualizado", "success", 2000);
      } catch (e) {
        addNotification("Erro ao atualizar GitHub", "error");
      }
    }
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   6. MOBILE-SPECIFIC USAGE
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Para dispositivos móveis:
 * - Drawer menu automático (toque ☰ ou deslize pela esquerda)
 * - Command palette otimizada (full-screen em mobile)
 * - Touch targets mínimos de 44x44px
 * - Safe areas para notch/home-button (iPX+, Dynamic Island)
 * - Gestos swipe para navegação
 * - Bottom tab navigation
 * - Notificações em top-right (não interfere com uso)
 */

// Detectado automaticamente:
console.log(getBrowserInfo().isMobile); // true/false
console.log(getBrowserInfo().isTablet); // true/false

// Adaptive UX baseado em device:
if (getBrowserInfo().isMobile) {
  updateSetting("compactMode", true);
  console.log("Mobile mode ativado");
}

/* ════════════════════════════════════════════════════════════════════════════
   7. TROUBLESHOOTING
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Verificar status do sistema
 */
function diagnostic() {
  console.table({
    "Online": isOnline(),
    "LocalStorage": typeof Storage !== "undefined",
    "Theme": currentTheme,
    "Device": getBrowserInfo().os,
    "Analytics enabled": SETTINGS.analyticsEnabled,
    "Cache items": getCacheStats().validItems,
  });

  console.log("Performance:", getPerformanceReport());
  console.log("Notifications:", NOTIFICATIONS.length);
  console.log("Analytics:", getAnalytics());
}

// Executar diagnóstico no console
diagnostic();

/* ════════════════════════════════════════════════════════════════════════════
   FIM DO ARQUIVO DE REFERÊNCIA
   ════════════════════════════════════════════════════════════════════════════ */
