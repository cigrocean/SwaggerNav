// SwaggerNav - Content Script
// Detects Swagger UI and adds navigation sidebar

// VERSION is loaded from version.js
// Utility modules are loaded before this file:
// - modules/utils/swagger-detection.js (provides isSwaggerUIPageEarly, checkIsSwaggerUIPage)
// - modules/utils/logging.js (provides swaggerNavLog, swaggerNavError, swaggerNavWarn)
// - modules/utils/loading-overlay.js (creates loading overlay automatically)

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
    this.errorPopup = null; // Network error popup
    this.isOffline = false; // Track offline status
    this.healthCheckInterval = null; // Health check interval ID
    this.lastHealthCheckSuccess = true; // Track last health check result
    // Don't setup network error detection here - will be called in setup() after Swagger UI is detected
  }

  // Create SVG icon helper function
  createIcon(iconName, size = 16) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.style.display = "inline-block";
    svg.style.verticalAlign = "middle";

    const icons = {
      clipboard: `<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>`,
      pin: `<path d="M12 17v5"></path><path d="M9 10.76a2 2 0 0 1 .41-2.89L12 4l2.59 3.87a2 2 0 0 1 .41 2.89L12 17l-3-6.24z"></path>`,
      refresh: `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path>`,
      settings: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>`,
      arrowUp: `<path d="m18 15-6-6-6 6"></path>`,
      arrowRight: `<path d="m9 18 6-6-6-6"></path>`,
      arrowLeft: `<path d="m15 18-6-6 6-6"></path>`,
      moon: `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`,
      sun: `<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>`,
      tag: `<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l10-10a1 1 0 0 0 0-1.41L12 2Z"></path><circle cx="7" cy="7" r="1.5"></circle>`,
      x: `<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>`,
      check: `<path d="M20 6 9 17l-5-5"></path>`,
      chevronDown: `<path d="m6 9 6 6 6-6"></path>`,
      chevronUp: `<path d="m18 15-6-6-6 6"></path>`,
    };

    if (icons[iconName]) {
      svg.innerHTML = icons[iconName];
    }

    return svg;
  }

  // Check if extension context is still valid
  isExtensionContextValid() {
    try {
      // Check if chrome.runtime exists and has a valid ID
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (error) {
      return false;
    }
  }

  // Load pinned endpoints from localStorage
  loadPinnedEndpoints() {
    try {
      const stored = localStorage.getItem("swagger-nav-pinned");
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      swaggerNavError("SwaggerNav: Error loading pinned endpoints", error);
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
      swaggerNavError("SwaggerNav: Error saving pinned endpoints", error);
    }
  }

  // Load sidebar state from localStorage
  loadSidebarState() {
    try {
      const stored = localStorage.getItem("swagger-nav-sidebar-hidden");
      return stored === "true"; // Returns true if hidden, false otherwise
    } catch (error) {
      swaggerNavError("SwaggerNav: Error loading sidebar state", error);
      return false; // Default to visible
    }
  }

  // Save sidebar state to localStorage
  saveSidebarState(isHidden) {
    try {
      localStorage.setItem("swagger-nav-sidebar-hidden", isHidden.toString());
    } catch (error) {
      swaggerNavError("SwaggerNav: Error saving sidebar state", error);
    }
  }

  // Load search history from localStorage
  loadSearchHistory() {
    try {
      const stored = localStorage.getItem("swagger-nav-search-history");
      const history = stored ? JSON.parse(stored) : [];
      swaggerNavLog(
        `SwaggerNav: Loaded ${history.length} items from search history:`,
        history
      );
      return history;
    } catch (error) {
      swaggerNavError("SwaggerNav: Error loading search history", error);
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
      swaggerNavError("SwaggerNav: Error saving search history", error);
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
    swaggerNavLog(
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
    swaggerNavLog(
      `SwaggerNav: Removed "${query}" from search history. Remaining: ${this.searchHistory.length} items`
    );
  }

  // Clear all search history
  clearSearchHistory() {
    const count = this.searchHistory.length;
    this.searchHistory = [];
    this.saveSearchHistory();
    swaggerNavLog(
      `SwaggerNav: Cleared all search history (${count} items removed)`
    );
  }

  // Load settings from chrome.storage (async, but we'll use defaults initially)
  loadSettings() {
    // Return defaults immediately (will be updated async)
    const defaults = {
      autoExpand: true,
      autoTryOut: true,
      swaggerUITheme: "auto", // "light", "dark", or "auto"
      extensionTheme: "auto", // "light", "dark", or "auto"
      background: "default", // "default", "ocean", "tet", "christmas", "too_many_bugs"
      enableFormView: true,
      enableParamSearch: true,
      enableResponseView: true,
      liquidGlass: false, // iOS 26-style liquid glass effect
    };

    // Load from chrome.storage asynchronously
    chrome.storage.sync.get(defaults, (result) => {
      // Backward compatibility: migrate old "theme" setting to both new settings
      if (result.theme && !result.swaggerUITheme && !result.extensionTheme) {
        result.swaggerUITheme = result.theme;
        result.extensionTheme = result.theme;
        // Save migrated settings
        chrome.storage.sync.set(
          {
            swaggerUITheme: result.theme,
            extensionTheme: result.theme,
          },
          () => {
            swaggerNavLog(
              "SwaggerNav: Migrated theme setting to swaggerUITheme and extensionTheme"
            );
          }
        );
      }

      this.settings = result;
      swaggerNavLog(
        "SwaggerNav: Settings loaded from chrome.storage",
        this.settings
      );

      // Re-detect theme before applying (in case OS theme changed or detection was incorrect)
      const newTheme = this.detectTheme();
      if (newTheme !== this.theme) {
        this.theme = newTheme;
        swaggerNavLog(
          `SwaggerNav: Theme re-detected as ${this.theme} mode when settings loaded`
        );
      }

      // Re-apply themes and background now that settings are loaded
      // Only apply on Swagger UI pages
      if (checkIsSwaggerUIPage()) {
        this.applySwaggerUITheme();
        this.applyNavBarTheme();
        // Apply liquid glass effect if enabled
        this.applyLiquidGlass();
      }

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
        swaggerNavLog(
          "SwaggerNav: Settings saved to chrome.storage",
          this.settings
        );
      });
    } catch (error) {
      swaggerNavError("SwaggerNav: Error saving settings", error);
    }
  }

  // Update settings UI when settings change (no longer needed - settings moved to options page)
  updateSettingsUI() {
    // Settings UI is now in the options page, not in a modal
    // This function kept for backward compatibility but does nothing
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

    swaggerNavLog(
      `SwaggerNav: Saved scroll: ${savedScrollTop}px, search: "${currentSearchQuery}", expanded sections:`,
      expandedSections
    );

    if (index >= 0) {
      // Unpin
      this.pinnedEndpoints.splice(index, 1);
      swaggerNavLog(`SwaggerNav: Unpinned ${method} ${path}`);
    } else {
      // Pin
      this.pinnedEndpoints.push({ method, path, endpointId, tag });
      swaggerNavLog(`SwaggerNav: Pinned ${method} ${path} from ${tag}`);
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
            if (toggle) {
              toggle.innerHTML = "";
              toggle.appendChild(this.createIcon("chevronUp", 12));
            }
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
          swaggerNavLog(
            `SwaggerNav: Restored search query: "${currentSearchQuery}"`
          );
        }

        // Restore scroll position
        if (newContentArea) {
          newContentArea.scrollTop = savedScrollTop;
          swaggerNavLog(
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
    swaggerNavLog(`SwaggerNav: Unpinned all ${count} endpoints`);
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
      // Listen to both dark and light mode changes for better responsiveness
      const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const lightModeQuery = window.matchMedia("(prefers-color-scheme: light)");

      const handleThemeChange = (isDark) => {
        // Only apply theme changes on Swagger UI pages
        if (!checkIsSwaggerUIPage()) {
          return;
        }

        this.theme = isDark ? "dark" : "light";
        swaggerNavLog(`SwaggerNav: OS theme changed to ${this.theme} mode`);
        this.updateThemeIndicator();

        // Only apply if theme is set to "auto"
        const swaggerUITheme =
          this.settings.swaggerUITheme || this.settings.theme || "auto";
        const extensionTheme =
          this.settings.extensionTheme || this.settings.theme || "auto";

        if (swaggerUITheme === "auto") {
          // Apply theme to Swagger UI and sidebar immediately
          this.applySwaggerUITheme();
          this.applySwaggerTheme();
        }

        if (extensionTheme === "auto") {
          this.applyNavBarTheme();
        }

        // Force CSS recalculation by triggering a reflow
        void document.body.offsetHeight;
      };

      darkModeQuery.addEventListener("change", (e) => {
        handleThemeChange(e.matches);
      });

      lightModeQuery.addEventListener("change", (e) => {
        handleThemeChange(!e.matches);
      });
    }
  }

  // Listen for settings changes from options page
  setupStorageListener() {
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "sync") {
          // Only apply theme changes on Swagger UI pages
          if (!checkIsSwaggerUIPage()) {
            // Still update local settings, but don't apply themes
            for (const [key, { newValue }] of Object.entries(changes)) {
              this.settings[key] = newValue;
            }
            return;
          }

          swaggerNavLog("SwaggerNav: Settings changed", changes);

          // Update local settings
          for (const [key, { newValue }] of Object.entries(changes)) {
            this.settings[key] = newValue;
          }

          // React to theme changes - apply immediately
          if (changes.swaggerUITheme) {
            swaggerNavLog(
              `SwaggerNav: Swagger UI theme changed to ${changes.swaggerUITheme.newValue}`
            );
            // Apply new Swagger UI theme immediately using requestAnimationFrame for instant update
            requestAnimationFrame(() => {
              this.applySwaggerUITheme();
              this.applySwaggerTheme();
              // Extension features and backgrounds follow Swagger UI theme, so update them too
              this.applyNavBarTheme();
              this.applyNavBarBackground();
              // Force CSS recalculation by triggering a reflow
              void document.body.offsetHeight;
            });
          }
          if (changes.extensionTheme) {
            swaggerNavLog(
              `SwaggerNav: Extension theme changed to ${changes.extensionTheme.newValue}`
            );
            // Apply new extension theme (affects sidebar only) immediately
            requestAnimationFrame(() => {
              this.applyNavBarTheme();
              // Force CSS recalculation by triggering a reflow
              void document.body.offsetHeight;
            });
          }
          // Backward compatibility: handle old "theme" setting
          if (
            changes.theme &&
            !changes.swaggerUITheme &&
            !changes.extensionTheme
          ) {
            swaggerNavLog(
              `SwaggerNav: Theme changed to ${changes.theme.newValue} (migrating to separate themes)`
            );
            // Apply to both immediately
            requestAnimationFrame(() => {
              this.applySwaggerUITheme();
              this.applySwaggerTheme();
              this.applyNavBarTheme();
              this.applyNavBarBackground();
              // Force CSS recalculation
              void document.body.offsetHeight;
            });
          }

          // React to background changes
          if (changes.background) {
            swaggerNavLog(
              `SwaggerNav: Background changed from ${changes.background.oldValue} to ${changes.background.newValue}`
            );
            // Apply new background immediately
            requestAnimationFrame(() => {
              this.applyNavBarBackground();

              // If switching to default, restore Swagger UI theme properly
              if (changes.background.newValue === "default") {
                swaggerNavLog(
                  "SwaggerNav: Background set to default, restoring Swagger UI theme"
                );
                // Remove any theme classes and styles to restore default appearance
                this.applySwaggerUITheme();
                this.applySwaggerTheme();
                this.applyNavBarTheme();
              } else {
                // Switching FROM default TO a custom background - ensure styles are applied
                if (changes.background.oldValue === "default") {
                  swaggerNavLog(
                    "SwaggerNav: Switching from default to custom background, applying theme styles"
                  );
                  // Force re-apply all themes to ensure styles are applied
                  this.applySwaggerUITheme();
                  this.applySwaggerTheme();
                  this.applyNavBarTheme();
                }
              }

              // Force CSS recalculation
              void document.body.offsetHeight;
            });
          }

          // React to liquid glass changes
          if (changes.liquidGlass) {
            swaggerNavLog(
              `SwaggerNav: Liquid Glass ${
                changes.liquidGlass.newValue ? "enabled" : "disabled"
              }`
            );
            // Apply or remove liquid glass effect immediately
            requestAnimationFrame(() => {
              this.applyLiquidGlass();
              // Also update theme classes since liquid glass CSS requires theme classes on body
              this.applySwaggerUITheme();
              this.applyNavBarTheme();
              // Force CSS recalculation
              void document.body.offsetHeight;
            });
          }

          // React to Response View toggle changes
          if (changes.enableResponseView !== undefined) {
            swaggerNavLog(
              `SwaggerNav: Response View ${
                changes.enableResponseView.newValue ? "enabled" : "disabled"
              }`
            );
            // Update Response View immediately
            requestAnimationFrame(() => {
              if (changes.enableResponseView.newValue) {
                // Re-enhance all opblocks to add Response View
                this.enhanceParameters();
              } else {
                // Hide Response View and show original Swagger UI response
                // Use a simpler selector to find all Response View containers
                const allResponseContainers = document.querySelectorAll(
                  ".swagger-nav-response-container"
                );
                swaggerNavLog(
                  `SwaggerNav: Found ${allResponseContainers.length} Response View containers to hide`
                );

                allResponseContainers.forEach((container) => {
                  // Hide our Response View container
                  container.style.display = "none";
                  swaggerNavLog("SwaggerNav: Hid Response View container");

                  // Find and show the hidden original wrapper
                  const parent = container.parentElement;
                  if (parent) {
                    // Look for hidden original wrapper - check siblings first
                    const hiddenOriginal =
                      Array.from(parent.children).find(
                        (child) =>
                          child !== container &&
                          child.dataset.swaggerNavHiddenOriginal === "true"
                      ) ||
                      parent.querySelector(
                        "[data-swagger-nav-hidden-original='true']"
                      );

                    if (hiddenOriginal) {
                      // Show the wrapper
                      hiddenOriginal.style.display = "";

                      // CRITICAL: Ensure buttons inside the wrapper are visible
                      // Swagger UI buttons might have been hidden or moved
                      const buttonsInWrapper = hiddenOriginal.querySelectorAll(
                        ".copy-to-clipboard, .download-contents, .btn-download"
                      );
                      buttonsInWrapper.forEach((btn) => {
                        btn.style.display = "";
                        btn.style.visibility = "visible";
                        swaggerNavLog(
                          "SwaggerNav: Made button visible in restored wrapper",
                          btn
                        );
                      });

                      // Also check for buttons that might have been moved to parent
                      const buttonsInParent = parent.querySelectorAll(
                        ".copy-to-clipboard, .download-contents, .btn-download"
                      );
                      buttonsInParent.forEach((btn) => {
                        // Only show buttons that are siblings of the wrapper (not inside Response View container)
                        if (btn.parentElement === parent && btn !== container) {
                          btn.style.display = "";
                          btn.style.visibility = "visible";
                          swaggerNavLog(
                            "SwaggerNav: Made button visible in parent",
                            btn
                          );
                        }
                      });

                      swaggerNavLog(
                        "SwaggerNav: Restored original Swagger UI response and buttons"
                      );
                    } else {
                      swaggerNavWarn(
                        "SwaggerNav: Could not find hidden original wrapper to restore"
                      );
                    }
                  }
                });

                // DON'T clear the dataset flags - keep them so we know Response View was added
                // This prevents enhanceParameters() from trying to add it again
                // The flags will be checked in addResponseView() to see if container already exists
              }

              // Re-apply responsive constraints after Response View changes
              this.applyResponsiveConstraints();

              // Force CSS recalculation
              void document.body.offsetHeight;
            });
          }

          // Handle JSON View and Form View toggle changes
          if (changes.enableFormView !== undefined) {
            swaggerNavLog(
              `SwaggerNav: Form View ${
                changes.enableFormView.newValue ? "enabled" : "disabled"
              }`
            );
            // Update Form View immediately
            requestAnimationFrame(() => {
              if (changes.enableFormView.newValue) {
                // Show all Form View containers and hide original textareas
                const allContainers = document.querySelectorAll(
                  ".swagger-nav-body-container"
                );
                swaggerNavLog(
                  `SwaggerNav: Found ${allContainers.length} Form View containers to show`
                );

                allContainers.forEach((container) => {
                  // Show our container
                  container.style.display = "grid";
                  swaggerNavLog("SwaggerNav: Showed Form View container");

                  // Hide the original textarea wrapper
                  const wrapper = container.previousElementSibling;
                  if (wrapper && wrapper.style.display !== "none") {
                    wrapper.style.display = "none";
                    swaggerNavLog("SwaggerNav: Hid original textarea wrapper");
                  }
                });

                // Also re-enhance to add Form View to any new textareas
                this.enhanceParameters();
              } else {
                // Hide Form View containers and show original textareas
                const allContainers = document.querySelectorAll(
                  ".swagger-nav-body-container"
                );
                swaggerNavLog(
                  `SwaggerNav: Found ${allContainers.length} Form View containers to hide`
                );

                allContainers.forEach((container) => {
                  // Hide our container
                  container.style.display = "none";
                  swaggerNavLog("SwaggerNav: Hid Form View container");

                  // Find and show the hidden original textarea wrapper
                  const textareaId = container.dataset.textareaId;
                  if (textareaId) {
                    // Find the original textarea by searching all opblocks
                    const allOpblocks = document.querySelectorAll(".opblock");
                    for (const opblock of allOpblocks) {
                      const originalTextarea = opblock.querySelector(
                        `textarea[data-swagger-nav-textarea-id="${textareaId}"]`
                      );
                      if (originalTextarea) {
                        const textareaWrapper = originalTextarea.parentNode;
                        if (
                          textareaWrapper &&
                          textareaWrapper.style.display === "none"
                        ) {
                          textareaWrapper.style.display = "";
                          swaggerNavLog(
                            "SwaggerNav: Restored original textarea wrapper"
                          );
                        }
                        break;
                      }
                    }
                  }
                });

                // Re-apply responsive constraints after Form View changes
                this.applyResponsiveConstraints();
                void document.body.offsetHeight;
              }
            });
          }

          // Handle Parameter Search toggle changes
          if (changes.enableParamSearch !== undefined) {
            swaggerNavLog(
              `SwaggerNav: Parameter Search ${
                changes.enableParamSearch.newValue ? "enabled" : "disabled"
              }`
            );
            // Update Parameter Search immediately
            requestAnimationFrame(() => {
              if (changes.enableParamSearch.newValue) {
                // Show all parameter search boxes and hide original selects
                const allSearchInputs = document.querySelectorAll(
                  ".swagger-nav-select-search"
                );
                swaggerNavLog(
                  `SwaggerNav: Found ${allSearchInputs.length} parameter search boxes to show`
                );

                allSearchInputs.forEach((searchInput) => {
                  // Find the search wrapper (parent of searchInput)
                  const searchWrapper = searchInput.parentElement;
                  if (searchWrapper) {
                    searchWrapper.style.display = "block";
                    swaggerNavLog(
                      "SwaggerNav: Showed parameter search wrapper"
                    );
                  }

                  // Find the original select (sibling of searchWrapper)
                  const select = searchWrapper?.nextElementSibling;
                  if (
                    select &&
                    select.tagName === "SELECT" &&
                    select.dataset.swaggerNavSearchable === "true"
                  ) {
                    select.style.display = "none";
                    swaggerNavLog("SwaggerNav: Hid original select");
                  }
                });

                // Also re-enhance to add Parameter Search to any new selects
                this.enhanceParameters();
              } else {
                // Hide parameter search boxes and show original selects
                const allSearchInputs = document.querySelectorAll(
                  ".swagger-nav-select-search"
                );
                swaggerNavLog(
                  `SwaggerNav: Found ${allSearchInputs.length} parameter search boxes to hide`
                );

                allSearchInputs.forEach((searchInput) => {
                  // Find the search wrapper (parent of searchInput)
                  const searchWrapper = searchInput.parentElement;
                  if (searchWrapper) {
                    searchWrapper.style.display = "none";
                    swaggerNavLog("SwaggerNav: Hid parameter search wrapper");
                  }

                  // Find the original select (sibling of searchWrapper)
                  const select = searchWrapper?.nextElementSibling;
                  if (
                    select &&
                    select.tagName === "SELECT" &&
                    select.dataset.swaggerNavSearchable === "true"
                  ) {
                    select.style.display = "";
                    swaggerNavLog("SwaggerNav: Showed original select");
                  }
                });
              }
            });
          }

          // Update settings UI
          this.updateSettingsUI();
        }
      });
    }
  }

  // Apply theme to Swagger UI main page (body classes for Swagger UI styling)
  applySwaggerUITheme() {
    // CRITICAL: Only apply theme on Swagger UI pages
    if (!checkIsSwaggerUIPage()) {
      return;
    }

    const swaggerUITheme =
      this.settings.swaggerUITheme || this.settings.theme || "auto";
    const backgroundTheme = this.settings.background || "default";
    const liquidGlassEnabled = this.settings.liquidGlass || false;

    // Only modify Swagger UI styling if custom background or liquid glass is enabled
    // Otherwise, preserve original Swagger UI appearance
    // NOTE: If liquid glass is enabled, we need theme classes on body for liquid glass CSS to work
    const shouldModifySwaggerUI =
      backgroundTheme !== "default" || liquidGlassEnabled;

    // Remove Swagger UI theme classes from body
    document.body.classList.remove(
      "swagger-nav-force-light",
      "swagger-nav-force-dark"
    );

    if (swaggerUITheme === "light") {
      // Only add force classes to body if we should modify Swagger UI
      if (shouldModifySwaggerUI) {
        document.body.classList.add("swagger-nav-force-light");
      }
    } else if (swaggerUITheme === "dark") {
      // Only add force classes to body if we should modify Swagger UI
      if (shouldModifySwaggerUI) {
        document.body.classList.add("swagger-nav-force-dark");
      }
    } else {
      // Auto mode - follow OS theme
      // Only add theme class to body if we should modify Swagger UI
      if (shouldModifySwaggerUI) {
        if (this.theme === "dark") {
          document.body.classList.add("swagger-nav-force-dark");
        } else {
          document.body.classList.add("swagger-nav-force-light");
        }
      }
    }
  }

  // Apply theme to extension (sidebar and extension features like JSON/Form View, param search)
  applyNavBarTheme() {
    // CRITICAL: Only apply theme on Swagger UI pages
    if (!checkIsSwaggerUIPage()) {
      return;
    }

    const extensionTheme =
      this.settings.extensionTheme || this.settings.theme || "auto";
    const swaggerUITheme =
      this.settings.swaggerUITheme || this.settings.theme || "auto";
    const backgroundTheme = this.settings.background || "default";
    const liquidGlassEnabled = this.settings.liquidGlass || false;

    // Remove extension theme classes from body first (for extension features like JSON/Form View, param search)
    document.body.classList.remove("swagger-nav-light", "swagger-nav-dark");

    // Extension features (JSON View, Form View, param search) ALWAYS follow Swagger UI theme, not extension theme
    // This ensures they match the main Swagger UI page appearance
    // Only add theme classes if we need to style extension features (when background is not default or liquid glass is enabled)
    // OR if Swagger UI theme is explicitly set (not auto)
    const needsExtensionFeatureStyling =
      backgroundTheme !== "default" ||
      liquidGlassEnabled ||
      swaggerUITheme !== "auto";

    if (needsExtensionFeatureStyling) {
      if (swaggerUITheme === "light") {
        document.body.classList.add("swagger-nav-light");
        swaggerNavLog(
          "SwaggerNav: Applied light theme to extension features (following Swagger UI light)"
        );
      } else if (swaggerUITheme === "dark") {
        document.body.classList.add("swagger-nav-dark");
        swaggerNavLog(
          "SwaggerNav: Applied dark theme to extension features (following Swagger UI dark)"
        );
      } else {
        // Swagger UI in auto mode - follow system theme
        if (this.theme === "dark") {
          document.body.classList.add("swagger-nav-dark");
          swaggerNavLog(
            "SwaggerNav: Applied dark theme to extension features (Swagger UI auto, system is dark)"
          );
        } else {
          document.body.classList.add("swagger-nav-light");
          swaggerNavLog(
            "SwaggerNav: Applied light theme to extension features (Swagger UI auto, system is light)"
          );
        }
      }
    } else {
      swaggerNavLog(
        "SwaggerNav: No extension feature styling needed (Swagger UI default, no background, no liquid glass)"
      );
    }

    // Apply theme to sidebar if it exists
    if (this.navBar) {
      // Remove all theme classes from sidebar
      this.navBar.classList.remove("swagger-nav-dark", "swagger-nav-light");

      if (extensionTheme === "light") {
        this.navBar.classList.add("swagger-nav-light");
      } else if (extensionTheme === "dark") {
        this.navBar.classList.add("swagger-nav-dark");
      } else {
        // Auto mode - follow OS theme
        if (this.theme === "dark") {
          this.navBar.classList.add("swagger-nav-dark");
        } else {
          this.navBar.classList.add("swagger-nav-light");
        }
      }
    }

    // Apply background after theme
    this.applyNavBarBackground();
  }

  // Apply background to Swagger UI page (body element)
  async applyNavBarBackground() {
    // CRITICAL: Only apply background on Swagger UI pages
    if (!checkIsSwaggerUIPage()) {
      return;
    }

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
      swaggerNavLog("SwaggerNav: Removed existing background blur/tint style");
    }

    // If default, ensure all background-related styles are cleaned up
    if (backgroundTheme === "default") {
      // Remove any remaining background-related inline styles
      document.body.style.backgroundColor = "";
      document.body.style.background = "";
      // Ensure body background is reset
      if (document.body.style.backgroundImage === "") {
        document.body.style.backgroundImage = null;
      }
      swaggerNavLog(
        "SwaggerNav: Background set to default, cleaned up all background styles"
      );
      return;
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

        // Determine which theme version to use (light or dark) - use Swagger UI theme for backgrounds
        const swaggerUITheme =
          this.settings.swaggerUITheme || this.settings.theme || "auto";
        let isDark = false;
        if (swaggerUITheme === "dark") {
          isDark = true;
        } else if (swaggerUITheme === "light") {
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

        swaggerNavLog(
          `SwaggerNav: Applied background ${bgClass} (${themeVariant}) to Swagger UI page with tint`
        );
      }
    } else {
      swaggerNavLog(
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
        swaggerNavLog(
          "SwaggerNav: No custom background found, falling back to default"
        );
        // Fall back to default if no custom background exists
        this.settings.background = "default";
        await chrome.storage.sync.set({ background: "default" });
        return;
      }

      // Apply custom background class
      document.body.classList.add("swagger-nav-bg-custom");

      // Determine theme - use Swagger UI theme for backgrounds
      const swaggerUITheme =
        this.settings.swaggerUITheme || this.settings.theme || "auto";
      let isDark = false;
      if (swaggerUITheme === "dark") {
        isDark = true;
      } else if (swaggerUITheme === "light") {
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

      swaggerNavLog("SwaggerNav: Applied custom background with tint");

      // Re-apply Swagger theme
      this.applySwaggerTheme();
    } catch (error) {
      swaggerNavError("SwaggerNav: Error applying custom background", error);
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
      swaggerNavLog("SwaggerNav: Removed Swagger UI theme override");
    }
  }

  // Update theme indicator in UI
  updateThemeIndicator() {
    if (this.navBar) {
      const indicator = this.navBar.querySelector(
        ".swagger-nav-theme-indicator"
      );
      if (indicator) {
        indicator.innerHTML = "";
        indicator.appendChild(
          this.createIcon(this.theme === "dark" ? "moon" : "sun", 14)
        );
        indicator.title = `${
          this.theme === "dark" ? "Dark" : "Light"
        } mode (follows OS)`;
      }
    }
  }

  // Apply theme to Swagger UI page (Proper Dark Mode)
  applySwaggerTheme() {
    // CRITICAL: Only apply theme on Swagger UI pages
    if (!checkIsSwaggerUIPage()) {
      return;
    }

    // Remove existing style if any
    const existingStyle = document.getElementById("swagger-nav-theme-style");
    if (existingStyle) {
      existingStyle.remove();
    }

    const themeMode =
      this.settings.swaggerUITheme || this.settings.theme || "auto";

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

    swaggerNavLog(
      `SwaggerNav: Applying Swagger UI theme (${
        isDark ? "dark" : "light"
      }) with hasCustomBackground: ${hasCustomBackground}`
    );

    // For light mode, only inject CSS if there's a custom background (to make it transparent)
    // Always remove existing styles first to ensure clean state
    const existingStyleCheck = document.getElementById(
      "swagger-nav-theme-style"
    );
    if (!isDark && !hasCustomBackground) {
      // Remove any existing theme styles for light mode without custom background
      if (existingStyleCheck) {
        existingStyleCheck.remove();
      }
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
    swaggerNavLog(
      `SwaggerNav: Applied ${isDark ? "dark" : "light"} theme to Swagger UI`
    );
  }

  // Remove theme styling from Swagger UI
  removeSwaggerTheme() {
    const existingStyle = document.getElementById("swagger-nav-theme-style");
    if (existingStyle) {
      existingStyle.remove();
      swaggerNavLog("SwaggerNav: Removed theme styling from Swagger UI");
    }
  }

  // Apply or remove Liquid Glass effect
  applyLiquidGlass() {
    // Only apply on Swagger UI pages
    if (!checkIsSwaggerUIPage()) {
      return;
    }

    const liquidGlassEnabled = this.settings.liquidGlass || false;

    if (liquidGlassEnabled) {
      // Add liquid glass class to body - keeps existing background underneath
      document.body.classList.add("swagger-nav-liquid-glass");
      swaggerNavLog(
        "SwaggerNav: Liquid Glass effect enabled on top of existing background"
      );
    } else {
      // Remove liquid glass class from body
      document.body.classList.remove("swagger-nav-liquid-glass");
      swaggerNavLog("SwaggerNav: Liquid Glass effect disabled");
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

  // Hide loading overlay - only if SwaggerNav sidebar is rendered
  hideLoadingOverlay() {
    // Check if SwaggerNav sidebar is actually rendered and in the DOM
    const sidebar = document.getElementById("swagger-nav-sidebar");
    if (!sidebar || !this.navBar) {
      // Sidebar not ready yet, don't hide overlay
      return false;
    }

    // Check if sidebar is actually in the DOM (even if hidden, it's still rendered)
    if (!document.body.contains(sidebar)) {
      // Sidebar exists but not in DOM yet, don't hide overlay
      return false;
    }

    // Sidebar is rendered and in DOM, hide overlay
    const overlay =
      document.getElementById("swagger-nav-loading-overlay") ||
      window._swaggerNavLoadingOverlay;
    if (overlay) {
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.3s ease-out";
      setTimeout(() => {
        overlay.remove();
        if (window._swaggerNavLoadingOverlay) {
          delete window._swaggerNavLoadingOverlay;
        }

        // Re-detect theme and re-apply themes, backgrounds, and effects after overlay is hidden
        // This ensures correct theme and backgrounds are applied after page is fully loaded
        if (checkIsSwaggerUIPage()) {
          // Re-detect theme in case OS theme changed or detection was incorrect
          const newTheme = this.detectTheme();
          if (newTheme !== this.theme) {
            this.theme = newTheme;
            swaggerNavLog(
              `SwaggerNav: Theme re-detected as ${this.theme} mode after loading`
            );
          }

          // Re-apply all themes, backgrounds, and effects to ensure everything is correct
          requestAnimationFrame(() => {
            this.applySwaggerUITheme();
            this.applyNavBarTheme(); // This also calls applyNavBarBackground() internally
            this.applySwaggerTheme();
            this.applyLiquidGlass(); // Re-apply liquid glass effect if enabled
            swaggerNavLog(
              "SwaggerNav: Themes, backgrounds, and effects re-applied after loading overlay hidden"
            );
          });
        }
      }, 300);
      return true;
    }
    return false;
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
      // Not a Swagger UI page - hide loading overlay immediately
      this.hideLoadingOverlay();

      // Restore original functions if interceptors were installed
      this.restoreOriginalFunctions();
      // Stop any health checks
      this.stopHealthCheck();
      // Hide any error popups
      this.hideErrorPopup();

      // Check again after a delay (for SPAs)
      setTimeout(() => {
        this.isSwaggerUI = this.detectSwaggerUI();
        if (this.isSwaggerUI) {
          // Add class to body/html when Swagger UI is detected
          document.body.classList.add("swagger-nav-active");
          document.documentElement.classList.add("swagger-nav-active");

          // Apply theme immediately when detected
          this.applySwaggerTheme();
          this.setup();
          // Also trigger sync after a delay to ensure Swagger UI is fully rendered
          setTimeout(() => {
            this.syncToCurrentSwaggerState();
            // Loading overlay will be hidden by setup() when sidebar is ready
          }, 1000);
        } else {
          // Still not Swagger UI - make sure everything is cleaned up
          this.restoreOriginalFunctions();
          this.stopHealthCheck();
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
    swaggerNavLog(
      `SwaggerNav: Initializing with ${this.theme} mode (OS preference)`
    );

    // Add class to body/html to scope CSS to Swagger UI pages only
    document.body.classList.add("swagger-nav-active");
    document.documentElement.classList.add("swagger-nav-active");

    // Create sidebar immediately for faster display
    this.parseEndpoints();
    this.createNavBar();
    this.setupObserver();
    this.setupSwaggerUISync();

    // Double-check we're still on Swagger UI page before setting up network monitoring
    const isSwaggerUIPage = !!(
      document.querySelector(".swagger-ui") ||
      document.querySelector("#swagger-ui") ||
      document.querySelector('[data-testid="swagger-ui"]') ||
      document.querySelector(".opblock") ||
      document.querySelector(".swagger-container") ||
      window.ui ||
      window.swaggerUi
    );

    if (isSwaggerUIPage) {
      this.setupNetworkErrorDetection(); // Setup network error detection (online/offline events)
      this.setupNetworkErrorInterception(); // Intercept API calls to detect server errors
      this.startHealthCheck(); // Start periodic health checks
    } else {
      // Not Swagger UI - restore functions and stop everything
      this.restoreOriginalFunctions();
      this.stopHealthCheck();
    }

    // Apply themes (these don't affect layout/positioning, safe to apply early)
    this.applySwaggerUITheme();
    this.applySwaggerTheme();
    this.applyNavBarTheme();

    // Apply liquid glass effect if enabled
    this.applyLiquidGlass();

    // Setup resize listener for responsive layout updates
    this.setupResizeListener();

    // Sync sidebar immediately, then again after a short delay for Swagger UI hash processing
    this.syncToCurrentSwaggerState();
    this.applyResponsiveConstraints();

    // Also sync after a short delay to catch Swagger UI's hash jump
    setTimeout(() => {
      this.syncToCurrentSwaggerState();
      this.applyResponsiveConstraints();
    }, 200);

    // Setup parameter enhancements (searchable selects & form builder)
    this.setupParameterEnhancements();

    // Hide loading overlay after SwaggerNav sidebar is rendered
    // Check periodically until sidebar is ready
    let checkCount = 0;
    const maxChecks = 100; // Maximum 5 seconds (100 * 50ms)
    const checkSidebarReady = () => {
      checkCount++;
      const sidebar = document.getElementById("swagger-nav-sidebar");
      if (sidebar && this.navBar && document.body.contains(sidebar)) {
        // Sidebar is rendered and in DOM, hide loading overlay
        if (this.hideLoadingOverlay()) {
          swaggerNavLog("SwaggerNav: Sidebar rendered, hiding loading overlay");
          return; // Successfully hid overlay
        }
      }

      // Sidebar not ready yet, check again after a short delay (or give up after max checks)
      if (checkCount < maxChecks) {
        setTimeout(checkSidebarReady, 50);
      } else {
        // Give up after max checks - sidebar might not render (e.g., no endpoints, slow page load)
        // Only log as debug if we're actually on a Swagger UI page, since this can be expected behavior
        if (checkIsSwaggerUIPage()) {
          swaggerNavLog(
            "SwaggerNav: Sidebar not found after max checks, hiding overlay anyway (this is normal for slow-loading pages or pages with no endpoints)"
          );
        }
        const overlay =
          document.getElementById("swagger-nav-loading-overlay") ||
          window._swaggerNavLoadingOverlay;
        if (overlay) {
          overlay.style.opacity = "0";
          overlay.style.transition = "opacity 0.3s ease-out";
          setTimeout(() => {
            overlay.remove();
            if (window._swaggerNavLoadingOverlay) {
              delete window._swaggerNavLoadingOverlay;
            }

            // Re-detect theme and re-apply themes, backgrounds, and effects after overlay is hidden
            // This ensures correct theme and backgrounds are applied after page is fully loaded
            if (checkIsSwaggerUIPage()) {
              // Re-detect theme in case OS theme changed or detection was incorrect
              const newTheme = this.detectTheme();
              if (newTheme !== this.theme) {
                this.theme = newTheme;
                swaggerNavLog(
                  `SwaggerNav: Theme re-detected as ${this.theme} mode after loading (fallback)`
                );
              }

              // Re-apply all themes, backgrounds, and effects to ensure everything is correct
              requestAnimationFrame(() => {
                this.applySwaggerUITheme();
                this.applyNavBarTheme(); // This also calls applyNavBarBackground() internally
                this.applySwaggerTheme();
                this.applyLiquidGlass(); // Re-apply liquid glass effect if enabled
                swaggerNavLog(
                  "SwaggerNav: Themes, backgrounds, and effects re-applied after loading overlay hidden (fallback)"
                );
              });
            }
          }, 300);
        }
      }
    };

    // Start checking after a small initial delay to allow DOM to update
    setTimeout(checkSidebarReady, 100);
  }

  // Setup resize listener to handle layout updates when monitors disconnect/reconnect
  setupResizeListener() {
    // Only setup on Swagger UI pages
    if (!checkIsSwaggerUIPage()) {
      return;
    }

    // Debounce resize handler to avoid excessive calls
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Only handle on Swagger UI pages
        if (!checkIsSwaggerUIPage()) {
          return;
        }

        swaggerNavLog("SwaggerNav: Window resized, updating layout");

        // Force CSS recalculation by triggering a reflow
        requestAnimationFrame(() => {
          // Re-apply responsive constraints
          this.applyResponsiveConstraints();

          // Force recalculation of grid layouts (Form View and Response View)
          const bodyContainers = document.querySelectorAll(
            ".swagger-nav-body-container"
          );
          const responseContainers = document.querySelectorAll(
            ".swagger-nav-response-container"
          );

          [...bodyContainers, ...responseContainers].forEach((container) => {
            // Force layout recalculation
            void container.offsetHeight;
          });

          // Force CSS media query recalculation
          void document.body.offsetHeight;
        });
      }, 150); // Debounce for 150ms
    };

    // Listen to window resize events
    window.addEventListener("resize", handleResize, { passive: true });

    // Also listen to orientation changes (for mobile/tablet)
    window.addEventListener(
      "orientationchange",
      () => {
        setTimeout(handleResize, 200);
      },
      { passive: true }
    );

    swaggerNavLog("SwaggerNav: Resize listener setup complete");
  }

  // Force Swagger UI containers to fit within viewport when sidebar is visible
  // Note: This is delayed to allow Swagger UI to process hash and scroll first
  applyResponsiveConstraints() {
    if (!this.navBar || this.navBar.classList.contains("hidden")) {
      return;
    }

    const sidebarWidth = window.innerWidth <= 768 ? 280 : 350;
    const maxWidth = window.innerWidth - sidebarWidth;

    // Only set horizontal overflow constraints, don't interfere with vertical scrolling
    // Force body max-width
    document.body.style.maxWidth = `${maxWidth}px`;
    document.body.style.overflowX = "hidden";
    // Don't set overflowY - let Swagger UI handle vertical scrolling

    // Force html max-width
    document.documentElement.style.maxWidth = `${window.innerWidth}px`;
    document.documentElement.style.overflowX = "hidden";
    // Don't set overflowY - let Swagger UI handle vertical scrolling

    // Force all Swagger UI containers
    const swaggerContainers = [
      document.getElementById("swagger-ui"),
      ...document.querySelectorAll(".swagger-ui"),
      ...document.querySelectorAll(".swagger-container"),
      ...document.querySelectorAll(".wrapper"),
      ...document.querySelectorAll(".swagger-ui .wrapper"),
      ...document.querySelectorAll(".swagger-ui .swagger-container"),
      ...document.querySelectorAll(".swagger-ui > div"),
    ];

    swaggerContainers.forEach((container) => {
      if (container) {
        container.style.maxWidth = `${maxWidth}px`;
        container.style.width = "100%";
        container.style.boxSizing = "border-box";
        container.style.overflowX = "hidden";
        // Don't set overflowY - let Swagger UI handle vertical scrolling
      }
    });
  }

  // Remove responsive constraints when sidebar is hidden
  removeResponsiveConstraints() {
    document.body.style.maxWidth = "";
    document.body.style.overflowX = "";
    document.documentElement.style.maxWidth = "";
    document.documentElement.style.overflowX = "";

    const swaggerContainers = [
      document.getElementById("swagger-ui"),
      ...document.querySelectorAll(".swagger-ui"),
      ...document.querySelectorAll(".swagger-container"),
      ...document.querySelectorAll(".wrapper"),
      ...document.querySelectorAll(".swagger-ui .wrapper"),
      ...document.querySelectorAll(".swagger-ui .swagger-container"),
      ...document.querySelectorAll(".swagger-ui > div"),
    ];

    swaggerContainers.forEach((container) => {
      if (container) {
        container.style.maxWidth = "";
        container.style.width = "";
        container.style.boxSizing = "";
        container.style.overflowX = "";
      }
    });
  }

  // Parse all endpoints from Swagger UI
  parseEndpoints() {
    this.endpoints = [];

    // Find all operation blocks
    const opblocks = document.querySelectorAll(".opblock");

    if (opblocks.length === 0) {
      swaggerNavLog("SwaggerNav: No operations found yet");
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
        swaggerNavError("SwaggerNav: Error parsing endpoint", error);
      }
    });

    // Convert to array format
    this.endpoints = Object.entries(tagGroups).map(([tag, endpoints]) => ({
      tag,
      endpoints,
    }));

    swaggerNavLog(
      `SwaggerNav: Found ${opblocks.length} endpoints in ${this.endpoints.length} tags`
    );
  }

  // Refresh the navigation bar
  refreshNavBar() {
    swaggerNavLog("SwaggerNav: Refreshing navigation bar");
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
        <span class="swagger-nav-pinned-icon" aria-hidden="true"></span>
        <span class="swagger-nav-section-title">Pinned</span>
      </div>
      <button type="button" class="swagger-nav-unpin-all-btn" title="Unpin all endpoints" aria-label="Unpin all pinned endpoints">Unpin All</button>
    `;

    // Add pin icon to pinned header
    const pinnedIcon = pinnedHeader.querySelector(".swagger-nav-pinned-icon");
    if (pinnedIcon) {
      pinnedIcon.appendChild(this.createIcon("pin", 14));
    }

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
            <span class="swagger-nav-tag-icon"></span>
            <span class="swagger-nav-tag-text">${this.escapeHtml(
              tagName
            )}</span>
          </div>
        </div>
        <div class="swagger-nav-pinned-item-actions">
          <button type="button" class="swagger-nav-pin-btn pinned" title="Unpin endpoint" aria-label="Unpin ${
            foundEndpoint.method
          } ${foundEndpoint.path}"><span aria-hidden="true"></span></button>
          <button type="button" class="swagger-nav-copy-btn" title="Copy endpoint path" aria-label="Copy ${
            foundEndpoint.path
          } to clipboard"><span aria-hidden="true"></span></button>
        </div>
      `;

      // Add icons to pinned item buttons
      const pinnedPinBtn = endpointItem.querySelector(
        ".swagger-nav-pin-btn span"
      );
      if (pinnedPinBtn) {
        pinnedPinBtn.appendChild(this.createIcon("pin", 16));
      }

      const pinnedCopyBtn = endpointItem.querySelector(
        ".swagger-nav-copy-btn span"
      );
      if (pinnedCopyBtn) {
        pinnedCopyBtn.appendChild(this.createIcon("clipboard", 16));
      }

      // Add icon to tag icon
      const tagIcon = endpointItem.querySelector(".swagger-nav-tag-icon");
      if (tagIcon) {
        tagIcon.appendChild(this.createIcon("tag", 10));
      }

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
              toggle.innerHTML = "";
              toggle.appendChild(this.createIcon("chevronUp", 12));
              if (sectionHeader) {
                sectionHeader.setAttribute("aria-expanded", "true");
              }
            }
          }

          // Add active class to the actual item (NOT the pinned item)
          actualItem.classList.add("active-nav");

          // Scroll the actual item into view in the extension (instant for speed)
          actualItem.scrollIntoView({
            behavior: "auto",
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
      swaggerNavLog("SwaggerNav: No endpoints to display");
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
          <span class="swagger-nav-icon" aria-hidden="true"></span>
          <span>SwaggerNav</span>
          <span class="swagger-nav-version">v${SWAGGERNAV_VERSION}</span>
          <span class="swagger-nav-theme-indicator" title="${
            this.theme === "dark" ? "Dark" : "Light"
          } mode (follows OS)" aria-label="${
      this.theme === "dark" ? "Dark" : "Light"
    } mode"></span>
        </div>
        <button type="button" class="swagger-nav-toggle-btn" title="Hide sidebar" aria-label="Hide sidebar" aria-expanded="true">
          <span aria-hidden="true"></span>
        </button>
      </div>
      <div class="swagger-nav-header-actions">
        <button type="button" class="swagger-nav-scroll-top-btn" title="Scroll to top of list" aria-label="Scroll to top of list">
          <span class="swagger-nav-btn-icon" aria-hidden="true"></span>
          <span class="swagger-nav-btn-label">Top</span>
        </button>
        <button type="button" class="swagger-nav-sync-btn" title="Sync with current Swagger UI view" aria-label="Sync with current Swagger UI view">
          <span class="swagger-nav-btn-icon" aria-hidden="true"></span>
          <span class="swagger-nav-btn-label">Sync</span>
        </button>
        <button type="button" class="swagger-nav-settings-btn" title="Settings" aria-label="Open settings">
          <span class="swagger-nav-btn-icon" aria-hidden="true"></span>
          <span class="swagger-nav-btn-label">Settings</span>
        </button>
      </div>
    `;

    // Add icons to header elements
    const titleIcon = header.querySelector(".swagger-nav-icon");
    if (titleIcon) {
      titleIcon.appendChild(this.createIcon("clipboard", 16));
    }

    const themeIndicator = header.querySelector(".swagger-nav-theme-indicator");
    if (themeIndicator) {
      const themeIcon = this.createIcon(
        this.theme === "dark" ? "moon" : "sun",
        14
      );
      themeIndicator.appendChild(themeIcon);
    }

    const toggleBtn = header.querySelector(".swagger-nav-toggle-btn span");
    if (toggleBtn) {
      toggleBtn.appendChild(this.createIcon("arrowRight", 16));
    }

    const scrollTopIcon = header.querySelector(
      ".swagger-nav-scroll-top-btn .swagger-nav-btn-icon"
    );
    if (scrollTopIcon) {
      scrollTopIcon.appendChild(this.createIcon("arrowUp", 13));
    }

    const syncIcon = header.querySelector(
      ".swagger-nav-sync-btn .swagger-nav-btn-icon"
    );
    if (syncIcon) {
      syncIcon.appendChild(this.createIcon("refresh", 13));
    }

    const settingsIcon = header.querySelector(
      ".swagger-nav-settings-btn .swagger-nav-btn-icon"
    );
    if (settingsIcon) {
      settingsIcon.appendChild(this.createIcon("settings", 13));
    }

    this.navBar.appendChild(header);

    // Add search box (sticky, outside content)
    const searchBox = document.createElement("div");
    searchBox.className = "swagger-nav-search";
    searchBox.innerHTML = `
      <div class="swagger-nav-search-container">
        <div class="swagger-nav-search-input-wrapper">
          <input type="text" placeholder="Search endpoints..." class="swagger-nav-search-input" aria-label="Search API endpoints" role="searchbox" autocomplete="off">
          <button type="button" class="swagger-nav-search-clear" title="Clear search" aria-label="Clear search" style="display: none;">
            <span aria-hidden="true"></span>
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
    // Add icon to clear button
    const clearBtn = searchBox.querySelector(".swagger-nav-search-clear span");
    if (clearBtn) {
      clearBtn.appendChild(this.createIcon("x", 16));
    }

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
          <span class="swagger-nav-section-toggle" aria-hidden="true"></span>
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
        }"><span aria-hidden="true"></span></button>
          <button type="button" class="swagger-nav-copy-btn" title="Copy endpoint path" aria-label="Copy ${
            endpoint.path
          } to clipboard"><span aria-hidden="true"></span></button>
        `;

        // Add icons to pin and copy buttons
        const pinBtnSpan = endpointItem.querySelector(
          ".swagger-nav-pin-btn span"
        );
        if (pinBtnSpan) {
          pinBtnSpan.appendChild(this.createIcon("pin", 16));
        }

        const copyBtnSpan = endpointItem.querySelector(
          ".swagger-nav-copy-btn span"
        );
        if (copyBtnSpan) {
          copyBtnSpan.appendChild(this.createIcon("clipboard", 16));
        }

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
          toggle.innerHTML = "";
          toggle.appendChild(this.createIcon("chevronUp", 12));
          sectionHeader.setAttribute("aria-expanded", "true");
          sectionHeader.setAttribute(
            "aria-label",
            `Collapse ${group.tag} section`
          );

          // Scroll section into view when expanding
          setTimeout(() => {
            // Scroll to show the section with some context (instant for speed)
            section.scrollIntoView({
              behavior: "auto",
              block: "nearest",
              inline: "nearest",
            });
          }, 50); // Small delay to let the content expand first
        } else {
          // Collapse
          section.classList.add("collapsed");
          sectionContent.style.display = "none";
          toggle.innerHTML = "";
          toggle.appendChild(this.createIcon("chevronDown", 12));
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
          toggle.innerHTML = "";
          toggle.appendChild(this.createIcon("chevronDown", 12));
          sectionHeader.setAttribute("aria-expanded", "false");
        } else {
          // Expand all
          section.classList.remove("collapsed");
          sectionContent.style.display = "block";
          toggle.innerHTML = "";
          toggle.appendChild(this.createIcon("chevronUp", 12));
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
      // Remove constraints when sidebar is hidden
      this.removeResponsiveConstraints();
      const toggleBtn = this.navBar.querySelector(".swagger-nav-toggle-btn");
      if (toggleBtn) {
        const toggleSpan = toggleBtn.querySelector("span");
        if (toggleSpan) {
          toggleSpan.innerHTML = "";
          toggleSpan.appendChild(this.createIcon("arrowLeft", 16));
        }
        toggleBtn.title = "Show sidebar";
        toggleBtn.setAttribute("aria-label", "Show sidebar");
        toggleBtn.setAttribute("aria-expanded", "false");
      }
      this.createFloatingShowButton();
    }

    // Sidebar is now rendered, hide loading overlay
    // Use requestAnimationFrame to ensure DOM is fully updated
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.hideLoadingOverlay();
      }, 50);
    });

    swaggerNavLog("SwaggerNav: Navigation bar created");
  }

  // Setup event listeners
  setupEventListeners() {
    // Header toggle button
    const toggleBtn = this.navBar.querySelector(".swagger-nav-toggle-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        try {
          // Check if extension context is still valid and navBar exists
          if (!this.isExtensionContextValid()) {
            swaggerNavWarn(
              "SwaggerNav: Extension context invalidated, skipping toggle"
            );
            return;
          }
          if (!this.navBar || !document.body.contains(this.navBar)) {
            swaggerNavWarn("SwaggerNav: navBar removed, skipping toggle");
            return;
          }

          const isHidden = this.navBar.classList.contains("hidden");

          if (isHidden) {
            // Show sidebar
            this.navBar.classList.remove("hidden");
            // Apply constraints when sidebar is shown
            this.applyResponsiveConstraints();
            const toggleSpan = toggleBtn.querySelector("span");
            if (toggleSpan) {
              toggleSpan.innerHTML = "";
              toggleSpan.appendChild(this.createIcon("arrowRight", 16));
            }
            toggleBtn.title = "Hide sidebar";
            toggleBtn.setAttribute("aria-label", "Hide sidebar");
            toggleBtn.setAttribute("aria-expanded", "true");
            this.removeFloatingShowButton();
            this.saveSidebarState(false); // Save as visible
          } else {
            // Hide sidebar
            this.navBar.classList.add("hidden");
            // Remove constraints when sidebar is hidden
            this.removeResponsiveConstraints();
            const toggleSpan = toggleBtn.querySelector("span");
            if (toggleSpan) {
              toggleSpan.innerHTML = "";
              toggleSpan.appendChild(this.createIcon("arrowLeft", 16));
            }
            toggleBtn.title = "Show sidebar";
            toggleBtn.setAttribute("aria-label", "Show sidebar");
            toggleBtn.setAttribute("aria-expanded", "false");
            this.createFloatingShowButton();
            this.saveSidebarState(true); // Save as hidden
          }
        } catch (error) {
          // Handle extension context invalidated errors gracefully
          if (
            error.message &&
            error.message.includes("Extension context invalidated")
          ) {
            swaggerNavWarn(
              "SwaggerNav: Extension context invalidated, page reload may be needed"
            );
            // Optionally reload the page to restore extension context
            // window.location.reload();
          } else {
            swaggerNavError(
              "SwaggerNav: Error in toggle button handler",
              error
            );
          }
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
            behavior: "auto",
          });
        }
      });
    }

    // Sync button
    const syncBtn = this.navBar.querySelector(".swagger-nav-sync-btn");
    if (syncBtn) {
      syncBtn.addEventListener("click", () => {
        swaggerNavLog("SwaggerNav: Manual sync triggered");
        this.syncToCurrentSwaggerState();
      });
    }

    // Settings button - opens options page directly
    const settingsBtn = this.navBar.querySelector(".swagger-nav-settings-btn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        try {
          // Check if extension context is still valid
          if (!chrome.runtime || !chrome.runtime.id) {
            swaggerNavWarn(
              "SwaggerNav: Extension context invalidated, cannot open options page"
            );
            return;
          }

          swaggerNavLog(
            "SwaggerNav: Requesting service worker to open options page"
          );

          // Send message to service worker to open options page
          // This avoids ERR_BLOCKED_BY_CLIENT since content scripts have limited API access
          chrome.runtime.sendMessage(
            { action: "openOptionsPage" },
            (response) => {
              if (chrome.runtime.lastError) {
                // Check if error is due to invalidated context
                if (
                  chrome.runtime.lastError.message &&
                  chrome.runtime.lastError.message.includes(
                    "Extension context invalidated"
                  )
                ) {
                  swaggerNavWarn(
                    "SwaggerNav: Extension context invalidated, page reload may be needed"
                  );
                  return;
                }
                swaggerNavError(
                  "SwaggerNav: Error sending message to service worker",
                  chrome.runtime.lastError
                );
                // Fallback: try opening directly as a last resort
                try {
                  window.open(chrome.runtime.getURL("options.html"), "_blank");
                } catch (fallbackError) {
                  swaggerNavError(
                    "SwaggerNav: Failed to open options page",
                    fallbackError
                  );
                }
              } else if (response && response.success) {
                swaggerNavLog("SwaggerNav: Options page opened successfully");
              } else {
                swaggerNavError(
                  "SwaggerNav: Service worker failed to open options page",
                  response?.error
                );
              }
            }
          );
        } catch (error) {
          // Handle extension context invalidated errors gracefully
          if (
            error.message &&
            error.message.includes("Extension context invalidated")
          ) {
            swaggerNavWarn(
              "SwaggerNav: Extension context invalidated, page reload may be needed"
            );
          } else {
            swaggerNavError(
              "SwaggerNav: Error in settings button handler",
              error
            );
          }
        }
      });
    }

    // Search functionality
    const searchInput = this.navBar.querySelector(".swagger-nav-search-input");
    const searchClearBtn = this.navBar.querySelector(
      ".swagger-nav-search-clear"
    );

    swaggerNavLog(`SwaggerNav: Found searchInput:`, !!searchInput);
    swaggerNavLog(
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
    floatingBtn.innerHTML = "<span aria-hidden='true'></span>";
    const floatingBtnSpan = floatingBtn.querySelector("span");
    if (floatingBtnSpan) {
      floatingBtnSpan.appendChild(this.createIcon("arrowLeft", 16));
    }
    floatingBtn.title = "Show API Navigator";
    floatingBtn.setAttribute("aria-label", "Show API Navigator sidebar");
    floatingBtn.addEventListener("click", () => {
      this.navBar.classList.remove("hidden");
      // Apply constraints when sidebar is shown
      this.applyResponsiveConstraints();
      const toggleBtn = this.navBar.querySelector(".swagger-nav-toggle-btn");
      if (toggleBtn) {
        const toggleSpan = toggleBtn.querySelector("span");
        if (toggleSpan) {
          toggleSpan.innerHTML = "";
          toggleSpan.appendChild(this.createIcon("arrowRight", 16));
        }
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
    swaggerNavLog(
      `SwaggerNav: setupEnhancedSearch - clearBtn exists:`,
      !!searchClearBtn
    );
    swaggerNavLog(
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

      swaggerNavLog(
        `SwaggerNav: Enhanced dropdown - search history items: ${this
          .searchHistory?.length || 0}`
      );
      swaggerNavLog(`SwaggerNav: Enhanced dropdown - query: "${query}"`);

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
        swaggerNavLog(
          `SwaggerNav: Clear button visibility - input: "${searchInput.value}", display: ${shouldShow}`
        );
      } else {
        swaggerNavLog(`SwaggerNav: Clear button not found!`);
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
          swaggerNavLog(`SwaggerNav: Auto-saved search "${query}" to history`);
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

    swaggerNavLog(
      `SwaggerNav: Enhanced search setup complete. Initial value: "${searchInput.value}", Clear btn visible: ${searchClearBtn?.style.display}`
    );
    swaggerNavLog(
      `SwaggerNav: Search history loaded with ${this.searchHistory?.length ||
        0} items:`,
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
            toggle.innerHTML = "";
            toggle.appendChild(this.createIcon("chevronUp", 12));
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
              toggle.innerHTML = "";
              toggle.appendChild(this.createIcon("chevronDown", 12));
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
    swaggerNavLog(`SwaggerNav: scrollToEndpoint called with ID: ${endpointId}`);

    const attemptScroll = (retryCount = 0, maxRetries = 10) => {
      const element = document.getElementById(endpointId);
      swaggerNavLog(
        `SwaggerNav: Element found (attempt ${retryCount + 1}/${maxRetries}):`,
        element
      );

      if (!element) {
        if (retryCount < maxRetries) {
          const delay = Math.min(50 + retryCount * 50, 300); // 50ms, 100ms, 150ms... up to 300ms
          swaggerNavLog(
            `SwaggerNav: Element not found yet, retrying in ${delay}ms...`
          );
          setTimeout(() => attemptScroll(retryCount + 1, maxRetries), delay);
        } else {
          swaggerNavWarn(
            `SwaggerNav: Could not find element ${endpointId} after ${maxRetries} attempts`
          );
        }
        return;
      }

      swaggerNavLog(`SwaggerNav: Navigating to endpoint ${endpointId}`);

      // Scroll immediately
      const elementRect = element.getBoundingClientRect();
      const absoluteElementTop = elementRect.top + window.pageYOffset;
      const offset = 100; // Scroll 100px above the endpoint for better visibility

      // Calculate scroll position
      const scrollTop = Math.max(0, absoluteElementTop - offset);

      swaggerNavLog(
        `SwaggerNav: Scrolling to endpoint - element top: ${absoluteElementTop}px, scroll to: ${scrollTop}px`
      );

      // Scroll with offset for better visibility (instant for speed)
      window.scrollTo({
        top: scrollTop,
        behavior: "auto",
      });

      swaggerNavLog(
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
          swaggerNavLog(
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

          swaggerNavLog(`SwaggerNav: Clickable element:`, clickableElement);
          swaggerNavLog(
            `SwaggerNav: Clickable element tagName:`,
            clickableElement?.tagName
          );
          swaggerNavLog(
            `SwaggerNav: Clickable element aria-expanded:`,
            clickableElement?.getAttribute("aria-expanded")
          );

          if (clickableElement && !isOpen) {
            swaggerNavLog(
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

            swaggerNavLog(
              `SwaggerNav: Dispatched click event to expand endpoint ${endpointId}`
            );

            // After expansion animation completes, re-scroll to ensure visibility
            setTimeout(() => {
              swaggerNavLog(
                `SwaggerNav: Re-scrolling to endpoint ${endpointId} after expansion`
              );
              const elementRect = element.getBoundingClientRect();
              const absoluteElementTop = elementRect.top + window.pageYOffset;
              const offset = 100;
              window.scrollTo({
                top: absoluteElementTop - offset,
                behavior: "auto",
              });
              swaggerNavLog(
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
              const newAriaExpanded = clickableElement.getAttribute(
                "aria-expanded"
              );
              swaggerNavLog(
                `SwaggerNav: After click, aria-expanded is now: ${newAriaExpanded}`
              );
            }, 200);
          } else if (isOpen) {
            swaggerNavLog(`SwaggerNav: Endpoint ${endpointId} already open`);
            // If already open and autoTryOut is enabled, try clicking the button
            if (this.settings.autoTryOut) {
              setTimeout(() => {
                this.clickTryItOut(element, endpointId);
              }, 300);
            }
          } else {
            swaggerNavWarn(
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
    swaggerNavLog(
      `SwaggerNav: Looking for "Try it out" button in ${endpointId}`
    );

    // Find the "Try it out" button within the expanded endpoint
    const tryItOutBtn = endpointElement.querySelector(".btn.try-out__btn");

    if (tryItOutBtn) {
      // Check if button text says "Try it out" (not "Cancel" which means it's already activated)
      const buttonText = tryItOutBtn.textContent.trim();
      swaggerNavLog(`SwaggerNav: Found button with text: "${buttonText}"`);

      if (buttonText.toLowerCase().includes("try it out")) {
        swaggerNavLog(
          `SwaggerNav: Clicking "Try it out" button for ${endpointId}`
        );
        tryItOutBtn.click();
      } else {
        swaggerNavLog(
          `SwaggerNav: Button already activated (shows "${buttonText}")`
        );
      }
    } else {
      swaggerNavLog(
        `SwaggerNav: "Try it out" button not found in ${endpointId}`
      );
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
        swaggerNavLog("SwaggerNav: Detected changes, refreshing...");
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
    // Swagger UI handles scrolling automatically, we just need to sync the sidebar
    window.addEventListener("hashchange", () => {
      // Wait for Swagger UI to expand the endpoint, then sync sidebar
      const attemptHashSync = (retryCount = 0, maxRetries = 10) => {
        const delay = Math.min(50 + retryCount * 50, 300); // 50ms, 100ms, 150ms... up to 300ms

        setTimeout(() => {
          // Find active/expanded endpoint in Swagger UI
          const expandedOpblock = document.querySelector(".opblock.is-open");
          if (expandedOpblock && expandedOpblock.id) {
            swaggerNavLog(
              `SwaggerNav: Hash changed, syncing sidebar and scrolling to expanded endpoint (attempt ${retryCount +
                1}): ${expandedOpblock.id}`
            );
            this.syncToSwaggerUI(expandedOpblock.id);
            // Scroll main page to the endpoint immediately
            this.scrollToEndpoint(expandedOpblock.id);
            return;
          }

          // Retry if endpoint not expanded yet
          if (retryCount < maxRetries) {
            attemptHashSync(retryCount + 1, maxRetries);
          }
        }, delay);
      };

      attemptHashSync(0, 10);
    });

    swaggerNavLog("SwaggerNav: Swagger UI sync enabled");
  }

  // Check and sync to current Swagger UI state on initial load
  syncToCurrentSwaggerState() {
    const hash = window.location.hash;
    if (!hash) {
      // No hash, check for any expanded endpoint
      setTimeout(() => {
        const expandedOpblock = document.querySelector(".opblock.is-open");
        if (expandedOpblock && expandedOpblock.id) {
          swaggerNavLog(
            `SwaggerNav: Initial sync to expanded endpoint: ${expandedOpblock.id}`
          );
          this.syncToSwaggerUI(expandedOpblock.id);
          // Scroll main page to the endpoint immediately
          this.scrollToEndpoint(expandedOpblock.id);

          if (this.settings.autoTryOut) {
            setTimeout(() => {
              this.clickTryItOut(expandedOpblock, expandedOpblock.id);
            }, 500);
          }
        }
      }, 100);
      return;
    }

    // Wait for Swagger UI to expand endpoint from hash, then sync sidebar
    const attemptSync = (retryCount = 0, maxRetries = 15) => {
      const delay = Math.min(50 + retryCount * 50, 300); // 50ms, 100ms, 150ms... up to 300ms

      setTimeout(() => {
        // Check for expanded endpoint
        const expandedOpblock = document.querySelector(".opblock.is-open");
        if (expandedOpblock && expandedOpblock.id) {
          swaggerNavLog(
            `SwaggerNav: Syncing sidebar and scrolling to expanded endpoint (attempt ${retryCount +
              1}): ${expandedOpblock.id}`
          );
          this.syncToSwaggerUI(expandedOpblock.id);
          // Scroll main page to the endpoint immediately
          this.scrollToEndpoint(expandedOpblock.id);

          if (this.settings.autoTryOut) {
            setTimeout(() => {
              this.clickTryItOut(expandedOpblock, expandedOpblock.id);
            }, 500);
          }
          return;
        }

        // Retry if endpoint not expanded yet
        if (retryCount < maxRetries) {
          swaggerNavLog(
            `SwaggerNav: Endpoint not expanded yet, retrying in ${delay}ms (attempt ${retryCount +
              1}/${maxRetries})`
          );
          attemptSync(retryCount + 1, maxRetries);
        } else {
          swaggerNavLog(
            `SwaggerNav: No expanded endpoint found after ${maxRetries} attempts${
              hash ? ` (hash: ${hash})` : ""
            }`
          );
        }
      }, delay);
    };

    // Start with initial attempt
    attemptSync(0, 15);

    // Also set up MutationObserver to watch for when endpoints are added/expanded
    if (!this._hashSyncObserver) {
      this._hashSyncObserver = new MutationObserver((mutations) => {
        // Check if any opblock became expanded
        const expandedOpblock = document.querySelector(".opblock.is-open");
        if (expandedOpblock && expandedOpblock.id) {
          const hash = window.location.hash;
          if (hash && hash.includes(expandedOpblock.id)) {
            swaggerNavLog(
              `SwaggerNav: Endpoint expanded via MutationObserver: ${expandedOpblock.id}`
            );
            this.syncToSwaggerUI(expandedOpblock.id);
            // Scroll main page to the endpoint immediately
            this.scrollToEndpoint(expandedOpblock.id);

            if (this.settings.autoTryOut) {
              setTimeout(() => {
                this.clickTryItOut(expandedOpblock, expandedOpblock.id);
              }, 500);
            }

            // Disconnect observer after successful sync
            this._hashSyncObserver.disconnect();
            this._hashSyncObserver = null;
          }
        }
      });

      // Observe the Swagger UI container for changes
      const swaggerContainer =
        document.querySelector(".swagger-ui") ||
        document.querySelector("#swagger-ui") ||
        document.body;
      if (swaggerContainer) {
        this._hashSyncObserver.observe(swaggerContainer, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "id"],
        });

        // Auto-disconnect after 10 seconds to avoid memory leaks
        setTimeout(() => {
          if (this._hashSyncObserver) {
            this._hashSyncObserver.disconnect();
            this._hashSyncObserver = null;
          }
        }, 10000);
      }
    }
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
          toggle.innerHTML = "";
          toggle.appendChild(this.createIcon("chevronUp", 12));
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

      // Scroll the item into view in the sidebar (instant for speed)
      targetItem.scrollIntoView({
        behavior: "auto",
        block: "center",
      });

      // Remove active class after animation (keep current class)
      setTimeout(() => {
        targetItem.classList.remove("active-nav");
      }, 2500);

      swaggerNavLog(`SwaggerNav: Synced to endpoint ${endpointId}`);
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
          swaggerNavError("SwaggerNav: Failed to copy", err);
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
      swaggerNavError("SwaggerNav: Fallback copy failed", err);
      this.showCopyFeedback(button, false);
    }

    document.body.removeChild(textarea);
  }

  // Show visual feedback when copying
  showCopyFeedback(button, success) {
    const originalHTML = button.innerHTML;

    if (success) {
      button.innerHTML = "";
      button.appendChild(this.createIcon("check", 14));
      button.classList.add("copied");

      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.classList.remove("copied");
      }, 1500);
    } else {
      button.innerHTML = "";
      button.appendChild(this.createIcon("x", 14));
      button.classList.add("copy-failed");

      setTimeout(() => {
        button.innerHTML = originalHTML;
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
    swaggerNavLog("SwaggerNav: Setting up parameter enhancements...");

    // Setup document-level Enter key handler for Execute buttons (setup once)
    if (!this._enterKeyHandlerSetup) {
      this._enterKeyHandlerSetup = true;
      document.addEventListener(
        "keydown",
        (e) => {
          // Only trigger on Enter key (not Shift+Enter, Ctrl+Enter, etc.)
          if (
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
          ) {
            // Find the active element and check if it's in an opblock with Execute button
            const activeElement = document.activeElement;

            // Don't trigger if user is typing in a multi-line textarea
            const isTextarea = activeElement?.tagName === "TEXTAREA";
            if (isTextarea) {
              const rows = activeElement.getAttribute("rows");
              const isMultiLine = rows && parseInt(rows) > 1;
              const isInFormView = activeElement.closest(
                ".swagger-nav-form-container"
              );
              // Skip multi-line textareas (let Enter work normally for new lines)
              if (isMultiLine || isInFormView) {
                return;
              }
            }

            // Don't trigger if we're in a searchable select dropdown (let it handle its own Enter)
            if (activeElement?.closest(".swagger-nav-select-search-wrapper")) {
              return;
            }

            // Don't trigger if user is editing in a contenteditable element
            if (activeElement?.isContentEditable) {
              return;
            }

            // Find any open opblock with Execute button (works even if no element is focused)
            // First check if active element is in an opblock, otherwise find any open opblock
            let opblock = activeElement?.closest(".opblock.is-open");

            // If active element is not in an opblock, find the first visible open opblock
            if (!opblock) {
              const openOpblocks = document.querySelectorAll(
                ".opblock.is-open"
              );
              // Find the first one that's in "Try it out" mode and has Execute button
              for (const block of openOpblocks) {
                const cancelButton = block.querySelector(
                  ".try-out__btn.cancel"
                );
                const execButton = block.querySelector(".btn.execute");
                if (cancelButton && execButton && !execButton.disabled) {
                  opblock = block;
                  break;
                }
              }
            }

            if (opblock) {
              // Check if this opblock has an Execute button and is in "Try it out" mode
              const executeButton = opblock.querySelector(".btn.execute");

              if (executeButton && !executeButton.disabled) {
                // Check if we're actually in "Try it out" mode (cancel button exists)
                const cancelButton = opblock.querySelector(
                  ".try-out__btn.cancel"
                );
                if (cancelButton) {
                  // Prevent default to avoid form submission or unwanted behavior
                  e.preventDefault();
                  e.stopPropagation();

                  swaggerNavLog(
                    "SwaggerNav: Enter key pressed in endpoint, clicking Execute button"
                  );
                  executeButton.click();
                }
              }
            }
          }
        },
        { capture: true } // Use capture to intercept early
      );

      swaggerNavLog(
        "SwaggerNav: Set up document-level Enter key handler for Execute buttons"
      );
    }

    // Setup mutation observer to watch for "Try it out" mode
    this.paramEnhancementObserver = new MutationObserver(() => {
      if (this.paramEnhancementTimeout)
        clearTimeout(this.paramEnhancementTimeout);
      this.paramEnhancementTimeout = setTimeout(() => {
        this.enhanceParameters();
      }, 300); // Reduced debounce to 300ms for faster updates
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

    // Enhance immediately, then again after a short delay for dynamic content
    this.enhanceParameters();
    setTimeout(() => {
      this.enhanceParameters();
    }, 300);

    // Fallback check every 5 seconds (reduced frequency)
    this.paramEnhancementInterval = setInterval(() => {
      this.enhanceParameters();
    }, 5000);
  }

  enhanceParameters() {
    // Prevent re-entrance (don't process if already processing)
    if (this.isEnhancing) {
      swaggerNavLog(
        "SwaggerNav: Already enhancing, skipping to prevent duplicates"
      );
      return;
    }

    this.isEnhancing = true;
    swaggerNavLog("SwaggerNav: Starting enhancement (locked)");

    // CRITICAL: Disconnect observer while we modify DOM to prevent infinite loop!
    if (this.paramEnhancementObserver) {
      this.paramEnhancementObserver.disconnect();
      swaggerNavLog("SwaggerNav: Observer DISCONNECTED");
    }

    try {
      // Find all open endpoints in "Try it out" mode
      const opblocks = document.querySelectorAll(
        ".swagger-ui .opblock.is-open"
      );
      swaggerNavLog(
        `SwaggerNav: enhanceParameters - found ${opblocks.length} open opblocks`
      );

      opblocks.forEach((opblock, index) => {
        // Check if in "Try it out" mode
        const cancelButton = opblock.querySelector(".try-out__btn.cancel");
        const isTryItOutActive = !!cancelButton;

        if (!isTryItOutActive) {
          swaggerNavLog(
            `SwaggerNav: Opblock ${index} - not in "Try it out" mode, hiding enhancements`
          );

          // Hide parameter search boxes and show original selects
          const searchInputs = opblock.querySelectorAll(
            ".swagger-nav-select-search"
          );
          searchInputs.forEach((searchInput) => {
            // Find the search wrapper (parent of searchInput)
            const searchWrapper = searchInput.parentElement;
            if (searchWrapper) {
              searchWrapper.style.display = "none";
            }

            // Find the original select (sibling of searchWrapper)
            const select = searchWrapper?.nextElementSibling;
            if (
              select &&
              select.tagName === "SELECT" &&
              select.dataset.swaggerNavSearchable === "true"
            ) {
              select.style.display = "";
            }
          });

          // Remove form builder and unhide original wrapper
          const formContainers = opblock.querySelectorAll(
            ".swagger-nav-body-container"
          );
          formContainers.forEach((container) => {
            swaggerNavLog(
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
              swaggerNavLog("SwaggerNav: Restored original wrapper visibility");
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

          // Hide response view and show original Swagger UI structure
          const responseContainers = opblock.querySelectorAll(
            ".swagger-nav-response-container[data-swagger-nav-original-wrapper-element='true']"
          );
          responseContainers.forEach((container) => {
            // Hide our Response View container
            container.style.display = "none";

            // Find and show the hidden original wrapper
            const parent = container.parentElement;
            if (parent) {
              const hiddenOriginal = parent.querySelector(
                "[data-swagger-nav-hidden-original='true']"
              );
              if (hiddenOriginal) {
                hiddenOriginal.style.display = "";
                swaggerNavLog(
                  "SwaggerNav: Restored original Swagger UI response structure"
                );
              }
            }
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

        swaggerNavLog(
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

        // Show form builder (if already created and enabled) and hide original wrapper
        // Only show if Form View is enabled in settings
        if (this.settings.enableFormView) {
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
        } else {
          // If disabled, ALWAYS hide Form View containers and show original textareas
          // This prevents containers from being re-shown by MutationObservers
          const formContainers = opblock.querySelectorAll(
            ".swagger-nav-body-container"
          );
          formContainers.forEach((container) => {
            container.style.display = "none";
            // Show the original wrapper
            const wrapper = container.previousElementSibling;
            if (wrapper && wrapper.style.display === "none") {
              wrapper.style.display = "";
            }
          });
        }

        // Show response view (if already created and enabled) and hide original Swagger UI response
        // Only show if Response View is enabled in settings
        if (this.settings.enableResponseView) {
          const responseContainers = opblock.querySelectorAll(
            ".swagger-nav-response-container[data-swagger-nav-original-wrapper-element='true']"
          );
          responseContainers.forEach((container) => {
            container.style.display = "grid";

            // Hide the original Swagger UI response
            const parent = container.parentElement;
            if (parent) {
              const hiddenOriginal = parent.querySelector(
                "[data-swagger-nav-hidden-original='true']"
              );
              if (hiddenOriginal) {
                hiddenOriginal.style.display = "none";
              }
            }
          });
        } else {
          // If disabled, hide Response View containers and show original
          const responseContainers = opblock.querySelectorAll(
            ".swagger-nav-response-container"
          );
          responseContainers.forEach((container) => {
            container.style.display = "none";
            const parent = container.parentElement;
            if (parent) {
              const hiddenOriginal = parent.querySelector(
                "[data-swagger-nav-hidden-original='true']"
              );
              if (hiddenOriginal) {
                hiddenOriginal.style.display = "";
              }
            }
          });
        }

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
        } else {
          // If disabled, ALWAYS hide parameter search boxes and show original selects
          // This prevents search boxes from being re-shown by MutationObservers
          const searchWrappers = opblock.querySelectorAll(
            ".swagger-nav-select-search"
          );
          searchWrappers.forEach((searchInput) => {
            // Find the search wrapper (parent of searchInput)
            const searchWrapper = searchInput.parentElement;
            if (searchWrapper) {
              searchWrapper.style.display = "none";
            }

            // Find the original select (sibling of searchWrapper)
            const select = searchWrapper?.nextElementSibling;
            if (
              select &&
              select.tagName === "SELECT" &&
              select.dataset.swaggerNavSearchable === "true"
            ) {
              select.style.display = "";
            }
          });
        }

        // Add form builder for request body (if enabled in settings)
        if (this.settings.enableFormView) {
          this.addFormBuilder(opblock);
        } else {
          // If disabled, ensure containers are hidden and wrappers are shown
          // This prevents containers from being re-shown by MutationObservers
          const formContainers = opblock.querySelectorAll(
            ".swagger-nav-body-container"
          );
          formContainers.forEach((container) => {
            container.style.display = "none";
            const wrapper = container.previousElementSibling;
            if (wrapper && wrapper.style.display === "none") {
              wrapper.style.display = "";
            }
          });
        }

        // Add response view for API responses (if enabled in settings)
        // Check setting BEFORE calling addResponseView to prevent re-adding when disabled
        if (this.settings.enableResponseView) {
          this.addResponseView(opblock);
        } else {
          // If disabled, make sure any existing Response View containers are hidden
          const existingContainers = opblock.querySelectorAll(
            ".swagger-nav-response-container"
          );
          existingContainers.forEach((container) => {
            container.style.display = "none";
            const parent = container.parentElement;
            if (parent) {
              const hiddenOriginal = parent.querySelector(
                "[data-swagger-nav-hidden-original='true']"
              );
              if (hiddenOriginal) {
                hiddenOriginal.style.display = "";
              }
            }
          });
          // Don't add custom buttons when Response View is OFF - keep default Swagger UI buttons
        }

        // Add Enter key handler to click Execute button and add hint
        this.addEnterToExecute(opblock);
      });
    } finally {
      // Always unlock, even if there's an error
      this.isEnhancing = false;
      swaggerNavLog("SwaggerNav: Enhancement complete (unlocked)");

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
          swaggerNavLog("SwaggerNav: Observer RECONNECTED");
        }
      }
    }
  }

  // ==============================================================================
  // Feature 1: Searchable Select Dropdowns
  // ==============================================================================
  // Implementation extracted to modules/features/parameter-search.js
  // Method is attached to prototype after class definition

  // Add Enter key handler to click Execute button and show hint
  addEnterToExecute(opblock) {
    // Find the Execute button
    const executeButton = opblock.querySelector(".btn.execute");
    if (!executeButton) {
      return; // No Execute button found (not in Try it out mode or no execute button)
    }

    // Skip if already enhanced
    if (opblock.dataset.swaggerNavEnterHandler === "true") {
      return;
    }

    // Mark as enhanced
    opblock.dataset.swaggerNavEnterHandler = "true";

    // Add hint below Execute button if not already added
    let hintElement = opblock.querySelector(".swagger-nav-enter-hint");
    if (!hintElement) {
      hintElement = document.createElement("div");
      hintElement.className = "swagger-nav-enter-hint";
      hintElement.textContent = "💡 Press Enter to execute";

      // Add responsive CSS styles (only add once)
      const hintStyle = document.createElement("style");
      hintStyle.id = "swagger-nav-enter-hint-style";
      if (!document.getElementById("swagger-nav-enter-hint-style")) {
        hintStyle.textContent = `
          .swagger-nav-enter-hint {
            font-size: 11px !important;
            color: #71717a !important;
            margin-top: 6px !important;
            margin-bottom: 0 !important;
            font-style: italic !important;
            opacity: 0.9 !important;
            display: block !important;
            white-space: nowrap !important;
            transition: opacity 0.2s ease !important;
            font-weight: 500 !important;
            line-height: 1.4 !important;
            clear: both !important;
            width: 100% !important;
            text-align: center !important;
          }
          
          /* Dark theme support - brighter color for better visibility */
          .swagger-ui .swagger-nav-enter-hint,
          .swagger-ui .opblock .swagger-nav-enter-hint {
            color: #7db8ff !important;
          }
          
          /* Light theme support */
          .swagger-ui.theme-light .swagger-nav-enter-hint,
          .swagger-ui.theme-light .opblock .swagger-nav-enter-hint {
            color: #0066cc !important;
          }
          
          /* Responsive font size - make smaller on mobile */
          @media (max-width: 1024px) {
            .swagger-nav-enter-hint {
              font-size: 10px !important;
              margin-top: 5px !important;
            }
          }
          
          @media (max-width: 768px) {
            .swagger-nav-enter-hint {
              font-size: 9px !important;
              margin-top: 4px !important;
            }
          }
          
          @media (max-width: 480px) {
            .swagger-nav-enter-hint {
              font-size: 8px !important;
              margin-top: 3px !important;
            }
          }
          
          /* Hover effect for better visibility */
          .swagger-nav-enter-hint:hover {
            opacity: 1 !important;
            text-shadow: 0 0 3px currentColor !important;
          }
        `;
        document.head.appendChild(hintStyle);
      }

      // Position hint below the Execute button, on its own line to prevent wrapping
      // Find the parent container of Execute button
      const executeParent = executeButton.parentElement;

      // Check if Execute button is in a flex container with other buttons
      // If so, we need to insert hint after the button group, not after the button itself
      let insertTarget = null;
      let insertMethod = "afterend";

      // Look for button wrapper/container (usually .btn-group or similar)
      const buttonGroup = executeButton.closest(".btn-group, .execute-wrapper");

      if (buttonGroup) {
        // Insert after the entire button group so hint doesn't interfere with button layout
        insertTarget = buttonGroup;
        insertMethod = "afterend";
      } else if (executeParent) {
        // Check if parent is a flex container with multiple buttons
        const parentStyle = window.getComputedStyle(executeParent);
        const isFlex =
          parentStyle.display === "flex" ||
          parentStyle.display === "inline-flex";
        const hasMultipleButtons =
          executeParent.querySelectorAll(".btn").length > 1;

        if (isFlex && hasMultipleButtons) {
          // Insert after parent container
          insertTarget = executeParent;
          insertMethod = "afterend";
        } else {
          // Insert after Execute button itself
          insertTarget = executeButton;
          insertMethod = "afterend";
        }
      } else {
        // Fallback: insert after Execute button
        insertTarget = executeButton;
        insertMethod = "afterend";
      }

      if (insertTarget) {
        insertTarget.insertAdjacentElement(insertMethod, hintElement);
      }

      swaggerNavLog("SwaggerNav: Added Enter key hint below Execute button");
    }

    // Note: Enter key handler is set up at document level in setupParameterEnhancements()
    // This opblock is now marked and will be handled by the global listener
  }

  addSearchableSelects(opblock) {
    // Use extracted module if available, otherwise fallback to inline (for backward compatibility)
    if (
      window.SwaggerNavParameterSearch &&
      window.SwaggerNavParameterSearch.addSearchableSelects
    ) {
      return window.SwaggerNavParameterSearch.addSearchableSelects.call(
        this,
        opblock
      );
    }
    // Fallback removed - module should always be loaded
    if (typeof swaggerNavError === "function") {
      swaggerNavError("SwaggerNav: Parameter search module not loaded");
    }
  }

  // Original implementation removed - now in modules/features/parameter-search.js
  // ==============================================================================
  // Feature 2: Form Builder for Request Body
  // ==============================================================================

  addFormBuilder(opblock) {
    // Use extracted module if available
    if (window.SwaggerNavFormView && window.SwaggerNavFormView.addFormBuilder) {
      return window.SwaggerNavFormView.addFormBuilder.call(this, opblock);
    }
    if (typeof swaggerNavError === "function") {
      swaggerNavError("SwaggerNav: Form View module not loaded");
    }
  }

  // Form View helper methods extracted to modules/features/form-view.js
  createFormBuilderForTextarea(textarea, opblock) {
    if (
      window.SwaggerNavFormView &&
      window.SwaggerNavFormView.createFormBuilderForTextarea
    ) {
      return window.SwaggerNavFormView.createFormBuilderForTextarea.call(
        this,
        textarea,
        opblock
      );
    }
  }

  // Original implementations removed - now in modules/features/form-view.js
  buildFormFromJSON(textarea, formContainer) {
    if (
      window.SwaggerNavFormView &&
      window.SwaggerNavFormView.buildFormFromJSON
    ) {
      return window.SwaggerNavFormView.buildFormFromJSON.call(
        this,
        textarea,
        formContainer
      );
    }
  }

  buildFormFields(data, container, path, textarea) {
    if (
      window.SwaggerNavFormView &&
      window.SwaggerNavFormView.buildFormFields
    ) {
      return window.SwaggerNavFormView.buildFormFields.call(
        this,
        data,
        container,
        path,
        textarea
      );
    }
  }

  updateJSONFromForm(textarea, path, input) {
    if (
      window.SwaggerNavFormView &&
      window.SwaggerNavFormView.updateJSONFromForm
    ) {
      return window.SwaggerNavFormView.updateJSONFromForm.call(
        this,
        textarea,
        path,
        input
      );
    }
  }

  setNestedValue(obj, path, value) {
    if (window.SwaggerNavFormView && window.SwaggerNavFormView.setNestedValue) {
      return window.SwaggerNavFormView.setNestedValue.call(
        this,
        obj,
        path,
        value
      );
    }
  }

  // ==============================================================================
  // Feature 3: Response View (Structured view with editable checkboxes for comparison)
  // ==============================================================================

  addResponseView(opblock) {
    // Use extracted module if available
    if (
      window.SwaggerNavResponseView &&
      window.SwaggerNavResponseView.addResponseView
    ) {
      return window.SwaggerNavResponseView.addResponseView.call(this, opblock);
    }
    if (typeof swaggerNavError === "function") {
      swaggerNavError("SwaggerNav: Response View module not loaded");
    }
  }

  // Original implementation removed - now in modules/features/response-view.js

  // Add custom copy/download buttons to default Swagger UI response when Response View is OFF
  addButtonsToDefaultResponse(opblock) {
    if (
      window.SwaggerNavResponseView &&
      window.SwaggerNavResponseView.addButtonsToDefaultResponse
    ) {
      return window.SwaggerNavResponseView.addButtonsToDefaultResponse.call(
        this,
        opblock
      );
    }
  }

  // Remove buttons from default Swagger UI response when Response View is enabled
  removeButtonsFromDefaultResponse(opblock) {
    if (
      window.SwaggerNavResponseView &&
      window.SwaggerNavResponseView.removeButtonsFromDefaultResponse
    ) {
      return window.SwaggerNavResponseView.removeButtonsFromDefaultResponse.call(
        this,
        opblock
      );
    }
  }

  buildResponseView(data, container) {
    if (
      window.SwaggerNavResponseView &&
      window.SwaggerNavResponseView.buildResponseView
    ) {
      return window.SwaggerNavResponseView.buildResponseView.call(
        this,
        data,
        container
      );
    }
  }

  buildResponseFields(data, container, path) {
    if (
      window.SwaggerNavResponseView &&
      window.SwaggerNavResponseView.buildResponseFields
    ) {
      return window.SwaggerNavResponseView.buildResponseFields.call(
        this,
        data,
        container,
        path
      );
    }
  }

  // ==============================================================================
  // Setup network error detection (offline/online events)
  // ==============================================================================

  setupNetworkErrorDetection() {
    // Only setup on Swagger UI pages
    if (!this.isSwaggerUI) {
      return;
    }

    // Check initial online status
    this.isOffline = !navigator.onLine;
    if (this.isOffline) {
      this.showErrorPopup("No internet connection");
    }

    // Listen for online/offline events
    const onlineHandler = () => {
      // Check if still on Swagger UI page
      if (!this.isSwaggerUI) return;
      this.isOffline = false;
      this.hideErrorPopup();
      swaggerNavLog("SwaggerNav: Internet connection restored");
    };

    const offlineHandler = () => {
      // Check if still on Swagger UI page
      if (!this.isSwaggerUI) return;
      this.isOffline = true;
      this.showErrorPopup("No internet connection");
      swaggerNavLog("SwaggerNav: Internet connection lost");
    };

    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);

    // Store handlers for cleanup (though content scripts are per-page, this is good practice)
    this._onlineHandler = onlineHandler;
    this._offlineHandler = offlineHandler;
  }

  // Intercept fetch and XMLHttpRequest to detect server errors
  setupNetworkErrorInterception() {
    // CRITICAL: Check DOM/UI FIRST to detect if this is actually a Swagger UI page
    // Don't rely on this.isSwaggerUI alone - check the actual page state
    const isSwaggerUIPage = !!(
      document.querySelector(".swagger-ui") ||
      document.querySelector("#swagger-ui") ||
      document.querySelector('[data-testid="swagger-ui"]') ||
      document.querySelector(".opblock") ||
      document.querySelector(".swagger-container") ||
      window.ui ||
      window.swaggerUi
    );

    // If not a Swagger UI page, restore original functions and return immediately
    if (!isSwaggerUIPage) {
      this.restoreOriginalFunctions();
      return;
    }

    // Only proceed if we're actually on a Swagger UI page

    // Store original functions if not already stored
    if (!window._swaggerNavOriginalFetch) {
      window._swaggerNavOriginalFetch = window.fetch;
    }
    if (!XMLHttpRequest.prototype._swaggerNavOriginalSend) {
      XMLHttpRequest.prototype._swaggerNavOriginalSend =
        XMLHttpRequest.prototype.send;
    }
    if (!XMLHttpRequest.prototype._swaggerNavOriginalOpen) {
      XMLHttpRequest.prototype._swaggerNavOriginalOpen =
        XMLHttpRequest.prototype.open;
    }

    // Intercept fetch
    if (!window._swaggerNavFetchInstalled) {
      window.fetch = async (...args) => {
        try {
          const response = await window._swaggerNavOriginalFetch(...args);
          // Check for server errors (5xx) or network errors
          if (!response.ok && response.status >= 500) {
            this.handleServerError(response.status);
          }
          return response;
        } catch (error) {
          // Network error or CORS error
          if (error.name === "TypeError" && error.message.includes("fetch")) {
            this.handleNetworkError(error);
          }
          throw error;
        }
      };
      window._swaggerNavFetchInstalled = true;
    }

    // Intercept XMLHttpRequest
    if (!XMLHttpRequest.prototype._swaggerNavXHRInstalled) {
      const originalOpen = XMLHttpRequest.prototype._swaggerNavOriginalOpen;
      const originalSend = XMLHttpRequest.prototype._swaggerNavOriginalSend;

      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._swaggerNavURL = url;
        return originalOpen.call(this, method, url, ...rest);
      };

      XMLHttpRequest.prototype.send = function(...args) {
        this.addEventListener("error", () => {
          if (window.swaggerNav && window.swaggerNav.isSwaggerUI) {
            window.swaggerNav.handleNetworkError(
              new Error("XHR network error")
            );
          }
        });

        this.addEventListener("load", () => {
          if (
            this.status >= 500 &&
            window.swaggerNav &&
            window.swaggerNav.isSwaggerUI
          ) {
            window.swaggerNav.handleServerError(this.status);
          }
        });

        return originalSend.apply(this, args);
      };

      XMLHttpRequest.prototype._swaggerNavXHRInstalled = true;
    }
  }

  restoreOriginalFunctions() {
    if (window._swaggerNavOriginalFetch) {
      window.fetch = window._swaggerNavOriginalFetch;
      window._swaggerNavFetchInstalled = false;
    }
    if (XMLHttpRequest.prototype._swaggerNavOriginalSend) {
      XMLHttpRequest.prototype.send =
        XMLHttpRequest.prototype._swaggerNavOriginalSend;
      if (XMLHttpRequest.prototype._swaggerNavOriginalOpen) {
        XMLHttpRequest.prototype.open =
          XMLHttpRequest.prototype._swaggerNavOriginalOpen;
      }
      XMLHttpRequest.prototype._swaggerNavXHRInstalled = false;
    }
  }

  handleServerError(status) {
    if (!this.isSwaggerUI) return;
    this.showErrorPopup(`Server error: ${status}`);
  }

  handleNetworkError(error) {
    if (!this.isSwaggerUI) return;
    // Only show if we're actually offline or if it's a clear network error
    if (this.isOffline || error.message.includes("Failed to fetch")) {
      this.showErrorPopup("Network error: Could not reach server");
    }
  }

  showErrorPopup(message) {
    if (!this.isSwaggerUI) return;

    // Remove existing popup if any
    this.hideErrorPopup();

    const popup = document.createElement("div");
    popup.id = "swagger-nav-error-popup";
    popup.style.cssText =
      "position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 16px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; font-family: sans-serif; font-size: 14px; max-width: 400px;";
    popup.textContent = message;
    document.body.appendChild(popup);
  }

  hideErrorPopup() {
    const popup = document.getElementById("swagger-nav-error-popup");
    if (popup) {
      popup.remove();
    }
  }

  startHealthCheck() {
    // This method should be implemented if health checks are needed
    // For now, it's a placeholder
  }

  stopHealthCheck() {
    // This method should be implemented if health checks are needed
    // For now, it's a placeholder
  }
}

// Initialize SwaggerNavigator
const swaggerNav = new SwaggerNavigator();

// Immediately check if we're on a Swagger UI page and restore functions if not
// This prevents interceptors from running on non-Swagger pages
// This check runs BEFORE init() to catch non-Swagger pages immediately
(function() {
  const isSwaggerUIPage = !!(
    document.querySelector(".swagger-ui") ||
    document.querySelector("#swagger-ui") ||
    document.querySelector('[data-testid="swagger-ui"]') ||
    document.querySelector(".opblock") ||
    document.querySelector(".swagger-container") ||
    window.ui ||
    window.swaggerUi
  );

  if (!isSwaggerUIPage) {
    // Not a Swagger UI page - restore original functions immediately
    // This prevents any interceptors from running
    if (window._swaggerNavOriginalFetch) {
      window.fetch = window._swaggerNavOriginalFetch;
      window._swaggerNavFetchInstalled = false;
    }
    if (XMLHttpRequest.prototype._swaggerNavOriginalSend) {
      XMLHttpRequest.prototype.send =
        XMLHttpRequest.prototype._swaggerNavOriginalSend;
      if (XMLHttpRequest.prototype._swaggerNavOriginalOpen) {
        XMLHttpRequest.prototype.open =
          XMLHttpRequest.prototype._swaggerNavOriginalOpen;
      }
      XMLHttpRequest.prototype._swaggerNavXHRInstalled = false;
    }
  }
})();

// Theme will be applied after Swagger UI detection in init()
swaggerNav.init();

// Listen for messages from options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RELOAD_BACKGROUND") {
    swaggerNavLog(
      "SwaggerNav: Received RELOAD_BACKGROUND message, reloading background..."
    );
    swaggerNav.applyNavBarBackground();
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});
