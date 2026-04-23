/* ═══════════════════════════════════════════════════════
   CLAW DevOps Agent v3 — ui.js
   UI Management: drawer menu, command palette, notifications,
   quick actions, gestures, keyboard shortcuts
═══════════════════════════════════════════════════════ */

/* ── DRAWER MENU ──────────────────────────────────── */
let drawerOpen = false;
let drawerToolsOpen = false;

function toggleMenu() {
  drawerOpen ? closeDrawer() : openDrawer();
}

function openDrawer() {
  drawerOpen = true;
  const drawer = _el("side-drawer");
  const overlay = _el("drawer-overlay");
  drawer.classList.add("active");
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  drawerOpen = false;
  const drawer = _el("side-drawer");
  const overlay = _el("drawer-overlay");
  drawer.classList.remove("active");
  overlay.classList.remove("active");
  document.body.style.overflow = "";
  toggleDrawerTools(true); // close tools panel
}

function toggleDrawerTools(force = false) {
  const tools = _el("drawer-tools");
  const btn = _el("drawer-tools-btn");
  if (force) {
    drawerToolsOpen = false;
    tools.style.display = "none";
  } else {
    drawerToolsOpen = !drawerToolsOpen;
    tools.style.display = drawerToolsOpen ? "flex" : "none";
  }
}

/* ── COMMAND PALETTE ──────────────────────────────– */
let commandPaletteOpen = false;
let commandSelected = -1;
let filteredCommands = [];

const COMMANDS = [
  {
    id: "dashboard",
    icon: "⬡",
    title: "Dashboard",
    desc: "Visão geral do sistema",
    action: () => switchTab("dashboard"),
    keys: "Ctrl+1",
  },
  {
    id: "github",
    icon: "◈",
    title: "GitHub",
    desc: "Status do repositório",
    action: () => switchTab("github"),
    keys: "Ctrl+2",
  },
  {
    id: "render",
    icon: "◉",
    title: "Render",
    desc: "Deploy e serviços",
    action: () => switchTab("render"),
    keys: "Ctrl+3",
  },
  {
    id: "supabase",
    icon: "◆",
    title: "Supabase",
    desc: "Banco de dados",
    action: () => switchTab("supabase"),
    keys: "Ctrl+4",
  },
  {
    id: "logs",
    icon: "≡",
    title: "Logs",
    desc: "Ver todos os logs",
    action: () => switchTab("logs"),
    keys: "Ctrl+5",
  },
  {
    id: "errors",
    icon: "⚠",
    title: "Erros",
    desc: "Ver erros críticos",
    action: () => switchTab("errors"),
    keys: "Ctrl+6",
  },
  {
    id: "chat",
    icon: "💬",
    title: "Chat",
    desc: "Conversar com agente",
    action: () => switchTab("chat"),
    keys: "Ctrl+7",
  },
  {
    id: "refresh",
    icon: "↻",
    title: "Atualizar",
    desc: "Recarregar dados",
    action: () => refreshAllStatus(),
    keys: "Ctrl+R",
  },
  {
    id: "config",
    icon: "⚙",
    title: "Configurações",
    desc: "API Keys e preferências",
    action: () => openApiModal(),
    keys: "Ctrl+,",
  },
  {
    id: "export",
    icon: "📥",
    title: "Exportar",
    desc: "Baixar dados e logs",
    action: () => exportData(),
    keys: "Ctrl+E",
  },
];

function toggleCommandPalette() {
  commandPaletteOpen ? closeCommandPalette() : openCommandPalette();
}

function openCommandPalette() {
  commandPaletteOpen = true;
  commandSelected = -1;
  const palette = _el("command-palette");
  palette.style.display = "flex";
  const input = _el("command-search");
  setTimeout(() => input.focus(), 50);
  renderCommands(COMMANDS);
}

function closeCommandPalette() {
  commandPaletteOpen = false;
  const palette = _el("command-palette");
  palette.style.display = "none";
  _el("command-search").value = "";
}

function renderCommands(commands) {
  const list = _el("command-list");
  filteredCommands = commands;
  commandSelected = -1;

  list.innerHTML = commands
    .map(
      (cmd, idx) =>
        `<div class="command-item" onclick="executeCommand(${idx})">
        <span>${cmd.icon}</span>
        <div class="command-item-text">
          <div class="command-item-title">${escHtml(cmd.title)}</div>
          <div class="command-item-desc">${escHtml(cmd.desc)}</div>
        </div>
        <div class="command-item-key">${cmd.keys}</div>
      </div>`
    )
    .join("");
}

function filterCommands(query) {
  const q = query.toLowerCase().trim();
  const filtered = COMMANDS.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(q) ||
      cmd.desc.toLowerCase().includes(q) ||
      cmd.id.includes(q)
  );
  renderCommands(filtered);
}

function handleCommandPaletteKey(e) {
  if (e.key === "Escape") {
    closeCommandPalette();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    commandSelected = Math.min(commandSelected + 1, filteredCommands.length - 1);
    updateCommandSelection();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    commandSelected = Math.max(commandSelected - 1, 0);
    updateCommandSelection();
  } else if (e.key === "Enter" && commandSelected >= 0) {
    e.preventDefault();
    executeCommand(commandSelected);
  }
}

function updateCommandSelection() {
  const items = document.querySelectorAll(".command-item");
  items.forEach((item, idx) => {
    if (idx === commandSelected) {
      item.classList.add("selected");
      item.scrollIntoView({ block: "nearest" });
    } else {
      item.classList.remove("selected");
    }
  });
}

function executeCommand(idx) {
  const cmd = filteredCommands[idx];
  if (cmd && cmd.action) {
    cmd.action();
    closeCommandPalette();
  }
}

/* ── NOTIFICATIONS ────────────────────────────────– */
const NOTIFICATIONS = [];
let notifPanelOpen = false;

function toggleNotifications() {
  notifPanelOpen ? closeNotifications() : openNotifications();
}

function openNotifications() {
  notifPanelOpen = true;
  const panel = _el("notifications-panel");
  panel.style.display = "block";
}

function closeNotifications() {
  notifPanelOpen = false;
  const panel = _el("notifications-panel");
  panel.style.display = "none";
}

function addNotification(message, type = "info", duration = 5000) {
  const notif = {
    id: Date.now(),
    message,
    type, // info, success, warning, error
    time: new Date(),
  };
  NOTIFICATIONS.unshift(notif);
  if (NOTIFICATIONS.length > 50) NOTIFICATIONS.pop();

  renderNotifications();
  updateNotificationBadge();

  if (duration > 0) {
    setTimeout(() => {
      removeNotification(notif.id);
    }, duration);
  }
}

function removeNotification(id) {
  const idx = NOTIFICATIONS.findIndex((n) => n.id === id);
  if (idx >= 0) {
    NOTIFICATIONS.splice(idx, 1);
    renderNotifications();
    updateNotificationBadge();
  }
}

function clearNotifications() {
  NOTIFICATIONS.length = 0;
  renderNotifications();
  updateNotificationBadge();
}

function renderNotifications() {
  const list = _el("notif-list");
  if (NOTIFICATIONS.length === 0) {
    list.innerHTML =
      '<div style="padding:40px 20px;text-align:center;color:var(--text-dim);font-size:10px;">Nenhuma notificação</div>';
    return;
  }

  list.innerHTML = NOTIFICATIONS.map(
    (n) =>
      `<div class="notif-item ${n.type}">
      <div class="notif-item-icon">
        ${n.type === "error" ? "⚠" : n.type === "success" ? "✓" : n.type === "warning" ? "!" : "ℹ"}
      </div>
      <div class="notif-item-content">
        <div class="notif-item-title">${escHtml(n.type.toUpperCase())}</div>
        <div class="notif-item-msg">${escHtml(n.message)}</div>
        <div class="notif-item-time">${timeAgo(n.time)}</div>
      </div>
    </div>`
  ).join("");
}

function updateNotificationBadge() {
  const badge = _el("notif-badge");
  const count = NOTIFICATIONS.length;
  if (count > 0) {
    badge.textContent = count > 9 ? "9+" : count;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

/* ── QUICK ACTIONS ────────────────────────────────– */
const QUICK_ACTIONS = [
  {
    icon: "↻",
    label: "Atualizar",
    action: () => {
      refreshAllStatus();
      addNotification("Dados recarregados", "success");
    },
  },
  {
    icon: "🔧",
    label: "Ferramentas",
    action: () => openApiModal(),
  },
  {
    icon: "🚀",
    label: "Deploy",
    action: () => {
      addNotification("Comece uma chat para fazer deploy", "info");
      switchTab("chat");
    },
  },
  {
    icon: "📊",
    label: "Métricas",
    action: () => switchTab("github"),
  },
  {
    icon: "💾",
    label: "Exportar",
    action: () => exportData(),
  },
  {
    icon: "⌨",
    label: "Atalhos",
    action: () => showKeyboardShortcuts(),
  },
];

function renderQuickActions() {
  const grid = _el("qa-grid");
  grid.innerHTML = QUICK_ACTIONS.map(
    (qa) =>
      `<button class="qa-item" onclick="handleQuickAction('${escAttr(qa.label)}')">
      <div class="qa-item-icon">${qa.icon}</div>
      <div class="qa-item-label">${escHtml(qa.label)}</div>
    </button>`
  ).join("");
}

function handleQuickAction(label) {
  const action = QUICK_ACTIONS.find((qa) => qa.label === label);
  if (action && action.action) {
    action.action();
  }
}

function showQuickActions() {
  const qa = _el("quick-actions-modal");
  qa.classList.add("show");
  setTimeout(() => {
    document.addEventListener("keydown", handleQuickActionsClose);
  }, 100);
}

function hideQuickActions() {
  const qa = _el("quick-actions-modal");
  qa.classList.remove("show");
  document.removeEventListener("keydown", handleQuickActionsClose);
}

function handleQuickActionsClose(e) {
  if (e.key === "Escape") {
    hideQuickActions();
  }
}

/* ── KEYBOARD SHORTCUTS ───────────────────────────– */
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Cmd/Ctrl + K = Command Palette
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      toggleCommandPalette();
      return;
    }

    // Cmd/Ctrl + / = Keyboard Shortcuts
    if ((e.metaKey || e.ctrlKey) && e.key === "/") {
      e.preventDefault();
      showKeyboardShortcuts();
      return;
    }

    // Command palette is open, handle its keys
    if (commandPaletteOpen) {
      handleCommandPaletteKey(e);
      return;
    }

    // Cmd/Ctrl + 1-7 = Switch tabs
    if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "7") {
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      const cmd = COMMANDS.find((c) => c.keys.includes(`Ctrl+${e.key}`));
      if (cmd) cmd.action();
    }
  });
}

function showKeyboardShortcuts() {
  const shortcuts = COMMANDS.map(
    (cmd) =>
      `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
    <div style="font-size:10px;color:var(--text);font-weight:600;">${escHtml(cmd.title)}</div>
    <div style="font-size:8px;color:var(--text-dim);margin-top:2px;">${escHtml(cmd.keys)}</div>
  </div>`
  ).join("");

  // For now, just show in command palette
  addNotification("Pressione Ctrl+K para abrir palette de comandos", "info", 6000);
}

/* ── GESTURES & TOUCH ────────────────────────────– */
let touchStart = { x: 0, y: 0, time: 0 };
let touchEnd = { x: 0, y: 0, time: 0 };

function setupGestureHandlers() {
  document.addEventListener("touchstart", (e) => {
    if (e.target.closest(".modal")) return; // Don't interfere with modals
    touchStart = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  });

  document.addEventListener("touchend", (e) => {
    if (e.target.closest(".modal")) return;
    touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now(),
    };

    const diffX = touchEnd.x - touchStart.x;
    const diffY = touchEnd.y - touchStart.y;
    const timeDiff = touchEnd.time - touchStart.time;

    // Swipe right to open drawer (from left edge)
    if (
      diffX > 60 &&
      Math.abs(diffY) < 60 &&
      timeDiff < 300 &&
      touchStart.x < 40
    ) {
      openDrawer();
    }

    // Swipe left to close drawer
    if (diffX < -60 && Math.abs(diffY) < 60 && timeDiff < 300) {
      closeDrawer();
    }
  });
}

/* ── THEME TOGGLE ────────────────────────────────– */
let currentTheme = localStorage.getItem("claw_theme") || "dark";

function initTheme() {
  applyTheme(currentTheme);
}

function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("claw_theme", currentTheme);
  applyTheme(currentTheme);
  addNotification(`Tema ${currentTheme} ativado`, "success", 2000);
}

function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.style.colorScheme = "light";
  } else {
    document.documentElement.style.colorScheme = "dark";
  }
}

/* ── EXPORT DATA ─────────────────────────────────– */
function exportData() {
  const data = {
    exportedAt: new Date().toISOString(),
    logs: STATE.logs,
    errors: STATE.errors,
    workflows: STATE.workflows,
    status: {
      github: STATE.ghStatus,
      render: STATE.renderStatus,
      supabase: STATE.sbStatus,
    },
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `claw-export-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  addNotification("Dados exportados com sucesso", "success", 2000);
}

/* ── INITIALIZATION ───────────────────────────────– */
function initUI() {
  renderQuickActions();
  setupKeyboardShortcuts();
  setupGestureHandlers();
  initTheme();

  // Listen to log updates and show notifications
  Bus.on("log-new", (entry) => {
    if (entry.level === "error") {
      addNotification(`${entry.source}: ${entry.message}`, "error", 6000);
    } else if (entry.level === "warn") {
      addNotification(`${entry.source}: ${entry.message}`, "warning", 4000);
    }
  });

  // Listen to critical errors
  Bus.on("critical-error", (entry) => {
    addNotification(`⚠ ERRO CRÍTICO: ${entry.message}`, "error", 8000);
  });
}

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}
