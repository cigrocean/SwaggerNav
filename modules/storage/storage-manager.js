// SwaggerNav - Storage Manager
// Handles all localStorage and chrome.storage operations

// Storage Manager class to handle all storage operations
class StorageManager {
  constructor() {
    this.settings = null;
    this.pinnedEndpoints = [];
    this.searchHistory = [];
  }

  // Load pinned endpoints from localStorage
  loadPinnedEndpoints() {
    try {
      const stored = localStorage.getItem("swagger-nav-pinned-endpoints");
      if (stored) {
        this.pinnedEndpoints = JSON.parse(stored);
        if (typeof swaggerNavLog === 'function') {
          swaggerNavLog(
            `SwaggerNav: Loaded ${this.pinnedEndpoints.length} pinned endpoints`
          );
        }
      }
    } catch (error) {
      if (typeof swaggerNavError === 'function') {
        swaggerNavError("SwaggerNav: Error loading pinned endpoints", error);
      }
      this.pinnedEndpoints = [];
    }
    return this.pinnedEndpoints;
  }

  // Save pinned endpoints to localStorage
  savePinnedEndpoints() {
    try {
      localStorage.setItem(
        "swagger-nav-pinned-endpoints",
        JSON.stringify(this.pinnedEndpoints)
      );
    } catch (error) {
      if (typeof swaggerNavError === 'function') {
        swaggerNavError("SwaggerNav: Error saving pinned endpoints", error);
      }
    }
  }

  // Load sidebar state from localStorage
  loadSidebarState() {
    try {
      const stored = localStorage.getItem("swagger-nav-sidebar-hidden");
      if (stored !== null) {
        return stored === "true";
      }
    } catch (error) {
      if (typeof swaggerNavError === 'function') {
        swaggerNavError("SwaggerNav: Error loading sidebar state", error);
      }
    }
    return false; // Default to visible
  }

  // Save sidebar state to localStorage
  saveSidebarState(isHidden) {
    try {
      localStorage.setItem("swagger-nav-sidebar-hidden", isHidden.toString());
    } catch (error) {
      if (typeof swaggerNavError === 'function') {
        swaggerNavError("SwaggerNav: Error saving sidebar state", error);
      }
    }
  }

  // Load search history from localStorage
  loadSearchHistory() {
    try {
      const stored = localStorage.getItem("swagger-nav-search-history");
      if (stored) {
        this.searchHistory = JSON.parse(stored);
        // Limit to last 50 searches
        if (this.searchHistory.length > 50) {
          this.searchHistory = this.searchHistory.slice(-50);
          this.saveSearchHistory();
        }
      }
    } catch (error) {
      if (typeof swaggerNavError === 'function') {
        swaggerNavError("SwaggerNav: Error loading search history", error);
      }
      this.searchHistory = [];
    }
    return this.searchHistory;
  }

  // Save search history to localStorage
  saveSearchHistory() {
    try {
      localStorage.setItem(
        "swagger-nav-search-history",
        JSON.stringify(this.searchHistory)
      );
    } catch (error) {
      if (typeof swaggerNavError === 'function') {
        swaggerNavError("SwaggerNav: Error saving search history", error);
      }
    }
  }

  // Add search query to history
  addToSearchHistory(query) {
    if (!query || !query.trim()) return;

    // Remove if already exists
    const index = this.searchHistory.indexOf(query);
    if (index >= 0) {
      this.searchHistory.splice(index, 1);
    }

    // Add to beginning
    this.searchHistory.unshift(query);

    // Limit to 50
    if (this.searchHistory.length > 50) {
      this.searchHistory = this.searchHistory.slice(0, 50);
    }

    this.saveSearchHistory();
  }

  // Clear search history
  clearSearchHistory() {
    this.searchHistory = [];
    this.saveSearchHistory();
    if (typeof swaggerNavLog === 'function') {
      swaggerNavLog("SwaggerNav: Cleared search history");
    }
  }

  // Load settings from chrome.storage with defaults
  loadSettings() {
    const defaults = {
      autoTryOut: true,
      autoExpand: true,
      theme: "auto", // Backward compatibility
      swaggerUITheme: "auto",
      extensionTheme: "auto",
      background: "default",
      enableFormView: true,
      enableParamSearch: true,
      enableResponseView: true,
      liquidGlass: false, // iOS 26-style liquid glass effect
    };

    // Load from chrome.storage asynchronously
    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(defaults, (items) => {
        this.settings = { ...defaults, ...items };

        // Migrate old "theme" setting to separate themes if needed
        if (this.settings.theme && this.settings.theme !== "auto") {
          if (!this.settings.swaggerUITheme || this.settings.swaggerUITheme === "auto") {
            this.settings.swaggerUITheme = this.settings.theme;
          }
          if (!this.settings.extensionTheme || this.settings.extensionTheme === "auto") {
            this.settings.extensionTheme = this.settings.theme;
          }
          // Don't delete old "theme" for backward compatibility
        }

        if (typeof swaggerNavLog === 'function') {
          swaggerNavLog("SwaggerNav: Settings loaded", this.settings);
        }

        // Trigger callback if provided
        if (this.onSettingsLoaded) {
          this.onSettingsLoaded(this.settings);
        }
      });
    } else {
      // Fallback to defaults if chrome.storage is not available
      this.settings = defaults;
      if (this.onSettingsLoaded) {
        this.onSettingsLoaded(this.settings);
      }
    }

    return defaults; // Return defaults immediately for synchronous access
  }

  // Save settings to chrome.storage
  saveSettings(settings) {
    this.settings = settings;
    try {
      chrome.storage.sync.set(settings, () => {
        if (typeof swaggerNavLog === 'function') {
          swaggerNavLog("SwaggerNav: Settings saved to chrome.storage", settings);
        }
      });
    } catch (error) {
      if (typeof swaggerNavError === 'function') {
        swaggerNavError("SwaggerNav: Error saving settings", error);
      }
    }
  }

  // Get current settings
  getSettings() {
    return this.settings || this.loadSettings();
  }
}

// Create global storage manager instance
window.SwaggerNavStorage = new StorageManager();

