# 🚀 Socks5 Traffic Manager

Socks5 Traffic Manager is a Chrome extension for advanced SOCKS5 proxy routing.

It lets you intelligently route **only selected domains** (Include mode) or **all traffic** (Global mode) through a SOCKS5 proxy using an **auto-generated PAC (Proxy Auto-Config) script**, with strong normalization, smart domain matching, and quick controls. 

---

## ✨ Features

### Core proxy control

* 🔌 **One-click Enable / Disable** (Options + Popup)
* 🌍 **Global Mode**: proxy all traffic **except** Bypass list 
* 🎯 **Selected Mode**: proxy **only** Include list domains 
* 🧭 **Toolbar badge + tooltip** updates (ON/OFF + current mode) + **dynamic icon** 
* 🕶 **Incognito support** (spanning) 

### Lists, rules, and matching

* 📜 **Include & Bypass lists** with strong parsing and normalization
* 🌐 **TLD/Suffix rules** supported in Bypass list (example: `.ir`)
* 🧠 **Smart root-domain detection** (eTLD+1 heuristic; supports `bbc.co.uk` style)
* 🔐 **IDN-safe normalization** (Unicode → ASCII where possible) and **ASCII-only PAC safety check**
* 🧹 **De-duplicate rules** while keeping the *last occurrence* (with UI warnings) 
* 🏠 **Local/private destinations always DIRECT** (never proxied) 

### UX improvements

* ⚡ **Auto-save after 5 seconds of inactivity** + Manual **Save Now**
* 🧾 **Paste-friendly list input**:

  * Converts commas / semicolons / Persian comma / tabs into new lines
  * Converts **space-separated** tokens into lines **only when it is a single-line paste** (so normal Enter behavior stays intact) 
* 📤 **Import / Export** lists as a text file (`proxy-lists.txt`)
* ⚡ **Fast Import** from popup: add current tab domain to Include or Bypass in one click

---

## 🧩 How It Works

The extension builds a PAC script based on:

* Proxy Host & Port
* Mode: Selected / Global
* Include List
* Bypass List 

### Decision order (important)

1. Local/private or plain hostnames → `DIRECT`
2. If host matches **Bypass** list (including suffix rules) → `DIRECT`
3. Smart bypass roots: if a host is bypassed, its registrable/root domain may be treated as bypass too (helps with subdomains) 
4. If mode = **Global** → `PROXY`
5. If mode = **Selected** and host matches Include → `PROXY`
6. Otherwise → `DIRECT` 

---

## ⚙️ Configuration

### Proxy Settings

* **Proxy Host**: supports domain, `localhost`, IPv4, IPv6

  * IPv6 is handled safely (including bracket formatting inside PAC when needed).
* **Proxy Port**: validated (1–65535).

### Modes

* **Selected Mode** → only Include list goes through proxy
* **Global Mode** → everything proxied except Bypass list

---

## 🧾 Include & Bypass List Rules

### Accepted inputs (Options page)

You can type one per line, or paste using:

* newline
* comma `,`
* semicolon `;`
* Persian comma `،`
* tab
* single-line space-separated tokens (auto-splits to lines) 

### Rule types

**Domains / hosts**

* `google.com`
* `sub.example.com`
* `bbc.co.uk`
* `localhost`
* `127.0.0.1`
* `2001:db8::1`

**Suffix rules (Bypass only)**

* `.ir` → bypass all `.ir` and subdomains like `*.something.ir`

**Wildcard handling**

* `*.ir` becomes `.ir` (suffix rule)
* `*.digikala.com` becomes `digikala.com` (domain rule)

### Matching behavior (PAC)

* Exact domain matches
* Subdomain matches (example: rule `example.com` matches `a.b.example.com`)
* Suffix rules: `.ir` matches `ir` and any `*.ir` 

---

## ⚡ Fast Import (Popup)

In the popup, you can:

* Choose target: **Add to Include** or **Add to Bypass**
* Click **Add current tab** to import the *registrable/root domain* of the active tab (only `http/https` pages).

This is ideal when you quickly want to route a site without opening the Options page.

---

## 📤 Import / Export

### Export

Exports a text file (`proxy-lists.txt`) with this structure: 

```text
Include List:
example.com
sub.example.com

Bypass List:
.ir
localhost
```

### Import

* If the file includes `Include List:` / `Bypass List:` headers → it imports into both sections.
* If headers are missing → the entire file is treated as the Include list. 

You can also keep a curated file like the provided `proxy-lists.txt` and import it anytime. 

---

## 🛡 Security & Privacy Notes

* ✅ No external servers, no telemetry, no tracking.
* ✅ PAC is generated locally.
* ✅ Local/private IP ranges are always DIRECT.
* ✅ PAC is validated to be ASCII-only before applying (avoids Chrome PAC issues). 

---

## 📦 Installation (Manual)

1. Download/clone the project folder.
2. Open Chrome and go to:

   * `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the extension folder

Done ✅

---

## 🧪 Usage Tips

* Prefer adding **root domains** to Include (example: `openai.com`) so all subdomains work.
* Use Bypass for:

  * Local services
  * Banking or sensitive sites
  * Whole TLD rules like `.ir`

---

## 🛠 Tech Stack

* Chrome Extension (Manifest v3 service worker)
* JavaScript (Options + Popup + Background)
* Chrome Proxy API
* Chrome Storage Sync API
* PAC Script routing (SOCKS5 + DIRECT fallback)

---

## 🧭 Troubleshooting

### Proxy does not apply

* Make sure the extension is **Enabled** (badge ON).
* Confirm your proxy app/server is listening on the configured host/port.
* If PAC refuses to apply, check the console for:

  * “PAC script contains non-ASCII characters” (usually caused by non-ASCII entries; lists are normalized to prevent this). 

### Incognito not working

* Go to `chrome://extensions/`
* Open extension details
* Enable **Allow in incognito**

---

## 📌 Changelog Highlights

### v1.6.0

* Fast Import in popup (add current tab to Include/Bypass)
* Safer list parsing (preserves Enter behavior, smarter paste splitting)
* Better normalization (IDN-safe, wildcard handling, suffix rules)
* Duplicate cleanup warnings in UI
* Improved action badge/icon/tooltip updates

---

## 👨‍💻 Author

Created by **sinaojaghi**
GitHub: `https://github.com/sinaojaghi/socks5-traffic-manager`

Built with assistance from ChatGPT.

---

## 📄 License

MIT License (add a `LICENSE` file if you want it included in the repository).
