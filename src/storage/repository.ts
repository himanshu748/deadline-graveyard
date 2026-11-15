// Offline-first persistence (deadline-engine R5.1 to R5.6). IndexedDB through `idb`, with an
// in-memory fallback when IndexedDB is missing or refuses to open (private mode, disabled).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EpochMs, Item, Result } from '../domain/types.ts';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  validateBackup,
  type Backup,
  type BackupError,
  type JsonValue,
  type Setting,
} from './backup.ts';

export const DB_NAME = 'deadline-graveyard';
export const DB_VERSION = 1;

interface GraveyardDB extends DBSchema {
  items: { key: string; value: Item; indexes: { dueAt: number } };
  settings: { key: string; value: Setting };
}

export interface Repository {
  /** Every item, ordered by id. */
  list(): Promise<Item[]>;
  /** Resolves only after the write is committed (R5.1). */
  put(item: Item): Promise<void>;
  remove(id: string): Promise<void>;
  getSetting(key: string): Promise<JsonValue | undefined>;
  putSetting(key: string, value: JsonValue): Promise<void>;
  /** R5.3: every item and setting, ordered by id and key so equal data gives equal files. */
  exportBackup(now: EpochMs): Promise<Backup>;
  /**
   * R5.4, R5.5: validates the whole file first, then replaces all items and settings in one
   * transaction. On a validation error nothing is written. Resolves to the number of items.
   */
  importBackup(data: unknown): Promise<Result<number, BackupError>>;
}

const byId = (a: Item, b: Item) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byKey = (a: Setting, b: Setting) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

function backupOf(items: Item[], settings: Setting[], now: EpochMs): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    items: [...items].sort(byId),
    settings: [...settings].sort(byKey),
  };
}

function idbRepository(db: IDBPDatabase<GraveyardDB>): Repository {
  return {
    async list() {
      return (await db.getAll('items')).sort(byId);
    },
    async put(item) {
      const tx = db.transaction('items', 'readwrite');
      await Promise.all([tx.store.put(item), tx.done]);
    },
    async remove(id) {
      const tx = db.transaction('items', 'readwrite');
      await Promise.all([tx.store.delete(id), tx.done]);
    },
    async getSetting(key) {
      return (await db.get('settings', key))?.value;
    },
    async putSetting(key, value) {
      const tx = db.transaction('settings', 'readwrite');
      await Promise.all([tx.store.put({ key, value }), tx.done]);
    },
    async exportBackup(now) {
      const tx = db.transaction(['items', 'settings'], 'readonly');
      const [items, settings] = await Promise.all([
        tx.objectStore('items').getAll(),
        tx.objectStore('settings').getAll(),
        tx.done,
      ]);
      return backupOf(items, settings, now);
    },
    async importBackup(data) {
      const checked = validateBackup(data);
      if (!checked.ok) return checked;
      const { items, settings } = checked.value;
      const tx = db.transaction(['items', 'settings'], 'readwrite');
      const itemStore = tx.objectStore('items');
      const settingStore = tx.objectStore('settings');
      await Promise.all([
        itemStore.clear(),
        settingStore.clear(),
        ...items.map((i) => itemStore.put(i)),
        ...settings.map((s) => settingStore.put(s)),
        tx.done,
      ]);
      return { ok: true, value: items.length };
    },
  };
}

/** Same contract as the IndexedDB repository, kept in memory for this tab only (R5.6). */
export function memoryRepository(): Repository {
  const items = new Map<string, Item>();
  const settings = new Map<string, Setting>();
  return {
    async list() {
      return [...items.values()].map((i) => structuredClone(i)).sort(byId);
    },
    async put(item) {
      items.set(item.id, structuredClone(item));
    },
    async remove(id) {
      items.delete(id);
    },
    async getSetting(key) {
      const found = settings.get(key);
      return found === undefined ? undefined : structuredClone(found.value);
    },
    async putSetting(key, value) {
      settings.set(key, structuredClone({ key, value }));
    },
    async exportBackup(now) {
      return structuredClone(backupOf([...items.values()], [...settings.values()], now));
    },
    async importBackup(data) {
      const checked = validateBackup(data);
      if (!checked.ok) return checked;
      items.clear();
      settings.clear();
      for (const i of checked.value.items) items.set(i.id, i);
      for (const s of checked.value.settings) settings.set(s.key, s);
      return { ok: true, value: checked.value.items.length };
    },
  };
}

/**
 * Opens the IndexedDB database, creating the `items` (keyPath `id`, index `dueAt`) and
 * `settings` (keyPath `key`) stores on first run. Falls back to memory with
 * `persistent: false` so the UI can warn that data will not be kept (R5.6).
 */
export async function openRepository(name: string = DB_NAME): Promise<{ repo: Repository; persistent: boolean }> {
  if (typeof indexedDB === 'undefined') return { repo: memoryRepository(), persistent: false };
  try {
    const db = await openDB<GraveyardDB>(name, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const items = database.createObjectStore('items', { keyPath: 'id' });
          items.createIndex('dueAt', 'dueAt');
          database.createObjectStore('settings', { keyPath: 'key' });
        }
      },
      // Another tab is upgrading the schema: let it, this tab reloads on next start.
      blocking() {
        db.close();
      },
    });
    return { repo: idbRepository(db), persistent: true };
  } catch {
    return { repo: memoryRepository(), persistent: false };
  }
}
