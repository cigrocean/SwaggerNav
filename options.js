// SwaggerNav Options Page

// Create SVG icon helper function
function createIcon(iconName, size = 16) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.style.display = "inline-block";
  svg.style.verticalAlign = "middle";

  const icons = {
    compass: `<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>`,
    zap: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>`,
    unlock: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>`,
    folder: `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>`,
    file: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>`,
    sun: `<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>`,
    moon: `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`,
    refresh: `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path>`,
    palette: `<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>`,
    camera: `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle>`,
    check: `<path d="M20 6 9 17l-5-5"></path>`,
    heart: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.84-7.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>`,
    edit: `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>`,
    search: `<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>`,
    barChart: `<line x1="12" x2="12" y1="20" y2="10"></line><line x1="18" x2="18" y1="20" y2="4"></line><line x1="6" x2="6" y1="20" y2="16"></line>`,
    sparkles: `<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>`,
    alertTriangle: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" x2="12" y1="9" y2="13"></line><line x1="12" x2="12.01" y1="17" y2="17"></line>`,
    x: `<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>`,
    clock: `<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>`,
    lightbulb: `<line x1="9" x2="15" y1="21" y2="21"></line><line x1="12" x2="12" y1="3" y2="21"></line><path d="M5 12H7M17 12H19M11 5H13M11 19H13"></path>`,
  };

  if (icons[iconName]) {
    svg.innerHTML = icons[iconName];
  }

  return svg;
}

// Replace emojis with SVG icons on page load
function replaceEmojisWithIcons() {
  // Replace header icon
  const headerIcon = document.querySelector(".icon");
  if (headerIcon && !headerIcon.querySelector("svg")) {
    headerIcon.innerHTML = "";
    headerIcon.appendChild(createIcon("compass", 24));
  }

  // Replace section title emojis
  const sectionTitles = document.querySelectorAll(".section-title");
  sectionTitles.forEach((title) => {
    const text = title.textContent || "";
    if (text.includes("⚡") || (title.textContent.trim() === "" && !title.querySelector("svg"))) {
      // Check if this is the Auto Actions section (first section title)
      const section = title.closest(".section");
      if (section && section.querySelector('[id="autoTryOut"]')) {
        title.innerHTML = "";
        title.appendChild(createIcon("zap", 18));
        title.appendChild(document.createTextNode(" Auto Actions"));
      }
    } else if (text.includes("✨")) {
      title.innerHTML = "";
      title.appendChild(createIcon("sparkles", 18));
      title.appendChild(document.createTextNode(" Enhanced Features"));
    }
  });

  // Replace option emoji icons
  const optionEmojis = document.querySelectorAll(".option-emoji");
  optionEmojis.forEach((emoji) => {
    if (emoji.querySelector("svg")) return; // Already has icon
    
    const parent = emoji.parentElement;
    const text = parent.textContent || "";
    const label = parent.querySelector(".option-label");
    const labelText = label ? label.textContent.trim() : "";
    
    emoji.innerHTML = "";
    if (text.includes("🔓") || labelText.includes("Auto Try It Out")) {
      emoji.appendChild(createIcon("unlock", 20));
    } else if (text.includes("📂") || labelText.includes("Auto Expand")) {
      emoji.appendChild(createIcon("folder", 20));
    } else if (text.includes("📄") || labelText.includes("Swagger UI Theme")) {
      emoji.appendChild(createIcon("file", 20));
    } else if (text.includes("🧭") || labelText.includes("Extension Theme")) {
      emoji.appendChild(createIcon("compass", 20));
    } else if (text.includes("🎨") || labelText.includes("Background")) {
      emoji.appendChild(createIcon("palette", 20));
    } else if (text.includes("📝") || labelText.includes("JSON & Form View")) {
      emoji.appendChild(createIcon("edit", 20));
    } else if (text.includes("🔍") || labelText.includes("Parameter Search")) {
      emoji.appendChild(createIcon("search", 20));
    } else if (text.includes("📊") || labelText.includes("Response View")) {
      emoji.appendChild(createIcon("barChart", 20));
    } else if (text.includes("✨")) {
      emoji.appendChild(createIcon("sparkles", 20));
    }
  });

  // Replace theme icons
  const themeIcons = document.querySelectorAll(".theme-icon");
  themeIcons.forEach((icon) => {
    const parent = icon.closest(".theme-option-content");
    if (parent && !icon.querySelector("svg")) {
      const text = parent.textContent || "";
      const label = parent.querySelector(".theme-label");
      icon.innerHTML = "";
      if (text.includes("☀️") || (label && label.textContent.trim() === "Light")) {
        icon.appendChild(createIcon("sun", 32));
      } else if (text.includes("🌙") || (label && label.textContent.trim() === "Dark")) {
        icon.appendChild(createIcon("moon", 32));
      } else if (text.includes("🔄") || (label && label.textContent.trim() === "Follow OS")) {
        icon.appendChild(createIcon("refresh", 32));
      }
    }
  });

  // Replace custom background camera icon
  const customPreview = document.getElementById("customBackgroundPreview");
  if (customPreview) {
    const cameraSpan = customPreview.querySelector(".camera-icon-placeholder");
    if (cameraSpan && !cameraSpan.querySelector("svg")) {
      cameraSpan.innerHTML = "";
      cameraSpan.appendChild(createIcon("camera", 32));
    }
  }

  // Replace status message checkmark
  const statusMessage = document.getElementById("statusMessage");
  if (statusMessage && statusMessage.textContent.includes("✓")) {
    statusMessage.innerHTML = "";
    statusMessage.appendChild(createIcon("check", 14));
    statusMessage.appendChild(document.createTextNode(" Settings saved!"));
  }

  // Replace footer heart
  const footer = document.querySelector(".footer");
  if (footer) {
    const text = footer.innerHTML;
    if (text.includes("💜")) {
      footer.innerHTML = text.replace("💜", "");
      const heartIcon = createIcon("heart", 14);
      heartIcon.style.margin = "0 4px";
      footer.insertBefore(heartIcon, footer.firstChild);
    }
  }

  // Replace note emojis
  const notes = document.querySelectorAll(".note");
  notes.forEach((note) => {
    const strong = note.querySelector("strong");
    if (strong) {
      const warningIcon = strong.querySelector(".note-warning-icon");
      if (warningIcon && !warningIcon.querySelector("svg")) {
        warningIcon.innerHTML = "";
        warningIcon.appendChild(createIcon("alertTriangle", 14));
      } else if (strong.textContent.includes("⚠️")) {
        strong.innerHTML = "";
        strong.appendChild(createIcon("alertTriangle", 14));
        strong.appendChild(document.createTextNode(" Important:"));
      } else if (strong.textContent.includes("💡")) {
        strong.innerHTML = "";
        strong.appendChild(createIcon("lightbulb", 14));
        strong.appendChild(document.createTextNode(" Pro Tip:"));
      }
    }
  });

  // Replace error/success messages in options.js (for dynamic messages)
  const originalStatusDivTextContent = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "textContent"
  );
  // We'll handle this in the actual functions that set textContent
}

// Default settings
const DEFAULT_SETTINGS = {
  autoTryOut: true,
  autoExpand: true,
  swaggerUITheme: "auto", // "light", "dark", or "auto"
  extensionTheme: "auto", // "light", "dark", or "auto"
  background: "default", // "default", "ocean", "tet", "christmas", "too_many_bugs"
  enableFormView: true,
  enableParamSearch: true,
  enableResponseView: true,
  liquidGlass: false, // iOS 26-style liquid glass effect
};

// Load settings on page load
document.addEventListener("DOMContentLoaded", async () => {
  // Display version number
  const versionElement = document.getElementById("version-number");
  if (versionElement) {
    versionElement.textContent = SWAGGERNAV_VERSION;
  }

  await loadSettings();

  // Replace all emojis with SVG icons
  replaceEmojisWithIcons();

  // Add change listeners to all checkboxes
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", saveSettings);
  });

  // Add change listeners to theme radio buttons
  const swaggerUIThemeRadios = document.querySelectorAll(
    'input[name="swaggerUITheme"]'
  );
  swaggerUIThemeRadios.forEach((radio) => {
    radio.addEventListener("change", saveSettings);
  });

  const extensionThemeRadios = document.querySelectorAll(
    'input[name="extensionTheme"]'
  );
  extensionThemeRadios.forEach((radio) => {
    radio.addEventListener("change", saveSettings);
  });

  // Add change listeners to background radio buttons
  const backgroundRadios = document.querySelectorAll(
    'input[name="background"]'
  );
  backgroundRadios.forEach((radio) => {
    radio.addEventListener("change", async (e) => {
      await saveSettings();
      // Show/hide custom background uploader
      toggleCustomBackgroundUploader(e.target.value === "custom");
    });
  });

  // Custom background upload handlers
  setupCustomBackgroundHandlers();
});

// Load settings from chrome.storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);

    // Backward compatibility: migrate old "theme" setting to both new settings
    if (result.theme && !result.swaggerUITheme && !result.extensionTheme) {
      result.swaggerUITheme = result.theme;
      result.extensionTheme = result.theme;
      // Save migrated settings
      await chrome.storage.sync.set({
        swaggerUITheme: result.theme,
        extensionTheme: result.theme,
      });
      console.log(
        "SwaggerNav: Migrated theme setting to swaggerUITheme and extensionTheme"
      );
    }

    // Apply settings to UI
    document.getElementById("autoTryOut").checked = result.autoTryOut;
    document.getElementById("autoExpand").checked = result.autoExpand;
    document.getElementById("enableFormView").checked = result.enableFormView;
    document.getElementById("enableParamSearch").checked =
      result.enableParamSearch;
    document.getElementById("enableResponseView").checked =
      result.enableResponseView;
    document.getElementById("liquidGlass").checked = result.liquidGlass;

    // Apply Swagger UI theme radio selection
    const swaggerUIThemeValue = result.swaggerUITheme || "auto";
    const swaggerUIThemeRadio = document.getElementById(
      `swaggerUITheme-${swaggerUIThemeValue}`
    );
    if (swaggerUIThemeRadio) {
      swaggerUIThemeRadio.checked = true;
    }

    // Apply Extension theme radio selection
    const extensionThemeValue = result.extensionTheme || "auto";
    const extensionThemeRadio = document.getElementById(
      `extensionTheme-${extensionThemeValue}`
    );
    if (extensionThemeRadio) {
      extensionThemeRadio.checked = true;
    }

    // Apply background radio selection
    const backgroundValue = result.background || "default";
    const backgroundRadio = document.getElementById(
      `background-${backgroundValue}`
    );
    if (backgroundRadio) {
      backgroundRadio.checked = true;
    }

    // Show custom background uploader if custom is selected
    if (backgroundValue === "custom") {
      toggleCustomBackgroundUploader(true);
    }

    // Apply theme to options page (use extension theme for options page)
    applyOptionsPageTheme(extensionThemeValue);

    // Apply liquid glass to options page
    applyLiquidGlassToOptions(result.liquidGlass || false);

    console.log("SwaggerNav: Settings loaded", result);
  } catch (error) {
    console.error("SwaggerNav: Error loading settings", error);
  }
}

// Save settings to chrome.storage
async function saveSettings() {
  try {
    // Get Swagger UI theme from radio buttons
    const swaggerUIThemeRadio = document.querySelector(
      'input[name="swaggerUITheme"]:checked'
    );
    const swaggerUITheme = swaggerUIThemeRadio
      ? swaggerUIThemeRadio.value
      : "auto";

    // Get Extension theme from radio buttons
    const extensionThemeRadio = document.querySelector(
      'input[name="extensionTheme"]:checked'
    );
    const extensionTheme = extensionThemeRadio
      ? extensionThemeRadio.value
      : "auto";

    // Get background from radio buttons
    const backgroundRadio = document.querySelector(
      'input[name="background"]:checked'
    );
    const background = backgroundRadio ? backgroundRadio.value : "default";

    const settings = {
      autoTryOut: document.getElementById("autoTryOut").checked,
      autoExpand: document.getElementById("autoExpand").checked,
      swaggerUITheme: swaggerUITheme,
      extensionTheme: extensionTheme,
      background: background,
      enableFormView: document.getElementById("enableFormView").checked,
      enableParamSearch: document.getElementById("enableParamSearch").checked,
      enableResponseView: document.getElementById("enableResponseView").checked,
      liquidGlass: document.getElementById("liquidGlass").checked,
    };

    // Apply theme when extension theme changes (options page uses extension theme)
    applyOptionsPageTheme(extensionTheme);

    // Apply liquid glass when it changes
    applyLiquidGlassToOptions(settings.liquidGlass);

    await chrome.storage.sync.set(settings);

    console.log("SwaggerNav: Settings saved", settings);

    // Show success message
    showStatusMessage();
  } catch (error) {
    console.error("SwaggerNav: Error saving settings", error);
  }
}

// Show status message animation
function showStatusMessage() {
  const message = document.getElementById("statusMessage");
  message.classList.add("show");

  setTimeout(() => {
    message.classList.remove("show");
  }, 2000);
}

// Apply theme to options page
function applyOptionsPageTheme(theme) {
  // Remove all theme classes first
  document.body.classList.remove("force-light-mode", "force-dark-mode");

  if (theme === "light") {
    // Force light mode
    document.body.classList.add("force-light-mode");
  } else if (theme === "dark") {
    // Force dark mode
    document.body.classList.add("force-dark-mode");
  }
  // If theme === "auto", no class needed - follows OS preference via @media
}

// Apply liquid glass effect to options page
function applyLiquidGlassToOptions(enabled) {
  if (enabled) {
    document.body.classList.add("liquid-glass-enabled");
    console.log("SwaggerNav: Liquid glass enabled on options page");
  } else {
    document.body.classList.remove("liquid-glass-enabled");
    console.log("SwaggerNav: Liquid glass disabled on options page");
  }
}

// ==============================================================================
// Custom Background Upload Feature
// ==============================================================================

function setupCustomBackgroundHandlers() {
  const uploadButton = document.getElementById("uploadButton");
  const fileInput = document.getElementById("customBackgroundInput");
  const deleteButton = document.getElementById("deleteCustomBackground");

  // Upload button clicks file input
  uploadButton.addEventListener("click", () => {
    fileInput.click();
  });

  // Handle file selection
  fileInput.addEventListener("change", handleFileUpload);

  // Handle delete
  deleteButton.addEventListener("click", handleDelete);

  // Load and display existing custom background if any
  loadCustomBackground();
}

function toggleCustomBackgroundUploader(show) {
  const uploader = document.getElementById("customBackgroundUploader");
  uploader.style.display = show ? "block" : "none";
}

async function loadCustomBackground() {
  try {
    const result = await chrome.storage.local.get(["customBackground"]);
    const preview = document.getElementById("customBackgroundPreview");
    const manager = document.getElementById("customBackgroundManager");
    const info = document.getElementById("customBackgroundInfo");

    if (result.customBackground) {
      // Show preview
      preview.style.backgroundImage = `url(${result.customBackground})`;
      preview.classList.add("has-image");

      // Show manager UI
      manager.style.display = "block";

      // Show file info
      const sizeKB = Math.round((result.customBackground.length * 0.75) / 1024);
      info.textContent = `Image uploaded (≈${sizeKB} KB)`;

      // If custom is selected, show uploader
      const customRadio = document.getElementById("background-custom");
      if (customRadio && customRadio.checked) {
        toggleCustomBackgroundUploader(true);
      }
    } else {
      // No custom background
      preview.style.backgroundImage = "";
      preview.classList.remove("has-image");
      manager.style.display = "none";
    }
  } catch (error) {
    console.error("Error loading custom background:", error);
  }
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  const statusDiv = document.getElementById("uploadStatus");

  if (!file) return;

  // Reset file input
  event.target.value = "";

  // Validate file type
  const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!validTypes.includes(file.type)) {
    statusDiv.innerHTML = "";
    const errorIcon = createIcon("x", 14);
    errorIcon.style.marginRight = "4px";
    statusDiv.appendChild(errorIcon);
    statusDiv.appendChild(
      document.createTextNode(
        " Invalid file type. Please use PNG, JPG, or WebP."
      )
    );
    statusDiv.style.color = "#dc3545";
    return;
  }

  // Validate file size (5MB = 5 * 1024 * 1024 bytes)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    statusDiv.innerHTML = "";
    const errorIcon = createIcon("x", 14);
    errorIcon.style.marginRight = "4px";
    statusDiv.appendChild(errorIcon);
    statusDiv.appendChild(
      document.createTextNode(
        ` File too large (${sizeMB} MB). Maximum size is 5 MB.`
      )
    );
    statusDiv.style.color = "#dc3545";
    return;
  }

  // Show uploading status
  statusDiv.innerHTML = "";
  const clockIcon = createIcon("clock", 14);
  clockIcon.style.marginRight = "4px";
  statusDiv.appendChild(clockIcon);
  statusDiv.appendChild(document.createTextNode(" Uploading..."));
  statusDiv.style.color = "#71717a";

  try {
    // Read file as data URL
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;

      // Store in chrome.storage.local (not sync - images are too large)
      await chrome.storage.local.set({ customBackground: dataUrl });

      // Update preview
      await loadCustomBackground();

      // Automatically select "Custom" background option
      const customRadio = document.getElementById("background-custom");
      if (customRadio) {
        customRadio.checked = true;
      }

      // Save settings to apply the custom background
      await saveSettings();

      // Show success
      statusDiv.innerHTML = "";
      const checkIcon = createIcon("check", 14);
      checkIcon.style.marginRight = "4px";
      statusDiv.appendChild(checkIcon);
      statusDiv.appendChild(
        document.createTextNode(" Image uploaded successfully!")
      );
      statusDiv.style.color = "#10b981";

      setTimeout(() => {
        statusDiv.textContent = "";
      }, 3000);

      console.log("Custom background uploaded successfully");

      // Notify all tabs to reload the background immediately
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { type: "RELOAD_BACKGROUND" }, () => {
            // Ignore errors for tabs that don't have the content script
            if (chrome.runtime.lastError) {
              // Silently ignore
            }
          });
        });
      });
    };

    reader.onerror = () => {
      statusDiv.innerHTML = "";
      const errorIcon = createIcon("x", 14);
      errorIcon.style.marginRight = "4px";
      statusDiv.appendChild(errorIcon);
      statusDiv.appendChild(
        document.createTextNode(" Error reading file. Please try again.")
      );
      statusDiv.style.color = "#dc3545";
    };

    reader.readAsDataURL(file);
  } catch (error) {
    console.error("Error uploading custom background:", error);
    statusDiv.innerHTML = "";
    const errorIcon = createIcon("x", 14);
    errorIcon.style.marginRight = "4px";
    statusDiv.appendChild(errorIcon);
    statusDiv.appendChild(
      document.createTextNode(" Error uploading image. Please try again.")
    );
    statusDiv.style.color = "#dc3545";
  }
}

async function handleDelete() {
  if (!confirm("Are you sure you want to delete your custom background?")) {
    return;
  }

  try {
    // Remove from storage
    await chrome.storage.local.remove("customBackground");

    // Update preview
    await loadCustomBackground();

    // Switch to default background
    const defaultRadio = document.getElementById("background-default");
    if (defaultRadio) {
      defaultRadio.checked = true;
      await saveSettings();
      toggleCustomBackgroundUploader(false);
    }

    // Show success message
    showStatusMessage();

    console.log("Custom background deleted successfully");
  } catch (error) {
    console.error("Error deleting custom background:", error);
    alert("Error deleting custom background. Please try again.");
  }
}
