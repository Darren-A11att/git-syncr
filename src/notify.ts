import { execFile } from 'node:child_process';
import { getPlatform } from './platform.js';

export function sendNotification(title: string, subtitle: string, body: string): void {
  const platform = getPlatform();

  try {
    if (platform === 'macos') {
      const script = `display notification "${body}" with title "${title}" subtitle "${subtitle}"`;
      execFile('osascript', ['-e', script], (err) => {
        if (err) { /* notification failed silently */ }
      });
    } else {
      execFile('notify-send', [title, `${subtitle}\n${body}`], (err) => {
        if (err) { /* notify-send not available or failed */ }
      });
    }
  } catch {
    // Fire and forget
  }
}
