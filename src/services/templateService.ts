/**
 * Unified template service for loading, parsing, rendering, and validating
 * email templates with {{placeholder}} and {{#if condition}}...{{/if}} syntax.
 */

import { settingsService } from './settings';
import yaml from 'js-yaml';

// --- Types ---

export interface TemplatePlaceholder {
  name: string;
  description?: string;
  format?: 'text' | 'currency' | 'percentage' | 'date' | 'number';
}

export interface TemplateCondition {
  name: string;
  description?: string;
}

export type TemplateBlock =
  | { type: 'text'; content: string }
  | {
      type: 'conditional';
      condition: string;
      ifBlocks: TemplateBlock[];
      elseBlocks: TemplateBlock[];
    };

export interface ParsedTemplate {
  placeholders: TemplatePlaceholder[];
  conditions: TemplateCondition[];
  blocks: TemplateBlock[];
}

export interface ExpenseItem {
  name: string;
  prior: string;
  current: string;
}

export interface ExtractionResult {
  placeholders: Record<string, string>;
  conditions: Record<string, boolean>;
  expense_items?: ExpenseItem[];
}

export interface TemplateData {
  name: string;
  description?: string;
  categories: string[];
  template: string;
  placeholders?: TemplatePlaceholder[];
  conditions?: TemplateCondition[];
  created?: string;
  filename?: string;
}

export interface LoadedTemplate extends TemplateData {
  path: string;
  content: string;
  parsed: any;
  lastModified?: string;
}

export interface ValidationError {
  type: 'unclosed_if' | 'unclosed_else' | 'orphan_else' | 'orphan_endif';
  position?: number;
  message: string;
}

// --- Regex patterns ---

const PLACEHOLDER_REGEX = /\{\{([^#/][^}]*)\}\}/g;
const IF_OPEN_REGEX = /\{\{#if\s+([a-zA-Z0-9_]+)\}\}/g;
const ELSE_REGEX = /\{\{#else\}\}/g;
const IF_CLOSE_REGEX = /\{\{\/if\}\}/g;

// --- Parsing ---

/**
 * Extract placeholder names from template string using {{name}} pattern.
 * Excludes {{#if}}, {{#else}}, {{/if}}.
 */
export function extractPlaceholderNames(templateStr: string): string[] {
  const names = new Set<string>();
  let match;
  const re = /\{\{([^#/][^}]*)\}\}/g;
  while ((match = re.exec(templateStr)) !== null) {
    names.add(match[1].trim());
  }
  return Array.from(names);
}

/**
 * Extract condition names from template string using {{#if condition}} pattern.
 */
export function extractConditionNames(templateStr: string): string[] {
  const names = new Set<string>();
  let match;
  const re = /\{\{#if\s+([a-zA-Z0-9_]+)\}\}/g;
  while ((match = re.exec(templateStr)) !== null) {
    names.add(match[1].trim());
  }
  return Array.from(names);
}

/**
 * Parse template string into a block tree for rendering.
 * Handles {{#if condition}}...{{#else}}...{{/if}} and nested conditionals.
 */
export function parseTemplate(templateStr: string): ParsedTemplate {
  const placeholders = extractPlaceholderNames(templateStr).map((name) => ({
    name,
    description: undefined,
    format: undefined as TemplatePlaceholder['format']
  }));
  const conditions = extractConditionNames(templateStr).map((name) => ({
    name,
    description: undefined
  }));

  const blocks = parseBlocks(templateStr, 0, templateStr.length);
  return { placeholders, conditions, blocks };
}

function parseBlocks(
  str: string,
  start: number,
  end: number
): TemplateBlock[] {
  const blocks: TemplateBlock[] = [];
  let pos = start;

  while (pos < end) {
    const nextIf = str.indexOf('{{#if ', pos);
    if (nextIf === -1 || nextIf >= end) {
      blocks.push({ type: 'text', content: str.slice(pos, end) });
      break;
    }

    if (nextIf > pos) {
      blocks.push({ type: 'text', content: str.slice(pos, nextIf) });
    }

    const condMatch = str.slice(nextIf).match(/^\{\{#if\s+([a-zA-Z0-9_]+)\}\}/);
    if (!condMatch) {
      pos = nextIf + 1;
      continue;
    }

    const condition = condMatch[1];
    const ifStart = nextIf + condMatch[0].length;
    const { elsePos, endPos } = findMatchingElseAndEnd(str, ifStart, end);

    let ifContent: string;
    let elseContent: string;
    if (elsePos === -1) {
      ifContent = str.slice(ifStart, endPos);
      elseContent = '';
    } else {
      ifContent = str.slice(ifStart, elsePos);
      const elseTagLen = '{{#else}}'.length;
      elseContent = str.slice(elsePos + elseTagLen, endPos);
    }

    const ifBlocks = parseBlocks(ifContent, 0, ifContent.length);
    const elseBlocks = elseContent
      ? parseBlocks(elseContent, 0, elseContent.length)
      : [];

    blocks.push({
      type: 'conditional',
      condition,
      ifBlocks,
      elseBlocks
    });

    pos = endPos + '{{/if}}'.length;
  }

  return blocks;
}

function findMatchingElseAndEnd(
  str: string,
  start: number,
  limit: number
): { elsePos: number; endPos: number } {
  let depth = 1;
  let pos = start;
  let elsePos = -1;

  while (pos < limit && depth > 0) {
    const nextIf = str.indexOf('{{#if ', pos);
    const nextElse = str.indexOf('{{#else}}', pos);
    const nextEnd = str.indexOf('{{/if}}', pos);

    if (nextEnd === -1 || nextEnd >= limit) {
      break;
    }

    if (nextElse !== -1 && nextElse < nextEnd && depth === 1 && elsePos === -1) {
      if (nextIf === -1 || nextElse < nextIf) {
        elsePos = nextElse;
      }
    }

    if (nextIf !== -1 && nextIf < nextEnd) {
      if (nextElse === -1 || nextIf < nextElse) {
        depth++;
        pos = nextIf + '{{#if '.length;
        continue;
      }
    }

    if (nextEnd < limit) {
      depth--;
      if (depth === 0) {
        return { elsePos, endPos: nextEnd };
      }
      pos = nextEnd + '{{/if}}'.length;
    }
  }

  return { elsePos, endPos: limit };
}

// --- Rendering ---

/**
 * Render template blocks with placeholder values and condition evaluation.
 */
function renderBlocks(
  blocks: TemplateBlock[],
  placeholders: Record<string, string>,
  conditions: Record<string, boolean>
): string {
  return blocks
    .map((block) => renderBlock(block, placeholders, conditions))
    .join('');
}

function getConditionValue(conditions: Record<string, boolean>, key: string): boolean {
  if (conditions[key] !== undefined) return conditions[key];
  const lower = key.toLowerCase();
  const entry = Object.entries(conditions).find(([pk]) => pk.toLowerCase() === lower);
  return entry ? Boolean(entry[1]) : false;
}

function renderBlock(
  block: TemplateBlock,
  placeholders: Record<string, string>,
  conditions: Record<string, boolean>
): string {
  if (block.type === 'text') {
    return replacePlaceholdersInText(block.content, placeholders);
  }

  const conditionValue = getConditionValue(conditions, block.condition);
  const branch = conditionValue ? block.ifBlocks : block.elseBlocks;
  return renderBlocks(branch, placeholders, conditions);
}

function findPlaceholderValue(placeholders: Record<string, string>, key: string): string | undefined {
  const k = key.trim();
  if (placeholders[k] !== undefined) return placeholders[k];
  const lower = k.toLowerCase();
  const entry = Object.entries(placeholders).find(([pk]) => pk.toLowerCase() === lower);
  return entry?.[1];
}

function replacePlaceholdersInText(
  text: string,
  placeholders: Record<string, string>
): string {
  return text.replace(PLACEHOLDER_REGEX, (_, name) => {
    const key = name.trim();
    const val = findPlaceholderValue(placeholders, key);
    return val !== undefined ? val : `{{${key}}}`;
  });
}

/**
 * Render a template string with the given extraction result.
 * Replaces {{placeholder}} and evaluates {{#if}} blocks.
 */
export function renderTemplate(
  templateStr: string,
  data: ExtractionResult
): string {
  const parsed = parseTemplate(templateStr);
  return renderBlocks(
    parsed.blocks,
    data.placeholders ?? {},
    data.conditions ?? {}
  );
}

/**
 * Render from pre-parsed blocks (avoids re-parsing when template is unchanged).
 */
export function renderParsedTemplate(
  parsed: ParsedTemplate,
  data: ExtractionResult
): string {
  return renderBlocks(
    parsed.blocks,
    data.placeholders ?? {},
    data.conditions ?? {}
  );
}

// --- Validation ---

/**
 * Validate template string for structural errors (unclosed blocks, etc.).
 */
export function validateTemplate(templateStr: string): ValidationError[] {
  const errors: ValidationError[] = [];
  let depth = 0;
  let lastIfPos = -1;
  let lastElsePos = -1;

  const ifRe = /\{\{#if\s+[a-zA-Z0-9_]+\}\}/g;
  const elseRe = /\{\{#else\}\}/g;
  const endRe = /\{\{\/if\}\}/g;

  const positions: { type: 'if' | 'else' | 'end'; pos: number }[] = [];
  let m;
  while ((m = ifRe.exec(templateStr)) !== null) {
    positions.push({ type: 'if', pos: m.index });
  }
  while ((m = elseRe.exec(templateStr)) !== null) {
    positions.push({ type: 'else', pos: m.index });
  }
  while ((m = endRe.exec(templateStr)) !== null) {
    positions.push({ type: 'end', pos: m.index });
  }
  positions.sort((a, b) => a.pos - b.pos);

  let stackDepth = 0;
  for (const p of positions) {
    if (p.type === 'if') {
      stackDepth++;
    } else if (p.type === 'else') {
      if (stackDepth === 0) {
        errors.push({
          type: 'orphan_else',
          position: p.pos,
          message: '{{#else}} without matching {{#if}}'
        });
      }
    } else if (p.type === 'end') {
      stackDepth--;
      if (stackDepth < 0) {
        errors.push({
          type: 'orphan_endif',
          position: p.pos,
          message: '{{/if}} without matching {{#if}}'
        });
        stackDepth = 0;
      }
    }
  }

  if (stackDepth > 0) {
    errors.push({
      type: 'unclosed_if',
      message: `${stackDepth} unclosed {{#if}} block(s)`
    });
  }

  return errors;
}

// --- Loading / Saving ---

/**
 * Load all templates from the configured template folder.
 */
export async function loadTemplates(): Promise<LoadedTemplate[]> {
  const folder = await settingsService.getTemplateFolderPath();
  if (!folder) throw new Error('Template folder path not set.');

  const files = await (window.electronAPI as any).getDirectoryContents(folder);
  const yamlFiles = files.filter(
    (f: any) =>
      f.type === 'file' &&
      (f.name.endsWith('.yaml') || f.name.endsWith('.yml'))
  );

  const templates: LoadedTemplate[] = [];
  for (const file of yamlFiles) {
    const path = file.path || `${folder}/${file.name}`.replace(/\/+/g, '/');
    try {
      const content = await (window.electronAPI as any).readTextFile(path);
      const parsed = yaml.load(content) as any;
      if (parsed && parsed.name && parsed.template) {
        templates.push({
          name: parsed.name,
          description: parsed.description || '',
          categories: parsed.categories || [],
          template: parsed.template,
          placeholders: parsed.placeholders,
          conditions: parsed.conditions,
          created: parsed.created,
          filename: file.name,
          path,
          content,
          parsed,
          lastModified: file.modified
        });
      }
    } catch (err) {
      console.error(`Failed to load template ${path}:`, err);
    }
  }

  return templates;
}

/**
 * Load templates in the format expected by AITemplaterDialog (name, description, categories, template, filename).
 */
export async function loadEmailTemplates(): Promise<
  Array<{ name: string; description: string; categories: string[]; template: string; filename: string }>
> {
  const loaded = await loadTemplates();
  return loaded.map((t) => ({
    name: t.name,
    description: t.description || '',
    categories: t.categories,
    template: t.template,
    filename: t.filename || t.path.split('/').pop() || ''
  }));
}

/**
 * Save a template to the given path.
 */
export async function saveTemplate(
  path: string,
  template: TemplateData
): Promise<void> {
  const yamlContent = yaml.dump(template, {
    indent: 2,
    lineWidth: -1,
    noRefs: true
  });
  await (window.electronAPI as any).writeTextFile(path, yamlContent);
}

/**
 * Delete a template file.
 */
export async function deleteTemplate(path: string): Promise<void> {
  await (window.electronAPI as any).deleteFile(path);
}

// --- Extraction prompt building ---

/**
 * Build the AI prompt for structured data extraction from PDFs.
 */
export function buildExtractionPrompt(
  template: TemplateData,
  extractedPdfData: Record<string, string>
): string {
  const parsed = parseTemplate(template.template);
  const placeholders = template.placeholders ?? parsed.placeholders;
  const schemaConditions = template.conditions ?? [];
  const parsedConditions = parsed.conditions ?? [];
  const conditionNames = new Set(schemaConditions.map((c) => c.name));
  parsedConditions.forEach((c) => conditionNames.add(c.name));
  const conditions = Array.from(conditionNames).map((name) => {
    const fromSchema = schemaConditions.find((s) => s.name === name);
    const fromParsed = parsedConditions.find((p) => p.name === name);
    return { name, description: fromSchema?.description ?? fromParsed?.description };
  });

  const placeholderList = placeholders
    .map((p) => {
      const desc = p.description ? `: ${p.description}` : '';
      const fmt = p.format ? ` (format: ${p.format})` : '';
      return `- ${p.name}${desc}${fmt}`;
    })
    .join('\n');

  const conditionList = conditions
    .map((c) => {
      const desc = c.description ? `: ${c.description}` : '';
      return `- ${c.name}${desc}`;
    })
    .join('\n');

  const pdfSection = Object.entries(extractedPdfData)
    .map(([cat, text]) => `--- ${cat} ---\n${text || ''}`)
    .join('\n');

  return `You are an expert accountant. Extract the following data from the provided PDFs.

PLACEHOLDERS TO EXTRACT:
${placeholderList || '(none - extract any relevant values you find)'}

CONDITIONS TO EVALUATE (true/false based on PDF content):
${conditionList || '(none)'}

CRITICAL - DERIVED VALUES (calculate when PDF shows current vs prior year):
When the PDF shows comparative data (current year and prior year amounts for the same metric), you MUST:
1. Extract BOTH raw values using keys like: revenue_2024, revenue_2025 (or revenue_prior, revenue_current)
2. CALCULATE and fill derived placeholders:
   - X_change_direction or X_direction: "increase" or "decrease" (or "no change" if equal)
   - X_movement or X_change_amount: absolute difference (current - prior), formatted as number
   - X_change_percent or X_movement_percent: percentage change = ((current - prior) / prior) * 100 when prior ≠ 0; else "N/A" or "100" if prior is 0 and current > 0
4. EXPENSE ITEMS (critical): Extract ALL expense/overhead line items from the profit and loss with comparative data. For each line that has both prior year and current year amounts, add an object to expense_items:
   - name: the expense category label (e.g. "Salaries", "Rent", "Professional fees")
   - prior: prior year amount (number as string, no $ or commas)
   - current: current year amount (number as string)
   Include every expense line that has comparative data — do not filter or limit. The program will select the top movements.

Parse numbers from PDF text (ignore commas, $, etc.) before calculating. Round percentages to 1 decimal place. Format dollar amounts with thousand separators (e.g. 12345 as "12,345").

EXTRACTED PDF DATA:
${pdfSection}

Return ONLY a valid JSON object with this exact structure. No markdown, no explanation.
{
  "placeholders": { "placeholder_name": "extracted value", ... },
  "conditions": { "condition_name": true or false, ... },
  "expense_items": [ { "name": "Expense category name", "prior": "12345", "current": "13456" }, ... ]
}`;
}

/** Parse a numeric value from placeholder string (handles $, commas, etc.) */
function parseNum(val: string | undefined): number | null {
  if (val == null || val === '') return null;
  const cleaned = String(val).replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Format a number as X,XXX (thousand separators). Whole numbers: no decimals. */
function formatAmount(val: number | string): string {
  const n = typeof val === 'number' ? val : parseNum(String(val));
  if (n == null) return '';
  const isWhole = Number.isInteger(n);
  const [intPart, decPart] = (isWhole ? n.toString() : n.toFixed(2)).split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart && parseFloat(decPart) !== 0 ? `${formatted}.${decPart}` : formatted;
}

/** Keys that hold dollar amounts (format as X,XXX). Excludes _percent suffixes. */
const AMOUNT_KEY_PATTERN = /^(revenue|overheads|taxable_income|tax_amount|tax_refund|tax_payable|overheads_total|direct_costs)/i;
function isAmountKey(key: string): boolean {
  if (/_percent$|_direction$|_reason$/.test(key)) return false;
  return AMOUNT_KEY_PATTERN.test(key) || /_(amount|movement)$/.test(key);
}

/** Format amount placeholders in place as X,XXX. */
export function formatAmountPlaceholders(placeholders: Record<string, string>): void {
  for (const [key, val] of Object.entries(placeholders)) {
    if (isAmountKey(key) && val) {
      const n = parseNum(val);
      if (n != null) placeholders[key] = formatAmount(n);
    }
  }
}

const TOP_EXPENSES_COUNT = 7;

/** Derive movement/direction/percent from current and prior year values when AI did not calculate them */
export function deriveMovementValues(
  placeholders: Record<string, string>,
  requiredPlaceholders: string[],
  conditions?: Record<string, boolean>,
  expenseItems?: ExpenseItem[]
): { placeholders: Record<string, string>; conditions: Record<string, boolean> } {
  const out = { ...placeholders };
  const outConditions = conditions ? { ...conditions } : {};

  // When expense_items provided: compute all movements, take top N by size, then sort alphabetically
  if (expenseItems && expenseItems.length > 0) {
    const withMovement = expenseItems
      .map((item) => {
        const prior = parseNum(item.prior);
        const current = parseNum(item.current);
        if (prior == null || current == null) return null;
        const diff = current - prior;
        const absDiff = Math.abs(diff);
        const pct =
          prior === 0
            ? (current > 0 ? '100' : '0')
            : ((diff / Math.abs(prior)) * 100).toFixed(1);
        return { name: item.name, prior, current, diff, absDiff, pct };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    const top = withMovement
      .sort((a, b) => b.absDiff - a.absDiff)
      .slice(0, TOP_EXPENSES_COUNT)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    for (let i = 0; i < top.length; i++) {
      const idx = i + 1;
      const t = top[i];
      const amt = formatAmount(t.absDiff);
      out[`expenses_${idx}`] = t.name;
      out[`expenses_${idx}_amount`] = amt;
      out[`expenses_${idx}_percent`] = t.pct;
      out[`expenses_${idx}_movement`] = amt;
      out[`expenses_${idx}_movement_percent`] = t.pct;
      outConditions[`expenses_${idx}_increased`] = t.diff > 0;
    }
    for (let i = top.length + 1; i <= TOP_EXPENSES_COUNT; i++) {
      out[`expenses_${i}`] = '';
      out[`expenses_${i}_amount`] = '';
      out[`expenses_${i}_percent`] = '';
      out[`expenses_${i}_movement`] = '';
      out[`expenses_${i}_movement_percent`] = '';
    }
  }

  const revenuePairs: [string, string, Array<[string, string]>][] = [
    ['revenue_2024', 'revenue_2025', [['revenue_change_direction', 'dir'], ['revenue_change_percent', 'pct']]],
    ['revenue_prior', 'revenue_current', [['revenue_change_direction', 'dir'], ['revenue_change_percent', 'pct']]],
    ['revenue_2024', 'revenue', [['revenue_change_direction', 'dir'], ['revenue_change_percent', 'pct']]],
    ['revenue_prior', 'revenue', [['revenue_change_direction', 'dir'], ['revenue_change_percent', 'pct']]]
  ];
  const overheadPairs: [string, string, Array<[string, string]>][] = [
    ['overheads_2024', 'overheads_2025', [['overheads_direction', 'dir'], ['overheads_movement', 'diff'], ['overheads_movement_percent', 'pct']]],
    ['overheads_prior', 'overheads_current', [['overheads_direction', 'dir'], ['overheads_movement', 'diff'], ['overheads_movement_percent', 'pct']]],
    ['overheads_2024', 'overheads', [['overheads_direction', 'dir'], ['overheads_movement', 'diff'], ['overheads_movement_percent', 'pct']]],
    ['overheads_prior', 'overheads', [['overheads_direction', 'dir'], ['overheads_movement', 'diff'], ['overheads_movement_percent', 'pct']]]
  ];
  const grossPairs: [string, string, Array<[string, string]>][] = [
    ['gross_profit_2024', 'gross_profit_2025', [['gross_profit_direction', 'dir']]],
    ['gross_profit_prior', 'gross_profit_current', [['gross_profit_direction', 'dir']]]
  ];

  for (const [pk, ck, maps] of [...revenuePairs, ...overheadPairs, ...grossPairs]) {
    if (placeholders[pk] || placeholders[ck]) {
      const prior = parseNum(placeholders[pk]);
      const current = parseNum(placeholders[ck]);
      if (prior != null && current != null) {
        const diff = current - prior;
        const dir = diff > 0 ? 'increase' : diff < 0 ? 'decrease' : 'no change';
        const pct = prior === 0 ? (current > 0 ? '100' : '0') : ((diff / Math.abs(prior)) * 100).toFixed(1);
        const absDiff = formatAmount(Math.abs(diff));
        for (const [key, val] of maps) {
          if (requiredPlaceholders.includes(key) && (out[key] == null || out[key] === '')) {
            out[key] = val === 'dir' ? dir : val === 'pct' ? pct : absDiff;
          }
        }
      }
    }
  }

  // Fallback: when no expense_items, use legacy expenses_N_2024/2025 from placeholders
  if (!expenseItems || expenseItems.length === 0) {
    for (let i = 1; i <= 7; i++) {
      const prior = parseNum(placeholders[`expenses_${i}_2024`] ?? placeholders[`expenses_${i}_prior`]);
      const current = parseNum(placeholders[`expenses_${i}_2025`] ?? placeholders[`expenses_${i}_current`]);
      if (prior != null && current != null) {
        const diff = current - prior;
        const pct =
          prior === 0
            ? (current > 0 ? '100' : '0')
            : ((diff / Math.abs(prior)) * 100).toFixed(1);
        const amt = formatAmount(Math.abs(diff));
        if (requiredPlaceholders.includes(`expenses_${i}_amount`) && !out[`expenses_${i}_amount`]) {
          out[`expenses_${i}_amount`] = amt;
        }
        if (requiredPlaceholders.includes(`expenses_${i}_percent`) && !out[`expenses_${i}_percent`]) {
          out[`expenses_${i}_percent`] = pct;
        }
        if (requiredPlaceholders.includes(`expenses_${i}_movement`) && !out[`expenses_${i}_movement`]) {
          out[`expenses_${i}_movement`] = amt;
        }
        if (requiredPlaceholders.includes(`expenses_${i}_movement_percent`) && !out[`expenses_${i}_movement_percent`]) {
          out[`expenses_${i}_movement_percent`] = pct;
        }
        if (outConditions[`expenses_${i}_increased`] === undefined) {
          outConditions[`expenses_${i}_increased`] = diff > 0;
        }
      }
    }
  }

  return { placeholders: out, conditions: outConditions };
}
