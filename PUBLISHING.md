# Publishing & Release Guide for DocuFrame

**Author:** Edward John Matias  
**Contact:** edwardjohncpa@gmail.com

---

## Prerequisites

- GitHub personal access token with `repo` scope (set as `GH_TOKEN` environment variable)
- Node.js and npm installed
- Git configured with push access to repository
- Windows machine for building Windows installers

## 1. Pre-Release Testing

**IMPORTANT**: Before publishing any release, thoroughly test the update mechanism following the [UPDATE-TESTING.md](./UPDATE-TESTING.md) guide to avoid version inflation.

## 2. Versioning & Release Process

### Version Types
- **Patch**: Bug fixes (1.0.0 → 1.0.1)
- **Minor**: New features (1.0.0 → 1.1.0)
- **Major**: Breaking changes (1.0.0 → 2.0.0)

### Automated Version Update
```bash
# Choose one:
npm run version:patch
npm run version:minor
npm run version:major
```

This will:
1. Update version in package.json
2. Create git commit
3. Create version tag
4. Push to repository with tags

### Manual Version Update
```bash
# Update package.json version
npm version patch  # or minor/major

# Push with tags
git push origin main --follow-tags
```

## 3. Build Process

### Production Build (Signed)
```bash
# Ensure signing certificate is available
npm run dist-win
```

### Production Build (Unsigned)
```bash
# For open-source/development releases
npm run dist-win-unsigned
```

### Output Location
The installer will be generated in the `release/` directory:
- `DocuFrame Setup X.Y.Z.exe`

## 4. Publishing to GitHub

### Automated Publishing
```bash
# Set GitHub token
set GH_TOKEN=your_github_token_here

# Build and publish in one command
npm run publish-github
```

### Manual Publishing
1. Build the installer:
   ```bash
   npm run dist-win-unsigned
   ```

2. Create GitHub Release:
   - Go to: https://github.com/chiizudesu/DocuFrame/releases
   - Click "Draft a new release"
   - Select the tag (e.g., `v1.0.1`)
   - Set release title: `DocuFrame v1.0.1`
   - Add release notes (see template below)
   - Attach the `.exe` file from `release/` directory
   - **For testing**: Check "This is a pre-release"
   - **For production**: Leave unchecked
   - Click "Publish release"

## 5. Release Notes Template

```markdown
## DocuFrame vX.Y.Z

### ✨ New Features
- Feature 1 description
- Feature 2 description

### 🐛 Bug Fixes
- Fixed issue with...
- Resolved problem where...

### 🔧 Improvements
- Enhanced performance of...
- Improved UI for...

### 📝 Notes
- Any important notes for users
- Migration instructions if applicable

### 📥 Installation
- Download the installer below
- Run `DocuFrame Setup X.Y.Z.exe`
- Follow installation prompts
```

## 6. Auto-Update Configuration

The app is configured to:
- Check for updates automatically on startup
- Allow users to manually check via the update dialog
- Download updates in the background
- Install updates when the app is closed

Configuration in `package.json`:
```json
"publish": [
  {
    "provider": "github",
    "owner": "chiizudesu",
    "repo": "DocuFrame"
  }
]
```

## 7. Post-Release Checklist

- [ ] Verify release appears on GitHub
- [ ] Test auto-update from previous version
- [ ] Update documentation if needed
- [ ] Monitor issues for update problems
- [ ] Tag release as "Latest" on GitHub

## 8. Rollback Procedure

If issues are discovered:

1. **Delete the problematic release** from GitHub
2. **Fix the issue** in code
3. **Create new release** with same or incremented version
4. **Communicate** with users about the issue

## 9. Security Considerations

### Code Signing (Optional but Recommended)
- Obtain code signing certificate
- Set certificate in environment variables
- Remove `CSC_IDENTITY_AUTO_DISCOVERY=false` from build commands

### Sensitive Data
- Never commit `config.json` (use `config.sample.json`)
- Keep API keys in environment variables
- Ensure `.gitignore` includes all sensitive files

## 10. CI/CD with GitHub Actions (Recommended)

Create `.github/workflows/release.yml`:
```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: windows-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run dist-win-unsigned
      
      - name: Release
        uses: softprops/action-gh-release@v1
        with:
          files: release/*.exe
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 11. Version Management Scripts

Add these to `package.json` for easier version management:
```json
"scripts": {
  "version:patch": "npm version patch && git push origin main --follow-tags",
  "version:minor": "npm version minor && git push origin main --follow-tags",
  "version:major": "npm version major && git push origin main --follow-tags",
  "release:test": "npm run dist-win-unsigned && echo 'Upload to GitHub as pre-release'",
  "release:prod": "npm run dist-win && echo 'Upload to GitHub as release'"
}
```

## 12. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Build fails | Check Node.js version, run `npm ci` |
| Publish fails | Verify GH_TOKEN is set correctly |
| Update not detected | Ensure version is higher than current |
| Signing error | Use `dist-win-unsigned` for unsigned builds |

### Support

For publishing issues or questions:
- Check update logs in `%APPDATA%\DocuFrame\logs\`
- Contact: Edward John Matias (edwardjohncpa@gmail.com)

---

**Remember**: Always test updates locally before publishing. See [UPDATE-TESTING.md](./UPDATE-TESTING.md) for comprehensive testing procedures.