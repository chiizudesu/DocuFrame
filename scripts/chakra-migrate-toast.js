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

const TOAST_IMPORT = `import { showToast } from "@/components/ui/toaster"`;

walk(root, (file) => {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes("useToast") && !s.includes("toast({")) return;

  const orig = s;

  s = s.replace(/\buseToast,\s*/g, "");
  s = s.replace(/,\s*useToast\b/g, "");
  s = s.replace(/\n\s*const\s+toast\s*=\s*useToast\(\);?\s*\n/g, "\n");
  s = s.replace(/\n\s*const\s+toast\s*=\s*useToast\(\)\s*\n/g, "\n");
  s = s.replace(/\btoast\(\{/g, "showToast({");

  if (s === orig) return;

  if (!s.includes("showToast") || s.includes("useToast")) {
    console.warn("skip or partial:", file);
  }

  if (!s.includes(TOAST_IMPORT) && s.includes("showToast")) {
    const lines = s.split("\n");
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) insertAt = i + 1;
      else if (insertAt > 0 && !lines[i].startsWith("import ")) break;
    }
    lines.splice(insertAt, 0, TOAST_IMPORT);
    s = lines.join("\n");
  }

  s = s.replace(/,\s*toast\s*\]/g, "]");
  s = s.replace(/\[\s*toast\s*,/g, "[");

  fs.writeFileSync(file, s);
  console.log("toast:", file);
});
