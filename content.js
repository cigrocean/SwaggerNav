// SwaggerNav - Content Script
// Detects Swagger UI and adds navigation sidebar

// VERSION is loaded from version.js

// Helper function to check if current page is Swagger UI
// Use try-catch to prevent infinite recursion from getters
function isSwaggerUIPage() {
  try {
    // Check DOM elements first (safest)
    if (
      document.querySelector(".swagger-ui") ||
      document.querySelector("#swagger-ui") ||
      document.querySelector('[data-testid="swagger-ui"]') ||
      document.querySelector(".opblock") ||
      document.querySelector(".swagger-container")
    ) {
      return true;
    }

    // Check window properties carefully to avoid getter recursion
    // Use hasOwnProperty to check if property exists without triggering getters
    if (window.hasOwnProperty("ui") && window.ui) {
      return true;
    }
    if (window.hasOwnProperty("swaggerUi") && window.swaggerUi) {
      return true;
    }

    return false;
  } catch (error) {
    // If there's any error (including stack overflow), return false safely
    console.warn("SwaggerNav: Error checking if Swagger UI page:", error);
    return false;
  }
}

// Conditional logging - only log on Swagger UI pages
function swaggerNavLog(...args) {
  if (isSwaggerUIPage()) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

// Conditional error logging - only log on Swagger UI pages
function swaggerNavError(...args) {
  if (isSwaggerUIPage()) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
}

// Conditional warning logging - only log on Swagger UI pages
function swaggerNavWarn(...args) {
  if (isSwaggerUIPage()) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
}

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

      // Re-apply themes and background now that settings are loaded
      // Only apply on Swagger UI pages
      if (isSwaggerUIPage()) {
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
        if (!isSwaggerUIPage()) {
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
          if (!isSwaggerUIPage()) {
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

          // Update settings UI
          this.updateSettingsUI();
        }
      });
    }
  }

  // Apply theme to Swagger UI main page (body classes for Swagger UI styling)
  applySwaggerUITheme() {
    // CRITICAL: Only apply theme on Swagger UI pages
    if (!isSwaggerUIPage()) {
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
    if (!isSwaggerUIPage()) {
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
    if (!isSwaggerUIPage()) {
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
    if (!isSwaggerUIPage()) {
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
    if (!isSwaggerUIPage()) {
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
      // Not a Swagger UI page - restore original functions if interceptors were installed
      this.restoreOriginalFunctions();
      // Stop any health checks
      this.stopHealthCheck();
      // Hide any error popups
      this.hideErrorPopup();

      // Check again after a delay (for SPAs)
      setTimeout(() => {
        this.isSwaggerUI = this.detectSwaggerUI();
        if (this.isSwaggerUI) {
          // Apply theme immediately when detected
          this.applySwaggerTheme();
          this.setup();
          // Also trigger sync after a delay to ensure Swagger UI is fully rendered
          setTimeout(() => {
            this.syncToCurrentSwaggerState();
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
  }

  // Setup resize listener to handle layout updates when monitors disconnect/reconnect
  setupResizeListener() {
    // Only setup on Swagger UI pages
    if (!isSwaggerUIPage()) {
      return;
    }

    // Debounce resize handler to avoid excessive calls
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Only handle on Swagger UI pages
        if (!isSwaggerUIPage()) {
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
        toggleBtn.querySelector("span").textContent = "◀";
        toggleBtn.title = "Show sidebar";
        toggleBtn.setAttribute("aria-label", "Show sidebar");
        toggleBtn.setAttribute("aria-expanded", "false");
      }
      this.createFloatingShowButton();
    }

    swaggerNavLog("SwaggerNav: Navigation bar created");
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
          // Apply constraints when sidebar is shown
          this.applyResponsiveConstraints();
          toggleBtn.querySelector("span").textContent = "▶";
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
        swaggerNavLog(
          "SwaggerNav: Requesting service worker to open options page"
        );

        // Send message to service worker to open options page
        // This avoids ERR_BLOCKED_BY_CLIENT since content scripts have limited API access
        chrome.runtime.sendMessage(
          { action: "openOptionsPage" },
          (response) => {
            if (chrome.runtime.lastError) {
              swaggerNavError(
                "SwaggerNav: Error sending message to service worker",
                chrome.runtime.lastError
              );
              // Fallback: try opening directly as a last resort
              window.open(chrome.runtime.getURL("options.html"), "_blank");
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
    floatingBtn.innerHTML = "<span aria-hidden='true'>◀</span>";
    floatingBtn.title = "Show API Navigator";
    floatingBtn.setAttribute("aria-label", "Show API Navigator sidebar");
    floatingBtn.addEventListener("click", () => {
      this.navBar.classList.remove("hidden");
      // Apply constraints when sidebar is shown
      this.applyResponsiveConstraints();
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
        `SwaggerNav: Enhanced dropdown - search history items: ${
          this.searchHistory?.length || 0
        }`
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
              const newAriaExpanded =
                clickableElement.getAttribute("aria-expanded");
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
              `SwaggerNav: Hash changed, syncing sidebar and scrolling to expanded endpoint (attempt ${
                retryCount + 1
              }): ${expandedOpblock.id}`
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
            `SwaggerNav: Syncing sidebar and scrolling to expanded endpoint (attempt ${
              retryCount + 1
            }): ${expandedOpblock.id}`
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
            `SwaggerNav: Endpoint not expanded yet, retrying in ${delay}ms (attempt ${
              retryCount + 1
            }/${maxRetries})`
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
    swaggerNavLog("SwaggerNav: Setting up parameter enhancements...");

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

  addSearchableSelects(opblock) {
    const paramRows = opblock.querySelectorAll(".parameters tbody tr");
    swaggerNavLog(`SwaggerNav: Found ${paramRows.length} parameter rows`);

    paramRows.forEach((row, index) => {
      const select = row.querySelector("select");
      if (!select) {
        swaggerNavLog(`SwaggerNav: Row ${index} - no select found`);
        return;
      }

      swaggerNavLog(
        `SwaggerNav: Row ${index} - found select with ${select.options.length} options`
      );
      swaggerNavLog(
        `SwaggerNav: Row ${index} - select parent:`,
        select.parentNode?.tagName,
        select.parentNode?.className
      );

      // Skip if already enhanced AND search wrapper still exists
      if (select.dataset.swaggerNavSearchable) {
        // Verify the search wrapper actually exists in DOM
        const existingWrapper = row.querySelector(".swagger-nav-select-search");
        if (existingWrapper) {
          swaggerNavLog(
            `SwaggerNav: Row ${index} - already enhanced and wrapper exists`
          );
          return;
        } else {
          // Wrapper was removed (endpoint was collapsed/reopened), reset flag
          swaggerNavLog(
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
        "width: 100% !important; max-width: 100% !important; margin-bottom: 6px; display: block !important; position: relative !important; box-sizing: border-box !important; z-index: 10000 !important;";

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

      // Create results dropdown with CSS variables (rendered in body to escape glass stacking contexts)
      const resultsDropdown = document.createElement("div");
      resultsDropdown.className = "swagger-nav-search-results";
      // Absolute overlay with extreme z-index so it always floats above Liquid Glass,
      // but scrolls with the page (top/left updated using scroll offsets)
      resultsDropdown.style.cssText = `display: none !important; position: absolute !important; max-height: 250px !important; overflow-y: auto !important; background: var(--sn-param-dropdown-bg) !important; border: 2px solid var(--sn-param-search-border) !important; border-radius: 4px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.35) !important; z-index: 2147483647 !important; box-sizing: border-box !important;`;

      searchWrapper.appendChild(searchInput);
      searchWrapper.appendChild(clearButton);
      document.body.appendChild(resultsDropdown);

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
        swaggerNavLog(`SwaggerNav: Row ${index} - search input added`);
      } catch (error) {
        swaggerNavError(`SwaggerNav: Row ${index} - ERROR:`, error);
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

      // On blur, do NOT immediately hide dropdown.
      // Visibility is controlled by click handlers so it doesn't flicker/disappear unexpectedly.
      searchInput.addEventListener("blur", () => {
        // no-op on purpose
      });

      // Hide dropdown when clicking outside (keep current value)
      document.addEventListener("click", (e) => {
        // Treat clicks inside the dropdown as "inside" so it doesn't immediately close
        if (
          !searchWrapper.contains(e.target) &&
          !resultsDropdown.contains(e.target)
        ) {
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

        // Position dropdown under the input using viewport coordinates.
        // Position dropdown under the input using viewport coordinates + scroll offsets.
        const rect = searchInput.getBoundingClientRect();
        const scrollY =
          window.scrollY || document.documentElement.scrollTop || 0;
        const scrollX =
          window.scrollX || document.documentElement.scrollLeft || 0;

        resultsDropdown.style.setProperty(
          "width",
          `${rect.width}px`,
          "important"
        );
        resultsDropdown.style.setProperty(
          "left",
          `${rect.left + scrollX}px`,
          "important"
        );
        resultsDropdown.style.setProperty(
          "top",
          `${rect.bottom + 2 + scrollY}px`,
          "important"
        );
        resultsDropdown.style.setProperty("display", "block", "important");

        if (options.length === 0) {
          const noResult = document.createElement("div");
          noResult.textContent = "No matches found";
          noResult.style.cssText = `padding: 10px 12px; color: var(--sn-param-no-result); font-size: 14px; text-align: center; font-style: italic;`;
          resultsDropdown.appendChild(noResult);
        } else {
          options.forEach((opt, idx) => {
            const resultItem = document.createElement("div");
            resultItem.textContent = opt.text;
            const computedStyle = `padding: 10px 12px !important; cursor: pointer !important; font-size: 14px !important; font-family: inherit !important; color: var(--sn-param-search-text) !important; background: var(--sn-param-dropdown-bg) !important; border-bottom: 1px solid var(--sn-param-item-border) !important; transition: background 0.15s !important;`;
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
          swaggerNavLog(
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
    // Early return if Form View is disabled
    if (!this.settings.enableFormView) {
      // If disabled, make sure any existing Form View containers are hidden
      const existingContainers = opblock.querySelectorAll(
        ".swagger-nav-body-container"
      );
      existingContainers.forEach((container) => {
        container.style.display = "none";
        // Show the original wrapper
        const wrapper = container.previousElementSibling;
        if (wrapper && wrapper.style.display === "none") {
          wrapper.style.display = "";
        }
      });
      return;
    }

    swaggerNavLog("SwaggerNav: addFormBuilder called");

    // Find ALL textareas - look for textareas that look like JSON request bodies
    const allTextareas = opblock.querySelectorAll("textarea");
    swaggerNavLog(
      `SwaggerNav: Found ${allTextareas.length} textareas in opblock`
    );

    let enhancedCount = 0;

    // Process EACH textarea that looks like a request body
    for (const textarea of allTextareas) {
      // Skip clones that we created
      if (textarea.dataset.swaggerNavClone === "true") {
        swaggerNavLog("SwaggerNav: Skipping clone textarea");
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
          swaggerNavLog(
            `SwaggerNav: Textarea already enhanced (verified), skipping`
          );
          continue;
        } else {
          // Flag was set but container doesn't exist - reset
          swaggerNavLog(
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

      swaggerNavLog(
        `SwaggerNav: Found JSON textarea ${
          enhancedCount + 1
        } to enhance! (ID: ${textarea.dataset.swaggerNavTextareaId})`
      );
      swaggerNavLog(
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
      swaggerNavLog("SwaggerNav: No JSON textareas found to enhance");
    } else {
      swaggerNavLog(`SwaggerNav: Enhanced ${enhancedCount} textarea(s)`);
    }
  }

  createFormBuilderForTextarea(textarea, opblock) {
    const textareaId = textarea.dataset.swaggerNavTextareaId || "unknown";
    swaggerNavLog(
      `SwaggerNav: Creating form builder for textarea ${textareaId}`
    );

    // Create container for side-by-side layout
    const container = document.createElement("div");
    container.className = "swagger-nav-body-container";
    container.dataset.textareaId = textareaId; // Link container to textarea
    swaggerNavLog(`SwaggerNav: Created container for textarea ${textareaId}`);

    // Wrap existing textarea in left panel
    const leftPanel = document.createElement("div");
    leftPanel.className = "swagger-nav-body-panel swagger-nav-body-json";

    const jsonHeader = document.createElement("div");
    jsonHeader.className = "swagger-nav-body-header";
    jsonHeader.innerHTML = "<strong>📄 JSON</strong>";
    leftPanel.appendChild(jsonHeader);

    // Get reference to original textarea parent
    const textareaWrapper = textarea.parentNode;
    swaggerNavLog("SwaggerNav: Textarea wrapper:", textareaWrapper);

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
        swaggerNavLog(
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
    swaggerNavLog(
      `SwaggerNav: Panels added to container for textarea ${textareaId}`
    );

    // Hide the original textarea wrapper (keep it in DOM!)
    textareaWrapper.style.display = "none";

    // Insert our container after the hidden wrapper
    textareaWrapper.after(container);
    swaggerNavLog(
      `SwaggerNav: Inserted container for textarea ${textareaId} after wrapper (wrapper now hidden)`
    );

    // Build form from JSON (use the clone)
    this.buildFormFromJSON(textareaClone, formContainer);

    // Debug: Count total containers in this opblock
    const totalContainers = opblock.querySelectorAll(
      ".swagger-nav-body-container"
    ).length;
    swaggerNavLog(
      `SwaggerNav: Total containers in this opblock: ${totalContainers}`
    );

    // Watch for textarea changes, but don't rebuild if form has focus
    let textareaUpdateTimeout;
    let isFormFocused = false;

    // Track when form inputs have focus
    formContainer.addEventListener("focusin", () => {
      isFormFocused = true;
      swaggerNavLog("SwaggerNav: Form has focus, pausing textarea sync");
    });

    formContainer.addEventListener("focusout", () => {
      // Small delay to check if focus moved to another form input
      setTimeout(() => {
        if (!formContainer.contains(document.activeElement)) {
          isFormFocused = false;
          swaggerNavLog("SwaggerNav: Form lost focus, resuming textarea sync");
        }
      }, 50);
    });

    textareaClone.addEventListener("input", () => {
      // Don't rebuild form if user is actively typing in it
      if (isFormFocused) {
        swaggerNavLog(
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
    swaggerNavLog(
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
      swaggerNavLog(
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
      swaggerNavLog(
        `SwaggerNav: Form built successfully for textarea ${textareaId}`
      );
    } catch (error) {
      formContainer.innerHTML =
        '<p class="swagger-nav-form-error">Invalid JSON</p>';
      swaggerNavLog(
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
            swaggerNavLog(
              `SwaggerNav: Allowing partial number input "${inputValue}" during typing`
            );
            return; // Skip update, let user finish typing
          }

          const parsed = parseFloat(inputValue);
          if (isNaN(parsed)) {
            swaggerNavWarn(
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
      swaggerNavError("SwaggerNav: Failed to update JSON from form", error);
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

  // ==============================================================================
  // Feature 3: Response View (Structured view with editable checkboxes for comparison)
  // ==============================================================================

  addResponseView(opblock) {
    // Early return if Response View is disabled
    if (!this.settings.enableResponseView) {
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
      return;
    }

    // When Response View is enabled, remove buttons from default response
    this.removeButtonsFromDefaultResponse(opblock);

    swaggerNavLog("SwaggerNav: addResponseView called");

    // Find response code blocks - Swagger UI displays responses in .highlight-code pre/code elements
    // Look for response sections that contain JSON
    const responseWrappers = opblock.querySelectorAll(
      ".response-wrapper, .responses-wrapper"
    );

    responseWrappers.forEach((wrapper) => {
      // Find code blocks with JSON responses
      const codeBlocks = wrapper.querySelectorAll(
        ".highlight-code pre code, pre code.highlight-code"
      );

      codeBlocks.forEach((codeElement) => {
        // Skip if already enhanced (but check if Response View is disabled and hide existing containers)
        if (codeElement.dataset.swaggerNavResponseView) {
          // If Response View is disabled but we have a container, hide it
          if (!this.settings.enableResponseView) {
            const parentContainer = codeElement.closest(
              ".response-col_description, .response-body, .response"
            );
            if (parentContainer) {
              const existingContainer = parentContainer.querySelector(
                ".swagger-nav-response-container"
              );
              if (existingContainer) {
                existingContainer.style.display = "none";
                const hiddenOriginal = parentContainer.querySelector(
                  "[data-swagger-nav-hidden-original='true']"
                );
                if (hiddenOriginal) {
                  hiddenOriginal.style.display = "";
                }
              }
            }
          }
          return;
        }

        // Skip if Response View is disabled
        if (!this.settings.enableResponseView) {
          return;
        }

        // Mark as enhanced (do this early to prevent re-processing)
        codeElement.dataset.swaggerNavResponseView = "true";

        // Find the parent pre element
        const preElement = codeElement.closest("pre");
        if (!preElement) return;

        // Find the parent container (usually .response-col_description or similar)
        const parentContainer = preElement.closest(
          ".response-col_description, .response-body, .response"
        );
        if (!parentContainer) return;
        
        // Check if this looks like JSON (do this after finding parentContainer)
        const text = codeElement.textContent.trim();
        if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
          return;
        }

        // Try to parse as JSON for initial validation
        let initialResponseData;
        try {
          initialResponseData = JSON.parse(text);
        } catch (e) {
          // Not valid JSON, skip
          return;
        }
        
        // Function to get CURRENT response data dynamically (not from initial parse)
        // This ensures we always read from the LIVE response, not stale data
        // NOTE: This function will be defined after container is created, but we'll define it here
        // and update it later to reference container
        let getCurrentResponseData;

        // Double-check that Response View is enabled BEFORE any processing
        if (!this.settings.enableResponseView) {
          return;
        }

        // Check if response view already exists (even if hidden)
        const existingContainer = parentContainer.querySelector(
          ".swagger-nav-response-container"
        );
        if (existingContainer) {
          // If Response View is enabled and container exists but is hidden, show it
          if (existingContainer.style.display === "none") {
            existingContainer.style.display = "grid";
            // Hide the original wrapper
            const hiddenOriginal = parentContainer.querySelector(
              "[data-swagger-nav-hidden-original='true']"
            );
            if (hiddenOriginal) {
              hiddenOriginal.style.display = "none";
            }
          }
          return;
        }

        // Find the response body wrapper to replace
        // Swagger UI typically wraps response code in .highlight-code or similar
        const responseBodyWrapper = preElement.parentElement;
        if (!responseBodyWrapper) return;

        // Store the original wrapper for restoration when Response View is disabled
        // Store it as a data attribute on the container so we can restore it later
        const originalWrapper = responseBodyWrapper.cloneNode(true);
        originalWrapper.style.display = "none"; // Hide original, don't remove yet

        // We're using custom buttons now, so no need to search for Swagger UI's buttons
        const wrapperParent = responseBodyWrapper.parentElement;

        // Create container for response view
        const container = document.createElement("div");
        container.className = "swagger-nav-response-container";
        // Don't set grid-template-columns inline - let CSS handle it (including responsive breakpoints)
        // CSS already sets grid-template-columns: 1fr 1fr by default, and 1fr for screens < 1600px
        container.style.cssText = "display: grid; gap: 16px; width: 100%;";
        
        // NOW define getCurrentResponseData function (after container and parentContainer exist)
        getCurrentResponseData = () => {
          // Strategy 1: Find the CURRENT visible response (most reliable)
          // Look for response code elements that are currently visible and not marked as processed
          const allCodeElements = parentContainer.querySelectorAll(
            "pre code, .highlight-code code, pre.highlight-code code"
          );
          
          // Find the most recent/current response code element
          // Usually Swagger UI puts the latest response last or in a specific wrapper
          let currentCodeElement = null;
          
          // First, try to find a visible response that's not our clone
          for (let i = allCodeElements.length - 1; i >= 0; i--) {
            const el = allCodeElements[i];
            // Skip if it's part of our Response View container (now that container exists)
            if (container && container.contains(el)) continue;
            // Skip if it's already marked as processed
            if (el.dataset.swaggerNavResponseView) continue;
            
            const text = el.textContent.trim();
            if (text && (text.startsWith("{") || text.startsWith("["))) {
              // Check if this element is visible (not hidden)
              const preParent = el.closest("pre");
              if (preParent && preParent.offsetParent !== null) {
                currentCodeElement = el;
                break;
              }
            }
          }
          
          // Strategy 2: If no visible element found, check the hidden original wrapper
          if (!currentCodeElement) {
            const originalWrapper = parentContainer.querySelector(
              "[data-swagger-nav-hidden-original='true']"
            );
            if (originalWrapper) {
              currentCodeElement = originalWrapper.querySelector("code") || 
                                  originalWrapper.querySelector("pre code") ||
                                  originalWrapper.querySelector("pre");
            }
          }
          
          // Strategy 3: Find any response code element in the container
          if (!currentCodeElement) {
            const currentPre = parentContainer.querySelector(
              "pre:not([data-swagger-nav-response-view]):not(.swagger-nav-response-code pre)"
            );
            if (currentPre) {
              currentCodeElement = currentPre.querySelector("code") || currentPre;
            }
          }
          
          // Strategy 4: Fallback to the initial codeElement (should rarely happen)
          if (!currentCodeElement) {
            currentCodeElement = codeElement;
          }
          
          if (!currentCodeElement) {
            swaggerNavWarn("SwaggerNav: Could not find current response element");
            return null;
          }
          
          const text = currentCodeElement.textContent.trim();
          if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
            return null;
          }
          
          try {
            const data = JSON.parse(text);
            // Only log occasionally to avoid performance impact
            if (Math.random() < 0.1) { // Log only 10% of the time
              swaggerNavLog("SwaggerNav: Got current response data", {
                textLength: text.length,
                keys: typeof data === 'object' && data !== null ? Object.keys(data).slice(0, 3) : 'not object'
              });
            }
            return data;
          } catch (e) {
            swaggerNavWarn("SwaggerNav: Failed to parse response data", e);
            return null;
          }
        };

        // Left panel: Original code view
        const leftPanel = document.createElement("div");
        leftPanel.className =
          "swagger-nav-response-panel swagger-nav-response-code";
        leftPanel.style.cssText =
          "min-width: 0; display: flex; flex-direction: column;";

        const codeHeader = document.createElement("div");
        codeHeader.className = "swagger-nav-body-header";
        codeHeader.style.cssText =
          "display: flex !important; justify-content: space-between !important; align-items: center !important; gap: 8px !important; width: 100% !important; position: relative !important;";

        const codeHeaderTitle = document.createElement("strong");
        codeHeaderTitle.textContent = "📄 Response JSON";
        codeHeaderTitle.style.cssText = "flex-shrink: 0 !important;";
        codeHeader.appendChild(codeHeaderTitle);

        // Clone the original pre element FIRST so we can reference it in buttons
        // Use cloneNode(true) to preserve all HTML structure including syntax highlighting
        const codeClone = preElement.cloneNode(true);
        // Preserve original classes for syntax highlighting
        codeClone.className = preElement.className;
        // Only override specific styles, don't replace all styles
        codeClone.style.margin = "0";
        codeClone.style.flex = "1";
        codeClone.style.overflow = "auto";

        // Create custom copy/download buttons BEFORE appending header to panel
        // We'll implement the functionality ourselves instead of trying to find Swagger UI's buttons
        const buttonsWrapper = document.createElement("div");
        buttonsWrapper.className = "swagger-nav-response-buttons";
        buttonsWrapper.style.cssText =
          "display: flex !important; gap: 16px !important; align-items: center !important; visibility: visible !important; opacity: 1 !important; flex-shrink: 0 !important; margin-left: auto !important; flex-wrap: wrap !important; width: auto !important;";

        // Get the response text from the LIVE original response element (not the clone)
        // This ensures we always get the current response, not stale data
        const getResponseText = () => {
          // Find the original response wrapper (it might be hidden but still exists)
          const originalWrapper = parentContainer.querySelector(
            "[data-swagger-nav-hidden-original='true']"
          );
          if (originalWrapper) {
            // Find the code element in the original wrapper
            const originalCodeEl = originalWrapper.querySelector("code") || 
                                   originalWrapper.querySelector("pre code") ||
                                   originalWrapper.querySelector("pre");
            if (originalCodeEl) {
              return originalCodeEl.textContent || originalCodeEl.innerText || "";
            }
          }
          // Fallback: try to find the current response in the parent container
          const currentPre = parentContainer.querySelector("pre:not([data-swagger-nav-response-view])");
          if (currentPre) {
            const currentCodeEl = currentPre.querySelector("code") || currentPre;
            return currentCodeEl.textContent || currentCodeEl.innerText || "";
          }
          // Last resort: use the clone (but this should rarely happen)
          const codeEl = codeClone.querySelector("code") || codeClone;
          return codeEl.textContent || codeEl.innerText || "";
        };

        // Create Copy button
        const customCopyButton = document.createElement("button");
        customCopyButton.className = "copy-to-clipboard";
        customCopyButton.setAttribute("data-swagger-nav-custom", "true");
        customCopyButton.innerHTML = "📋 Copy";
        customCopyButton.style.cssText =
          "padding: 4px 8px !important; border: 1px solid #ccc !important; border-radius: 4px !important; background: rgba(255, 255, 255, 0.1) !important; cursor: pointer !important; font-size: 12px !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; color: inherit !important; min-width: auto !important; width: auto !important; height: auto !important; margin: 0 !important; margin-right: 16px !important; flex-shrink: 0 !important; box-sizing: border-box !important;";
        swaggerNavLog("SwaggerNav: Created copy button", customCopyButton);
        customCopyButton.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            const text = getResponseText();
            await navigator.clipboard.writeText(text);
            customCopyButton.innerHTML = "✓ Copied!";
            setTimeout(() => {
              customCopyButton.innerHTML = "📋 Copy";
            }, 2000);
            swaggerNavLog("SwaggerNav: Copied response to clipboard");
          } catch (err) {
            swaggerNavWarn("SwaggerNav: Failed to copy to clipboard", err);
            // Fallback for older browsers
            const textarea = document.createElement("textarea");
            textarea.value = getResponseText();
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            try {
              document.execCommand("copy");
              customCopyButton.innerHTML = "✓ Copied!";
              setTimeout(() => {
                customCopyButton.innerHTML = "📋 Copy";
              }, 2000);
            } catch (fallbackErr) {
              swaggerNavWarn(
                "SwaggerNav: Fallback copy also failed",
                fallbackErr
              );
            }
            document.body.removeChild(textarea);
          }
        });
        buttonsWrapper.appendChild(customCopyButton);
        swaggerNavLog("SwaggerNav: Added copy button to wrapper", {
          wrapper: buttonsWrapper,
          children: buttonsWrapper.children.length,
        });

        // Create Download button
        const customDownloadButton = document.createElement("button");
        customDownloadButton.className = "download-contents";
        customDownloadButton.setAttribute("data-swagger-nav-custom", "true");
        customDownloadButton.innerHTML = "💾 Download";
        customDownloadButton.style.cssText =
          "padding: 4px 8px !important; border: 1px solid #ccc !important; border-radius: 4px !important; background: rgba(255, 255, 255, 0.1) !important; cursor: pointer !important; font-size: 12px !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; color: inherit !important; min-width: auto !important; width: auto !important; height: auto !important; margin: 0 !important; flex-shrink: 0 !important; box-sizing: border-box !important;";
        swaggerNavLog(
          "SwaggerNav: Created download button",
          customDownloadButton
        );
        customDownloadButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            const text = getResponseText();
            const blob = new Blob([text], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "response.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            swaggerNavLog("SwaggerNav: Downloaded response");
          } catch (err) {
            swaggerNavWarn("SwaggerNav: Failed to download", err);
          }
        });
        buttonsWrapper.appendChild(customDownloadButton);
        swaggerNavLog("SwaggerNav: Added download button to wrapper", {
          wrapper: buttonsWrapper,
          children: buttonsWrapper.children.length,
        });

        // Add buttons to header BEFORE appending header to panel
        codeHeader.appendChild(buttonsWrapper);

        // NOW append header and codeClone to panel
        leftPanel.appendChild(codeHeader);
        leftPanel.appendChild(codeClone);

        // Force a reflow to ensure buttons are rendered
        void codeHeader.offsetHeight;
        void buttonsWrapper.offsetHeight;

        swaggerNavLog(
          "SwaggerNav: Added custom copy/download buttons to Response View header",
          {
            buttonsWrapper: buttonsWrapper,
            buttonsCount: buttonsWrapper.children.length,
            copyButton: customCopyButton,
            downloadButton: customDownloadButton,
            codeHeader: codeHeader,
            codeHeaderChildren: codeHeader.children.length,
            buttonsWrapperStyle:
              window.getComputedStyle(buttonsWrapper).display,
            copyButtonStyle: window.getComputedStyle(customCopyButton).display,
            downloadButtonStyle:
              window.getComputedStyle(customDownloadButton).display,
          }
        );

        // Verify buttons are actually in the DOM and visible
        setTimeout(() => {
          const buttonsInDOM = codeHeader.querySelectorAll(
            '[data-swagger-nav-custom="true"]'
          );
          swaggerNavLog(
            `SwaggerNav: Buttons in DOM: ${buttonsInDOM.length}`,
            buttonsInDOM
          );

          buttonsInDOM.forEach((btn, idx) => {
            const computedStyle = window.getComputedStyle(btn);
            swaggerNavLog(`SwaggerNav: Button ${idx} computed styles:`, {
              display: computedStyle.display,
              visibility: computedStyle.visibility,
              opacity: computedStyle.opacity,
              width: computedStyle.width,
              height: computedStyle.height,
              offsetParent: btn.offsetParent !== null,
              parentDisplay: btn.parentElement
                ? window.getComputedStyle(btn.parentElement).display
                : "N/A",
              parentVisibility: btn.parentElement
                ? window.getComputedStyle(btn.parentElement).visibility
                : "N/A",
            });

            // Force visibility if hidden
            if (
              computedStyle.display === "none" ||
              computedStyle.visibility === "hidden" ||
              computedStyle.opacity === "0"
            ) {
              btn.style.setProperty("display", "inline-block", "important");
              btn.style.setProperty("visibility", "visible", "important");
              btn.style.setProperty("opacity", "1", "important");
              swaggerNavLog(`SwaggerNav: Force-enabled button ${idx}`);
            }
          });

          // Also check buttonsWrapper
          const wrapperStyle = window.getComputedStyle(buttonsWrapper);
          swaggerNavLog("SwaggerNav: buttonsWrapper styles:", {
            display: wrapperStyle.display,
            visibility: wrapperStyle.visibility,
            opacity: wrapperStyle.opacity,
            width: wrapperStyle.width,
            height: wrapperStyle.height,
          });

          if (buttonsInDOM.length === 0) {
            swaggerNavWarn(
              "SwaggerNav: WARNING - Buttons not found in DOM after adding!"
            );
          } else if (
            buttonsInDOM.length > 0 &&
            buttonsInDOM[0].offsetParent === null
          ) {
            swaggerNavWarn(
              "SwaggerNav: WARNING - Buttons exist but are not visible (offsetParent is null)!"
            );
          }
        }, 100);

        // Right panel: Response View
        const rightPanel = document.createElement("div");
        rightPanel.className =
          "swagger-nav-response-panel swagger-nav-response-view";
        rightPanel.style.cssText =
          "min-width: 0; display: flex; flex-direction: column;";

        const viewHeader = document.createElement("div");
        viewHeader.className = "swagger-nav-body-header";
        viewHeader.innerHTML = "<strong>📊 Response View</strong>";
        rightPanel.appendChild(viewHeader);

        const viewContainer = document.createElement("div");
        viewContainer.className = "swagger-nav-response-view-container";
        rightPanel.appendChild(viewContainer);

        // Add panels to container
        container.appendChild(leftPanel);
        container.appendChild(rightPanel);

        // Store reference to original wrapper for restoration
        container.dataset.swaggerNavOriginalWrapper = "true";
        container.dataset.swaggerNavOriginalWrapperElement = "true"; // Mark this container

        // Hide the wrapper immediately since we're using custom buttons
        // No need to wait for Swagger UI's buttons anymore
        const hideWrapper = () => {
          if (
            responseBodyWrapper &&
            responseBodyWrapper.style.display !== "none"
          ) {
            responseBodyWrapper.style.display = "none";
            responseBodyWrapper.dataset.swaggerNavHiddenOriginal = "true";
            swaggerNavLog("SwaggerNav: Hidden original wrapper");
          }
        };

        // Hide wrapper immediately
        hideWrapper();

        // OLD CODE REMOVED - We use custom buttons now, no need to search for Swagger UI's buttons
        const waitForButtonsAndHide_DEPRECATED = () => {
          let hasClonedButtons = false;
          let hideTimeout = null;
          let checkCount = 0;
          const maxChecks = 50; // Check up to 50 times (10 seconds total)

          // Function to search for buttons and clone them if found
          const searchAndCloneButtons = () => {
            checkCount++;
            swaggerNavLog(
              `SwaggerNav: Button search attempt ${checkCount}/${maxChecks}`
            );

            // FIRST: Check if buttons exist in the ORIGINAL response BEFORE we do anything
            // This is the most reliable check - look at the actual DOM structure
            const originalResponseArea =
              responseBodyWrapper || wrapperParent || parentContainer;

            if (originalResponseArea) {
              // Search the entire response area, including all descendants
              const allButtonsInResponse =
                originalResponseArea.querySelectorAll("*");

              // Filter for actual button-like elements
              const actualButtons = Array.from(allButtonsInResponse).filter(
                (el) => {
                  const hasCopyClass =
                    el.classList?.contains("copy-to-clipboard") ||
                    el.className?.includes("copy");
                  const hasDownloadClass =
                    el.classList?.contains("download-contents") ||
                    el.classList?.contains("btn-download") ||
                    el.className?.includes("download");
                  const isButton =
                    el.tagName === "BUTTON" ||
                    el.getAttribute("role") === "button";
                  const hasButtonText =
                    el.textContent &&
                    (el.textContent.toLowerCase().includes("copy") ||
                      el.textContent.toLowerCase().includes("download"));

                  return (
                    (hasCopyClass ||
                      hasDownloadClass ||
                      (isButton && hasButtonText)) &&
                    !el.hasAttribute("data-swagger-nav-cloned")
                  );
                }
              );

              swaggerNavLog(
                `SwaggerNav: Found ${actualButtons.length} button-like elements in response area`
              );

              if (actualButtons.length > 0) {
                actualButtons.forEach((btn) => {
                  swaggerNavLog("SwaggerNav: Button candidate:", {
                    tag: btn.tagName,
                    classes: btn.className,
                    text: btn.textContent?.substring(0, 30),
                    parent: btn.parentElement?.tagName,
                    visible: btn.offsetParent !== null,
                  });
                });
              }
            }
            // Search in multiple locations - be very aggressive
            const searchLocations = [
              responseBodyWrapper,
              wrapperParent,
              parentContainer,
              opblock,
              preElement.closest(".highlight-code"),
              preElement.parentElement,
              preElement.parentElement?.parentElement,
              document.querySelector(".response-col_description"),
              document.querySelector(".response-body"),
              document.querySelector(".responses-wrapper"),
            ].filter(Boolean);

            let foundCopy = null;
            let foundDownload = null;

            // First, try to find buttons anywhere in the opblock (most comprehensive)
            // Search for ANY element that might be a button
            const allPotentialButtons = opblock.querySelectorAll(
              ".copy-to-clipboard, .download-contents, .btn-download, [class*='copy'], [class*='download'], button, [role='button']"
            );

            swaggerNavLog(
              `SwaggerNav: Found ${allPotentialButtons.length} potential buttons/elements in opblock`
            );

            // Also log the structure for debugging
            if (allPotentialButtons.length === 0) {
              swaggerNavLog(
                "SwaggerNav: No buttons found in opblock, checking DOM structure..."
              );
              swaggerNavLog(
                "SwaggerNav: responseBodyWrapper:",
                responseBodyWrapper?.outerHTML?.substring(0, 200)
              );
              swaggerNavLog(
                "SwaggerNav: wrapperParent:",
                wrapperParent?.outerHTML?.substring(0, 200)
              );
              swaggerNavLog(
                "SwaggerNav: parentContainer:",
                parentContainer?.outerHTML?.substring(0, 200)
              );
            }

            allPotentialButtons.forEach((btn) => {
              // Check if it's actually a button (has click handler or button-like structure)
              const isCopy =
                btn.classList.contains("copy-to-clipboard") ||
                (btn.className &&
                  btn.className.includes("copy") &&
                  !btn.className.includes("download"));
              const isDownload =
                btn.classList.contains("download-contents") ||
                btn.classList.contains("btn-download") ||
                (btn.className && btn.className.includes("download"));

              // Make sure button is near the response (not in a different part of the opblock)
              const isNearResponse =
                responseBodyWrapper?.contains(btn) ||
                wrapperParent?.contains(btn) ||
                parentContainer?.contains(btn) ||
                btn.closest(".response") ||
                btn.closest(".response-body") ||
                btn.closest(".response-col_description") ||
                btn.closest(".highlight-code");

              if (
                isNearResponse &&
                !btn.hasAttribute("data-swagger-nav-cloned")
              ) {
                if (isCopy && !foundCopy) {
                  foundCopy = btn;
                  swaggerNavLog(
                    "SwaggerNav: Found copy button in opblock search",
                    {
                      element: btn,
                      classes: btn.className,
                      text: btn.textContent?.substring(0, 50),
                    }
                  );
                }
                if (isDownload && !foundDownload) {
                  foundDownload = btn;
                  swaggerNavLog(
                    "SwaggerNav: Found download button in opblock search",
                    {
                      element: btn,
                      classes: btn.className,
                      text: btn.textContent?.substring(0, 50),
                    }
                  );
                }
              }
            });

            // Also search each location individually (fallback) - search more broadly
            if (!foundCopy || !foundDownload) {
              for (const location of searchLocations) {
                if (!foundCopy) {
                  // Try multiple selectors
                  const btn =
                    location?.querySelector(".copy-to-clipboard") ||
                    location?.querySelector("[class*='copy']") ||
                    location?.querySelector("button[title*='copy' i]") ||
                    location?.querySelector("button[aria-label*='copy' i]");
                  if (btn && !btn.hasAttribute("data-swagger-nav-cloned")) {
                    foundCopy = btn;
                    swaggerNavLog(
                      "SwaggerNav: Found copy button in location search",
                      { location, btn }
                    );
                  }
                }
                if (!foundDownload) {
                  // Try multiple selectors
                  const btn =
                    location?.querySelector(".download-contents") ||
                    location?.querySelector(".btn-download") ||
                    location?.querySelector("[class*='download']") ||
                    location?.querySelector("button[title*='download' i]") ||
                    location?.querySelector("button[aria-label*='download' i]");
                  if (btn && !btn.hasAttribute("data-swagger-nav-cloned")) {
                    foundDownload = btn;
                    swaggerNavLog(
                      "SwaggerNav: Found download button in location search",
                      { location, btn }
                    );
                  }
                }
              }
            }

            // Final check: search the entire document if still not found
            if (!foundCopy || !foundDownload) {
              swaggerNavLog(
                "SwaggerNav: Buttons not found in opblock, searching entire document..."
              );
              const docCopy = document.querySelector(".copy-to-clipboard");
              const docDownload = document.querySelector(
                ".download-contents, .btn-download"
              );

              if (docCopy && !docCopy.hasAttribute("data-swagger-nav-cloned")) {
                // Check if it's near our response
                const isNear =
                  opblock.contains(docCopy) ||
                  responseBodyWrapper?.contains(docCopy) ||
                  wrapperParent?.contains(docCopy);
                if (isNear && !foundCopy) {
                  foundCopy = docCopy;
                  swaggerNavLog(
                    "SwaggerNav: Found copy button in document search"
                  );
                }
              }

              if (
                docDownload &&
                !docDownload.hasAttribute("data-swagger-nav-cloned")
              ) {
                // Check if it's near our response
                const isNear =
                  opblock.contains(docDownload) ||
                  responseBodyWrapper?.contains(docDownload) ||
                  wrapperParent?.contains(docDownload);
                if (isNear && !foundDownload) {
                  foundDownload = docDownload;
                  swaggerNavLog(
                    "SwaggerNav: Found download button in document search"
                  );
                }
              }
            }

            // CRITICAL: Extract buttons from inside wrapper BEFORE cloning
            // This ensures buttons stay visible even when wrapper is hidden
            if (foundCopy && responseBodyWrapper?.contains(foundCopy)) {
              // Move button out of wrapper to parent so it stays visible
              if (
                wrapperParent &&
                foundCopy.parentElement === responseBodyWrapper
              ) {
                wrapperParent.insertBefore(foundCopy, responseBodyWrapper);
                swaggerNavLog(
                  "SwaggerNav: Extracted copy button from wrapper before hiding"
                );
              }
            }
            if (foundDownload && responseBodyWrapper?.contains(foundDownload)) {
              // Move button out of wrapper to parent so it stays visible
              if (
                wrapperParent &&
                foundDownload.parentElement === responseBodyWrapper
              ) {
                wrapperParent.insertBefore(foundDownload, responseBodyWrapper);
                swaggerNavLog(
                  "SwaggerNav: Extracted download button from wrapper before hiding"
                );
              }
            }

            // Clone buttons if found and not already in header
            if (
              foundCopy &&
              !buttonsWrapper.querySelector(".copy-to-clipboard")
            ) {
              const copyBtnClone = foundCopy.cloneNode(true);
              copyBtnClone.className = foundCopy.className;
              copyBtnClone.setAttribute("data-swagger-nav-cloned", "true");
              copyBtnClone.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                foundCopy.click();
              });
              buttonsWrapper.appendChild(copyBtnClone);
              hasClonedButtons = true;

              // Ensure original button stays visible (it's now outside the wrapper)
              if (
                foundCopy.parentElement &&
                foundCopy.parentElement !== responseBodyWrapper
              ) {
                foundCopy.style.display = "";
                foundCopy.style.visibility = "visible";
              }
            }

            if (
              foundDownload &&
              !buttonsWrapper.querySelector(".download-contents, .btn-download")
            ) {
              const downloadBtnClone = foundDownload.cloneNode(true);
              downloadBtnClone.className = foundDownload.className;
              downloadBtnClone.setAttribute("data-swagger-nav-cloned", "true");
              downloadBtnClone.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                foundDownload.click();
              });
              buttonsWrapper.appendChild(downloadBtnClone);
              hasClonedButtons = true;

              // Ensure original button stays visible (it's now outside the wrapper)
              if (
                foundDownload.parentElement &&
                foundDownload.parentElement !== responseBodyWrapper
              ) {
                foundDownload.style.display = "";
                foundDownload.style.visibility = "visible";
              }
            }

            return hasClonedButtons;
          };

          // Function to hide the wrapper
          const hideWrapper = () => {
            if (
              responseBodyWrapper &&
              responseBodyWrapper.style.display !== "none"
            ) {
              responseBodyWrapper.style.display = "none";
              responseBodyWrapper.dataset.swaggerNavHiddenOriginal = "true";
              swaggerNavLog("SwaggerNav: Hidden original wrapper");
            }
          };

          // Initial check - try multiple times with increasing delays
          // Swagger UI might add buttons with significant delays
          const tryFindButtons = () => {
            if (searchAndCloneButtons()) {
              // Buttons found! Hide wrapper after short delay
              if (hideTimeout) clearTimeout(hideTimeout);
              hideTimeout = setTimeout(hideWrapper, 300);
              return true;
            }
            return false;
          };

          // Try immediately
          if (tryFindButtons()) {
            return; // Found buttons, done!
          }

          // No buttons found yet, watch for them with multiple strategies
          const buttonObserver = new MutationObserver(() => {
            if (tryFindButtons()) {
              buttonObserver.disconnect();
            }
          });

          // Observe multiple locations for button additions
          const observeTargets = [
            responseBodyWrapper,
            wrapperParent,
            parentContainer,
            opblock,
            document.body, // Also watch entire body in case buttons are added elsewhere
          ].filter(Boolean);

          observeTargets.forEach((target) => {
            buttonObserver.observe(target, {
              childList: true,
              subtree: true,
              attributes: true, // Also watch for attribute changes (like style changes that make buttons visible)
              attributeFilter: ["style", "class"], // Only watch style and class changes
            });
          });

          // Also check periodically (fallback) - more aggressive checking
          const checkInterval = setInterval(() => {
            if (checkCount >= maxChecks) {
              clearInterval(checkInterval);
              buttonObserver.disconnect();
              if (!hasClonedButtons) {
                swaggerNavWarn(
                  `SwaggerNav: No buttons found after ${maxChecks} checks (10s), hiding wrapper anyway`
                );
              }
              hideWrapper();
              return;
            }

            if (tryFindButtons()) {
              clearInterval(checkInterval);
              buttonObserver.disconnect();
            }
          }, 200); // Check every 200ms

          // Maximum wait time: 10 seconds (50 checks * 200ms), then hide anyway
          hideTimeout = setTimeout(() => {
            clearInterval(checkInterval);
            buttonObserver.disconnect();
            if (!hasClonedButtons) {
              swaggerNavWarn(
                "SwaggerNav: No buttons found after 10s timeout, hiding wrapper anyway"
              );
            }
            hideWrapper();
          }, 10000);
        };

        // OLD CODE REMOVED - We use custom buttons now
        // waitForButtonsAndHide_DEPRECATED();

        // Insert our container right after the original wrapper (still visible, will be hidden later)
        if (
          wrapperParent &&
          responseBodyWrapper.parentElement === wrapperParent
        ) {
          wrapperParent.insertBefore(
            container,
            responseBodyWrapper.nextSibling
          );
        } else if (
          parentContainer &&
          responseBodyWrapper.parentElement === parentContainer
        ) {
          parentContainer.insertBefore(
            container,
            responseBodyWrapper.nextSibling
          );
        } else {
          // Fallback: append to the parent
          const insertParent = wrapperParent || parentContainer;
          if (insertParent) {
            insertParent.appendChild(container);
          }
        }

        // Build response view - ALWAYS get current data right before building
        // Use initialResponseData as fallback if getCurrentResponseData fails
        const currentResponseData = getCurrentResponseData ? getCurrentResponseData() : initialResponseData;
        if (currentResponseData) {
          this.buildResponseView(currentResponseData, viewContainer);
        } else {
          swaggerNavWarn("SwaggerNav: Could not get current response data for Response View");
          // Don't return - use initialResponseData as fallback
          if (initialResponseData) {
            this.buildResponseView(initialResponseData, viewContainer);
          } else {
            return;
          }
        }

        // No need to search for Swagger UI buttons anymore - we use custom buttons

        // Set max-height to limit panel height and enable scrolling
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          const codeHeight = codeClone.offsetHeight || codeClone.scrollHeight;
          if (codeHeight > 0) {
            // Set max-height based on original height, but cap at 600px for better UX
            const maxPanelHeight = Math.min(
              Math.max(codeHeight + 60, 250),
              600
            );
            // Set max-height instead of fixed height to allow scrolling
            leftPanel.style.maxHeight = `${maxPanelHeight}px`;
            rightPanel.style.maxHeight = `${maxPanelHeight}px`;
          } else {
            // Fallback max-height if height can't be determined
            const maxPanelHeight = 400;
            leftPanel.style.maxHeight = `${maxPanelHeight}px`;
            rightPanel.style.maxHeight = `${maxPanelHeight}px`;
          }
        });

        // Function to match max-heights
        const matchHeights = () => {
          requestAnimationFrame(() => {
            const codeHeight = codeClone.offsetHeight || codeClone.scrollHeight;
            if (codeHeight > 0) {
              // Set max-height based on original height, but cap at 600px for better UX
              const maxPanelHeight = Math.min(
                Math.max(codeHeight + 60, 250),
                600
              );
              // Set max-height instead of fixed height to allow scrolling
              leftPanel.style.maxHeight = `${maxPanelHeight}px`;
              rightPanel.style.maxHeight = `${maxPanelHeight}px`;
            } else {
              // Fallback max-height if height can't be determined
              const maxPanelHeight = 400;
              leftPanel.style.maxHeight = `${maxPanelHeight}px`;
              rightPanel.style.maxHeight = `${maxPanelHeight}px`;
            }
          });
        };

        // Watch for changes in the ORIGINAL response element (not the clone)
        // Swagger UI updates the original, so we need to watch it and sync the clone
        const originalCodeElement = preElement.querySelector("code") || preElement;
        
        // Debounce updates to avoid excessive processing
        let updateTimeout = null;
        let lastResponseText = null;
        
        const updateResponseView = () => {
          // Check if Response View is still enabled before updating
          if (!this.settings.enableResponseView) {
            return;
          }

          // Find the CURRENT original response element (it might have been replaced)
          let currentOriginalElement = originalCodeElement;
          if (!document.contains(originalCodeElement)) {
            // Original element was replaced, find the new one
            const hiddenWrapper = parentContainer.querySelector(
              "[data-swagger-nav-hidden-original='true']"
            );
            if (hiddenWrapper) {
              currentOriginalElement = hiddenWrapper.querySelector("code") || 
                                      hiddenWrapper.querySelector("pre code") ||
                                      hiddenWrapper.querySelector("pre");
            }
            // If still not found, try finding any code element in the parent container
            if (!currentOriginalElement) {
              const currentPre = parentContainer.querySelector("pre:not([data-swagger-nav-response-view])");
              if (currentPre) {
                currentOriginalElement = currentPre.querySelector("code") || currentPre;
              }
            }
          }

          if (!currentOriginalElement) {
            return; // Can't find the response element
          }

          // Get current text first (cheaper check)
          const newText = currentOriginalElement.textContent.trim();
          
          // Skip if text hasn't actually changed
          if (newText === lastResponseText) {
            matchHeights(); // Still update heights for size changes
            return;
          }
          
          // Only parse and rebuild if text actually changed
          if (newText && (newText.startsWith("{") || newText.startsWith("["))) {
            try {
              const latestData = JSON.parse(newText);
              lastResponseText = newText;
              
              // Update the clone to match the original (preserve syntax highlighting HTML)
              const clonedCodeElement = codeClone.querySelector("code") || codeClone;
              const originalCodeElement = currentOriginalElement.querySelector("code") || currentOriginalElement;
              
              if (clonedCodeElement && originalCodeElement) {
                // Preserve the HTML structure (including syntax highlighting spans)
                // Only update if the innerHTML is different to avoid unnecessary DOM updates
                if (clonedCodeElement.innerHTML !== originalCodeElement.innerHTML) {
                  clonedCodeElement.innerHTML = originalCodeElement.innerHTML;
                }
                // Also sync classes to preserve highlighting classes
                if (clonedCodeElement.className !== originalCodeElement.className) {
                  clonedCodeElement.className = originalCodeElement.className;
                }
              } else if (clonedCodeElement && clonedCodeElement.textContent !== newText) {
                // Fallback: if we can't get HTML, at least update text
                clonedCodeElement.textContent = newText;
              }
              
              // Update the Response View with the latest data
              viewContainer.innerHTML = "";
              this.buildResponseView(latestData, viewContainer);
              // Re-match heights after content update
              matchHeights();
            } catch (e) {
              // Invalid JSON, skip update
            }
          } else {
            // Just update heights for non-JSON changes
            matchHeights();
          }
        };
        
        const observer = new MutationObserver(() => {
          // Debounce: clear previous timeout and set new one
          if (updateTimeout) {
            clearTimeout(updateTimeout);
          }
          updateTimeout = setTimeout(updateResponseView, 150); // 150ms debounce
        });

        // Watch the ORIGINAL element, not the clone
        observer.observe(originalCodeElement, {
          childList: true,
          characterData: true,
          subtree: true,
        });
        
        // Also watch the parent wrapper in case Swagger UI replaces the entire element
        if (responseBodyWrapper) {
          observer.observe(responseBodyWrapper, {
            childList: true,
            subtree: true,
          });
        }

        // Also watch the parent container for new responses being added by Swagger UI
        // This handles cases where Swagger UI replaces the entire response section
        let containerUpdateTimeout = null;
        const containerObserver = new MutationObserver((mutations) => {
          // Check if Response View is still enabled before processing
          if (!this.settings.enableResponseView) {
            return;
          }

          // Debounce container updates
          if (containerUpdateTimeout) {
            clearTimeout(containerUpdateTimeout);
          }
          containerUpdateTimeout = setTimeout(() => {
            // Check if Swagger UI added copy/download buttons
            // Find buttonsWrapper from the container we created
            const currentButtonsWrapper = container.querySelector(
              ".swagger-nav-body-header > div:last-child"
            );
            const newCopyButton = parentContainer?.querySelector(
              ".copy-to-clipboard:not([data-swagger-nav-cloned])"
            );
            const newDownloadButton = parentContainer?.querySelector(
              ".download-contents:not([data-swagger-nav-cloned]), .btn-download:not([data-swagger-nav-cloned])"
            );

            if ((newCopyButton || newDownloadButton) && currentButtonsWrapper) {
              // Check if we already have these buttons
              const hasCopy =
                currentButtonsWrapper.querySelector(".copy-to-clipboard");
              const hasDownload = currentButtonsWrapper.querySelector(
                ".download-contents, .btn-download"
              );

              if (newCopyButton && !hasCopy) {
                swaggerNavLog(
                  "SwaggerNav: Found copy button dynamically, adding to header"
                );
                const copyBtnClone = newCopyButton.cloneNode(true);
                copyBtnClone.dataset.swaggerNavCloned = "true";
                copyBtnClone.addEventListener("click", (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  newCopyButton.click();
                });
                currentButtonsWrapper.appendChild(copyBtnClone);
              }
              if (newDownloadButton && !hasDownload) {
                swaggerNavLog(
                  "SwaggerNav: Found download button dynamically, adding to header"
                );
                const downloadBtnClone = newDownloadButton.cloneNode(true);
                downloadBtnClone.dataset.swaggerNavCloned = "true";
                downloadBtnClone.addEventListener("click", (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  newDownloadButton.click();
                });
                currentButtonsWrapper.appendChild(downloadBtnClone);
              }
            }

            // Check if Swagger UI added a new response code block or replaced the response
            const newCodeBlocks = parentContainer.querySelectorAll(
              ".highlight-code pre code:not([data-swagger-nav-response-view])"
            );
            
            // Also check if the original wrapper was replaced (Swagger UI might create a new one)
            const currentHiddenWrapper = parentContainer.querySelector(
              "[data-swagger-nav-hidden-original='true']"
            );
            const currentResponsePre = parentContainer.querySelector(
              "pre:not([data-swagger-nav-response-view]):not([data-swagger-nav-hidden-original])"
            );
            
            if (newCodeBlocks.length > 0 || (currentResponsePre && !currentHiddenWrapper)) {
              // Re-run addResponseView to catch new/replaced responses
              swaggerNavLog(
                "SwaggerNav: New/replaced response detected, re-adding Response View",
                { newCodeBlocks: newCodeBlocks.length, hasCurrentPre: !!currentResponsePre }
              );
              // Small delay to ensure Swagger UI is done updating
              setTimeout(() => {
                this.addResponseView(opblock);
              }, 100);
            }
          }, 200); // 200ms debounce for container observer
        });

        containerObserver.observe(parentContainer, {
          childList: true,
          subtree: true,
        });

        swaggerNavLog("SwaggerNav: Response View added");
      });
    });
  }

  // Add custom copy/download buttons to default Swagger UI response when Response View is OFF
  addButtonsToDefaultResponse(opblock) {
    // Skip if Response View is enabled
    if (this.settings.enableResponseView) {
      return;
    }

    swaggerNavLog("SwaggerNav: addButtonsToDefaultResponse called", {
      enableResponseView: this.settings.enableResponseView,
    });

    // Find response code blocks in default Swagger UI
    const responseWrappers = opblock.querySelectorAll(
      ".response-wrapper, .responses-wrapper"
    );

    swaggerNavLog(
      `SwaggerNav: Found ${responseWrappers.length} response wrappers`
    );

    responseWrappers.forEach((wrapper) => {
      // Find code blocks with JSON responses
      const codeBlocks = wrapper.querySelectorAll(
        ".highlight-code pre code, pre code.highlight-code"
      );

      swaggerNavLog(
        `SwaggerNav: Found ${codeBlocks.length} code blocks in wrapper`
      );

      codeBlocks.forEach((codeElement) => {
        // Check if this looks like JSON FIRST
        const text = codeElement.textContent.trim();
        if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
          swaggerNavLog(
            "SwaggerNav: Code element doesn't look like JSON, skipping"
          );
          return;
        }

        // Find the parent pre element
        const preElement = codeElement.closest("pre");
        if (!preElement) {
          swaggerNavLog("SwaggerNav: No pre element found");
          return;
        }

        // Find the parent container
        const parentContainer = preElement.closest(
          ".response-col_description, .response-body, .response"
        );
        if (!parentContainer) {
          swaggerNavLog("SwaggerNav: No parent container found");
          return;
        }

        // ALWAYS check if buttons actually exist in DOM (ignore dataset flag)
        const existingButtons = parentContainer.querySelector(
          ".swagger-nav-default-response-buttons"
        );
        if (existingButtons && document.contains(existingButtons)) {
          const computedStyle = window.getComputedStyle(existingButtons);
          const isVisible =
            computedStyle.display !== "none" &&
            computedStyle.visibility !== "hidden" &&
            computedStyle.opacity !== "0";

          if (isVisible) {
            swaggerNavLog(
              "SwaggerNav: Buttons already exist and are visible in parent container"
            );
            // Update dataset flag to match reality
            codeElement.dataset.swaggerNavDefaultButtons = "true";
            return;
          } else {
            swaggerNavLog(
              "SwaggerNav: Buttons exist but are hidden, removing and recreating"
            );
            existingButtons.remove();
            // Continue to create new buttons
          }
        }

        // If dataset flag is set but buttons don't exist, reset it
        if (codeElement.dataset.swaggerNavDefaultButtons) {
          swaggerNavLog(
            "SwaggerNav: Dataset flag set but buttons missing, resetting flag and continuing",
            {
              codeElement,
              parentContainer,
              existingButtonsFound: !!existingButtons,
            }
          );
          delete codeElement.dataset.swaggerNavDefaultButtons;
        }

        // Find the highlight-code wrapper
        const highlightCode = preElement.closest(".highlight-code");
        if (!highlightCode) {
          swaggerNavLog("SwaggerNav: No highlight-code wrapper found", {
            preElement,
            parentContainer,
          });
          return;
        }

        swaggerNavLog("SwaggerNav: Creating buttons for default response", {
          codeElement,
          preElement,
          parentContainer,
          highlightCode,
          highlightCodeParent: highlightCode.parentElement,
        });

        // Create buttons wrapper
        const buttonsWrapper = document.createElement("div");
        buttonsWrapper.className = "swagger-nav-default-response-buttons";
        buttonsWrapper.style.cssText =
          "display: flex !important; gap: 20px !important; align-items: center !important; visibility: visible !important; opacity: 1 !important; flex-shrink: 0 !important; margin-left: auto !important; flex-wrap: wrap !important; padding: 8px 16px !important; width: auto !important;";

        // Get the response text from the code element
        const getResponseText = () => {
          return codeElement.textContent || codeElement.innerText || "";
        };

        // Create Copy button
        const customCopyButton = document.createElement("button");
        customCopyButton.className = "copy-to-clipboard";
        customCopyButton.setAttribute("data-swagger-nav-custom", "true");
        customCopyButton.innerHTML = "📋 Copy";
        customCopyButton.style.cssText =
          "padding: 4px 8px !important; border: 1px solid #ccc !important; border-radius: 4px !important; background: rgba(255, 255, 255, 0.1) !important; cursor: pointer !important; font-size: 12px !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; color: inherit !important; min-width: auto !important; width: auto !important; height: auto !important; margin: 0 !important; flex-shrink: 0 !important;";
        customCopyButton.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            const text = getResponseText();
            await navigator.clipboard.writeText(text);
            customCopyButton.innerHTML = "✓ Copied!";
            setTimeout(() => {
              customCopyButton.innerHTML = "📋 Copy";
            }, 2000);
          } catch (err) {
            swaggerNavWarn("SwaggerNav: Failed to copy to clipboard", err);
            // Fallback for older browsers
            const textarea = document.createElement("textarea");
            textarea.value = getResponseText();
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            try {
              document.execCommand("copy");
              customCopyButton.innerHTML = "✓ Copied!";
              setTimeout(() => {
                customCopyButton.innerHTML = "📋 Copy";
              }, 2000);
            } catch (fallbackErr) {
              swaggerNavWarn(
                "SwaggerNav: Fallback copy also failed",
                fallbackErr
              );
            }
            document.body.removeChild(textarea);
          }
        });
        // Add margin-right to create spacing (fallback if gap doesn't work)
        customCopyButton.style.marginRight = "20px";
        buttonsWrapper.appendChild(customCopyButton);

        // Create Download button
        const customDownloadButton = document.createElement("button");
        customDownloadButton.className = "download-contents";
        customDownloadButton.setAttribute("data-swagger-nav-custom", "true");
        customDownloadButton.innerHTML = "💾 Download";
        customDownloadButton.style.cssText =
          "padding: 4px 8px !important; border: 1px solid #ccc !important; border-radius: 4px !important; background: rgba(255, 255, 255, 0.1) !important; cursor: pointer !important; font-size: 12px !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; color: inherit !important; min-width: auto !important; width: auto !important; height: auto !important; margin: 0 !important; flex-shrink: 0 !important;";
        customDownloadButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            const text = getResponseText();
            const blob = new Blob([text], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "response.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch (err) {
            swaggerNavWarn("SwaggerNav: Failed to download", err);
          }
        });
        buttonsWrapper.appendChild(customDownloadButton);

        // Insert buttons before the highlight-code element
        if (highlightCode.parentElement) {
          highlightCode.parentElement.insertBefore(
            buttonsWrapper,
            highlightCode
          );
          swaggerNavLog("SwaggerNav: Inserted buttons before highlight-code", {
            buttonsWrapper,
            highlightCode,
            parent: highlightCode.parentElement,
            buttonsVisible:
              window.getComputedStyle(buttonsWrapper).display !== "none",
            buttonsInDOM: document.contains(buttonsWrapper),
          });
        } else {
          parentContainer.appendChild(buttonsWrapper);
          swaggerNavLog("SwaggerNav: Appended buttons to parent container", {
            buttonsWrapper,
            parentContainer,
            buttonsVisible:
              window.getComputedStyle(buttonsWrapper).display !== "none",
            buttonsInDOM: document.contains(buttonsWrapper),
          });
        }

        // Verify buttons are actually in DOM after insertion
        setTimeout(() => {
          const buttonsStillExist = parentContainer.querySelector(
            ".swagger-nav-default-response-buttons"
          );
          if (buttonsStillExist && document.contains(buttonsStillExist)) {
            swaggerNavLog(
              "SwaggerNav: Buttons verified in DOM after insertion"
            );
            codeElement.dataset.swaggerNavDefaultButtons = "true";
          } else {
            swaggerNavWarn("SwaggerNav: Buttons disappeared after insertion!");
            delete codeElement.dataset.swaggerNavDefaultButtons;
          }
        }, 100);

        swaggerNavLog(
          "SwaggerNav: Successfully added buttons to default response"
        );
      });
    });
  }

  // Remove buttons from default Swagger UI response when Response View is enabled
  removeButtonsFromDefaultResponse(opblock) {
    const buttonsWrappers = opblock.querySelectorAll(
      ".swagger-nav-default-response-buttons"
    );
    buttonsWrappers.forEach((wrapper) => {
      wrapper.remove();
    });

    // Also remove the dataset flag
    const codeElements = opblock.querySelectorAll(
      "[data-swagger-nav-default-buttons='true']"
    );
    codeElements.forEach((el) => {
      delete el.dataset.swaggerNavDefaultButtons;
    });
  }

  buildResponseView(data, container) {
    try {
      container.innerHTML = "";

      // Build response fields with editable checkboxes on the right for comparison
      this.buildResponseFields(data, container, "");
      swaggerNavLog("SwaggerNav: Response View built successfully");
    } catch (error) {
      container.innerHTML =
        '<p class="swagger-nav-form-error">Error displaying response</p>';
      swaggerNavError("SwaggerNav: Response View build error:", error);
    }
  }

  buildResponseFields(data, container, path) {
    if (typeof data !== "object" || data === null) {
      // Primitive value - display as text with checkbox
      const field = document.createElement("div");
      field.className = "swagger-nav-response-field";

      const fieldContent = document.createElement("div");
      fieldContent.className = "swagger-nav-response-field-content";
      fieldContent.textContent = String(data === null ? "null" : data);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "swagger-nav-response-checkbox";
      checkbox.addEventListener("change", () => {
        field.classList.toggle(
          "swagger-nav-response-field-checked",
          checkbox.checked
        );
      });

      field.appendChild(fieldContent);
      field.appendChild(checkbox);
      container.appendChild(field);
      return;
    }

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

        if (typeof item === "object" && item !== null) {
          // Object/Array in array - create fieldset
          const fieldset = document.createElement("div");
          fieldset.className = "swagger-nav-form-fieldset";

          const legend = document.createElement("div");
          legend.className = "swagger-nav-form-legend";
          legend.textContent = `Item ${index + 1}`;
          fieldset.appendChild(legend);

          this.buildResponseFields(item, fieldset, itemPath);
          container.appendChild(fieldset);
        } else {
          // Primitive in array - create field with checkbox on right
          const field = document.createElement("div");
          field.className = "swagger-nav-response-field";

          const fieldContent = document.createElement("div");
          fieldContent.className = "swagger-nav-response-field-content";

          const label = document.createElement("span");
          label.className = "swagger-nav-response-label";
          label.textContent = `Item ${index + 1}: `;

          const valueSpan = document.createElement("span");
          valueSpan.className = "swagger-nav-response-value";
          valueSpan.textContent = String(item === null ? "null" : item);

          fieldContent.appendChild(label);
          fieldContent.appendChild(valueSpan);

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.className = "swagger-nav-response-checkbox";
          checkbox.addEventListener("change", () => {
            field.classList.toggle(
              "swagger-nav-response-field-checked",
              checkbox.checked
            );
          });

          field.appendChild(fieldContent);
          field.appendChild(checkbox);
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

          // Show array indicator
          if (Array.isArray(value)) {
            fieldset.classList.add("swagger-nav-form-array");
            legend.innerHTML = `📋 ${key} <span style="font-size: 10px; opacity: 0.7;">(Array with ${
              value.length
            } item${value.length !== 1 ? "s" : ""})</span>`;
          } else {
            legend.textContent = key;
          }
          fieldset.appendChild(legend);

          this.buildResponseFields(value, fieldset, fieldPath);
          container.appendChild(fieldset);
        } else {
          // Primitive value - create field with checkbox on right
          const field = document.createElement("div");
          field.className = "swagger-nav-response-field";

          const fieldContent = document.createElement("div");
          fieldContent.className = "swagger-nav-response-field-content";

          const label = document.createElement("span");
          label.className = "swagger-nav-response-label";
          label.textContent = `${key}: `;

          const valueSpan = document.createElement("span");
          valueSpan.className = "swagger-nav-response-value";
          const displayValue =
            value === null
              ? "null"
              : typeof value === "string"
              ? `"${value}"`
              : String(value);
          valueSpan.textContent = displayValue;

          fieldContent.appendChild(label);
          fieldContent.appendChild(valueSpan);

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.className = "swagger-nav-response-checkbox";
          checkbox.addEventListener("change", () => {
            field.classList.toggle(
              "swagger-nav-response-field-checked",
              checkbox.checked
            );
          });

          field.appendChild(fieldContent);
          field.appendChild(checkbox);
          container.appendChild(field);
        }
      });
    }
  }

  // Setup network error detection (offline/online events)
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

    const originalFetch = window._swaggerNavOriginalFetch;
    const self = this;

    // Helper to check if current page is Swagger UI (shared for both fetch and XHR)
    const isCurrentPageSwaggerUI = () => {
      return !!(
        document.querySelector(".swagger-ui") ||
        document.querySelector("#swagger-ui") ||
        document.querySelector('[data-testid="swagger-ui"]') ||
        document.querySelector(".opblock") ||
        document.querySelector(".swagger-container") ||
        window.ui ||
        window.swaggerUi
      );
    };

    // Only install interceptors if not already installed or if we need to update them
    if (
      !window._swaggerNavFetchInstalled ||
      window.fetch !== window._swaggerNavInterceptedFetch
    ) {
      window._swaggerNavInterceptedFetch = function (...args) {
        // Check page state FIRST - if not Swagger UI, use original fetch immediately
        if (!isCurrentPageSwaggerUI()) {
          return originalFetch.apply(this, args);
        }

        return originalFetch
          .apply(this, args)
          .then((response) => {
            // Double-check page state before processing
            if (!isCurrentPageSwaggerUI()) {
              return response;
            }

            // Only show error for server errors (5xx) or network errors (status 0)
            // 4xx errors (like 404) are client errors, not server down
            if (response.status >= 500 || response.status === 0) {
              self.showErrorPopup(
                response.status === 0
                  ? "Cannot connect to server"
                  : `Server error (${response.status})`
              );
              self.lastHealthCheckSuccess = false;
            } else if (
              response.ok ||
              (response.status >= 200 && response.status < 500)
            ) {
              // Server is responding - check if Swagger UI is missing (error page showing)
              const swaggerUIPresent = isCurrentPageSwaggerUI();
              if (!swaggerUIPresent && !self.lastHealthCheckSuccess) {
                // Swagger UI disappeared (error page) but server is back
                // Show recovery popup and keep it visible until user reloads
                self.showErrorPopup(
                  "The server is back online! Please reload the page to restore Swagger UI.",
                  true // isRecovery = true
                );
                // Don't set lastHealthCheckSuccess to true yet - keep popup visible
              } else if (swaggerUIPresent) {
                // Swagger UI is present - hide error popup
                self.hideErrorPopup();
                self.lastHealthCheckSuccess = true;
              } else {
                // Swagger UI still missing but we already showed recovery popup
                // Keep it visible - don't hide
                self.lastHealthCheckSuccess = false; // Keep showing popup
              }
            }
            return response;
          })
          .catch((error) => {
            // Double-check page state before processing
            if (!isCurrentPageSwaggerUI()) {
              throw error;
            }

            // Network errors (connection refused, timeout, etc.)
            if (
              error.name === "TypeError" ||
              error.message.includes("Failed to fetch")
            ) {
              self.showErrorPopup("Cannot connect to server");
              self.lastHealthCheckSuccess = false;
            }
            throw error;
          });
      };

      window.fetch = window._swaggerNavInterceptedFetch;
      window._swaggerNavFetchInstalled = true;
    }

    // Intercept XMLHttpRequest
    const originalXHROpen =
      XMLHttpRequest.prototype._swaggerNavOriginalOpen ||
      XMLHttpRequest.prototype.open;
    const originalXHRSend =
      XMLHttpRequest.prototype._swaggerNavOriginalSend ||
      XMLHttpRequest.prototype.send;

    // Only install XHR interceptors if not already installed
    if (!XMLHttpRequest.prototype._swaggerNavXHRInstalled) {
      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._swaggerNavUrl = url;
        return originalXHROpen.apply(this, [method, url, ...rest]);
      };

      XMLHttpRequest.prototype.send = function (...args) {
        // Check page state FIRST - if not Swagger UI, use original send immediately
        if (!isCurrentPageSwaggerUI()) {
          return originalXHRSend.apply(this, args);
        }

        const xhr = this;

        // Only add listeners if current page is Swagger UI
        xhr.addEventListener("error", () => {
          // Check again when event fires
          if (!isCurrentPageSwaggerUI()) return;
          self.showErrorPopup("Network error - cannot connect to server");
          self.lastHealthCheckSuccess = false;
        });

        xhr.addEventListener("load", function () {
          // Check again when event fires
          if (!isCurrentPageSwaggerUI()) return;

          // Only show error for server errors (5xx)
          // 4xx errors (like 404) are client errors, not server down
          if (xhr.status >= 500) {
            self.showErrorPopup(`Server error (${xhr.status})`);
            self.lastHealthCheckSuccess = false;
          } else if (xhr.status >= 200 && xhr.status < 500) {
            // Server is responding - check if Swagger UI is missing (error page showing)
            const swaggerUIPresent = isCurrentPageSwaggerUI();
            if (!swaggerUIPresent && !self.lastHealthCheckSuccess) {
              // Swagger UI disappeared (error page) but server is back
              // Show recovery popup and keep it visible until user reloads
              self.showErrorPopup(
                "The server is back online! Please reload the page to restore Swagger UI.",
                true // isRecovery = true
              );
              // Don't set lastHealthCheckSuccess to true yet - keep popup visible
            } else if (swaggerUIPresent) {
              // Swagger UI is present - hide error popup
              self.hideErrorPopup();
              self.lastHealthCheckSuccess = true;
            } else {
              // Swagger UI still missing but we already showed recovery popup
              // Keep it visible - don't hide
              self.lastHealthCheckSuccess = false; // Keep showing popup
            }
          }
        });

        return originalXHRSend.apply(this, args);
      };

      XMLHttpRequest.prototype._swaggerNavXHRInstalled = true;
    }
  }

  // Create error popup element
  createErrorPopup() {
    if (this.errorPopup) {
      return this.errorPopup;
    }

    const popup = document.createElement("div");
    popup.id = "swagger-nav-error-popup";
    popup.className = "swagger-nav-error-popup";
    popup.innerHTML = `
      <div class="swagger-nav-error-popup-content">
        <div class="swagger-nav-error-popup-icon">⚠️</div>
        <div class="swagger-nav-error-popup-text">
          <div class="swagger-nav-error-popup-title">Connection Error</div>
          <div class="swagger-nav-error-popup-message"></div>
        </div>
        <button class="swagger-nav-error-popup-reload" title="Reload page">
          🔄 Reload
        </button>
      </div>
    `;

    // Add reload button handler
    const reloadBtn = popup.querySelector(".swagger-nav-error-popup-reload");
    reloadBtn.addEventListener("click", () => {
      window.location.reload();
    });

    document.body.appendChild(popup);
    this.errorPopup = popup;
    return popup;
  }

  // Show error popup with message
  showErrorPopup(message, isRecovery = false) {
    if (!this.errorPopup) {
      this.createErrorPopup();
    }

    const messageEl = this.errorPopup.querySelector(
      ".swagger-nav-error-popup-message"
    );
    const titleEl = this.errorPopup.querySelector(
      ".swagger-nav-error-popup-title"
    );
    const iconEl = this.errorPopup.querySelector(
      ".swagger-nav-error-popup-icon"
    );
    const reloadBtn = this.errorPopup.querySelector(
      ".swagger-nav-error-popup-reload"
    );

    if (messageEl) {
      messageEl.textContent = message;
    }

    if (isRecovery) {
      // Server is back - show success styling
      this.errorPopup.classList.add("recovery");
      if (titleEl) {
        titleEl.textContent = "Server is Back!";
      }
      if (iconEl) {
        iconEl.textContent = "✅";
      }
      if (reloadBtn) {
        reloadBtn.textContent = "🔄 Reload Page";
      }
    } else {
      // Server error - show error styling
      this.errorPopup.classList.remove("recovery");
      if (titleEl) {
        titleEl.textContent = "Connection Error";
      }
      if (iconEl) {
        iconEl.textContent = "⚠️";
      }
      if (reloadBtn) {
        reloadBtn.textContent = "🔄 Reload";
      }
    }

    this.errorPopup.classList.add("active");
    swaggerNavLog(
      `SwaggerNav: Showing ${
        isRecovery ? "recovery" : "error"
      } popup - ${message}`
    );
  }

  // Hide error popup
  hideErrorPopup() {
    if (this.errorPopup) {
      // Don't hide recovery popup - it should persist until user reloads
      if (this.errorPopup.classList.contains("recovery")) {
        swaggerNavLog("SwaggerNav: Recovery popup is persistent - not hiding");
        return;
      }
      this.errorPopup.classList.remove("active");
      this.errorPopup.classList.remove("recovery");
      swaggerNavLog("SwaggerNav: Hiding error popup");
    }
  }

  // Get API server URL for health checks
  getApiServerUrl() {
    // Try to get server URL from Swagger UI configuration
    try {
      // Check if Swagger UI has a server URL configured
      if (window.ui && window.ui.getSystem) {
        const system = window.ui.getSystem();
        if (system && system.specSelectors) {
          const servers = system.specSelectors.servers();
          if (servers && servers.size > 0) {
            const firstServer = servers.get(0);
            if (firstServer && firstServer.url) {
              const serverUrl = firstServer.url;
              // If server URL is relative, make it absolute using current origin
              try {
                const url = new URL(serverUrl, window.location.href);
                return url.origin; // Return only origin to avoid CORS issues with paths
              } catch (e) {
                return serverUrl;
              }
            }
          }
        }
      }

      // Try to get from SwaggerUIBundle config
      if (
        window.swaggerUi &&
        window.swaggerUi.spec &&
        window.swaggerUi.spec.servers
      ) {
        const servers = window.swaggerUi.spec.servers;
        if (servers && servers.length > 0 && servers[0].url) {
          const serverUrl = servers[0].url;
          try {
            const url = new URL(serverUrl, window.location.href);
            return url.origin;
          } catch (e) {
            return serverUrl;
          }
        }
      }

      // Try to extract from OpenAPI spec in the page
      const specScript = document.querySelector(
        'script[type="application/json"][data-spec]'
      );
      if (specScript) {
        try {
          const spec = JSON.parse(specScript.textContent);
          if (spec.servers && spec.servers.length > 0 && spec.servers[0].url) {
            const serverUrl = spec.servers[0].url;
            try {
              const url = new URL(serverUrl, window.location.href);
              return url.origin;
            } catch (e) {
              return serverUrl;
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    } catch (e) {
      swaggerNavLog(
        "SwaggerNav: Could not extract API server URL from Swagger UI",
        e
      );
    }

    // Fallback to base URL (same origin as Swagger UI page)
    const url = new URL(window.location.href);
    return url.origin;
  }

  // Perform health check to see if server is alive
  async performHealthCheck() {
    // Only run on Swagger UI pages - check DOM/UI first
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
      // Not a Swagger UI page - stop health checks
      this.stopHealthCheck();
      return;
    }

    // Skip if offline
    if (this.isOffline || !navigator.onLine) {
      return;
    }

    try {
      const currentOrigin = new URL(window.location.href).origin;

      // Simple health check: just verify the web server is responding
      // We don't check specific health endpoints since not all APIs have them
      // The intercepted fetch/XHR calls will catch actual API failures
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      try {
        // Just check if the root page is accessible (same origin)
        // We use HEAD to minimize bandwidth, but if it fails, we don't assume server is down
        const response = await fetch(currentOrigin, {
          method: "HEAD",
          signal: controller.signal,
          cache: "no-cache",
          mode: "same-origin", // Only check same-origin to avoid CORS issues
        });
        clearTimeout(timeoutId);

        // Only consider 5xx as actual server errors
        // 4xx (404, 405, 401, etc.) are client errors and don't mean server is down
        if (response.status >= 500) {
          // Actual server error (5xx) - server is having problems
          this.lastHealthCheckSuccess = false;
          this.showErrorPopup(`Server error (${response.status})`);
          swaggerNavLog(
            `SwaggerNav: Health check detected server error ${response.status}`
          );
        } else {
          // Server responded (2xx, 3xx, 4xx) - server is up
          // 4xx responses (404, 405, etc.) are normal and don't indicate server down
          const swaggerUIPresent = this.detectSwaggerUI();
          if (!swaggerUIPresent && !this.lastHealthCheckSuccess) {
            // Swagger UI disappeared (error page) but server is responding
            // Show recovery popup and keep it visible until user reloads
            this.showErrorPopup(
              "The server is back online! Please reload the page to restore Swagger UI.",
              true // isRecovery = true
            );
            swaggerNavLog(
              "SwaggerNav: Server is back but Swagger UI is missing - showing recovery popup"
            );
            // Don't set lastHealthCheckSuccess to true yet - keep popup visible
          } else if (swaggerUIPresent) {
            // Swagger UI is present - hide error popup
            this.hideErrorPopup();
            this.lastHealthCheckSuccess = true;
            swaggerNavLog(
              "SwaggerNav: Health check passed - web server is responding"
            );
          } else {
            // Swagger UI still missing but we already showed recovery popup
            // Keep it visible - don't hide
            this.lastHealthCheckSuccess = false; // Keep showing popup
          }
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Health check failures are unreliable indicators of server status
        // We should rely on intercepted API calls (fetch/XHR) to detect actual failures
        // Only log for debugging, don't show error popup

        if (fetchError.name === "AbortError") {
          // Timeout - could be network issues, firewall, or server actually down
          // Don't assume server is down based on timeout alone
          swaggerNavLog(
            "SwaggerNav: Health check timeout - relying on intercepted API calls for error detection"
          );
          // Don't change lastHealthCheckSuccess or show popup - let intercepted calls handle it
        } else if (
          fetchError.name === "TypeError" ||
          fetchError.message.includes("Failed to fetch")
        ) {
          // Check if it's a CORS error (which means server might be up but CORS is blocking)
          if (
            fetchError.message.includes("CORS") ||
            fetchError.message.includes("cross-origin")
          ) {
            // CORS error - can't determine server status, but don't show error
            // The intercepted fetch/XHR calls will catch actual API failures
            swaggerNavLog(
              "SwaggerNav: Health check blocked by CORS - relying on intercepted API calls"
            );
            // Don't change lastHealthCheckSuccess - keep previous state
          } else {
            // Network error - could be temporary network issues
            // Don't show error popup - let intercepted API calls handle actual failures
            swaggerNavLog(
              "SwaggerNav: Health check network error - relying on intercepted API calls for error detection",
              fetchError
            );
            // Don't change lastHealthCheckSuccess or show popup - let intercepted calls handle it
          }
        } else {
          // Other error - don't assume server is down
          swaggerNavLog(
            "SwaggerNav: Health check error - relying on intercepted API calls for error detection",
            fetchError
          );
          // Don't change lastHealthCheckSuccess or show popup - let intercepted calls handle it
        }
      }
    } catch (error) {
      // Outer catch - same logic: don't assume server is down
      if (error.name === "AbortError") {
        swaggerNavLog(
          "SwaggerNav: Health check timeout - relying on intercepted API calls for error detection"
        );
      } else if (
        error.name === "TypeError" ||
        error.message.includes("Failed to fetch")
      ) {
        swaggerNavLog(
          "SwaggerNav: Health check network error - relying on intercepted API calls for error detection",
          error
        );
      } else {
        swaggerNavLog(
          "SwaggerNav: Health check error - relying on intercepted API calls for error detection",
          error
        );
      }
      // Don't change lastHealthCheckSuccess or show popup - let intercepted calls handle it
    }
  }

  // Start periodic health checks
  startHealthCheck() {
    // Check DOM/UI FIRST to verify this is actually a Swagger UI page
    const isSwaggerUIPage = !!(
      document.querySelector(".swagger-ui") ||
      document.querySelector("#swagger-ui") ||
      document.querySelector('[data-testid="swagger-ui"]') ||
      document.querySelector(".opblock") ||
      document.querySelector(".swagger-container") ||
      window.ui ||
      window.swaggerUi
    );

    // Only run health checks on Swagger UI pages
    if (!isSwaggerUIPage) {
      this.stopHealthCheck();
      return;
    }

    // Clear any existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Perform initial health check after a delay (to avoid interfering with page load)
    const initialTimeout = setTimeout(() => {
      // Double-check we're still on Swagger UI page
      if (!this.isSwaggerUI) {
        this.stopHealthCheck();
        return;
      }
      this.performHealthCheck();
    }, 10000); // Wait 10 seconds after page load

    // Store timeout for cleanup
    this._initialHealthCheckTimeout = initialTimeout;

    // Then check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      // Double-check we're still on Swagger UI page
      if (!this.isSwaggerUI) {
        this.stopHealthCheck();
        return;
      }
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds

    swaggerNavLog(
      "SwaggerNav: Started periodic health checks (every 30 seconds)"
    );

    // Clean up on page unload
    const unloadHandler = () => {
      this.stopHealthCheck();
    };
    window.addEventListener("beforeunload", unloadHandler);
    this._unloadHandler = unloadHandler;
  }

  // Stop health checks
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      swaggerNavLog("SwaggerNav: Stopped health checks");
    }
    if (this._initialHealthCheckTimeout) {
      clearTimeout(this._initialHealthCheckTimeout);
      this._initialHealthCheckTimeout = null;
    }
  }

  // Restore original fetch and XHR functions when leaving Swagger UI pages
  restoreOriginalFunctions() {
    // Always restore fetch if we have the original
    if (window._swaggerNavOriginalFetch) {
      if (
        window.fetch === window._swaggerNavInterceptedFetch ||
        (window._swaggerNavFetchInstalled &&
          window.fetch !== window._swaggerNavOriginalFetch)
      ) {
        window.fetch = window._swaggerNavOriginalFetch;
        window._swaggerNavFetchInstalled = false;
        swaggerNavLog("SwaggerNav: Restored original fetch function");
      }
    }

    // Always restore XHR if we have the original
    if (XMLHttpRequest.prototype._swaggerNavOriginalSend) {
      if (XMLHttpRequest.prototype._swaggerNavXHRInstalled) {
        XMLHttpRequest.prototype.send =
          XMLHttpRequest.prototype._swaggerNavOriginalSend;
        if (XMLHttpRequest.prototype._swaggerNavOriginalOpen) {
          XMLHttpRequest.prototype.open =
            XMLHttpRequest.prototype._swaggerNavOriginalOpen;
        }
        XMLHttpRequest.prototype._swaggerNavXHRInstalled = false;
        swaggerNavLog("SwaggerNav: Restored original XMLHttpRequest functions");
      }
    }
  }
}

// Initialize the extension
const swaggerNav = new SwaggerNavigator();

// Immediately check if we're on a Swagger UI page and restore functions if not
// This prevents interceptors from running on non-Swagger pages
// This check runs BEFORE init() to catch non-Swagger pages immediately
(function () {
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
