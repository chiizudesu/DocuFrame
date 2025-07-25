# Publishing & Release Guide for DocuFrame

**Author:** Edward John Matias  
**Contact:** edwardjohncpa@gmail.com

---

## 1. Versioning & Tagging

- Update `package.json` to the new version (e.g., `1.0.0`).
- Commit the change:
  ```bash
  git add package.json
  git commit -m "Release: Set version to vX.Y.Z"
  ```
- Tag the release:
  ```bash
  git tag -a vX.Y.Z -m "Release vX.Y.Z"
  git push origin vX.Y.Z
  ```

## 2. Build the Installer (Windows/NSIS)

- Run the following command to build the Windows installer:
  ```bash
  npm run dist-win
  ```
- The installer will be found in the `release/` or `dist/` directory (e.g., `DocuFrame Setup X.Y.Z.exe`).

## 3. Publish to GitHub Releases

- Go to your GitHub repository → Releases → Draft a new release.
- Select the tag (e.g., `v1.0.0`).
- Add release notes (features, bugfixes, etc.).
- Attach the installer `.exe` file.
- Publish the release.

## 4. Auto-Updater Configuration

- The app uses `electron-updater` and is configured to check GitHub releases for updates.
- When you publish a new release with an installer, users will be notified and can update automatically.
- No extra configuration is needed if your `package.json` and `build` section are set as follows:
  ```json
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "chiizudesu",
        "repo": "DocuFrame"
      }
    ]
  }
  ```

## 5. Security & Sensitive Data

- Ensure all sensitive files (CSV, config.json, logs, etc.) are in `.gitignore` and not in the repository or release.
- Never commit API keys or secrets.

## 6. Support

For publishing or update issues, contact:
- Edward John Matias
- edwardjohncpa@gmail.com

---

**DocuFrame** is a file explorer for accountants working with Xero, featuring file renaming, drag-and-drop, and auto-update support. 