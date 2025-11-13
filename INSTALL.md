# 📦 Installation Guide

SwaggerNav is easy to install! Choose the method that works best for you.

## 🚀 Quick Install (Recommended)

### Step 1: Download
Download the latest release ZIP file:
- **[Download SwaggerNav Latest](https://github.com/cigrocean/SwaggerNav/releases/latest/download/swaggernav-latest.zip)**

### Step 2: Extract
- **Mac**: Double-click the ZIP file
- **Windows**: Right-click → "Extract All"
- **Linux**: `unzip swaggernav-latest.zip`

### Step 3: Install in Chrome
1. Open Chrome and go to **`chrome://extensions/`**
2. Toggle **"Developer mode"** ON (top-right corner)
3. Click **"Load unpacked"**
4. Select the **extracted SwaggerNav folder**
5. Done! 🎉

---

## ℹ️ Why Not CRX Files?

You might be wondering why we don't use `.crx` files like some extensions. Here's why:

### Chrome's Security Policy
Since Chrome 75+, Google blocks CRX files that aren't from the Chrome Web Store with the error:
```
Package is invalid: 'CRX_REQUIRED_PROOF_MISSING'
```

This is intentional security policy. Google only allows CRX installation from:
- ✅ Chrome Web Store (official distribution)
- ✅ Enterprise Policy (for companies)
- ❌ Self-signed CRX files (blocked for security)

### Our Approach: ZIP + Load Unpacked
This method is:
- ✅ **Simple**: Extract and load - takes 30 seconds
- ✅ **Secure**: You can inspect the code before installing
- ✅ **Works everywhere**: No store approval needed
- ✅ **Auto-updates**: When you reload the extension
- ✅ **Open source**: Full transparency

---

## 📋 Detailed Installation Steps

### For First-Time Users

#### 1. Download the Extension
Visit the [Releases page](https://github.com/cigrocean/SwaggerNav/releases) and download the latest ZIP file:
- `swaggernav-v1.0.0.zip` (specific version)
- `swaggernav-latest.zip` (always the newest)

#### 2. Extract the Archive
**macOS:**
```bash
cd ~/Downloads
unzip swaggernav-latest.zip
cd SwaggerNav
```

**Windows:**
1. Right-click the ZIP file
2. Select "Extract All..."
3. Choose a destination (e.g., `C:\Extensions\SwaggerNav`)
4. Click "Extract"

**Linux:**
```bash
cd ~/Downloads
unzip swaggernav-latest.zip
cd SwaggerNav
```

#### 3. Open Chrome Extensions
In Google Chrome:
- Type `chrome://extensions/` in the address bar, OR
- Menu (⋮) → Extensions → Manage Extensions

#### 4. Enable Developer Mode
Find the **"Developer mode"** toggle in the top-right corner and turn it **ON**.

You'll see three new buttons appear:
- Load unpacked
- Pack extension
- Update

#### 5. Load the Extension
1. Click **"Load unpacked"**
2. Navigate to the **extracted SwaggerNav folder**
   - Make sure you select the folder containing `manifest.json`
   - NOT the parent folder, NOT a ZIP file
3. Click **"Select"** (Mac) or **"Select Folder"** (Windows)

#### 6. Verify Installation
You should see:
- ✅ "SwaggerNav - Swagger UI Navigator" in your extensions list
- ✅ A toggle switch (should be ON/blue)
- ✅ Extension icon in your Chrome toolbar

#### 7. Test It
1. Visit a Swagger UI page (e.g., https://petstore.swagger.io/)
2. The navigation sidebar should appear on the right! 🎉

---

## 🔄 Updating the Extension

### Method 1: Replace Files (Recommended)
1. Download the new version ZIP
2. Extract it to the **same location** as before (overwrite files)
3. Go to `chrome://extensions/`
4. Find SwaggerNav and click the **refresh icon** (🔄)
5. Done! The extension is updated

### Method 2: Fresh Install
1. Go to `chrome://extensions/`
2. Find SwaggerNav and click **"Remove"**
3. Download the new version
4. Follow the installation steps again

---

## 🛠️ For Developers: Building from Source

### Clone the Repository
```bash
git clone https://github.com/cigrocean/SwaggerNav.git
cd SwaggerNav
```

### Load in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `SwaggerNav` folder

### Create Distribution ZIP
```bash
# Mac/Linux
./package-zip.sh

# Windows
package-zip.bat
```

Files will be created in `dist/`:
- `swaggernav-v1.0.0.zip` - Versioned release
- `swaggernav-latest.zip` - For direct download links

---

## 🌐 Other Browsers

### Microsoft Edge (Chromium)
Same steps as Chrome! Edge uses the same extension system:
1. Go to `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the SwaggerNav folder

### Brave Browser
Same as Chrome:
1. Go to `brave://extensions/`
2. Enable "Developer mode"
3. Load unpacked

### Opera
1. Go to `opera://extensions/`
2. Enable "Developer mode"
3. Load unpacked

### Firefox
SwaggerNav is currently Chrome-only (Manifest V3). Firefox support may come in a future version.

---

## ❓ Troubleshooting

### "Manifest file is missing or unreadable"
**Problem**: Wrong folder selected

**Solution**: Make sure you're selecting the folder that contains `manifest.json`, not the parent folder or ZIP file.

### Extension doesn't appear on Swagger UI pages
**Problem**: Page might not be using Swagger UI

**Solution**: 
1. Verify it's a Swagger/OpenAPI page
2. Try refreshing the page (F5)
3. Check the sidebar isn't hidden (look for toggle button on the right edge)

### Extension is disabled
**Problem**: Chrome automatically disabled it

**Solution**:
1. Go to `chrome://extensions/`
2. Find SwaggerNav
3. Toggle it back ON

### "Developer mode extensions" warning
**Problem**: Chrome shows a warning banner at the top

**Solution**: This is normal for unpacked extensions. You can:
- Ignore it (harmless)
- Dismiss it each time Chrome starts
- Wait for Chrome Web Store version (coming soon)

### Extension disappeared after Chrome restart
**Problem**: The extension folder was moved or deleted

**Solution**: 
1. Don't move or delete the extension folder
2. Keep it in a permanent location (e.g., `~/Extensions/SwaggerNav`)
3. Reinstall if the folder was removed

---

## 🔒 Privacy & Security

### What Permissions Does It Need?
- **activeTab**: Only to access Swagger UI pages you visit
- **No network access**: Doesn't send any data anywhere
- **No tracking**: Completely private

### Is It Safe?
✅ **100% Open Source**: [View the code](https://github.com/cigrocean/SwaggerNav)  
✅ **No telemetry**: Doesn't collect or send any data  
✅ **Local only**: All processing happens in your browser  
✅ **Minimal permissions**: Only needs access to the current tab  

You can review every line of code before installing!

---

## 📞 Need Help?

- **Issues**: [GitHub Issues](https://github.com/cigrocean/SwaggerNav/issues)
- **Questions**: Open a discussion on GitHub
- **Updates**: Watch the repo for new releases

---

## 🎯 Quick Reference

| Task | Action |
|------|--------|
| **Install** | Download ZIP → Extract → `chrome://extensions/` → Load unpacked |
| **Update** | Download new ZIP → Extract to same location → Reload extension |
| **Uninstall** | `chrome://extensions/` → Find SwaggerNav → Remove |
| **Troubleshoot** | Check `manifest.json` in folder, refresh page, toggle extension |

---

**Happy API navigating!** 🚀

*Developed by [Ocean Litmers](https://github.com/cigrocean) | Built with [Cursor](https://www.cursor.com)*


