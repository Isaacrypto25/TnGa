/* ═══════════════════════════════════════════════════════
   CLAW DevOps Agent v3 — tools.js
   Sophisticated functional tools: themes, settings, analytics,
   data management, performance monitoring
═══════════════════════════════════════════════════════ */

/* ── SETTINGS MANAGEMENT ──────────────────────────– */
const SETTINGS = {
  theme: "dark",
  sidebarCollapsed: false,
  autoRefresh: true,
  refreshInterval: 120000,
  notificationsEnabled: true,
  soundEnabled: false,
  compactMode: false,
  analyticsEnabled: true,
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("claw_settings") || "{}");
    Object.assign(SETTINGS, saved);
  } catch (e) {
    console.warn("Failed to load settings:", e);
  }
}

function saveSettings() {
  try {
    localStorage.setItem("claw_settings", JSON.stringify(SETTINGS));
  } catch (e) {
    console.warn("Failed to save settings:", e);
  }
}

function updateSetting(key, value) {
  SETTINGS[key] = value;
  saveSettings();
  Bus.emit("setting-changed", { key, value });
}

/* ── ANALYTICS ───────────────────────────────────– */
const ANALYTICS = {
  sessions: 0,
  totalTime: 0,
  actions: {},
  errors: 0,
  lastReset: Date.now(),
};

function initAnalytics() {
  ANALYTICS.sessions += 1;
  saveAnalytics();

  // Track time spent
  setInterval(() => {
    ANALYTICS.totalTime += 1;
    if (ANALYTICS.totalTime % 60 === 0) {
      saveAnalytics();
    }
  }, 1000);
}

function trackAction(action, metadata = {}) {
  if (!SETTINGS.analyticsEnabled) return;

  if (!ANALYTICS.actions[action]) {
    ANALYTICS.actions[action] = 0;
  }
  ANALYTICS.actions[action] += 1;

  // Track tab switches
  Bus.on("tab-switched", (tab) => {
    trackAction("tab-switch", { tab });
  });

  // Track errors
  Bus.on("critical-error", () => {
    ANALYTICS.errors += 1;
  });
}

function saveAnalytics() {
  try {
    localStorage.setItem("claw_analytics", JSON.stringify(ANALYTICS));
  } catch (e) {
    console.warn("Failed to save analytics:", e);
  }
}

function getAnalytics() {
  try {
    return JSON.parse(localStorage.getItem("claw_analytics") || "{}");
  } catch (e) {
    return ANALYTICS;
  }
}

function resetAnalytics() {
  ANALYTICS.sessions = 0;
  ANALYTICS.totalTime = 0;
  ANALYTICS.actions = {};
  ANALYTICS.errors = 0;
  ANALYTICS.lastReset = Date.now();
  saveAnalytics();
}

/* ── PERFORMANCE MONITORING ───────────────────────– */
const PERF = {
  startTime: performance.now(),
  metrics: {},
  slowActions: [],
};

function markMetric(name) {
  const now = performance.now();
  if (!PERF.metrics[name]) {
    PERF.metrics[name] = { start: now, duration: 0, count: 0 };
  } else {
    PERF.metrics[name].duration = now - PERF.metrics[name].start;
    PERF.metrics[name].count += 1;

    if (PERF.metrics[name].duration > 1000) {
      PERF.slowActions.push({
        action: name,
        duration: PERF.metrics[name].duration,
        time: new Date(),
      });

      if (PERF.slowActions.length > 50) {
        PERF.slowActions = PERF.slowActions.slice(-50);
      }
    }
  }
}

function getPerformanceReport() {
  const uptime = (performance.now() - PERF.startTime) / 1000;
  return {
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    metrics: PERF.metrics,
    slowActions: PERF.slowActions.slice(-10),
    memoryUsage: performance.memory
      ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1048576),
          total: Math.round(performance.memory.totalJSHeapSize / 1048576),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576),
        }
      : null,
  };
}

/* ── CACHE MANAGEMENT ────────────────────────────– */
const CACHE = {
  data: {},
  ttls: {},
};

function cacheSet(key, value, ttl = 300000) {
  CACHE.data[key] = value;
  CACHE.ttls[key] = Date.now() + ttl;
}

function cacheGet(key) {
  if (!CACHE.data.hasOwnProperty(key)) return null;

  const now = Date.now();
  if (CACHE.ttls[key] && now > CACHE.ttls[key]) {
    cacheDelete(key);
    return null;
  }

  return CACHE.data[key];
}

function cacheDelete(key) {
  delete CACHE.data[key];
  delete CACHE.ttls[key];
}

function cacheClear() {
  CACHE.data = {};
  CACHE.ttls = {};
}

function getCacheStats() {
  const now = Date.now();
  const valid = Object.keys(CACHE.data).filter(
    (k) => !CACHE.ttls[k] || now <= CACHE.ttls[k]
  ).length;
  const expired = Object.keys(CACHE.data).filter(
    (k) => CACHE.ttls[k] && now > CACHE.ttls[k]
  ).length;

  return {
    validItems: valid,
    expiredItems: expired,
    totalSize: JSON.stringify(CACHE.data).length,
  };
}

/* ── DATA BACKUP & RESTORE ─────────────────────––  */
function createBackup(label = "") {
  const backup = {
    timestamp: Date.now(),
    label: label || new Date().toLocaleString("pt-BR"),
    keys: { ...KEYS },
    settings: { ...SETTINGS },
    logs: [...STATE.logs.slice(-100)],
    errors: [...STATE.errors.slice(-50)],
  };

  try {
    const backups = JSON.parse(localStorage.getItem("claw_backups") || "[]");
    backups.push(backup);
    // Keep only last 10 backups
    if (backups.length > 10) {
      backups.shift();
    }
    localStorage.setItem("claw_backups", JSON.stringify(backups));
    addNotification(`Backup criado: ${backup.label}`, "success");
    return backup;
  } catch (e) {
    addNotification("Erro ao criar backup: " + e.message, "error");
    return null;
  }
}

function restoreBackup(timestamp) {
  try {
    const backups = JSON.parse(localStorage.getItem("claw_backups") || "[]");
    const backup = backups.find((b) => b.timestamp === timestamp);

    if (!backup) {
      addNotification("Backup não encontrado", "error");
      return false;
    }

    // Restore only settings, not keys (for security)
    Object.assign(SETTINGS, backup.settings);
    saveSettings();

    addNotification(`Backup restaurado: ${backup.label}`, "success");
    return true;
  } catch (e) {
    addNotification("Erro ao restaurar backup: " + e.message, "error");
    return false;
  }
}

function listBackups() {
  try {
    return JSON.parse(localStorage.getItem("claw_backups") || "[]");
  } catch (e) {
    return [];
  }
}

function deleteBackup(timestamp) {
  try {
    let backups = JSON.parse(localStorage.getItem("claw_backups") || "[]");
    backups = backups.filter((b) => b.timestamp !== timestamp);
    localStorage.setItem("claw_backups", JSON.stringify(backups));
    addNotification("Backup deletado", "success");
  } catch (e) {
    addNotification("Erro ao deletar backup", "error");
  }
}

/* ── BROWSER DETECTION ───────────────────────────– */
function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  let version = "Unknown";
  let os = "Unknown";

  if (ua.indexOf("Chrome") > -1) {
    browser = "Chrome";
    version = ua.split("Chrome/")[1]?.split(" ")[0];
  } else if (ua.indexOf("Safari") > -1) {
    browser = ua.indexOf("Opera") > -1 ? "Opera" : "Safari";
    version = ua.split("Version/")[1]?.split(" ")[0];
  } else if (ua.indexOf("Firefox") > -1) {
    browser = "Firefox";
    version = ua.split("Firefox/")[1];
  }

  if (ua.indexOf("Windows") > -1) {
    os = "Windows";
  } else if (ua.indexOf("Mac") > -1) {
    os = "macOS";
  } else if (ua.indexOf("Linux") > -1) {
    os = "Linux";
  } else if (ua.indexOf("Android") > -1) {
    os = "Android";
  } else if (ua.indexOf("iOS") > -1) {
    os = "iOS";
  }

  return {
    browser,
    version,
    os,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      ua
    ),
    isTablet: /Tablet|iPad/i.test(ua),
    userAgent: ua,
  };
}

/* ── SYSTEM INFO ─────────────────────────────────– */
function getSystemInfo() {
  const info = {
    browser: getBrowserInfo(),
    screen: {
      width: window.innerWidth,
      height: window.innerHeight,
      orientation: window.innerWidth > window.innerHeight ? "landscape" : "portrait",
      pixelRatio: window.devicePixelRatio,
    },
    features: {
      localStorage: typeof Storage !== "undefined",
      serviceWorker:
        "serviceWorker" in navigator && navigator.serviceWorker !== undefined,
      notification: "Notification" in window,
      vibration: "vibrate" in navigator,
      bluetooth: "bluetooth" in navigator,
      mediaDevices: "mediaDevices" in navigator,
      clipboard: "clipboard" in navigator,
    },
    connection: navigator.connection ? {
      type: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt,
      saveData: navigator.connection.saveData,
    } : null,
    memory: navigator.deviceMemory ? {
      cores: navigator.hardwareConcurrency,
      memory: navigator.deviceMemory,
    } : null,
  };

  return info;
}

/* ── OFFLINE SUPPORT ─────────────────────────────– */
const OFFLINE_QUEUE = [];

function isOnline() {
  return navigator.onLine;
}

window.addEventListener("online", () => {
  addNotification("Conexão restaurada", "success", 3000);
  processOfflineQueue();
});

window.addEventListener("offline", () => {
  addNotification("Sem conexão - mudando para modo offline", "warning");
});

function queueOfflineAction(action) {
  OFFLINE_QUEUE.push({
    action,
    timestamp: Date.now(),
  });
}

function processOfflineQueue() {
  if (OFFLINE_QUEUE.length === 0) return;

  addNotification(
    `Processando ${OFFLINE_QUEUE.length} ações offline...`,
    "info"
  );
  // In a real app, would replay queued actions
  OFFLINE_QUEUE.length = 0;
}

/* ── INITIALIZATION ───────────────────────────────– */
function initTools() {
  loadSettings();
  initAnalytics();

  // Create automatic backups every hour
  setInterval(() => {
    if (SETTINGS.analyticsEnabled) {
      createBackup("Auto backup");
    }
  }, 3600000);

  // Log system info on first load
  addLog("info", "SYSTEM", `${JSON.stringify(getSystemInfo().browser)}`);
}

// Auto-initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTools);
} else {
  initTools();
}
