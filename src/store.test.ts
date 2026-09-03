import { describe, expect, it, beforeEach } from 'vitest';
import { Store, normalizePrediction, parseImport, STORAGE_KEY } from './store.ts';
import { buildSeed } from './seed.ts';

function memStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe('Store CRUD', () => {
  let storage: Storage;
  let store: Store;
  beforeEach(() => {
    storage = memStorage();
    store = new Store(storage);
  });

  it('starts empty and persists creates', () => {
    expect(store.all()).toHaveLength(0);
    const created = store.create({
      title: 'Test will pass',
      details: '',
      rationale: '',
      disconfirm: '',
      category: 'Work',
      confidence: 70,
      resolveBy: null,
      tags: [],
    });
    expect(store.all()).toHaveLength(1);
    expect(created.status).toBe('pending');
    // new instance over same storage reloads
    expect(new Store(storage).all()).toHaveLength(1);
    expect(storage.getItem(STORAGE_KEY)).toContain('Test will pass');
  });

  it('clamps confidence and trims titles', () => {
    const created = store.create({
      title: '  x  ',
      details: '',
      rationale: '',
      disconfirm: '',
      category: 'Other',
      confidence: 140,
      resolveBy: null,
      tags: [],
    });
    expect(created.confidence).toBe(99);
    expect(created.title).toBe('x');
  });

  it('resolves, reopens, updates, removes', () => {
    const created = store.create({
      title: 'Resolve me',
      details: '',
      rationale: '',
      disconfirm: '',
      category: 'Tech',
      confidence: 60,
      resolveBy: null,
      tags: [],
    });
    store.resolve(created.id, true, 'shipped');
    expect(store.all()[0]?.status).toBe('correct');
    store.reopen(created.id);
    expect(store.all()[0]?.status).toBe('pending');
    store.update(created.id, { confidence: 55 });
    expect(store.all()[0]?.confidence).toBe(55);
    expect(store.remove(created.id)).toBe(true);
    expect(store.all()).toHaveLength(0);
    expect(store.remove('nope')).toBe(false);
  });

  it('merges imports without duplicating ids', () => {
    const seed = buildSeed();
    expect(store.importMany(seed, 'merge')).toBe(seed.length);
    expect(store.importMany(seed, 'merge')).toBe(0);
    expect(store.all()).toHaveLength(seed.length);
    const replacement = [seed[0]!];
    expect(store.importMany(replacement, 'replace')).toBe(1);
    expect(store.all()).toHaveLength(1);
  });

  it('notifies subscribers', () => {
    let calls = 0;
    const unsub = store.subscribe(() => {
      calls += 1;
    });
    store.create({
      title: 'sub',
      details: '',
      rationale: '',
      disconfirm: '',
      category: 'Work',
      confidence: 50,
      resolveBy: null,
      tags: [],
    });
    expect(calls).toBe(1);
    unsub();
    store.clear();
    expect(calls).toBe(1);
  });
});

describe('normalize + import validation', () => {
  it('rejects garbage, repairs the repairable', () => {
    expect(normalizePrediction(null)).toBeNull();
    expect(normalizePrediction({ title: '   ' })).toBeNull();
    const fixed = normalizePrediction({ id: 'a', title: ' ok ', confidence: 500, status: 'bogus' });
    expect(fixed?.confidence).toBe(99);
    expect(fixed?.status).toBe('pending');
    expect(fixed?.category).toBe('Other');
  });

  it('parses both bare arrays and {predictions} envelopes', () => {
    const seed = buildSeed();
    const bare = parseImport(JSON.stringify(seed.slice(0, 2)));
    expect(bare.ok && bare.predictions.length).toBe(2);
    const env = parseImport(JSON.stringify({ version: 1, predictions: seed.slice(0, 3) }));
    expect(env.ok && env.predictions.length).toBe(3);
    expect(parseImport('not json').ok).toBe(false);
    expect(parseImport('{"predictions": []}').ok).toBe(false);
  });
});

describe('seed data', () => {
  it('builds a usable demo journal', () => {
    const seed = buildSeed();
    expect(seed.length).toBeGreaterThanOrEqual(10);
    expect(seed.some((s) => s.status === 'pending')).toBe(true);
    expect(seed.some((s) => s.status === 'correct')).toBe(true);
    expect(seed.some((s) => s.status === 'incorrect')).toBe(true);
    expect(new Set(seed.map((s) => s.id)).size).toBe(seed.length);
  });
});
