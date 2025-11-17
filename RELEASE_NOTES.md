# SwaggerNav v1.1.0 Release Notes

**Previous Version:** 1.0.9

> **Note:** This file is updated for each release. The "What's New" section changes with each version, while the installation instructions remain the same.

---

## 🎉 What's New in v1.1.0

### **Preserve Swagger UI Default Styling**

- 🎨 **Swagger UI remains unchanged in default mode** - Extension no longer modifies Swagger UI's native styling when using default theme (auto theme, default background, no liquid glass)
- 🔧 Removed file input style overrides that were affecting Swagger UI even in default mode
- ✨ Extension features (sidebar, parameter search) continue to work perfectly while preserving Swagger UI's original appearance
- 🎯 Only explicit theme choices (light/dark) or custom backgrounds will modify Swagger UI styling

### **Why This Matters**

When SwaggerNav is installed with default settings, Swagger UI now looks exactly as it would without the extension. The extension adds its navigation sidebar and enhanced features without altering Swagger UI's native appearance, ensuring a seamless experience that respects the original design.

---

## 🎉 Previous Release: v1.0.9

### **Hotfix: Responsive Layout & Auto-Scroll**

- 🔧 **Fixed responsive layout** - Main page now properly shrinks to fit viewport when sidebar is visible (no horizontal scrolling)
- 🎯 **Restored auto-scroll on page load** - Main page automatically scrolls to endpoint on reload when URL hash is present
- 📱 **Improved mobile responsiveness** - Both desktop (350px) and mobile (280px) sidebar widths now properly constrain main content

### **Technical Improvements**

- ⚡ Added JavaScript-based width constraints to force Swagger UI containers to fit viewport
- 🔄 Applied constraints on sidebar show/hide to ensure proper layout updates
- 📐 Fixed scroll calculations to account for responsive layout changes

---

## 🎉 Previous Release: v1.0.8

### **New: Liquid Glass (Optional)**

- ✨ Added an optional **Liquid Glass** mode that applies iOS-style glassmorphism on top of your Swagger background
- 🌙 Tuned for both light and dark themes, including dropdowns, collapsible sections, and the SwaggerNav sidebar
- 🧊 Response JSON/code blocks now **keep their solid dark background** for perfect readability (no glass overlay)
- 🎛️ Liquid Glass is **OFF by default** and can be toggled in the options page under "Enhanced Features"

### **Fixes & Polish**

- 🎨 Adjusted button labels (Try it out / Cancel / Execute) for better contrast on Liquid Glass
- 🔍 Improved parameter search dropdown layering so it floats correctly above glass panels

---

## 📦 Installation Instructions

### Quick Install (30 seconds) ⚡

1. **Download .zip and unzip**

2. **Open Chrome Extensions Page**

   - Navigate to `chrome://extensions/`

   - Or click the Extensions menu (puzzle icon) → "Manage Extensions"

3. **Enable Developer Mode**

   - Toggle "Developer mode" switch in the top-right corner

4. **Load the Extension**

   - Click "Load unpacked"

   - Select the `SwaggerNav` folder (the one containing `manifest.json`)

5. **Verify Installation**

   - You should see "SwaggerNav - Swagger UI Navigator" in your extensions list

   - The extension icon will appear in your Chrome toolbar

---

## 🎨 Complete Feature List

SwaggerNav v1.1.0 includes all features from previous versions:

### 🧭 **Smart Navigation**

- ✨ Auto-detection of Swagger UI pages
- 📋 Organized sidebar with grouped endpoints
- 🔍 Live search and filtering
- 📌 Pin favorite endpoints
- 🎯 Quick jump to any endpoint
- 📋 One-click copy of endpoint paths

### ⚡ **Auto Actions**

- 🔓 Auto Try It Out
- 📂 Auto Expand

### ✨ **Enhanced Editing**

- 📝 JSON & Form View side-by-side
- 🔍 Parameter search for long dropdowns
- ⌨️ Smart input handling (negatives, decimals)

### 🎨 **Beautiful Themes**

- 🌓 Light/Dark/Follow OS themes
- 🖼️ 5 decorative backgrounds (Ocean, Tet Holiday, Christmas, Too Many Bugs!, Custom)
- 📸 Custom background upload (up to 5MB)
- 🎭 Perfect readability with smart blur and tint effects

### ⚙️ **Customization**

- Options page with easy-to-use interface
- All settings saved and synced
- Smart defaults (all features enabled)

---

## 🐛 Known Issues

None reported for v1.0.7.

If you encounter any issues:

- **Report on GitHub**: [SwaggerNav Issues](https://github.com/cigrocean/SwaggerNav/issues)
- **Provide details**: Browser version, Swagger UI version, steps to reproduce

---

## 📚 Documentation

- **README.md** - Complete feature overview and usage guide
- **INSTALL.md** - Detailed installation instructions
- **sync-version.js** - In-file documentation for version management

---

## 💜 Thank You

Thank you for using SwaggerNav! If you find this extension helpful, please consider:

- ⭐ **Star the repository** on [GitHub](https://github.com/cigrocean/SwaggerNav)
- 🐛 **Report bugs** or suggest features via GitHub Issues
- 🤝 **Contribute** by submitting pull requests

---

**Made with ❤️ for developers who work with APIs**

_Built with [Cursor](https://www.cursor.com) - The AI-first code editor_

---

## Developer

**Ocean Litmers**

- GitHub: [@cigrocean](https://github.com/cigrocean)
- Project: [SwaggerNav](https://github.com/cigrocean/SwaggerNav)
