const AUTOSAVE_DELAY_MS = 5000;
let autosaveTimer = null;
let lastSavedFingerprint = "";

const DEFAULT_SETTINGS = {
  enabled: false,
  proxyHost: "127.0.0.1",
  proxyPort: 10808,
  mode: "selected",
  includeSites: [],
  bypassSites: []
};

function isValidIpv4(host) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host || "")) return false;
  const parts = host.split(".");
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
  }
  return true;
}

function isValidIpv6(host) {
  const h = (host || "").toLowerCase().trim();
  if (!h || !h.includes(":")) return false;
  if (!/^[0-9a-f:.]+$/.test(h)) return false;
  try {
    new URL(`http://[${h}]`);
    return true;
  } catch {
    return false;
  }
}

function isValidDomainLikeHost(host) {
  const h = (host || "").toLowerCase().trim().replace(/\.$/, "");
  if (!h || h.length > 253) return false;

  const labels = h.split(".");
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (!/^[a-z0-9-]+$/.test(label)) return false;
    if (label.startsWith("-") || label.endsWith("-")) return false;
  }

  return true;
}

function isValidSuffixRule(rule) {
  const r = (rule || "").trim().toLowerCase().replace(/\.$/, "");
  if (!r.startsWith(".")) return false;
  const body = r.slice(1);
  return !!body && /[a-z]/.test(body) && isValidDomainLikeHost(body);
}

function isValidHostToken(host) {
  const h = (host || "").toLowerCase().trim().replace(/\.$/, "");
  if (!h) return false;
  if (h === "localhost") return true;
  if (isValidIpv4(h)) return true;

  if (h.startsWith("[") && h.endsWith("]")) {
    return isValidIpv6(h.slice(1, -1));
  }
  if (h.includes(":")) return isValidIpv6(h);

  return isValidDomainLikeHost(h);
}

function isIpLiteral(host) {
  const h = (host || "").trim();
  if (!h) return false;
  if (h.startsWith("[") && h.endsWith("]")) {
    return isValidIpv6(h.slice(1, -1));
  }
  return isValidIpv4(h) || isValidIpv6(h);
}

function stripTrailingPortIfPresent(value) {
  let s = String(value || "");
  if (!s) return s;

  if (s.startsWith("[")) {
    return s.replace(/\]:(\d+)$/, "]");
  }

  const colonCount = (s.match(/:/g) || []).length;
  if (colonCount <= 1) {
    return s.replace(/:\d+$/, "");
  }
  return s;
}

// -------------------- Formatting (SAFE, does NOT break Enter) --------------------
// Only replace these separators: comma, semicolon, Persian comma, and tabs.
// We do NOT treat '.' or ':' as separators (they break domains/URLs).
function formatSeparatorsToNewlinesPreserveUserNewlines(text) {
  let t = String(text || "");
  t = t.replace(/\r\n/g, "\n");

  // Replace commas/semicolons with newline
  t = t.replace(/[,\u060C;]+/g, "\n");
  // Replace tabs with newline
  t = t.replace(/\t+/g, "\n");

  // IMPORTANT: Do not trim lines or remove blank lines while typing (keeps Enter behavior).
  return t;
}

// Convert single-line pasted tokens separated by spaces into newlines
// BUT only when it's clearly a paste of multiple items in one line (no newlines already).
function convertSpacesToLinesWhenSingleLine(text) {
  const t = String(text || "");
  if (t.includes("\n")) return t; // user is already using lines (Enter)
  // If there are 2+ tokens separated by spaces, convert spaces to newlines
  // This won’t affect "https://..." because it has no spaces.
  return t.trim().replace(/\s+/g, "\n");
}

function liveNormalizeTextarea(id) {
  const el = document.getElementById(id);
  const before = el.value;

  // Keep cursor position as much as possible
  const start = el.selectionStart;
  const end = el.selectionEnd;

  let after = formatSeparatorsToNewlinesPreserveUserNewlines(before);

  // If user pasted "a.com b.com c.com" into an empty textarea or single line, split by spaces
  // only when there are no newlines.
  after = convertSpacesToLinesWhenSingleLine(after);

  if (after !== before) {
    el.value = after;
    const delta = after.length - before.length;
    el.selectionStart = Math.max(0, Math.min(after.length, start + delta));
    el.selectionEnd = Math.max(0, Math.min(after.length, end + delta));
  }
}

// On save we do clean-up: trim lines, remove empties, de-dupe.
function cleanupLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

function dedupeKeepLast(items) {
  const input = Array.isArray(items) ? items : [];
  const lastIndexByItem = new Map();
  const countByItem = new Map();

  input.forEach((item, idx) => {
    lastIndexByItem.set(item, idx);
    countByItem.set(item, (countByItem.get(item) || 0) + 1);
  });

  const uniqueOrdered = [];
  input.forEach((item, idx) => {
    if (lastIndexByItem.get(item) === idx) {
      uniqueOrdered.push(item);
    }
  });

  const duplicates = [];
  countByItem.forEach((count, item) => {
    if (count > 1) duplicates.push(item);
  });

  return { items: uniqueOrdered, duplicates };
}

// -------------------- Domain normalization (IDN-safe + root-domain + suffix rules) --------------------
function normalizeSuffixRule(raw) {
  let s = (raw || "").trim();
  if (!s) return "";

  // remove quotes
  s = s.replace(/^["']|["']$/g, "").trim();
  if (!s) return "";

  // FIX: wildcard handling
  // "*.ir"            => ".ir"         (suffix rule)
  // "*.digikala.com"  => "digikala.com" (domain rule, so root + subdomains work)
  if (s.startsWith("*.")) {
    const rest = s.slice(2).trim();
    if (!rest) return "";
    if (!rest.includes(".")) s = "." + rest;
    else return ""; // wildcard with multi-label should NOT become suffix rule here
  }

  // Only suffix rules are allowed here (must start with ".")
  if (s.startsWith(".")) {
    s = s.toLowerCase().replace(/[^\x00-\x7F]/g, "").replace(/\.$/, "");
    return isValidSuffixRule(s) ? s : "";
  }

  return "";
}


function toAsciiHostnameFromInput(raw) {
  let s = (raw || "").trim();
  if (!s) return "";

  s = s.replace(/^["']|["']$/g, "").trim();
  s = s.replace(/^\*\./, "");

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(s);
  const candidate = hasScheme ? s : `https://${s}`;

  try {
    const u = new URL(candidate);
    let host = (u.hostname || "").toLowerCase().trim();
    host = host.replace(/\.$/, "");
    return isValidHostToken(host) ? host : "";
  } catch {
    // fallback cleanup
    s = s.toLowerCase();
    s = s.replace(/^https?:\/\//, "");
    s = s.replace(/\/.*$/, "");
    s = stripTrailingPortIfPresent(s);
    s = s.replace(/\.$/, "");
    s = s.trim();
    if (!s) return "";

    try {
      const u2 = new URL(`https://${s}`);
      const host2 = (u2.hostname || "").toLowerCase().replace(/\.$/, "");
      return isValidHostToken(host2) ? host2 : "";
    } catch {
      const asciiHost = s.replace(/[^\x00-\x7F]/g, "");
      return isValidHostToken(asciiHost) ? asciiHost : "";
    }
  }
}

function fallbackHostToken(raw) {
  let s = (raw || "").trim();
  if (!s) return "";

  s = s.replace(/^["']|["']$/g, "").trim();
  s = s.replace(/^\*\./, "");
  s = s.toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\/.*$/, "");
  s = stripTrailingPortIfPresent(s);
  s = s.replace(/\.$/, "");
  s = s.replace(/[^\x00-\x7F]/g, "");
  s = s.trim();

  return isValidHostToken(s) ? s : "";
}

function registrableDomain(host) {
  host = (host || "").toLowerCase().replace(/\.$/, "");
  if (!host) return host;
  if (host.startsWith(".")) return host;
  if (isIpLiteral(host)) return host;

  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;

  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];

  const commonSecondLevel = new Set(["co", "com", "net", "org", "gov", "edu", "ac"]);
  const looksLikeCcTld = tld.length === 2;

  if (looksLikeCcTld && commonSecondLevel.has(sld) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function normalizeEntry(raw, { allowSuffixRule = false, reduceToRoot = true } = {}) {
  if (allowSuffixRule) {
    const suffix = normalizeSuffixRule(raw);
    if (suffix) return suffix;
  }

  const host = toAsciiHostnameFromInput(raw);
  const safeHost = host || fallbackHostToken(raw);
  if (!safeHost) return "";
  return reduceToRoot ? registrableDomain(safeHost) : safeHost;
}

function parseDomainList(text, { allowSuffixRule = false, reduceToRoot = true } = {}) {
  const cleanedText = cleanupLines(text);
  const lines = cleanedText.split("\n");
  const normalized = lines
    .map((x) => normalizeEntry(x, { allowSuffixRule, reduceToRoot }))
    .filter(Boolean);
  return dedupeKeepLast(normalized);
}

// -------------------- UI helpers --------------------
function setStatus(text, cls) {
  const el = document.getElementById("status");
  el.textContent = text || "";
  el.className = `status ${cls || ""}`.trim();
}

function setListWarning(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "";
}

function buildDuplicateWarningText(duplicates) {
  if (!Array.isArray(duplicates) || duplicates.length === 0) return "";
  const preview = duplicates.slice(0, 3).join(", ");
  const moreCount = Math.max(0, duplicates.length - 3);
  const moreText = moreCount > 0 ? ` (+${moreCount} more)` : "";
  const verb = duplicates.length === 1 ? "was" : "were";
  return `Warning: duplicate item${duplicates.length === 1 ? "" : "s"} ${verb} removed and re-added at the end (${preview}${moreText}).`;
}

function updateToggleUI(enabled) {
  const btn = document.getElementById("toggleBtn");
  const badgeText = document.getElementById("enabledText");
  const dot = document.getElementById("enabledDot");

  if (enabled) {
    btn.textContent = "Disable Proxy";
    btn.classList.remove("off");
    btn.classList.add("on");
    badgeText.textContent = "ENABLED";
    dot.classList.add("on");
  } else {
    btn.textContent = "Enable Proxy";
    btn.classList.remove("on");
    btn.classList.add("off");
    badgeText.textContent = "DISABLED";
    dot.classList.remove("on");
  }
}

function getSelectedMode() {
  return document.getElementById("modeAll").checked ? "all" : "selected";
}

function setSelectedMode(mode) {
  document.getElementById("modeAll").checked = mode === "all";
  document.getElementById("modeSelected").checked = mode !== "all";
}

function fingerprintSettings(s) {
  return JSON.stringify({
    enabled: !!s.enabled,
    proxyHost: (s.proxyHost || "127.0.0.1"),
    proxyPort: Number(s.proxyPort),
    mode: s.mode,
    includeSites: (s.includeSites || []).slice(),
    bypassSites: (s.bypassSites || []).slice()
  });
}

// -------------------- Import/Export file --------------------
function buildListsFileText(includeSitesText, bypassSitesText) {
  const includeClean = cleanupLines(includeSitesText);
  const bypassClean = cleanupLines(bypassSitesText);

  return [
    "Include List:",
    includeClean || "",
    "",
    "Bypass List:",
    bypassClean || "",
    ""
  ].join("\n");
}

function parseListsFileText(fileText) {
  const t = String(fileText || "").replace(/\r\n/g, "\n");
  const lines = t.split("\n");

  let mode = "none";
  const include = [];
  const bypass = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/^include\s*list\s*:/i.test(line)) { mode = "include"; continue; }
    if (/^bypass\s*list\s*:/i.test(line)) { mode = "bypass"; continue; }

    if (mode === "include") include.push(raw);
    else if (mode === "bypass") bypass.push(raw);
  }

  // If no headers found, treat whole file as include list
  if (include.length === 0 && bypass.length === 0) {
    return { includeText: cleanupLines(t), bypassText: "" };
  }

  return {
    includeText: cleanupLines(include.join("\n")),
    bypassText: cleanupLines(bypass.join("\n"))
  };
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// -------------------- Load / Save --------------------
async function loadSettings() {
  const data = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  document.getElementById("proxyHost").value = data.proxyHost;
  document.getElementById("proxyPort").value = data.proxyPort;

  document.getElementById("includeSites").value = (data.includeSites || []).join("\n");
  document.getElementById("bypassSites").value = (data.bypassSites || []).join("\n");

  setSelectedMode(data.mode || "selected");
  updateToggleUI(!!data.enabled);
  setListWarning("includeWarn", "");
  setListWarning("bypassWarn", "");

  lastSavedFingerprint = fingerprintSettings(data);
}

async function saveSettings({ isAuto = false } = {}) {
  const proxyHostInput = (document.getElementById("proxyHost").value || "").trim() || "127.0.0.1";
  const proxyHost = normalizeEntry(proxyHostInput, { allowSuffixRule: false, reduceToRoot: false });
  const proxyPort = Number(document.getElementById("proxyPort").value || 10808);

  if (!proxyHost) {
    setStatus("Invalid proxy host.", "err");
    return;
  }

  if (!Number.isFinite(proxyPort) || proxyPort <= 0 || proxyPort > 65535) {
    setStatus("Invalid port number.", "err");
    return;
  }

  const mode = getSelectedMode();

  // Parse + normalize:
  // - Include: keep entered host/domain in settings UI; PAC reduces to root internally
  // - Bypass: exact host/domain + suffix rules like ".ir"
  const includeParsed = parseDomainList(document.getElementById("includeSites").value, {
    allowSuffixRule: false,
    reduceToRoot: false
  });
  const bypassParsed = parseDomainList(document.getElementById("bypassSites").value, {
    allowSuffixRule: true,
    reduceToRoot: false
  });
  const includeSites = includeParsed.items;
  const bypassSites = bypassParsed.items;

  setListWarning("includeWarn", buildDuplicateWarningText(includeParsed.duplicates));
  setListWarning("bypassWarn", buildDuplicateWarningText(bypassParsed.duplicates));

  // Keep current enabled state
  const current = await chrome.storage.sync.get({ enabled: false });
  const enabled = !!current.enabled;

  const newSettings = { enabled, proxyHost, proxyPort, mode, includeSites, bypassSites };
  const fp = fingerprintSettings(newSettings);
  if (fp === lastSavedFingerprint) {
    // Keep textareas normalized even if storage data is effectively unchanged.
    document.getElementById("proxyHost").value = proxyHost;
    document.getElementById("includeSites").value = includeSites.join("\n");
    document.getElementById("bypassSites").value = bypassSites.join("\n");
    return;
  }

  await chrome.storage.sync.set(newSettings);
  lastSavedFingerprint = fp;

  // Reflect normalized lists back to UI
  document.getElementById("proxyHost").value = proxyHost;
  document.getElementById("includeSites").value = includeSites.join("\n");
  document.getElementById("bypassSites").value = bypassSites.join("\n");

  const msg = isAuto ? "Auto-saved and applied." : "Saved and applied successfully.";
  setStatus(msg, "ok");
  setTimeout(() => {
    const s = document.getElementById("status");
    if (s.textContent === msg) setStatus("", "");
  }, 2000);
}

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveSettings({ isAuto: true }), AUTOSAVE_DELAY_MS);
}

async function toggleEnabled() {
  // Flip enabled state immediately (background applies instantly)
  const data = await chrome.storage.sync.get({ enabled: false });
  const enabled = !data.enabled;

  await chrome.storage.sync.set({ enabled });
  updateToggleUI(enabled);

  // Immediately save/apply all current inputs too (like an instant autosave)
  await saveSettings({ isAuto: true });

  setStatus(enabled ? "Enabled." : "Disabled.", enabled ? "ok" : "err");
  setTimeout(() => {
    const st = document.getElementById("status");
    if (st.textContent === "Enabled." || st.textContent === "Disabled.") setStatus("", "");
  }, 1200);
}


// -------------------- Wire events --------------------
document.getElementById("saveBtn").addEventListener("click", () => saveSettings({ isAuto: false }));
document.getElementById("toggleBtn").addEventListener("click", toggleEnabled);

["proxyHost", "proxyPort"].forEach((id) => {
  const el = document.getElementById(id);
  el.addEventListener("input", scheduleAutosave);
  el.addEventListener("change", scheduleAutosave);
});

["includeSites", "bypassSites"].forEach((id) => {
  const el = document.getElementById(id);

  // Live: only safe separator formatting. DOES NOT remove newlines or trim, so Enter works.
  el.addEventListener("input", () => {
    liveNormalizeTextarea(id);
    scheduleAutosave();
  });

  // On blur/change we can clean up lightly (not heavy normalization; that's on save)
  el.addEventListener("blur", () => {
    // keep user's newlines; just ensure separators are converted
    liveNormalizeTextarea(id);
  });
});

async function saveModeImmediately() {
  // Save immediately and apply (acts like autosave)
  await saveSettings({ isAuto: true });
}

document.getElementById("modeSelected").addEventListener("change", saveModeImmediately);
document.getElementById("modeAll").addEventListener("change", saveModeImmediately);

// Export
document.getElementById("exportBtn").addEventListener("click", () => {
  const includeText = document.getElementById("includeSites").value;
  const bypassText = document.getElementById("bypassSites").value;
  const content = buildListsFileText(includeText, bypassText);
  downloadTextFile("proxy-lists.txt", content);
  setStatus("Exported lists file.", "ok");
  setTimeout(() => setStatus("", ""), 1200);
});

// Import
const importFile = document.getElementById("importFile");
document.getElementById("importBtn").addEventListener("click", () => {
  importFile.value = "";
  importFile.click();
});

importFile.addEventListener("change", async () => {
  const f = importFile.files && importFile.files[0];
  if (!f) return;

  try {
    const text = await f.text();
    const { includeText, bypassText } = parseListsFileText(text);

    document.getElementById("includeSites").value = includeText;
    document.getElementById("bypassSites").value = bypassText;

    // Trigger save so it normalizes and applies
    await saveSettings({ isAuto: false });
    setStatus("Imported and saved successfully.", "ok");
    setTimeout(() => setStatus("", ""), 1500);
  } catch {
    setStatus("Failed to import file.", "err");
    setTimeout(() => setStatus("", ""), 1500);
  }
});

loadSettings();
