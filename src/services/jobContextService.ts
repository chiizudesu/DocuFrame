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
  const annualIdx = segments.findIndex(
    (s) => s.toLowerCase().replace(/\s+/g, '') === 'annualaccounts'
  );
  if (annualIdx > 0) return segments[annualIdx - 1];
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

  // Find A3 files (PDF only) and any file with "look through" in the name
  const a3Files = folderItems.filter((f) => {
    if (f.type !== 'pdf' && f.type !== 'file' && f.type !== 'document') return false;
    const prefix = extractIndexPrefix(f.name);
    return prefix === 'A3';
  });

  const ltcFiles = folderItems.filter((f) => {
    if (f.type !== 'pdf' && f.type !== 'file') return false;
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
  const api = window.electronAPI as { readPdfText?: (path: string) => Promise<string> } | undefined;

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

  const folderFileNames = folderItems.map((f) => f.name);

  const result: JobContextClaudeResult = await analyzeJobContext({
    clientName,
    entityTypeHint,
    currentYear,
    folderFileNames,
    a3FileContents,
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
