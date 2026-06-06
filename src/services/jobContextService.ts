import { extractIndexPrefix } from '../utils/indexPrefix';
import { analyzeJobContext, type JobContextClaudeResult } from './claude';

interface FileItem {
  name: string;
  type: 'folder' | 'file' | 'pdf' | 'image' | 'document';
  path: string;
}

export interface JobInclusion {
  type: string;
  count: number;
}

export interface JobContextData {
  entityType: string;
  industryClassification: string;
  previousBudget: string;
  currentBudget: string;
  budgetedHours: number;
  jobInclusions: JobInclusion[];
  aiJobSummary: string;
  riskAreas: string;
  timeTraps: string;
  analyzedDirectory: string;
}

const A3_MAX_CHARS = 3000;

function deriveEntityTypeHint(clientName: string): string {
  const name = clientName.toLowerCase();
  if (name.includes('limited') || name.includes(' ltd')) return 'Company';
  if (name.includes('trust')) return 'Trust';
  if (name.includes('partnership')) return 'Partnership';
  return 'Individual';
}

function extractClientNameFromPath(directory: string): string {
  const segments = directory.replace(/\\/g, '/').split('/').filter(Boolean);
  // Client name is the parent folder (or grandparent if in a year subfolder)
  const last = segments[segments.length - 1];
  if (/^20\d{2}$/.test(last) && segments.length >= 2) {
    return segments[segments.length - 2];
  }
  return segments[segments.length - 2] || segments[segments.length - 1] || 'Unknown';
}

function extractYearFromPath(directory: string): string {
  const segments = directory.replace(/\\/g, '/').split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (/^20\d{2}$/.test(last)) return last;
  return 'Unknown';
}

function parseBudgetToNumber(budget: string): number {
  const digits = budget.replace(/[^0-9.]/g, '');
  return parseFloat(digits) || 0;
}

export async function runJobContextAnalysis(
  currentDirectory: string,
  folderItems: FileItem[]
): Promise<JobContextData> {
  const clientName = extractClientNameFromPath(currentDirectory);
  const currentYear = extractYearFromPath(currentDirectory);
  const entityTypeHint = deriveEntityTypeHint(clientName);

  const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg']);
  const getExt = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase();

  // Find A3 files for text reading — exclude image extensions even if typed as 'file'
  const a3Files = folderItems.filter((f) => {
    if (f.type !== 'pdf' && f.type !== 'file' && f.type !== 'document') return false;
    if (IMAGE_EXTENSIONS.has(getExt(f.name))) return false;
    const prefix = extractIndexPrefix(f.name);
    return prefix === 'A3';
  });

  const ltcFiles = folderItems.filter((f) => {
    if (f.type !== 'pdf' && f.type !== 'file') return false;
    if (IMAGE_EXTENSIONS.has(getExt(f.name))) return false;
    return f.name.toLowerCase().includes('look through') || f.name.toLowerCase().includes('lookthrough');
  });

  const filesToRead = [...a3Files.slice(0, 3), ...ltcFiles.slice(0, 1)];
  const seen = new Set<string>();
  const uniqueFilesToRead = filesToRead.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });

  const a3FileContents: Array<{ fileName: string; content: string }> = [];
  const api = window.electronAPI as {
    readPdfText?: (path: string) => Promise<string>;
    readImageAsDataUrl?: (path: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  } | undefined;

  for (const file of uniqueFilesToRead) {
    try {
      if (api?.readPdfText) {
        const text = await api.readPdfText(file.path);
        a3FileContents.push({
          fileName: file.name,
          content: (text || '').trim().slice(0, A3_MAX_CHARS) || '(no text extracted)',
        });
      }
    } catch {
      a3FileContents.push({ fileName: file.name, content: '(could not read file)' });
    }
  }

  // Read A3 image files for vision analysis — match by type OR extension
  const a3ImageFiles = folderItems.filter((f) => {
    const isImage = f.type === 'image' || IMAGE_EXTENSIONS.has(getExt(f.name));
    if (!isImage) return false;
    const prefix = extractIndexPrefix(f.name);
    return prefix === 'A3';
  }).slice(0, 3);

  const a3ImageContents: Array<{ fileName: string; dataUrl: string }> = [];
  for (const file of a3ImageFiles) {
    try {
      if (api?.readImageAsDataUrl) {
        const result = await api.readImageAsDataUrl(file.path);
        if (result.success && result.dataUrl) {
          a3ImageContents.push({ fileName: file.name, dataUrl: result.dataUrl });
        }
      }
    } catch {
      // skip unreadable images
    }
  }

  const folderFileNames = folderItems.map((f) => f.name);

  const result: JobContextClaudeResult = await analyzeJobContext({
    clientName,
    entityTypeHint,
    currentYear,
    folderFileNames,
    a3FileContents,
    a3ImageContents,
  });

  const budgetNum = parseBudgetToNumber(result.currentBudget);
  const budgetedHours = budgetNum > 0 ? Math.round(budgetNum / 190) : 0;

  return {
    entityType: result.entityType || entityTypeHint,
    industryClassification: result.industryClassification || 'Unknown',
    previousBudget: result.previousBudget || 'Unknown',
    currentBudget: result.currentBudget || 'Unknown',
    budgetedHours,
    jobInclusions: Array.isArray(result.jobInclusions) ? result.jobInclusions : [],
    aiJobSummary: result.aiJobSummary || '',
    riskAreas: result.riskAreas || '',
    timeTraps: result.timeTraps || '',
    analyzedDirectory: currentDirectory,
  };
}
