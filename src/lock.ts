import fs from 'node:fs';
import path from 'node:path';

export function acquireLock(lockPath: string): boolean {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  if (fs.existsSync(lockPath)) {
    const raw = fs.readFileSync(lockPath, 'utf-8').trim();
    const pid = parseInt(raw, 10);

    if (!isNaN(pid)) {
      try {
        process.kill(pid, 0);
        // Process is still running
        return false;
      } catch {
        // Process is dead — stale lock
        fs.unlinkSync(lockPath);
      }
    } else {
      fs.unlinkSync(lockPath);
    }
  }

  fs.writeFileSync(lockPath, String(process.pid));
  return true;
}

export function releaseLock(lockPath: string): void {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // Already cleaned up
  }
}
