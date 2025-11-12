// SwaggerNav - Content Script
// Detects Swagger UI and adds navigation sidebar

class SwaggerNavigator {
  constructor() {
    this.navBar = null;
    this.isSwaggerUI = false;
    this.endpoints = [];
    this.observer = null;
    this.theme = this.detectTheme();
    this.setupThemeListener();
    this.pinnedEndpoints = this.loadPinnedEndpoints();
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
    this.refreshNavBar();
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
        });

        // Find and highlight the actual (non-pinned) endpoint item immediately
        const actualItem = this.findActualEndpointItem(
          foundEndpoint.method,
          foundEndpoint.path
        );

        if (actualItem) {
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
      <div class="swagger-nav-header-left">
        <div class="swagger-nav-title">
          <span class="swagger-nav-icon" aria-hidden="true">📋</span>
          <span>API Navigator</span>
          <span class="swagger-nav-theme-indicator" title="${
            this.theme === "dark" ? "Dark" : "Light"
          } mode (follows OS)" aria-label="${
      this.theme === "dark" ? "Dark" : "Light"
    } mode">${this.theme === "dark" ? "🌙" : "☀️"}</span>
        </div>
        <button type="button" class="swagger-nav-scroll-top-btn" title="Scroll to top of list" aria-label="Scroll to top of list">
          <span class="swagger-nav-btn-icon" aria-hidden="true">⬆</span>
          <span class="swagger-nav-btn-label">Top</span>
        </button>
        <button type="button" class="swagger-nav-sync-btn" title="Sync with current Swagger UI view" aria-label="Sync with current Swagger UI view">
          <span class="swagger-nav-btn-icon" aria-hidden="true">🔄</span>
          <span class="swagger-nav-btn-label">Sync</span>
        </button>
      </div>
      <button type="button" class="swagger-nav-toggle-btn" title="Hide sidebar" aria-label="Hide sidebar" aria-expanded="true">
        <span aria-hidden="true">▶</span>
      </button>
    `;

    this.navBar.appendChild(header);

    // Add search box (sticky, outside content)
    const searchBox = document.createElement("div");
    searchBox.className = "swagger-nav-search";
    searchBox.innerHTML = `
      <input type="text" placeholder="Search endpoints..." class="swagger-nav-search-input" aria-label="Search API endpoints" role="searchbox">
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
          });

          // Add active class to clicked item
          endpointItem.classList.add("active-nav");

          // Navigate to endpoint
          this.scrollToEndpoint(endpoint.id);

          // Remove active class after animation
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

    // Search functionality
    const searchInput = this.navBar.querySelector(".swagger-nav-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.filterEndpoints(e.target.value);
      });
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

  // Filter endpoints based on search
  filterEndpoints(query) {
    if (!query) {
      query = "";
    }
    const lowerQuery = query.toLowerCase();
    const items = this.navBar.querySelectorAll(".swagger-nav-item");
    let visibleCount = 0;

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
        visibleCount++;
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
      const visibleItems = section.querySelectorAll(
        '.swagger-nav-item:not([style*="display: none"])'
      );
      const sectionContent = section.querySelector(
        ".swagger-nav-section-content"
      );
      const toggle = section.querySelector(".swagger-nav-section-toggle");

      if (visibleItems.length === 0) {
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

    // Update counter
    const counter = this.navBar.querySelector(".swagger-nav-counter");
    if (counter) {
      if (query) {
        counter.textContent = `${visibleCount} of ${items.length} endpoints`;
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

      // Scroll to element first
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Always click the endpoint to expand it
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

        if (clickableElement) {
          console.log(
            `SwaggerNav: Found clickable element, triggering click to ${
              isOpen ? "toggle" : "expand"
            }`
          );
          // Always click to ensure it's expanded (or re-expand if already open)
          if (!isOpen) {
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

            // Verify after a delay
            setTimeout(() => {
              const newAriaExpanded =
                clickableElement.getAttribute("aria-expanded");
              console.log(
                `SwaggerNav: After click, aria-expanded is now: ${newAriaExpanded}`
              );
            }, 200);
          } else {
            console.log(
              `SwaggerNav: Endpoint ${endpointId} already open, skipping click`
            );
          }
        } else {
          console.warn(
            `SwaggerNav: Could not find clickable element for endpoint ${endpointId}`
          );
        }
      }, 500); // Increased delay to ensure scroll completes

      // Add dramatic highlight animation
      const originalStyles = {
        outline: element.style.outline,
        outlineOffset: element.style.outlineOffset,
        boxShadow: element.style.boxShadow,
        transform: element.style.transform,
        transition: element.style.transition,
      };

      // Apply eye-catching animation
      element.style.transition = "all 0.3s ease";
      element.style.outline = "3px solid #61affe";
      element.style.outlineOffset = "4px";
      element.style.boxShadow =
        "0 0 20px rgba(97, 175, 254, 0.6), 0 0 40px rgba(97, 175, 254, 0.3)";
      element.style.transform = "scale(1.01)";

      // Pulse animation
      setTimeout(() => {
        element.style.transform = "scale(1.02)";
      }, 150);

      setTimeout(() => {
        element.style.transform = "scale(1.01)";
      }, 300);

      setTimeout(() => {
        element.style.transform = "scale(1.02)";
      }, 450);

      setTimeout(() => {
        element.style.transform = "scale(1.01)";
      }, 600);

      // Fade out the effects
      setTimeout(() => {
        element.style.transition = "all 0.6s ease-out";
        element.style.outline = originalStyles.outline;
        element.style.outlineOffset = originalStyles.outlineOffset;
        element.style.boxShadow = originalStyles.boxShadow;
        element.style.transform = originalStyles.transform;
      }, 1500);

      // Clean up after animation completes
      setTimeout(() => {
        element.style.transition = originalStyles.transition;
      }, 2100);
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

      // Remove active class from all items
      allItems.forEach((item) => item.classList.remove("active-nav"));

      // Add active class to target item
      targetItem.classList.add("active-nav");

      // Scroll the item into view in the sidebar
      targetItem.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Remove active class after animation
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
