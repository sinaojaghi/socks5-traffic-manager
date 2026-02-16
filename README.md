````markdown
# 🚀 **Socks5 Traffic Manager**

**Socks5 Traffic Manager** is a powerful Chrome extension for advanced SOCKS5 routing — built for flexibility, reliability, and performance.  
It dynamically generates a **PAC (Proxy Auto-Config)** script, allowing you to proxy selected domains or all traffic intelligently.

---

## ✨ **Features**

- ⚡ **One-click enable/disable** from popup and options page  
- 🌐 **Two routing modes:**
  - `Selected` → proxy only included domains  
  - `All` → proxy everything except bypass rules  
- 🧠 **Intelligent root-domain detection** (`eTLD+1` heuristic, e.g. `bbc.co.uk`)  
- 🧩 **Flexible include & bypass lists**  
  - Supports `.ir` suffix rules  
  - Multi-format input (newline, comma, semicolon, tab, or space-separated)  
- 💾 **Auto-save** after 5s inactivity + manual **“Save Now”** button  
- 📤 **Import / Export** lists as text file  
- 🧹 **Duplicate cleanup** with warnings (keeps the last occurrence)  
- 🔒 **Proxy validation** (domain, IPv4, IPv6, `localhost`)  
- 🌍 **IDN-safe** with Unicode → ASCII normalization  
- 🏠 Local/private destinations always `DIRECT`  
- 🧭 **Dynamic toolbar icon + badge** (`ON`/`OFF`) + tooltip with current mode  
- 🧰 **Manifest v3 compatible** + incognito support  

---

## ⚙️ **Routing Behavior**

**PAC decision order:**

1. Local/private host → `DIRECT`  
2. Host matches bypass rule → `DIRECT`  
3. Mode = `all` → `SOCKS5 ...; DIRECT`  
4. Mode = `selected` + host in include list → `SOCKS5 ...; DIRECT`  
5. Otherwise → `DIRECT`

**Matching notes:**

- Include rules are normalized and matched as registrable/root domains.  
- Bypass rules can include suffixes like `.ir`.  
- Subdomains automatically match parent domains (e.g. `api.example.com` → `example.com`).  

---

## 🧩 **Installation (Manual)**

1. Clone or download this repository  
   ```bash
   git clone https://github.com/sinaojaghi/socks5-traffic-manager.git
````

2. Open **`chrome://extensions/`**
3. Enable **Developer Mode**
4. Click **Load unpacked**
5. Select this folder → `socks5-traffic-manager-main`
   *(Ensure `manifest.json` is inside this folder)*

---

## 🔧 **Configuration**

### Proxy Settings

* **Proxy Host:** `127.0.0.1`, `localhost`, or IPv6 (`2001:db8::1`)
* **Proxy Port:** `1–65535` (default: `10808`)

### Modes

* 🟢 **Selected mode:** only included sites are proxied
* 🌍 **Global mode:** all traffic is proxied except bypassed sites

### Example Lists

```
google.com
sub.example.com
bbc.co.uk
.ir
```

---

## 📤 **Import / Export Format**

**Exported file example:**

```text
Include List:
example.com
sub.example.com

Bypass List:
.ir
localhost
```

If imported text does **not** contain `Include List:` / `Bypass List:` headers,
the entire content will be treated as the **Include List**.

---

## 🛡️ **Security & Privacy**

* 🚫 No external API calls
* 🚫 No telemetry or tracking
* 🚫 No data collection
* ✅ All logic runs **locally** in the extension

---

## 🧠 **Tech Stack**

* Chrome Extension (Manifest v3)
* JavaScript (Service Worker + Options/Popup scripts)
* Chrome Proxy API
* Chrome Storage API
* PAC Script (`SOCKS5 ...; DIRECT`)

---

## 🗺️ **Roadmap**

* [ ] Per-profile proxy support
* [ ] Proxy authentication support
* [ ] Rule import/export improvements
* [ ] Chrome Web Store release

---

## 👨‍💻 **Author**

Created by **sinaojaghi**
🔗 GitHub: [https://github.com/sinaojaghi/socks5-traffic-manager](https://github.com/sinaojaghi/socks5-traffic-manager)

---

## 📄 **License**

Licensed under the **MIT License**
See the `LICENSE` file for details.

```
```
