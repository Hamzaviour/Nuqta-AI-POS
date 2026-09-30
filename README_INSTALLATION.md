# Nuqta AI POS v2.0.0 — Installation & Quick Start Guide

Welcome to **Nuqta AI POS v2.0.0** — the enterprise Wholesale & Retail Point of Sale, Inventory Management, Accounting, and Cloud Portal platform.

---

## ⚡ Automated GitHub Actions Installer Generation

When you push this repository to GitHub:
1. **Automatic CI/CD Build**: The GitHub Action `.github/workflows/build-installers.yml` automatically triggers on push to `main` / `master` or on version tags (e.g. `v2.0.0`).
2. **Download Artifacts**: Navigate to your GitHub repository → **Actions** → Click the latest workflow run → Download the zipped installer from the **Artifacts** section:
   - `Nuqta-AI-POS-Windows-Installer-v2.0` (Contains `Nuqta-Setup-2.0.0.exe` and `Nuqta-Portable-2.0.0.exe`)
   - `Nuqta-AI-POS-macOS-Installer-v2.0` (Contains `Nuqta-AI-POS-2.0.0-Mac-*.dmg`)
3. **Automated Releases**: Creating a release tag (e.g., `git tag v2.0.0 && git push origin --tags`) will automatically create a GitHub Release with all installer files attached for one-click downloading!

---

## 🪟 Windows Installation (Windows 10 / 11 64-bit)

### Setup Installer vs Portable:
- **NSIS Setup Installer**: `Nuqta-Setup-2.0.0.exe` (Recommended for counter machines — installs shortcuts and auto-manages updates).
- **Portable Edition**: `Nuqta-Portable-2.0.0.exe` (Zero-install executable — run directly from USB flash drive or folder).

### Step-by-Step Installation:
1. **Download**: Obtain `Nuqta-Setup-2.0.0.exe`.
2. **Run Installer**: Double-click `Nuqta-Setup-2.0.0.exe`.
   - *If prompted by Windows SmartScreen / User Account Control (UAC), click **Yes / Run Anyway**.*
3. **Choose Installation Options**:
   - You can choose the default installation path (`C:\Program Files\Nuqta AI POS` or custom directory).
   - Ensure **Create Desktop Shortcut** and **Create Start Menu Shortcut** remain checked.
4. **Finish & Launch**:
   - Click **Install**. The installer automatically bundles the SQLite database engine, runtimes, and local mobile server. No external server or database setup required.
   - Check **Launch Nuqta AI POS** and click **Finish**.
5. **Desktop Icon**:
   - You can now launch Nuqta anytime from your Desktop shortcut or Start Menu using the official brand icon.

---

## 🍎 macOS Installation (macOS 12 Monterey, 13 Ventura, 14 Sonoma, 15 Sequoia)

### Compatible Architectures:
- **Apple Silicon** (M1 / M2 / M3 / M4 Macs): `Nuqta-AI-POS-2.0.0-Mac-arm64.dmg` or `universal`
- **Intel Macs** (Core i5 / i7 / i9): `Nuqta-AI-POS-2.0.0-Mac-x64.dmg` or `universal`

### Step-by-Step Installation:
1. **Download**: Obtain `Nuqta-AI-POS-2.0.0-Mac-arm64.dmg` (or universal `.dmg`).
2. **Open DMG**: Double-click the `.dmg` file to mount it.
3. **Drag to Applications**: In the window that appears, drag **Nuqta AI POS.app** into the **Applications** folder shortcut.
4. **Launch Application**:
   - Open **Finder → Applications** and double-click **Nuqta AI POS**.
   - *First-time Launch Note*: If macOS displays an unidentified developer prompt, go to **System Settings → Privacy & Security** and click **Open Anyway**.
5. **Microphone Permission**:
   - When prompted for microphone access, click **Allow** to enable the Voice AI invoice assistant.

---

## 💾 Data Safety & Upgrades

- **Where is your business data stored?**
  - **Windows**: `%APPDATA%\Nuqta AI POS\aldeewan-pos.db`
  - **macOS**: `~/Library/Application Support/Nuqta AI POS/aldeewan-pos.db`
- **Upgrades**:
  - When upgrading to future versions or reinstalling, your database, stock, sales history, customer ledgers, and cloud settings are **100% preserved**.
- **Uninstallation**:
  - Running the uninstaller removes the application binaries from `Program Files` but keeps your business database safe in AppData unless you explicitly choose to wipe it.

---

## 🔑 Default Owner Login (First Launch)

- **Username**: `admin` / `owner` (or create your initial Owner PIN during setup)
- **Role**: Store Owner (Full Access to POS, Stock, Purchases, Accounts, Day Closing, Remote Portal, and Maintenance)

---

## 📞 Support & Assistance
For software configuration, barcode printer setup, or network terminal syncing, contact **Nuqta Support**.
