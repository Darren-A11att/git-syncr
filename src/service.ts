import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { getPlatform, getPaths } from './platform.js';
import { generatePlist } from './templates/launchd.js';
import { generateServiceUnit, generateTimerUnit } from './templates/systemd.js';
import type { Config } from './config.js';

function resolveScriptPath(): string {
  // When installed globally via npm, process.argv[1] is the git-syncr bin
  // We need the actual script path, not the symlink
  try {
    const result = execSync('which git-syncr', { encoding: 'utf-8' }).trim();
    return fs.realpathSync(result);
  } catch {
    // Fallback to current script
    return process.argv[1];
  }
}

export function installService(config: Config): void {
  const platform = getPlatform();
  const paths = getPaths();
  const nodePath = process.execPath;
  const scriptPath = resolveScriptPath();

  fs.mkdirSync(paths.logDir, { recursive: true });

  if (platform === 'macos') {
    installLaunchd(nodePath, scriptPath, config, paths);
  } else {
    installSystemd(nodePath, scriptPath, config, paths);
  }
}

export function uninstallService(): void {
  const platform = getPlatform();
  const paths = getPaths();

  if (platform === 'macos') {
    uninstallLaunchd(paths);
  } else {
    uninstallSystemd(paths);
  }
}

function installLaunchd(
  nodePath: string,
  scriptPath: string,
  config: Config,
  paths: ReturnType<typeof getPaths>,
): void {
  const plist = generatePlist({
    nodePath,
    scriptPath,
    syncDir: config.syncDir,
    logDir: paths.logDir,
    home: os.homedir(),
    intervalSeconds: config.intervalSeconds,
  });

  fs.mkdirSync(paths.serviceDir, { recursive: true });

  // Unload existing service if present
  if (fs.existsSync(paths.serviceFile)) {
    try {
      execSync(`launchctl unload "${paths.serviceFile}" 2>/dev/null`, { encoding: 'utf-8' });
    } catch {
      // Not loaded, that's fine
    }
  }

  fs.writeFileSync(paths.serviceFile, plist);
  execSync(`launchctl load "${paths.serviceFile}"`, { encoding: 'utf-8' });
}

function uninstallLaunchd(paths: ReturnType<typeof getPaths>): void {
  if (fs.existsSync(paths.serviceFile)) {
    try {
      execSync(`launchctl unload "${paths.serviceFile}" 2>/dev/null`, { encoding: 'utf-8' });
    } catch {
      // Not loaded
    }
    fs.unlinkSync(paths.serviceFile);
  }
}

function installSystemd(
  nodePath: string,
  scriptPath: string,
  config: Config,
  paths: ReturnType<typeof getPaths>,
): void {
  const serviceUnit = generateServiceUnit({ nodePath, scriptPath, intervalSeconds: config.intervalSeconds });
  const timerUnit = generateTimerUnit({ nodePath, scriptPath, intervalSeconds: config.intervalSeconds });

  fs.mkdirSync(paths.serviceDir, { recursive: true });

  const timerFile = paths.serviceFile.replace('.service', '.timer');

  fs.writeFileSync(paths.serviceFile, serviceUnit);
  fs.writeFileSync(timerFile, timerUnit);

  execSync('systemctl --user daemon-reload', { encoding: 'utf-8' });
  execSync('systemctl --user enable --now git-syncr.timer', { encoding: 'utf-8' });
}

function uninstallSystemd(paths: ReturnType<typeof getPaths>): void {
  const timerFile = paths.serviceFile.replace('.service', '.timer');

  try {
    execSync('systemctl --user disable --now git-syncr.timer 2>/dev/null', { encoding: 'utf-8' });
  } catch {
    // Not enabled
  }

  for (const f of [paths.serviceFile, timerFile]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  try {
    execSync('systemctl --user daemon-reload', { encoding: 'utf-8' });
  } catch {
    // Best effort
  }
}
