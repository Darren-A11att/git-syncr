import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { getPaths } from './platform.js';
import { Logger } from './logger.js';
import { acquireLock, releaseLock } from './lock.js';
import { checkNetwork } from './network.js';
import { processRepo } from './repo.js';
import { sendNotification } from './notify.js';
import type { RepoResult } from './repo.js';

export interface SyncResult {
  synced: number;
  unchanged: number;
  skipped: number;
  errored: number;
  total: number;
  abortReason?: string;
}

export async function runSync(opts: { verbose: boolean; dryRun: boolean }): Promise<SyncResult> {
  const config = loadConfig();
  if (!config) {
    return { synced: 0, unchanged: 0, skipped: 0, errored: 0, total: 0, abortReason: 'No configuration found.' };
  }

  const paths = getPaths();
  const logFile = path.join(paths.logDir, 'git-syncr.log');
  const logger = new Logger(logFile, opts.verbose);

  // Acquire lock
  if (!acquireLock(paths.lockFile)) {
    logger.log('Another git-syncr is running. Exiting.');
    sendNotification('git-syncr', 'Already running', 'Another instance is running.');
    return { synced: 0, unchanged: 0, skipped: 0, errored: 0, total: 0, abortReason: 'Another instance is running.' };
  }

  try {
    const timestamp = new Date().toISOString();
    logger.log('========================================');
    logger.log(`git-syncr run: ${timestamp}`);
    if (opts.dryRun) {
      logger.log('MODE: dry-run (no pulls)');
    }
    logger.log('========================================');

    // Network check
    const online = await checkNetwork();
    if (!online) {
      logger.log('No network connectivity. Aborting.');
      sendNotification('git-syncr', 'No network', 'Could not reach github.com');
      logger.log('========================================');
      return { synced: 0, unchanged: 0, skipped: 0, errored: 0, total: 0, abortReason: 'No network connectivity.' };
    }

    // Discover repos
    const repos = discoverRepos(config.syncDir);

    let synced = 0;
    let unchanged = 0;
    let skipped = 0;
    let errored = 0;

    for (const repoPath of repos) {
      const repoName = path.basename(repoPath);
      const result: RepoResult = await processRepo(repoPath, repoName, opts.dryRun);

      switch (result.status) {
        case 'SYNCED':
          logger.log(`[SYNCED]    ${result.name} ${result.detail ?? ''}`);
          synced++;
          break;
        case 'WOULD_SYNC':
          logger.log(`[WOULD_SYNC] ${result.name} ${result.detail ?? ''}`);
          synced++;
          break;
        case 'UNCHANGED':
          logger.log(`[UNCHANGED] ${result.name}`);
          unchanged++;
          break;
        case 'SKIPPED':
          logger.log(`[SKIPPED]   ${result.name} -- ${result.detail ?? ''}`);
          skipped++;
          break;
        case 'ERROR':
          logger.log(`[ERROR]     ${result.name} -- ${result.detail ?? ''}`);
          errored++;
          break;
      }
    }

    const total = synced + unchanged + skipped + errored;
    logger.log('----------------------------------------');

    const syncLabel = opts.dryRun ? 'would sync' : 'synced';
    const summary = `${synced} ${syncLabel}, ${unchanged} unchanged, ${skipped} skipped, ${errored} errored (${total} total)`;
    logger.log(`Summary: ${summary}`);
    logger.log('========================================');

    sendNotification(
      'git-syncr',
      `${total} repos processed`,
      `${synced} ${syncLabel}, ${unchanged} unchanged, ${skipped} skipped, ${errored} errored`,
    );

    return { synced, unchanged, skipped, errored, total };
  } finally {
    releaseLock(paths.lockFile);
  }
}

function discoverRepos(syncDir: string): string[] {
  if (!fs.existsSync(syncDir)) {
    return [];
  }

  const entries = fs.readdirSync(syncDir, { withFileTypes: true });
  const repos: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(syncDir, entry.name);
    const gitDir = path.join(fullPath, '.git');

    if (fs.existsSync(gitDir)) {
      repos.push(fullPath);
    }
  }

  return repos.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}
