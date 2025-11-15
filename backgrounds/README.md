# SwaggerNav Background Images

Place your custom background images in this folder.

## Required Files

You need **8 images** (4 themes × 2 variants each):

### Ocean Theme
- `ocean_light.png` (or `.jpg`) - Light version
- `ocean_dark.png` (or `.jpg`) - Dark version

### Tet Holiday Theme
- `tet_light.png` (or `.jpg`) - Light version
- `tet_dark.png` (or `.jpg`) - Dark version

### Christmas Theme
- `christmas_light.png` (or `.jpg`) - Light version
- `christmas_dark.png` (or `.jpg`) - Dark version

### Too Many Bugs Theme
- `too_many_bugs_light.png` (or `.jpg`) - Light version
- `too_many_bugs_dark.png` (or `.jpg`) - Dark version

## Important Notes

1. **File names must match exactly** (including underscores and case)
2. Use either `.png` or `.jpg` extension (PNG recommended)
3. Light versions are for light theme
4. Dark versions are for dark theme
5. Images will automatically cover the sidebar (`background-size: cover`)

## Recommended Specifications

- **Size**: 400px × 1200px or higher (vertical/tall aspect ratio)
- **Format**: PNG (best quality) or JPG (smaller file size)
- **Design**: 
  - Light versions: Brighter colors, softer tones
  - Dark versions: Deeper colors, richer contrast
  - Ensure text remains readable over the background

## After Adding Images

1. Reload the extension in `chrome://extensions`
2. Open SwaggerNav on any Swagger UI page
3. Go to Settings → More Settings
4. Select different backgrounds to test
5. The preview thumbnails in the options page will also show your images!

## How It Works

- **Sidebar**: Uses the image corresponding to the current theme setting
  - Light Theme → Shows `*_light.png`
  - Dark Theme → Shows `*_dark.png`
  - Follow OS → Shows light or dark based on OS theme

- **Preview Thumbnails**: Shows light version in light mode, dark version in dark mode
  - Also respects forced theme settings from the Theme selector

