import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createPrompt, useState, useKeypress, isUpKey, isDownKey, isEnterKey, isBackspaceKey } from '@inquirer/core';
import pc from 'picocolors';

interface DirectoryPromptConfig {
  message: string;
  default?: string;
}

export const directoryPrompt = createPrompt<string, DirectoryPromptConfig>(
  (config, done) => {
    const [currentDir, setCurrentDir] = useState(config.default ?? os.homedir());
    const [cursor, setCursor] = useState(0);
    const [selected, setSelected] = useState(false);

    let entries: string[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))
        .map(d => d.name)
        .sort((a, b) => a.localeCompare(b));
    } catch {
      entries = [];
    }

    // Total items: "[ Select this directory ]" + entries
    const totalItems = entries.length + 1;

    useKeypress((key) => {
      if (selected) return;

      if (isUpKey(key)) {
        setCursor((cursor - 1 + totalItems) % totalItems);
      } else if (isDownKey(key)) {
        setCursor((cursor + 1) % totalItems);
      } else if (isEnterKey(key) || key.name === 'right') {
        if (cursor === 0) {
          // Select current directory
          setSelected(true);
          done(currentDir);
        } else {
          // Descend into directory
          const target = path.join(currentDir, entries[cursor - 1]);
          setCurrentDir(target);
          setCursor(0);
        }
      } else if (isBackspaceKey(key) || key.name === 'left') {
        const parent = path.dirname(currentDir);
        if (parent !== currentDir) {
          setCurrentDir(parent);
          setCursor(0);
        }
      }
    });

    if (selected) {
      return `${pc.green('?')} ${config.message} ${pc.cyan(currentDir)}`;
    }

    const lines: string[] = [];
    lines.push(`${pc.green('?')} ${config.message}`);
    lines.push(pc.dim(`  ${currentDir}`));
    lines.push('');

    // "Select this directory" option
    if (cursor === 0) {
      lines.push(`  ${pc.cyan('>')} ${pc.bold(pc.green('[ Select this directory ]'))}`);
    } else {
      lines.push(`    ${pc.dim('[ Select this directory ]')}`);
    }

    // Directory entries (show a window of max 15 items)
    const maxVisible = 15;
    const startIdx = Math.max(0, Math.min(cursor - 1 - Math.floor(maxVisible / 2), entries.length - maxVisible));
    const endIdx = Math.min(entries.length, startIdx + maxVisible);

    if (startIdx > 0) {
      lines.push(pc.dim(`    ... ${startIdx} more above`));
    }

    for (let i = startIdx; i < endIdx; i++) {
      const itemIdx = i + 1; // +1 because "Select" is at index 0
      if (itemIdx === cursor) {
        lines.push(`  ${pc.cyan('>')} ${pc.bold(entries[i])}/`);
      } else {
        lines.push(`    ${entries[i]}/`);
      }
    }

    if (endIdx < entries.length) {
      lines.push(pc.dim(`    ... ${entries.length - endIdx} more below`));
    }

    lines.push('');
    lines.push(pc.dim('  Use arrow keys to navigate, Enter to select, Backspace to go up'));

    return lines.join('\n');
  },
);
