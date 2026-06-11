import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export interface RootGitStatus {
  isRepo: boolean;
  gitRoot?: string;
  branch?: string;
  upstream?: string;
  ahead: number;
  behind: number;
  /** Tracked files with staged or unstaged modifications */
  changedCount: number;
  untrackedCount: number;
  /** Last fetch failed (e.g. offline) — counts may be stale */
  fetchFailed?: boolean;
}

export interface RootGitActionResult {
  success: boolean;
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

async function git(cwd: string, args: string[], timeoutMs = 30000): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: 10 * 1024 * 1024,
    timeout: timeoutMs,
  });
  return { stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' };
}

/** execFile errors bury the useful git message in stderr — surface that instead of "Command failed: ..." */
function gitErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { stderr?: unknown; message?: unknown; killed?: boolean };
    if (e.killed) return 'Git command timed out';
    if (typeof e.stderr === 'string' && e.stderr.trim()) {
      // Last non-hint line of stderr is usually the actual error
      const lines = e.stderr.trim().split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('hint:'));
      if (lines.length > 0) return lines[lines.length - 1].replace(/^(fatal|error):\s*/i, '');
    }
    if (typeof e.message === 'string') return e.message;
  }
  return String(error);
}

export async function getRootGitStatus(rootPath: string, options?: { fetch?: boolean }): Promise<RootGitStatus> {
  const empty: RootGitStatus = { isRepo: false, ahead: 0, behind: 0, changedCount: 0, untrackedCount: 0 };
  if (!rootPath || !fs.existsSync(rootPath)) return empty;
  const gitRoot = findGitRoot(rootPath);
  if (!gitRoot) return empty;

  let fetchFailed = false;
  if (options?.fetch) {
    try {
      await git(gitRoot, ['fetch', '--quiet'], 20000);
    } catch {
      fetchFailed = true;
    }
  }

  const { stdout } = await git(gitRoot, ['status', '--porcelain=v2', '--branch']);

  const status: RootGitStatus = { isRepo: true, gitRoot, ahead: 0, behind: 0, changedCount: 0, untrackedCount: 0, fetchFailed };
  for (const line of stdout.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      status.branch = line.slice('# branch.head '.length).trim();
    } else if (line.startsWith('# branch.upstream ')) {
      status.upstream = line.slice('# branch.upstream '.length).trim();
    } else if (line.startsWith('# branch.ab ')) {
      const m = line.match(/\+(\d+) -(\d+)/);
      if (m) {
        status.ahead = parseInt(m[1], 10);
        status.behind = parseInt(m[2], 10);
      }
    } else if (line.startsWith('1 ') || line.startsWith('2 ') || line.startsWith('u ')) {
      status.changedCount += 1;
    } else if (line.startsWith('? ')) {
      status.untrackedCount += 1;
    }
  }
  return status;
}

/** Commit any local changes, then push. A plain `git push` with everything
 * uncommitted "succeeds" while sending nothing — that's never what the user means. */
export async function rootGitPush(rootPath: string): Promise<RootGitActionResult> {
  const gitRoot = findGitRoot(rootPath);
  if (!gitRoot) return { success: false, message: 'Root path is not inside a git repository' };
  try {
    const before = await getRootGitStatus(rootPath);
    const dirtyCount = before.changedCount + before.untrackedCount;
    if (dirtyCount > 0) {
      await git(gitRoot, ['add', '-A'], 60000);
      const stamp = new Date().toLocaleString('en-NZ', { hour12: false });
      await git(gitRoot, ['commit', '-m', `DocuFrame sync ${stamp}`], 60000);
    } else if (before.ahead === 0) {
      return { success: true, message: 'Nothing to push — already up to date' };
    }
    try {
      await git(gitRoot, ['push'], 120000);
    } catch (error) {
      // Branch with no upstream yet — set it and retry once
      if (gitErrorMessage(error).toLowerCase().includes('upstream')) {
        await git(gitRoot, ['push', '-u', 'origin', 'HEAD'], 120000);
      } else {
        throw error;
      }
    }
    return {
      success: true,
      message: dirtyCount > 0
        ? `Committed ${dirtyCount} change${dirtyCount === 1 ? '' : 's'} and pushed`
        : 'Pushed to remote',
    };
  } catch (error) {
    console.error('[RootGit] push failed:', error);
    return { success: false, message: gitErrorMessage(error) };
  }
}

export async function rootGitPull(rootPath: string): Promise<RootGitActionResult> {
  const gitRoot = findGitRoot(rootPath);
  if (!gitRoot) return { success: false, message: 'Root path is not inside a git repository' };
  try {
    const { stdout } = await git(gitRoot, ['pull'], 60000);
    const summary = stdout.trim().split('\n').pop()?.trim();
    return { success: true, message: summary && summary !== 'Already up to date.' ? summary : 'Already up to date' };
  } catch (error) {
    console.error('[RootGit] pull failed:', error);
    return { success: false, message: gitErrorMessage(error) };
  }
}

export async function rootGitDiscard(rootPath: string): Promise<RootGitActionResult> {
  const gitRoot = findGitRoot(rootPath);
  if (!gitRoot) return { success: false, message: 'Root path is not inside a git repository' };
  try {
    await git(gitRoot, ['reset', '--hard', 'HEAD'], 60000);
    return { success: true, message: 'Local changes discarded' };
  } catch (error) {
    console.error('[RootGit] discard failed:', error);
    return { success: false, message: gitErrorMessage(error) };
  }
}
