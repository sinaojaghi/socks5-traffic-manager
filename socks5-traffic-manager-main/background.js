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

function formatProxyHostForPac(host) {
  const h = (host || "").trim();
  if (!h) return h;
  if (h.startsWith("[") && h.endsWith("]")) return h;
  if (isValidIpv6(h)) return `[${h}]`;
  return h;
}

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
function toAsciiHostname(host, { allowSuffixRule = false } = {}) {
  if (!host) return "";
  let s = String(host).trim();
  if (!s) return "";

  s = s.replace(/^["']|["']$/g, "").trim();
  if (s.startsWith("*.")) {
    s = allowSuffixRule ? `.${s.slice(2)}` : s.slice(2);
  }

  // Suffix rule like ".ir"
  if (allowSuffixRule && s.startsWith(".")) {
    const suffix = s.toLowerCase().replace(/[^\x00-\x7F]/g, "").replace(/\.$/, "");
    return isValidSuffixRule(suffix) ? suffix : "";
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(s);
  const candidate = hasScheme ? s : `https://${s}`;

  try {
    const u = new URL(candidate);
    const hostname = (u.hostname || "").toLowerCase().replace(/\.$/, "");
    return isValidHostToken(hostname) ? hostname : "";
  } catch {
    s = s.toLowerCase();
    s = s.replace(/^https?:\/\//, "");
    s = s.replace(/\/.*$/, "");
    s = stripTrailingPortIfPresent(s);
    s = s.replace(/\.$/, "");
    s = s.trim();
    if (!s) return "";

    const stripped = s.replace(/[^\x00-\x7F]/g, "");
    if (!stripped) return "";

    try {
      const u2 = new URL(`https://${stripped}`);
      const hostname2 = (u2.hostname || "").toLowerCase().replace(/\.$/, "");
      return isValidHostToken(hostname2) ? hostname2 : "";
    } catch {
      return isValidHostToken(stripped) ? stripped : "";
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

function normalizeListForPac(list, { reduceToRoot = true, allowSuffixRule = false } = {}) {
  const cleaned = (list || [])
    .map((x) => toAsciiHostname(x, { allowSuffixRule }))
    .map((x) => (reduceToRoot ? registrableDomain(x) : x))
    .filter(Boolean);

  return Array.from(new Set(cleaned));
}

function buildPacScript({ proxyHost, proxyPort, mode, includeSites, bypassSites }) {
  const safeProxyHost = toAsciiHostname(proxyHost) || "127.0.0.1";
  const proxyHostForPac = formatProxyHostForPac(safeProxyHost);
  const numericPort = Number(proxyPort);
  const safeProxyPort = Number.isFinite(numericPort) && numericPort > 0 && numericPort <= 65535
    ? Math.floor(numericPort)
    : 10808;
  const safeMode = mode === "all" ? "all" : "selected";
  const proxyValue = JSON.stringify(`SOCKS5 ${proxyHostForPac}:${safeProxyPort}; DIRECT`);

  // Include: root domains
  const inc = normalizeListForPac(Array.isArray(includeSites) ? includeSites : [], {
    reduceToRoot: true,
    allowSuffixRule: false
  });

  // Bypass: allow suffix rules (".ir") and preserve exact hosts/domains
  const byp = normalizeListForPac(Array.isArray(bypassSites) ? bypassSites : [], {
    reduceToRoot: false,
    allowSuffixRule: true
  });

  const includeJson = JSON.stringify(inc);
  const bypassJson = JSON.stringify(byp);

  return `
var PROXY = ${proxyValue};
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
  try {
    const data = await chrome.storage.sync.get(DEFAULT_SETTINGS);

    // Icon + badge + tooltip
    setIcon(!!data.enabled);
    updateActionUi({ enabled: !!data.enabled, mode: data.mode || "selected" });

    if (!data.enabled) {
      chrome.proxy.settings.clear({ scope: "regular" }, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          console.error("Failed to clear proxy settings:", err.message);
        }
      });
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
        const err = chrome.runtime.lastError;
        if (err) {
          console.error("Failed to apply PAC proxy settings:", err.message);
        }
      }
    );
  } catch (error) {
    console.error("Failed to apply settings:", error);
  }
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
