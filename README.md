# SwaggerNav - Swagger UI Navigator

A Chrome extension that supercharges Swagger UI with a powerful navigation sidebar, enhanced editing tools, beautiful themes, and productivity features that make API documentation a joy to use.

**Developed by [Ocean Litmers](https://github.com/cigrocean)** | **Powered by [Cursor](https://www.cursor.com)**

## Features

### 🧭 **Smart Navigation**
- ✨ **Auto-Detection** - Automatically detects Swagger UI pages and activates
- 📋 **Organized Sidebar** - Groups endpoints by tags/sections for easy browsing
- 🔍 **Live Search** - Filter endpoints by method, path, or description in real-time
- 📌 **Pin Favorites** - Pin frequently used endpoints for quick access
- 🎯 **Quick Jump** - Click any endpoint to instantly scroll to it
- 📋 **Copy Paths** - One-click copy of endpoint paths to clipboard
- 🔄 **Auto-Refresh** - Updates automatically when Swagger UI content changes

### ⚡ **Auto Actions**
- 🔓 **Auto Try It Out** - Automatically clicks "Try it out" when navigating to endpoints
- 📂 **Auto Expand** - Automatically expands collapsed endpoints when clicking them

### ✨ **Enhanced Editing**
- 📝 **JSON & Form View** - Visual form builder alongside JSON editor for request bodies
- 🔍 **Parameter Search** - Searchable dropdowns for parameter select fields with long option lists
- ⌨️ **Smart Input** - Handles negative numbers, decimals, and complex data types correctly

### 🎨 **Beautiful Themes**
- 🌓 **Theme Control** - Choose Light, Dark, or Follow OS preference
- 🖼️ **Decorative Backgrounds** - Multiple themed backgrounds:
  - 🌊 **Ocean** - Calming ocean waves
  - 🧧 **Tet Holiday** - Vietnamese Lunar New Year celebration
  - 🎄 **Christmas** - Festive holiday spirit
  - 🐛 **Too Many Bugs!** - For those debugging days
  - 📸 **Custom** - Upload your own image (up to 5MB, PNG/JPG/WebP)
- 🎭 **Perfect Readability** - Smart blur and tint effects ensure content stays readable
- 🔄 **Instant Updates** - Theme changes apply immediately across all tabs

### 🎛️ **Customization**
- ⚙️ **Options Page** - Easy-to-use settings interface
- 🎯 **Smart Defaults** - All features enabled out of the box
- 💾 **Persistent Settings** - Your preferences are saved and synced
- 🎨 **Adaptive UI** - Options page follows your theme preference

## Screenshots

![SwaggerNav Screenshot](https://github.com/user-attachments/assets/f9ceec9f-e031-493a-a3ad-fc61b07b4ff3)

The extension adds a sleek navigation sidebar with powerful features:

- **Navigation Sidebar**: Fixed sidebar with all endpoints organized by tags
- **Search & Filter**: Instantly filter endpoints as you type
- **Method Badges**: Color-coded HTTP method indicators (GET, POST, PUT, DELETE, etc.)
- **Pin System**: Pin your favorite endpoints for quick access
- **JSON & Form View**: Edit request bodies with a visual form builder
- **Parameter Search**: Searchable dropdowns for parameters with many options
- **Custom Backgrounds**: Personalize your workspace with themes or custom images
- **Smooth Scrolling**: Click endpoints to smoothly scroll with visual feedback

## Installation

### Quick Install (30 seconds) ⚡

1. **[Download the latest release](https://github.com/cigrocean/SwaggerNav/releases)**
2. **Extract the ZIP file**
3. **Open `chrome://extensions/` in Chrome**
4. **Enable "Developer mode"** (top-right toggle)
5. **Click "Load unpacked"** and select the extracted folder
6. **Done!** 🎉

📖 **Detailed installation guide**: [INSTALL.md](INSTALL.md)

---

### Why Not CRX Files?

Chrome blocks self-signed `.crx` files with `CRX_REQUIRED_PROOF_MISSING` error since Chrome 75+. The ZIP + "Load unpacked" method is:

- ✅ Simple and fast (30 seconds)
- ✅ Secure (you can inspect the code)
- ✅ Works everywhere
- ✅ No Chrome Web Store approval needed

### Alternative: Chrome Web Store (Coming Soon)

The extension will be submitted to the Chrome Web Store for one-click installation.

## Usage

### Basic Usage

1. **Visit any Swagger UI page** (e.g., a REST API documentation page)
2. **The navigation sidebar automatically appears** on the right side
3. **Browse endpoints** organized by tags/sections
4. **Click any endpoint** to jump directly to it
5. **Use the search box** to filter endpoints instantly

### Navigation Features

- **Toggle Sidebar**: Click the arrow button (◀) in the header to collapse/expand
- **Expand/Collapse Sections**: Click section headers to show/hide endpoint groups
- **Search**: Type to filter by method, path, or description
- **Pin Endpoints**: Click the pin icon (📌) to add favorites
- **Jump to Endpoint**: Click any endpoint to scroll and expand it
- **Copy Path**: Click the copy icon to copy the endpoint path

### Enhanced Editing Features

#### JSON & Form View

When editing request bodies, SwaggerNav provides two synchronized views:

- **JSON View**: Traditional JSON editor for direct text editing
- **Form View**: Visual form builder with labeled fields
- **Side-by-Side**: Both views are visible and sync in real-time
- **Smart Validation**: Handles nested objects, arrays, and complex types

#### Parameter Search

For parameters with dropdown selects:

- **Instant Search**: Type to filter options
- **Keyboard Navigation**: Use arrow keys to navigate results
- **Quick Select**: Click or press Enter to select

### Customization

Access settings by:
1. **Right-click the extension icon** → Click "Options"
2. Or visit `chrome://extensions/` → Click "Details" → "Extension options"

#### Available Settings

**Auto Actions:**
- ✅ **Auto Try It Out** (default: ON) - Automatically activates "Try it out" mode
- ✅ **Auto Expand** (default: ON) - Automatically expands endpoints when clicked

**Appearance:**
- 🎨 **Theme** (default: Follow OS)
  - ☀️ Light - Always use light theme
  - 🌙 Dark - Always use dark theme
  - 🔄 Follow OS - Automatically follow system preference
  
- 🖼️ **Background** (default: Default)
  - Select from Ocean, Tet Holiday, Christmas, Too Many Bugs!
  - Upload your own custom image (max 5MB, PNG/JPG/WebP)

**Enhanced Features:**
- ✅ **JSON & Form View** (default: ON) - Visual form builder for request bodies
- ✅ **Parameter Search** (default: ON) - Searchable dropdown fields

> ⚠️ **Important**: For the best experience, disable any browser dark mode extensions (like "Dark Reader") as they may conflict with SwaggerNav's theme system.

### Keyboard Shortcuts

*Keyboard shortcuts are planned for a future release.*

## Compatibility

- **Chrome**: Version 88 or higher (Manifest V3)
- **Edge**: Version 88 or higher (Chromium-based)
- **Opera**: Latest version (Chromium-based)
- **Brave**: Latest version

**Works with:**

- OpenAPI/Swagger UI 2.x and 3.x
- Any website using the standard Swagger UI interface
- Custom Swagger UI implementations

## Development

### Project Structure

```
SwaggerNav/
├── manifest.json          # Extension manifest (Manifest V3)
├── content.js            # Main content script (4600+ lines)
├── styles.css            # Stylesheet for navigation sidebar
├── options.html          # Options page UI
├── options.js            # Options page logic
├── background.js         # Background service worker
├── backgrounds/          # Themed background images
│   ├── ocean_light.png
│   ├── ocean_dark.png
│   ├── tet_light.png
│   ├── tet_dark.png
│   ├── christmas_light.png
│   ├── christmas_dark.png
│   ├── too_many_bugs_light.png
│   └── too_many_bugs_dark.png
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md            # This file
└── INSTALL.md           # Detailed installation guide
```

### Building from Source

1. **Clone the repository**

   ```bash
   git clone https://github.com/cigrocean/SwaggerNav.git
   cd SwaggerNav
   ```

2. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `SwaggerNav` folder

### Modifying the Extension

- **Change colors/styles**: Edit `styles.css`
- **Modify navigation/features**: Edit `content.js`
- **Update options page**: Edit `options.html` and `options.js`
- **Update metadata**: Edit `manifest.json`
- **Add new backgrounds**: Add PNG images to `backgrounds/` folder (light and dark versions)

### Testing

1. Load the extension in Chrome (developer mode)
2. Visit a Swagger UI page (examples):
   - https://petstore.swagger.io/
   - https://api.example.com/docs (if you have access)
   - Any local Swagger UI instance
3. Verify features:
   - Navigation sidebar appears
   - Search works
   - Pin/unpin endpoints
   - JSON & Form View displays correctly
   - Theme switching works
   - Background changes apply
   - Settings persist after reload

## Troubleshooting

### The sidebar doesn't appear

- **Check if it's a Swagger UI page**: The extension only activates on pages using Swagger UI
- **Wait a moment**: Some instances take time to load; sidebar appears once content is ready
- **Check the toggle button**: Sidebar might be collapsed; look for the arrow button (◀)
- **Reload the page**: Press F5 to reload
- **Check browser console**: Press F12 and look for error messages

### Search doesn't work

- Make sure you're typing in the search box at the top of the sidebar
- Search is case-insensitive and searches method, path, and description
- Clear the search box to see all endpoints again

### JSON & Form View not showing

- Check that "JSON & Form View" is enabled in Options
- Reload the Swagger UI page after changing settings
- The feature only appears when editing request bodies

### Theme or background not applying

1. **Reload the extension**: Go to `chrome://extensions/` and click the reload button
2. **Hard refresh the page**: Press Ctrl+Shift+R (Cmd+Shift+R on Mac)
3. **Check settings**: Open Options and verify your theme/background selection
4. **Disable conflicting extensions**: Temporarily disable dark mode extensions

### Custom background not loading

- Check file size (must be under 5MB)
- Verify format (PNG, JPG, or WebP only)
- Try a different image if the file might be corrupted
- Clear cache and reload: `chrome://extensions/` → Remove and reinstall

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Test thoroughly** on multiple Swagger UI pages
5. **Commit your changes** (`git commit -m 'Add amazing feature'`)
6. **Push to the branch** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

### Ideas for Contributions

- [x] Add keyboard shortcuts for navigation
- [x] Export endpoint list (JSON, CSV, Markdown)
- [x] Pin/favorite endpoints
- [x] Enhanced editing (JSON & Form View)
- [x] Theme customization (Light/Dark/Auto)
- [x] Decorative backgrounds
- [x] Custom background upload
- [x] Options page for settings
- [ ] Advanced filtering by HTTP method, tags, or response codes
- [ ] Endpoint history and recent access
- [ ] Collection/folder organization for pinned endpoints
- [ ] Import/export settings and pins
- [ ] Support for other API documentation tools (Redoc, Stoplight)
- [ ] Endpoint testing and request builder
- [ ] API response examples and schema viewer
- [ ] Performance analytics and metrics

## License

MIT License

Copyright (c) 2025 SwaggerNav Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Changelog

### Version 1.1.0 (Latest)

**Preserve Swagger UI Default Styling:**
- 🎨 **Swagger UI remains unchanged in default mode** - Extension no longer modifies Swagger UI's native styling when using default theme (auto theme, default background, no liquid glass)
- 🔧 Removed file input style overrides that were affecting Swagger UI even in default mode
- ✨ Extension features (sidebar, parameter search) continue to work perfectly while preserving Swagger UI's original appearance
- 🎯 Only explicit theme choices (light/dark) or custom backgrounds will modify Swagger UI styling

----

### Version 1.0.9

**Hotfix: Responsive Layout & Auto-Scroll:**
- 🔧 Fixed responsive layout - Main page now properly shrinks to fit viewport when sidebar is visible (no horizontal scrolling)
- 🎯 Restored auto-scroll on page load - Main page automatically scrolls to endpoint on reload when URL hash is present
- 📱 Improved mobile responsiveness - Both desktop (350px) and mobile (280px) sidebar widths now properly constrain main content
- ⚡ Added JavaScript-based width constraints to force Swagger UI containers to fit viewport
- 🔄 Applied constraints on sidebar show/hide to ensure proper layout updates
- 📐 Fixed scroll calculations to account for responsive layout changes

----

### Version 1.0.8

**Liquid Glass & UI Refinements:**
- ✨ New optional **Liquid Glass** mode for Swagger UI and the sidebar, layered on top of your existing backgrounds
- 🌗 Full light/dark support for Liquid Glass, including buttons, dropdowns, and collapsible sections
- 🧊 JSON / code blocks keep their solid dark background for maximum readability (no glass there)
- 🎚️ Liquid Glass is **OFF by default** and can be enabled from the options page

---

### Version 1.0.7

**Version Management System:**
- ✨ Centralized version configuration - `version.js` is now the single source of truth
- 🔄 Automatic version sync script - `sync-version.js` keeps `manifest.json` in sync
- 📋 Dynamic version display in options page (no more hardcoded versions)
- 🎯 Simplified release process with clear workflow
- 📝 Professional version management documentation

**Technical Improvements:**
- 🔧 Created `version.js` - central version configuration file
- 🔧 Created `sync-version.js` - Node.js script for version synchronization
- 🔧 Updated `manifest.json` to load `version.js` before `content.js`
- 🔧 Removed hardcoded version from `content.js` (now uses global variable)
- 🔧 Options page now displays version dynamically
- ✅ Single source of truth for version updates
- ✅ No more version mismatches between files
- ✅ Git-friendly release workflow with automatic tagging

**Benefits:**
- ✅ Update version in ONE place instead of 4+ files
- ✅ Automatic synchronization prevents version inconsistencies
- ✅ Clear, documented release process for future versions
- ✅ Easier maintenance for contributors and developers

### Version 1.0.6

**New Features:**
- ✨ Custom background upload (up to 5MB, PNG/JPG/WebP)
- 🎨 Decorative themed backgrounds (Ocean, Tet Holiday, Christmas, Too Many Bugs!)
- 🖼️ Smart blur and tint effects for background readability
- ⚙️ Comprehensive options page for customization
- 🎯 Theme selector (Light/Dark/Follow OS)
- 📝 JSON & Form View for enhanced request body editing
- 🔍 Parameter search boxes for dropdowns with long option lists
- ⚡ Auto Try It Out - automatically activate editing mode
- 📂 Auto Expand - automatically expand endpoints when clicked
- 🔄 Real-time theme and background updates across all tabs
- 💾 Persistent settings with chrome.storage sync
- ⚠️ Dark mode extension conflict warning

**Improvements:**
- 🎨 Complete dark mode support throughout the extension
- 🎨 Responsive design for options page
- 🔧 Fixed theme switching for all UI components
- 🔧 Fixed Reset button to properly clear form and JSON values
- 🔧 Fixed scrolling to endpoints with reliable visibility
- 🔧 Fixed Form View number input handling (negatives, decimals)
- 🔧 Fixed JSON/Form View disappearing after collapse/expand
- 🔧 Fixed duplicate spawning when clicking "Add object item"
- 🔧 Proper opacity values for background overlays (50%)
- ⚡ Instant background application after upload
- 🎯 Centered layout for upload manager section

**Bug Fixes:**
- Fixed parameter search and endpoint search theme switching
- Fixed "Try it out" button disappearing after cancel
- Fixed "Could not render Parameters" error
- Fixed file upload input dark mode styling
- Fixed custom background fallback behavior
- Fixed theme broken when changing from dark to light mode
- Fixed background not applying automatically after upload

### Version 1.0.0 (Initial Release)

- ✨ Automatic Swagger UI detection
- 📋 Navigation sidebar with organized endpoints
- 🔍 Real-time search functionality
- 🎯 Quick jump to endpoints with smooth scrolling
- 📋 Copy endpoint paths to clipboard
- 🎨 Modern UI with CSS variables
- 🌓 Automatic light/dark mode based on OS
- 📱 Responsive design
- 🔄 Auto-refresh on content changes
- ⚡ Collapsible sections
- 🎨 Visual feedback for interactions
- ♿ Accessibility improvements

## Support

If you encounter any issues or have questions:

- **Open an issue**: [GitHub Issues](https://github.com/cigrocean/SwaggerNav/issues)
- **Check existing issues**: Someone might have already reported it
- **Provide details**: Include browser version, Swagger UI version, steps to reproduce, and console errors

## Acknowledgments

- Built with Chrome Extension Manifest V3
- Designed to work seamlessly with [Swagger UI](https://swagger.io/tools/swagger-ui/)
- Inspired by the need for better API documentation navigation
- Developed with [Cursor](https://www.cursor.com) - AI-powered code editor
- Background images designed for developer ambiance and personalization

---

## Developer

**Ocean Litmers**

- GitHub: [@cigrocean](https://github.com/cigrocean)
- This project: [SwaggerNav](https://github.com/cigrocean/SwaggerNav)

---

**Made with ❤️ for developers who work with APIs**

_Built with [Cursor](https://www.cursor.com) - The AI-first code editor_

_If you find this extension helpful, please consider giving it a ⭐ on [GitHub](https://github.com/cigrocean/SwaggerNav)!_
