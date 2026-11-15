import { describe, expect, it } from 'vitest';
import { DUE, makeItem } from '../domain/test-items.ts';
import { validateBackup, type Backup } from './backup.ts';

function backup(overrides: Partial<Record<keyof Backup, unknown>> = {}): Record<string, unknown> {
  return {
    format: 'deadline-graveyard-backup',
    version: 1,
    exportedAt: DUE,
    items: [makeItem({ id: 'a' }), makeItem({ id: 'b', resolution: { kind: 'buried', at: DUE }, epitaph: 'Learned a lot.' })],
    settings: [{ key: 'motion', value: 'reduced' }],
    ...overrides,
  };
}

function withItem(patch: Record<string, unknown>, remove: string[] = []): Record<string, unknown> {
  const item: Record<string, unknown> = { ...makeItem({ id: 'c' }), ...patch };
  for (const key of remove) delete item[key];
  return backup({ items: [makeItem({ id: 'a' }), item] });
}

const failsAt = (data: unknown) => {
  const result = validateBackup(data);
  return result.ok ? null : result.error.path;
};

// Validates: deadline-engine R5.4 (the import file is a trust boundary)
describe('validateBackup', () => {
  it('accepts a valid backup, as an object or as file text', () => {
    const data = backup();
    expect(validateBackup(data)).toEqual({ ok: true, value: data });
    expect(validateBackup(JSON.stringify(data))).toEqual({ ok: true, value: data });
  });

  it('rejects malformed JSON and non-object files', () => {
    expect(validateBackup('{"format":')).toEqual({ ok: false, error: { code: 'invalid-backup', path: '$', reason: 'is not valid JSON' } });
    expect(failsAt(null)).toBe('$');
    expect(failsAt([])).toBe('$');
    expect(failsAt('42')).toBe('$');
  });

  it('rejects a wrong format, version, timestamp or an unknown top-level field', () => {
    expect(failsAt(backup({ format: 'something-else' }))).toBe('format');
    expect(failsAt(backup({ version: 2 }))).toBe('version');
    expect(failsAt(backup({ exportedAt: 1.5 }))).toBe('exportedAt');
    expect(failsAt({ ...backup(), extra: true })).toBe('extra');
    expect(failsAt(backup({ items: {} }))).toBe('items');
  });

  it('names the first failing item field', () => {
    expect(failsAt(withItem({ dueAt: '2026-12-04' }))).toBe('items[1].dueAt');
    expect(failsAt(withItem({}, ['title']))).toBe('items[1].title');
    expect(failsAt(withItem({ title: '   ' }))).toBe('items[1].title');
    expect(failsAt(withItem({ zone: 'Mars/Olympus' }))).toBe('items[1].zone');
    expect(failsAt(withItem({ dateOnly: 'yes' }))).toBe('items[1].dateOnly');
    expect(failsAt(withItem({ resolution: { kind: 'lost', at: DUE } }))).toBe('items[1].resolution.kind');
    expect(failsAt(withItem({ resolution: { kind: 'submitted' } }))).toBe('items[1].resolution.at');
    expect(failsAt(withItem({ epitaph: 'x'.repeat(281) }))).toBe('items[1].epitaph');
    expect(failsAt(withItem({ isAdmin: true }))).toBe('items[1].isAdmin');
    expect(failsAt(withItem({ id: 'a' }))).toBe('items[1].id');
  });

  it('rejects URLs that are not http or https', () => {
    expect(failsAt(withItem({ url: 'javascript:alert(1)' }))).toBe('items[1].url');
    expect(failsAt(withItem({ url: 'data:text/html,<b>x</b>' }))).toBe('items[1].url');
    expect(failsAt(withItem({ url: 'not a url' }))).toBe('items[1].url');
    expect(failsAt(withItem({ url: 'https://kiroween.devpost.com/' }))).toBeNull();
  });

  it('validates settings as unique keys with JSON values', () => {
    expect(failsAt(backup({ settings: [{ key: 'a', value: 1 }, { key: 'a', value: 2 }] }))).toBe('settings[1].key');
    expect(failsAt(backup({ settings: [{ key: 'a' }] }))).toBe('settings[0].value');
    expect(failsAt(backup({ settings: [{ key: 'a', value: Number.NaN }] }))).toBe('settings[0].value');
    let deep: unknown = 1;
    for (let i = 0; i < 12; i += 1) deep = [deep];
    expect(failsAt(backup({ settings: [{ key: 'a', value: deep }] }))).toMatch(/^settings\[0\]\.value/);
  });

  it('keeps a __proto__ key in a setting as plain data', () => {
    const result = validateBackup(`{"format":"deadline-graveyard-backup","version":1,"exportedAt":0,"items":[],"settings":[{"key":"k","value":{"__proto__":{"polluted":true}}}]}`);
    expect(result.ok).toBe(true);
    const value = result.ok ? (result.value.settings[0]?.value as Record<string, unknown>) : {};
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Object.keys(value)).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
