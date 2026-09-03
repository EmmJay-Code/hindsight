/** Small pure utilities: ids, dates, CSV. */

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function todayISODate(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

export function formatDate(isoDate: string | null): string {
  if (!isoDate) return 'No due date';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Days from today until the given YYYY-MM-DD date (negative = overdue). Null-safe. */
export function daysUntil(dateISO: string | null, now = new Date()): number | null {
  if (!dateISO) return null;
  const [y, m, d] = dateISO.split('-').map(Number);
  const target = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
}

export function dueLabel(dateISO: string | null, now = new Date()): string {
  const n = daysUntil(dateISO, now);
  if (n === null) return 'No due date';
  if (n < 0) return n === -1 ? 'Overdue by 1 day' : `Overdue by ${-n} days`;
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  return `Due in ${n} days`;
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, ''))
    .filter(Boolean)
    .slice(0, 12);
}

export function toCSV(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] as Record<string, string | number>);
  const cell = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h] ?? '')).join(','))].join('\n');
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
