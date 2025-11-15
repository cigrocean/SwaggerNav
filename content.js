// SwaggerNav - Content Script
// Detects Swagger UI and adds navigation sidebar

// VERSION is loaded from version.js

class SwaggerNavigator {
  constructor() {
    this.navBar = null;
    this.isSwaggerUI = false;
    this.endpoints = [];
    this.observer = null;
    this.theme = this.detectTheme();
    this.setupThemeListener();
    this.pinnedEndpoints = this.loadPinnedEndpoints();
    this.searchHistory = this.loadSearchHistory();
    this.settings = this.loadSettings();
    this.currentEndpointId = null; // Track currently selected endpoint
    this.activeMethodFilters = new Set(); // Track active method filters
    this.setupStorageListener(); // Listen for settings changes from options page
  }

  // Load pinned endpoints from localStorage
  loadPinnedEndpoints() {
    try {
      const stored = localStorage.getItem("swagger-nav-pinned");
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("SwaggerNav: Error loading pinned endpoints", error);
      return [];
    }
  }

  // Save pinned endpoints to localStorage
  savePinnedEndpoints() {
    try {
      localStorage.setItem(
        "swagger-nav-pinned",
        JSON.stringify(this.pinnedEndpoints)
      );
    } catch (error) {
      console.error("SwaggerNav: Error saving pinned endpoints", error);
    }
  }

  // Load sidebar state from localStorage
  loadSidebarState() {
    try {
      const stored = localStorage.getItem("swagger-nav-sidebar-hidden");
      return stored === "true"; // Returns true if hidden, false otherwise
    } catch (error) {
      console.error("SwaggerNav: Error loading sidebar state", error);
      return false; // Default to visible
    }
  }

  // Save sidebar state to localStorage
  saveSidebarState(isHidden) {
    try {
      localStorage.setItem("swagger-nav-sidebar-hidden", isHidden.toString());
    } catch (error) {
      console.error("SwaggerNav: Error saving sidebar state", error);
    }
  }

  // Load search history from localStorage
  loadSearchHistory() {
    try {
      const stored = localStorage.getItem("swagger-nav-search-history");
      const history = stored ? JSON.parse(stored) : [];
      console.log(
        `SwaggerNav: Loaded ${history.length} items from search history:`,
        history
      );
      return history;
    } catch (error) {
      console.error("SwaggerNav: Error loading search history", error);
      return [];
    }
  }

  // Save search history to localStorage (keep last 10)
  saveSearchHistory() {
    try {
      const historyToSave = this.searchHistory.slice(0, 10);
      localStorage.setItem(
        "swagger-nav-search-history",
        JSON.stringify(historyToSave)
      );
    } catch (error) {
      console.error("SwaggerNav: Error saving search history", error);
    }
  }

  // Add search query to history
  addToSearchHistory(query) {
    if (!query || query.trim().length === 0) return;

    const trimmedQuery = query.trim();

    // Remove if already exists (to move to top)
    const wasExisting = this.searchHistory.includes(trimmedQuery);
    this.searchHistory = this.searchHistory.filter(
      (item) => item !== trimmedQuery
    );

    // Add to beginning
    this.searchHistory.unshift(trimmedQuery);

    // Keep only last 10
    if (this.searchHistory.length > 10) {
      this.searchHistory = this.searchHistory.slice(0, 10);
    }

    this.saveSearchHistory();
    console.log(
      `SwaggerNav: ${
        wasExisting ? "Moved" : "Added"
      } "${trimmedQuery}" to search history. Total: ${
        this.searchHistory.length
      } items`
    );
  }

  // Remove single item from search history
  removeFromSearchHistory(query) {
    this.searchHistory = this.searchHistory.filter((item) => item !== query);
    this.saveSearchHistory();
    console.log(
      `SwaggerNav: Removed "${query}" from search history. Remaining: ${this.searchHistory.length} items`
    );
  }

  // Clear all search history
  clearSearchHistory() {
    const count = this.searchHistory.length;
    this.searchHistory = [];
    this.saveSearchHistory();
    console.log(
      `SwaggerNav: Cleared all search history (${count} items removed)`
    );
  }

  // Load settings from chrome.storage (async, but we'll use defaults initially)
  loadSettings() {
    // Return defaults immediately (will be updated async)
    const defaults = {
      autoExpand: true,
      autoTryOut: true,
      theme: "auto", // "light", "dark", or "auto"
      background: "default", // "default", "ocean", "tet", "christmas", "too_many_bugs"
      enableFormView: true,
      enableParamSearch: true,
    };

    // Load from chrome.storage asynchronously
    chrome.storage.sync.get(defaults, (result) => {
      this.settings = result;
      console.log(
        "SwaggerNav: Settings loaded from chrome.storage",
        this.settings
      );

      // Re-apply theme and background now that settings are loaded
      this.applyNavBarTheme();

      // Refresh UI if navbar already exists
      if (this.navBar) {
        this.updateSettingsUI();
      }
    });

    return defaults;
  }

  // Save settings to chrome.storage
  saveSettings() {
    try {
      chrome.storage.sync.set(this.settings, () => {
        console.log(
          "SwaggerNav: Settings saved to chrome.storage",
          this.settings
        );
      });
    } catch (error) {
      console.error("SwaggerNav: Error saving settings", error);
    }
  }

  // Update settings UI when settings change
  updateSettingsUI() {
    if (!this.navBar) return;

    const autoExpandCheckbox = this.navBar.querySelector(
      "#setting-auto-expand"
    );
    const autoTryOutCheckbox = this.navBar.querySelector(
      "#setting-auto-try-out"
    );

    if (autoExpandCheckbox) {
      autoExpandCheckbox.checked = this.settings.autoExpand;
    }
    if (autoTryOutCheckbox) {
      autoTryOutCheckbox.checked = this.settings.autoTryOut;
    }
  }

  // Check if endpoint is pinned
  isPinned(method, path) {
    return this.pinnedEndpoints.some(
      (ep) => ep.method === method && ep.path === path
    );
  }

  // Toggle pin for endpoint
  togglePin(method, path, endpointId, tag) {
    const index = this.pinnedEndpoints.findIndex(
      (ep) => ep.method === method && ep.path === path
    );

    // Save scroll position AND expanded sections state
    const contentArea = this.navBar?.querySelector(".swagger-nav-content");
    const savedScrollTop = contentArea ? contentArea.scrollTop : 0;

    // Save current search query if any
    const searchInput = this.navBar?.querySelector(".swagger-nav-search-input");
    const currentSearchQuery = searchInput ? searchInput.value : "";

    // Save which sections are currently expanded
    const expandedSections = [];
    const sections = this.navBar?.querySelectorAll(".swagger-nav-section");
    sections?.forEach((section) => {
      if (!section.classList.contains("collapsed")) {
        const titleEl = section.querySelector(".swagger-nav-section-title");
        if (titleEl) {
          expandedSections.push(titleEl.textContent.trim());
        }
      }
    });

    console.log(
      `SwaggerNav: Saved scroll: ${savedScrollTop}px, search: "${currentSearchQuery}", expanded sections:`,
      expandedSections
    );

    if (index >= 0) {
      // Unpin
      this.pinnedEndpoints.splice(index, 1);
      console.log(`SwaggerNav: Unpinned ${method} ${path}`);
    } else {
      // Pin
      this.pinnedEndpoints.push({ method, path, endpointId, tag });
      console.log(`SwaggerNav: Pinned ${method} ${path} from ${tag}`);
    }

    this.savePinnedEndpoints();

    // Refresh navbar
    this.refreshNavBar();

    // Restore expanded sections and scroll position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newContentArea = this.navBar?.querySelector(
          ".swagger-nav-content"
        );

        // Re-expand the sections that were expanded
        const newSections = this.navBar?.querySelectorAll(
          ".swagger-nav-section"
        );
        newSections?.forEach((section) => {
          const titleEl = section.querySelector(".swagger-nav-section-title");
          if (
            titleEl &&
            expandedSections.includes(titleEl.textContent.trim())
          ) {
            section.classList.remove("collapsed");
            const sectionContent = section.querySelector(
              ".swagger-nav-section-content"
            );
            const toggle = section.querySelector(".swagger-nav-section-toggle");
            const sectionHeader = section.querySelector(
              ".swagger-nav-section-header"
            );

            if (sectionContent) sectionContent.style.display = "block";
            if (toggle) toggle.textContent = "▲";
            if (sectionHeader)
              sectionHeader.setAttribute("aria-expanded", "true");
          }
        });

        // Restore search query and re-apply filter
        const newSearchInput = this.navBar?.querySelector(
          ".swagger-nav-search-input"
        );
        if (newSearchInput && currentSearchQuery) {
          newSearchInput.value = currentSearchQuery;
          this.filterEndpoints(currentSearchQuery);
          console.log(
            `SwaggerNav: Restored search query: "${currentSearchQuery}"`
          );
        }

        // Restore scroll position
        if (newContentArea) {
          newContentArea.scrollTop = savedScrollTop;
          console.log(
            `SwaggerNav: Restored ${expandedSections.length} sections and scroll to ${savedScrollTop}px`
          );
        }
      });
    });
  }

  // Unpin all endpoints
  unpinAll() {
    if (this.pinnedEndpoints.length === 0) return;

    const count = this.pinnedEndpoints.length;
    this.pinnedEndpoints = [];
    this.savePinnedEndpoints();
    console.log(`SwaggerNav: Unpinned all ${count} endpoints`);
    this.refreshNavBar();
  }

  // Detect current theme based on OS preference
  detectTheme() {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    } else if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
    ) {
      return "light";
    }
    return "dark"; // default
  }

  // Listen for theme changes
  setupThemeListener() {
    if (window.matchMedia) {
      const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      darkModeQuery.addEventListener("change", (e) => {
        this.theme = e.matches ? "dark" : "light";
        console.log(`SwaggerNav: Theme changed to ${this.theme} mode`);
        this.updateThemeIndicator();

        // Apply theme to Swagger UI and sidebar
        this.applySwaggerTheme();
        this.applyNavBarTheme();
      });
    }
  }

  // Listen for settings changes from options page
  setupStorageListener() {
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "sync") {
          console.log("SwaggerNav: Settings changed", changes);

          // Update local settings
          for (const [key, { newValue }] of Object.entries(changes)) {
            this.settings[key] = newValue;
          }

          // React to theme changes
          if (changes.theme) {
            console.log(
              `SwaggerNav: Theme changed to ${changes.theme.newValue}`
            );
            // Apply new theme
            this.applySwaggerTheme();
            this.applyNavBarTheme();
          }

          // React to background changes
          if (changes.background) {
            console.log(
              `SwaggerNav: Background changed to ${changes.background.newValue}`
            );
            // Apply new background
            this.applyNavBarBackground();
          }

          // Update settings UI
          this.updateSettingsUI();
        }
      });
    }
  }

  // Apply theme to SwaggerNav sidebar
  applyNavBarTheme() {
    if (!this.navBar) return;

    const themeMode = this.settings.theme || "auto";

    // Remove all theme classes first
    this.navBar.classList.remove("swagger-nav-dark", "swagger-nav-light");
    document.body.classList.remove(
      "swagger-nav-force-light",
      "swagger-nav-force-dark",
      "swagger-nav-light",
      "swagger-nav-dark"
    );

    if (themeMode === "light") {
      // Force light mode
      this.navBar.classList.add("swagger-nav-light");
      document.body.classList.add("swagger-nav-force-light");
      document.body.classList.add("swagger-nav-light");
    } else if (themeMode === "dark") {
      // Force dark mode
      this.navBar.classList.add("swagger-nav-dark");
      document.body.classList.add("swagger-nav-force-dark");
      document.body.classList.add("swagger-nav-dark");
    } else {
      // Auto mode - follow OS theme
      if (this.theme === "dark") {
        this.navBar.classList.add("swagger-nav-dark");
        document.body.classList.add("swagger-nav-dark");
      } else {
        this.navBar.classList.add("swagger-nav-light");
        document.body.classList.add("swagger-nav-light");
      }
    }

    // Apply background after theme
    this.applyNavBarBackground();
  }

  // Apply background to Swagger UI page (body element)
  async applyNavBarBackground() {
    if (!this.navBar) return;

    const backgroundTheme = this.settings.background || "default";

    // Remove all background classes from BODY (Swagger UI page)
    document.body.classList.remove(
      "swagger-nav-bg-ocean",
      "swagger-nav-bg-tet",
      "swagger-nav-bg-christmas",
      "swagger-nav-bg-bugs",
      "swagger-nav-bg-custom"
    );

    // Remove inline background styles
    document.body.style.backgroundImage = "";
    document.body.style.backgroundSize = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundRepeat = "";
    document.body.style.backgroundAttachment = "";

    // Always remove existing blur/tint style first
    const existingBlurStyle = document.getElementById("swagger-nav-bg-blur");
    if (existingBlurStyle) {
      existingBlurStyle.remove();
      console.log("SwaggerNav: Removed existing background blur/tint style");
    }

    // Handle custom background
    if (backgroundTheme === "custom") {
      await this.applyCustomBackground();
      return;
    }

    // Apply background class to BODY if not default
    if (backgroundTheme !== "default") {
      const bgClassMap = {
        ocean: "swagger-nav-bg-ocean",
        tet: "swagger-nav-bg-tet",
        christmas: "swagger-nav-bg-christmas",
        too_many_bugs: "swagger-nav-bg-bugs",
      };

      const bgImageMap = {
        ocean: "ocean",
        tet: "tet",
        christmas: "christmas",
        too_many_bugs: "too_many_bugs",
      };

      const bgClass = bgClassMap[backgroundTheme];
      const bgImageName = bgImageMap[backgroundTheme];

      if (bgClass && bgImageName) {
        // Apply background class to body
        document.body.classList.add(bgClass);

        // Determine which theme version to use (light or dark)
        const themeMode = this.settings.theme || "auto";
        let isDark = false;
        if (themeMode === "dark") {
          isDark = true;
        } else if (themeMode === "light") {
          isDark = false;
        } else {
          // Auto mode - follow OS
          isDark = this.theme === "dark";
        }

        const themeVariant = isDark ? "dark" : "light";
        const imageUrl = chrome.runtime.getURL(
          `backgrounds/${bgImageName}_${themeVariant}.png`
        );

        // Create new style for blurred background with tinted overlay
        const blurStyle = document.createElement("style");
        blurStyle.id = "swagger-nav-bg-blur";

        // Use the SAME isDark logic for tint color (don't check OS preference separately!)
        const tintColor = isDark
          ? "rgba(0, 0, 0, 0.5)"
          : "rgba(255, 255, 255, 0.5)";

        blurStyle.textContent = `
          body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url('${imageUrl}');
            background-size: contain;
            background-position: top center;
            background-repeat: repeat;
            background-attachment: fixed;
            filter: blur(8px);
            z-index: -10;
          }
          
          body::after {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: ${tintColor};
            z-index: -9;
            pointer-events: none;
          }
        `;
        document.head.appendChild(blurStyle);

        console.log(
          `SwaggerNav: Applied background ${bgClass} (${themeVariant}) to Swagger UI page with tint`
        );
      }
    } else {
      console.log(
        "SwaggerNav: Using default background (no custom background or tint)"
      );
    }

    // Re-apply Swagger theme to update CSS based on whether custom background is active
    // This ensures solid backgrounds are used when no custom background is set
    this.applySwaggerTheme();
  }

  // Apply custom uploaded background
  async applyCustomBackground() {
    try {
      // Load custom background from chrome.storage.local
      const result = await chrome.storage.local.get(["customBackground"]);

      if (!result.customBackground) {
        console.log(
          "SwaggerNav: No custom background found, falling back to default"
        );
        // Fall back to default if no custom background exists
        this.settings.background = "default";
        await chrome.storage.sync.set({ background: "default" });
        return;
      }

      // Apply custom background class
      document.body.classList.add("swagger-nav-bg-custom");

      // Determine theme
      const themeMode = this.settings.theme || "auto";
      let isDark = false;
      if (themeMode === "dark") {
        isDark = true;
      } else if (themeMode === "light") {
        isDark = false;
      } else {
        // Auto mode - follow OS
        isDark = this.theme === "dark";
      }

      // Create style for custom background with blur and tint
      const blurStyle = document.createElement("style");
      blurStyle.id = "swagger-nav-bg-blur";

      const tintColor = isDark
        ? "rgba(0, 0, 0, 0.5)"
        : "rgba(255, 255, 255, 0.5)";

      blurStyle.textContent = `
        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url('${result.customBackground}');
          background-size: contain;
          background-position: top center;
          background-repeat: repeat;
          background-attachment: fixed;
          filter: blur(8px);
          z-index: -10;
        }
        
        body::after {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: ${tintColor};
          z-index: -9;
          pointer-events: none;
        }
      `;
      document.head.appendChild(blurStyle);

      console.log("SwaggerNav: Applied custom background with tint");

      // Re-apply Swagger theme
      this.applySwaggerTheme();
    } catch (error) {
      console.error("SwaggerNav: Error applying custom background", error);
      // Fall back to default on error
      this.settings.background = "default";
      await chrome.storage.sync.set({ background: "default" });
    }
  }

  // Remove Swagger UI theme override
  removeSwaggerTheme() {
    const existingStyle = document.getElementById("swagger-nav-theme-style");
    if (existingStyle) {
      existingStyle.remove();
      console.log("SwaggerNav: Removed Swagger UI theme override");
    }
  }

  // Update theme indicator in UI
  updateThemeIndicator() {
    if (this.navBar) {
      const indicator = this.navBar.querySelector(
        ".swagger-nav-theme-indicator"
      );
      if (indicator) {
        indicator.textContent = this.theme === "dark" ? "🌙" : "☀️";
        indicator.title = `${
          this.theme === "dark" ? "Dark" : "Light"
        } mode (follows OS)`;
      }
    }
  }

  // Apply theme to Swagger UI page (Proper Dark Mode)
  applySwaggerTheme() {
    // CRITICAL: Only apply theme on Swagger UI pages
    if (!this.isSwaggerUI) {
      console.log("SwaggerNav: Skipping theme - not a Swagger UI page");
      return;
    }

    // Remove existing style if any
    const existingStyle = document.getElementById("swagger-nav-theme-style");
    if (existingStyle) {
      existingStyle.remove();
    }

    const themeMode = this.settings.theme || "auto";

    // Determine if we should apply dark theme
    let isDark = false;
    if (themeMode === "dark") {
      isDark = true;
    } else if (themeMode === "light") {
      isDark = false;
    } else {
      // Auto mode - follow OS
      isDark = this.theme === "dark";
    }

    // Check if custom background is active
    const hasCustomBackground =
      this.settings.background && this.settings.background !== "default";

    console.log(
      `SwaggerNav: Applying Swagger UI theme (${
        isDark ? "dark" : "light"
      }) with hasCustomBackground: ${hasCustomBackground}`
    );

    // For light mode, only inject CSS if there's a custom background (to make it transparent)
    if (!isDark && !hasCustomBackground) {
      return;
    }

    // Create style element for theme
    const style = document.createElement("style");
    style.id = "swagger-nav-theme-style";

    if (isDark) {
      // Proper dark theme with color overrides
      // If custom background is active, use transparent backgrounds
      const bgOverride = hasCustomBackground
        ? `
        /* Page-wide overrides - transparent for custom backgrounds */
        html,
        body {
          background-color: transparent !important;
        }
        
        /* Main backgrounds - transparent for custom backgrounds */
        .swagger-ui,
        .swagger-ui .wrapper,
        .swagger-ui > div,
        .swagger-ui .wrapper > div {
          background-color: transparent !important;
          color: #e0e0e0 !important;
        }
      `
        : `
        /* Page-wide overrides */
        html,
        body {
          background-color: #1a1a1a !important;
        }
        
        /* Main backgrounds */
        .swagger-ui,
        .swagger-ui .wrapper,
        .swagger-ui > div,
        .swagger-ui .wrapper > div {
          background-color: #1a1a1a !important;
          color: #e0e0e0 !important;
        }
      `;

      style.textContent = `
        /* SwaggerNav Auto-Theme: Dark Mode */
        
        ${bgOverride}
        
        /* Remove all white borders */
        .swagger-ui *,
        .swagger-ui *::before,
        .swagger-ui *::after {
          border-color: #3a3a3a !important;
        }
        
        /* Topbar / Header */
          .swagger-ui .topbar,
          .swagger-ui .topbar-wrapper,
          .swagger-ui .topbar a,
          .swagger-ui .information-container .info__extdocs,
          .swagger-ui .information-container section {
            background-color: ${
              hasCustomBackground ? "rgba(36, 36, 36, 0.99)" : "#242424"
            } !important;
            color: #e0e0e0 !important;
          }
          
          .swagger-ui .information-container,
          .swagger-ui .scheme-container {
            background-color: ${
              hasCustomBackground ? "rgba(36, 36, 36, 0.99)" : "#242424"
            } !important;
            border-color: #3a3a3a !important;
          }
        
        /* All divs and sections */
        .swagger-ui div,
        .swagger-ui section {
          background-color: transparent !important;
        }
        
        /* Main content area */
        .swagger-ui .swagger-container,
        .swagger-ui .main,
        .swagger-ui section.models {
          background-color: #1a1a1a !important;
        }
        
          /* Info section */
          .swagger-ui .info {
            background-color: ${
              hasCustomBackground ? "rgba(36, 36, 36, 0.5)" : "#242424"
            } !important;
          }
        
        .swagger-ui .info .title,
        .swagger-ui .info h1,
        .swagger-ui .info h2,
        .swagger-ui .info h3,
        .swagger-ui .info h4,
        .swagger-ui .info h5 {
          color: #e0e0e0 !important;
        }
        
        .swagger-ui .info p,
        .swagger-ui .info li,
        .swagger-ui .info .description {
          color: #d0d0d0 !important;
        }
        
          /* Operation blocks */
          .swagger-ui .opblock {
            background-color: ${
              hasCustomBackground ? "rgba(42, 42, 42, 0.5)" : "#2a2a2a"
            } !important;
            border-color: #3a3a3a !important;
          }
          
          .swagger-ui .opblock .opblock-summary {
            border-color: #3a3a3a !important;
            background-color: ${
              hasCustomBackground ? "rgba(42, 42, 42, 0.5)" : "#2a2a2a"
            } !important;
          }
          
          .swagger-ui .opblock .opblock-body {
            background-color: ${
              hasCustomBackground ? "rgba(36, 36, 36, 0.5)" : "#242424"
            } !important;
          }
          
          .swagger-ui .opblock .opblock-section-header {
            background-color: ${
              hasCustomBackground ? "rgba(34, 34, 34, 0.5)" : "#222222"
            } !important;
            border-color: #3a3a3a !important;
          }
        
        .swagger-ui .opblock-tag-section {
          background-color: transparent !important;
          border-bottom-color: #3a3a3a !important;
        }
        
        .swagger-ui .opblock-tag {
          background-color: transparent !important;
          color: #e0e0e0 !important;
          border-bottom-color: #3a3a3a !important;
        }
        
        .swagger-ui .opblock-description-wrapper p,
        .swagger-ui .opblock-external-docs-wrapper p,
        .swagger-ui .opblock-title_normal p {
          color: #d0d0d0 !important;
        }
        
        .swagger-ui .opblock .opblock-summary-path,
        .swagger-ui .opblock .opblock-summary-description {
          color: #e0e0e0 !important;
        }
        
          /* Tables */
          .swagger-ui table thead tr td,
          .swagger-ui table thead tr th {
            background-color: ${
              hasCustomBackground ? "rgba(42, 42, 42, 0.5)" : "#2a2a2a"
            } !important;
            color: #e0e0e0 !important;
            border-color: #3a3a3a !important;
          }
          
          .swagger-ui table tbody tr td {
            background-color: ${
              hasCustomBackground ? "rgba(36, 36, 36, 0.5)" : "#242424"
            } !important;
            color: #c0c0c0 !important;
            border-color: #3a3a3a !important;
          }
        
        .swagger-ui .parameter__name,
        .swagger-ui .parameter__type {
          color: #e0e0e0 !important;
        }
        
        .swagger-ui .parameter__in {
          color: #888888 !important;
        }
        
        /* Inputs and textareas */
          .swagger-ui input[type="text"],
          .swagger-ui input[type="email"],
          .swagger-ui input[type="password"],
          .swagger-ui input[type="search"],
          .swagger-ui input[type="number"],
          .swagger-ui textarea,
          .swagger-ui select {
            background-color: ${
              hasCustomBackground ? "rgba(42, 42, 42, 0.98)" : "#2a2a2a"
            } !important;
            color: #e0e0e0 !important;
            border-color: #3a3a3a !important;
          }
        
        .swagger-ui input[type="text"]:focus,
        .swagger-ui input[type="email"]:focus,
        .swagger-ui input[type="password"]:focus,
        .swagger-ui input[type="search"]:focus,
        .swagger-ui input[type="number"]:focus,
        .swagger-ui textarea:focus,
        .swagger-ui select:focus {
          border-color: #4a9eff !important;
          background-color: #2f2f2f !important;
        }
        
          /* Code blocks */
          .swagger-ui pre,
          .swagger-ui code {
            background-color: ${
              hasCustomBackground ? "rgba(30, 30, 30, 0.98)" : "#1e1e1e"
            } !important;
            color: #d4d4d4 !important;
            border-color: #3a3a3a !important;
          }
          
          .swagger-ui .highlight-code pre,
          .swagger-ui .highlight-code code {
            background-color: ${
              hasCustomBackground ? "rgba(30, 30, 30, 0.98)" : "#1e1e1e"
            } !important;
          }
          
          /* Syntax highlighting */
          .swagger-ui .highlight-code .hljs {
            background-color: ${
              hasCustomBackground ? "rgba(30, 30, 30, 0.98)" : "#1e1e1e"
            } !important;
            color: #d4d4d4 !important;
          }
        
        .swagger-ui .highlight-code .hljs-string,
        .swagger-ui .highlight-code .hljs-number,
        .swagger-ui .highlight-code .hljs-literal {
          color: #ce9178 !important;
        }
        
        .swagger-ui .highlight-code .hljs-attr,
        .swagger-ui .highlight-code .hljs-property {
          color: #9cdcfe !important;
        }
        
        .swagger-ui .highlight-code .hljs-keyword {
          color: #569cd6 !important;
        }
        
          /* Response section */
          .swagger-ui .responses-wrapper {
            background-color: ${
              hasCustomBackground ? "rgba(36, 36, 36, 0.98)" : "#242424"
            } !important;
          }
        
        .swagger-ui .response,
        .swagger-ui .response-col_status {
          color: #e0e0e0 !important;
        }
        
        .swagger-ui .response-col_description {
          color: #b0b0b0 !important;
        }
        
          /* Model section */
          .swagger-ui .model-box,
          .swagger-ui .model {
            background-color: ${
              hasCustomBackground ? "rgba(36, 36, 36, 0.98)" : "#242424"
            } !important;
            border-color: #3a3a3a !important;
          }
        
        .swagger-ui .model-title,
        .swagger-ui .model .property {
          color: #e0e0e0 !important;
        }
        
        .swagger-ui .prop-type,
        .swagger-ui .prop-format {
          color: #888888 !important;
        }
        
        /* Schema and models containers */
        .swagger-ui .model-container,
        .swagger-ui .models-control,
        .swagger-ui section.models,
        .swagger-ui section.models .model-container {
          background-color: ${
            hasCustomBackground ? "transparent" : "#1a1a1a"
          } !important;
        }
        
        /* Download and version info */
        .swagger-ui .info .download-contents,
        .swagger-ui .info hgroup.main,
        .swagger-ui .info .version {
          background-color: transparent !important;
          color: #e0e0e0 !important;
        }
        
        /* All boxes and wrappers */
        .swagger-ui .wrapper,
        .swagger-ui .box,
        .swagger-ui .tab-content,
        .swagger-ui .parameters-wrapper,
        .swagger-ui .request-url,
        .swagger-ui .response-wrapper {
          background-color: transparent !important;
        }
        
        /* Description and documentation - more readable */
        .swagger-ui .description {
          color: #d0d0d0 !important;
        }
        
        .swagger-ui .markdown p {
          color: #d0d0d0 !important;
        }
        
          /* Buttons */
          .swagger-ui .btn {
            background-color: ${
              hasCustomBackground ? "rgba(58, 58, 58, 0.98)" : "#3a3a3a"
            } !important;
            color: #e0e0e0 !important;
            border-color: #4a4a4a !important;
          }
          
          .swagger-ui .btn:hover {
            background-color: ${
              hasCustomBackground ? "rgba(74, 74, 74, 0.99)" : "#4a4a4a"
            } !important;
          }
        
        .swagger-ui .btn.execute {
          background-color: #4a9eff !important;
          color: #ffffff !important;
          border-color: #4a9eff !important;
        }
        
        .swagger-ui .btn.execute:hover {
          background-color: #357abd !important;
        }
        
          /* Authorization */
          .swagger-ui .auth-wrapper,
          .swagger-ui .auth-container {
            background-color: ${
              hasCustomBackground ? "rgba(36, 36, 36, 0.98)" : "#242424"
            } !important;
            border-color: #3a3a3a !important;
          }
        
        .swagger-ui .auth-wrapper .authorize,
        .swagger-ui .auth-container .authorize {
          color: #e0e0e0 !important;
        }
        
          /* Modals */
          .swagger-ui .modal-ux {
            background-color: ${
              hasCustomBackground ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.8)"
            } !important;
          }
          
          .swagger-ui .modal-ux-content {
            background-color: ${
              hasCustomBackground ? "rgba(42, 42, 42, 0.99)" : "#2a2a2a"
            } !important;
            border-color: #3a3a3a !important;
          }
          
          .swagger-ui .modal-ux-header {
            background-color: ${
              hasCustomBackground ? "rgba(36, 36, 36, 0.99)" : "#242424"
            } !important;
            border-color: #3a3a3a !important;
            color: #e0e0e0 !important;
          }
        
        /* Markdown rendered content */
        .swagger-ui .renderedMarkdown p,
        .swagger-ui .renderedMarkdown li {
          color: #d0d0d0 !important;
        }
        
        .swagger-ui .renderedMarkdown td {
          color: #c0c0c0 !important;
        }
        
          .swagger-ui .renderedMarkdown code {
            background-color: ${
              hasCustomBackground ? "rgba(30, 30, 30, 0.98)" : "#1e1e1e"
            } !important;
            color: #d4d4d4 !important;
          }
        
        /* Links */
        .swagger-ui a,
        .swagger-ui a:visited {
          color: #4a9eff !important;
        }
        
        .swagger-ui a:hover {
          color: #6eb3ff !important;
        }
        
        /* Headers and labels */
        .swagger-ui .opblock-tag,
        .swagger-ui h4,
        .swagger-ui h5,
        .swagger-ui label {
          color: #e0e0e0 !important;
        }
        
          /* Copy button */
          .swagger-ui .copy-to-clipboard {
            background-color: ${
              hasCustomBackground ? "rgba(58, 58, 58, 0.98)" : "#3a3a3a"
            } !important;
            color: #e0e0e0 !important;
          }
          
          .swagger-ui .copy-to-clipboard:hover {
            background-color: ${
              hasCustomBackground ? "rgba(74, 74, 74, 0.99)" : "#4a4a4a"
            } !important;
          }
        
        /* Servers dropdown */
        .swagger-ui .servers > label {
          color: #e0e0e0 !important;
        }
        
          .swagger-ui .servers select {
            background-color: ${
              hasCustomBackground ? "rgba(42, 42, 42, 0.98)" : "#2a2a2a"
            } !important;
            color: #e0e0e0 !important;
            border-color: #3a3a3a !important;
          }
        
          /* Try it out section */
          .swagger-ui .try-out__btn {
            background-color: ${
              hasCustomBackground ? "rgba(58, 58, 58, 0.98)" : "#3a3a3a"
            } !important;
            color: #e0e0e0 !important;
            border-color: #4a4a4a !important;
          }
          
          .swagger-ui .try-out__btn:hover {
            background-color: ${
              hasCustomBackground ? "rgba(74, 74, 74, 0.99)" : "#4a4a4a"
            } !important;
          }
        
          /* Global responses and loading */
          .swagger-ui .global-responses,
          .swagger-ui .loading-container {
            background-color: ${
              hasCustomBackground ? "rgba(36, 36, 36, 0.98)" : "#242424"
            } !important;
          }
        
        /* Catch-all for any remaining white backgrounds */
        .swagger-ui .swagger-ui > *,
        .swagger-ui [class*="wrapper"],
        .swagger-ui [class*="container"]:not(.swagger-nav-sidebar):not([class*="swagger-nav"]) {
          background-color: transparent !important;
        }
      `;
    } else {
      // Light theme - make transparent if custom background is active
      if (hasCustomBackground) {
        style.textContent = `
          /* SwaggerNav: Light Mode with Custom Background */
          
          /* Page-wide overrides - transparent for custom backgrounds */
          html,
          body {
            background-color: transparent !important;
          }
          
          /* Main backgrounds - transparent for custom backgrounds */
          .swagger-ui,
          .swagger-ui .wrapper,
          .swagger-ui > div,
          .swagger-ui .wrapper > div {
            background-color: transparent !important;
          }
        `;
      } else {
        // No custom background - use Swagger UI defaults
        style.textContent = `
          /* SwaggerNav Auto-Theme: Light Mode */
          /* No overrides needed - use Swagger UI defaults */
        `;
      }
    }

    document.head.appendChild(style);
    console.log(
      `SwaggerNav: Applied ${isDark ? "dark" : "light"} theme to Swagger UI`
    );
  }

  // Remove theme styling from Swagger UI
  removeSwaggerTheme() {
    const existingStyle = document.getElementById("swagger-nav-theme-style");
    if (existingStyle) {
      existingStyle.remove();
      console.log("SwaggerNav: Removed theme styling from Swagger UI");
    }
  }

  // Check if current page is Swagger UI
  detectSwaggerUI() {
    const indicators = [
      document.querySelector(".swagger-ui"),
      document.querySelector("#swagger-ui"),
      document.querySelector('[class*="swagger"]'),
      document.querySelector(".opblock"),
      document.querySelector(".info"),
    ];

    return indicators.some((el) => el !== null);
  }

  // Initialize the extension
  init() {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.init());
      return;
    }

    // Check if Swagger UI is present
    this.isSwaggerUI = this.detectSwaggerUI();

    if (!this.isSwaggerUI) {
      // Not a Swagger UI page, check again after a delay (for SPAs)
      setTimeout(() => {
        this.isSwaggerUI = this.detectSwaggerUI();
        if (this.isSwaggerUI) {
          // Apply theme immediately when detected
          this.applySwaggerTheme();
          this.setup();
        }
      }, 2000);
      return;
    }

    // Apply theme immediately
    this.applySwaggerTheme();

    this.setup();
  }

  // Setup the navigation
  setup() {
    console.log(
      `SwaggerNav: Initializing with ${this.theme} mode (OS preference)`
    );

    // Wait a bit for Swagger UI to fully render
    setTimeout(() => {
      this.parseEndpoints();
      this.createNavBar();
      this.setupObserver();
      this.setupSwaggerUISync();

      // Apply theme
      this.applySwaggerTheme();

      // Check for already expanded endpoints on page load
      // Longer delay to let Swagger UI process URL hash and expand endpoint
      setTimeout(() => {
        this.syncToCurrentSwaggerState();
      }, 500);

      // Setup parameter enhancements (searchable selects & form builder)
      this.setupParameterEnhancements();
    }, 1000);
  }

  // Parse all endpoints from Swagger UI
  parseEndpoints() {
    this.endpoints = [];

    // Find all operation blocks
    const opblocks = document.querySelectorAll(".opblock");

    if (opblocks.length === 0) {
      console.log("SwaggerNav: No operations found yet");
      return;
    }

    // Group endpoints by tags
    const tagGroups = {};

    opblocks.forEach((block, index) => {
      try {
        // Get HTTP method
        const methodElement = block.querySelector(".opblock-summary-method");
        const method = methodElement
          ? methodElement.textContent.trim()
          : "UNKNOWN";

        // Get endpoint path
        const pathElement = block.querySelector(".opblock-summary-path");
        const path = pathElement
          ? pathElement.textContent.trim()
          : "Unknown path";

        // Get description/summary
        const summaryElement = block.querySelector(
          ".opblock-summary-description"
        );
        const summary = summaryElement ? summaryElement.textContent.trim() : "";

        // Get the tag (section)
        let tag = "Default";
        const tagWrapper = block.closest(".opblock-tag-section");
        if (tagWrapper) {
          const tagElement = tagWrapper.querySelector(".opblock-tag");
          if (tagElement) {
            tag = tagElement.textContent.trim();
          }
        }

        // Add unique ID to the block for scrolling
        if (!block.id) {
          block.id = `swagger-nav-endpoint-${index}`;
        }

        const endpoint = {
          id: block.id,
          method: method.toUpperCase(),
          path: path,
          summary: summary,
          tag: tag,
          element: block,
        };

        // Group by tag
        if (!tagGroups[tag]) {
          tagGroups[tag] = [];
        }
        tagGroups[tag].push(endpoint);
      } catch (error) {
        console.error("SwaggerNav: Error parsing endpoint", error);
      }
    });

    // Convert to array format
    this.endpoints = Object.entries(tagGroups).map(([tag, endpoints]) => ({
      tag,
      endpoints,
    }));

    console.log(
      `SwaggerNav: Found ${opblocks.length} endpoints in ${this.endpoints.length} tags`
    );
  }

  // Refresh the navigation bar
  refreshNavBar() {
    console.log("SwaggerNav: Refreshing navigation bar");
    this.createNavBar();
  }

  // Create pinned endpoints section
  createPinnedSection(parentContent) {
    const pinnedSection = document.createElement("div");
    pinnedSection.className = "swagger-nav-section swagger-nav-pinned-section";

    const pinnedHeader = document.createElement("div");
    pinnedHeader.className =
      "swagger-nav-section-header swagger-nav-pinned-header";
    pinnedHeader.innerHTML = `
      <div class="swagger-nav-section-header-left">
        <span class="swagger-nav-pinned-icon" aria-hidden="true">📌</span>
        <span class="swagger-nav-section-title">Pinned</span>
      </div>
      <button type="button" class="swagger-nav-unpin-all-btn" title="Unpin all endpoints" aria-label="Unpin all pinned endpoints">Unpin All</button>
    `;

    // Add unpin all handler
    const unpinAllBtn = pinnedHeader.querySelector(
      ".swagger-nav-unpin-all-btn"
    );
    unpinAllBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.unpinAll();
    });

    const pinnedContent = document.createElement("div");
    pinnedContent.className = "swagger-nav-section-content";
    pinnedContent.style.display = "block"; // Always expanded

    // Add pinned endpoints
    this.pinnedEndpoints.forEach((pinnedEp) => {
      // Find the actual endpoint data
      let foundEndpoint = null;
      for (const group of this.endpoints) {
        foundEndpoint = group.endpoints.find(
          (ep) => ep.method === pinnedEp.method && ep.path === pinnedEp.path
        );
        if (foundEndpoint) break;
      }

      if (!foundEndpoint) return; // Skip if endpoint not found

      const endpointItem = document.createElement("div");
      endpointItem.className = "swagger-nav-item swagger-nav-pinned-item";
      endpointItem.dataset.method = foundEndpoint.method || "";
      endpointItem.dataset.path = (foundEndpoint.path || "").toLowerCase();
      endpointItem.dataset.summary = (
        foundEndpoint.summary || ""
      ).toLowerCase();
      endpointItem.dataset.endpointId = foundEndpoint.id || "";

      const tagName = pinnedEp.tag || "Unknown";

      endpointItem.innerHTML = `
        <div class="swagger-nav-pinned-item-content">
          <div class="swagger-nav-pinned-item-main">
            <span class="swagger-nav-method swagger-nav-method-${foundEndpoint.method.toLowerCase()}">${
        foundEndpoint.method
      }</span>
            <span class="swagger-nav-path" title="${this.escapeHtml(
              foundEndpoint.path
            )}">${this.escapeHtml(foundEndpoint.path)}</span>
          </div>
          <div class="swagger-nav-pinned-item-tag" title="From section: ${this.escapeHtml(
            tagName
          )}">
            <span class="swagger-nav-tag-icon">🏷️</span>
            <span class="swagger-nav-tag-text">${this.escapeHtml(
              tagName
            )}</span>
          </div>
        </div>
        <div class="swagger-nav-pinned-item-actions">
          <button type="button" class="swagger-nav-pin-btn pinned" title="Unpin endpoint" aria-label="Unpin ${
            foundEndpoint.method
          } ${foundEndpoint.path}"><span aria-hidden="true">📌</span></button>
          <button type="button" class="swagger-nav-copy-btn" title="Copy endpoint path" aria-label="Copy ${
            foundEndpoint.path
          } to clipboard"><span aria-hidden="true">📋</span></button>
        </div>
      `;

      // Add navigation handler - on the entire item
      const handleNavigation = (e) => {
        // Don't navigate if clicking on buttons (tag is now clickable for navigation)
        if (
          e.target.closest(".swagger-nav-pin-btn") ||
          e.target.closest(".swagger-nav-copy-btn")
        ) {
          return;
        }

        e.stopPropagation();
        e.preventDefault();

        // Clear all active states
        this.navBar.querySelectorAll(".swagger-nav-item").forEach((item) => {
          item.classList.remove("active-nav");
          item.classList.remove("swagger-nav-current");
        });

        // Set current endpoint
        this.currentEndpointId = foundEndpoint.id;

        // Find and highlight the actual (non-pinned) endpoint item immediately
        const actualItem = this.findActualEndpointItem(
          foundEndpoint.method,
          foundEndpoint.path
        );

        if (actualItem) {
          // Add current class to actual item
          actualItem.classList.add("swagger-nav-current");

          // Expand its section if collapsed
          const section = actualItem.closest(".swagger-nav-section");
          if (section && section.classList.contains("collapsed")) {
            const sectionHeader = section.querySelector(
              ".swagger-nav-section-header"
            );
            const sectionContent = section.querySelector(
              ".swagger-nav-section-content"
            );
            const toggle = section.querySelector(".swagger-nav-section-toggle");

            if (sectionContent && toggle) {
              section.classList.remove("collapsed");
              sectionContent.style.display = "block";
              toggle.textContent = "▲";
              if (sectionHeader) {
                sectionHeader.setAttribute("aria-expanded", "true");
              }
            }
          }

          // Add active class to the actual item (NOT the pinned item)
          actualItem.classList.add("active-nav");

          // Scroll the actual item into view in the extension
          actualItem.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          // Remove active class after animation - SAME as regular items
          setTimeout(() => {
            actualItem.classList.remove("active-nav");
          }, 2500);
        }

        // Scroll to the actual endpoint in Swagger UI
        this.scrollToEndpoint(foundEndpoint.id);
      };

      // Attach to the entire item
      endpointItem.addEventListener("click", handleNavigation);
      endpointItem.style.cursor = "pointer";

      // Add keyboard accessibility
      endpointItem.setAttribute("role", "button");
      endpointItem.setAttribute("tabindex", "0");
      endpointItem.setAttribute(
        "aria-label",
        `Navigate to ${foundEndpoint.method} ${foundEndpoint.path} (pinned)`
      );
      endpointItem.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleNavigation(e);
        }
      });

      // Pin button handler
      const pinBtn = endpointItem.querySelector(".swagger-nav-pin-btn");
      pinBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.togglePin(
          foundEndpoint.method,
          foundEndpoint.path,
          foundEndpoint.id,
          tagName
        );
      });

      // Copy button handler
      const copyBtn = endpointItem.querySelector(".swagger-nav-copy-btn");
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.copyToClipboard(foundEndpoint.path, copyBtn);
      });

      pinnedContent.appendChild(endpointItem);
    });

    pinnedSection.appendChild(pinnedHeader);
    pinnedSection.appendChild(pinnedContent);
    parentContent.appendChild(pinnedSection);
  }

  // Create the navigation sidebar
  createNavBar() {
    // Remove existing navbar if present
    if (this.navBar) {
      this.navBar.remove();
    }

    // Remove any floating show button
    this.removeFloatingShowButton();

    if (this.endpoints.length === 0) {
      console.log("SwaggerNav: No endpoints to display");
      return;
    }

    // Create navbar container
    this.navBar = document.createElement("div");
    this.navBar.id = "swagger-nav-sidebar";
    this.navBar.className = "swagger-nav-sidebar";

    // Create header with toggle button
    const header = document.createElement("div");
    header.className = "swagger-nav-header";
    header.innerHTML = `
      <div class="swagger-nav-header-top">
        <div class="swagger-nav-title">
          <span class="swagger-nav-icon" aria-hidden="true">📋</span>
          <span>SwaggerNav</span>
          <span class="swagger-nav-version">v${SWAGGERNAV_VERSION}</span>
          <span class="swagger-nav-theme-indicator" title="${
            this.theme === "dark" ? "Dark" : "Light"
          } mode (follows OS)" aria-label="${
      this.theme === "dark" ? "Dark" : "Light"
    } mode">${this.theme === "dark" ? "🌙" : "☀️"}</span>
        </div>
        <button type="button" class="swagger-nav-toggle-btn" title="Hide sidebar" aria-label="Hide sidebar" aria-expanded="true">
          <span aria-hidden="true">▶</span>
        </button>
      </div>
      <div class="swagger-nav-header-actions">
        <button type="button" class="swagger-nav-scroll-top-btn" title="Scroll to top of list" aria-label="Scroll to top of list">
          <span class="swagger-nav-btn-icon" aria-hidden="true">⬆</span>
          <span class="swagger-nav-btn-label">Top</span>
        </button>
        <button type="button" class="swagger-nav-sync-btn" title="Sync with current Swagger UI view" aria-label="Sync with current Swagger UI view">
          <span class="swagger-nav-btn-icon" aria-hidden="true">🔄</span>
          <span class="swagger-nav-btn-label">Sync</span>
        </button>
        <button type="button" class="swagger-nav-settings-btn" title="Settings" aria-label="Open settings">
          <span class="swagger-nav-btn-icon" aria-hidden="true">⚙️</span>
          <span class="swagger-nav-btn-label">Settings</span>
        </button>
      </div>
    `;

    this.navBar.appendChild(header);

    // Add search box (sticky, outside content)
    const searchBox = document.createElement("div");
    searchBox.className = "swagger-nav-search";
    searchBox.innerHTML = `
      <div class="swagger-nav-search-container">
        <div class="swagger-nav-search-input-wrapper">
          <input type="text" placeholder="Search endpoints..." class="swagger-nav-search-input" aria-label="Search API endpoints" role="searchbox" autocomplete="off">
          <button type="button" class="swagger-nav-search-clear" title="Clear search" aria-label="Clear search" style="display: none;">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div class="swagger-nav-method-filters">
          <button type="button" class="swagger-nav-method-filter" data-method="get" title="Filter GET requests">
            <span class="swagger-nav-method-badge swagger-nav-method-get">GET</span>
          </button>
          <button type="button" class="swagger-nav-method-filter" data-method="post" title="Filter POST requests">
            <span class="swagger-nav-method-badge swagger-nav-method-post">POST</span>
          </button>
          <button type="button" class="swagger-nav-method-filter" data-method="put" title="Filter PUT requests">
            <span class="swagger-nav-method-badge swagger-nav-method-put">PUT</span>
          </button>
          <button type="button" class="swagger-nav-method-filter" data-method="delete" title="Filter DELETE requests">
            <span class="swagger-nav-method-badge swagger-nav-method-delete">DELETE</span>
          </button>
          <button type="button" class="swagger-nav-method-filter" data-method="patch" title="Filter PATCH requests">
            <span class="swagger-nav-method-badge swagger-nav-method-patch">PATCH</span>
          </button>
        </div>
      </div>
    `;
    this.navBar.appendChild(searchBox);

    // Create content container
    const content = document.createElement("div");
    content.className = "swagger-nav-content";

    // Create top bar with counter and expand/collapse all button
    const topBar = document.createElement("div");
    topBar.className = "swagger-nav-top-bar";

    const totalEndpoints = this.endpoints.reduce(
      (sum, group) => sum + group.endpoints.length,
      0
    );
    const counter = document.createElement("div");
    counter.className = "swagger-nav-counter";
    counter.textContent = `${totalEndpoints} endpoints`;

    const expandCollapseBtn = document.createElement("button");
    expandCollapseBtn.type = "button";
    expandCollapseBtn.className = "swagger-nav-expand-collapse-btn";
    expandCollapseBtn.innerHTML = "<span>Expand All</span>";
    expandCollapseBtn.setAttribute("aria-label", "Expand all sections");
    expandCollapseBtn.setAttribute("aria-expanded", "false");
    expandCollapseBtn.title = "Expand all sections";

    topBar.appendChild(counter);
    topBar.appendChild(expandCollapseBtn);
    content.appendChild(topBar);

    // Create pinned section if there are pinned endpoints
    if (this.pinnedEndpoints.length > 0) {
      this.createPinnedSection(content);
    }

    // Create sections for each tag
    this.endpoints.forEach((group, groupIndex) => {
      const section = document.createElement("div");
      section.className = "swagger-nav-section";

      // Section header
      const sectionHeader = document.createElement("div");
      sectionHeader.className = "swagger-nav-section-header";
      sectionHeader.setAttribute("role", "button");
      sectionHeader.setAttribute("tabindex", "0");
      sectionHeader.setAttribute("aria-expanded", "false");
      sectionHeader.setAttribute(
        "aria-label",
        `Expand ${group.tag} section with ${group.endpoints.length} endpoints`
      );
      sectionHeader.innerHTML = `
        <div class="swagger-nav-section-header-left">
          <span class="swagger-nav-section-toggle" aria-hidden="true">▼</span>
          <span class="swagger-nav-section-title">${this.escapeHtml(
            group.tag
          )}</span>
        </div>
        <span class="swagger-nav-section-count" aria-label="${
          group.endpoints.length
        } endpoints">${group.endpoints.length}</span>
      `;

      // Section content (collapsed by default)
      const sectionContent = document.createElement("div");
      sectionContent.className = "swagger-nav-section-content";
      sectionContent.style.display = "none";

      // Mark section as collapsed initially
      section.classList.add("collapsed");

      // Add endpoints
      group.endpoints.forEach((endpoint) => {
        const endpointItem = document.createElement("div");
        endpointItem.className = "swagger-nav-item";
        endpointItem.dataset.method = endpoint.method || "";
        endpointItem.dataset.path = (endpoint.path || "").toLowerCase();
        endpointItem.dataset.summary = (endpoint.summary || "").toLowerCase();
        endpointItem.dataset.endpointId = endpoint.id || "";

        const isPinned = this.isPinned(endpoint.method, endpoint.path);

        endpointItem.innerHTML = `
          <span class="swagger-nav-method swagger-nav-method-${endpoint.method.toLowerCase()}">${
          endpoint.method
        }</span>
          <span class="swagger-nav-path" title="${this.escapeHtml(
            endpoint.path
          )}${
          endpoint.summary ? "\n" + this.escapeHtml(endpoint.summary) : ""
        }">${this.escapeHtml(endpoint.path)}</span>
          <button type="button" class="swagger-nav-pin-btn ${
            isPinned ? "pinned" : ""
          }" title="${
          isPinned ? "Unpin endpoint" : "Pin endpoint"
        }" aria-label="${isPinned ? "Unpin" : "Pin"} ${endpoint.method} ${
          endpoint.path
        }" aria-pressed="${
          isPinned ? "true" : "false"
        }"><span aria-hidden="true">📌</span></button>
          <button type="button" class="swagger-nav-copy-btn" title="Copy endpoint path" aria-label="Copy ${
            endpoint.path
          } to clipboard"><span aria-hidden="true">📋</span></button>
        `;

        // Add click handler for navigation - on the entire item
        const handleNavigation = (e) => {
          // Don't navigate if clicking on buttons
          if (
            e.target.closest(".swagger-nav-pin-btn") ||
            e.target.closest(".swagger-nav-copy-btn")
          ) {
            return;
          }

          e.stopPropagation();
          e.preventDefault();

          // Remove active class from all items
          this.navBar.querySelectorAll(".swagger-nav-item").forEach((item) => {
            item.classList.remove("active-nav");
            item.classList.remove("swagger-nav-current");
          });

          // Set current endpoint
          this.currentEndpointId = endpoint.id;

          // Add active class to clicked item (for animation)
          endpointItem.classList.add("active-nav");

          // Add current class (for persistent border indicator)
          endpointItem.classList.add("swagger-nav-current");

          // Navigate to endpoint
          this.scrollToEndpoint(endpoint.id);

          // Remove active animation class after animation (but keep current class)
          setTimeout(() => {
            endpointItem.classList.remove("active-nav");
          }, 2500);
        };

        // Attach to the entire item
        endpointItem.addEventListener("click", handleNavigation);
        endpointItem.style.cursor = "pointer";

        // Add keyboard accessibility
        endpointItem.setAttribute("role", "button");
        endpointItem.setAttribute("tabindex", "0");
        endpointItem.setAttribute(
          "aria-label",
          `Navigate to ${endpoint.method} ${endpoint.path}`
        );
        endpointItem.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleNavigation(e);
          }
        });

        // Add pin button handler
        const pinBtn = endpointItem.querySelector(".swagger-nav-pin-btn");
        pinBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.togglePin(
            endpoint.method,
            endpoint.path,
            endpoint.id,
            group.tag
          );
        });

        // Add copy button handler
        const copyBtn = endpointItem.querySelector(".swagger-nav-copy-btn");
        copyBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.copyToClipboard(endpoint.path, copyBtn);
        });

        sectionContent.appendChild(endpointItem);
      });

      // Add click handler to toggle section
      const toggleSection = () => {
        const isCollapsed = section.classList.contains("collapsed");
        const toggle = sectionHeader.querySelector(
          ".swagger-nav-section-toggle"
        );

        if (isCollapsed) {
          // Expand
          section.classList.remove("collapsed");
          sectionContent.style.display = "block";
          toggle.textContent = "▲";
          sectionHeader.setAttribute("aria-expanded", "true");
          sectionHeader.setAttribute(
            "aria-label",
            `Collapse ${group.tag} section`
          );

          // Scroll section into view when expanding
          setTimeout(() => {
            // Scroll to show the section with some context
            section.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "nearest",
            });
          }, 50); // Small delay to let the content expand first
        } else {
          // Collapse
          section.classList.add("collapsed");
          sectionContent.style.display = "none";
          toggle.textContent = "▼";
          sectionHeader.setAttribute("aria-expanded", "false");
          sectionHeader.setAttribute(
            "aria-label",
            `Expand ${group.tag} section with ${group.endpoints.length} endpoints`
          );
        }
      };

      sectionHeader.addEventListener("click", toggleSection);

      // Add keyboard support
      sectionHeader.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleSection();
        }
      });

      section.appendChild(sectionHeader);
      section.appendChild(sectionContent);
      content.appendChild(section);
    });

    // Add expand/collapse all functionality
    let allExpanded = false;
    expandCollapseBtn.addEventListener("click", () => {
      const sections = this.navBar.querySelectorAll(".swagger-nav-section");

      sections.forEach((section) => {
        // Skip pinned section (it should always be expanded)
        if (section.classList.contains("swagger-nav-pinned-section")) {
          return;
        }

        const sectionHeader = section.querySelector(
          ".swagger-nav-section-header"
        );
        const toggle = section.querySelector(".swagger-nav-section-toggle");
        const sectionContent = section.querySelector(
          ".swagger-nav-section-content"
        );

        // Safety check for elements
        if (!toggle || !sectionContent || !sectionHeader) {
          return;
        }

        if (allExpanded) {
          // Collapse all
          section.classList.add("collapsed");
          sectionContent.style.display = "none";
          toggle.textContent = "▼";
          sectionHeader.setAttribute("aria-expanded", "false");
        } else {
          // Expand all
          section.classList.remove("collapsed");
          sectionContent.style.display = "block";
          toggle.textContent = "▲";
          sectionHeader.setAttribute("aria-expanded", "true");
        }
      });

      allExpanded = !allExpanded;
      expandCollapseBtn.innerHTML = allExpanded
        ? "<span>Collapse All</span>"
        : "<span>Expand All</span>";
      expandCollapseBtn.title = allExpanded
        ? "Collapse all sections"
        : "Expand all sections";
      expandCollapseBtn.setAttribute(
        "aria-label",
        allExpanded ? "Collapse all sections" : "Expand all sections"
      );
      expandCollapseBtn.setAttribute(
        "aria-expanded",
        allExpanded ? "true" : "false"
      );
    });

    this.navBar.appendChild(content);

    // Create settings modal
    const settingsModal = document.createElement("div");
    settingsModal.className = "swagger-nav-settings-modal";
    settingsModal.innerHTML = `
      <div class="swagger-nav-settings-overlay"></div>
      <div class="swagger-nav-settings-panel">
        <div class="swagger-nav-settings-header">
          <h3>⚙️ Settings</h3>
          <button type="button" class="swagger-nav-settings-close" aria-label="Close settings">✕</button>
        </div>
        <div class="swagger-nav-settings-body">
          <div class="swagger-nav-setting-item">
            <label class="swagger-nav-setting-label">
              <input type="checkbox" class="swagger-nav-setting-checkbox" id="setting-auto-expand" ${
                this.settings.autoExpand ? "checked" : ""
              }>
              <span class="swagger-nav-setting-text">
                <strong>Auto-expand endpoint in Swagger UI</strong>
                <small>Automatically expands the endpoint when clicked</small>
              </span>
            </label>
          </div>
          <div class="swagger-nav-setting-item">
            <label class="swagger-nav-setting-label">
              <input type="checkbox" class="swagger-nav-setting-checkbox" id="setting-auto-try-out" ${
                this.settings.autoTryOut ? "checked" : ""
              }>
              <span class="swagger-nav-setting-text">
                <strong>Auto-click "Try it out" button</strong>
                <small>Automatically clicks "Try it out" after expanding (requires auto-expand)</small>
              </span>
            </label>
          </div>
          <div class="swagger-nav-setting-divider"></div>
          <div class="swagger-nav-setting-item swagger-nav-setting-link">
            <button type="button" class="swagger-nav-options-link" id="open-options-page">
              <span class="swagger-nav-options-icon">⚙️</span>
              <span class="swagger-nav-options-text">
                <strong>More Settings</strong>
                <small>Configure Form View, JSON View, and Parameter Search</small>
              </span>
              <span class="swagger-nav-options-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    `;
    this.navBar.appendChild(settingsModal);

    // Create footer with author info
    const footer = document.createElement("div");
    footer.className = "swagger-nav-footer";
    footer.innerHTML = `
      <div class="swagger-nav-footer-content">
        <a href="https://github.com/cigrocean/SwaggerNav" target="_blank" rel="noopener noreferrer" class="swagger-nav-footer-link swagger-nav-github-link">
          <span class="swagger-nav-github-icon">⭐</span>
          <span>Star</span>
        </a>
        <span class="swagger-nav-footer-separator">•</span>
        <span>By <a href="https://github.com/cigrocean" target="_blank" rel="noopener noreferrer" class="swagger-nav-footer-link">Ocean Litmers</a></span>
        <span class="swagger-nav-footer-separator">•</span>
        <span>Powered by <a href="https://www.cursor.com" target="_blank" rel="noopener noreferrer" class="swagger-nav-footer-link">Cursor</a></span>
      </div>
    `;
    this.navBar.appendChild(footer);

    // Add to page
    document.body.appendChild(this.navBar);

    // Apply theme to navbar based on autoTheme setting
    this.applyNavBarTheme();

    // Setup event listeners
    this.setupEventListeners();

    // Restore sidebar state from localStorage
    const isHidden = this.loadSidebarState();
    if (isHidden) {
      this.navBar.classList.add("hidden");
      const toggleBtn = this.navBar.querySelector(".swagger-nav-toggle-btn");
      if (toggleBtn) {
        toggleBtn.querySelector("span").textContent = "◀";
        toggleBtn.title = "Show sidebar";
        toggleBtn.setAttribute("aria-label", "Show sidebar");
        toggleBtn.setAttribute("aria-expanded", "false");
      }
      this.createFloatingShowButton();
    }

    console.log("SwaggerNav: Navigation bar created");
  }

  // Setup event listeners
  setupEventListeners() {
    // Header toggle button
    const toggleBtn = this.navBar.querySelector(".swagger-nav-toggle-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const isHidden = this.navBar.classList.contains("hidden");

        if (isHidden) {
          // Show sidebar
          this.navBar.classList.remove("hidden");
          toggleBtn.querySelector("span").textContent = "▶";
          toggleBtn.title = "Hide sidebar";
          toggleBtn.setAttribute("aria-label", "Hide sidebar");
          toggleBtn.setAttribute("aria-expanded", "true");
          this.removeFloatingShowButton();
          this.saveSidebarState(false); // Save as visible
        } else {
          // Hide sidebar
          this.navBar.classList.add("hidden");
          toggleBtn.querySelector("span").textContent = "◀";
          toggleBtn.title = "Show sidebar";
          toggleBtn.setAttribute("aria-label", "Show sidebar");
          toggleBtn.setAttribute("aria-expanded", "false");
          this.createFloatingShowButton();
          this.saveSidebarState(true); // Save as hidden
        }
      });
    }

    // Scroll to top button
    const scrollTopBtn = this.navBar.querySelector(
      ".swagger-nav-scroll-top-btn"
    );
    if (scrollTopBtn) {
      scrollTopBtn.addEventListener("click", () => {
        const contentArea = this.navBar.querySelector(".swagger-nav-content");
        if (contentArea) {
          contentArea.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }
      });
    }

    // Sync button
    const syncBtn = this.navBar.querySelector(".swagger-nav-sync-btn");
    if (syncBtn) {
      syncBtn.addEventListener("click", () => {
        console.log("SwaggerNav: Manual sync triggered");
        this.syncToCurrentSwaggerState();
      });
    }

    // Settings button
    const settingsBtn = this.navBar.querySelector(".swagger-nav-settings-btn");
    const settingsModal = this.navBar.querySelector(
      ".swagger-nav-settings-modal"
    );
    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener("click", () => {
        settingsModal.classList.add("active");
      });
    }

    // Settings modal close
    const settingsClose = this.navBar.querySelector(
      ".swagger-nav-settings-close"
    );
    const settingsOverlay = this.navBar.querySelector(
      ".swagger-nav-settings-overlay"
    );
    if (settingsClose && settingsModal) {
      settingsClose.addEventListener("click", () => {
        settingsModal.classList.remove("active");
      });
    }
    if (settingsOverlay && settingsModal) {
      settingsOverlay.addEventListener("click", () => {
        settingsModal.classList.remove("active");
      });
    }

    // Settings checkboxes
    const autoExpandCheckbox = this.navBar.querySelector(
      "#setting-auto-expand"
    );
    if (autoExpandCheckbox) {
      autoExpandCheckbox.addEventListener("change", (e) => {
        this.settings.autoExpand = e.target.checked;
        this.saveSettings();
        console.log(
          "SwaggerNav: Auto-expand setting changed to",
          e.target.checked
        );
      });
    }

    const autoTryOutCheckbox = this.navBar.querySelector(
      "#setting-auto-try-out"
    );
    if (autoTryOutCheckbox) {
      autoTryOutCheckbox.addEventListener("change", (e) => {
        this.settings.autoTryOut = e.target.checked;
        this.saveSettings();
        console.log(
          "SwaggerNav: Auto-try-out setting changed to",
          e.target.checked
        );
      });
    }

    // Options page link
    const optionsPageBtn = this.navBar.querySelector("#open-options-page");
    if (optionsPageBtn) {
      optionsPageBtn.addEventListener("click", () => {
        console.log(
          "SwaggerNav: Requesting service worker to open options page"
        );

        // Send message to service worker to open options page
        // This avoids ERR_BLOCKED_BY_CLIENT since content scripts have limited API access
        chrome.runtime.sendMessage(
          { action: "openOptionsPage" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "SwaggerNav: Error sending message to service worker",
                chrome.runtime.lastError
              );
              // Fallback: try opening directly as a last resort
              window.open(chrome.runtime.getURL("options.html"), "_blank");
            } else if (response && response.success) {
              console.log("SwaggerNav: Options page opened successfully");
            } else {
              console.error(
                "SwaggerNav: Service worker failed to open options page",
                response?.error
              );
            }
          }
        );
      });
    }

    // Search functionality
    const searchInput = this.navBar.querySelector(".swagger-nav-search-input");
    const searchClearBtn = this.navBar.querySelector(
      ".swagger-nav-search-clear"
    );

    console.log(`SwaggerNav: Found searchInput:`, !!searchInput);
    console.log(
      `SwaggerNav: Found searchClearBtn:`,
      !!searchClearBtn,
      searchClearBtn
    );

    // Clear button functionality handled in setupEnhancedSearch()
    // (removed old implementation)

    // Method filter buttons
    const methodFilters = this.navBar.querySelectorAll(
      ".swagger-nav-method-filter"
    );
    methodFilters.forEach((filterBtn) => {
      filterBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent event from bubbling up

        const method = filterBtn.dataset.method;

        if (this.activeMethodFilters.has(method)) {
          this.activeMethodFilters.delete(method);
          filterBtn.classList.remove("active");
        } else {
          this.activeMethodFilters.add(method);
          filterBtn.classList.add("active");
        }

        // Re-filter with current query
        const query = searchInput ? searchInput.value : "";
        this.filterEndpoints(query);

        // Refresh the enhanced dropdown if it's open (keep it open)
        const enhancedDropdown = this.navBar?.querySelector(
          ".swagger-nav-enhanced-dropdown"
        );
        if (enhancedDropdown && enhancedDropdown.style.display === "block") {
          // Refresh the dropdown with filtered results
          if (searchInput) {
            searchInput.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
      });
    });

    if (searchInput) {
      // Setup enhanced search with dropdown
      this.setupEnhancedSearch(searchInput, searchClearBtn);
    }

    // Prevent dropdown from closing when clicking on method filters area
    const methodFiltersContainer = this.navBar.querySelector(
      ".swagger-nav-method-filters"
    );
    if (methodFiltersContainer) {
      // Prevent blur on mousedown (like the dropdown does)
      methodFiltersContainer.addEventListener("mousedown", (e) => {
        e.preventDefault(); // Prevent search input from losing focus
      });
      methodFiltersContainer.addEventListener("click", (e) => {
        e.stopPropagation(); // Keep dropdown open when clicking filters
      });
    }

    // Prevent scroll chaining - stop scroll from propagating to main page
    const contentArea = this.navBar.querySelector(".swagger-nav-content");
    if (contentArea) {
      // Click on content area to close enhanced dropdown
      contentArea.addEventListener("click", () => {
        const enhancedDropdown = this.navBar?.querySelector(
          ".swagger-nav-enhanced-dropdown"
        );
        if (enhancedDropdown && enhancedDropdown.style.display === "block") {
          enhancedDropdown.style.display = "none";
          // Also blur search input
          const searchInput = this.navBar?.querySelector(
            ".swagger-nav-search-input"
          );
          if (searchInput) {
            searchInput.blur();
          }
        }
      });

      // Scroll chaining prevention
      contentArea.addEventListener(
        "wheel",
        (e) => {
          const scrollTop = contentArea.scrollTop;
          const scrollHeight = contentArea.scrollHeight;
          const clientHeight = contentArea.clientHeight;
          const deltaY = e.deltaY;

          // At the top and trying to scroll up
          if (scrollTop === 0 && deltaY < 0) {
            e.preventDefault();
            e.stopPropagation();
          }
          // At the bottom and trying to scroll down
          else if (scrollTop + clientHeight >= scrollHeight && deltaY > 0) {
            e.preventDefault();
            e.stopPropagation();
          }
        },
        { passive: false }
      );
    }

    // Also prevent scroll on the entire sidebar
    if (this.navBar) {
      this.navBar.addEventListener(
        "wheel",
        (e) => {
          e.stopPropagation();
        },
        { passive: true }
      );
    }
  }

  // Create floating show button when sidebar is hidden
  createFloatingShowButton() {
    // Remove existing button if any
    this.removeFloatingShowButton();

    const floatingBtn = document.createElement("button");
    floatingBtn.type = "button";
    floatingBtn.className = "swagger-nav-floating-show";
    floatingBtn.innerHTML = "<span aria-hidden='true'>◀</span>";
    floatingBtn.title = "Show API Navigator";
    floatingBtn.setAttribute("aria-label", "Show API Navigator sidebar");
    floatingBtn.addEventListener("click", () => {
      this.navBar.classList.remove("hidden");
      const toggleBtn = this.navBar.querySelector(".swagger-nav-toggle-btn");
      if (toggleBtn) {
        toggleBtn.querySelector("span").textContent = "▶";
        toggleBtn.title = "Hide sidebar";
        toggleBtn.setAttribute("aria-label", "Hide sidebar");
        toggleBtn.setAttribute("aria-expanded", "true");
      }
      this.removeFloatingShowButton();
      this.saveSidebarState(false); // Save as visible
    });
    document.body.appendChild(floatingBtn);
  }

  // Remove floating show button
  removeFloatingShowButton() {
    const existingBtn = document.querySelector(".swagger-nav-floating-show");
    if (existingBtn) {
      existingBtn.remove();
    }
  }

  // Old search history functions removed - now using enhanced dropdown

  // Helper to escape HTML in search queries
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Setup enhanced search with dropdown functionality
  setupEnhancedSearch(searchInput, searchClearBtn) {
    console.log(
      `SwaggerNav: setupEnhancedSearch - clearBtn exists:`,
      !!searchClearBtn
    );
    console.log(
      `SwaggerNav: setupEnhancedSearch - clearBtn element:`,
      searchClearBtn
    );

    // Create new enhanced dropdown with CSS variables (auto-adapts to theme!)
    const searchContainer = searchInput.closest(
      ".swagger-nav-search-container"
    );
    const enhancedDropdown = document.createElement("div");
    enhancedDropdown.className = "swagger-nav-enhanced-dropdown";
    enhancedDropdown.style.cssText = `display: none; position: absolute; width: 100%; max-height: 400px; overflow-y: auto; background: var(--sn-endpoint-dropdown-bg); border: 2px solid var(--sn-endpoint-search-border); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; margin-top: 4px; left: 0; top: 100%;`;

    // Append to search container so it appears below both input and filters
    if (searchContainer) {
      searchContainer.style.position = "relative";
      searchContainer.appendChild(enhancedDropdown);
    }

    // CSS variables auto-adapt to theme changes - no JavaScript needed! ✨

    let searchTimeout = null;
    let selectedIndex = -1;
    let currentResults = [];

    // Function to collect matching endpoints
    const getMatchingEndpoints = (query) => {
      const lowerQuery = query.toLowerCase().trim();
      const results = [];

      if (!lowerQuery) return results;

      // Get all endpoint items
      const items = this.navBar.querySelectorAll(".swagger-nav-item");

      items.forEach((item) => {
        const method = String(item.dataset.method || "").toLowerCase();
        const path = String(item.dataset.path || "");
        const summary = String(item.dataset.summary || "");

        // Check if matches search query
        const searchMatches =
          method.includes(lowerQuery) ||
          path.includes(lowerQuery) ||
          summary.includes(lowerQuery);

        // Check if matches active method filters
        const methodFilterMatches =
          this.activeMethodFilters.size === 0 ||
          this.activeMethodFilters.has(method);

        if (searchMatches && methodFilterMatches) {
          results.push({
            type: "endpoint",
            method: method.toUpperCase(),
            path: path,
            summary: summary,
            element: item,
          });
        }
      });

      return results.slice(0, 10); // Limit to 10 results
    };

    // Function to show dropdown with results
    const showEnhancedDropdown = (query) => {
      // No need to update colors - CSS variables handle it! ✨
      enhancedDropdown.innerHTML = "";
      currentResults = [];
      selectedIndex = -1;

      const lowerQuery = query.toLowerCase().trim();

      console.log(
        `SwaggerNav: Enhanced dropdown - search history items: ${
          this.searchHistory?.length || 0
        }`
      );
      console.log(`SwaggerNav: Enhanced dropdown - query: "${query}"`);

      // Section 1: Search History (if query is empty or matches history)
      if (this.searchHistory && this.searchHistory.length > 0) {
        const matchingHistory = lowerQuery
          ? this.searchHistory.filter((h) =>
              h.toLowerCase().includes(lowerQuery)
            )
          : this.searchHistory;

        if (matchingHistory.length > 0) {
          const historySection = document.createElement("div");
          historySection.style.cssText = `border-bottom: 1px solid var(--sn-endpoint-item-border);`;

          const historyHeader = document.createElement("div");
          historyHeader.textContent = "Recent Searches";
          historyHeader.style.cssText = `padding: 8px 12px; font-size: 11px; font-weight: 700; color: var(--sn-endpoint-text-secondary); text-transform: uppercase; background: var(--sn-endpoint-header-bg);`;
          historySection.appendChild(historyHeader);

          matchingHistory.slice(0, 5).forEach((historyQuery) => {
            const historyItem = document.createElement("div");
            historyItem.className = "swagger-nav-dropdown-item";
            historyItem.innerHTML = `
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px;">🕐</span>
                <span style="flex: 1; font-size: 14px; color: var(--sn-endpoint-search-text);">${this.escapeHtml(
                  historyQuery
                )}</span>
                <button class="remove-history" style="padding: 4px 8px; background: transparent; border: none; color: var(--sn-endpoint-text-secondary); cursor: pointer; font-size: 12px; border-radius: 3px;">✕</button>
              </div>
            `;
            historyItem.style.cssText = `padding: 10px 12px; cursor: pointer; background: var(--sn-endpoint-dropdown-bg); border-bottom: 1px solid var(--sn-endpoint-item-border); transition: background 0.15s;`;

            historyItem.addEventListener("mouseenter", () => {
              historyItem.style.background = "var(--sn-endpoint-item-hover)";
            });

            historyItem.addEventListener("mouseleave", () => {
              historyItem.style.background = "var(--sn-endpoint-dropdown-bg)";
            });

            historyItem.addEventListener("click", (e) => {
              if (!e.target.classList.contains("remove-history")) {
                searchInput.value = historyQuery;
                this.filterEndpoints(historyQuery);
                enhancedDropdown.style.display = "none";
              }
            });

            const removeBtn = historyItem.querySelector(".remove-history");
            removeBtn.addEventListener("mouseenter", () => {
              removeBtn.style.background = "var(--sn-endpoint-item-hover)";
            });
            removeBtn.addEventListener("mouseleave", () => {
              removeBtn.style.background = "transparent";
            });
            removeBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              this.removeFromSearchHistory(historyQuery);
              showEnhancedDropdown(searchInput.value);
            });

            historySection.appendChild(historyItem);
            currentResults.push({
              type: "history",
              query: historyQuery,
              element: historyItem,
            });
          });

          enhancedDropdown.appendChild(historySection);
        }
      }

      // Section 2: Matching Endpoints (if query is not empty)
      if (lowerQuery) {
        const endpoints = getMatchingEndpoints(lowerQuery);

        if (endpoints.length > 0) {
          const endpointsSection = document.createElement("div");

          const endpointsHeader = document.createElement("div");
          endpointsHeader.textContent = "Matching Endpoints";
          endpointsHeader.style.cssText = `padding: 8px 12px; font-size: 11px; font-weight: 700; color: var(--sn-endpoint-text-secondary); text-transform: uppercase; background: var(--sn-endpoint-header-bg);`;
          endpointsSection.appendChild(endpointsHeader);

          endpoints.forEach((endpoint) => {
            const endpointItem = document.createElement("div");
            endpointItem.className = "swagger-nav-dropdown-item";

            const methodColors = {
              GET: "#61affe",
              POST: "#49cc90",
              PUT: "#fca130",
              DELETE: "#f93e3e",
              PATCH: "#50e3c2",
            };

            const methodColor = methodColors[endpoint.method] || "#666";

            endpointItem.innerHTML = `
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 11px; font-weight: 700; color: white; background: ${methodColor}; min-width: 52px; text-align: center;">${
              endpoint.method
            }</span>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 13px; color: var(--sn-endpoint-search-text); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(
                    endpoint.path
                  )}</div>
                  ${
                    endpoint.summary
                      ? `<div style="font-size: 11px; color: var(--sn-endpoint-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;">${this.escapeHtml(
                          endpoint.summary
                        )}</div>`
                      : ""
                  }
                </div>
              </div>
            `;
            endpointItem.style.cssText = `padding: 10px 12px; cursor: pointer; background: var(--sn-endpoint-dropdown-bg); border-bottom: 1px solid var(--sn-endpoint-item-border); transition: background 0.15s;`;

            endpointItem.addEventListener("mouseenter", () => {
              endpointItem.style.background = "var(--sn-endpoint-item-hover)";
            });

            endpointItem.addEventListener("mouseleave", () => {
              endpointItem.style.background = "var(--sn-endpoint-dropdown-bg)";
            });

            endpointItem.addEventListener("click", () => {
              endpoint.element.click();
              enhancedDropdown.style.display = "none";
              searchInput.blur();
            });

            endpointsSection.appendChild(endpointItem);
            currentResults.push({
              type: "endpoint",
              data: endpoint,
              element: endpointItem,
            });
          });

          enhancedDropdown.appendChild(endpointsSection);
        } else if (enhancedDropdown.children.length === 0) {
          // No results at all
          const noResults = document.createElement("div");
          noResults.textContent = "No matching endpoints found";
          noResults.style.cssText = `padding: 20px; text-align: center; color: var(--sn-endpoint-text-secondary); font-size: 14px; font-style: italic;`;
          enhancedDropdown.appendChild(noResults);
        }
      }

      // Show dropdown if we have any content
      if (enhancedDropdown.children.length > 0 || !lowerQuery) {
        enhancedDropdown.style.display = "block";
      } else {
        enhancedDropdown.style.display = "none";
      }
    };

    // Keyboard navigation helper
    const updateSelectedItem = () => {
      const allItems = enhancedDropdown.querySelectorAll(
        ".swagger-nav-dropdown-item"
      );
      allItems.forEach((item, idx) => {
        if (idx === selectedIndex) {
          item.style.background = "#e3f2fd";
          item.scrollIntoView({ block: "nearest" });
        } else {
          item.style.background = "white";
        }
      });
    };

    // Function to update clear button visibility
    const updateClearButtonVisibility = () => {
      if (searchClearBtn) {
        const shouldShow = searchInput.value ? "flex" : "none";
        searchClearBtn.style.display = shouldShow;
        console.log(
          `SwaggerNav: Clear button visibility - input: "${searchInput.value}", display: ${shouldShow}`
        );
      } else {
        console.log(`SwaggerNav: Clear button not found!`);
      }
    };

    // Input event for filtering
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value;

      // Show/hide clear button
      updateClearButtonVisibility();

      this.filterEndpoints(query);
      showEnhancedDropdown(query);

      // Auto-save to history after user stops typing
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      if (query.trim().length > 0) {
        searchTimeout = setTimeout(() => {
          this.addToSearchHistory(query);
          console.log(`SwaggerNav: Auto-saved search "${query}" to history`);
          // Refresh dropdown to show updated history
          if (enhancedDropdown.style.display === "block") {
            showEnhancedDropdown(searchInput.value);
          }
        }, 1000);
      }
    });

    // Focus event
    searchInput.addEventListener("focus", () => {
      updateClearButtonVisibility();
      showEnhancedDropdown(searchInput.value);

      // Move cursor to end of text
      const len = searchInput.value.length;
      searchInput.setSelectionRange(len, len);
    });

    // Blur event
    searchInput.addEventListener("blur", () => {
      setTimeout(() => {
        enhancedDropdown.style.display = "none";
      }, 200);
    });

    // Prevent blur when clicking dropdown
    enhancedDropdown.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });

    // Keyboard navigation
    searchInput.addEventListener("keydown", (e) => {
      const allItems = enhancedDropdown.querySelectorAll(
        ".swagger-nav-dropdown-item"
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, allItems.length - 1);
        updateSelectedItem();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelectedItem();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0 && allItems[selectedIndex]) {
          allItems[selectedIndex].click();
        } else if (e.target.value.trim().length > 0) {
          // Clear the auto-save timeout
          if (searchTimeout) {
            clearTimeout(searchTimeout);
          }
          // Immediately save to history
          this.addToSearchHistory(e.target.value);
        }
      } else if (e.key === "Escape") {
        enhancedDropdown.style.display = "none";
        searchInput.blur();
      }
    });

    // Clear button functionality
    if (searchClearBtn) {
      // Prevent blur when clicking clear button
      searchClearBtn.addEventListener("mousedown", (e) => {
        e.preventDefault(); // Keep focus on search input
      });

      searchClearBtn.addEventListener("click", () => {
        searchInput.value = "";
        updateClearButtonVisibility();
        this.filterEndpoints("");
        showEnhancedDropdown(""); // Show history when cleared
        searchInput.focus();
      });
    }

    // Watch for programmatic changes to input value (not just user input)
    const inputObserver = new MutationObserver(() => {
      updateClearButtonVisibility();
    });

    // Observe attribute changes on the input
    inputObserver.observe(searchInput, {
      attributes: true,
      attributeFilter: ["value"],
    });

    // Also periodically check (fallback for any edge cases)
    setInterval(() => {
      updateClearButtonVisibility();
    }, 500);

    // Initial checks on page load
    updateClearButtonVisibility(); // Check if clear button should be visible

    // Check for persisted search value and show dropdown if has value
    if (searchInput.value) {
      this.filterEndpoints(searchInput.value);
    }

    console.log(
      `SwaggerNav: Enhanced search setup complete. Initial value: "${searchInput.value}", Clear btn visible: ${searchClearBtn?.style.display}`
    );
    console.log(
      `SwaggerNav: Search history loaded with ${
        this.searchHistory?.length || 0
      } items:`,
      this.searchHistory
    );
  }

  // Filter endpoints based on search
  filterEndpoints(query) {
    if (!query) {
      query = "";
    }
    const lowerQuery = query.toLowerCase();

    // Filter both regular items AND pinned items
    // Note: Exclude pinned items from regular count (they have both classes)
    const items = this.navBar.querySelectorAll(
      ".swagger-nav-item:not(.swagger-nav-pinned-item)"
    );
    const pinnedItems = this.navBar.querySelectorAll(
      ".swagger-nav-pinned-item"
    );
    let visibleRegularCount = 0;
    let visiblePinnedCount = 0;

    // Check if method filters are active
    const hasMethodFilters = this.activeMethodFilters.size > 0;

    // Filter regular items
    items.forEach((item) => {
      // Safely get dataset values with proper fallbacks
      const method = String(item.dataset.method || "").toLowerCase();
      const path = String(item.dataset.path || "");
      const summary = String(item.dataset.summary || "");

      // Check search query match
      const searchMatches =
        !query ||
        method.includes(lowerQuery) ||
        path.includes(lowerQuery) ||
        summary.includes(lowerQuery);

      // Check method filter match
      const methodMatches =
        !hasMethodFilters || this.activeMethodFilters.has(method);

      // Item is visible if it matches both search and method filters
      if (searchMatches && methodMatches) {
        item.style.display = "";
        visibleRegularCount++;
      } else {
        item.style.display = "none";
      }
    });

    // Filter pinned items
    pinnedItems.forEach((item) => {
      // Safely get dataset values with proper fallbacks
      const method = String(item.dataset.method || "").toLowerCase();
      const path = String(item.dataset.path || "");
      const summary = String(item.dataset.summary || "");

      // Check search query match
      const searchMatches =
        !query ||
        method.includes(lowerQuery) ||
        path.includes(lowerQuery) ||
        summary.includes(lowerQuery);

      // Check method filter match
      const methodMatches =
        !hasMethodFilters || this.activeMethodFilters.has(method);

      // Item is visible if it matches both search and method filters
      if (searchMatches && methodMatches) {
        item.style.display = "";
        visiblePinnedCount++;
      } else {
        item.style.display = "none";
      }
    });

    // Update sections visibility and expand all during search
    const sections = this.navBar.querySelectorAll(".swagger-nav-section");
    sections.forEach((section) => {
      const isPinnedSection = section.classList.contains(
        "swagger-nav-pinned-section"
      );

      // Check for visible items in both regular and pinned sections
      const allSectionItems = section.querySelectorAll(
        ".swagger-nav-item, .swagger-nav-pinned-item"
      );
      let totalVisibleItems = 0;
      allSectionItems.forEach((item) => {
        if (item.style.display !== "none") {
          totalVisibleItems++;
        }
      });

      const sectionContent = section.querySelector(
        ".swagger-nav-section-content"
      );
      const toggle = section.querySelector(".swagger-nav-section-toggle");
      const sectionCount = section.querySelector(".swagger-nav-section-count");

      if (totalVisibleItems === 0) {
        section.style.display = "none";
      } else {
        section.style.display = "";

        // Update section count to show filtered results
        if (sectionCount) {
          if (query || hasMethodFilters) {
            // Show filtered count during search or when method filters active
            sectionCount.textContent = totalVisibleItems;
            sectionCount.setAttribute(
              "aria-label",
              `${totalVisibleItems} matching endpoints`
            );
          } else {
            // Restore original count when not filtering
            const allItems = section.querySelectorAll(
              ".swagger-nav-item:not(.swagger-nav-pinned-item)"
            );
            sectionCount.textContent = allItems.length;
            sectionCount.setAttribute(
              "aria-label",
              `${allItems.length} endpoints`
            );
          }
        }

        // Expand all sections during search or when filters active (except pinned section)
        if ((query || hasMethodFilters) && !isPinnedSection) {
          // Save original state if not already saved
          if (!section.dataset.wasCollapsed) {
            section.dataset.wasCollapsed = section.classList.contains(
              "collapsed"
            )
              ? "true"
              : "false";
          }

          // Expand section
          section.classList.remove("collapsed");
          if (sectionContent) {
            sectionContent.style.display = "block";
          }
          if (toggle) {
            toggle.textContent = "▲";
          }

          // Also update header aria-expanded for accessibility
          const sectionHeader = section.querySelector(
            ".swagger-nav-section-header"
          );
          if (sectionHeader) {
            sectionHeader.setAttribute("aria-expanded", "true");
          }
        } else if (
          !query &&
          !hasMethodFilters &&
          !isPinnedSection &&
          section.dataset.wasCollapsed
        ) {
          // Restore original state when all filters are cleared
          if (section.dataset.wasCollapsed === "true") {
            section.classList.add("collapsed");
            if (sectionContent) {
              sectionContent.style.display = "none";
            }
            if (toggle) {
              toggle.textContent = "▼";
            }
          }
          // Clear the saved state
          delete section.dataset.wasCollapsed;
        }
      }
    });

    // Update counter (count only regular items, not pinned duplicates)
    const counter = this.navBar.querySelector(".swagger-nav-counter");
    if (counter) {
      if (query || hasMethodFilters) {
        // When searching or filtering by method, show filtered count
        counter.textContent = `${visibleRegularCount} of ${items.length} endpoints`;
      } else {
        counter.textContent = `${items.length} endpoints`;
      }
    }
  }

  // Scroll to specific endpoint with eye-catching animation
  scrollToEndpoint(endpointId) {
    console.log(`SwaggerNav: scrollToEndpoint called with ID: ${endpointId}`);

    const attemptScroll = (retryCount = 0) => {
      const element = document.getElementById(endpointId);
      console.log(
        `SwaggerNav: Element found (attempt ${retryCount + 1}):`,
        element
      );

      if (!element) {
        if (retryCount < 3) {
          console.log(
            `SwaggerNav: Element not found yet, retrying in 500ms...`
          );
          setTimeout(() => attemptScroll(retryCount + 1), 500);
        } else {
          console.warn(
            `SwaggerNav: Could not find element ${endpointId} after 3 attempts`
          );
        }
        return;
      }

      console.log(`SwaggerNav: Navigating to endpoint ${endpointId}`);

      // Get element position for offset scrolling
      const elementRect = element.getBoundingClientRect();
      const absoluteElementTop = elementRect.top + window.pageYOffset;
      const offset = 100; // Scroll 100px above the endpoint for better visibility

      // Scroll with offset for better visibility
      window.scrollTo({
        top: absoluteElementTop - offset,
        behavior: "smooth",
      });

      console.log(
        `SwaggerNav: Scrolled to endpoint with ${offset}px offset for visibility`
      );

      // Expand endpoint if setting is enabled
      if (this.settings.autoExpand) {
        setTimeout(() => {
          // Check multiple indicators for open state
          const isOpen = element.classList.contains("is-open");
          const ariaExpanded = element
            .querySelector("[aria-expanded]")
            ?.getAttribute("aria-expanded");
          console.log(
            `SwaggerNav: Endpoint ${endpointId} is currently ${
              isOpen ? "open" : "closed"
            } (aria-expanded: ${ariaExpanded})`
          );

          // Try multiple selectors to find the clickable element
          // Priority 1: The actual button control (most reliable)
          let clickableElement = element.querySelector(
            ".opblock-summary-control"
          );
          if (!clickableElement) {
            // Priority 2: The summary wrapper
            clickableElement = element.querySelector(".opblock-summary");
          }
          if (!clickableElement) {
            // Priority 3: Check if element itself is clickable
            if (element.classList.contains("opblock-summary")) {
              clickableElement = element;
            }
          }

          console.log(`SwaggerNav: Clickable element:`, clickableElement);
          console.log(
            `SwaggerNav: Clickable element tagName:`,
            clickableElement?.tagName
          );
          console.log(
            `SwaggerNav: Clickable element aria-expanded:`,
            clickableElement?.getAttribute("aria-expanded")
          );

          if (clickableElement && !isOpen) {
            console.log(
              `SwaggerNav: Found clickable element, expanding endpoint`
            );
            // Use MouseEvent for more reliable clicking
            const mouseEvent = new MouseEvent("click", {
              view: window,
              bubbles: true,
              cancelable: true,
              composed: true,
            });
            clickableElement.dispatchEvent(mouseEvent);

            console.log(
              `SwaggerNav: Dispatched click event to expand endpoint ${endpointId}`
            );

            // After expansion animation completes, re-scroll to ensure visibility
            setTimeout(() => {
              console.log(
                `SwaggerNav: Re-scrolling to endpoint ${endpointId} after expansion`
              );
              const elementRect = element.getBoundingClientRect();
              const absoluteElementTop = elementRect.top + window.pageYOffset;
              const offset = 100;
              window.scrollTo({
                top: absoluteElementTop - offset,
                behavior: "smooth",
              });
              console.log(
                `SwaggerNav: Re-scrolled to maintain ${offset}px offset after expansion`
              );
            }, 600); // Wait for expansion animation to complete

            // After expansion, check if we should auto-click "Try it out"
            if (this.settings.autoTryOut) {
              setTimeout(() => {
                this.clickTryItOut(element, endpointId);
              }, 800); // Wait for expansion animation to complete
            }

            // Verify after a delay
            setTimeout(() => {
              const newAriaExpanded =
                clickableElement.getAttribute("aria-expanded");
              console.log(
                `SwaggerNav: After click, aria-expanded is now: ${newAriaExpanded}`
              );
            }, 200);
          } else if (isOpen) {
            console.log(`SwaggerNav: Endpoint ${endpointId} already open`);
            // If already open and autoTryOut is enabled, try clicking the button
            if (this.settings.autoTryOut) {
              setTimeout(() => {
                this.clickTryItOut(element, endpointId);
              }, 300);
            }
          } else {
            console.warn(
              `SwaggerNav: Could not find clickable element for endpoint ${endpointId}`
            );
          }
        }, 500); // Increased delay to ensure scroll completes
      }

      // Add subtle highlight animation (no outline, just glow and scale)
      const originalStyles = {
        boxShadow: element.style.boxShadow,
        transform: element.style.transform,
        transition: element.style.transition,
      };

      // Apply subtle animation
      element.style.transition = "all 0.3s ease";
      element.style.boxShadow =
        "0 0 15px rgba(97, 175, 254, 0.4), 0 0 30px rgba(97, 175, 254, 0.2)";
      element.style.transform = "scale(1.005)";

      // Pulse animation
      setTimeout(() => {
        element.style.transform = "scale(1.01)";
      }, 150);

      setTimeout(() => {
        element.style.transform = "scale(1.005)";
      }, 300);

      setTimeout(() => {
        element.style.transform = "scale(1.01)";
      }, 450);

      setTimeout(() => {
        element.style.transform = "scale(1.005)";
      }, 600);

      // Fade out the effects
      setTimeout(() => {
        element.style.transition = "all 0.6s ease-out";
        element.style.boxShadow = originalStyles.boxShadow;
        element.style.transform = originalStyles.transform;
      }, 1500);

      // Clean up after animation completes
      setTimeout(() => {
        element.style.transition = originalStyles.transition;
      }, 2100);
    }; // End of attemptScroll function

    // Start the scroll attempt
    attemptScroll();
  }

  // Click "Try it out" button after endpoint is expanded
  clickTryItOut(endpointElement, endpointId) {
    console.log(`SwaggerNav: Looking for "Try it out" button in ${endpointId}`);

    // Find the "Try it out" button within the expanded endpoint
    const tryItOutBtn = endpointElement.querySelector(".btn.try-out__btn");

    if (tryItOutBtn) {
      // Check if button text says "Try it out" (not "Cancel" which means it's already activated)
      const buttonText = tryItOutBtn.textContent.trim();
      console.log(`SwaggerNav: Found button with text: "${buttonText}"`);

      if (buttonText.toLowerCase().includes("try it out")) {
        console.log(
          `SwaggerNav: Clicking "Try it out" button for ${endpointId}`
        );
        tryItOutBtn.click();
      } else {
        console.log(
          `SwaggerNav: Button already activated (shows "${buttonText}")`
        );
      }
    } else {
      console.log(`SwaggerNav: "Try it out" button not found in ${endpointId}`);
    }
  }

  // Setup mutation observer to detect DOM changes
  setupObserver() {
    // Observe changes to detect when Swagger UI updates
    this.observer = new MutationObserver((mutations) => {
      // Check if operations were added/removed
      const hasRelevantChanges = mutations.some((mutation) => {
        return Array.from(mutation.addedNodes).some(
          (node) =>
            node.nodeType === 1 &&
            (node.classList?.contains("opblock") ||
              node.querySelector?.(".opblock"))
        );
      });

      if (hasRelevantChanges) {
        console.log("SwaggerNav: Detected changes, refreshing...");
        // Debounce the refresh
        clearTimeout(this.refreshTimeout);
        this.refreshTimeout = setTimeout(() => {
          this.parseEndpoints();
          this.createNavBar();
        }, 500);
      }
    });

    // Start observing
    const swaggerContainer =
      document.querySelector(".swagger-ui") || document.body;
    this.observer.observe(swaggerContainer, {
      childList: true,
      subtree: true,
    });
  }

  // Setup sync between Swagger UI and extension
  setupSwaggerUISync() {
    // Listen for clicks on Swagger UI endpoints
    document.addEventListener("click", (e) => {
      // Check if clicked element is within an opblock
      const opblock = e.target.closest(".opblock");
      if (!opblock) return;

      // Small delay to let Swagger UI expand the endpoint first
      setTimeout(() => {
        const endpointId = opblock.id;
        if (!endpointId) return;

        // Find the corresponding endpoint in our navigation
        this.syncToSwaggerUI(endpointId);
      }, 100);
    });

    // Also listen for hash changes (URL changes)
    window.addEventListener("hashchange", () => {
      setTimeout(() => {
        // Find active/expanded endpoint in Swagger UI
        const expandedOpblock = document.querySelector(".opblock.is-open");
        if (expandedOpblock && expandedOpblock.id) {
          this.syncToSwaggerUI(expandedOpblock.id);
        }
      }, 100);
    });

    console.log("SwaggerNav: Swagger UI sync enabled");
  }

  // Check and sync to current Swagger UI state on initial load
  syncToCurrentSwaggerState() {
    setTimeout(() => {
      // Check for URL hash first (e.g., #/Operations/get_endpoint)
      const hash = window.location.hash;
      if (hash) {
        // Try to find expanded endpoint in Swagger UI
        const expandedOpblock = document.querySelector(".opblock.is-open");
        if (expandedOpblock && expandedOpblock.id) {
          console.log(
            `SwaggerNav: Initial sync to expanded endpoint: ${expandedOpblock.id}`
          );
          this.syncToSwaggerUI(expandedOpblock.id);

          // Auto-click "Try it out" if setting is enabled (after page reload)
          if (this.settings.autoTryOut) {
            setTimeout(() => {
              this.clickTryItOut(expandedOpblock, expandedOpblock.id);
            }, 1000); // Wait for sync to complete
          }
          return;
        }

        // If no expanded endpoint, try to find it from hash
        // Hash format is usually like: #/Tag/operation_id
        const hashParts = hash.split("/").filter((p) => p);
        if (hashParts.length >= 2) {
          // Try to find an opblock that matches
          const opblocks = document.querySelectorAll(".opblock");
          for (const opblock of opblocks) {
            if (opblock.id && hash.includes(opblock.id)) {
              console.log(
                `SwaggerNav: Initial sync to hash endpoint: ${opblock.id}`
              );
              this.syncToSwaggerUI(opblock.id);

              // Auto-click "Try it out" if setting is enabled (after page reload)
              if (this.settings.autoTryOut) {
                setTimeout(() => {
                  this.clickTryItOut(opblock, opblock.id);
                }, 1000); // Wait for sync to complete
              }
              return;
            }
          }
        }
      }

      // Fallback: check if any endpoint is already expanded (without hash)
      const expandedOpblock = document.querySelector(".opblock.is-open");
      if (expandedOpblock && expandedOpblock.id) {
        console.log(
          `SwaggerNav: Initial sync to expanded endpoint: ${expandedOpblock.id}`
        );
        this.syncToSwaggerUI(expandedOpblock.id);

        // Auto-click "Try it out" if setting is enabled (after page reload)
        if (this.settings.autoTryOut) {
          setTimeout(() => {
            this.clickTryItOut(expandedOpblock, expandedOpblock.id);
          }, 1000); // Wait for sync to complete
        }
      }
    }, 300); // Small delay to ensure Swagger UI is fully rendered
  }

  // Sync navigation to match Swagger UI state
  syncToSwaggerUI(endpointId) {
    if (!this.navBar) return;

    // Find the endpoint in our navigation (EXCLUDE pinned items)
    const allItems = this.navBar.querySelectorAll(
      ".swagger-nav-item:not(.swagger-nav-pinned-item)"
    );
    let targetItem = null;
    let targetSection = null;

    allItems.forEach((item) => {
      const itemEndpointId = item.dataset.endpointId;

      // Try exact match first
      if (itemEndpointId === endpointId) {
        targetItem = item;
        targetSection = item.closest(".swagger-nav-section");
        return;
      }

      // Fallback: partial match for compatibility
      const itemMethod = item.dataset.method;
      const itemPath = item.dataset.path;

      if (
        itemMethod &&
        itemPath &&
        endpointId.includes(itemMethod.toLowerCase()) &&
        endpointId.includes(itemPath.replace(/\//g, "_"))
      ) {
        targetItem = item;
        targetSection = item.closest(".swagger-nav-section");
      }
    });

    if (targetItem && targetSection) {
      // Expand the section if it's collapsed
      if (targetSection.classList.contains("collapsed")) {
        const sectionContent = targetSection.querySelector(
          ".swagger-nav-section-content"
        );
        const toggle = targetSection.querySelector(
          ".swagger-nav-section-toggle"
        );

        targetSection.classList.remove("collapsed");
        if (sectionContent) {
          sectionContent.style.display = "block";
        }
        if (toggle) {
          toggle.textContent = "▲";
        }
      }

      // Remove active and current class from all items
      allItems.forEach((item) => {
        item.classList.remove("active-nav");
        item.classList.remove("swagger-nav-current");
      });

      // Set as current endpoint (persistent border)
      this.currentEndpointId = endpointId;
      targetItem.classList.add("swagger-nav-current");

      // Add active class for pulse animation
      targetItem.classList.add("active-nav");

      // Scroll the item into view in the sidebar
      targetItem.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Remove active class after animation (keep current class)
      setTimeout(() => {
        targetItem.classList.remove("active-nav");
      }, 2500);

      console.log(`SwaggerNav: Synced to endpoint ${endpointId}`);
    }
  }

  // Find the actual (non-pinned) endpoint item in the navigation
  findActualEndpointItem(method, path) {
    if (!this.navBar) return null;

    // Search only non-pinned items
    const allItems = this.navBar.querySelectorAll(
      ".swagger-nav-item:not(.swagger-nav-pinned-item)"
    );

    for (const item of allItems) {
      const itemMethod = item.dataset.method;
      const itemPath = item.dataset.path;

      // Match by method and path
      if (itemMethod === method && itemPath === path.toLowerCase()) {
        return item;
      }
    }

    return null;
  }

  // Copy text to clipboard with visual feedback
  copyToClipboard(text, button) {
    // Use the modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          this.showCopyFeedback(button, true);
        })
        .catch((err) => {
          console.error("SwaggerNav: Failed to copy", err);
          this.fallbackCopy(text, button);
        });
    } else {
      // Fallback for older browsers
      this.fallbackCopy(text, button);
    }
  }

  // Fallback copy method for older browsers
  fallbackCopy(text, button) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      const successful = document.execCommand("copy");
      this.showCopyFeedback(button, successful);
    } catch (err) {
      console.error("SwaggerNav: Fallback copy failed", err);
      this.showCopyFeedback(button, false);
    }

    document.body.removeChild(textarea);
  }

  // Show visual feedback when copying
  showCopyFeedback(button, success) {
    const originalText = button.textContent;

    if (success) {
      button.textContent = "✓";
      button.classList.add("copied");

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove("copied");
      }, 1500);
    } else {
      button.textContent = "✗";
      button.classList.add("copy-failed");

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove("copy-failed");
      }, 1500);
    }
  }

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ==============================================================================
  // Parameter Enhancements: Searchable Selects & Form Builder
  // ==============================================================================

  setupParameterEnhancements() {
    console.log("SwaggerNav: Setting up parameter enhancements...");

    // Setup mutation observer to watch for "Try it out" mode
    this.paramEnhancementObserver = new MutationObserver(() => {
      if (this.paramEnhancementTimeout)
        clearTimeout(this.paramEnhancementTimeout);
      this.paramEnhancementTimeout = setTimeout(() => {
        this.enhanceParameters();
      }, 1000); // Increased debounce to 1000ms to prevent rapid re-runs and duplicates
    });

    const swaggerContainer = document.querySelector(".swagger-ui");
    if (swaggerContainer) {
      this.paramEnhancementObserver.observe(swaggerContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    // Enhance after a delay to let content load
    setTimeout(() => {
      this.enhanceParameters();
    }, 1000);

    // Fallback check every 5 seconds (reduced frequency)
    this.paramEnhancementInterval = setInterval(() => {
      this.enhanceParameters();
    }, 5000);
  }

  enhanceParameters() {
    // Prevent re-entrance (don't process if already processing)
    if (this.isEnhancing) {
      console.log(
        "SwaggerNav: Already enhancing, skipping to prevent duplicates"
      );
      return;
    }

    this.isEnhancing = true;
    console.log("SwaggerNav: Starting enhancement (locked)");

    // CRITICAL: Disconnect observer while we modify DOM to prevent infinite loop!
    if (this.paramEnhancementObserver) {
      this.paramEnhancementObserver.disconnect();
      console.log("SwaggerNav: Observer DISCONNECTED");
    }

    try {
      // Find all open endpoints in "Try it out" mode
      const opblocks = document.querySelectorAll(
        ".swagger-ui .opblock.is-open"
      );
      console.log(
        `SwaggerNav: enhanceParameters - found ${opblocks.length} open opblocks`
      );

      opblocks.forEach((opblock, index) => {
        // Check if in "Try it out" mode
        const cancelButton = opblock.querySelector(".try-out__btn.cancel");
        const isTryItOutActive = !!cancelButton;

        if (!isTryItOutActive) {
          console.log(
            `SwaggerNav: Opblock ${index} - not in "Try it out" mode, hiding enhancements`
          );

          // Hide parameter search boxes
          const searchWrappers = opblock.querySelectorAll(
            ".swagger-nav-select-search"
          );
          searchWrappers.forEach((wrapper) => {
            const parent = wrapper.closest("div");
            if (parent && parent.querySelector(".swagger-nav-select-search")) {
              parent.style.display = "none";
            }
          });

          // Remove form builder and unhide original wrapper
          const formContainers = opblock.querySelectorAll(
            ".swagger-nav-body-container"
          );
          formContainers.forEach((container) => {
            console.log(
              "SwaggerNav: Removing form builder container and restoring wrapper"
            );
            // Clean up polling interval
            if (container._textareaPollInterval) {
              clearInterval(container._textareaPollInterval);
            }
            // Find the hidden wrapper (it's the previous sibling)
            const hiddenWrapper = container.previousElementSibling;
            if (hiddenWrapper && hiddenWrapper.style.display === "none") {
              // Unhide the original wrapper
              hiddenWrapper.style.display = "";
              console.log("SwaggerNav: Restored original wrapper visibility");
            }
            // Remove our container
            container.remove();
          });

          // Reset textarea flags for all textareas in this opblock
          const textareas = opblock.querySelectorAll(
            "textarea[data-swagger-nav-form-builder='true']"
          );
          textareas.forEach((ta) => {
            ta.dataset.swaggerNavFormBuilder = "";
          });

          // Show original elements
          const hiddenSelects = opblock.querySelectorAll(
            "select[data-swagger-nav-searchable='true']"
          );
          hiddenSelects.forEach((select) => {
            select.style.display = "";
          });

          return;
        }

        console.log(
          `SwaggerNav: Opblock ${index} - in "Try it out" mode, enhancing...`
        );

        // Show parameter search boxes (if already created)
        const searchWrappers = opblock.querySelectorAll(
          ".swagger-nav-select-search"
        );
        searchWrappers.forEach((wrapper) => {
          const parent = wrapper.closest("div");
          if (parent && parent.querySelector(".swagger-nav-select-search")) {
            parent.style.display = "block";
          }
        });

        // Show form builder (if already created) and hide original wrapper
        const formContainers = opblock.querySelectorAll(
          ".swagger-nav-body-container"
        );
        formContainers.forEach((container) => {
          container.style.display = "grid";
          // Also hide the original wrapper if it's visible
          const wrapper = container.previousElementSibling;
          if (wrapper && wrapper.style.display !== "none") {
            wrapper.style.display = "none";
          }
        });

        // Hide original select elements
        const searchableSelects = opblock.querySelectorAll(
          "select[data-swagger-nav-searchable='true']"
        );
        searchableSelects.forEach((select) => {
          select.style.display = "none";
        });

        // Add searchable selects to parameter dropdowns (if enabled in settings)
        if (this.settings.enableParamSearch) {
          this.addSearchableSelects(opblock);
        }

        // Add form builder for request body (if enabled in settings)
        if (this.settings.enableFormView) {
          this.addFormBuilder(opblock);
        }
      });
    } finally {
      // Always unlock, even if there's an error
      this.isEnhancing = false;
      console.log("SwaggerNav: Enhancement complete (unlocked)");

      // CRITICAL: Reconnect observer after we're done modifying DOM
      if (this.paramEnhancementObserver) {
        const swaggerContainer = document.querySelector(".swagger-ui");
        if (swaggerContainer) {
          this.paramEnhancementObserver.observe(swaggerContainer, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"],
          });
          console.log("SwaggerNav: Observer RECONNECTED");
        }
      }
    }
  }

  // ==============================================================================
  // Feature 1: Searchable Select Dropdowns
  // ==============================================================================

  addSearchableSelects(opblock) {
    const paramRows = opblock.querySelectorAll(".parameters tbody tr");
    console.log(`SwaggerNav: Found ${paramRows.length} parameter rows`);

    paramRows.forEach((row, index) => {
      const select = row.querySelector("select");
      if (!select) {
        console.log(`SwaggerNav: Row ${index} - no select found`);
        return;
      }

      console.log(
        `SwaggerNav: Row ${index} - found select with ${select.options.length} options`
      );
      console.log(
        `SwaggerNav: Row ${index} - select parent:`,
        select.parentNode?.tagName,
        select.parentNode?.className
      );

      // Skip if already enhanced AND search wrapper still exists
      if (select.dataset.swaggerNavSearchable) {
        // Verify the search wrapper actually exists in DOM
        const existingWrapper = row.querySelector(".swagger-nav-select-search");
        if (existingWrapper) {
          console.log(
            `SwaggerNav: Row ${index} - already enhanced and wrapper exists`
          );
          return;
        } else {
          // Wrapper was removed (endpoint was collapsed/reopened), reset flag
          console.log(
            `SwaggerNav: Row ${index} - was marked as enhanced but wrapper is missing, resetting...`
          );
          select.dataset.swaggerNavSearchable = "";
        }
      }

      // Mark as enhanced
      select.dataset.swaggerNavSearchable = "true";

      // Hide the original select (we'll update it in background)
      select.style.display = "none";

      // Create wrapper for search input to ensure proper layout
      const searchWrapper = document.createElement("div");
      searchWrapper.style.cssText =
        "width: 100% !important; max-width: 100% !important; margin-bottom: 6px; display: block !important; position: relative !important; box-sizing: border-box !important;";

      // Create search input with CSS variables (auto-adapts to theme!)
      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "swagger-nav-select-search";
      searchInput.placeholder = "🔍 Search options...";
      searchInput.style.cssText = `display: block !important; width: 100% !important; max-width: none !important; padding: 8px 36px 8px 12px !important; margin: 0 !important; border: 2px solid var(--sn-param-search-border) !important; border-radius: 4px !important; background: var(--sn-param-search-bg) !important; color: var(--sn-param-search-text) !important; font-size: 14px !important; box-sizing: border-box !important; outline: none !important; font-family: sans-serif !important; min-height: 38px !important; line-height: 1.5 !important; z-index: 1 !important; position: relative !important; flex: 1 !important;`;

      // Create clear button with CSS variables
      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "swagger-nav-param-clear";
      clearButton.innerHTML = "×";
      clearButton.title = "Clear search";
      clearButton.style.cssText = `display: none; position: absolute !important; right: 10px !important; top: 50% !important; transform: translateY(-50%) !important; width: 24px !important; height: 24px !important; background: none !important; border: none !important; color: var(--sn-param-clear-btn) !important; font-size: 20px !important; line-height: 1 !important; cursor: pointer !important; border-radius: 4px !important; transition: all 0.2s !important; padding: 0 !important; z-index: 10 !important; margin: 0 !important; text-align: center !important; vertical-align: middle !important;`;

      // Create results dropdown with CSS variables
      const resultsDropdown = document.createElement("div");
      resultsDropdown.className = "swagger-nav-search-results";
      resultsDropdown.style.cssText = `display: none !important; position: absolute !important; width: 100% !important; max-height: 250px !important; overflow-y: auto !important; background: var(--sn-param-dropdown-bg) !important; border: 2px solid var(--sn-param-search-border) !important; border-radius: 4px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; z-index: 999 !important; margin-top: 2px !important; left: 0 !important; top: 100% !important; box-sizing: border-box !important;`;

      searchWrapper.appendChild(searchInput);
      searchWrapper.appendChild(clearButton);
      searchWrapper.appendChild(resultsDropdown);

      // CSS variables auto-adapt to theme changes - no JavaScript needed! ✨

      // Insert search wrapper before the select
      try {
        // Ensure parent has full width
        if (select.parentNode) {
          const parent = select.parentNode;
          parent.style.width = "100%";
          parent.style.maxWidth = "100%";
          parent.style.boxSizing = "border-box";
        }

        select.parentNode.insertBefore(searchWrapper, select);
        console.log(`SwaggerNav: Row ${index} - search input added`);
      } catch (error) {
        console.error(`SwaggerNav: Row ${index} - ERROR:`, error);
      }

      // Store original options
      const originalOptions = Array.from(select.options).map((opt) => ({
        value: opt.value,
        text: opt.text,
      }));

      // Store default selected value to restore on blur
      let defaultSelectedValue = select.value;
      let defaultSelectedText =
        select.options[select.selectedIndex]?.text || "";

      // Track selected item for keyboard navigation
      let selectedIndex = -1;

      // Function to update clear button visibility
      const updateClearButton = () => {
        if (searchInput.value.trim()) {
          clearButton.style.display = "block";
        } else {
          clearButton.style.display = "none";
        }
      };

      // Initialize search input with current selected value
      const currentSelectedOption = select.options[select.selectedIndex];
      if (currentSelectedOption) {
        searchInput.value = currentSelectedOption.text;
      }

      // Initialize clear button visibility
      updateClearButton();

      // Show dropdown when focused (never auto-clear)
      searchInput.addEventListener("focus", () => {
        updateClearButton(); // Update clear button visibility

        // Show all options (or filtered if there's text)
        const query = searchInput.value.toLowerCase().trim();
        if (!query) {
          showDropdownResults(originalOptions);
        } else {
          const filteredOptions = originalOptions.filter((opt) =>
            opt.text.toLowerCase().includes(query)
          );
          showDropdownResults(filteredOptions);
        }

        // Move cursor to end of text
        const len = searchInput.value.length;
        searchInput.setSelectionRange(len, len);
      });

      // On blur, just hide dropdown (keep current value)
      searchInput.addEventListener("blur", () => {
        setTimeout(() => {
          // If dropdown is not visible (user didn't select anything)
          if (
            resultsDropdown.style.display === "none" ||
            !searchWrapper.contains(document.activeElement)
          ) {
            // Just hide dropdown, don't change the value
            resultsDropdown.style.setProperty("display", "none", "important");
          }
        }, 200);
      });

      // Hide dropdown when clicking outside (keep current value)
      document.addEventListener("click", (e) => {
        if (!searchWrapper.contains(e.target)) {
          resultsDropdown.style.setProperty("display", "none", "important");
          // Don't restore default - keep whatever user typed/selected
        }
      });

      // Prevent dropdown from closing when clicking inside it
      resultsDropdown.addEventListener("mousedown", (e) => {
        e.preventDefault(); // Prevent blur
      });

      // Function to show dropdown with results
      function showDropdownResults(options) {
        resultsDropdown.innerHTML = "";
        // No need to update colors - CSS variables handle it! ✨

        if (options.length === 0) {
          const noResult = document.createElement("div");
          noResult.textContent = "No matches found";
          noResult.style.cssText = `padding: 10px 12px; color: var(--sn-param-no-result); font-size: 14px; text-align: center; font-style: italic;`;
          resultsDropdown.appendChild(noResult);
        } else {
          options.forEach((opt, idx) => {
            const resultItem = document.createElement("div");
            resultItem.textContent = opt.text;
            const computedStyle = `padding: 10px 12px !important; cursor: pointer !important; font-size: 14px !important; color: var(--sn-param-search-text) !important; background: var(--sn-param-dropdown-bg) !important; border-bottom: 1px solid var(--sn-param-item-border) !important; transition: background 0.15s !important;`;
            resultItem.style.cssText = computedStyle;

            resultItem.addEventListener("mouseenter", () => {
              resultItem.style.setProperty(
                "background",
                "var(--sn-param-item-hover)",
                "important"
              );
            });

            resultItem.addEventListener("mouseleave", () => {
              resultItem.style.setProperty(
                "background",
                "var(--sn-param-dropdown-bg)",
                "important"
              );
            });

            resultItem.addEventListener("click", () => {
              select.value = opt.value;
              searchInput.value = opt.text;
              resultsDropdown.style.setProperty("display", "none", "important");

              // Update default selected value (this becomes the new default)
              defaultSelectedValue = opt.value;
              defaultSelectedText = opt.text;

              updateClearButton(); // Update clear button visibility
              select.dispatchEvent(new Event("change", { bubbles: true }));
            });

            resultsDropdown.appendChild(resultItem);
          });
        }

        resultsDropdown.style.setProperty("display", "block", "important");
      }

      // Clear button functionality
      clearButton.addEventListener("mousedown", (e) => {
        e.preventDefault(); // Prevent blur
        e.stopPropagation(); // Prevent event bubbling
      });

      clearButton.addEventListener("mouseenter", () => {
        clearButton.style.background = "rgba(97, 175, 254, 0.1)";
        clearButton.style.color = "#61affe";
      });

      clearButton.addEventListener("mouseleave", () => {
        clearButton.style.background = "none";
        clearButton.style.color = "var(--sn-param-clear-btn)";
      });

      clearButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent event bubbling

        // Clear the input
        searchInput.value = "";

        updateClearButton(); // Update clear button visibility (should hide)

        // Show all options after clearing
        showDropdownResults(originalOptions);

        searchInput.focus();
      });

      // Filter options as user types
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        selectedIndex = -1; // Reset selection on new input
        updateClearButton(); // Update clear button visibility

        if (!query) {
          // Show all options when search is empty
          showDropdownResults(originalOptions);
          return;
        }

        // Filter options
        const filteredOptions = originalOptions.filter((opt) =>
          opt.text.toLowerCase().includes(query)
        );

        showDropdownResults(filteredOptions);
      });

      // Keyboard navigation
      searchInput.addEventListener("keydown", (e) => {
        const items = resultsDropdown.querySelectorAll(
          "div[style*='cursor: pointer']"
        );

        if (e.key === "ArrowDown") {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
          updateSelectedItem(items);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          updateSelectedItem(items);
        } else if (
          e.key === "Enter" &&
          selectedIndex >= 0 &&
          items[selectedIndex]
        ) {
          e.preventDefault();
          items[selectedIndex].click();
        } else if (e.key === "Escape") {
          resultsDropdown.style.setProperty("display", "none", "important");
        }
      });

      function updateSelectedItem(items) {
        items.forEach((item, idx) => {
          if (idx === selectedIndex) {
            item.style.background = "#e3f2fd";
            item.scrollIntoView({ block: "nearest" });
          } else {
            item.style.background = "white";
          }
        });
      }

      // When select changes, update search input
      select.addEventListener("change", () => {
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption) {
          searchInput.value = selectedOption.text;

          // Update default selected value
          defaultSelectedValue = selectedOption.value;
          defaultSelectedText = selectedOption.text;
        }
        updateClearButton(); // Update clear button visibility
        resultsDropdown.style.setProperty("display", "none", "important");
      });

      // Poll for select changes (Reset button doesn't trigger change event!)
      let lastSelectedValue = select.value;
      const selectPollInterval = setInterval(() => {
        if (select.value !== lastSelectedValue) {
          console.log(
            `SwaggerNav: Row ${index} - Select value changed (polling detected - likely Reset button)`
          );
          lastSelectedValue = select.value;
          const selectedOption = select.options[select.selectedIndex];
          if (selectedOption) {
            searchInput.value = selectedOption.text;
            defaultSelectedValue = selectedOption.value;
            defaultSelectedText = selectedOption.text;
            updateClearButton();
            resultsDropdown.style.setProperty("display", "none", "important");
          }
        }
      }, 200); // Check every 200ms

      // Store interval ID for cleanup if needed
      select._swaggerNavPollInterval = selectPollInterval;
    });
  }

  // ==============================================================================
  // Feature 2: Form Builder for Request Body
  // ==============================================================================

  addFormBuilder(opblock) {
    console.log("SwaggerNav: addFormBuilder called");

    // Find ALL textareas - look for textareas that look like JSON request bodies
    const allTextareas = opblock.querySelectorAll("textarea");
    console.log(
      `SwaggerNav: Found ${allTextareas.length} textareas in opblock`
    );

    let enhancedCount = 0;

    // Process EACH textarea that looks like a request body
    for (const textarea of allTextareas) {
      // Skip clones that we created
      if (textarea.dataset.swaggerNavClone === "true") {
        console.log("SwaggerNav: Skipping clone textarea");
        continue;
      }

      const content = textarea.value || textarea.textContent || "";
      // Check if it looks like JSON (starts with { or [)
      if (!content.trim().startsWith("{") && !content.trim().startsWith("[")) {
        continue; // Not JSON, skip this textarea
      }

      // ROBUST DUPLICATE CHECK: Verify if already enhanced
      if (textarea.dataset.swaggerNavFormBuilder === "true") {
        // Check if wrapper is hidden AND our container exists near it
        const textareaWrapper = textarea.parentNode;
        const hasHiddenWrapper =
          textareaWrapper && textareaWrapper.style.display === "none";

        // Look for our container - it should be the next sibling after the hidden wrapper
        let hasContainer = false;
        if (textareaWrapper && textareaWrapper.nextElementSibling) {
          hasContainer = textareaWrapper.nextElementSibling.classList.contains(
            "swagger-nav-body-container"
          );
        }

        if (hasHiddenWrapper && hasContainer) {
          // Truly enhanced - wrapper hidden and container exists
          console.log(
            `SwaggerNav: Textarea already enhanced (verified), skipping`
          );
          continue;
        } else {
          // Flag was set but container doesn't exist - reset
          console.log(
            `SwaggerNav: Textarea flag set but container missing (wrapper hidden: ${hasHiddenWrapper}, container: ${hasContainer}), resetting...`
          );
          textarea.dataset.swaggerNavFormBuilder = "";
        }
      }

      // Generate unique ID for this textarea if it doesn't have one
      if (!textarea.dataset.swaggerNavTextareaId) {
        textarea.dataset.swaggerNavTextareaId = `sn-textarea-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      }

      console.log(
        `SwaggerNav: Found JSON textarea ${
          enhancedCount + 1
        } to enhance! (ID: ${textarea.dataset.swaggerNavTextareaId})`
      );
      console.log(
        "SwaggerNav: Parent element:",
        textarea.parentNode?.tagName,
        textarea.parentNode?.className
      );

      // Mark textarea as enhanced IMMEDIATELY to prevent duplicates
      textarea.dataset.swaggerNavFormBuilder = "true";

      // Create form builder for this textarea
      this.createFormBuilderForTextarea(textarea, opblock);
      enhancedCount++;
    }

    if (enhancedCount === 0) {
      console.log("SwaggerNav: No JSON textareas found to enhance");
    } else {
      console.log(`SwaggerNav: Enhanced ${enhancedCount} textarea(s)`);
    }
  }

  createFormBuilderForTextarea(textarea, opblock) {
    const textareaId = textarea.dataset.swaggerNavTextareaId || "unknown";
    console.log(`SwaggerNav: Creating form builder for textarea ${textareaId}`);

    // Create container for side-by-side layout
    const container = document.createElement("div");
    container.className = "swagger-nav-body-container";
    container.dataset.textareaId = textareaId; // Link container to textarea
    console.log(`SwaggerNav: Created container for textarea ${textareaId}`);

    // Wrap existing textarea in left panel
    const leftPanel = document.createElement("div");
    leftPanel.className = "swagger-nav-body-panel swagger-nav-body-json";

    const jsonHeader = document.createElement("div");
    jsonHeader.className = "swagger-nav-body-header";
    jsonHeader.innerHTML = "<strong>📄 JSON</strong>";
    leftPanel.appendChild(jsonHeader);

    // Get reference to original textarea parent
    const textareaWrapper = textarea.parentNode;
    console.log("SwaggerNav: Textarea wrapper:", textareaWrapper);

    // IMPORTANT: Don't move the original textarea! Clone it instead
    // This preserves Swagger UI's original structure
    const textareaClone = textarea.cloneNode(true);

    // Mark the clone so we never try to enhance it
    textareaClone.dataset.swaggerNavClone = "true";
    textareaClone.classList.add("swagger-nav-textarea-clone");
    // Ensure clone has the same ID for tracking
    textareaClone.dataset.swaggerNavTextareaId = textareaId;

    // Sync changes from clone to original
    textareaClone.addEventListener("input", () => {
      textarea.value = textareaClone.value;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Sync changes from original to clone (in case Swagger UI updates it, like Reset button)
    textarea.addEventListener("input", () => {
      if (textareaClone.value !== textarea.value) {
        textareaClone.value = textarea.value;
        // Trigger input event on clone to rebuild form
        textareaClone.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    // Poll for value changes (Reset button doesn't trigger input event!)
    let lastTextareaValue = textarea.value;
    const textareaPollInterval = setInterval(() => {
      if (textarea.value !== lastTextareaValue) {
        console.log(
          "SwaggerNav: Textarea value changed (polling detected - likely Reset button)"
        );
        lastTextareaValue = textarea.value;
        textareaClone.value = textarea.value;
        // Trigger input event on clone to rebuild form
        textareaClone.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, 200); // Check every 200ms

    // Store interval ID for cleanup if needed
    container._textareaPollInterval = textareaPollInterval;

    // Add clone to left panel
    leftPanel.appendChild(textareaClone);

    // Create right panel for form
    const rightPanel = document.createElement("div");
    rightPanel.className = "swagger-nav-body-panel swagger-nav-body-form";

    const formHeader = document.createElement("div");
    formHeader.className = "swagger-nav-body-header";
    formHeader.innerHTML = "<strong>📝 Form View</strong>";
    rightPanel.appendChild(formHeader);

    const formContainer = document.createElement("div");
    formContainer.className = "swagger-nav-form-container";
    rightPanel.appendChild(formContainer);

    // Add panels to container
    // Always show both JSON and Form View together
    container.appendChild(leftPanel);
    container.appendChild(rightPanel);
    console.log(
      `SwaggerNav: Panels added to container for textarea ${textareaId}`
    );

    // Hide the original textarea wrapper (keep it in DOM!)
    textareaWrapper.style.display = "none";

    // Insert our container after the hidden wrapper
    textareaWrapper.after(container);
    console.log(
      `SwaggerNav: Inserted container for textarea ${textareaId} after wrapper (wrapper now hidden)`
    );

    // Build form from JSON (use the clone)
    this.buildFormFromJSON(textareaClone, formContainer);

    // Debug: Count total containers in this opblock
    const totalContainers = opblock.querySelectorAll(
      ".swagger-nav-body-container"
    ).length;
    console.log(
      `SwaggerNav: Total containers in this opblock: ${totalContainers}`
    );

    // Watch for textarea changes, but don't rebuild if form has focus
    let textareaUpdateTimeout;
    let isFormFocused = false;

    // Track when form inputs have focus
    formContainer.addEventListener("focusin", () => {
      isFormFocused = true;
      console.log("SwaggerNav: Form has focus, pausing textarea sync");
    });

    formContainer.addEventListener("focusout", () => {
      // Small delay to check if focus moved to another form input
      setTimeout(() => {
        if (!formContainer.contains(document.activeElement)) {
          isFormFocused = false;
          console.log("SwaggerNav: Form lost focus, resuming textarea sync");
        }
      }, 50);
    });

    textareaClone.addEventListener("input", () => {
      // Don't rebuild form if user is actively typing in it
      if (isFormFocused) {
        console.log(
          "SwaggerNav: Skipping form rebuild - user is typing in form"
        );
        return;
      }

      clearTimeout(textareaUpdateTimeout);
      textareaUpdateTimeout = setTimeout(() => {
        this.buildFormFromJSON(textareaClone, formContainer);
      }, 500);
    });
  }

  buildFormFromJSON(textarea, formContainer) {
    const isClone = textarea.dataset.swaggerNavClone === "true";
    const textareaId = textarea.dataset.swaggerNavTextareaId || "unknown";
    console.log(
      `SwaggerNav: buildFormFromJSON called for ${
        isClone ? "clone of " : ""
      }textarea ${textareaId}`
    );

    // Check if any input in the form currently has focus - if so, skip rebuild to prevent disrupting user input
    const focusedElement = document.activeElement;
    if (
      focusedElement &&
      formContainer.contains(focusedElement) &&
      (focusedElement.tagName === "INPUT" ||
        focusedElement.tagName === "TEXTAREA")
    ) {
      console.log(
        `SwaggerNav: Skipping form rebuild - user is typing in ${focusedElement.tagName}`
      );
      return;
    }

    try {
      const jsonValue = textarea.value.trim();
      if (!jsonValue) {
        formContainer.innerHTML =
          '<p class="swagger-nav-form-empty">Enter JSON to see form fields</p>';
        return;
      }

      const data = JSON.parse(jsonValue);
      formContainer.innerHTML = "";

      // Build form fields
      this.buildFormFields(data, formContainer, "", textarea);
      console.log(
        `SwaggerNav: Form built successfully for textarea ${textareaId}`
      );
    } catch (error) {
      formContainer.innerHTML =
        '<p class="swagger-nav-form-error">Invalid JSON</p>';
      console.log(
        `SwaggerNav: Form build error for textarea ${textareaId}:`,
        error
      );
    }
  }

  buildFormFields(data, container, path, textarea) {
    if (typeof data !== "object" || data === null) return;

    if (Array.isArray(data)) {
      // Handle empty arrays
      if (data.length === 0) {
        const emptyMsg = document.createElement("p");
        emptyMsg.className = "swagger-nav-form-empty";
        emptyMsg.textContent = "Empty array";
        container.appendChild(emptyMsg);
        return;
      }

      // Handle arrays
      data.forEach((item, index) => {
        const itemPath = path ? `${path}[${index}]` : `[${index}]`;

        // Check if array item is a primitive or object
        if (typeof item === "object" && item !== null) {
          // Object/Array in array - create fieldset
          const fieldset = document.createElement("div");
          fieldset.className = "swagger-nav-form-fieldset";

          const legend = document.createElement("div");
          legend.className = "swagger-nav-form-legend";
          legend.textContent = `Item ${index + 1}`;
          fieldset.appendChild(legend);

          this.buildFormFields(item, fieldset, itemPath, textarea);
          container.appendChild(fieldset);
        } else {
          // Primitive in array - create direct input field
          const field = document.createElement("div");
          field.className = "swagger-nav-form-field";

          const label = document.createElement("label");
          label.className = "swagger-nav-form-label";
          label.textContent = `Item ${index + 1}`;

          let input;
          if (typeof item === "boolean") {
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = item;
            input.className = "swagger-nav-form-checkbox";
          } else if (typeof item === "number") {
            input = document.createElement("input");
            input.type = "number";
            input.value = item;
            input.className = "swagger-nav-form-input";
            input.step = "any"; // Allow any decimal value
          } else {
            input = document.createElement("input");
            input.type = "text";
            input.value = item === null ? "" : String(item);
            input.className = "swagger-nav-form-input";
            if (item === null) {
              input.placeholder = "null";
              input.style.fontStyle = "italic";
              input.style.opacity = "0.7";
            }
          }

          // Update JSON when input changes
          input.addEventListener("input", () => {
            this.updateJSONFromForm(textarea, itemPath, input);
          });

          // On blur, ensure we update with final value (handles partial inputs like "-")
          if (input.type === "number") {
            input.addEventListener("blur", () => {
              // Force final update when user leaves the field
              if (
                input.value === "-" ||
                input.value === "." ||
                input.value === "-."
              ) {
                // Invalid partial input - reset to 0 or null
                input.value = "0";
              }
              this.updateJSONFromForm(textarea, itemPath, input);
            });
          }

          field.appendChild(label);
          field.appendChild(input);
          container.appendChild(field);
        }
      });
    } else {
      // Handle objects
      const keys = Object.keys(data);

      // Handle empty objects
      if (keys.length === 0) {
        const emptyMsg = document.createElement("p");
        emptyMsg.className = "swagger-nav-form-empty";
        emptyMsg.textContent = "Empty object";
        container.appendChild(emptyMsg);
        return;
      }

      keys.forEach((key) => {
        const value = data[key];
        const fieldPath = path ? `${path}.${key}` : key;

        if (value !== null && typeof value === "object") {
          // Nested object or array
          const fieldset = document.createElement("div");
          fieldset.className = "swagger-nav-form-fieldset";

          const legend = document.createElement("div");
          legend.className = "swagger-nav-form-legend";

          // Show array indicator and add special class
          if (Array.isArray(value)) {
            fieldset.classList.add("swagger-nav-form-array");
            legend.innerHTML = `📋 ${key} <span style="font-size: 10px; opacity: 0.7;">(Array with ${
              value.length
            } item${value.length !== 1 ? "s" : ""})</span>`;
          } else {
            legend.textContent = key;
          }
          fieldset.appendChild(legend);

          this.buildFormFields(value, fieldset, fieldPath, textarea);
          container.appendChild(fieldset);
        } else {
          // Primitive value - create input
          const field = document.createElement("div");
          field.className = "swagger-nav-form-field";

          const label = document.createElement("label");
          label.className = "swagger-nav-form-label";
          label.textContent = key;

          let input;
          if (typeof value === "boolean") {
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = value;
            input.className = "swagger-nav-form-checkbox";
          } else if (typeof value === "number") {
            input = document.createElement("input");
            input.type = "number";
            input.value = value;
            input.className = "swagger-nav-form-input";
            input.step = "any"; // Allow any decimal value
          } else {
            input = document.createElement("input");
            input.type = "text";
            input.value = value === null ? "" : String(value);
            input.className = "swagger-nav-form-input";
            if (value === null) {
              input.placeholder = "null";
              input.style.fontStyle = "italic";
              input.style.opacity = "0.7";
            }
          }

          // Update JSON when input changes
          input.addEventListener("input", (e) => {
            this.updateJSONFromForm(textarea, fieldPath, input);
          });

          // On blur, ensure we update with final value (handles partial inputs like "-")
          if (input.type === "number") {
            input.addEventListener("blur", () => {
              // Force final update when user leaves the field
              if (
                input.value === "-" ||
                input.value === "." ||
                input.value === "-."
              ) {
                // Invalid partial input - reset to 0 or null
                input.value = "0";
              }
              this.updateJSONFromForm(textarea, fieldPath, input);
            });
          }

          field.appendChild(label);
          field.appendChild(input);
          container.appendChild(field);
        }
      });
    }
  }

  updateJSONFromForm(textarea, path, input) {
    try {
      const data = JSON.parse(textarea.value);

      // Get value from input
      let value;
      if (input.type === "checkbox") {
        value = input.checked;
      } else if (input.type === "number") {
        // Handle empty number inputs
        if (input.value === "" || input.value === null) {
          value = null;
        } else {
          const inputValue = input.value.trim();

          // Allow partial number inputs during typing (e.g., "-", ".", "0.", "-0")
          // Don't convert these to 0 or null, just skip the update
          if (
            inputValue === "-" ||
            inputValue === "." ||
            inputValue === "-." ||
            inputValue.endsWith(".")
          ) {
            console.log(
              `SwaggerNav: Allowing partial number input "${inputValue}" during typing`
            );
            return; // Skip update, let user finish typing
          }

          const parsed = parseFloat(inputValue);
          if (isNaN(parsed)) {
            console.warn(
              `SwaggerNav: Invalid number "${inputValue}", defaulting to 0`
            );
            value = 0;
          } else {
            value = parsed;
          }
        }
      } else {
        // Handle text inputs - check for special values
        if (input.value === "" && input.placeholder === "null") {
          // Empty input that was originally null -> keep as null
          value = null;
        } else if (input.value.toLowerCase() === "null") {
          // User typed "null" -> convert to actual null
          value = null;
        } else {
          value = input.value;
        }
      }

      // Update nested value
      this.setNestedValue(data, path, value);

      // Update textarea
      textarea.value = JSON.stringify(data, null, 2);
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (error) {
      console.error("SwaggerNav: Failed to update JSON from form", error);
    }
  }

  setNestedValue(obj, path, value) {
    const parts = path.split(/\.|\[|\]/).filter(Boolean);
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        // Determine if next part is array index or object key
        const nextPart = parts[i + 1];
        current[part] = /^\d+$/.test(nextPart) ? [] : {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }
}

// Initialize the extension
const swaggerNav = new SwaggerNavigator();

// Theme will be applied after Swagger UI detection in init()
swaggerNav.init();

// Listen for messages from options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RELOAD_BACKGROUND") {
    console.log(
      "SwaggerNav: Received RELOAD_BACKGROUND message, reloading background..."
    );
    swaggerNav.applyNavBarBackground();
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});
