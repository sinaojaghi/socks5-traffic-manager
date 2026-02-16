const DEFAULT_SETTINGS = {
  enabled: false,
  mode: "selected"
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

load();
