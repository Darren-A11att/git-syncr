import os from 'node:os';
import path from 'node:path';

export type Platform = 'macos' | 'linux';

export interface PlatformPaths {
  configDir: string;
  configFile: string;
  logDir: string;
  lockFile: string;
  serviceDir: string;
  serviceFile: string;
}

export function getPlatform(): Platform {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      throw new Error(`Unsupported platform: ${process.platform}. git-syncr supports macOS and Linux.`);
  }
}

export function getPaths(): PlatformPaths {
  const home = os.homedir();
  const platform = getPlatform();

  const configDir = path.join(home, '.config', 'git-syncr');
  const configFile = path.join(configDir, 'config.json');

  if (platform === 'macos') {
    const logDir = path.join(home, 'Library', 'Logs', 'git-syncr');
    return {
      configDir,
      configFile,
      logDir,
      lockFile: path.join(logDir, '.git-syncr.lock'),
      serviceDir: path.join(home, 'Library', 'LaunchAgents'),
      serviceFile: path.join(home, 'Library', 'LaunchAgents', 'com.user.git-syncr.plist'),
    };
  }

  const logDir = path.join(home, '.local', 'share', 'git-syncr', 'logs');
  return {
    configDir,
    configFile,
    logDir,
    lockFile: path.join(logDir, '.git-syncr.lock'),
    serviceDir: path.join(home, '.config', 'systemd', 'user'),
    serviceFile: path.join(home, '.config', 'systemd', 'user', 'git-syncr.service'),
  };
}
