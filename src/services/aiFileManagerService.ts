import { settingsService } from './settings';
import Anthropic from '@anthropic-ai/sdk';
import { WORKPAPER_DESCRIPTIONS, extractIndexPrefix, setIndexPrefix, removeIndexPrefix, addSuffix, removeSuffix, toProperCase } from '../utils/indexPrefix';
import { joinPath, normalizePath } from '../utils/path';
import type { FileItem } from '../types';

// Structured operations returned by Claude
export type FileOperation =
  | { action: 'copyToIndex'; sourceIndex: string; targetIndex: string }
  | { action: 'addPrefix'; prefix: string; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'addSuffix'; suffix: string; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'removeSuffix'; suffix: string; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'removePrefix'; condition: 'all' | { indexEquals: string } | { selection: true } }
  | { action: 'transformCase'; case: 'upper' | 'lower' | 'title'; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'smartRename'; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } };

// Planned item for preview and execution (file-level)
export interface PlannedItem {
  fileName: string;
  filePath: string;
  operation: 'copy' | 'rename';
  newName: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  error?: string;
  isFolder?: boolean;
}

export interface ExecutionResult {
  successful: number;
  failed: number;
  skipped: number;
}

/** Entry for reverting the last applied operation */
export interface UndoEntry {
  directory: string;
  items: Array<{
    operation: 'rename' | 'copy';
    sourcePath: string;
    destPath: string;
  }>;
}

/**
 * Revert an undo entry (reverse the last applied operation)
 */
export async function revertUndoEntry(entry: UndoEntry): Promise<ExecutionResult> {
  const api = window.electronAPI as any;
  if (!api?.renameItem || !api?.deleteFile || !api?.getFileStats) {
    throw new Error('File operations not available');
  }

  let successful = 0;
  let failed = 0;

  for (const item of entry.items) {
    try {
      if (item.operation === 'rename') {
        await api.renameItem(item.destPath, item.sourcePath);
        successful++;
      } else {
        const stats = await api.getFileStats(item.destPath);
        if (stats?.isFile) {
          await api.deleteFile(item.destPath);
          successful++;
        }
      }
    } catch {
      failed++;
    }
  }

  return { successful, failed, skipped: 0 };
}

export type Condition = 'all' | { indexEquals: string } | { nameContains: string } | { selection: true };

function matchesCondition(file: FileItem, condition: Condition, selectedNames?: Set<string>): boolean {
  if (condition === 'all') return true;
  if (typeof condition === 'object') {
    if ('selection' in condition && condition.selection) {
      return selectedNames ? selectedNames.has(file.name) : false;
    }
    if ('indexEquals' in condition) {
      const prefix = extractIndexPrefix(file.name);
      return prefix === condition.indexEquals;
    }
    if ('nameContains' in condition) {
      return file.name.toLowerCase().includes(condition.nameContains.toLowerCase());
    }
  }
  return false;
}

export function getMatchingItemsForCondition(
  condition: Condition,
  folderItems: FileItem[],
  selectedFileNames?: string[]
): FileItem[] {
  const selectedSet = selectedFileNames?.length ? new Set(selectedFileNames) : undefined;
  return folderItems.filter(f => matchesCondition(f, condition, selectedSet));
}

/**
 * Expand high-level operations into concrete planned items (file-level)
 */
export function expandOperationsToPlannedItems(
  operations: FileOperation[],
  folderItems: FileItem[],
  _currentDirectory: string,
  selectedFileNames?: string[]
): PlannedItem[] {
  const files = folderItems.filter(f => f.type === 'file');
  const allItems = folderItems;
  const selectedSet = selectedFileNames?.length ? new Set(selectedFileNames) : undefined;
  const items: PlannedItem[] = [];

  for (const op of operations) {
    if (op.action === 'copyToIndex') {
      const matching = files.filter(f => extractIndexPrefix(f.name) === op.sourceIndex);
      for (const file of matching) {
        const newName = setIndexPrefix(file.name, op.targetIndex);
        if (newName !== file.name) {
          items.push({
            fileName: file.name,
            filePath: file.path,
            operation: 'copy',
            newName,
            status: 'pending',
            isFolder: file.type === 'folder',
          });
        }
      }
    } else if (op.action === 'addPrefix') {
      const matching = allItems.filter(f => matchesCondition(f, op.condition, selectedSet));
      for (const file of matching) {
        const newName = setIndexPrefix(file.name, op.prefix);
        if (newName !== file.name) {
          items.push({
            fileName: file.name,
            filePath: file.path,
            operation: 'rename',
            newName,
            status: 'pending',
            isFolder: file.type === 'folder',
          });
        }
      }
    } else if (op.action === 'addSuffix') {
      const matching = allItems.filter(f => matchesCondition(f, op.condition, selectedSet));
      for (const file of matching) {
        const newName = addSuffix(file.name, op.suffix);
        if (newName !== file.name) {
          items.push({
            fileName: file.name,
            filePath: file.path,
            operation: 'rename',
            newName,
            status: 'pending',
            isFolder: file.type === 'folder',
          });
        }
      }
    } else if (op.action === 'removeSuffix') {
      const matching = allItems.filter(f => matchesCondition(f, op.condition, selectedSet));
      for (const file of matching) {
        const newName = removeSuffix(file.name, op.suffix);
        if (newName !== file.name) {
          items.push({
            fileName: file.name,
            filePath: file.path,
            operation: 'rename',
            newName,
            status: 'pending',
            isFolder: file.type === 'folder',
          });
        }
      }
    } else if (op.action === 'removePrefix') {
      const matching = allItems.filter(f => matchesCondition(f, op.condition, selectedSet));
      for (const file of matching) {
        const prefix = extractIndexPrefix(file.name);
        if (prefix) {
          const newName = removeIndexPrefix(file.name);
          items.push({
            fileName: file.name,
            filePath: file.path,
            operation: 'rename',
            newName,
            status: 'pending',
            isFolder: file.type === 'folder',
          });
        }
      }
    } else if (op.action === 'transformCase') {
      const matching = allItems.filter(f => matchesCondition(f, op.condition, selectedSet));
      for (const file of matching) {
        let newName: string;
        if (op.case === 'upper') newName = file.name.toUpperCase();
        else if (op.case === 'lower') newName = file.name.toLowerCase();
        else newName = toProperCase(file.name);
        if (newName !== file.name) {
          items.push({
            fileName: file.name,
            filePath: file.path,
            operation: 'rename',
            newName,
            status: 'pending',
            isFolder: file.type === 'folder',
          });
        }
      }
    }
    // smartRename is handled separately - requires AI call for per-file suggestions
  }

  return items;
}

/**
 * Get AI-suggested names for smart rename (e.g. "improve naming of selection")
 */
export async function getSmartRenameSuggestions(
  files: FileItem[],
  userPrompt: string,
  model: 'sonnet' | 'haiku' = 'sonnet'
): Promise<{ fileName: string; newName: string }[]> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set. Add it in Settings.');

  const fileList = files.map(f => f.name).join('\n');

  const systemPrompt = `You are a file naming assistant. The user wants to rename files. Given the user's request and the list of current filenames, suggest a better name for each file.

Rules:
- Keep the same file extension
- For workpaper files with index prefixes (e.g. "G - Summary.pdf"), preserve the index prefix format "{Index} - {Name}.ext" unless the user explicitly asks to change it
- Make names clearer, more professional, consistent
- Return ONLY a JSON array of objects: [{"fileName":"exact current name","newName":"suggested name"}]
- Include every file in the list
- If a name is already good, suggest a minor improvement or keep it the same
- No markdown, no explanation`;

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const modelName = model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';

  const response = await client.messages.create({
    model: modelName,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [{
        type: 'text',
        text: `User request: ${userPrompt}\n\nCurrent filenames:\n${fileList}\n\nReturn JSON array of {fileName, newName} for each file.`,
      }],
    }],
    temperature: 0.3,
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response format from Claude');

  let text = content.text.trim();
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) text = jsonMatch[1].trim();

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    const fileNamesSet = new Set(files.map(f => f.name));
    return parsed.filter(
      (p): p is { fileName: string; newName: string } =>
        p && typeof p.fileName === 'string' && typeof p.newName === 'string' && fileNamesSet.has(p.fileName)
    );
  } catch {
    return [];
  }
}

/**
 * Parse natural language command into structured operations using Claude
 */
export async function parseFileManagerCommand(
  userPrompt: string,
  currentDirectory: string,
  folderItems: FileItem[],
  model: 'sonnet' | 'haiku' = 'sonnet',
  selectedFileNames?: string[]
): Promise<FileOperation[]> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set. Add it in Settings.');

  const fileNames = folderItems.filter(f => f.type === 'file').map(f => f.name);
  const indexDescriptions = Object.entries(WORKPAPER_DESCRIPTIONS)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const selectionNote = selectedFileNames?.length
    ? `\nUser has SELECTED these files (use condition {"selection":true} for "selection" or "selected files"): ${JSON.stringify(selectedFileNames)}`
    : '';

  const systemPrompt = `You are a file manager assistant for a workpaper/document organization system. Files use index prefixes like "Q - Report.pdf" or "H - Summary.xlsx". The format is: {Index} - {Name}.ext

Available index keys and descriptions:
${indexDescriptions}

Valid operations (return ONLY a JSON array, no markdown, no explanation):
1. copyToIndex: Copy files from one index to another (same directory, new file with different prefix)
   {"action":"copyToIndex","sourceIndex":"Q","targetIndex":"H"}
2. addPrefix: Add or replace index prefix on files or folders matching a condition
   - condition "all": all files and folders
   - condition {"indexEquals":"Q"}: only items with Q prefix
   - condition {"nameContains":"invoice"}: items whose name contains "invoice"
   - condition {"selection":true}: only the user's selected files/folders (when user says "selection" or "selected")
   {"action":"addPrefix","prefix":"A1","condition":{"selection":true}}
3. addSuffix: Add suffix to filenames (before extension) matching a condition. E.g. "File.pdf" + " - in process" -> "File - in process.pdf"
   {"action":"addSuffix","suffix":" - in process","condition":{"indexEquals":"G"}}
   {"action":"addSuffix","suffix":" - draft","condition":{"selection":true}}
4. removeSuffix: Remove suffix from filenames (before extension) matching a condition. E.g. "File - in progress.pdf" - " - in progress" -> "File.pdf"
   {"action":"removeSuffix","suffix":" - in progress","condition":{"indexEquals":"G"}}
   {"action":"removeSuffix","suffix":" - draft","condition":{"selection":true}}
5. removePrefix: Remove index prefix from files or folders matching a condition
   {"action":"removePrefix","condition":{"indexEquals":"Q"}}
   {"action":"removePrefix","condition":{"selection":true}}
6. transformCase: Change case of filenames - "upper" (ALL CAPS), "lower" (all lowercase), "title" (Title Case)
   {"action":"transformCase","case":"upper","condition":{"selection":true}}
   {"action":"transformCase","case":"lower","condition":{"indexEquals":"G"}}
   {"action":"transformCase","case":"title","condition":{"selection":true}}
7. smartRename: AI suggests improved/cleaned names for files (e.g. "improve naming", "clean up names", "better names")
   {"action":"smartRename","condition":{"selection":true}}
   {"action":"smartRename","condition":"all"}
${selectionNote}

Current directory: ${currentDirectory}
Files in directory (names only): ${JSON.stringify(fileNames)}

Return a JSON array of operations. Example: [{"action":"copyToIndex","sourceIndex":"Q","targetIndex":"H"}]
If the user's request is ambiguous or cannot be fulfilled, return [].`;

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const modelName = model === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-5';

  const response = await client.messages.create({
    model: modelName,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: [{ type: 'text', text: userPrompt || '' }] }],
    temperature: 0.2,
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response format from Claude');

  let text = content.text.trim();
  // Strip markdown code blocks if present
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) text = jsonMatch[1].trim();

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (op): op is FileOperation =>
        op && typeof op === 'object' && typeof op.action === 'string' &&
        ['copyToIndex', 'addPrefix', 'addSuffix', 'removeSuffix', 'removePrefix', 'transformCase', 'smartRename'].includes(op.action)
    );
  } catch {
    return [];
  }
}

/**
 * Execute planned items with progress callback
 */
export async function executePlannedItems(
  items: PlannedItem[],
  currentDirectory: string,
  onProgress?: (index: number, item: PlannedItem, status: PlannedItem['status'], error?: string) => void
): Promise<ExecutionResult> {
  const api = window.electronAPI as any;
  if (!api?.copyFileSilent || !api?.renameItem || !api?.getFileStats || !api?.deleteFile) {
    throw new Error('File operations not available');
  }

  const baseDir = currentDirectory === '/' ? '' : currentDirectory;
  let successful = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(i, item, 'processing');

    try {
      const sourcePath = normalizePath(item.filePath);
      const parentDir = normalizePath(item.filePath.slice(0, item.filePath.length - item.fileName.length).replace(/[\\/]+$/, ''));
      const dir = normalizePath(parentDir || baseDir);
      const destPath = normalizePath(joinPath(dir, item.newName));

      if (item.operation === 'copy') {
        if (sourcePath === destPath) {
          skipped++;
          onProgress?.(i, { ...item, status: 'done' }, 'done');
          continue;
        }

        let existingFileMoved = false;
        let existingFileTempPath: string | null = null;

        try {
          let targetExists = false;
          if (destPath !== sourcePath) {
            try {
              const stats = await api.getFileStats(destPath);
              targetExists = stats && stats.isFile;
            } catch {
              targetExists = false;
            }
          }

          if (targetExists) {
            existingFileTempPath = joinPath(dir, `~temp_existing_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${item.newName}`);
            try {
              await api.renameItem(destPath, existingFileTempPath);
              existingFileMoved = true;
            } catch {
              existingFileMoved = false;
            }
          }

          const tempFileName = `~temp_copy_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.tmp`;
          const tempFilePath = normalizePath(joinPath(dir, tempFileName));

          const copyResult = await api.copyFileSilent(sourcePath, tempFilePath);
          if (!copyResult?.success) throw new Error(copyResult?.error || 'Copy failed');

          await api.renameItem(tempFilePath, destPath);

          if (existingFileMoved && existingFileTempPath) {
            for (let j = 1; j <= 100; j++) {
              const conflictName = j === 1
                ? item.newName.replace(/(\.[^.]+)$/, ' (1)$1')
                : item.newName.replace(/(\.[^.]+)$/, ` (${j})$1`);
              const conflictPath = joinPath(dir, conflictName);
              try {
                const stats = await api.getFileStats(conflictPath);
                if (!stats?.isFile && !stats?.isDirectory) {
                  await api.renameItem(existingFileTempPath, conflictPath);
                  break;
                }
              } catch {
                await api.renameItem(existingFileTempPath, conflictPath);
                break;
              }
            }
          }

          successful++;
          onProgress?.(i, { ...item, status: 'done' }, 'done');
        } catch (err) {
          if (existingFileMoved && existingFileTempPath) {
            try {
              await api.renameItem(existingFileTempPath, destPath);
            } catch {
              for (let j = 1; j <= 100; j++) {
                const conflictName = j === 1
                  ? item.newName.replace(/(\.[^.]+)$/, ' (1)$1')
                  : item.newName.replace(/(\.[^.]+)$/, ` (${j})$1`);
                try {
                  await api.renameItem(existingFileTempPath, joinPath(dir, conflictName));
                  break;
                } catch {
                  /* continue */
                }
              }
            }
          }
          throw err;
        }
      } else {
        // rename
        if (item.fileName === item.newName) {
          skipped++;
          onProgress?.(i, { ...item, status: 'done' }, 'done');
          continue;
        }

        await api.renameItem(sourcePath, destPath);
        successful++;
        onProgress?.(i, { ...item, status: 'done' }, 'done');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed++;
      onProgress?.(i, { ...item, status: 'failed', error: msg }, 'failed', msg);
    }
  }

  return { successful, failed, skipped };
}
