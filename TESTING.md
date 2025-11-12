# Testing Guide for SwaggerNav

Complete guide to testing the SwaggerNav Chrome extension.

## Quick Test (2 Minutes)

1. **Load extension**: `chrome://extensions/` → Enable Developer Mode → Load unpacked → Select `SwaggerNav` folder
2. **Visit test page**: https://petstore.swagger.io/
3. **Verify**: Navigation sidebar appears on the right with all endpoints listed

✅ If you see the sidebar, it's working!

---

## Detailed Testing Steps

### 1. Installation & Setup

#### Load the Extension

1. Open Chrome and navigate to:
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle the switch in the top-right corner

3. **Load Unpacked Extension**
   - Click "Load unpacked" button
   - Navigate to: `/Users/cigrocean/Projects/SwaggerNav`
   - Select the folder and click "Open"

4. **Verify Installation**
   - Extension should appear in the list
   - Name: "SwaggerNav - Swagger UI Navigator"
   - Version: 1.0.0
   - Status: Enabled
   - No error messages

#### Pin the Extension (Optional)

- Click the puzzle icon in Chrome toolbar
- Find "SwaggerNav - Swagger UI Navigator"
- Click the pin icon to keep it visible

---

### 2. Test Pages

Use these Swagger UI pages for testing:

#### Primary Test Page (Recommended)
**Swagger Petstore** - Official Swagger demo
```
https://petstore.swagger.io/
```
- ✅ Multiple tags (pet, store, user)
- ✅ Various HTTP methods (GET, POST, PUT, DELETE)
- ✅ ~20 endpoints
- ✅ Best for comprehensive testing

#### Secondary Test Pages
**Swagger Editor**
```
https://editor.swagger.io/
```
- View the example API on the right panel

**OpenAPI 3.0 Petstore**
```
https://petstore3.swagger.io/
```
- OpenAPI 3.0 specification example

#### Local Swagger UI (If Available)
If you have a local API with Swagger UI:
```
http://localhost:8080/swagger-ui/
http://localhost:3000/api-docs
```
(Replace with your actual local URLs)

---

### 3. Feature Testing Checklist

#### A. Visual Appearance

Visit https://petstore.swagger.io/ and verify:

- [ ] Navigation sidebar appears on the right side
- [ ] Sidebar has dark background (#1f1f1f)
- [ ] Header shows "📋 API Navigator" title
- [ ] Toggle button (◀) is visible in header
- [ ] Search box is at the top of content area
- [ ] Endpoint counter displays (e.g., "20 endpoints")
- [ ] Sections are organized and labeled
- [ ] Endpoints show method badges with correct colors:
  - GET = Blue (#61affe)
  - POST = Green (#49cc90)
  - PUT = Orange (#fca130)
  - DELETE = Red (#f93e3e)
  - PATCH = Cyan (#50e3c2)

#### B. Navigation Functionality

- [ ] **Click an endpoint** → Page scrolls smoothly to that endpoint
- [ ] **Endpoint highlights** → Brief yellow background animation
- [ ] **Collapsed endpoint expands** → Automatically opens if closed
- [ ] **Multiple clicks** → Each works correctly
- [ ] **Different endpoints** → All respond to clicks

#### C. Search Feature

- [ ] **Type "pet"** in search box
  - Only "pet" related endpoints show
  - Counter updates (e.g., "12 of 20 endpoints")
  - Sections without matches hide
  
- [ ] **Type "get"**
  - All GET methods show
  - Other methods hide
  
- [ ] **Type "/user"**
  - Endpoints with "/user" path show
  
- [ ] **Clear search**
  - All endpoints reappear
  - Counter resets to total

- [ ] **No matches** 
  - Type "xyz123" → No endpoints shown
  - Counter shows "0 of 20 endpoints"

#### D. Collapse/Expand Sections

- [ ] **Click section header** → Section collapses
- [ ] **Arrow icon changes** → ▼ becomes ▶
- [ ] **Click again** → Section expands
- [ ] **Arrow icon changes** → ▶ becomes ▼
- [ ] **Multiple sections** → Each works independently
- [ ] **Content animates** → Smooth expand/collapse animation

#### E. Toggle Sidebar

- [ ] **Click toggle button (◀)** → Sidebar slides to right (mostly hidden)
- [ ] **Button changes** → ◀ becomes ▶
- [ ] **Click again** → Sidebar slides back
- [ ] **Button changes** → ▶ becomes ◀
- [ ] **State persists** → Collapsed state maintains while scrolling

#### F. Responsive Behavior

- [ ] **Resize browser window** → Sidebar adapts appropriately
- [ ] **Small window** → Sidebar remains functional
- [ ] **Scroll page** → Sidebar stays fixed in position
- [ ] **Zoom in/out** → Layout remains usable

#### G. Dynamic Updates

On some Swagger UIs, content loads dynamically:

- [ ] **Refresh page** → Sidebar regenerates correctly
- [ ] **Wait for content** → Sidebar appears after Swagger UI loads
- [ ] **Check console** → No errors appear

---

### 4. Browser Console Testing

#### Open DevTools
- Press **F12** (Windows/Linux)
- Press **Cmd+Option+I** (Mac)
- Or: Right-click page → "Inspect"

#### Check Console Messages

Look for these success messages:
```javascript
SwaggerNav: Found X endpoints in Y tags
SwaggerNav: Navigation bar created
```

#### Check for Errors
- ❌ No red error messages should appear
- ❌ No "Uncaught" exceptions
- ✅ Only SwaggerNav log messages

#### Inspect Elements
1. Right-click the sidebar → "Inspect"
2. Verify element ID: `swagger-nav-sidebar`
3. Check applied styles in DevTools
4. Verify no CSS conflicts

---

### 5. Multi-Tab Testing

#### Test Scenario 1: Multiple Swagger Pages
1. Open https://petstore.swagger.io/ in Tab 1
2. Open https://petstore3.swagger.io/ in Tab 2
3. Verify:
   - [ ] Each tab has its own sidebar
   - [ ] Sidebars work independently
   - [ ] No conflicts between tabs

#### Test Scenario 2: Mixed Pages
1. Open https://petstore.swagger.io/ (Swagger UI)
2. Open https://google.com (Non-Swagger page)
3. Verify:
   - [ ] Sidebar appears only on Swagger page
   - [ ] No sidebar on Google
   - [ ] No errors in console on either page

---

### 6. Edge Cases

#### Test: Page Without Swagger UI
- Visit https://google.com or https://github.com
- [ ] No sidebar should appear
- [ ] No console errors
- [ ] Extension remains inactive

#### Test: Swagger UI with No Endpoints
- Some Swagger UIs may have empty specs
- [ ] Extension should handle gracefully
- [ ] Check console for appropriate message

#### Test: Slow Loading Swagger UI
- Use Chrome DevTools → Network tab → Throttle to "Slow 3G"
- Visit https://petstore.swagger.io/
- [ ] Sidebar eventually appears after content loads
- [ ] No errors during loading

#### Test: Very Large Swagger UI
- If you have access to a Swagger UI with 100+ endpoints:
- [ ] Sidebar remains performant
- [ ] Search works quickly
- [ ] Scrolling is smooth

---

### 7. Performance Testing

#### Check Memory Usage
1. Open Chrome Task Manager: **Shift+Esc** (or Chrome Menu → More Tools → Task Manager)
2. Find "Extension: SwaggerNav"
3. Verify:
   - [ ] Memory usage is reasonable (< 50 MB)
   - [ ] CPU usage is low when idle

#### Check Page Load Impact
1. Open DevTools → Performance tab
2. Record page load with extension enabled
3. Compare with extension disabled
4. Verify:
   - [ ] Minimal impact on page load time
   - [ ] No significant performance degradation

---

### 8. Troubleshooting Tests

#### Problem: Sidebar Doesn't Appear

**Test 1: Verify It's a Swagger UI Page**
- Look for Swagger UI elements on the page
- Check if URL contains `/swagger-ui`, `/api-docs`, or similar
- Solution: Extension only works on actual Swagger UI pages

**Test 2: Check Extension is Loaded**
- Go to `chrome://extensions/`
- Find SwaggerNav
- Verify it's enabled
- Check for error messages
- Solution: Reload extension if needed

**Test 3: Wait for Page Load**
- Some Swagger UIs load slowly
- Wait 3-5 seconds after page loads
- Check console for SwaggerNav messages
- Solution: Be patient with slow-loading pages

**Test 4: Refresh the Page**
- Press F5 or Cmd+R
- Check if sidebar appears after refresh
- Solution: Sometimes a refresh helps

**Test 5: Check Console for Errors**
- Open DevTools (F12)
- Look for error messages
- Solution: Report errors in GitHub issues

#### Problem: Search Doesn't Work

- [ ] Click inside search box
- [ ] Type slowly
- [ ] Check if text appears in input
- [ ] Verify endpoints are hiding/showing
- Solution: If not working, check console for errors

#### Problem: Clicking Endpoints Doesn't Scroll

- [ ] Verify you're clicking on an endpoint (not section header)
- [ ] Check if page actually has the endpoint
- [ ] Try different endpoints
- Solution: Refresh page and try again

#### Problem: Icons Not Showing

- [ ] Check `icons/` folder exists
- [ ] Verify icon files are present: icon16.png, icon48.png, icon128.png
- [ ] Regenerate icons: `python3 create_icons_simple.py`
- Solution: Icons are optional for functionality

---

### 9. Cross-Browser Testing (Optional)

#### Microsoft Edge (Chromium)
- Load extension same way as Chrome
- Should work identically

#### Brave Browser
- Load extension same way as Chrome
- Should work identically

#### Opera (Chromium)
- Load extension same way as Chrome
- Should work identically

**Note**: Firefox uses different extension format (WebExtensions), so this extension won't work on Firefox without modifications.

---

### 10. Automated Testing Checklist

Create a quick checklist for regular testing:

```
✅ Extension loads without errors
✅ Visit petstore.swagger.io - sidebar appears
✅ Click endpoint - scrolls correctly
✅ Search "pet" - filters correctly
✅ Collapse section - works smoothly
✅ Toggle sidebar - slides in/out
✅ No console errors
✅ Icons display correctly
```

---

## Test Results Template

Use this template to document your testing:

```markdown
## SwaggerNav Test Results

**Date**: [DATE]
**Chrome Version**: [VERSION]
**Extension Version**: 1.0.0

### Installation
- [ ] Loads without errors
- [ ] Icons display correctly
- [ ] No warnings in chrome://extensions/

### Functionality
- [ ] Sidebar appears on Swagger UI pages
- [ ] Navigation works (click to scroll)
- [ ] Search filters endpoints
- [ ] Collapse/expand sections
- [ ] Toggle sidebar

### Performance
- [ ] No lag when scrolling
- [ ] Search is responsive
- [ ] Memory usage acceptable

### Issues Found
[List any issues discovered]

### Notes
[Additional observations]
```

---

## Quick Debug Commands

If something isn't working, run these in the browser console (F12):

```javascript
// Check if sidebar exists
document.getElementById('swagger-nav-sidebar')

// Check if Swagger UI exists
document.querySelector('.swagger-ui')

// Check all opblocks (endpoints)
document.querySelectorAll('.opblock').length

// Force reload extension
location.reload()
```

---

## Getting Help

If you encounter issues:

1. **Check console** (F12) for error messages
2. **Try different Swagger UI page** (use petstore.swagger.io)
3. **Reload extension** in chrome://extensions/
4. **Refresh the page** (F5)
5. **Check README.md** for troubleshooting section

---

## Success Criteria

Your extension is working correctly if:

✅ Sidebar appears on https://petstore.swagger.io/  
✅ All 20 endpoints are listed  
✅ Clicking endpoints scrolls to them  
✅ Search filters work  
✅ No console errors  
✅ Sidebar is visually appealing  

**If all above are true: Congratulations! Your extension works! 🎉**

---

## Next Steps After Testing

Once testing is complete:

1. **Use it daily** on your own Swagger APIs
2. **Gather feedback** from colleagues
3. **Report bugs** in GitHub issues
4. **Suggest features** for future versions
5. **Contribute improvements** via pull requests

---

**Happy Testing! 🧪**

