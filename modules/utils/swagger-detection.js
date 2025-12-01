// SwaggerNav - Swagger UI Detection Utilities
// Helper functions to detect if current page is Swagger UI

// Helper function to check if current page is Swagger UI (early check)
// This is used before the main init() to avoid creating loading overlay on non-Swagger pages
function isSwaggerUIPageEarly() {
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
    return false;
  }
}

// Helper function to check if current page is Swagger UI
// Use try-catch to prevent infinite recursion from getters
function checkIsSwaggerUIPage() {
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

