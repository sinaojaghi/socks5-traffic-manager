const DEFAULT_SETTINGS = {
  enabled: false,
  proxyHost: "127.0.0.1",
  proxyPort: 10808,

  // "selected" = only includeSites go through proxy
  // "all"      = all traffic goes through proxy (except bypassSites)
  mode: "selected",

  // Stored values expected as plain strings (domains or suffix rules like ".ir")
  includeSites: [],
  bypassSites: []
};

const COMMON_SECOND_LEVEL = new Set(["co", "com", "net", "org", "gov", "edu", "ac"]);

function setIcon(enabled) {
  const state = enabled ? "enabled" : "disabled";
  chrome.action.setIcon({
    path: {
      16: `icons/${state}_16.png`,
      48: `icons/${state}_48.png`,
      128: `icons/${state}_128.png`
    }
  });
}

function updateActionUi({ enabled, mode }) {
  // Badge (visible on the toolbar icon)
  chrome.action.setBadgeText({ text: enabled ? "ON" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? "#22c55e" : "#6b7280" });

  // Tooltip (visible on hover)
  const modeText = mode === "all" ? "ALL traffic" : "Selected sites";
  chrome.action.setTitle({
    title: `Socks5 Traffic Manager: ${enabled ? "ENABLED" : "DISABLED"} • Mode: ${modeText}`
  });
}

function isAsciiOnly(s) {
  return /^[\x00-\x7F]*$/.test(s || "");
}

// Converts Unicode hostnames to ASCII (Punycode) via URL normalization.
// Also supports suffix rules like ".ir".
function toAsciiHostname(host) {
  if (!host) return "";
  let s = String(host).trim();
  if (!s) return "";

  s = s.replace(/^["']|["']$/g, "").trim();
  s = s.replace(/^\*\./, "");

  // Suffix rule like ".ir"
  if (s.startsWith(".")) {
    const suffix = s.toLowerCase().replace(/[^\x00-\x7F]/g, "");
    return suffix.startsWith(".") ? suffix : "";
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(s);
  const candidate = hasScheme ? s : `https://${s}`;

  try {
    const u = new URL(candidate);
    return (u.hostname || "").toLowerCase().replace(/\.$/, "");
  } catch {
    s = s.toLowerCase();
    s = s.replace(/^https?:\/\//, "");
    s = s.replace(/\/.*$/, "");
    s = s.replace(/:\d+$/, "");
    s = s.replace(/\.$/, "");
    s = s.trim();
    if (!s) return "";

    const stripped = s.replace(/[^\x00-\x7F]/g, "");
    if (!stripped) return "";

    try {
      const u2 = new URL(`https://${stripped}`);
      return (u2.hostname || "").toLowerCase().replace(/\.$/, "");
    } catch {
      return stripped;
    }
  }
}

/**
 * Reduce host to registrable domain (eTLD+1) using a lightweight heuristic:
 * - Most domains: last 2 labels => bbc.com
 * - Common ccTLD 2-level suffixes: last 3 labels => bbc.co.uk
 * This is not a full PSL, but works well in practice.
 */
function registrableDomain(host) {
  host = (host || "").toLowerCase().replace(/\.$/, "");
  if (!host) return "";

  // Do not change suffix rules like ".ir"
  if (host.startsWith(".")) return host;

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

function normalizeListForPac(list, { reduceToRoot = true } = {}) {
  const cleaned = (list || [])
    .map((x) => toAsciiHostname(x))
    .map((x) => (reduceToRoot ? registrableDomain(x) : x))
    .filter(Boolean);

  return Array.from(new Set(cleaned));
}

function buildPacScript({ proxyHost, proxyPort, mode, includeSites, bypassSites }) {
  const safeProxyHost = toAsciiHostname(proxyHost) || "127.0.0.1";
  const numericPort = Number(proxyPort);
  const safeProxyPort = Number.isFinite(numericPort) && numericPort > 0 && numericPort <= 65535
    ? Math.floor(numericPort)
    : 10808;
  const safeMode = mode === "all" ? "all" : "selected";

  // Include: root domains
  const inc = normalizeListForPac(Array.isArray(includeSites) ? includeSites : [], { reduceToRoot: true });

  // Bypass: allow suffix rules (".ir") and preserve exact hosts/domains
  const byp = normalizeListForPac(Array.isArray(bypassSites) ? bypassSites : [], { reduceToRoot: false });

  const includeJson = JSON.stringify(inc);
  const bypassJson = JSON.stringify(byp);

  return `
var PROXY = "SOCKS5 ${safeProxyHost}:${safeProxyPort}; DIRECT";
var DIRECT = "DIRECT";
var MODE = "${safeMode}";
var INCLUDE = ${includeJson};
var BYPASS = ${bypassJson};

function strEndsWith(value, suffix) {
  var pos = value.length - suffix.length;
  return pos >= 0 && value.indexOf(suffix, pos) === pos;
}

function hostMatches(host, rule) {
  if (!rule) return false;
  host = (host || "").toLowerCase().replace(/\\.$/, "");
  rule = (rule || "").toLowerCase().replace(/\\.$/, "");
  if (!host || !rule) return false;

  // Suffix rule: ".ir" means anything ending with ".ir"
  if (rule.charAt(0) === ".") {
    return strEndsWith(host, rule);
  }

  if (host === rule) return true;
  return host.length > rule.length && strEndsWith(host, "." + rule);
}

function isInList(host, list) {
  for (var i = 0; i < list.length; i++) {
    if (hostMatches(host, list[i])) return true;
  }
  return false;
}

function isLocalOrPrivate(host) {
  if (isPlainHostName(host)) return true;

  if (shExpMatch(host, "localhost")) return true;
  if (shExpMatch(host, "127.*")) return true;
  if (shExpMatch(host, "10.*")) return true;
  if (shExpMatch(host, "192.168.*")) return true;
  if (shExpMatch(host, "169.254.*")) return true;

  if (shExpMatch(host, "172.16.*") || shExpMatch(host, "172.17.*") || shExpMatch(host, "172.18.*") || shExpMatch(host, "172.19.*")) return true;
  if (shExpMatch(host, "172.2?.*") || shExpMatch(host, "172.3?.*")) return true;

  return false;
}

function FindProxyForURL(url, host) {
  host = (host || "").toLowerCase().trim().replace(/\\.$/, "");

  // Always DIRECT for local/private networks
  if (isLocalOrPrivate(host)) return DIRECT;

  // Bypass list always wins
  if (isInList(host, BYPASS)) return DIRECT;

  // Global mode: proxy everything else
  if (MODE === "all") return PROXY;

  // Selected mode: only proxy included sites
  if (isInList(host, INCLUDE)) return PROXY;

  return DIRECT;
}
`;
}

async function applySettings() {
  const data = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  // Icon + badge + tooltip
  setIcon(!!data.enabled);
  updateActionUi({ enabled: !!data.enabled, mode: data.mode || "selected" });

  if (!data.enabled) {
    chrome.proxy.settings.clear({ scope: "regular" }, () => {});
    return;
  }

  const pacData = buildPacScript({
    proxyHost: data.proxyHost,
    proxyPort: data.proxyPort,
    mode: data.mode,
    includeSites: data.includeSites,
    bypassSites: data.bypassSites
  });

  // PAC script must be ASCII-only
  if (!isAsciiOnly(pacData)) {
    console.error("PAC script contains non-ASCII characters. Refusing to apply.");
    return;
  }

  chrome.proxy.settings.set(
    {
      value: {
        mode: "pac_script",
        pacScript: { data: pacData }
      },
      scope: "regular"
    },
    () => {
      // If Chrome rejects PAC, it appears in runtime.lastError in service worker logs.
    }
  );
}

// If you remove default_popup and want icon click to open options, keep this.
// With default_popup enabled, clicking the icon opens the popup instead.
chrome.action.onClicked.addListener(() => {
  // This will NOT run when default_popup is set (Chrome opens the popup).
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onInstalled.addListener(() => applySettings());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync") applySettings();
});

// Apply at service worker start
applySettings();
