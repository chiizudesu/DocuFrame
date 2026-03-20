# Chakra UI v3 migration (DocuFrame)

Use this doc alongside the scoped Cursor rule `.cursor/rules/chakra-ui-v3.mdc` when migrating from Chakra v2.

## Official references

- [Migration guide](https://chakra-ui.com/docs/get-started/migration) — human-readable steps
- [LLMs.txt index](https://www.chakra-ui.com/llms.txt) — links to generated docs bundles (including v3 migration text) for assistants

---

## Build audit (post-codemod)

**Command:** `npm run build` (`tsc --noEmit && vite build`)

**Result:** **Fails at TypeScript check.** (On the order of **~600+** diagnostics in the first full run; exact count drops as fixes land.)

**Already fixed in repo:** `tsconfig.json` includes `baseUrl` + `paths` so `@/*` → `src/*`, matching `vite.config.ts`. Without this, every `@/components/ui/...` import fails typecheck even though Vite resolves them at runtime.

### Error themes (what the codemod did not finish)

| Theme | What to do |
|--------|------------|
| **App root / theme** | `App.tsx` still imports `theme` from `./theme`; v3 file exports `system` via `createSystem`. Wrap the app with the snippet `Provider` from `src/components/ui/provider.tsx` (and mount `Toaster`) per Chakra v3 install docs—not raw `ChakraProvider` without `value`, and not the old `theme` object. |
| **`calculator-app.tsx`** | `ChakraProvider` requires `value` (e.g. `defaultSystem` or your custom `system`). Align with main app. |
| **`src/theme.ts`** | Custom `Tooltip` / `Menu` / `Popover` overrides use v2-shaped `baseStyle` APIs. Re-express with v3 `createSystem` / token recipes (see theming docs) so light/dark menu and tooltip colors match the original design intent. |
| **`Steps` imports** | Widespread unused `Steps` imports—codemod artifact; remove per file (or one scripted pass). |
| **`Input` / `Textarea`** | v3 uses standard DOM patterns: `value` + `onChange` (not `onValueChange`). Replace across the codebase. |
| **`Button` / `IconButton` `loading`** | v3 uses `_loading` (and composition with `Spinner` where needed), not `loading` / `loadingText`. |
| **`NativeSelect`** | Put `size` on `NativeSelect.Root`; wire `value` / `onChange` on `NativeSelect.Field` per v3 docs (not `onValueChange` on the field as a Zag-style API). |
| **`Checkbox` `indeterminate`** | Use `_indeterminate` where the type suggests it. |
| **`Checkbox` `onCheckedChange`** | Handler receives `CheckedChangeDetails`—use `details.checked`, not `event.target`. |
| **`useToast`** | Replace with `toaster` from `@/components/ui/toaster` and `toaster.create({ ... })` (`type`, `placement`, `meta.closable`, etc.). |
| **`Divider`** | Use `Separator` from `@chakra-ui/react`. |
| **`InputGroup` / `InputRightElement`** | No longer exported; rebuild with `Group` / layout (`HStack`, `Flex`) + `Input` + adornment `Box` (see v3 Input / Field examples). |
| **`Wrap` / `WrapItem` / `Slide` / `Presence`** | Not in v3 package the same way—replace with `Flex`/`Grid` + CSS, or v3 `Collapsible` / motion patterns from docs. |
| **Tables** | Old `Tr`/`Td`/`Th` imports fail; file grid code must use `Table.Root` / `Table.Row` / `Table.Cell` / `Table.ColumnHeader` consistently (including `DraggableFileItem` and any `as={Tr}` patterns). |
| **Input `variant="unstyled"`** | v3 `Input` variants are stricter; use an allowed variant or raw styles via `css` / props. |
| **`fontSize={number}`** | Chakra expects token strings (e.g. `"sm"`)—replace numeric literals where TS complains. |
| **`@chakra-ui/icons`** | Still in `package.json`; swap usages to `lucide-react` / `react-icons` / `@heroicons/react` already in the project, then remove the dependency. |
| **Non-Chakra TS errors** | e.g. `readImageAsDataUrl` on `electronAPI`, `setState` callback typing in `FileGrid.tsx`—fix alongside UI work or in a small dedicated pass so `tsc` can go green. |

---

## Project checklist (baseline)

1. Follow Chakra’s installation / CLI snippet flow for v3 so `src/components/ui` exists (Provider, Toaster, Tooltip, etc.).
2. Remove v2-only packages: `@chakra-ui/icons`, `@emotion/styled`, `framer-motion`, `@chakra-ui/hooks`, `@chakra-ui/next-js` (replace Next patterns with `asChild` where relevant).
3. Add icon and hook replacements: `lucide-react` or `react-icons`; `react-use` or `usehooks-ts`.
4. Migrate screens incrementally using the v2 → v3 patterns in the Cursor rule (Toast, Dialog, composition components, etc.).

## Import split (summary)

| Source | Examples |
|--------|----------|
| `@chakra-ui/react` | `Alert`, `Avatar`, `Button`, `Card`, `Field`, `Table`, `Input`, `NativeSelect`, `Tabs`, `Textarea`, `Separator`, `useDisclosure`, layout primitives, `Text`, `Heading`, `Icon` |
| `components/ui` (relative or `@/components/ui`) | `Provider`, `Toaster`, `ColorModeProvider`, `Tooltip`, `PasswordInput` |

---

## Full migration plan (methodical, design parity)

Work in **phases** so the app stays runnable (`build-safe` / `build-no-check` only if needed for short-lived checkpoints). After each phase, run `npm run build` and fix regressions before continuing.

### Phase 0 — Foundation (single PR)

- [x] Align TypeScript with Vite: `paths` for `@/*` (done).
- [ ] **Single root:** Use `Provider` from `src/components/ui/provider.tsx` in `App.tsx` (and calculator entry). Pass your customized **`system`** from `theme.ts` into `ChakraProvider` once `theme.ts` is updated for v3 (replace `defaultSystem` in the snippet provider if you customize tokens).
- [ ] Mount **`Toaster`** from `@/components/ui/toaster` next to the root so `toaster.create` works app-wide.
- [ ] Remove dead imports (`Steps`) in touched files.

**Parity note:** Screenshot or list key screens (file grid, settings, AI dialogs) before changing global provider/theme so you can compare spacing, borders, and dark mode after Phase 0.

### Phase 1 — Mechanical API sweep (high volume, low risk)

Apply the same pattern file-by-file or with careful search-replace:

- `onValueChange` → `onChange` on `Input` / `Textarea` (read `e.target.value`).
- `loading` / `loadingText` → `_loading` + optional spinner children where the UX needs explicit text.
- `Divider` → `Separator`.
- `useToast` → `toaster` + `toaster.create`.
- Checkbox handlers: `onCheckedChange={(d) => ... d.checked}` (no `.target`).
- `indeterminate` → `_indeterminate` on checkbox root where used.

**Verify:** Dialogs and forms still submit, focus rings and disabled states unchanged visually.

### Phase 2 — Selects and fields

- Refactor every **`NativeSelect`** to v3 structure: `NativeSelect.Root` + `NativeSelect.Field` + `NativeSelect.Indicator`; size on **Root**.
- Wrap invalid inputs with **`Field.Root`** / **`Field.ErrorText`** instead of `isInvalid` on `Input` alone.

**Parity note:** Dropdown width, placeholder color, and disabled styling should match v2; tweak `colorPalette` / props on `Root` if needed.

### Phase 3 — Layout primitives removed from v2

- **`ClientSearchOverlay` / `CommandLine`:** Rebuild search bars without `InputGroup` / `InputRightElement` using `Group` or `HStack` + relative positioning for icons.
- **`DocumentAnalysisDialog`:** Replace `Wrap`/`Slide`/`Presence` with supported v3 patterns (flex/grid + `Collapsible` or CSS transitions) while preserving density and animation *feel* (duration/easing via `css` or tokens).

### Phase 4 — Data display: tables

- **`FileGrid` stack and `DraggableFileItem`:** Full **`Table.Root`** composition; remove `as={Tr}`-style props if incompatible—use `Table.Row` with appropriate `as` only if supported, or restructure DOM.
- Re-test drag-and-drop, selection highlight, column resize—these are easy to break when table markup changes.

**Parity note:** Row height, header background, and grid/list toggle must match the old design; use the same token names (`gray.50`, borders) where they still exist in your system.

### Phase 5 — Theme and color mode

- Rewrite **`src/theme.ts`** customizations for v3’s system API so tooltip/menu/popover surfaces keep **light backgrounds in light mode** and dark variants in dark mode (current comments document that intent).
- **v2 dark parity:** Shell and file list use semantic colors **`df.*`** (see **`src/docuFrameColors.ts`**) — classic Chakra-style **gray.7–9** stack (aligned with pre-v3 `FolderTabSystem` / `FolderInfoBar` / `FileGrid` hooks), **`df.border`** chrome lines, **`df.tabStrip`** vs **`df.toolbar`**. Layout/App use `bg="df.canvas"` etc.; FileGrid uses the palette for fills and hovers.
- Confirm **`ThemeToggle`** and Electron `theme-changed` IPC still sync with `ColorModeProvider`.

### Phase 6 — Dependencies and cleanup

- Remove **`@chakra-ui/icons`**, **`@emotion/styled`**, **`framer-motion`** if nothing legitimate still requires them (v3 + snippets may still use `@emotion/react`—follow Chakra’s install output).
- Run **`eslint`**, fix unused locals introduced during migration (`noUnusedLocals` is strict).
- Optional: `npx chakra typegen` if you customize the theme and want token autocomplete.

### Ongoing — Quality bar for “beautiful” parity

- After each major screen: compare **light/dark**, **focus**, **dense vs comfortable** spacing, and **error/loading** states against a saved reference.
- Prefer **composition** (`Dialog.Root`, `Menu.Root`, `Tabs.Root`) over partial v2 patterns.
- Keep using **`.cursor/rules/chakra-ui-v3.mdc`** and `@docs/c3-migration.md` in Cursor when asking for migrations so answers stay v3-correct.
