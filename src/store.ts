import type { Category, PersistedState, Prediction } from './types.ts';
import { uid } from './utils.ts';

export const STORAGE_KEY = 'hindsight.v1';

/** Separate key tracking whether the user is currently viewing the built-in sample dataset. */
export const SAMPLE_FLAG_KEY = 'hindsight.sample';

/** Built-in sample predictions use ids with this prefix (see seed.ts). */
export const SAMPLE_ID_PREFIX = 'seed-';

export function isSamplePrediction(p: Prediction): boolean {
  return p.id.startsWith(SAMPLE_ID_PREFIX);
}

export type Listener = (predictions: Prediction[]) => void;

function isCategory(x: unknown): x is Category {
  return typeof x === 'string' && (
    x === 'Work' || x === 'Money' || x === 'Health' || x === 'Relationships' ||
    x === 'Tech' || x === 'World' || x === 'Personal' || x === 'Other'
  );
}

/** Validate + normalize an unknown object into a Prediction. Returns null if unusable. */
export function normalizePrediction(raw: unknown): Prediction | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r['id'] !== 'string' || typeof r['title'] !== 'string') return null;
  const title = r['title'].trim();
  if (!title) return null;
  const confidence = Number(r['confidence']);
  const status = r['status'];
  const createdAt = typeof r['createdAt'] === 'string' ? r['createdAt'] : new Date().toISOString();
  return {
    id: r['id'],
    title: title.slice(0, 160),
    details: typeof r['details'] === 'string' ? r['details'].slice(0, 4000) : '',
    rationale: typeof r['rationale'] === 'string' ? r['rationale'].slice(0, 4000) : '',
    disconfirm: typeof r['disconfirm'] === 'string' ? r['disconfirm'].slice(0, 2000) : '',
    category: isCategory(r['category']) ? r['category'] : 'Other',
    confidence: Number.isFinite(confidence) ? Math.min(99, Math.max(1, Math.round(confidence))) : 70,
    status: status === 'correct' || status === 'incorrect' ? status : 'pending',
    createdAt,
    resolveBy: typeof r['resolveBy'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r['resolveBy']) ? r['resolveBy'] : null,
    resolvedAt: typeof r['resolvedAt'] === 'string' ? r['resolvedAt'] : null,
    resolutionNote: typeof r['resolutionNote'] === 'string' ? r['resolutionNote'].slice(0, 4000) : '',
    tags: Array.isArray(r['tags']) ? r['tags'].filter((t): t is string => typeof t === 'string').slice(0, 12) : [],
  };
}

export function parseImport(json: string): { ok: true; predictions: Prediction[] } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  const list = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray((data as Record<string, unknown>)['predictions'])
      ? (data as Record<string, unknown>)['predictions']
      : null;
  if (!Array.isArray(list)) return { ok: false, error: 'No predictions array found in that file.' };
  const out: Prediction[] = [];
  for (const item of list) {
    const p = normalizePrediction(item);
    if (p) out.push(p);
  }
  if (out.length === 0) return { ok: false, error: 'No valid predictions found in that file.' };
  return { ok: true, predictions: out };
}

export interface NewPredictionInput {
  title: string;
  details: string;
  rationale: string;
  disconfirm: string;
  category: Category;
  confidence: number;
  resolveBy: string | null;
  tags: string[];
}

export class Store {
  private predictions: Prediction[] = [];
  private listeners = new Set<Listener>();
  private storage: Storage | null;
  private sampleActive = false;

  constructor(storage: Storage | null = defaultStorage()) {
    this.storage = storage;
    this.predictions = this.load();
    this.sampleActive = this.loadSampleFlag();
    this.syncSampleFlag();
  }

  all(): Prediction[] {
    return [...this.predictions];
  }

  /**
   * True while the loaded dataset IS the built-in sample dataset:
   * sample mode was entered via load-seed/importSeed and every prediction
   * is a sample one. As soon as the user adds their own prediction
   * (or the sample is cleared), this flips to false.
   */
  isSampleDataset(): boolean {
    return (
      this.sampleActive &&
      this.predictions.length > 0 &&
      this.predictions.every(isSamplePrediction)
    );
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.all());
  }

  private persist(): void {
    try {
      const state: PersistedState = { version: 1, predictions: this.predictions };
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or unavailable — app keeps working in memory
    }
    this.emit();
  }

  private persistSampleFlag(): void {
    try {
      if (this.sampleActive) this.storage?.setItem(SAMPLE_FLAG_KEY, '1');
      else this.storage?.removeItem(SAMPLE_FLAG_KEY);
    } catch {
      // storage unavailable — app keeps working in memory
    }
  }

  private loadSampleFlag(): boolean {
    try {
      return this.storage?.getItem(SAMPLE_FLAG_KEY) === '1';
    } catch {
      return false;
    }
  }

  /** Drop the sample flag when no sample predictions remain (e.g. deleted one by one). */
  private syncSampleFlag(): void {
    if (this.sampleActive && !this.predictions.some(isSamplePrediction)) {
      this.sampleActive = false;
      this.persistSampleFlag();
    }
  }

  private load(): Prediction[] {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw) as PersistedState;
      const list = Array.isArray(data.predictions) ? data.predictions : [];
      const out: Prediction[] = [];
      for (const item of list) {
        const p = normalizePrediction(item);
        if (p) out.push(p);
      }
      return out;
    } catch {
      return [];
    }
  }

  create(input: NewPredictionInput): Prediction {
    const now = new Date().toISOString();
    const p: Prediction = {
      id: uid(),
      title: input.title.trim().slice(0, 160),
      details: input.details.trim().slice(0, 4000),
      rationale: input.rationale.trim().slice(0, 4000),
      disconfirm: input.disconfirm.trim().slice(0, 2000),
      category: input.category,
      confidence: Math.min(99, Math.max(1, Math.round(input.confidence))),
      status: 'pending',
      createdAt: now,
      resolveBy: input.resolveBy,
      resolvedAt: null,
      resolutionNote: '',
      tags: input.tags,
    };
    this.predictions = [p, ...this.predictions];
    this.persist();
    return p;
  }

  update(id: string, patch: Partial<NewPredictionInput>): Prediction | null {
    const i = this.predictions.findIndex((p) => p.id === id);
    if (i === -1) return null;
    const prev = this.predictions[i] as Prediction;
    const next: Prediction = {
      ...prev,
      title: patch.title !== undefined ? patch.title.trim().slice(0, 160) || prev.title : prev.title,
      details: patch.details !== undefined ? patch.details.trim().slice(0, 4000) : prev.details,
      rationale: patch.rationale !== undefined ? patch.rationale.trim().slice(0, 4000) : prev.rationale,
      disconfirm: patch.disconfirm !== undefined ? patch.disconfirm.trim().slice(0, 2000) : prev.disconfirm,
      category: patch.category ?? prev.category,
      confidence:
        patch.confidence !== undefined
          ? Math.min(99, Math.max(1, Math.round(patch.confidence)))
          : prev.confidence,
      resolveBy: patch.resolveBy !== undefined ? patch.resolveBy : prev.resolveBy,
      tags: patch.tags ?? prev.tags,
    };
    this.predictions = [...this.predictions.slice(0, i), next, ...this.predictions.slice(i + 1)];
    this.persist();
    return next;
  }

  resolve(id: string, happened: boolean, note: string): Prediction | null {
    const i = this.predictions.findIndex((p) => p.id === id);
    if (i === -1) return null;
    const prev = this.predictions[i] as Prediction;
    const next: Prediction = {
      ...prev,
      status: happened ? 'correct' : 'incorrect',
      resolvedAt: new Date().toISOString(),
      resolutionNote: note.trim().slice(0, 4000),
    };
    this.predictions = [...this.predictions.slice(0, i), next, ...this.predictions.slice(i + 1)];
    this.persist();
    return next;
  }

  reopen(id: string): Prediction | null {
    const i = this.predictions.findIndex((p) => p.id === id);
    if (i === -1) return null;
    const prev = this.predictions[i] as Prediction;
    const next: Prediction = { ...prev, status: 'pending', resolvedAt: null };
    this.predictions = [...this.predictions.slice(0, i), next, ...this.predictions.slice(i + 1)];
    this.persist();
    return next;
  }

  remove(id: string): boolean {
    const before = this.predictions.length;
    this.predictions = this.predictions.filter((p) => p.id !== id);
    if (this.predictions.length !== before) {
      this.syncSampleFlag();
      this.persist();
      return true;
    }
    return false;
  }

  /** Merge imported predictions (dedupe by id). Returns count added. */
  importMany(list: Prediction[], mode: 'merge' | 'replace'): number {
    if (mode === 'replace') {
      this.predictions = [...list];
      this.syncSampleFlag();
      this.persist();
      return list.length;
    }
    const existing = new Set(this.predictions.map((p) => p.id));
    const fresh = list.filter((p) => !existing.has(p.id));
    this.predictions = [...fresh, ...this.predictions];
    this.persist();
    return fresh.length;
  }

  /**
   * Load the built-in sample dataset (merge, deduped). Enters sample mode:
   * the app shows a "Viewing sample data" banner until the user exits it.
   * Returns count added.
   */
  importSeed(list: Prediction[]): number {
    this.sampleActive = true;
    this.persistSampleFlag();
    return this.importMany(list, 'merge');
  }

  /**
   * Exit sample mode: remove ONLY the built-in sample predictions,
   * never user-created ones. Returns count removed.
   */
  removeSampleData(): number {
    const before = this.predictions.length;
    this.predictions = this.predictions.filter((p) => !isSamplePrediction(p));
    this.sampleActive = false;
    this.persistSampleFlag();
    const removed = before - this.predictions.length;
    this.persist();
    return removed;
  }

  clear(): void {
    this.predictions = [];
    this.sampleActive = false;
    this.persistSampleFlag();
    this.persist();
  }
}

function defaultStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
    return null;
  } catch {
    return null;
  }
}
