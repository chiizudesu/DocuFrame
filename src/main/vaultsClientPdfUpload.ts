import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

const execFileAsync = promisify(execFile);

export interface UploadClientPdfsPayload {
  sourcePaths: string[];
  clientName: string;
  year: string;
  targetDir: string;
}

export interface UploadClientPdfsResult {
  success: boolean;
  message: string;
  copiedPaths?: string[];
  gitRoot?: string;
  stderr?: string;
}

export type UploadProgressStep = 'copying' | 'staging' | 'committing' | 'pushing';

export interface UploadProgress {
  step: UploadProgressStep;
  message: string;
}

function findGitRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function isInsideDirectory(filePath: string, dirPath: string): boolean {
  const resolvedFile = path.resolve(filePath);
  const resolvedDir = path.resolve(dirPath);
  if (resolvedFile === resolvedDir) return true;
  const rel = path.relative(resolvedDir, resolvedFile);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function gitQuiet(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' };
}

/** Resolve destination path inside `clientDir/year/`. Creates the directory if needed. */
async function resolveDestPath(clientYearDir: string, originalName: string): Promise<string> {
  await fsPromises.mkdir(clientYearDir, { recursive: true });
  const basename = path.basename(originalName);
  const ext = path.extname(basename);
  const stem = path.basename(basename, ext);
  let dest = path.join(clientYearDir, basename);
  let n = 2;
  while (fs.existsSync(dest)) {
    dest = path.join(clientYearDir, `${stem} (${n})${ext}`);
    n += 1;
  }
  return dest;
}

export async function uploadClientPdfsToVaults(
  payload: UploadClientPdfsPayload,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadClientPdfsResult> {
  const { clientName, year } = payload;
  const yearTrim = year.trim();
  const clientNameTrim = clientName.trim();

  if (!clientNameTrim) {
    return { success: false, message: 'Client name is required.' };
  }
  if (!yearTrim) {
    return { success: false, message: 'Year is required.' };
  }
  if (!/^\d{4}$/.test(yearTrim)) {
    return { success: false, message: 'Year must be four digits (e.g. 2026).' };
  }

  const targetDir = path.resolve(payload.targetDir.trim());
  let stat: fs.Stats;
  try {
    stat = await fsPromises.stat(targetDir);
  } catch {
    return { success: false, message: 'Client PDFs folder does not exist or is not accessible.' };
  }
  if (!stat.isDirectory()) {
    return { success: false, message: 'Client PDFs path is not a directory.' };
  }

  const sources = payload.sourcePaths.map((p) => path.resolve(p));
  if (sources.length === 0) {
    return { success: false, message: 'No PDF files selected.' };
  }

  for (const src of sources) {
    if (!src.toLowerCase().endsWith('.pdf')) {
      return { success: false, message: 'Only PDF files are allowed.' };
    }
    try {
      const st = await fsPromises.stat(src);
      if (!st.isFile()) {
        return { success: false, message: `Not a file: ${path.basename(src)}` };
      }
    } catch {
      return { success: false, message: `Source file not found: ${path.basename(src)}` };
    }
  }

  const gitRoot = findGitRoot(targetDir);
  if (!gitRoot) {
    return {
      success: false,
      message:
        'No git repository found above the Client PDFs folder. Point the setting at a folder inside your Vaults clone.',
    };
  }

  if (!isInsideDirectory(targetDir, gitRoot)) {
    return { success: false, message: 'Client PDFs folder must be inside the git repository.' };
  }

  // Build destination directory: targetDir / clientName / year
  const clientYearDir = path.join(targetDir, clientNameTrim, yearTrim);
  if (!isInsideDirectory(clientYearDir, targetDir)) {
    return { success: false, message: 'Invalid client name produces unsafe path.' };
  }

  onProgress?.({ step: 'copying', message: `Copying ${sources.length} PDF${sources.length === 1 ? '' : 's'}…` });

  const copiedPaths: string[] = [];
  try {
    for (const src of sources) {
      const dest = await resolveDestPath(clientYearDir, src);
      if (!isInsideDirectory(dest, targetDir)) {
        return { success: false, message: 'Invalid destination path.' };
      }
      await fsPromises.copyFile(src, dest);
      copiedPaths.push(dest);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: `Copy failed: ${msg}` };
  }

  const relPaths = copiedPaths.map((p) => path.relative(gitRoot, p).split(path.sep).join('/'));

  onProgress?.({ step: 'staging', message: 'Staging files with git add…' });
  try {
    await gitQuiet(gitRoot, ['add', '-f', '--', ...relPaths]);
  } catch (e) {
    const stderr =
      e instanceof Error && 'stderr' in e
        ? String((e as NodeJS.ErrnoException & { stderr?: Buffer }).stderr)
        : '';
    return {
      success: false,
      message: 'git add failed.',
      copiedPaths,
      gitRoot,
      stderr: stderr || (e instanceof Error ? e.message : String(e)),
    };
  }

  let stagedNames = '';
  try {
    const r = await gitQuiet(gitRoot, ['diff', '--cached', '--name-only']);
    stagedNames = r.stdout.trim();
  } catch (e) {
    const stderr =
      e instanceof Error && 'stderr' in e
        ? String((e as { stderr?: Buffer }).stderr)
        : e instanceof Error
          ? e.message
          : String(e);
    return { success: false, message: 'Could not inspect git staging area.', copiedPaths, gitRoot, stderr };
  }

  if (!stagedNames) {
    return {
      success: true,
      message: 'Files copied. No changes to commit (nothing new staged).',
      copiedPaths,
      gitRoot,
    };
  }

  onProgress?.({ step: 'committing', message: `Committing "${clientNameTrim} ${yearTrim}"…` });
  const safeMsg = `Add client PDFs: ${clientNameTrim.replace(/["`$\\]/g, '')} ${yearTrim}`;
  try {
    await gitQuiet(gitRoot, ['commit', '-m', safeMsg]);
  } catch (e) {
    const stderr =
      e instanceof Error && 'stderr' in e
        ? String((e as { stderr?: Buffer }).stderr)
        : e instanceof Error
          ? e.message
          : String(e);
    return { success: false, message: 'git commit failed.', copiedPaths, gitRoot, stderr };
  }

  onProgress?.({ step: 'pushing', message: 'Pushing to remote…' });
  try {
    await gitQuiet(gitRoot, ['push']);
  } catch (e) {
    const stderr =
      e instanceof Error && 'stderr' in e
        ? String((e as { stderr?: Buffer }).stderr)
        : e instanceof Error
          ? e.message
          : String(e);
    return {
      success: false,
      message: 'git push failed. Files were copied and committed locally.',
      copiedPaths,
      gitRoot,
      stderr,
    };
  }

  return {
    success: true,
    message: `Uploaded ${copiedPaths.length} PDF${copiedPaths.length === 1 ? '' : 's'} → ${clientNameTrim}/${yearTrim}`,
    copiedPaths,
    gitRoot,
  };
}
