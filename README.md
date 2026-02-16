# 🚀 Socks5 Traffic Manager

Socks5 Traffic Manager is a powerful Chrome extension for advanced SOCKS5 proxy control.

It allows you to intelligently route selected domains — or all traffic — through a SOCKS5 proxy using dynamic PAC generation, include/bypass lists, and optimized domain matching.

Built for flexibility, performance, and reliability.

---

## ✨ Features

* 🔌 One-click Enable / Disable
* 🌍 Global Mode (Proxy all traffic except bypass list)
* 🎯 Selected Mode (Proxy only included domains)
* 📜 Include & Bypass lists (multi-format input support)
* 🌐 Supports TLD rules like `.ir`
* 🧠 Intelligent root-domain detection (supports bbc.co.uk style domains)
* 🔐 IDN-safe (Unicode → ASCII normalization)
* ⚡ Auto-save after inactivity
* 💾 Manual "Save Now" button
* 📤 Import / Export lists as text file
* 🧹 Duplicate cleanup with warning (keeps the last occurrence)
* 🏠 Local/private destinations always DIRECT
* 🔒 Proxy host validation for domain, IPv4, IPv6, and localhost
* 🧭 Dynamic toolbar icon + badge (ON/OFF) + tooltip with current mode
* 🕶 Incognito support
* 🛠 Manifest v3 compatible

---

## 🧩 How It Works

The extension dynamically generates a PAC (Proxy Auto-Config) script based on:

* Proxy Host & Port
* Selected Mode (Global / Selected)
* Include List
* Bypass List

### Smart Behavior

* Local/private networks are never proxied
* Bypass list always overrides everything
* Intelligent subdomain and root-domain matching
* ASCII-only PAC generation for Chrome compatibility
* Lightweight root-domain detection (eTLD+1 heuristic)
* IDN-safe normalization (Unicode → ASCII)

---

## 📦 Installation (Manual)

1. Clone or download this repository:

```bash
git clone https://github.com/sinaojaghi/socks5-traffic-manager.git
```

2. Open Chrome and navigate to:

```
chrome://extensions/
```

3. Enable **Developer Mode**

4. Click **Load unpacked**

5. Select the project folder

Done ✅

---

## ⚙ Configuration

### Proxy Settings

* Proxy Host (example: `127.0.0.1`, `localhost`, or `2001:db8::1`)
* Proxy Port (example: `10808`)

### Modes

**Selected Mode**
→ Only domains in the Include list go through the proxy.

**Global Mode**
→ All traffic goes through proxy except domains in Bypass list.

### Include / Bypass Lists

* One domain per line
* Supports:

  * `google.com`
  * `bbc.co.uk`
  * `.ir` (TLD rule)
  * `sub.example.com`
* Multi-format input supported (newline, comma, semicolon, tab, space-separated)

---

## 📤 Import / Export Format

Exported file example:

```text
Include List:
example.com
sub.example.com

Bypass List:
.ir
localhost
```

If imported text does not contain `Include List:` / `Bypass List:` headers,
the entire content is treated as Include List.

---

## 🛡 Security Notes

* Local and private IP ranges are always excluded.
* PAC script is generated dynamically and remains ASCII-safe.
* No external servers or tracking.
* No data collection.
* All logic runs locally within the extension.

---

## 🛠 Tech Stack

* Chrome Extension (Manifest v3)
* JavaScript (Service Worker + Options/Popup scripts)
* Chrome Proxy API
* Chrome Storage API
* PAC Script (SOCKS5)

---

## 📌 Roadmap

* [ ] Per-profile proxy support
* [ ] Proxy authentication support
* [ ] Rule import/export improvements
* [ ] Chrome Web Store release

---

## 👨‍💻 Author

Created by **sinaojaghi**
GitHub: [https://github.com/sinaojaghi/socks5-traffic-manager](https://github.com/sinaojaghi/socks5-traffic-manager)

Built with assistance from ChatGPT.

---

## 📄 License

This project is licensed under the MIT License.
See the LICENSE file for details.
