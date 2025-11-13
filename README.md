# SwaggerNav - Swagger UI Navigator

A Chrome extension that adds a powerful navigation sidebar to Swagger UI pages, making it easy to quickly jump to any API endpoint or section.

**Developed by [Ocean Litmers](https://github.com/cigrocean)** | **Powered by [Cursor](https://www.cursor.com)**

## Features

✨ **Smart Detection** - Automatically detects Swagger UI pages and activates  
📋 **Organized Navigation** - Groups endpoints by tags/sections for easy browsing  
🔍 **Live Search** - Filter endpoints by method, path, or description  
🎯 **Quick Jump** - Click any endpoint to instantly scroll to it  
📋 **Copy to Clipboard** - One-click copy of endpoint paths  
🔄 **Auto-Refresh** - Updates automatically when Swagger UI content changes  
🎨 **Modern UI** - Clean, non-intrusive design  
🌓 **Auto Theme** - Automatically follows your OS light/dark mode preference  
📱 **Responsive** - Works on all screen sizes  
⌨️ **Collapsible** - Sections can be expanded/collapsed for better organization

## Screenshots

![Image](https://github.com/user-attachments/assets/f9ceec9f-e031-493a-a3ad-fc61b07b4ff3)

The extension adds a sleek navigation sidebar on the right side of any Swagger UI page:

- **Navigation Bar**: Fixed sidebar with all endpoints organized by tags
- **Search Box**: Quickly filter endpoints as you type
- **Method Badges**: Color-coded HTTP method indicators (GET, POST, PUT, DELETE, etc.)
- **Endpoint Counter**: Shows total number of endpoints
- **Collapsible Sections**: Click section headers to expand/collapse groups
- **Smooth Scrolling**: Clicking an endpoint smoothly scrolls to it with highlighting

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
2. **The navigation sidebar will automatically appear** on the right side
3. **Browse endpoints** organized by tags/sections
4. **Click any endpoint** to jump directly to it
5. **Use the search box** to filter endpoints

### Navigation Features

- **Toggle Sidebar**: Click the arrow button (◀) in the header to collapse/expand the sidebar
- **Expand/Collapse Sections**: Click on section headers to show/hide endpoints in that group
- **Search**: Type in the search box to filter by method, path, or description
- **Jump to Endpoint**: Click any endpoint to smoothly scroll to it and expand it if collapsed

### Light/Dark Mode

The extension automatically adapts to your operating system's appearance settings:

- **Dark Mode**: Automatically activates when your OS is in dark mode (displays 🌙 icon)
- **Light Mode**: Automatically activates when your OS is in light mode (displays ☀️ icon)
- **Auto-Switch**: Changes instantly when you toggle your OS theme settings

The theme indicator (🌙/☀️) appears in the header next to "API Navigator".

### Keyboard Shortcuts (Future Feature)

Keyboard shortcuts may be added in future versions for even faster navigation.

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
├── content.js            # Main content script (detection, parsing, UI)
├── styles.css            # Stylesheet for navigation sidebar
├── icons/                # Extension icons
│   ├── icon16.png       # 16x16 toolbar icon
│   ├── icon48.png       # 48x48 extension page icon
│   └── icon128.png      # 128x128 Chrome Web Store icon
├── create_icons_simple.py    # Script to generate icons
├── icon_generator.html       # HTML-based icon generator
└── README.md            # This file
```

### Building from Source

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/SwaggerNav.git
   cd SwaggerNav
   ```

2. **Regenerate icons (optional)**

   ```bash
   python3 create_icons_simple.py
   ```

   Or open `icon_generator.html` in your browser to create custom icons.

3. **Load in Chrome**
   - Follow the installation steps above for "Load Unpacked Extension"

### Modifying the Extension

- **Change colors/styles**: Edit `styles.css`
- **Modify functionality**: Edit `content.js`
- **Update metadata**: Edit `manifest.json`
- **Create new icons**: Run `python3 create_icons_simple.py` or use `icon_generator.html`

### Testing

1. Load the extension in Chrome (developer mode)
2. Visit a Swagger UI page (examples):
   - https://petstore.swagger.io/
   - https://api.example.com/docs (if you have access)
   - Any local Swagger UI instance
3. Verify that the navigation sidebar appears
4. Test all features (search, collapse, jump, etc.)

## Troubleshooting

### The sidebar doesn't appear

- **Check if it's a Swagger UI page**: The extension only activates on pages using Swagger UI
- **Wait a moment**: Some Swagger UI instances take time to load; the sidebar will appear once the content is ready
- **Check the toggle button**: The sidebar might be collapsed; look for the arrow button on the right edge
- **Reload the page**: Press F5 to reload the page
- **Check browser console**: Press F12 and look for any error messages

### Search doesn't work

- Make sure you're typing in the search box at the top of the sidebar
- The search is case-insensitive and searches method, path, and description
- Clear the search box to see all endpoints again

### Icons not showing

- If you see icon errors, regenerate them:
  ```bash
  python3 create_icons_simple.py
  ```
- Or use `icon_generator.html` to create new ones

### Extension not loading

- Make sure you selected the correct folder (the one containing `manifest.json`)
- Check that all required files are present: `manifest.json`, `content.js`, `styles.css`
- Try disabling and re-enabling the extension in `chrome://extensions/`

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Test thoroughly**
5. **Commit your changes** (`git commit -m 'Add amazing feature'`)
6. **Push to the branch** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

### Ideas for Contributions

- [x] Add keyboard shortcuts for navigation
- [x] Export endpoint list to various formats (JSON, CSV, Markdown)
- [x] Add bookmarking/favorites for frequently used endpoints (Pin feature)
- [ ] Add filters by HTTP method
- [ ] Improve detection for custom Swagger UI implementations
- [ ] Add options page for customization
- [ ] Support for other API documentation tools (Redoc, Stoplight, etc.)
- [ ] Add endpoint statistics and analytics

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

### Version 1.0.0 (Initial Release)

- ✨ Automatic Swagger UI detection
- 📋 Navigation sidebar with organized endpoints
- 🔍 Real-time search functionality
- 🎯 Quick jump to endpoints with smooth scrolling
- 📋 Copy endpoint paths to clipboard with one click
- 🎨 Modern UI with CSS variables
- 🌓 Automatic light/dark mode based on OS preference
- 📱 Responsive design
- 🔄 Auto-refresh on content changes
- ⚡ Collapsible sections with improved UX
- 🎨 Visual feedback for all interactions
- ♿ Accessibility improvements

## Support

If you encounter any issues or have questions:

- **Open an issue**: [GitHub Issues](https://github.com/cigrocean/SwaggerNav/issues)
- **Check existing issues**: Someone might have already reported it
- **Provide details**: Include browser version, Swagger UI version, and steps to reproduce

## Acknowledgments

- Built with Chrome Extension Manifest V3
- Designed to work seamlessly with [Swagger UI](https://swagger.io/tools/swagger-ui/)
- Inspired by the need for better API documentation navigation
- Developed with [Cursor](https://www.cursor.com) - AI-powered code editor

---

## Developer

**Ocean Litmers**

- GitHub: [@cigrocean](https://github.com/cigrocean)
- This project: [SwaggerNav](https://github.com/cigrocean/SwaggerNav)

---

**Made with ❤️ for developers who work with APIs**

_Built with [Cursor](https://www.cursor.com) - The AI-first code editor_

_If you find this extension helpful, please consider giving it a ⭐ on [GitHub](https://github.com/cigrocean/SwaggerNav)!_
