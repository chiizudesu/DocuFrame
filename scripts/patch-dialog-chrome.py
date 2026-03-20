from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "src" / "components"
IMPORT_COLOR = 'import { useColorModeValue } from "./ui/color-mode";'
HOOK = "import { useDialogChrome } from './ui/dialog-chrome';"
OLD = (
    "  const bgColor = useColorModeValue('white', 'gray.800');\n"
    "  const borderColor = useColorModeValue('gray.200', 'gray.600');"
)
NEW = "  const { surfaceBg: bgColor, titleBarBg, borderColor, inputBg } = useDialogChrome();"

skip = {"MergePDFDialog.tsx"}

for path in sorted(ROOT.glob("*Dialog*.tsx")):
    if path.name in skip:
        continue
    t = path.read_text(encoding="utf-8")
    if OLD not in t or "useDialogChrome" in t:
        continue
    if HOOK not in t:
        if IMPORT_COLOR not in t:
            continue
        t = t.replace(IMPORT_COLOR, IMPORT_COLOR + "\n" + HOOK)
    t = t.replace(OLD, NEW)
    path.write_text(t, encoding="utf-8")
    print(path.name)
