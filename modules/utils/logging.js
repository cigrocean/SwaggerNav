// SwaggerNav - Logging Utilities
// Conditional logging - only log on Swagger UI pages

// Conditional logging - only log on Swagger UI pages
function swaggerNavLog(...args) {
  if (typeof checkIsSwaggerUIPage === 'function' && checkIsSwaggerUIPage()) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

// Conditional error logging - only log on Swagger UI pages
function swaggerNavError(...args) {
  if (typeof checkIsSwaggerUIPage === 'function' && checkIsSwaggerUIPage()) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
}

// Conditional warning logging - only log on Swagger UI pages
function swaggerNavWarn(...args) {
  if (typeof checkIsSwaggerUIPage === 'function' && checkIsSwaggerUIPage()) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
}

