// SwaggerNav - Content Script
// Detects Swagger UI and adds navigation sidebar

// VERSION - Update this for new releases
const SWAGGERNAV_VERSION = "1.0.1";

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

  // Load settings from localStorage
  loadSettings() {
    try {
      const stored = localStorage.getItem("swagger-nav-settings");
      const defaults = {
        autoExpand: true,
        autoTryOut: true,
      };
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch (error) {
      console.error("SwaggerNav: Error loading settings", error);
      return {
        autoExpand: true,
        autoTryOut: true,
      };
    }
  }

  // Save settings to localStorage
  saveSettings() {
    try {
      localStorage.setItem(
        "swagger-nav-settings",
        JSON.stringify(this.settings)
      );
    } catch (error) {
      console.error("SwaggerNav: Error saving settings", error);
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
      });
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
          this.setup();
        }
      }, 2000);
      return;
    }

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

      // Check for already expanded endpoints on page load
      // Longer delay to let Swagger UI process URL hash and expand endpoint
      setTimeout(() => {
        this.syncToCurrentSwaggerState();
      }, 500);
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
      <input type="text" placeholder="Search endpoints..." class="swagger-nav-search-input" aria-label="Search API endpoints" role="searchbox" autocomplete="off">
      <div class="swagger-nav-search-history" style="display: none;"></div>
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

    // Search functionality
    const searchInput = this.navBar.querySelector(".swagger-nav-search-input");
    const searchHistory = this.navBar.querySelector(
      ".swagger-nav-search-history"
    );

    if (searchInput) {
      let searchTimeout = null;

      // Input event for filtering
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value;
        this.filterEndpoints(query);

        // Filter and show search history
        if (searchHistory && this.searchHistory.length > 0) {
          // Always show if we have history (filterSearchHistory will hide items that don't match)
          this.showSearchHistory();
          this.filterSearchHistory(query);
        } else if (searchHistory) {
          this.hideSearchHistory();
        }

        // Auto-save to history after user stops typing (1 second delay)
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }

        if (query.trim().length > 0) {
          searchTimeout = setTimeout(() => {
            this.addToSearchHistory(query);
            console.log(`SwaggerNav: Auto-saved search "${query}" to history`);
          }, 1000); // Save after 1 second of no typing
        }
      });

      // Focus event to show history
      searchInput.addEventListener("focus", () => {
        if (searchHistory && this.searchHistory.length > 0) {
          this.showSearchHistory();
          // Filter based on current value (or show all if empty)
          this.filterSearchHistory(searchInput.value);
        }
      });

      // Track if we're clicking inside the history dropdown
      let isClickingHistory = false;

      // Blur event to hide history (with delay to allow clicks)
      searchInput.addEventListener("blur", () => {
        setTimeout(() => {
          // Don't hide if we're clicking inside the history dropdown
          if (!isClickingHistory) {
            this.hideSearchHistory();
          }
          isClickingHistory = false;
        }, 200);
      });

      // Prevent blur when clicking inside history dropdown
      if (searchHistory) {
        searchHistory.addEventListener("mousedown", (e) => {
          isClickingHistory = true;
          // Keep focus on search input
          e.preventDefault();
        });
      }

      // Enter key to immediately add to history
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.value.trim().length > 0) {
          // Clear the auto-save timeout
          if (searchTimeout) {
            clearTimeout(searchTimeout);
          }
          // Immediately save to history
          this.addToSearchHistory(e.target.value);
          console.log(
            `SwaggerNav: Saved search "${e.target.value}" to history (Enter pressed)`
          );
        }
      });
    }

    // Prevent scroll chaining - stop scroll from propagating to main page
    const contentArea = this.navBar.querySelector(".swagger-nav-content");
    if (contentArea) {
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

  // Show search history dropdown
  showSearchHistory() {
    const searchHistory = this.navBar?.querySelector(
      ".swagger-nav-search-history"
    );
    if (!searchHistory) return;

    this.updateSearchHistoryUI();
    searchHistory.style.display = "block";

    // Trigger animation after display is set
    requestAnimationFrame(() => {
      searchHistory.classList.add("visible");
    });

    // Disable interaction with content area items
    const contentArea = this.navBar?.querySelector(".swagger-nav-content");
    if (contentArea) {
      contentArea.classList.add("search-dropdown-open");
    }
  }

  // Hide search history dropdown
  hideSearchHistory() {
    const searchHistory = this.navBar?.querySelector(
      ".swagger-nav-search-history"
    );
    const contentArea = this.navBar?.querySelector(".swagger-nav-content");

    if (searchHistory) {
      searchHistory.classList.remove("visible");
      // Wait for animation to complete before hiding
      setTimeout(() => {
        searchHistory.style.display = "none";
      }, 150);
    }
    if (contentArea) contentArea.classList.remove("search-dropdown-open");
  }

  // Filter search history items in UI
  filterSearchHistory(query) {
    const historyContainer = this.navBar?.querySelector(
      ".swagger-nav-search-history"
    );
    if (!historyContainer) return;

    const historyItems = historyContainer.querySelectorAll(
      ".swagger-nav-history-item"
    );
    const lowerQuery = query.toLowerCase();
    let visibleCount = 0;

    historyItems.forEach((item) => {
      const queryBtn = item.querySelector(".swagger-nav-history-query");
      const historyQuery = queryBtn?.dataset.query || "";

      if (!query || historyQuery.toLowerCase().includes(lowerQuery)) {
        item.style.display = "";
        visibleCount++;
      } else {
        item.style.display = "none";
      }
    });

    const header = historyContainer.querySelector(
      ".swagger-nav-history-header"
    );

    // Show/hide "no results" message
    let noResultsMsg = historyContainer.querySelector(
      ".swagger-nav-history-no-results"
    );

    if (visibleCount === 0 && query) {
      // Show "no results" message
      if (!noResultsMsg) {
        noResultsMsg = document.createElement("div");
        noResultsMsg.className = "swagger-nav-history-no-results";
        noResultsMsg.textContent = `No history matching "${query}"`;
        historyContainer.appendChild(noResultsMsg);
      } else {
        noResultsMsg.textContent = `No history matching "${query}"`;
        noResultsMsg.style.display = "block";
      }
      if (header) header.style.display = "none";
    } else {
      // Hide "no results" message
      if (noResultsMsg) {
        noResultsMsg.style.display = "none";
      }
      if (header) header.style.display = "";
    }
  }

  // Update search history UI
  updateSearchHistoryUI() {
    const historyContainer = this.navBar.querySelector(
      ".swagger-nav-search-history"
    );
    if (!historyContainer) return;

    if (this.searchHistory.length === 0) {
      historyContainer.innerHTML = `
        <div class="swagger-nav-history-empty">No search history</div>
      `;
      return;
    }

    let historyHTML = '<div class="swagger-nav-history-header">';
    historyHTML += "<span>Recent Searches</span>";
    historyHTML +=
      '<button type="button" class="swagger-nav-history-clear-all" title="Clear all history">Clear All</button>';
    historyHTML += "</div>";
    historyHTML += '<div class="swagger-nav-history-items">';

    this.searchHistory.forEach((query) => {
      historyHTML += `
        <div class="swagger-nav-history-item">
          <button type="button" class="swagger-nav-history-query" data-query="${this.escapeHtml(
            query
          )}" title="Search for: ${this.escapeHtml(query)}">
            <span class="swagger-nav-history-icon">🔍</span>
            <span class="swagger-nav-history-text">${this.escapeHtml(
              query
            )}</span>
          </button>
          <button type="button" class="swagger-nav-history-remove" data-query="${this.escapeHtml(
            query
          )}" title="Remove from history" aria-label="Remove from history">×</button>
        </div>
      `;
    });

    historyHTML += "</div>";
    historyContainer.innerHTML = historyHTML;

    // Add event listeners for history items
    const searchInput = this.navBar.querySelector(".swagger-nav-search-input");

    // Clear all button
    const clearAllBtn = historyContainer.querySelector(
      ".swagger-nav-history-clear-all"
    );
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        this.clearSearchHistory();
        this.updateSearchHistoryUI();
      });
    }

    // History item clicks
    const historyItems = historyContainer.querySelectorAll(
      ".swagger-nav-history-query"
    );
    historyItems.forEach((item) => {
      item.addEventListener("click", () => {
        const query = item.dataset.query;
        if (searchInput) {
          searchInput.value = query;
          this.filterEndpoints(query);
          this.hideSearchHistory();
        }
      });
    });

    // Remove buttons
    const removeButtons = historyContainer.querySelectorAll(
      ".swagger-nav-history-remove"
    );
    removeButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const query = btn.dataset.query;
        this.removeFromSearchHistory(query);

        // Re-render and keep dropdown open
        this.updateSearchHistoryUI();

        // Only hide if completely empty, otherwise keep showing
        if (this.searchHistory.length === 0) {
          this.hideSearchHistory();
        } else {
          // Re-apply current filter if any
          const searchInput = this.navBar?.querySelector(
            ".swagger-nav-search-input"
          );
          if (searchInput && searchInput.value) {
            this.filterSearchHistory(searchInput.value);
          }
        }
      });
    });
  }

  // Helper to escape HTML in search queries
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
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

    // Filter regular items
    items.forEach((item) => {
      // Safely get dataset values with proper fallbacks
      const method = String(item.dataset.method || "").toLowerCase();
      const path = String(item.dataset.path || "");
      const summary = String(item.dataset.summary || "");

      const matches =
        method.includes(lowerQuery) ||
        path.includes(lowerQuery) ||
        summary.includes(lowerQuery);

      if (matches) {
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

      const matches =
        method.includes(lowerQuery) ||
        path.includes(lowerQuery) ||
        summary.includes(lowerQuery);

      if (matches) {
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
      const visibleRegularItems = section.querySelectorAll(
        '.swagger-nav-item:not([style*="display: none"])'
      );
      const visiblePinnedItems = section.querySelectorAll(
        '.swagger-nav-pinned-item:not([style*="display: none"])'
      );
      const totalVisibleItems =
        visibleRegularItems.length + visiblePinnedItems.length;

      const sectionContent = section.querySelector(
        ".swagger-nav-section-content"
      );
      const toggle = section.querySelector(".swagger-nav-section-toggle");

      if (totalVisibleItems === 0) {
        section.style.display = "none";
      } else {
        section.style.display = "";

        // Expand all sections during search (except pinned section which has no toggle)
        if (query && !isPinnedSection) {
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
        } else if (!query && !isPinnedSection && section.dataset.wasCollapsed) {
          // Restore original state when search is cleared
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
      if (query) {
        // When searching, show only regular items count (exclude pinned duplicates)
        counter.textContent = `${visibleRegularCount} of ${items.length} endpoints`;
      } else {
        counter.textContent = `${items.length} endpoints`;
      }
    }
  }

  // Scroll to specific endpoint with eye-catching animation
  scrollToEndpoint(endpointId) {
    console.log(`SwaggerNav: scrollToEndpoint called with ID: ${endpointId}`);
    const element = document.getElementById(endpointId);
    console.log(`SwaggerNav: Element found:`, element);
    if (element) {
      console.log(`SwaggerNav: Navigating to endpoint ${endpointId}`);

      // Scroll to element first (top alignment so user can see content after expansion)
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

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
    }
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
}

// Initialize the extension
const swaggerNav = new SwaggerNavigator();
swaggerNav.init();
