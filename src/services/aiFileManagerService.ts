import { settingsService } from './settings';
import Anthropic from '@anthropic-ai/sdk';
import { WORKPAPER_DESCRIPTIONS, extractIndexPrefix, setIndexPrefix, removeIndexPrefix, addSuffix, removeSuffix, toProperCase } from '../utils/indexPrefix';
import { joinPath, normalizePath, getParentPath } from '../utils/path';
import type { FileItem } from '../types';

// Structured operations returned by Claude
export type FileOperation =
  | { action: 'copyToIndex'; sourceIndex: string; targetIndex: string }
  | { action: 'addPrefix'; prefix: string; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'addSuffix'; suffix: string; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'removeSuffix'; suffix: string; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'removePrefix'; condition: 'all' | { indexEquals: string } | { selection: true } }
  | { action: 'transformCase'; case: 'upper' | 'lower' | 'title'; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'smartRename'; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'contentBasedRename'; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'moveToFolder'; targetFolder: string; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'delete'; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'mergePdfs'; outputFilename: string; retainOriginals?: boolean; targetFolder?: string; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } }
  | { action: 'extract'; sourceFolder: string; condition: 'all' | { indexEquals: string } | { nameContains: string }; deleteSource?: boolean; asCopies?: boolean }
  | { action: 'createCopies'; count: number; names?: string[]; nameFrom?: string; nameTo?: string; targetFolder?: string; condition: 'all' | { indexEquals: string } | { nameContains: string } | { selection: true } };

// Planned item for preview and execution (file-level)
export interface PlannedItem {
  fileName: string;
  filePath: string;
  operation: 'copy' | 'rename' | 'move' | 'delete' | 'merge';
  newName: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  error?: string;
  isFolder?: boolean;
  /** For move: full path of destination */
  targetPath?: string;
  /** For delete: path in .docuframe-trash */
  trashPath?: string;
  /** For merge: source file paths, output path, whether to keep originals */
  sourcePaths?: string[];
  outputPath?: string;
  retainOriginals?: boolean;
  /** For extract: source folder name for display */
  extractFrom?: string;
}

export interface ExecutionResult {
  successful: number;
  failed: number;
  skipped: number;
}

export interface ExecutionWithUndo {
  result: ExecutionResult;
  undoEntry: UndoEntry | null;
}

/** Entry for reverting the last applied operation */
export interface UndoEntry {
  directory: string;
  items: Array<
    | { operation: 'rename' | 'copy'; sourcePath: string; destPath: string }
    | { operation: 'move'; fromPath: string; toPath: string }
    | { operation: 'delete'; originalPath: string; trashPath: string }
    | { operation: 'merge'; mergedPath: string; originalPaths: string[]; trashPaths?: string[]; originalsWereDeleted: boolean }
  >;
}

/**
 * Revert an undo entry (reverse the last applied operation)
 */
export async function revertUndoEntry(entry: UndoEntry): Promise<ExecutionResult> {
  const api = window.electronAPI as any;
  if (!api?.renameItem || !api?.deleteFile || !api?.getFileStats || !api?.moveFilesSilent) {
    throw new Error('File operations not available');
  }

  let successful = 0;
  let failed = 0;

  for (const item of [...entry.items].reverse()) {
    try {
      if (item.operation === 'rename') {
        await api.renameItem(item.destPath, item.sourcePath);
        successful++;
      } else if (item.operation === 'copy') {
        const stats = await api.getFileStats(item.destPath);
        if (stats?.isFile) {
          await api.deleteFile(item.destPath);
          successful++;
        }
      } else if (item.operation === 'move') {
        const parentDir = getParentPath(item.fromPath) || '.';
        const results = await api.moveFilesSilent([item.toPath], parentDir);
        if (results?.some((r: { status: string }) => r.status === 'success')) successful++;
        else failed++;
      } else if (item.operation === 'delete') {
        const parentDir = getParentPath(item.originalPath) || '.';
        const results = await api.moveFilesSilent([item.trashPath], parentDir);
        if (results?.some((r: { status: string }) => r.status === 'success')) successful++;
        else failed++;
      } else if (item.operation === 'merge') {
        try {
          await api.deleteFile(item.mergedPath);
          successful++;
        } catch {
          failed++;
        }
        if (item.originalsWereDeleted && item.trashPaths && item.trashPaths.length > 0 && item.originalPaths.length > 0) {
          const parentDir = getParentPath(item.originalPaths[0]) || '.';
          const results = await api.moveFilesSilent(item.trashPaths, parentDir);
          for (const r of results || []) {
            if (r.status === 'success') successful++;
            else failed++;
          }
        }
      }
    } catch {
      failed++;
    }
  }

  return { successful, failed, skipped: 0 };
}

export type Condition =
  | 'all'
  | { indexEquals: string }
  | { nameContains: string }
  | { nameEquals: string }
  | { folderNameEquals: string }
  | { selection: true };

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
    if ('nameEquals' in condition) {
      return file.name.toLowerCase() === condition.nameEquals.toLowerCase();
    }
    if ('folderNameEquals' in condition) {
      return file.type === 'folder' && file.name.toLowerCase() === condition.folderNameEquals.toLowerCase();
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
  currentDirectory: string,
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
    } else if (op.action === 'moveToFolder') {
      const matching = files.filter(f => matchesCondition(f, op.condition, selectedSet));
      const targetFolder = op.targetFolder.replace(/^[\\/]+|[\\/]+$/g, '');
      const targetDir = normalizePath(joinPath(currentDirectory, targetFolder));
      for (const file of matching) {
        const targetPath = normalizePath(joinPath(targetDir, file.name));
        items.push({
          fileName: file.name,
          filePath: file.path,
          operation: 'move',
          newName: targetFolder + (targetFolder ? '/' : '') + file.name,
          targetPath,
          status: 'pending',
          isFolder: false,
        });
      }
    } else if (op.action === 'delete') {
      const matching = allItems.filter(f => matchesCondition(f, op.condition, selectedSet));
      const timestamp = Date.now().toString();
      const trashBase = normalizePath(joinPath(currentDirectory, '.docuframe-trash', timestamp));
      for (const file of matching) {
        const trashPath = normalizePath(joinPath(trashBase, file.name));
        items.push({
          fileName: file.name,
          filePath: file.path,
          operation: 'delete',
          newName: '',
          trashPath,
          status: 'pending',
          isFolder: file.type === 'folder',
        });
      }
    } else if (op.action === 'mergePdfs') {
      const matching = files
        .filter(f => matchesCondition(f, op.condition, selectedSet) && f.name.toLowerCase().endsWith('.pdf'))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (matching.length >= 2) {
        const outputFilename = op.outputFilename.endsWith('.pdf') ? op.outputFilename : op.outputFilename + '.pdf';
        const targetDir = op.targetFolder
          ? normalizePath(joinPath(currentDirectory, op.targetFolder.replace(/^[\\/]+|[\\/]+$/g, '')))
          : currentDirectory;
        const outputPath = normalizePath(joinPath(targetDir, outputFilename));
        const newNameDisplay = op.targetFolder ? op.targetFolder + '/' + outputFilename : outputFilename;
        items.push({
          fileName: outputFilename,
          filePath: '',
          operation: 'merge',
          newName: newNameDisplay,
          sourcePaths: matching.map(f => f.path),
          outputPath,
          retainOriginals: op.retainOriginals ?? false,
          status: 'pending',
          isFolder: false,
        });
      }
    } else if (op.action === 'createCopies') {
      const matching = files.filter(f => matchesCondition(f, op.condition, selectedSet));
      let copyNames: string[];
      if (op.names && Array.isArray(op.names) && op.names.length > 0) {
        copyNames = op.names.slice(0, op.count ?? op.names.length);
      } else if (op.nameFrom != null && op.nameTo != null) {
        const fromMatch = op.nameFrom.match(/^(\d+)(.*)$/);
        const toMatch = op.nameTo.match(/^(\d+)(.*)$/);
        if (!fromMatch || !toMatch) continue;
        const startNum = parseInt(fromMatch[1], 10);
        const suffix = toMatch[2] ?? '';
        const count = op.count ?? Math.max(0, parseInt(toMatch[1], 10) - startNum + 1);
        copyNames = Array.from({ length: count }, (_, i) => `${startNum + i}${suffix}`);
      } else {
        continue;
      }
      if (copyNames.length === 0) continue;
      const copyTargetDir = op.targetFolder
        ? normalizePath(joinPath(currentDirectory, op.targetFolder.replace(/^[\\/]+|[\\/]+$/g, '')))
        : currentDirectory;
      for (const file of matching) {
        const lastDot = file.name.lastIndexOf('.');
        const ext = lastDot > 0 ? file.name.slice(lastDot) : '';
        for (const baseName of copyNames) {
          const newName = baseName + ext;
          const targetPath = normalizePath(joinPath(copyTargetDir, newName));
          const newNameDisplay = op.targetFolder ? op.targetFolder + '/' + newName : newName;
          items.push({
            fileName: file.name,
            filePath: file.path,
            operation: 'copy',
            newName: newNameDisplay,
            targetPath,
            status: 'pending',
            isFolder: false,
          });
        }
      }
    }
    // smartRename is handled separately - requires AI call for per-file suggestions
  }

  return items;
}

/**
 * Expand extract operations (async - fetches folder contents)
 */
export async function expandExtractOperations(
  operations: Array<{ action: 'extract'; sourceFolder: string; condition: 'all' | { indexEquals: string } | { nameContains: string }; deleteSource?: boolean; asCopies?: boolean }>,
  currentDirectory: string,
  folderItems: FileItem[],
  selectedFileNames?: string[]
): Promise<PlannedItem[]> {
  const api = window.electronAPI as any;
  if (!api?.getDirectoryContents) {
    throw new Error('getDirectoryContents not available');
  }

  const items: PlannedItem[] = [];

  for (const op of operations) {
    const folderName = op.sourceFolder.replace(/^[\\/]+|[\\/]+$/g, '');
    const folder = folderItems.find(f => f.type === 'folder' && f.name === folderName);
    const sourceFolderPath = folder ? folder.path : normalizePath(joinPath(currentDirectory, folderName));
    const sourceFolderName = folderName;

    const contents = await api.getDirectoryContents(sourceFolderPath);
    if (!Array.isArray(contents)) continue;

    const allFiles = contents.filter((f: FileItem) => f.type !== 'folder');
    const condition = op.condition;
    const matchesCondition = (f: FileItem) => {
      if (condition === 'all') return true;
      if (typeof condition === 'object') {
        if ('indexEquals' in condition) {
          return extractIndexPrefix(f.name) === condition.indexEquals;
        }
        if ('nameContains' in condition) {
          return f.name.toLowerCase().includes(condition.nameContains.toLowerCase());
        }
      }
      return false;
    };

    const matching = allFiles.filter((f: FileItem) => matchesCondition(f));

    for (const file of matching) {
      const targetPath = normalizePath(joinPath(currentDirectory, file.name));
      items.push({
        fileName: file.name,
        filePath: file.path,
        operation: op.asCopies ? 'copy' : 'move',
        newName: file.name,
        targetPath,
        status: 'pending',
        isFolder: false,
        extractFrom: sourceFolderName,
      });
    }

    if (op.deleteSource) {
      const timestamp = Date.now().toString();
      const trashBase = normalizePath(joinPath(currentDirectory, '.docuframe-trash', timestamp));
      const trashPath = normalizePath(joinPath(trashBase, sourceFolderName));
      items.push({
        fileName: sourceFolderName,
        filePath: sourceFolderPath,
        operation: 'delete',
        newName: '',
        trashPath,
        status: 'pending',
        isFolder: true,
      });
    }
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

/** Max chars of PDF text to send per file (avoid token limits) */
const CONTENT_BASED_RENAME_MAX_CHARS = 2500;

/**
 * Get AI-suggested names and folder groupings based on PDF content.
 * Uses readPdfText to extract content, then AI analyzes and suggests rename + optional targetFolder.
 * @param onContentReading Called with (fileName, index, total) when starting to read each PDF; with (null, 0, 0) when done
 * @param onContentAnalyzing Called with true when starting AI analysis (after reading), false when done
 */
export async function getContentBasedRenameSuggestions(
  files: FileItem[],
  userPrompt: string,
  currentDirectory: string,
  model: 'sonnet' | 'haiku' = 'sonnet',
  onContentReading?: (fileName: string | null, index: number, total: number) => void,
  onContentAnalyzing?: (analyzing: boolean) => void
): Promise<{ fileName: string; newName: string; targetFolder?: string }[]> {
  const settings = await settingsService.getSettings();
  const apiKey = settings.claudeApiKey;
  if (!apiKey) throw new Error('Claude API key not set. Add it in Settings.');

  const pdfFiles = files.filter(f => f.type === 'file' && f.name.toLowerCase().endsWith('.pdf'));
  if (pdfFiles.length === 0) return [];

  const api = window.electronAPI as { readPdfText?: (path: string) => Promise<string> };
  if (!api?.readPdfText) throw new Error('PDF text extraction not available.');

  const fileContents: Array<{ fileName: string; content: string }> = [];
  const total = pdfFiles.length;
  for (let i = 0; i < pdfFiles.length; i++) {
    const f = pdfFiles[i];
    onContentReading?.(f.name, i + 1, total);
    try {
      const text = await api.readPdfText(f.path);
      const truncated = (text || '').trim().slice(0, CONTENT_BASED_RENAME_MAX_CHARS);
      fileContents.push({ fileName: f.name, content: truncated || '(no text extracted)' });
    } catch {
      fileContents.push({ fileName: f.name, content: '(failed to extract text)' });
    }
  }
  onContentReading?.(null, 0, 0);
  onContentAnalyzing?.(true);

  const contentBlock = fileContents
    .map(({ fileName, content }) => `--- ${fileName} ---\n${content}`)
    .join('\n\n');

  const systemPrompt = `You are a file organization assistant. The user wants to rename and optionally group PDF files based on their CONTENT. You will receive extracted text from each PDF.

Rules:
- Suggest a clear, descriptive new name based on document content (e.g. "Bank Reconciliation - March 2025.pdf")
- Keep the .pdf extension
- Optionally suggest targetFolder to group related files (e.g. "Invoices", "Reports"). Use a single folder name only (no nested paths like "A/B"). Omit targetFolder if file should stay in current directory. Do not suggest a folder that matches the current directory name.
- Return ONLY a JSON array: [{"fileName":"exact current name","newName":"suggested name","targetFolder":"optional folder" or omit}]
- Include every file in the list
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
        text: `User request: ${userPrompt}\n\nCurrent directory name: ${currentDirectory.split(/[/\\]/).filter(Boolean).pop() || '(root)'}\n\nExtracted PDF content:\n\n${contentBlock}\n\nReturn JSON array of {fileName, newName, targetFolder?} for each file. Do not use targetFolder that equals the current directory name.`,
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
    const fileNamesSet = new Set(pdfFiles.map(f => f.name));
    return parsed.filter(
      (p): p is { fileName: string; newName: string; targetFolder?: string } =>
        p && typeof p.fileName === 'string' && typeof p.newName === 'string' && fileNamesSet.has(p.fileName)
    );
  } catch {
    return [];
  } finally {
    onContentAnalyzing?.(false);
  }
}

/**
 * Expand contentBasedRename operations into PlannedItems (rename + optional move)
 */
export async function expandContentBasedRenameOperations(
  operations: Array<{ action: 'contentBasedRename'; condition: Condition }>,
  folderItems: FileItem[],
  currentDirectory: string,
  userPrompt: string,
  selectedFileNames: string[] | undefined,
  model: 'sonnet' | 'haiku',
  onContentReading?: (fileName: string | null, index: number, total: number) => void,
  onContentAnalyzing?: (analyzing: boolean) => void
): Promise<PlannedItem[]> {
  const items: PlannedItem[] = [];
  const selectedSet = selectedFileNames?.length ? new Set(selectedFileNames) : undefined;

  for (const op of operations) {
    const matching = getMatchingItemsForCondition(op.condition, folderItems, selectedFileNames);
    let pdfFiles = matching.filter(f => f.type === 'file' && f.name.toLowerCase().endsWith('.pdf'));
    // Sort to match File Manager display order: indexed first, then non-indexed, both by name
    pdfFiles = [...pdfFiles].sort((a, b) => {
      const aIdx = extractIndexPrefix(a.name);
      const bIdx = extractIndexPrefix(b.name);
      if (aIdx && !bIdx) return -1;
      if (!aIdx && bIdx) return 1;
      return a.name.localeCompare(b.name);
    });
    if (pdfFiles.length === 0) continue;

    const suggestions = await getContentBasedRenameSuggestions(pdfFiles, userPrompt, currentDirectory, model, onContentReading, onContentAnalyzing);
    const currentDirName = currentDirectory.split(/[/\\]/).filter(Boolean).pop() || '';

    for (const s of suggestions) {
      const file = pdfFiles.find(f => f.name === s.fileName);
      if (!file || s.newName === s.fileName) continue;

      let targetFolder = s.targetFolder?.replace(/^[\\/]+|[\\/]+$/g, '') || '';
      // Prevent 2-level nesting: take only first segment if AI returned a path (e.g. "Folder/SubFolder")
      if (targetFolder.includes('/') || targetFolder.includes('\\')) {
        targetFolder = targetFolder.split(/[/\\]/)[0] || '';
      }
      // If targetFolder equals current directory name, we're already in that folder - just rename in place
      if (targetFolder && targetFolder === currentDirName) {
        targetFolder = '';
      }

      if (targetFolder) {
        const targetDir = normalizePath(joinPath(currentDirectory, targetFolder));
        const targetPath = normalizePath(joinPath(targetDir, s.newName));
        items.push({
          fileName: file.name,
          filePath: file.path,
          operation: 'move',
          newName: targetFolder + '/' + s.newName,
          targetPath,
          status: 'pending',
          isFolder: false,
        });
      } else {
        items.push({
          fileName: file.name,
          filePath: file.path,
          operation: 'rename',
          newName: s.newName,
          status: 'pending',
          isFolder: false,
        });
      }
    }
  }
  return items;
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
  const folderNames = folderItems.filter(f => f.type === 'folder').map(f => f.name);
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
7b. contentBasedRename: ONLY when user explicitly mentions reading/analyzing FILE CONTENT or document content. Extracts PDF text (expensive) and renames/groups by content. Use smartRename for name-only requests.
   - Use when: "rename by content", "group according to file content", "organize by what's inside"
   - Do NOT use for: "rename", "improve names", "organize" (use smartRename or moveToFolder instead)
   {"action":"contentBasedRename","condition":{"selection":true}}
8. moveToFolder: Move files into a child folder (creates folder if it doesn't exist). Target folder is relative to current directory.
   {"action":"moveToFolder","targetFolder":"finals","condition":{"indexEquals":"G"}}
   {"action":"moveToFolder","targetFolder":"drafts","condition":{"selection":true}}
9. delete: Soft-delete files or folders (move to hidden trash, revertible). For "delete X folder" use folderNameEquals for EXACT folder name match - NEVER use nameContains for single-letter or short names (e.g. "x" matches "Xero", "Fixed" incorrectly).
   {"action":"delete","condition":{"indexEquals":"G"}}
   {"action":"delete","condition":{"selection":true}}
   {"action":"delete","condition":{"folderNameEquals":"X"}}
   {"action":"delete","condition":{"nameEquals":"exact filename.pdf"}}
10. mergePdfs: Merge PDF files in order into one PDF. retainOriginals: true to keep originals, false (default) to soft-delete them. targetFolder: optional - put merged file in this subfolder (e.g. "merge then move to finals").
   {"action":"mergePdfs","outputFilename":"Merged.pdf","condition":{"selection":true}}
   {"action":"mergePdfs","outputFilename":"Combined.pdf","targetFolder":"finals","condition":{"selection":true}}
11. extract: Extract contents from a folder to current directory. sourceFolder: folder name (or from selection). condition: filter files inside (all, indexEquals, nameContains). deleteSource: true to soft-delete folder after (default: false). asCopies: true to copy instead of move (e.g. "extract as copies", "copy files from folder").
   {"action":"extract","sourceFolder":"A","condition":"all","deleteSource":false}
   {"action":"extract","sourceFolder":"finals","condition":"all","asCopies":true}
   {"action":"extract","sourceFolder":"Tax Return","condition":{"nameContains":"tax"},"deleteSource":true}
   For "extract B indexes of folder selected": use sourceFolder from selection (the selected folder name), condition {"indexEquals":"B"}
12. createCopies: Create N copies of matching files. Use EITHER names array OR nameFrom/nameTo. Preserves file extension. targetFolder: optional - put copies in this subfolder (e.g. "add copies to drafts folder").
   - names: Use when user describes semantic names (months, quarters, etc). E.g. "first 3 months of 2026" -> ["January 2026","February 2026","March 2026"]
   {"action":"createCopies","count":3,"names":["January 2026","February 2026","March 2026"],"condition":{"selection":true}}
   {"action":"createCopies","count":3,"names":["Jan","Feb","Mar"],"targetFolder":"drafts","condition":{"selection":true}}
   - nameFrom/nameTo: Use for numbered ranges. "1 March" to "5 March" = 5 copies with suffix " March"
   {"action":"createCopies","count":5,"nameFrom":"1 March","nameTo":"5 March","condition":{"selection":true}}
   {"action":"createCopies","count":3,"nameFrom":"1","nameTo":"3","targetFolder":"finals","condition":{"selection":true}}
${selectionNote}

Current directory: ${currentDirectory}
Folders in directory: ${JSON.stringify(folderNames)}
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
        ['copyToIndex', 'addPrefix', 'addSuffix', 'removeSuffix', 'removePrefix', 'transformCase', 'smartRename', 'contentBasedRename', 'moveToFolder', 'delete', 'mergePdfs', 'extract', 'createCopies'].includes(op.action)
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
): Promise<ExecutionWithUndo> {
  const api = window.electronAPI as any;
  if (!api?.copyFileSilent || !api?.renameItem || !api?.getFileStats || !api?.deleteFile || !api?.moveFilesSilent || !api?.createDirectory || !api?.executeCommand) {
    throw new Error('File operations not available');
  }

  const baseDir = currentDirectory === '/' ? '' : currentDirectory;
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  const undoItems: UndoEntry['items'] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(i, item, 'processing');

    try {
      if (item.operation === 'move' && item.targetPath) {
        const targetDir = getParentPath(item.targetPath) || baseDir;
        try {
          await api.createDirectory(targetDir);
        } catch {
          /* folder may already exist */
        }
        const results = await api.moveFilesSilent([item.filePath], targetDir);
        const ok = results?.some((r: { status: string }) => r.status === 'success');
        if (ok) {
          successful++;
          undoItems.push({ operation: 'move', fromPath: item.filePath, toPath: item.targetPath });
          onProgress?.(i, { ...item, status: 'done' }, 'done');
        } else {
          throw new Error(results?.[0]?.error || 'Move failed');
        }
        continue;
      }

      if (item.operation === 'delete' && item.trashPath) {
        const trashDir = getParentPath(item.trashPath) || baseDir;
        try {
          await api.createDirectory(trashDir);
        } catch {
          /* folder may already exist */
        }
        const results = await api.moveFilesSilent([item.filePath], trashDir);
        const ok = results?.some((r: { status: string }) => r.status === 'success');
        if (ok) {
          successful++;
          undoItems.push({ operation: 'delete', originalPath: item.filePath, trashPath: item.trashPath });
          onProgress?.(i, { ...item, status: 'done' }, 'done');
        } else {
          throw new Error(results?.[0]?.error || 'Delete failed');
        }
        continue;
      }

      if (item.operation === 'merge' && item.sourcePaths && item.outputPath) {
        const filenames = item.sourcePaths.map(p => {
          const parts = p.split(/[/\\]/);
          return parts[parts.length - 1] || '';
        });
        const outputFilename = item.outputPath.split(/[/\\]/).pop() || item.newName;
        const outputDirectory = getParentPath(item.outputPath) || baseDir;
        const result = await api.executeCommand('merge_pdfs', currentDirectory, {
          files: filenames,
          outputFilename,
          outputDirectory: outputDirectory !== baseDir ? outputDirectory : undefined,
        });
        if (!result?.success) {
          throw new Error(result?.message || 'Merge failed');
        }
        let trashPaths: string[] | undefined;
        if (!item.retainOriginals && item.sourcePaths.length > 0) {
          const timestamp = Date.now().toString();
          const trashBase = normalizePath(joinPath(baseDir, '.docuframe-trash', 'merge_' + timestamp));
          try {
            await api.createDirectory(trashBase);
          } catch {
            /* folder may already exist */
          }
          const trashResults = await api.moveFilesSilent(item.sourcePaths, trashBase);
          trashPaths = (trashResults || []).filter((r: { status: string; path?: string }) => r.status === 'success').map((r: { path: string }) => r.path).filter(Boolean);
        }
        successful++;
        undoItems.push({
          operation: 'merge',
          mergedPath: item.outputPath,
          originalPaths: item.sourcePaths,
          trashPaths,
          originalsWereDeleted: !item.retainOriginals,
        });
        onProgress?.(i, { ...item, status: 'done' }, 'done');
        continue;
      }

      const sourcePath = normalizePath(item.filePath);
      const destPath = item.targetPath
        ? normalizePath(item.targetPath)
        : normalizePath(joinPath(
            normalizePath(item.filePath.slice(0, item.filePath.length - item.fileName.length).replace(/[\\/]+$/, '') || baseDir),
            item.newName
          ));
      const dir = getParentPath(destPath) || baseDir;

      if (item.operation === 'copy') {
        try {
          await api.createDirectory(dir);
        } catch {
          /* folder may already exist */
        }
        if (sourcePath === destPath) {
          skipped++;
          onProgress?.(i, { ...item, status: 'done' }, 'done');
          continue;
        }

        let existingFileMoved = false;
        let existingFileTempPath: string | null = null;
        const destFileName = item.newName.split(/[/\\]/).pop() || item.newName;

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
            existingFileTempPath = joinPath(dir, `~temp_existing_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${destFileName}`);
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
                ? destFileName.replace(/(\.[^.]+)$/, ' (1)$1')
                : destFileName.replace(/(\.[^.]+)$/, ` (${j})$1`);
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
          undoItems.push({ operation: 'copy', sourcePath, destPath });
          onProgress?.(i, { ...item, status: 'done' }, 'done');
        } catch (err) {
          if (existingFileMoved && existingFileTempPath) {
            try {
              await api.renameItem(existingFileTempPath, destPath);
            } catch {
              for (let j = 1; j <= 100; j++) {
                const conflictName = j === 1
                  ? destFileName.replace(/(\.[^.]+)$/, ' (1)$1')
                  : destFileName.replace(/(\.[^.]+)$/, ` (${j})$1`);
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
        undoItems.push({ operation: 'rename', sourcePath, destPath });
        onProgress?.(i, { ...item, status: 'done' }, 'done');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed++;
      onProgress?.(i, { ...item, status: 'failed', error: msg }, 'failed', msg);
    }
  }

  const undoEntry: UndoEntry | null =
    undoItems.length > 0 ? { directory: currentDirectory, items: undoItems } : null;
  return { result: { successful, failed, skipped }, undoEntry };
}
