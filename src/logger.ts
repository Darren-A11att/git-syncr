import fs from 'node:fs';
import path from 'node:path';

export class Logger {
  constructor(
    private logFile: string,
    private verbose: boolean,
  ) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
  }

  log(message: string): void {
    fs.appendFileSync(this.logFile, message + '\n');
    if (this.verbose) {
      console.log(message);
    }
  }
}
