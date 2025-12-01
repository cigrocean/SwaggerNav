// SwaggerNav - Loading Overlay
// Creates and manages the loading overlay that appears while SwaggerNav is initializing

// Create loading overlay only on Swagger UI pages
(function () {
  function createLoadingOverlay() {
    // Check if overlay already exists
    if (
      document.getElementById("swagger-nav-loading-overlay") ||
      window._swaggerNavLoadingOverlay
    ) {
      return;
    }

    // Only create overlay if this is a Swagger UI page
    if (typeof isSwaggerUIPageEarly === 'function' && !isSwaggerUIPageEarly()) {
      return;
    }

    const loadingOverlay = document.createElement("div");
    loadingOverlay.id = "swagger-nav-loading-overlay";
    loadingOverlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background-color: rgba(0, 0, 0, 0.85) !important;
      z-index: 999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    `;

    const loadingText = document.createElement("div");
    loadingText.textContent = "SwaggerNav sidebar is loading...";
    loadingText.style.cssText = `
      color: #ffffff !important;
      font-size: 24px !important;
      font-weight: 500 !important;
      text-align: center !important;
      animation: swagger-nav-loading-pulse 1.5s ease-in-out infinite !important;
    `;

    loadingOverlay.appendChild(loadingText);

    // Add CSS animation if not already added
    if (!document.getElementById("swagger-nav-loading-style")) {
      const style = document.createElement("style");
      style.id = "swagger-nav-loading-style";
      style.textContent = `
        @keyframes swagger-nav-loading-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // Append to body if it exists, otherwise wait for it
    if (document.body) {
      document.body.appendChild(loadingOverlay);
    } else {
      // Wait for body to be ready
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          if (document.body) {
            document.body.appendChild(loadingOverlay);
          }
        });
      } else {
        // Use a fallback - append to documentElement
        document.documentElement.appendChild(loadingOverlay);
      }
    }

    // Store reference globally so we can hide it later
    window._swaggerNavLoadingOverlay = loadingOverlay;
  }

  // Create overlay only if Swagger UI is detected
  createLoadingOverlay();
})();

