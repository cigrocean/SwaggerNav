// SwaggerNav Options Page

// Default settings
const DEFAULT_SETTINGS = {
  autoTryOut: true,
  autoExpand: true,
  theme: "auto", // "light", "dark", or "auto"
  background: "default", // "default", "ocean", "tet", "christmas", "too_many_bugs"
  enableFormView: true,
  enableParamSearch: true,
};

// Load settings on page load
document.addEventListener("DOMContentLoaded", async () => {
  // Display version number
  const versionElement = document.getElementById("version-number");
  if (versionElement) {
    versionElement.textContent = SWAGGERNAV_VERSION;
  }

  await loadSettings();

  // Add change listeners to all checkboxes
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", saveSettings);
  });

  // Add change listeners to theme radio buttons
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  themeRadios.forEach((radio) => {
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

    // Apply settings to UI
    document.getElementById("autoTryOut").checked = result.autoTryOut;
    document.getElementById("autoExpand").checked = result.autoExpand;
    document.getElementById("enableFormView").checked = result.enableFormView;
    document.getElementById("enableParamSearch").checked =
      result.enableParamSearch;

    // Apply theme radio selection
    const themeValue = result.theme || "auto";
    const themeRadio = document.getElementById(`theme-${themeValue}`);
    if (themeRadio) {
      themeRadio.checked = true;
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

    // Apply theme to options page
    applyOptionsPageTheme(result.theme || "auto");

    console.log("SwaggerNav: Settings loaded", result);
  } catch (error) {
    console.error("SwaggerNav: Error loading settings", error);
  }
}

// Save settings to chrome.storage
async function saveSettings() {
  try {
    // Get theme from radio buttons
    const themeRadio = document.querySelector('input[name="theme"]:checked');
    const theme = themeRadio ? themeRadio.value : "auto";

    // Get background from radio buttons
    const backgroundRadio = document.querySelector(
      'input[name="background"]:checked'
    );
    const background = backgroundRadio ? backgroundRadio.value : "default";

    const settings = {
      autoTryOut: document.getElementById("autoTryOut").checked,
      autoExpand: document.getElementById("autoExpand").checked,
      theme: theme,
      background: background,
      enableFormView: document.getElementById("enableFormView").checked,
      enableParamSearch: document.getElementById("enableParamSearch").checked,
    };

    // Apply theme when theme changes
    applyOptionsPageTheme(theme);

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
    statusDiv.textContent =
      "❌ Invalid file type. Please use PNG, JPG, or WebP.";
    statusDiv.style.color = "#dc3545";
    return;
  }

  // Validate file size (5MB = 5 * 1024 * 1024 bytes)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    statusDiv.textContent = `❌ File too large (${sizeMB} MB). Maximum size is 5 MB.`;
    statusDiv.style.color = "#dc3545";
    return;
  }

  // Show uploading status
  statusDiv.textContent = "⏳ Uploading...";
  statusDiv.style.color = "#667eea";

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
      statusDiv.textContent = "✅ Image uploaded successfully!";
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
      statusDiv.textContent = "❌ Error reading file. Please try again.";
      statusDiv.style.color = "#dc3545";
    };

    reader.readAsDataURL(file);
  } catch (error) {
    console.error("Error uploading custom background:", error);
    statusDiv.textContent = "❌ Error uploading image. Please try again.";
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
