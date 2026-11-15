// Backup file format and its schema check. An imported file is untrusted input, so it is
// validated field by field and rejected as a whole on the first failure (deadline-engine
// R5.3 to R5.5). Hand-written on purpose: no schema library dependency.
import { EPITAPH_MAX_LENGTH } from '../domain/actions.ts';
import { isValidZone } from '../domain/time.ts';
import type { EpochMs, Item, Resolution, Result } from '../domain/types.ts';

export const BACKUP_FORMAT = 'deadline-graveyard-backup';
export const BACKUP_VERSION = 1;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface Setting {
  key: string;
  value: JsonValue;
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: EpochMs;
  items: Item[];
  settings: Setting[];
}

export interface BackupError {
  code: 'invalid-backup';
  /** First failing field, for example `items[3].dueAt`. `$` is the whole file. */
  path: string;
  reason: string;
}

export const LIMITS = {
  items: 10_000,
  settings: 200,
  id: 100,
  title: 300,
  url: 2_048,
  notes: 10_000,
  settingKey: 100,
  jsonDepth: 10,
} as const;

const BACKUP_KEYS = new Set(['format', 'version', 'exportedAt', 'items', 'settings']);
const ITEM_KEYS = new Set([
  'id', 'title', 'url', 'dueAt', 'zone', 'dateOnly', 'createdAt', 'lastActivityAt', 'resolution', 'epitaph', 'notes', 'demo',
]);

class Invalid extends Error {
  constructor(
    readonly path: string,
    readonly reason: string,
  ) {
    super(`${path}: ${reason}`);
  }
}

type Obj = Record<string, unknown>;

function isPlainObject(value: unknown): value is Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function object(value: unknown, path: string, allowed: Set<string>): Obj {
  if (!isPlainObject(value)) throw new Invalid(path, 'must be an object');
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Invalid(path === '$' ? key : `${path}.${key}`, 'is not a known field');
  }
  return value;
}

function string(value: unknown, path: string, max: number, opts: { nonBlank?: boolean } = {}): string {
  if (typeof value !== 'string') throw new Invalid(path, 'must be a string');
  if (value.length > max) throw new Invalid(path, `must be at most ${max} characters`);
  if (opts.nonBlank === true && value.trim().length === 0) throw new Invalid(path, 'must not be empty');
  return value;
}

function instant(value: unknown, path: string): EpochMs {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Invalid(path, 'must be an integer of epoch milliseconds');
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Invalid(path, 'must be true or false');
  return value;
}

function webUrl(value: unknown, path: string): string {
  const text = string(value, path, LIMITS.url);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Invalid(path, 'must be an absolute URL');
  }
  // Blocks javascript:, data: and similar schemes before the URL can reach a link.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Invalid(path, 'must be an http or https URL');
  return text;
}

function resolution(value: unknown, path: string): Resolution | null {
  if (value === null) return null;
  const r = object(value, path, new Set(['kind', 'at']));
  if (r.kind !== 'submitted' && r.kind !== 'buried') throw new Invalid(`${path}.kind`, 'must be "submitted" or "buried"');
  return { kind: r.kind, at: instant(r.at, `${path}.at`) };
}

function item(value: unknown, path: string): Item {
  const raw = object(value, path, ITEM_KEYS);
  const zone = string(raw.zone, `${path}.zone`, 64);
  if (!isValidZone(zone)) throw new Invalid(`${path}.zone`, 'must be an IANA time zone');
  const result: Item = {
    id: string(raw.id, `${path}.id`, LIMITS.id, { nonBlank: true }),
    title: string(raw.title, `${path}.title`, LIMITS.title, { nonBlank: true }),
    dueAt: instant(raw.dueAt, `${path}.dueAt`),
    zone,
    dateOnly: boolean(raw.dateOnly, `${path}.dateOnly`),
    createdAt: instant(raw.createdAt, `${path}.createdAt`),
    lastActivityAt: instant(raw.lastActivityAt, `${path}.lastActivityAt`),
    resolution: resolution(raw.resolution, `${path}.resolution`),
    demo: boolean(raw.demo, `${path}.demo`),
  };
  if ('url' in raw) result.url = webUrl(raw.url, `${path}.url`);
  if ('epitaph' in raw) result.epitaph = string(raw.epitaph, `${path}.epitaph`, EPITAPH_MAX_LENGTH);
  if ('notes' in raw) result.notes = string(raw.notes, `${path}.notes`, LIMITS.notes);
  return result;
}

function json(value: unknown, path: string, depth: number): JsonValue {
  if (depth > LIMITS.jsonDepth) throw new Invalid(path, `nests deeper than ${LIMITS.jsonDepth} levels`);
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Invalid(path, 'must be a finite number');
    return value;
  }
  if (Array.isArray(value)) return value.map((v, i) => json(v, `${path}[${i}]`, depth + 1));
  if (isPlainObject(value)) {
    const out: { [key: string]: JsonValue } = {};
    for (const [k, v] of Object.entries(value)) {
      Object.defineProperty(out, k, { value: json(v, `${path}.${k}`, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    return out;
  }
  throw new Invalid(path, 'must be a JSON value');
}

function list<T>(value: unknown, path: string, max: number, each: (v: unknown, p: string) => T): T[] {
  if (!Array.isArray(value)) throw new Invalid(path, 'must be an array');
  if (value.length > max) throw new Invalid(path, `must have at most ${max} entries`);
  return value.map((v, i) => each(v, `${path}[${i}]`));
}

function unique<T>(entries: T[], keyOf: (t: T) => string, path: string, field: string): void {
  const seen = new Set<string>();
  entries.forEach((entry, i) => {
    const key = keyOf(entry);
    if (seen.has(key)) throw new Invalid(`${path}[${i}].${field}`, `duplicates "${key}"`);
    seen.add(key);
  });
}

/**
 * Checks an untrusted backup: the file text or an already parsed value. Returns a clean copy
 * that contains only known fields, or the first failing path.
 */
export function validateBackup(data: unknown): Result<Backup, BackupError> {
  try {
    let value = data;
    if (typeof data === 'string') {
      try {
        value = JSON.parse(data) as unknown;
      } catch {
        throw new Invalid('$', 'is not valid JSON');
      }
    }
    const raw = object(value, '$', BACKUP_KEYS);
    if (raw.format !== BACKUP_FORMAT) throw new Invalid('format', `must be "${BACKUP_FORMAT}"`);
    if (raw.version !== BACKUP_VERSION) throw new Invalid('version', `must be ${BACKUP_VERSION}`);
    const items = list(raw.items, 'items', LIMITS.items, item);
    unique(items, (i) => i.id, 'items', 'id');
    const settings = list(raw.settings, 'settings', LIMITS.settings, (v, p) => {
      const s = object(v, p, new Set(['key', 'value']));
      if (!('value' in s)) throw new Invalid(`${p}.value`, 'is required');
      return { key: string(s.key, `${p}.key`, LIMITS.settingKey, { nonBlank: true }), value: json(s.value, `${p}.value`, 1) };
    });
    unique(settings, (s) => s.key, 'settings', 'key');
    return {
      ok: true,
      value: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: instant(raw.exportedAt, 'exportedAt'), items, settings },
    };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: { code: 'invalid-backup', path: error.path, reason: error.reason } };
    throw error;
  }
}

/** The text written to a backup file. */
export function serializeBackup(backup: Backup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}
