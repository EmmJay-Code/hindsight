/** Core domain types for Hindsight. */

export const CATEGORIES = [
  'Work',
  'Money',
  'Health',
  'Relationships',
  'Tech',
  'World',
  'Personal',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Resolution = 'pending' | 'correct' | 'incorrect';

export interface Prediction {
  id: string;
  title: string;
  details: string;
  /** Why you believe this — written before the outcome is known. */
  rationale: string;
  /** What evidence would change your mind. */
  disconfirm: string;
  category: Category;
  /** Stated probability (1–99) that the event WILL happen. */
  confidence: number;
  status: Resolution;
  createdAt: string; // ISO timestamp
  /** Date (YYYY-MM-DD) by which you expect to know the outcome. */
  resolveBy: string | null;
  resolvedAt: string | null; // ISO timestamp
  resolutionNote: string;
  tags: string[];
}

export interface PersistedState {
  version: 1;
  predictions: Prediction[];
}

export type SortKey = 'newest' | 'oldest' | 'confidence' | 'due';
export type StatusFilter = 'all' | Resolution;
export type CategoryFilter = 'all' | Category;

export interface JournalFilters {
  query: string;
  status: StatusFilter;
  category: CategoryFilter;
  sort: SortKey;
}
