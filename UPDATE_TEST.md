# Auto-Update Testing Guide for DocuFrame

**Author:** Edward John Matias  
**Contact:** edwardjohncpa@gmail.com

---

## Overview

This guide explains how to test the auto-update feature without inflating version numbers or publishing to production. Use these methods during development to ensure your update mechanism works correctly.

## 1. Local Update Server Method (Recommended)

### Setup

1. **Install HTTP Server**
   ```bash
   npm install -g http-server
   ```

2. **Create Test Directory Structure**
   ```
   test-updates/
   ├── latest.yml
   └── DocuFrame-Setup-1.0.1.exe
   ```

3. **Add Test Scripts to package.json**
   ```json
   "scripts": {
     "test:update-server": "cd test-updates && http-server -p 8080",
     "test:app": "set UPDATE_TEST=true && npm start"
   }
   ```

4. **Modify Main Process** (temporarily for testing)
   ```javascript
   // In your main electron file
   if (process.env.UPDATE_TEST === 'true') {
     autoUpdater.setFeedURL({
       provider: 'generic',
       url: 'http://localhost:8080/'
     });
   }
   ```

### Testing Process

1. **Build Initial Version**
   ```bash
   # Set version to 1.0.0 in package.json
   npm run dist-win
   # Copy installer to test-updates folder
   ```

2. **Build Update Version**
   ```bash
   # Set version to 1.0.1 in package.json
   npm run dist-win
   # Copy new installer to test-updates folder
   ```

3. **Generate latest.yml**
   ```yaml
   version: 1.0.1
   files:
     - url: DocuFrame-Setup-1.0.1.exe
       sha512: [use certUtil -hashfile "DocuFrame-Setup-1.0.1.exe" SHA512]
       size: [file size in bytes]
   path: DocuFrame-Setup-1.0.1.exe
   sha512: [same hash as above]
   releaseDate: '2024-01-15T00:00:00.000Z'
   ```

4. **Run Test**
   ```bash
   # Terminal 1: Start update server
   npm run test:update-server
   
   # Terminal 2: Install and run version 1.0.0
   # Then check for updates - should find 1.0.1
   ```

## 2. Pre-Release Testing (GitHub)

### Setup

1. **Use Pre-release Versions**
   ```json
   // package.json
   "version": "1.0.1-beta.1"
   ```

2. **Enable Pre-releases in Dev**
   ```javascript
   // For testing builds only
   if (isDevelopment) {
     autoUpdater.allowPrerelease = true;
   }
   ```

### Process

1. **Create Pre-release**
   ```bash
   npm version prerelease --preid=beta
   git push --follow-tags
   npm run dist-win
   ```

2. **Upload to GitHub**
   - Create release from tag
   - Mark as "Pre-release"
   - Attach installer

3. **Test Without Affecting Production**
   - Production users won't see beta updates
   - Test users with `allowPrerelease: true` will

## 3. Automated Test Script

Create `scripts/test-update.js`:

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const yaml = require('js-yaml');

function generateTestUpdate(fromVersion, toVersion) {
  const testDir = 'test-updates';
  
  // Ensure test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  
  // Backup current package.json
  const packagePath = 'package.json';
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const originalVersion = packageJson.version;
  
  try {
    // Build "old" version
    console.log(`Building version ${fromVersion}...`);
    packageJson.version = fromVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    execSync('npm run dist-win-safe', { stdio: 'inherit' });
    
    // Copy old version installer
    const oldInstaller = `release/DocuFrame Setup ${fromVersion}.exe`;
    fs.copyFileSync(oldInstaller, path.join(testDir, path.basename(oldInstaller)));
    
    // Build "new" version
    console.log(`Building version ${toVersion}...`);
    packageJson.version = toVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    execSync('npm run dist-win-safe', { stdio: 'inherit' });
    
    // Copy new version installer
    const newInstaller = `release/DocuFrame Setup ${toVersion}.exe`;
    const newInstallerDest = path.join(testDir, path.basename(newInstaller));
    fs.copyFileSync(newInstaller, newInstallerDest);
    
    // Generate latest.yml
    const stats = fs.statSync(newInstallerDest);
    const fileBuffer = fs.readFileSync(newInstallerDest);
    const hash = crypto.createHash('sha512').update(fileBuffer).digest('base64');
    
    const latestYml = {
      version: toVersion,
      files: [{
        url: path.basename(newInstaller),
        sha512: hash,
        size: stats.size
      }],
      path: path.basename(newInstaller),
      sha512: hash,
      releaseDate: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(testDir, 'latest.yml'), 
      yaml.dump(latestYml)
    );
    
    console.log('\n✅ Test setup complete!');
    console.log(`📁 Test files in: ${testDir}/`);
    console.log('\nNext steps:');
    console.log('1. cd test-updates && http-server -p 8080');
    console.log('2. Install the old version from test-updates/');
    console.log('3. Run with: set UPDATE_TEST=true && npm start');
    console.log('4. Check for updates in the app');
    
  } finally {
    // Restore original version
    packageJson.version = originalVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  }
}

// Usage
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log('Usage: node test-update.js <from-version> <to-version>');
  console.log('Example: node test-update.js 1.0.0 1.0.1');
  process.exit(1);
}

generateTestUpdate(args[0], args[1]);
```

Add to package.json:
```json
"scripts": {
  "test:generate-update": "node scripts/test-update.js"
}
```

## 4. Debugging Update Issues

### Enable Detailed Logging

```javascript
// main.js
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'debug';

// Log all update events
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available:', info);
});

autoUpdater.on('error', (err) => {
  log.error('Update error:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  log.info(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info);
});
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Update not detected | Check version number format (must be higher) |
| Download fails | Verify SHA512 hash and file size in latest.yml |
| "Cannot find module" | Ensure latest.yml URL matches actual filename |
| Installation fails | Check Windows Defender / antivirus interference |
| Config lost after update | Ensure config stored in userData, not app directory |

## 5. Testing Checklist

### Pre-Update Tests
- [ ] Current version displays correctly
- [ ] Update check button works
- [ ] Manual check shows correct current version

### Update Detection
- [ ] Update notification appears
- [ ] Version number shown correctly
- [ ] Release notes display (if applicable)
- [ ] Download size shown

### Download Process
- [ ] Progress bar updates smoothly
- [ ] Download can be cancelled
- [ ] Handles network interruption gracefully
- [ ] Resume download works

### Installation
- [ ] Install button appears after download
- [ ] App closes and updater runs
- [ ] New version launches automatically
- [ ] Old version is properly replaced

### Post-Update
- [ ] New version number shows correctly
- [ ] User settings/config preserved
- [ ] No duplicate shortcuts created
- [ ] Previous version fully removed

## 6. Clean Up After Testing

### Reset Script (reset-test.bat)
```batch
@echo off
echo Cleaning test artifacts...
rmdir /s /q test-updates
rmdir /s /q release
rmdir /s /q dist
del /q latest.yml
echo Restoring package.json...
git checkout package.json
echo Done!
```

### Remove Test Code
1. Remove `UPDATE_TEST` environment check from main process
2. Remove `allowPrerelease: true` from production builds
3. Clean up any test-specific configurations

## 7. Best Practices

1. **Version Naming for Tests**
   - Production: 1.0.0, 1.0.1, 1.0.2
   - Testing: 1.0.0-test.1, 1.0.0-test.2
   - Pre-release: 1.0.0-beta.1, 1.0.0-rc.1

2. **Test Environment Isolation**
   - Use different appId for test builds
   - Store test configs separately
   - Never mix test and production update channels

3. **Automated Testing**
   - Set up CI/CD to test updates on each PR
   - Create snapshot tests for update UI
   - Monitor update success rates in production

## Troubleshooting

### Logs Location
- Windows: `%USERPROFILE%\AppData\Roaming\DocuFrame\logs\`
- Look for `main.log` for update-related entries

### Quick Fixes
- **Update not detected**: Clear app cache and restart
- **Stuck download**: Delete partial download from temp directory
- **Installation loop**: Manually install latest version

---

For questions about update testing, contact:
- Edward John Matias
- edwardjohncpa@gmail.com