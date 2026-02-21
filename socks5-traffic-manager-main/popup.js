const DEFAULT_SETTINGS = {
  enabled: false,
  mode: "selected",
  includeSites: [],
  bypassSites: []
};

function setUI({ enabled, mode }) {
  const btn = document.getElementById("toggleBtn");
  const dot = document.getElementById("dot");
  const statusText = document.getElementById("statusText");

  if (enabled) {
    btn.textContent = "Disable Proxy";
    btn.classList.remove("off");
    btn.classList.add("on");
    dot.classList.add("on");
    statusText.textContent = "ENABLED";
  } else {
    btn.textContent = "Enable Proxy";
    btn.classList.remove("on");
    btn.classList.add("off");
    dot.classList.remove("on");
    statusText.textContent = "DISABLED";
  }

  document.getElementById("modeAll").checked = mode === "all";
  document.getElementById("modeSelected").checked = mode !== "all";
}

async function load() {
  const data = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  setUI({ enabled: !!data.enabled, mode: data.mode || "selected" });
}

async function save(patch) {
  await chrome.storage.sync.set(patch);
  await load(); // refresh UI from storage
}

document.getElementById("toggleBtn").addEventListener("click", async () => {
  const { enabled } = await chrome.storage.sync.get({ enabled: false });
  await save({ enabled: !enabled });
});

document.getElementById("modeSelected").addEventListener("change", async () => {
  await save({ mode: "selected" });
});

document.getElementById("modeAll").addEventListener("change", async () => {
  await save({ mode: "all" });
});

document.getElementById("openOptionsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

document.getElementById("reloadBtn").addEventListener("click", load);

// -------------------- Fast Import --------------------
const COMMON_SECOND_LEVEL = new Set(["co", "com", "net", "org", "gov", "edu", "ac"]);

function isIpLiteral(host) {
  if (!host) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true; // IPv4
  if (host.includes(":")) return true; // basic IPv6 heuristic
  return false;
}

/**
 * Lightweight registrable-domain heuristic:
 * - usually last 2 labels (example.com)
 * - for ccTLD with common 2nd level: last 3 labels (example.co.uk)
 */
function registrableDomain(host) {
  host = (host || "").toLowerCase().replace(/\.$/, "");
  if (!host) return "";
  if (isIpLiteral(host)) return host;

  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;

  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  const looksLikeCcTld = tld.length === 2;

  if (looksLikeCcTld && COMMON_SECOND_LEVEL.has(sld) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

async function fastImportCurrentTab() {
  const statusEl = document.getElementById("fastImportStatus");
  const target = document.getElementById("fastImportTarget")?.value || "include";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url) {
      statusEl.textContent = "Cannot read current tab URL.";
      return;
    }

    const u = new URL(tab.url);

    // only real web pages
    if (!["http:", "https:"].includes(u.protocol)) {
      statusEl.textContent = "This page cannot be imported.";
      return;
    }

    const domain = registrableDomain(u.hostname);
    if (!domain) {
      statusEl.textContent = "Invalid domain.";
      return;
    }

    const key = target === "bypass" ? "bypassSites" : "includeSites";
    const data = await chrome.storage.sync.get({ [key]: [] });
    const list = Array.isArray(data[key]) ? data[key].slice() : [];

    if (list.includes(domain)) {
      statusEl.textContent = `Already exists: ${domain}`;
      return;
    }

    list.push(domain);
    await chrome.storage.sync.set({ [key]: list });

    statusEl.textContent = `Added to ${target}: ${domain}`;
  } catch (e) {
    statusEl.textContent = "Fast import failed (permission or URL issue).";
  }
}

const fastImportBtn = document.getElementById("fastImportBtn");
if (fastImportBtn) {
  fastImportBtn.addEventListener("click", fastImportCurrentTab);
}

load();