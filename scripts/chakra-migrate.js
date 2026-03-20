/**
 * One-off bulk edits for Chakra v3 migration. Safe to delete after migration.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "src");

function walk(dir, cb) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, cb);
    else if (/\.tsx?$/.test(name.name)) cb(p);
  }
}

walk(root, (file) => {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;

  s = s.replace(/\bSteps,\s*/g, "");
  s = s.replace(/,\s*Steps\b/g, "");
  s = s.replace(/\bloading=/g, "_loading=");
  s = s.replace(/\s+loadingText="[^"]*"/g, "");
  s = s.replace(/\s+loadingText=\{"[^"]*"\}/g, "");

  s = s.replace(/onValueChange=/g, "onChange=");
  // Slider.Root uses onValueChange with numeric value, not DOM change events
  s = s.replace(/(<Slider\.Root[\s\S]*?<\/Slider\.Root>)/g, (block) =>
    block.replace(/onChange=\{\(v\)/g, "onValueChange={(v)")
  );

  if (s !== orig) fs.writeFileSync(file, s);
});

console.log("chakra-migrate: Steps, _loading, loadingText, onValueChange done");
