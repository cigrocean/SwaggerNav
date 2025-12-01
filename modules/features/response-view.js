// SwaggerNav - Response View Feature
// Adds structured view with editable checkboxes for response comparison

// This module provides the Response View methods
// They will be mixed into the SwaggerNavigator class
(function() {
  'use strict';

  // Response View feature implementation
  function addResponseView(opblock) {
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

          // CRITICAL: Update the view with latest data!
          // This ensures that if the user re-executed the request, we show the new data
          if (typeof existingContainer.updateResponseView === "function") {
            swaggerNavLog(
              "SwaggerNav: Updating existing Response View with latest data"
            );
            existingContainer.updateResponseView();
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
              currentCodeElement =
                originalWrapper.querySelector("code") ||
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
              currentCodeElement =
                currentPre.querySelector("code") || currentPre;
            }
          }

          // Strategy 4: Fallback to the initial codeElement (should rarely happen)
          if (!currentCodeElement) {
            currentCodeElement = codeElement;
          }

          if (!currentCodeElement) {
            swaggerNavWarn(
              "SwaggerNav: Could not find current response element"
            );
            return null;
          }

          const text = currentCodeElement.textContent.trim();
          if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
            return null;
          }

          try {
            const data = JSON.parse(text);
            // Only log occasionally to avoid performance impact
            if (Math.random() < 0.1) {
              // Log only 10% of the time
              swaggerNavLog("SwaggerNav: Got current response data", {
                textLength: text.length,
                keys:
                  typeof data === "object" && data !== null
                    ? Object.keys(data).slice(0, 3)
                    : "not object",
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
            const originalCodeEl =
              originalWrapper.querySelector("code") ||
              originalWrapper.querySelector("pre code") ||
              originalWrapper.querySelector("pre");
            if (originalCodeEl) {
              return (
                originalCodeEl.textContent || originalCodeEl.innerText || ""
              );
            }
          }
          // Fallback: try to find the current response in the parent container
          const currentPre = parentContainer.querySelector(
            "pre:not([data-swagger-nav-response-view])"
          );
          if (currentPre) {
            const currentCodeEl =
              currentPre.querySelector("code") || currentPre;
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
        const currentResponseData = getCurrentResponseData
          ? getCurrentResponseData()
          : initialResponseData;
        if (currentResponseData) {
          this.buildResponseView(currentResponseData, viewContainer);
        } else {
          swaggerNavWarn(
            "SwaggerNav: Could not get current response data for Response View"
          );
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
        const originalCodeElement =
          preElement.querySelector("code") || preElement;

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
              currentOriginalElement =
                hiddenWrapper.querySelector("code") ||
                hiddenWrapper.querySelector("pre code") ||
                hiddenWrapper.querySelector("pre");
            }
            // If still not found, try finding any code element in the parent container
            if (!currentOriginalElement) {
              const currentPre = parentContainer.querySelector(
                "pre:not([data-swagger-nav-response-view])"
              );
              if (currentPre) {
                currentOriginalElement =
                  currentPre.querySelector("code") || currentPre;
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
              const clonedCodeElement =
                codeClone.querySelector("code") || codeClone;
              const originalCodeElement =
                currentOriginalElement.querySelector("code") ||
                currentOriginalElement;

              if (clonedCodeElement && originalCodeElement) {
                // Preserve the HTML structure (including syntax highlighting spans)
                // Only update if the innerHTML is different to avoid unnecessary DOM updates
                if (
                  clonedCodeElement.innerHTML !== originalCodeElement.innerHTML
                ) {
                  clonedCodeElement.innerHTML = originalCodeElement.innerHTML;
                }
                // Also sync classes to preserve highlighting classes
                if (
                  clonedCodeElement.className !== originalCodeElement.className
                ) {
                  clonedCodeElement.className = originalCodeElement.className;
                }
              } else if (
                clonedCodeElement &&
                clonedCodeElement.textContent !== newText
              ) {
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

        // Attach update function to container so we can call it later (e.g. when re-opening view)
        container.updateResponseView = updateResponseView;

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

            if (
              newCodeBlocks.length > 0 ||
              (currentResponsePre && !currentHiddenWrapper)
            ) {
              // Re-run addResponseView to catch new/replaced responses
              swaggerNavLog(
                "SwaggerNav: New/replaced response detected, re-adding Response View",
                {
                  newCodeBlocks: newCodeBlocks.length,
                  hasCurrentPre: !!currentResponsePre,
                }
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
  function addButtonsToDefaultResponse(opblock) {
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
  function removeButtonsFromDefaultResponse(opblock) {
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

  function buildResponseView(data, container) {
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

  function buildResponseFields(data, container, path) {
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

  // Export functions to be attached to SwaggerNavigator prototype
  if (typeof window !== "undefined") {
    window.SwaggerNavResponseView = {
      addResponseView: addResponseView,
      addButtonsToDefaultResponse: addButtonsToDefaultResponse,
      removeButtonsFromDefaultResponse: removeButtonsFromDefaultResponse,
      buildResponseView: buildResponseView,
      buildResponseFields: buildResponseFields
    };
  }
})();
