# SwaggerNav Version Management

## Current Version: 1.0.1

## How to Update the Version

### Step 1: Update the Version Constant
Edit `content.js` and change the version constant at the **top of the file** (line 5):

```javascript
// VERSION - Update this for new releases
const SWAGGERNAV_VERSION = "1.0.1";  // <-- Change this
```

### Step 2: Update manifest.json
Edit `manifest.json` and update the version field:

```json
{
  "manifest_version": 3,
  "name": "SwaggerNav",
  "version": "1.0.1",  // <-- Change this
  ...
}
```

### Step 3: Rebuild and Test
1. Reload the extension in Chrome (`chrome://extensions/` → click reload)
2. Open a Swagger UI page
3. Verify the version shows correctly in the header

## Version Numbering Convention

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., 1.0.1)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

## Quick Update Command (Optional)

You can search and replace the version across all files:

```bash
# macOS/Linux
grep -rl "1.0.1" . --exclude-dir=.git | xargs sed -i '' 's/1.0.1/1.0.2/g'

# Or manually update:
# - content.js (line 5)
# - manifest.json (version field)
```

## Display Location

The version appears in the extension header:
```
📋 SwaggerNav [v1.0.1] 🌙
```

- Styled with a subtle badge
- Uses `--sn-text-secondary` color
- Auto-updates when `SWAGGERNAV_VERSION` changes

