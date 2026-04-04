import fs from 'node:fs';
import { select } from '@inquirer/prompts';
import pc from 'picocolors';
import { configExists, loadConfig } from './config.js';
import { runSync } from './sync.js';
import { uninstallService } from './service.js';
import { getPaths } from './platform.js';

function printUsage(): void {
  console.log(`
Usage: git-syncr [options]

Options:
  --help         Show this help message

When run without options, opens the interactive menu.
`);
}

function printHeader(): void {
  console.log('');
  console.log(pc.bold('  git-syncr'));
  console.log(pc.dim('  ─────────────────────────────────'));
}

function printStatus(): void {
  const config = loadConfig();
  const paths = getPaths();

  if (config) {
    console.log('');
    console.log(`    Sync directory:  ${pc.cyan(config.syncDir)}`);
    console.log(`    Sync interval:   ${pc.cyan(formatInterval(config.intervalSeconds))}`);
    console.log(`    Notifications:   ${pc.cyan(config.notificationsEnabled ? 'on' : 'off')}`);
    console.log(`    Logs:            ${pc.dim(paths.logDir)}`);
  } else {
    console.log('');
    console.log(pc.yellow('    Not configured. Select "Setup" to get started.'));
  }
  console.log('');
}

function formatInterval(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

async function mainMenu(): Promise<void> {
  // First run — no config, go straight to setup
  if (!configExists()) {
    printHeader();
    console.log('');
    console.log(pc.dim('  Welcome! Let\'s set up git-syncr.'));
    const { runWizard } = await import('./setup/wizard.js');
    await runWizard();
  }

  // Main menu loop
  while (true) {
    printHeader();
    printStatus();

    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: 'Sync now', value: 'sync', description: 'Pull remote changes for all repos' },
        { name: 'Sync (dry run)', value: 'dry-run', description: 'Check for changes without pulling' },
        { name: 'Setup', value: 'setup', description: 'Change sync directory, interval, or notifications' },
        { name: 'View last log', value: 'log', description: 'Show the most recent sync log' },
        { name: 'Quit', value: 'quit', description: 'Exit git-syncr' },
      ],
    });

    switch (action) {
      case 'sync': {
        console.log('');
        const result = await runSync({ verbose: true, dryRun: false });
        if (result.abortReason) {
          console.log(pc.yellow(`\n  ${result.abortReason}`));
        }
        console.log('');
        await pressEnterToContinue();
        break;
      }

      case 'dry-run': {
        console.log('');
        const result = await runSync({ verbose: true, dryRun: true });
        if (result.abortReason) {
          console.log(pc.yellow(`\n  ${result.abortReason}`));
        }
        console.log('');
        await pressEnterToContinue();
        break;
      }

      case 'setup': {
        const { runWizard } = await import('./setup/wizard.js');
        await runWizard();
        break;
      }

      case 'log': {
        showLastLog();
        await pressEnterToContinue();
        break;
      }

      case 'quit': {
        await handleQuit();
        return;
      }
    }
  }
}

async function handleQuit(): Promise<void> {
  const action = await select({
    message: 'How would you like to quit?',
    choices: [
      {
        name: 'Quit & keep syncing in background',
        value: 'keep',
        description: 'Background service continues to sync on schedule',
      },
      {
        name: 'Quit & stop background sync',
        value: 'stop',
        description: 'Uninstall the background service',
      },
      {
        name: 'Cancel',
        value: 'cancel',
        description: 'Return to main menu',
      },
    ],
  });

  switch (action) {
    case 'keep':
      console.log('');
      console.log(pc.dim('  Background sync will continue on schedule.'));
      console.log('');
      process.exit(0);
      break;

    case 'stop':
      try {
        uninstallService();
        console.log('');
        console.log(pc.dim('  Background service stopped and removed.'));
        console.log(pc.dim('  Run git-syncr again to re-enable.'));
        console.log('');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(pc.yellow(`\n  Could not stop service: ${msg}`));
        console.log('');
      }
      process.exit(0);
      break;

    case 'cancel':
      // Return to menu — do nothing
      break;
  }
}

function showLastLog(): void {
  const paths = getPaths();
  const logFile = `${paths.logDir}/git-syncr.log`;

  try {
    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.trimEnd().split('\n');

    // Find the last run block (starts with ===)
    let startIdx = lines.length - 1;
    let foundEnd = false;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('====')) {
        if (foundEnd) {
          startIdx = i;
          break;
        }
        foundEnd = true;
      }
    }

    console.log('');
    for (let i = startIdx; i < lines.length; i++) {
      console.log(`  ${lines[i]}`);
    }
    console.log('');
  } catch {
    console.log('');
    console.log(pc.dim('  No log file found. Run a sync first.'));
    console.log('');
  }
}

async function pressEnterToContinue(): Promise<void> {
  const { input } = await import('@inquirer/prompts');
  await input({ message: pc.dim('Press Enter to continue...') });
}

export async function run(args: string[]): Promise<void> {
  if (args.includes('--help')) {
    printUsage();
    return;
  }

  // Non-interactive flags for background/scripted use
  if (args.includes('--verbose') || args.includes('--dry-run')) {
    if (!configExists()) {
      console.error('No configuration found. Run "git-syncr" to set up.');
      process.exit(1);
    }
    const verbose = args.includes('--verbose');
    const dryRun = args.includes('--dry-run');
    const result = await runSync({ verbose, dryRun });
    process.exit(result.errored > 0 ? 1 : 0);
  }

  // Interactive mode — main menu
  await mainMenu();
}
