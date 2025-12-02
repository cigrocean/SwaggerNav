# SwaggerNav v1.1.8 Release Notes

**Previous Version:** 1.1.7

> **Note:** This file is updated for each release. The "What's New" section changes with each version, while the installation instructions remain the same.

---

## 🎉 What's New in v1.1.8

### **UI Improvements**

- 🎨 **Complete Emoji to Icon Conversion** - Converted all remaining emojis (clock, star, magnifier) to clean SVG icons throughout the extension
- 🔍 **Search Icon Enhancement** - Parameter search input now uses SVG search icon instead of emoji, positioned inside the input field
- 📖 **Improved Text Readability** - Enhanced text contrast in Form View and Response View for both light and dark modes:
  - Light mode: Darker text (#1a1a1a) for better readability
  - Dark mode: Lighter text (#e5e5e5) for better readability

### **Bug Fixes**

- 🐛 **Fixed Duplicate Variable Declaration** - Resolved syntax error caused by duplicate `removeBtn` declaration in search history code

### **Technical Improvements**

- Added SVG search icon to parameter search input with proper positioning
- Updated CSS variables for better text contrast in form and response views
- Added media query rules for both light and dark mode text readability
- Added forced theme support for text colors in form and response views

---

## 🎉 Previous Release: v1.1.7

### **UI Improvements**

- 🎨 **Modern Button & Input Styling** - Enhanced button and input styles with smoother transitions, better focus states, and improved hover effects for a more polished look
- 📱 **Responsive Method Filters** - Method filter buttons (GET, POST, PUT, DELETE, PATCH) now wrap to multiple lines on small screens instead of overlapping, with horizontal scroll as fallback

### **UI Improvements**

- 🎨 **Modern Button & Input Styling** - Enhanced button and input styles with smoother transitions, better focus states, and improved hover effects for a more polished look
- 📱 **Responsive Method Filters** - Method filter buttons (GET, POST, PUT, DELETE, PATCH) now wrap to multiple lines on small screens instead of overlapping, with horizontal scroll as fallback
- 🎨 **Monochrome Design System** - Converted entire extension to clean monochrome shadcn-style design with neutral gray palette, while maintaining colored method badges for better distinction
- 🖼️ **SVG Icons** - Replaced all emojis with clean SVG icons throughout the extension for better consistency and appearance

### **Critical Fixes**

- 🔒 **Fixed CSS Affecting Other Websites** - Extension CSS now only applies on Swagger UI pages, preventing any interference with other websites like Facebook. All global CSS rules are scoped to Swagger UI pages only
- ✅ **Proper CSS Scoping** - Added `swagger-nav-active` class to body/html only when Swagger UI is detected, ensuring extension styles never affect non-Swagger pages
- 🎨 **Fixed Settings Icon Color** - Settings icon in options page now properly displays as black in light mode for better visibility
- 🎯 **Restored Method Badge Colors** - Method badges (GET, POST, PUT, DELETE, PATCH) restored to their original colors for better visibility and distinction

### **Technical Improvements**

- Scoped all global CSS rules (`body`, `html`, `body:has()`) to `.swagger-nav-active` class
- Added automatic class management: adds class on Swagger UI pages, removes on other pages
- Enhanced method filter container with `flex-wrap: wrap` and responsive gap adjustments
- Added media query for screens < 400px with smaller badge sizes
- Converted all accent colors to monochrome (#71717a) throughout the extension
- Replaced emoji characters with SVG icon system in content.js and options.js

---

## 🎉 Previous Release: v1.1.6

### **UI Improvements**

- 🎨 **Fixed Checkbox Visibility in Light Mode** - Response View checkboxes now properly visible in light mode with explicit styling and proper contrast
- ⚡ **Instant Parameter Search Toggle** - Parameter Search now updates immediately when toggled on/off, matching the behavior of Form View and Response View
- 🔒 **Fixed Parameter Search Toggle Persistence** - Parameter Search now stays OFF when disabled, preventing it from automatically re-enabling (matches Response View behavior)

### **Loading Experience**

- ⏳ **Fullscreen Loading Indicator** - Added beautiful fullscreen loading overlay with "SwaggerNav sidebar is loading..." message and dark background
- ✨ **Smart Loading Detection** - Loading overlay only hides when SwaggerNav sidebar is actually rendered and ready, not just when Swagger UI is detected
- 🎯 **Improved Loading Logic** - Loading overlay checks sidebar render state with polling mechanism and proper DOM verification

### **Bug Fixes**

- 🐛 **Fixed Parameter Search Auto-Enable Bug** - Parameter Search no longer automatically re-enables when toggled off, even when `enhanceParameters()` runs multiple times
- 🔧 **Fixed Checkbox Light Mode Styling** - Added explicit light mode styles for Response View checkboxes with proper border colors and backgrounds

### **Technical Improvements**

- Added `else` clause in `enhanceParameters()` to explicitly hide search wrappers when param search is disabled
- Improved loading overlay detection to check sidebar DOM presence instead of visibility
- Added polling mechanism with maximum check limit to prevent infinite loops
- Enhanced `hideLoadingOverlay()` to verify sidebar is actually in DOM before hiding

---

## 🎉 Previous Release: v1.1.5

### **Critical Bug Fixes**

- 🐛 **Fixed Response View Showing Wrong Data** - Response View now always reads from the LIVE current response element, not stale cloned data. This ensures users always see the correct response data, not data from previous requests.
- 🔧 **Fixed Response View Not Showing** - Resolved issue where Response View wouldn't appear due to function scope and timing issues.

### **Performance Optimizations**

- ⚡ **Debounced Mutation Observers** - Added 150ms debounce to Response View mutation observer to prevent excessive updates during rapid DOM changes
- 🚀 **Smart Update Detection** - Response View now only rebuilds when response text actually changes, skipping unnecessary parsing and rendering
- ⏱️ **Optimized Container Observer** - Added 200ms debounce to container observer to reduce expensive DOM queries
- 📊 **Reduced Logging Overhead** - Reduced logging frequency to 10% to minimize performance impact

### **Technical Improvements**

- Fixed `getCurrentResponseData()` to always read from live response elements
- Improved MutationObserver to watch original response elements instead of clones
- Added text comparison checks to prevent unnecessary updates
- Enhanced error handling for response element detection

---

## 🎉 Previous Release: v1.1.4

### **Response View Enhancements**

- 📋 **Custom Copy/Download Buttons** - Added custom copy and download buttons to Response View that work reliably (no more missing buttons!)
- 🎨 **Dark Mode Checkbox Fix** - Response View checkboxes now properly visible in dark mode with custom styling
- 📏 **Improved Button Spacing** - Custom buttons now have proper spacing (16px gap) and are responsive on mobile devices
- ✅ **Default Buttons Preserved** - When Response View is OFF, default Swagger UI buttons remain unchanged

### **Form View Improvements**

- ⚡ **Instant Toggle Updates** - Form View and JSON View now update immediately when toggled (no delay)
- 🔒 **Fixed Toggle Off Behavior** - Form View containers now properly stay hidden when toggled OFF (no re-appearing)

### **Performance & Speed Improvements**

- ⚡ **Faster Extension Loading** - Reduced initialization delays from 500ms to 200ms, extension appears much faster on page load
- 🚀 **Instant Scrolling** - All scrolling operations (endpoint navigation, sidebar sync) now use instant scrolling instead of smooth animation for faster navigation
- ⏱️ **Optimized Mutation Observers** - Reduced debounce time from 1000ms to 300ms for faster response to DOM changes

### **Technical Improvements**

- Removed unreliable button detection logic, replaced with custom button implementation
- Custom buttons use proper event handling and clipboard API with fallback support
- Improved CSS for button spacing and responsive behavior
- Enhanced Form View toggle logic to prevent re-appearing containers
- Optimized all scroll operations to use `behavior: "auto"` instead of `"smooth"`

---

## 🎉 Previous Release: v1.1.3

### **Response View Feature**

- 📊 **Response View** - New structured view of API responses with editable checkboxes for easy data comparison
- ✅ **Checkboxes for comparison** - Each field has a checkbox on the right side that you can check to mark fields for comparison
- 🎨 **Visual feedback** - Checked fields are highlighted with green border and shadow for easy identification
- 🔄 **Replaces original response** - Response View replaces the original Swagger UI response body, showing both JSON and structured view side-by-side
- 📏 **Height limits** - Response View has a maximum height (capped at 600px) with scrolling for better UX on long responses
- 🎯 **Consistent layout** - Form View and Response View now use the same grid-based layout system, staying side-by-side and wrapping only on smaller screens

### **Layout Improvements**

- 📐 **Grid layout for Form View** - Form View now uses grid layout instead of flex, matching Response View behavior
- 📱 **Responsive wrapping** - Both Form View and Response View wrap to single column only when screen width is below 1600px
- 🎨 **Consistent styling** - Both features now have matching layout and behavior

### **Technical Improvements**

- Added `addResponseView()` function to detect and enhance API response displays
- Added `buildResponseView()` and `buildResponseFields()` to create structured view with checkboxes
- Updated Form View container to use CSS Grid instead of Flexbox
- Added height matching logic to ensure both panels have consistent heights
- Response View automatically updates when response content changes

---

## 🎉 Previous Release: v1.1.2

### **Network Error Detection & Monitoring**

- 🔔 **Connection error popup** - Shows a popup notification when the server is down or internet is disconnected, with a reload button for quick recovery
- 🌐 **Automatic health checks** - Performs periodic health checks every 30 seconds to monitor server status, even when the page is idle
- ⚠️ **Smart error detection** - Monitors both network connectivity (online/offline events) and API server health (intercepts fetch/XHR calls)
- 🎯 **Accurate error detection** - Only shows errors for actual server failures (5xx errors), not client errors (4xx) or timeouts, preventing false positives
- 🔄 **Auto-recovery detection** - Automatically detects when server is back online and shows recovery popup with reload button
- 🚫 **Swagger UI only** - Network monitoring only runs on Swagger UI pages, not on other websites

### **Theme & Performance Improvements**

- 🎨 **Theme isolation** - Themes and CSS classes are only applied on Swagger UI pages, preventing any styling from affecting other websites
- 🔇 **Silent on other pages** - Console logs only appear on Swagger UI pages, keeping other pages' console clean
- ⚡ **Optimized performance** - All extension features (themes, backgrounds, liquid glass) check page type before executing, reducing overhead on non-Swagger pages

### **Technical Improvements**

- Added `setupNetworkErrorDetection()` to listen for browser online/offline events
- Added `setupNetworkErrorInterception()` to intercept `fetch` and `XMLHttpRequest` calls to detect server errors (5xx) and network failures
- Implemented `performHealthCheck()` that only checks web server connectivity and relies on intercepted API calls for actual failures
- Added `isSwaggerUIPage()` helper function for consistent page detection
- Created conditional logging functions (`swaggerNavLog`, `swaggerNavError`, `swaggerNavWarn`) that only log on Swagger UI pages
- Added early returns in all theme functions to prevent execution on non-Swagger pages
- Health checks run every 30 seconds after initial 10-second delay, only on Swagger UI pages

---

## 🎉 Previous Release: v1.1.1

### **Liquid Glass & Settings Improvements**

- ✨ **Liquid Glass toggle now applies immediately** - Changes take effect instantly when toggling Liquid Glass in the options page, no need to reload the page
- 🔧 **Fixed Liquid Glass 3D effect** - Restored missing `--liquid-blur` CSS variable in forced theme blocks that was breaking the backdrop blur effect
- ⚙️ **Settings button simplified** - Removed popup modal interface, Settings button now opens the options page directly for a streamlined experience
- 🎨 **Fixed options page readability** - Selected theme and background items now display with dark text in light mode when Liquid Glass is enabled, ensuring better contrast and readability

### **Technical Fixes**

- Fixed theme classes not being applied to body when Liquid Glass is toggled on/off
- Fixed missing CSS variable `--liquid-blur` in `@media (prefers-color-scheme: dark)`, `body.swagger-nav-force-light`, and `body.swagger-nav-force-dark` blocks
- Removed settings modal HTML and event handlers, simplified Settings button to open options page directly
- Added CSS overrides for selected items in options page when Liquid Glass is enabled in light mode

---

## 🎉 Previous Release: v1.1.0

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

SwaggerNav v1.1.8 includes all features from previous versions:

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
