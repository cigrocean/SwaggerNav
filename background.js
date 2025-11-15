// SwaggerNav Service Worker (Background Script)
// Required for Manifest V3

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openOptionsPage") {
    console.log("SwaggerNav: Opening options page from service worker");
    
    // Open options page using the proper API from service worker context
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) {
        console.error("SwaggerNav: Error opening options page", chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log("SwaggerNav: Options page opened successfully");
        sendResponse({ success: true });
      }
    });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

console.log("SwaggerNav: Service worker initialized");

