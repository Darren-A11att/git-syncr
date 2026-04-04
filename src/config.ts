import fs from 'node:fs';
import { getPaths } from './platform.js';

export interface Config {
  syncDir: string;
  intervalSeconds: number;
  notificationsEnabled: boolean;
}

const paths = getPaths();

export function configExists(): boolean {
  return fs.existsSync(paths.configFile);
}

export function loadConfig(): Config | null {
  if (!configExists()) return null;
  const raw = fs.readFileSync(paths.configFile, 'utf-8');
  return JSON.parse(raw) as Config;
}

export function saveConfig(config: Config): void {
  fs.mkdirSync(paths.configDir, { recursive: true });
  fs.writeFileSync(paths.configFile, JSON.stringify(config, null, 2) + '\n');
}
