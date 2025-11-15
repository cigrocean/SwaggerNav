#!/usr/bin/env node

/**
 * Sync Version Script
 * 
 * This script keeps version.js and manifest.json in sync.
 * Run this script after updating the version in version.js:
 * 
 *   node sync-version.js
 * 
 * It will automatically update manifest.json to match version.js
 */

const fs = require('fs');
const path = require('path');

// Read version from version.js
const versionFile = path.join(__dirname, 'version.js');
const versionContent = fs.readFileSync(versionFile, 'utf8');
const versionMatch = versionContent.match(/SWAGGERNAV_VERSION\s*=\s*["'](.+?)["']/);

if (!versionMatch) {
  console.error('❌ Error: Could not find SWAGGERNAV_VERSION in version.js');
  process.exit(1);
}

const version = versionMatch[1];
console.log(`📦 Version found in version.js: ${version}`);

// Read and update manifest.json
const manifestFile = path.join(__dirname, 'manifest.json');
const manifestContent = fs.readFileSync(manifestFile, 'utf8');
const manifest = JSON.parse(manifestContent);

const oldVersion = manifest.version;

if (oldVersion === version) {
  console.log(`✅ Versions already match: ${version}`);
  process.exit(0);
}

manifest.version = version;

// Write back to manifest.json with pretty formatting
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`✅ Updated manifest.json: ${oldVersion} → ${version}`);
console.log('');
console.log('📋 Next steps:');
console.log('  1. Update CHANGELOG in README.md');
console.log('  2. Commit changes: git add version.js manifest.json');
console.log('  3. Create git tag: git tag v' + version);
console.log('  4. Push: git push && git push --tags');

