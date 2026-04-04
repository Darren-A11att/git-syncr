import os from 'node:os';
import path from 'node:path';
import { input, confirm } from '@inquirer/prompts';
import pc from 'picocolors';
import { loadConfig, saveConfig, type Config } from '../config.js';
import { installService } from '../service.js';
import { directoryPrompt } from './directory-prompt.js';

function parseInterval(value: string): number | null {
  const match = value.trim().match(/^(\d+)\s*(h|d|m|s)?$/i);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const unit = (match[2] ?? 'h').toLowerCase();

  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return null;
  }
}

function formatInterval(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

export async function runWizard(): Promise<void> {
  const existing = loadConfig();
  const isReconfig = existing !== null;

  console.log('');
  console.log(pc.bold('  git-syncr setup'));
  console.log(pc.dim('  ─────────────────────────────────'));

  if (isReconfig) {
    console.log('');
    console.log(pc.dim('  Current configuration:'));
    console.log(`    Sync directory:  ${pc.cyan(existing.syncDir)}`);
    console.log(`    Sync interval:   ${pc.cyan(formatInterval(existing.intervalSeconds))}`);
    console.log(`    Notifications:   ${pc.cyan(existing.notificationsEnabled ? 'on' : 'off')}`);
    console.log('');
  }

  let syncDir = existing?.syncDir ?? path.join(os.homedir(), 'Development');
  let intervalSeconds = existing?.intervalSeconds ?? 86400;
  let notificationsEnabled = existing?.notificationsEnabled ?? true;

  // --- Sync Directory ---
  if (isReconfig) {
    const changeSyncDir = await confirm({
      message: `Change sync directory? (currently ${pc.cyan(syncDir)})`,
      default: false,
    });
    if (changeSyncDir) {
      syncDir = await directoryPrompt({
        message: 'Select sync directory:',
        default: syncDir,
      });
    }
  } else {
    syncDir = await directoryPrompt({
      message: 'Select the directory to sync:',
      default: syncDir,
    });
  }

  // --- Sync Interval ---
  if (isReconfig) {
    const changeInterval = await confirm({
      message: `Change sync interval? (currently ${pc.cyan(formatInterval(intervalSeconds))})`,
      default: false,
    });
    if (changeInterval) {
      intervalSeconds = await promptInterval(intervalSeconds);
    }
  } else {
    intervalSeconds = await promptInterval(intervalSeconds);
  }

  // --- Notifications ---
  if (isReconfig) {
    const changeNotify = await confirm({
      message: `Change notifications? (currently ${pc.cyan(notificationsEnabled ? 'on' : 'off')})`,
      default: false,
    });
    if (changeNotify) {
      notificationsEnabled = await confirm({
        message: 'Enable desktop notifications?',
        default: notificationsEnabled,
      });
    }
  } else {
    notificationsEnabled = await confirm({
      message: 'Enable desktop notifications?',
      default: true,
    });
  }

  // --- Save & Install ---
  const config: Config = { syncDir, intervalSeconds, notificationsEnabled };
  saveConfig(config);

  console.log('');
  console.log(pc.dim('  Installing background service...'));

  try {
    installService(config);
    console.log(pc.green('  Service installed successfully.'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(pc.yellow(`  Could not install service: ${msg}`));
    console.log(pc.dim('  You can run git-syncr manually or try again later.'));
  }

  // --- Summary ---
  console.log('');
  console.log(pc.green('  Setup complete!'));
  console.log('');
}

async function promptInterval(defaultSeconds: number): Promise<number> {
  const result = await input({
    message: 'Sync interval (e.g., 1h, 6h, 12h, 24h, 7d):',
    default: formatInterval(defaultSeconds),
    validate: (value) => {
      const parsed = parseInterval(value);
      if (parsed === null || parsed < 60) {
        return 'Enter a valid interval (e.g., 1h, 6h, 24h, 7d). Minimum 1m.';
      }
      return true;
    },
  });

  return parseInterval(result)!;
}
