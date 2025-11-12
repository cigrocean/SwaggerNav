# Light/Dark Mode Guide

SwaggerNav automatically adapts to your operating system's appearance settings.

## How It Works

The extension uses CSS custom properties (variables) and the `prefers-color-scheme` media query to automatically detect and apply the appropriate theme.

### Automatic Detection

- **Dark Mode**: Activates when your OS is set to dark mode
- **Light Mode**: Activates when your OS is set to light mode
- **Real-time Switching**: Changes instantly when you toggle your OS settings

## Theme Indicator

Look for the theme icon in the navigation header:
- 🌙 = Dark mode is active
- ☀️ = Light mode is active

Hover over the icon to see the tooltip: "Dark mode (follows OS)" or "Light mode (follows OS)"

## How to Test

### On macOS:

1. **Check current theme**: Look at the 🌙 or ☀️ icon in SwaggerNav header
2. **Toggle system theme**: 
   - Open System Settings → Appearance
   - Select "Light" or "Dark"
   - Or use Control Center shortcut
3. **Watch the extension**: Theme changes immediately without reload

### On Windows:

1. **Check current theme**: Look at the 🌙 or ☀️ icon in SwaggerNav header
2. **Toggle system theme**:
   - Open Settings → Personalization → Colors
   - Under "Choose your mode", select "Light" or "Dark"
3. **Watch the extension**: Theme changes immediately without reload

### Using Browser DevTools:

You can also test theme switching using Chrome DevTools:

1. Open Chrome DevTools (F12)
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
3. Type "Rendering" and select "Show Rendering"
4. Find "Emulate CSS media feature prefers-color-scheme"
5. Select "prefers-color-scheme: dark" or "prefers-color-scheme: light"
6. Watch the extension theme change instantly

## Color Palette

### Dark Mode (Default)
```css
Background:     #1f1f1f (primary), #2d2d2d (secondary)
Text:           #e0e0e0 (primary), #999 (secondary)
Borders:        #404040
Accent:         #61affe (Swagger blue)
```

### Light Mode
```css
Background:     #f7f7f7 (primary), #ffffff (secondary)
Text:           #333 (primary), #666 (secondary)
Borders:        #e1e1e1
Accent:         #61affe (Swagger blue)
```

## Technical Implementation

### CSS Variables

All colors are defined as CSS custom properties in `:root`:

```css
:root {
  --sn-bg-primary: #1f1f1f;
  --sn-text-primary: #e0e0e0;
  --sn-accent: #61affe;
  /* ... more variables */
}

@media (prefers-color-scheme: light) {
  :root {
    --sn-bg-primary: #f7f7f7;
    --sn-text-primary: #333;
    /* ... overrides for light mode */
  }
}
```

### JavaScript Detection

The extension detects the theme on initialization and listens for changes:

```javascript
detectTheme() {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

setupThemeListener() {
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeQuery.addEventListener('change', (e) => {
    this.theme = e.matches ? 'dark' : 'light';
    this.updateThemeIndicator();
  });
}
```

## Benefits

✅ **Automatic** - No manual configuration needed  
✅ **Consistent** - Matches your system-wide preference  
✅ **Instant** - Changes immediately when OS theme changes  
✅ **Accessible** - Respects user's visual preferences  
✅ **Efficient** - No JavaScript theme switching, pure CSS  
✅ **Standard** - Uses web standards (CSS custom properties + media queries)

## Troubleshooting

### Theme not changing?

1. Check your OS theme settings are actually changing
2. Try refreshing the Swagger UI page
3. Check browser console for any errors
4. Verify you're using a modern browser (Chrome 88+)

### Theme stuck on one mode?

1. Open DevTools Console (F12)
2. Check for "SwaggerNav: Initializing with X mode" message
3. Try toggling OS theme and check for "Theme changed to X mode" message
4. If no messages appear, reload the extension

### Colors look wrong?

1. Make sure you're using the latest version
2. Check if another extension is interfering
3. Disable all other extensions and test
4. Clear browser cache and reload

## Future Enhancements

Potential improvements for future versions:

- [ ] Manual theme toggle (override OS setting)
- [ ] Custom color schemes
- [ ] Theme persistence across sessions
- [ ] More color palette options
- [ ] Theme preview in options page
- [ ] Schedule-based theme switching

---

**Note**: The theme follows your OS preference by default and cannot be manually overridden in version 1.0.0. This ensures consistency with your system-wide appearance settings.

