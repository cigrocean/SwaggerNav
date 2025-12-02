// SwaggerNav - Parameter Search Feature
// Adds searchable dropdowns for parameter select fields

// This module provides the addSearchableSelects method
// It will be mixed into the SwaggerNavigator class
(function() {
  'use strict';

  // Parameter Search feature implementation
  // This function will be attached to SwaggerNavigator.prototype
  function addSearchableSelects(opblock) {
    const paramRows = opblock.querySelectorAll(".parameters tbody tr");
    if (typeof swaggerNavLog === 'function') {
      swaggerNavLog(`SwaggerNav: Found ${paramRows.length} parameter rows`);
    }

    paramRows.forEach((row, index) => {
      const select = row.querySelector("select");
      if (!select) {
        if (typeof swaggerNavLog === 'function') {
          swaggerNavLog(`SwaggerNav: Row ${index} - no select found`);
        }
        return;
      }

      if (typeof swaggerNavLog === 'function') {
        swaggerNavLog(
          `SwaggerNav: Row ${index} - found select with ${select.options.length} options`
        );
        swaggerNavLog(
          `SwaggerNav: Row ${index} - select parent:`,
          select.parentNode?.tagName,
          select.parentNode?.className
        );
      }

      // Skip if already enhanced AND search wrapper still exists
      if (select.dataset.swaggerNavSearchable) {
        // Verify the search wrapper actually exists in DOM
        const existingWrapper = row.querySelector(".swagger-nav-select-search");
        if (existingWrapper) {
          if (typeof swaggerNavLog === 'function') {
            swaggerNavLog(
              `SwaggerNav: Row ${index} - already enhanced and wrapper exists`
            );
          }
          return;
        } else {
          // Wrapper was removed (endpoint was collapsed/reopened), reset flag
          if (typeof swaggerNavLog === 'function') {
            swaggerNavLog(
              `SwaggerNav: Row ${index} - was marked as enhanced but wrapper is missing, resetting...`
            );
          }
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

      // Create search icon (SVG)
      const searchIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      searchIcon.setAttribute("width", "16");
      searchIcon.setAttribute("height", "16");
      searchIcon.setAttribute("viewBox", "0 0 24 24");
      searchIcon.setAttribute("fill", "none");
      searchIcon.setAttribute("stroke", "currentColor");
      searchIcon.setAttribute("stroke-width", "2");
      searchIcon.setAttribute("stroke-linecap", "round");
      searchIcon.setAttribute("stroke-linejoin", "round");
      searchIcon.style.cssText = "position: absolute !important; left: 12px !important; top: 50% !important; transform: translateY(-50%) !important; color: var(--sn-param-clear-btn) !important; pointer-events: none !important; z-index: 2 !important;";
      searchIcon.innerHTML = `<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>`;

      // Create search input with CSS variables (auto-adapts to theme!)
      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "swagger-nav-select-search";
      searchInput.placeholder = "Search options...";
      searchInput.style.cssText = `display: block !important; width: 100% !important; max-width: none !important; padding: 8px 36px 8px 36px !important; margin: 0 !important; border: 2px solid var(--sn-param-search-border) !important; border-radius: 4px !important; background: var(--sn-param-search-bg) !important; color: var(--sn-param-search-text) !important; font-size: 14px !important; box-sizing: border-box !important; outline: none !important; font-family: sans-serif !important; min-height: 38px !important; line-height: 1.5 !important; z-index: 1 !important; position: relative !important; flex: 1 !important;`;

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
      resultsDropdown.style.cssText = `display: none !important; position: absolute !important; max-height: 250px !important; overflow-y: auto !important; background: var(--sn-param-dropdown-bg) !important; border: 2px solid var(--sn-param-search-border) !important; border-radius: 4px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.35) !important; z-index: 2147483647 !important; box-sizing: border-box !important; font-family: sans-serif !important;`;

      searchWrapper.appendChild(searchIcon);
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
        if (typeof swaggerNavLog === 'function') {
          swaggerNavLog(`SwaggerNav: Row ${index} - search input added`);
        }
      } catch (error) {
        if (typeof swaggerNavError === 'function') {
          swaggerNavError(`SwaggerNav: Row ${index} - ERROR:`, error);
        }
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
          noResult.style.cssText = `padding: 10px 12px; color: var(--sn-param-no-result); font-size: 14px; text-align: center; font-style: italic; font-family: sans-serif !important;`;
          resultsDropdown.appendChild(noResult);
        } else {
          options.forEach((opt, idx) => {
            const resultItem = document.createElement("div");
            resultItem.textContent = opt.text;
            const computedStyle = `padding: 10px 12px !important; cursor: pointer !important; font-size: 14px !important; font-family: sans-serif !important; color: var(--sn-param-search-text) !important; background: var(--sn-param-dropdown-bg) !important; border-bottom: 1px solid var(--sn-param-item-border) !important; transition: background 0.15s !important;`;
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
        clearButton.style.color = "#71717a";
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
          if (typeof swaggerNavLog === 'function') {
            swaggerNavLog(
              `SwaggerNav: Row ${index} - Select value changed (polling detected - likely Reset button)`
            );
          }
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

  // Export function to be attached to SwaggerNavigator prototype
  // This will be called after SwaggerNavigator class is defined
  if (typeof window !== 'undefined') {
    window.SwaggerNavParameterSearch = {
      addSearchableSelects: addSearchableSelects
    };
  }
})();

