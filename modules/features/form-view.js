// SwaggerNav - Form View Feature
// Adds visual form builder alongside JSON editor for request bodies

// This module provides the Form View methods
// They will be mixed into the SwaggerNavigator class
(function() {
  'use strict';

  // Form View feature implementation
  // These functions will be attached to SwaggerNavigator.prototype
  function addFormBuilder(opblock) {
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
        if (wrapper && wrapper.style.display !== "none") {
          wrapper.style.display = "";
        }
      });
      return;
    }

    if (typeof swaggerNavLog === 'function') {
      swaggerNavLog("SwaggerNav: addFormBuilder called");
    }

    // Find ALL textareas - look for textareas that look like JSON request bodies
    const allTextareas = opblock.querySelectorAll("textarea");
    if (typeof swaggerNavLog === 'function') {
      swaggerNavLog(
        `SwaggerNav: Found ${allTextareas.length} textareas in opblock`
      );
    }

    let enhancedCount = 0;

    // Process EACH textarea that looks like a request body
    for (const textarea of allTextareas) {
      // Skip clones that we created
      if (textarea.dataset.swaggerNavClone === "true") {
        if (typeof swaggerNavLog === 'function') {
          swaggerNavLog("SwaggerNav: Skipping clone textarea");
        }
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
          if (typeof swaggerNavLog === 'function') {
            swaggerNavLog(
              `SwaggerNav: Textarea already enhanced (verified), skipping`
            );
          }
          continue;
        } else {
          // Flag was set but container doesn't exist - reset
          if (typeof swaggerNavLog === 'function') {
            swaggerNavLog(
              `SwaggerNav: Textarea flag set but container missing (wrapper hidden: ${hasHiddenWrapper}, container: ${hasContainer}), resetting...`
            );
          }
          textarea.dataset.swaggerNavFormBuilder = "";
        }
      }

      // Generate unique ID for this textarea if it doesn't have one
      if (!textarea.dataset.swaggerNavTextareaId) {
        textarea.dataset.swaggerNavTextareaId = `sn-textarea-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      }

      if (typeof swaggerNavLog === 'function') {
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
      }

      // Mark textarea as enhanced IMMEDIATELY to prevent duplicates
      textarea.dataset.swaggerNavFormBuilder = "true";

      // Create form builder for this textarea
      this.createFormBuilderForTextarea(textarea, opblock);
      enhancedCount++;
    }

    if (enhancedCount === 0) {
      if (typeof swaggerNavLog === 'function') {
        swaggerNavLog("SwaggerNav: No JSON textareas found to enhance");
      }
    } else {
      if (typeof swaggerNavLog === 'function') {
        swaggerNavLog(`SwaggerNav: Enhanced ${enhancedCount} textarea(s)`);
      }
    }
  }

  function createFormBuilderForTextarea(textarea, opblock) {
    const textareaId = textarea.dataset.swaggerNavTextareaId || "unknown";
    if (typeof swaggerNavLog === 'function') {
      swaggerNavLog(
        `SwaggerNav: Creating form builder for textarea ${textareaId}`
      );
    }

    // Create container for side-by-side layout
    const container = document.createElement("div");
    container.className = "swagger-nav-body-container";
    container.dataset.textareaId = textareaId; // Link container to textarea
    if (typeof swaggerNavLog === 'function') {
      swaggerNavLog(`SwaggerNav: Created container for textarea ${textareaId}`);
    }

    // Wrap existing textarea in left panel
    const leftPanel = document.createElement("div");
    leftPanel.className = "swagger-nav-body-panel swagger-nav-body-json";

    const jsonHeader = document.createElement("div");
    jsonHeader.className = "swagger-nav-body-header";
    jsonHeader.innerHTML = "<strong>📄 JSON</strong>";
    leftPanel.appendChild(jsonHeader);

    // Get reference to original textarea parent
    const textareaWrapper = textarea.parentNode;
    if (typeof swaggerNavLog === 'function') {
      swaggerNavLog("SwaggerNav: Textarea wrapper:", textareaWrapper);
    }

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
        if (typeof swaggerNavLog === 'function') {
          swaggerNavLog(
            "SwaggerNav: Textarea value changed (polling detected - likely Reset button)"
          );
        }
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
    if (typeof swaggerNavLog === 'function') {
      swaggerNavLog(
        `SwaggerNav: Panels added to container for textarea ${textareaId}`
      );
    }

    // Hide the original textarea wrapper (keep it in DOM!)
    textareaWrapper.style.display = "none";

    // Insert our container after the hidden wrapper
    textareaWrapper.after(container);
    if (typeof swaggerNavLog === 'function') {
      swaggerNavLog(
        `SwaggerNav: Inserted container for textarea ${textareaId} after wrapper (wrapper now hidden)`
      );
    }

    // Build form from JSON (use the clone)
    this.buildFormFromJSON(textareaClone, formContainer);

    // Debug: Count total containers in this opblock
    const totalContainers = opblock.querySelectorAll(
      ".swagger-nav-body-container"
    ).length;
    if (typeof swaggerNavLog === 'function') {
      swaggerNavLog(
        `SwaggerNav: Total containers in this opblock: ${totalContainers}`
      );
    }

    // Watch for textarea changes, but don't rebuild if form has focus
    let textareaUpdateTimeout;
    let isFormFocused = false;

    // Track when form inputs have focus
    formContainer.addEventListener("focusin", () => {
      isFormFocused = true;
      if (typeof swaggerNavLog === 'function') {
        swaggerNavLog("SwaggerNav: Form has focus, pausing textarea sync");
      }
    });

    formContainer.addEventListener("focusout", () => {
      // Small delay to check if focus moved to another form input
      setTimeout(() => {
        if (!formContainer.contains(document.activeElement)) {
          isFormFocused = false;
          if (typeof swaggerNavLog === 'function') {
            swaggerNavLog("SwaggerNav: Form lost focus, resuming textarea sync");
          }
        }
      }, 50);
    });

    textareaClone.addEventListener("input", () => {
      // Don't rebuild form if user is actively typing in it
      if (isFormFocused) {
        if (typeof swaggerNavLog === 'function') {
          swaggerNavLog(
            "SwaggerNav: Skipping form rebuild - user is typing in form"
          );
        }
        return;
      }

      clearTimeout(textareaUpdateTimeout);
      textareaUpdateTimeout = setTimeout(() => {
        this.buildFormFromJSON(textareaClone, formContainer);
      }, 500);
    });
  }

  function buildFormFromJSON(textarea, formContainer) {
    const isClone = textarea.dataset.swaggerNavClone === "true";
    const textareaId = textarea.dataset.swaggerNavTextareaId || "unknown";
    if (typeof swaggerNavLog === 'function') {
      swaggerNavLog(
        `SwaggerNav: buildFormFromJSON called for ${
          isClone ? "clone of " : ""
        }textarea ${textareaId}`
      );
    }

    // Check if any input in the form currently has focus - if so, skip rebuild to prevent disrupting user input
    const focusedElement = document.activeElement;
    if (
      focusedElement &&
      formContainer.contains(focusedElement) &&
      (focusedElement.tagName === "INPUT" ||
        focusedElement.tagName === "TEXTAREA")
    ) {
      if (typeof swaggerNavLog === 'function') {
        swaggerNavLog(
          `SwaggerNav: Skipping form rebuild - user is typing in ${focusedElement.tagName}`
        );
      }
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
      if (typeof swaggerNavLog === 'function') {
        swaggerNavLog(
          `SwaggerNav: Form built successfully for textarea ${textareaId}`
        );
      }
    } catch (error) {
      formContainer.innerHTML =
        '<p class="swagger-nav-form-error">Invalid JSON</p>';
      if (typeof swaggerNavError === 'function') {
        swaggerNavError(
          `SwaggerNav: Form build error for textarea ${textareaId}:`,
          error
        );
      }
    }
  }

  function buildFormFields(data, container, path, textarea) {
    if (typeof data !== "object" || data === null) return;

    if (Array.isArray(data)) {
      // Handle arrays
      if (data.length === 0) {
        const emptyMsg = document.createElement("p");
        emptyMsg.className = "swagger-nav-form-empty";
        emptyMsg.textContent = "Empty array";
        container.appendChild(emptyMsg);
        return;
      }

      data.forEach((item, index) => {
        const itemPath = path ? `${path}[${index}]` : `[${index}]`;

        if (item !== null && typeof item === "object") {
          // Nested object or array in array
          const fieldset = document.createElement("div");
          fieldset.className = "swagger-nav-form-fieldset";

          const legend = document.createElement("div");
          legend.className = "swagger-nav-form-legend";

          if (Array.isArray(item)) {
            fieldset.classList.add("swagger-nav-form-array");
            legend.innerHTML = `📋 Item ${index} <span style="font-size: 10px; opacity: 0.7;">(Array with ${
              item.length
            } item${item.length !== 1 ? "s" : ""})</span>`;
          } else {
            legend.textContent = `Item ${index}`;
          }
          fieldset.appendChild(legend);

          this.buildFormFields(item, fieldset, itemPath, textarea);
          container.appendChild(fieldset);
        } else {
          // Primitive value in array - create input
          const field = document.createElement("div");
          field.className = "swagger-nav-form-field";

          const label = document.createElement("label");
          label.className = "swagger-nav-form-label";
          label.textContent = `[${index}]`;

          let input;
          if (typeof item === "boolean") {
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = item === true;
            input.className = "swagger-nav-form-checkbox";
          } else if (typeof item === "number") {
            input = document.createElement("input");
            input.type = "number";
            input.value = item === null ? "" : item;
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

  function updateJSONFromForm(textarea, path, input) {
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
            if (typeof swaggerNavLog === 'function') {
              swaggerNavLog(
                `SwaggerNav: Allowing partial number input "${inputValue}" during typing`
              );
            }
            return; // Skip update, let user finish typing
          }

          const parsed = parseFloat(inputValue);
          if (isNaN(parsed)) {
            if (typeof swaggerNavWarn === 'function') {
              swaggerNavWarn(
                `SwaggerNav: Invalid number "${inputValue}", defaulting to 0`
              );
            }
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
      if (typeof swaggerNavError === 'function') {
        swaggerNavError("SwaggerNav: Failed to update JSON from form", error);
      }
    }
  }

  function setNestedValue(obj, path, value) {
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

  // Export functions to be attached to SwaggerNavigator prototype
  if (typeof window !== 'undefined') {
    window.SwaggerNavFormView = {
      addFormBuilder: addFormBuilder,
      createFormBuilderForTextarea: createFormBuilderForTextarea,
      buildFormFromJSON: buildFormFromJSON,
      buildFormFields: buildFormFields,
      updateJSONFromForm: updateJSONFromForm,
      setNestedValue: setNestedValue
    };
  }
})();

