#!/usr/bin/env node
// Kiro hook: .kiro/hooks/hook-smoke.json (SessionStart and PostFileSave).
// Appends one timestamped line per event to reports/raw/hook-smoke.log so the
// author can check whether hooks fire when T3 Code drives kiro-cli over ACP.
// reports/raw/ is gitignored; the log lives outside .kiro on purpose so no
// .gitignore line ever needs to mention .kiro.
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseEvent, savedFilePath } from './lib.mjs';
import { readStdin, repoRoot } from './io.mjs';

const event = parseEvent(await readStdin());
const cwd = typeof event.cwd === 'string' ? event.cwd : process.cwd();
const root = repoRoot(cwd);
const name = typeof event.hook_event_name === 'string' ? event.hook_event_name : 'unknown-event';
const file = savedFilePath(process.argv.slice(2), event);
const line = `${new Date().toISOString()} ${name}${file ? ` ${file}` : ''}\n`;

const dir = path.join(root, 'reports', 'raw');
mkdirSync(dir, { recursive: true });
appendFileSync(path.join(dir, 'hook-smoke.log'), line);
process.stdout.write(`hook-smoke: logged ${name} to reports/raw/hook-smoke.log\n`);
