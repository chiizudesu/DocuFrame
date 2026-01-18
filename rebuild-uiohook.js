// rebuild-uiohook.js
const path = require("path");
const { rebuild } = require("@electron/rebuild");
const { execSync } = require("child_process");

async function main() {
  // Get project root (where this script is located)
  const projectRoot = __dirname;
  process.chdir(projectRoot);

  // Get Electron version from package.json
  const packageJson = require(path.join(projectRoot, "package.json"));
  const electronVersion = packageJson.devDependencies.electron.replace("^", "");

  console.log(`Rebuilding uiohook-napi for Electron ${electronVersion}...`);

  try {
    await rebuild({
      buildPath: projectRoot,
      electronVersion: electronVersion,
      force: true,
      onlyModules: ["uiohook-napi"],
      arch: process.arch,
    });

    console.log("✓ Rebuild complete: uiohook-napi");
  } catch (err) {
    console.error("✗ Rebuild failed:", err.message);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});