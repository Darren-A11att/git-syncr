import { simpleGit } from 'simple-git';

export type RepoStatus = 'SYNCED' | 'WOULD_SYNC' | 'UNCHANGED' | 'SKIPPED' | 'ERROR';

export interface RepoResult {
  status: RepoStatus;
  name: string;
  detail?: string;
}

export async function processRepo(repoPath: string, repoName: string, dryRun: boolean): Promise<RepoResult> {
  const git = simpleGit(repoPath, {
    timeout: { block: 30_000 },
  });

  // Set git timeout env vars
  process.env['GIT_HTTP_LOW_SPEED_LIMIT'] = '1000';
  process.env['GIT_HTTP_LOW_SPEED_TIME'] = '15';

  try {
    // Check for dirty working tree
    const status = await git.status();
    if (!status.isClean()) {
      return { status: 'SKIPPED', name: repoName, detail: 'dirty working tree' };
    }

    // Get current branch
    let branch: string;
    try {
      branch = (await git.raw(['symbolic-ref', '--short', 'HEAD'])).trim();
    } catch {
      return { status: 'SKIPPED', name: repoName, detail: 'detached HEAD' };
    }

    if (!branch) {
      return { status: 'SKIPPED', name: repoName, detail: 'detached HEAD' };
    }

    // Get upstream tracking branch
    let upstream: string;
    try {
      upstream = (await git.raw(['rev-parse', '--abbrev-ref', '@{upstream}'])).trim();
    } catch {
      return { status: 'SKIPPED', name: `${repoName} (${branch})`, detail: 'no tracking branch' };
    }

    const remoteName = upstream.split('/')[0];
    const nameWithBranch = `${repoName} (${branch})`;

    // Fetch from remote
    try {
      await git.fetch(remoteName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'ERROR', name: nameWithBranch, detail: `fetch failed: ${msg}` };
    }

    // Compare local vs remote
    const localSha = (await git.revparse(['HEAD'])).trim();
    const remoteSha = (await git.revparse([upstream])).trim();

    if (localSha === remoteSha) {
      return { status: 'UNCHANGED', name: nameWithBranch };
    }

    const shortLocal = localSha.slice(0, 7);
    const shortRemote = remoteSha.slice(0, 7);

    // Dry run — don't pull
    if (dryRun) {
      return { status: 'WOULD_SYNC', name: nameWithBranch, detail: `${shortLocal}..${shortRemote}` };
    }

    // Pull with ff-only
    try {
      await git.pull(['--ff-only']);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'ERROR', name: nameWithBranch, detail: `ff-only failed: ${msg}` };
    }

    return { status: 'SYNCED', name: nameWithBranch, detail: `${shortLocal}..${shortRemote}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'ERROR', name: repoName, detail: msg };
  }
}
