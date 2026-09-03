import type { JournalFilters, Prediction } from './types.ts';
import { CATEGORIES } from './types.ts';
import type { Store } from './store.ts';
import { parseImport } from './store.ts';
import {
  brierScore,
  brierVerdict,
  calibrationBuckets,
  brierTrend,
  formatPercent,
  overallStats,
} from './scoring.ts';
import { calibrationChartSVG, confidenceMeter, trendChartSVG } from './charts.ts';
import { buildSeed } from './seed.ts';
import {
  addDaysISO,
  daysUntil,
  downloadFile,
  dueLabel,
  escapeHtml,
  formatDate,
  formatDateTime,
  parseTags,
  toCSV,
  todayISODate,
} from './utils.ts';

type View = 'dashboard' | 'journal' | 'about';

const THEME_KEY = 'hindsight.theme';

export function createApp(store: Store, root: HTMLElement): void {
  let view: View = 'dashboard';
  let filters: JournalFilters = { query: '', status: 'all', category: 'all', sort: 'newest' };

  const shell = document.createElement('div');
  shell.className = 'shell';
  shell.innerHTML = `
    <a class="skip" href="#view">Skip to content</a>
    <header class="topbar">
      <div class="wrap topbar-inner">
        <button class="brand" data-action="go" data-view="dashboard" aria-label="Hindsight home">
          <span class="brand-mark" aria-hidden="true">${eyeSVG()}</span>
          <span class="brand-text">Hindsight</span>
        </button>
        <nav class="tabs" aria-label="Primary">
          <button class="tab" data-action="go" data-view="dashboard" aria-current="page">Dashboard</button>
          <button class="tab" data-action="go" data-view="journal">Journal <span class="count" id="pending-count" hidden></span></button>
          <button class="tab" data-action="go" data-view="about">How scoring works</button>
        </nav>
        <div class="top-actions">
          <button class="btn ghost icon-btn" data-action="toggle-theme" aria-label="Toggle color theme" title="Toggle theme">${themeSVG()}</button>
          <button class="btn ghost" data-action="open-data" aria-haspopup="menu">Data</button>
          <button class="btn primary" data-action="new">+ New prediction</button>
        </div>
      </div>
    </header>
    <div id="sample-banner" class="sample-banner" hidden>
      <div class="wrap sample-banner-inner">
        <span role="status"><strong>Viewing sample data</strong> <span class="sample-note">— these are example predictions so you can explore scoring.</span></span>
        <button class="btn xs" data-action="start-fresh">Start with my own data</button>
      </div>
    </div>
    <main id="view" class="wrap" tabindex="-1"></main>    <footer class="wrap footer">
      <span><strong>Hindsight</strong> · your predictions never leave this browser</span>
      <span class="footer-right"><button class="linklike" data-action="open-data">Export</button> · <button class="linklike" data-action="go" data-view="about">Methodology</button> · v1.0</span>
    </footer>
    <dialog id="modal" class="modal" aria-labelledby="modal-title"></dialog>
    <div id="toasts" class="toasts" aria-live="polite"></div>
    <input type="file" id="import-file" accept="application/json,.json" hidden />
  `;
  root.appendChild(shell);

  const viewEl = shell.querySelector<HTMLElement>('#view') as HTMLElement;
  const modal = shell.querySelector<HTMLDialogElement>('#modal') as HTMLDialogElement;
  const toasts = shell.querySelector<HTMLDivElement>('#toasts') as HTMLDivElement;
  const fileInput = shell.querySelector<HTMLInputElement>('#import-file') as HTMLInputElement;

  initTheme(shell);

  function toast(msg: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    toasts.appendChild(el);
    setTimeout(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  function closeModal(): void {
    if (modal.open) modal.close();
  }

  function openModal(html: string): void {
    modal.innerHTML = html;
    if (!modal.open) modal.showModal();
    const first = modal.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
  }

  modal.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === modal || t.closest('[data-action="close-modal"]')) closeModal();
  });

  function setView(v: View): void {
    view = v;
    shell.querySelectorAll('.tab').forEach((tab) => {
      const el = tab as HTMLButtonElement;
      if (el.dataset['view'] === v) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    render();
    viewEl.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  function render(): void {
    const all = store.all();
    const pending = all.filter((p) => p.status === 'pending').length;
    const badge = shell.querySelector('#pending-count') as HTMLElement;
    badge.hidden = pending === 0;
    badge.textContent = String(pending);
    const banner = shell.querySelector('#sample-banner') as HTMLElement;
    banner.hidden = !store.isSampleDataset();
    // mark active tab for icon-buttons that navigate (brand)
    if (view === 'dashboard') viewEl.innerHTML = dashboardHTML(all);
    else if (view === 'journal') viewEl.innerHTML = journalHTML(all, filters);
    else viewEl.innerHTML = aboutHTML();
    // keep tab aria-current in sync
    shell.querySelectorAll('.tab').forEach((tab) => {
      const el = tab as HTMLButtonElement;
      if (el.dataset['view'] === view) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  }

  // ---------- views ----------

  function dashboardHTML(all: Prediction[]): string {
    if (all.length === 0) return onboardingHTML();
    const stats = overallStats(all);
    const resolved = all.filter((p) => p.status !== 'pending');
    if (resolved.length === 0) return noResolvedHTML(all);

    const buckets = calibrationBuckets(resolved);
    const trend = brierTrend(resolved);
    const dueSoon = pendingByDue(all).slice(0, 5);
    const recent = [...resolved]
      .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''))
      .slice(0, 5);

    const gap = stats.calibrationGap;
    const gapLabel =
      gap === null
        ? '—'
        : Math.abs(gap) < 0.03
          ? 'Well balanced'
          : gap > 0
            ? `Overconfident by ${Math.round(gap * 100)} pts`
            : `Underconfident by ${Math.round(-gap * 100)} pts`;

    return `
      <section class="hero-row">
        <div>
          <p class="kicker">Your judgment, scored</p>
          <h1>${headline(stats)}</h1>
          <p class="lede">${escapeHtml(brierVerdict(stats.meanBrier))} across ${stats.resolved} resolved prediction${stats.resolved === 1 ? '' : 's'}. ${stats.pending} still pending.</p>
        </div>
        <div class="hero-cta">
          <button class="btn primary" data-action="new">Log a prediction</button>
          <button class="btn ghost" data-action="go" data-view="journal">Review journal</button>
        </div>
      </section>
      <section class="cards" aria-label="Summary statistics">
        ${statCard('Accuracy', formatPercent(stats.accuracy), `${stats.correct} of ${stats.resolved} right`)}
        ${statCard('Avg Brier', stats.meanBrier === null ? '—' : stats.meanBrier.toFixed(3), '0 = perfect · 0.25 = coin-flip')}
        ${statCard('Calibration', gapLabel, 'confidence vs. reality')}
        ${statCard('Streak', stats.currentStreak === 0 ? '—' : `${stats.currentStreak} 🔥`, `best: ${stats.bestStreak}`)}
      </section>
      <section class="grid-2">
        <article class="panel">
          <h2>Calibration</h2>
          <p class="hint">Bars = how often you were right when you claimed a confidence. Diamonds = your average claim. On the diagonal, you know exactly how much you know.</p>
          ${calibrationChartSVG(buckets)}
        </article>
        <article class="panel">
          <h2>Brier trend</h2>
          <p class="hint">Cumulative average Brier in resolution order. A falling line means your judgment is improving.</p>
          ${trendChartSVG(trend)}
        </article>
      </section>
      <section class="grid-2">
        <article class="panel">
          <h2>Needs attention</h2>
          ${dueSoon.length === 0 ? `<p class="hint">Nothing pending with a due date. <button class="linklike" data-action="new">Log one</button> to keep the feedback loop going.</p>` : `<ul class="mini-list">${dueSoon.map((p) => miniRow(p)).join('')}</ul>`}
        </article>
        <article class="panel">
          <h2>Recent resolutions</h2>
          <ul class="mini-list">${recent.map((p) => miniRow(p)).join('')}</ul>
        </article>
      </section>`;
  }

  function headline(stats: ReturnType<typeof overallStats>): string {
    if (stats.accuracy !== null && stats.accuracy >= 0.75 && (stats.meanBrier ?? 1) < 0.16)
      return 'You call it like you see it — and you see clearly.';
    if (stats.calibrationGap !== null && stats.calibrationGap > 0.15)
      return 'You are more confident than you are right. That is fixable.';
    if (stats.calibrationGap !== null && stats.calibrationGap < -0.1)
      return 'You are righter than you think. Trust yourself a little more.';
    return 'Every resolved prediction makes the next one sharper.';
  }

  function onboardingHTML(): string {
    return `
      <section class="onboard">
        <p class="kicker">Hindsight · a decision journal that keeps you honest</p>
        <h1>Write down what you believe. Find out if you should.</h1>
        <p class="lede">Most people are overconfident and never find out — because they never keep score. Hindsight changes that: log a prediction with a confidence, resolve it later, and get a <strong>Brier score</strong> plus a <strong>calibration chart</strong> that shows exactly where your judgment slips.</p>
        <ol class="steps">
          <li><strong>Predict.</strong> “We’ll ship by June” — 70%. Write why, and what would change your mind.</li>
          <li><strong>Resolve.</strong> When the outcome is known, mark it right or wrong in one click.</li>
          <li><strong>Calibrate.</strong> Watch your Brier score fall as your confidence starts matching reality.</li>
        </ol>
        <div class="hero-cta">
          <button class="btn primary lg" data-action="new">Make your first prediction</button>
          <button class="btn ghost lg" data-action="load-seed">Explore with sample data</button>
        </div>
        <p class="hint">Local-first: everything stays in this browser. No account, no tracking, export anytime.</p>
      </section>`;
  }

  function noResolvedHTML(all: Prediction[]): string {
    const pending = all.filter((p) => p.status === 'pending');
    return `
      <section class="hero-row">
        <div>
          <p class="kicker">The feedback loop is open</p>
          <h1>${all.length} prediction${all.length === 1 ? '' : 's'} logged. Now close the loop.</h1>
          <p class="lede">Scores appear after your first resolution. ${pending.length} awaiting an outcome — resolve one to see your Brier score and calibration.</p>
        </div>
        <div class="hero-cta">
          <button class="btn primary" data-action="go" data-view="journal">Go to journal</button>
        </div>
      </section>
      <section class="panel"><h2>Awaiting outcomes</h2><ul class="mini-list">${pendingByDue(all).slice(0, 8).map((p) => miniRow(p)).join('')}</ul></section>`;
  }

  function journalHTML(all: Prediction[], f: JournalFilters): string {
    const list = applyFilters(all, f);
    return `
      <section class="journal-head">
        <div>
          <p class="kicker">Journal</p>
          <h1>${all.length === 0 ? 'No predictions yet' : `${list.length} of ${all.length} predictions`}</h1>
        </div>
        <button class="btn primary" data-action="new">+ New prediction</button>
      </section>
      <section class="filters" aria-label="Filter predictions">
        <input type="search" id="q" class="input" placeholder="Search title, notes, tags…" value="${escapeHtml(f.query)}" aria-label="Search predictions" />
        <select id="f-status" class="input" aria-label="Filter by status">
          ${option('all', 'All statuses', f.status)}
          ${option('pending', 'Pending', f.status)}
          ${option('correct', 'Correct', f.status)}
          ${option('incorrect', 'Incorrect', f.status)}
        </select>
        <select id="f-cat" class="input" aria-label="Filter by category">
          ${option('all', 'All categories', f.category)}
          ${CATEGORIES.map((c) => option(c, c, f.category)).join('')}
        </select>
        <select id="f-sort" class="input" aria-label="Sort predictions">
          ${option('newest', 'Newest first', f.sort)}
          ${option('oldest', 'Oldest first', f.sort)}
          ${option('confidence', 'Highest confidence', f.sort)}
          ${option('due', 'Due soonest', f.sort)}
        </select>
      </section>
      ${
        all.length === 0
          ? `<section class="panel empty"><p><strong>Your journal is empty.</strong></p><p class="hint">Log your first prediction — or load sample data to see how scoring works.</p><div class="hero-cta"><button class="btn primary" data-action="new">Make your first prediction</button><button class="btn ghost" data-action="load-seed">Load sample data</button></div></section>`
          : list.length === 0
            ? `<section class="panel empty"><p><strong>Nothing matches those filters.</strong></p><button class="btn ghost" data-action="clear-filters">Clear filters</button></section>`
            : `<section class="card-list">${list.map((p) => cardHTML(p)).join('')}</section>`
      }`;
  }

  function aboutHTML(): string {
    return `
      <section class="prose">
        <p class="kicker">Methodology</p>
        <h1>How scoring works</h1>
        <p class="lede">Hindsight scores you the way professional forecasters are scored — with the <strong>Brier score</strong> and a <strong>calibration chart</strong>. No black boxes: every number in this app comes from two inputs, your stated confidence and what actually happened.</p>
        <h2>The Brier score</h2>
        <p>For one prediction: <code>(confidence − outcome)²</code>, where outcome is 1 if the event happened, 0 if not. Say 80% and you’re right: (0.8 − 1)² = <strong>0.04</strong>. Say 80% and you’re wrong: (0.8 − 0)² = <strong>0.64</strong>. Confident errors hurt — that’s the point. Your dashboard shows the mean across all resolved predictions: <strong>0 is perfect, 0.25 is coin-flip, 1 is worst possible</strong>.</p>
        <h2>Calibration</h2>
        <p>Group your predictions by confidence: of everything you said at “70%”, did ~70% happen? If yes, you’re calibrated — even if your accuracy is modest. The chart’s diagonal is perfection; bars below your diamonds mean <strong>overconfidence</strong>, the most common (and fixable) flaw.</p>
        <h2>Three habits of calibrated people</h2>
        <ol>
          <li><strong>Start from a base rate.</strong> “How often do things like this happen?” before “how do I feel about this one?”</li>
          <li><strong>Pre-commit the number.</strong> Writing 70% <em>before</em> the outcome is what makes the score honest. Editing confidence after the fact is forbidden here — resolved predictions lock.</li>
          <li><strong>Review monthly.</strong> Sort by confidence, look at your confident misses, and ask what they had in common.</li>
        </ol>
        <h2>Privacy</h2>
        <p>Everything is stored in <code>localStorage</code> in this browser. There is no server, no account, no analytics. Export JSON or CSV anytime from the <strong>Data</strong> menu; deleting the app’s site data deletes everything.</p>
      </section>`;
  }

  // ---------- pieces ----------

  function statCard(label: string, value: string, sub: string): string {
    return `<article class="stat"><p class="stat-label">${label}</p><p class="stat-value">${escapeHtml(value)}</p><p class="stat-sub">${escapeHtml(sub)}</p></article>`;
  }

  function miniRow(p: Prediction): string {
    const badge = p.status === 'pending'
      ? `<span class="pill due">${escapeHtml(dueLabel(p.resolveBy))}</span>`
      : p.status === 'correct'
        ? `<span class="pill good">✓ Correct</span>`
        : `<span class="pill bad">✗ Missed</span>`;
    return `<li class="mini-row"><div><strong>${escapeHtml(p.title)}</strong><span class="mini-meta">${p.confidence}% · ${escapeHtml(p.category)}${p.resolvedAt ? ` · resolved ${escapeHtml(formatDateTime(p.resolvedAt))}` : ''}</span></div><div class="mini-side">${badge}${p.status === 'pending' ? ` <button class="btn xs" data-action="resolve" data-id="${p.id}">Resolve</button>` : ''}</div></li>`;
  }

  function cardHTML(p: Prediction): string {
    const due = daysUntil(p.resolveBy);
    const overdue = p.status === 'pending' && due !== null && due < 0;
    const statusPill =
      p.status === 'pending'
        ? `<span class="pill due${overdue ? ' overdue' : ''}">${escapeHtml(dueLabel(p.resolveBy))}</span>`
        : p.status === 'correct'
          ? `<span class="pill good">✓ Correct${p.resolvedAt ? ` · ${escapeHtml(formatDateTime(p.resolvedAt))}` : ''}</span>`
          : `<span class="pill bad">✗ Missed${p.resolvedAt ? ` · ${escapeHtml(formatDateTime(p.resolvedAt))}` : ''}</span>`;
    const brier = p.status === 'pending'
      ? ''
      : `<span class="brier" title="Brier score for this prediction">Brier ${brierScore(p.confidence, p.status === 'correct').toFixed(2)}</span>`;
    const tags = p.tags.length > 0 ? `<span class="tags">${p.tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join(' ')}</span>` : '';
    return `
      <article class="card" data-id="${p.id}">
        <div class="card-top">
          <span class="cat">${escapeHtml(p.category)}</span>
          ${statusPill}
        </div>
        <h3>${escapeHtml(p.title)}</h3>
        <div class="conf-row">${confidenceMeter(p.confidence)}<strong>${p.confidence}%</strong>${brier}</div>
        ${p.details ? `<p class="card-text">${escapeHtml(p.details)}</p>` : ''}
        ${p.rationale ? `<details><summary>Why I believed this</summary><p class="card-text">${escapeHtml(p.rationale)}</p></details>` : ''}
        ${p.disconfirm ? `<details><summary>What would change my mind</summary><p class="card-text">${escapeHtml(p.disconfirm)}</p></details>` : ''}
        ${p.resolutionNote ? `<p class="resolution"><strong>Outcome note:</strong> ${escapeHtml(p.resolutionNote)}</p>` : ''}
        <div class="card-meta"><span>Logged ${escapeHtml(formatDateTime(p.createdAt))}${p.resolveBy ? ` · due ${escapeHtml(formatDate(p.resolveBy))}` : ''}</span>${tags}</div>
        <div class="card-actions">
          ${p.status === 'pending' ? `<button class="btn sm primary" data-action="resolve" data-id="${p.id}">Resolve</button><button class="btn sm ghost" data-action="edit" data-id="${p.id}">Edit</button>` : `<button class="btn sm ghost" data-action="reopen" data-id="${p.id}">Reopen</button>`}
          <button class="btn sm danger-ghost" data-action="delete" data-id="${p.id}">Delete</button>
        </div>
      </article>`;
  }

  // ---------- dialogs ----------

  function predictionFormHTML(p?: Prediction): string {
    const isEdit = !!p;
    const conf = p?.confidence ?? 70;
    return `
      <form method="dialog" class="form" id="pred-form" data-edit-id="${p?.id ?? ''}">
        <h2 id="modal-title">${isEdit ? 'Edit prediction' : 'New prediction'}</h2>
        ${isEdit && p.status !== 'pending' ? `<p class="notice">Resolved predictions lock confidence at ${p.confidence}% to keep your score honest. Other fields stay editable.</p>` : ''}
        <label>Prediction (what will happen?) *
          <input name="title" class="input" required maxlength="160" placeholder="e.g. We will ship v2 before July" value="${escapeHtml(p?.title ?? '')}" />
        </label>
        <label>Confidence it WILL happen: <output id="conf-out" for="confidence">${conf}%</output>
          <input type="range" name="confidence" id="confidence" min="1" max="99" value="${conf}" ${isEdit && p.status !== 'pending' ? 'disabled' : ''} aria-describedby="conf-help" />
          <span class="hint" id="conf-help">Say what you actually believe — 60% means “I’d take that bet at 3:2 odds”. If you’d bet against it, go below 50%.</span>
        </label>
        <div class="form-row">
          <label>Category
            <select name="category" class="input">${CATEGORIES.map((c) => option(c, c, p?.category ?? 'Work')).join('')}</select>
          </label>
          <label>Resolve by
            <input type="date" name="resolveBy" class="input" value="${p?.resolveBy ?? addDaysISO(todayISODate(), 30)}" />
          </label>
        </div>
        <label>Context <textarea name="details" class="input" rows="2" maxlength="4000" placeholder="What exactly counts as happening?">${escapeHtml(p?.details ?? '')}</textarea></label>
        <label>Why you believe this <textarea name="rationale" class="input" rows="2" maxlength="4000" placeholder="Base rates, evidence, gut — write it before you know the answer">${escapeHtml(p?.rationale ?? '')}</textarea></label>
        <label>What would change your mind <textarea name="disconfirm" class="input" rows="2" maxlength="2000" placeholder="The one signal that would flip you">${escapeHtml(p?.disconfirm ?? '')}</textarea></label>
        <label>Tags (comma-separated) <input name="tags" class="input" placeholder="hiring, q3" value="${escapeHtml(p?.tags.join(', ') ?? '')}" /></label>
        <div class="form-actions">
          <button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn primary" value="save">${isEdit ? 'Save changes' : 'Log prediction'}</button>
        </div>
      </form>`;
  }

  function resolveDialogHTML(p: Prediction): string {
    const ifYes = brierScore(p.confidence, true).toFixed(2);
    const ifNo = brierScore(p.confidence, false).toFixed(2);
    return `
      <form method="dialog" class="form" id="resolve-form" data-id="${p.id}">
        <h2 id="modal-title">Resolve prediction</h2>
        <p class="resolve-title">“${escapeHtml(p.title)}” <span class="mini-meta">— you said ${p.confidence}%</span></p>
        <div class="segmented" role="radiogroup" aria-label="Outcome">
          <label class="seg"><input type="radio" name="outcome" value="yes" checked /> <span>✓ It happened</span></label>
          <label class="seg"><input type="radio" name="outcome" value="no" /> <span>✗ It didn’t</span></label>
        </div>
        <p class="hint">Scoring preview — happened: Brier ${ifYes} · didn’t: Brier ${ifNo}. Lower is better.</p>
        <label>Outcome note <textarea name="note" class="input" rows="2" maxlength="4000" placeholder="What actually happened? (optional, future-you will thank you)"></textarea></label>
        <div class="form-actions">
          <button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn primary" value="resolve">Score it</button>
        </div>
      </form>`;
  }

  function dataMenuHTML(count: number): string {
    return `
      <div class="menu-wrap">
        <h2 id="modal-title">Your data</h2>
        <p class="hint">${count} prediction${count === 1 ? '' : 's'} stored locally in this browser. Nothing is sent anywhere.</p>
        <div class="menu-list" role="menu">
          <button class="menu-item" data-action="export-json">↓ Export JSON (backup)</button>
          <button class="menu-item" data-action="export-csv">↓ Export CSV (spreadsheet)</button>
          <button class="menu-item" data-action="import-pick">↑ Import JSON backup…</button>
          <button class="menu-item" data-action="load-seed">✨ Load sample predictions</button>
          <button class="menu-item danger" data-action="wipe">🗑 Delete everything…</button>
        </div>
        <div class="form-actions"><button class="btn ghost" data-action="close-modal">Close</button></div>
      </div>`;
  }

  // ---------- events ----------

  shell.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!btn) return;
    const action = btn.dataset['action'] as string;
    const id = btn.dataset['id'];
    const all = store.all();
    const target = id ? all.find((p) => p.id === id) : undefined;

    switch (action) {
      case 'go':
        setView((btn.dataset['view'] as View) ?? 'dashboard');
        break;
      case 'new':
        openModal(predictionFormHTML());
        wireConfidenceSlider();
        break;
      case 'edit':
        if (target) {
          openModal(predictionFormHTML(target));
          wireConfidenceSlider();
        }
        break;
      case 'resolve':
        if (target && target.status === 'pending') openModal(resolveDialogHTML(target));
        break;
      case 'reopen':
        if (target) {
          store.reopen(target.id);
          toast('Reopened — resolve again when the outcome is clear.');
        }
        break;
      case 'delete':
        if (target) {
          openModal(`
            <div class="menu-wrap">
              <h2 id="modal-title">Delete prediction?</h2>
              <p class="hint">“${escapeHtml(target.title)}” will be permanently removed. This cannot be undone.</p>
              <div class="form-actions">
                <button class="btn ghost" data-action="close-modal">Keep it</button>
                <button class="btn danger" data-action="delete-confirm" data-id="${target.id}">Delete</button>
              </div>
            </div>`);
        }
        break;
      case 'delete-confirm':
        if (id && store.remove(id)) toast('Prediction deleted.');
        closeModal();
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'open-data':
        openModal(dataMenuHTML(all.length));
        break;
      case 'export-json':
        downloadFile(
          `hindsight-backup-${todayISODate()}.json`,
          JSON.stringify({ app: 'hindsight', version: 1, exportedAt: new Date().toISOString(), predictions: all }, null, 2),
          'application/json',
        );
        closeModal();
        toast(`Exported ${all.length} predictions as JSON.`);
        break;
      case 'export-csv':
        downloadFile(
          `hindsight-${todayISODate()}.csv`,
          toCSV(all.map((p) => ({
            title: p.title, category: p.category, confidence: p.confidence, status: p.status,
            createdAt: p.createdAt, resolveBy: p.resolveBy ?? '', resolvedAt: p.resolvedAt ?? '',
            brier: p.status === 'pending' ? '' : brierScore(p.confidence, p.status === 'correct').toFixed(3),
            tags: p.tags.join('|'), details: p.details, rationale: p.rationale, resolutionNote: p.resolutionNote,
          }))),
          'text/csv',
        );
        closeModal();
        toast('Exported CSV.');
        break;
      case 'import-pick':
        closeModal();
        fileInput.click();
        break;
      case 'load-seed': {
        const n = store.importSeed(buildSeed());
        closeModal();
        if (n === 0) toast('Sample data is already loaded.');
        else {
          toast(`Loaded ${n} sample predictions.`);
          setView('dashboard');
        }
        break;
      }
      case 'start-fresh': {
        const removed = store.removeSampleData();
        if (store.all().length === 0) setView('dashboard');
        toast(
          removed > 0
            ? 'Sample data cleared — a fresh journal, ready for your first prediction.'
            : 'Already a fresh journal.',
        );
        break;
      }
      case 'wipe':
        openModal(`
          <div class="menu-wrap">
            <h2 id="modal-title">Delete everything?</h2>
            <p class="hint">All ${all.length} predictions will be removed from this browser. Export a backup first if you want to keep them.</p>
            <div class="form-actions">
              <button class="btn ghost" data-action="close-modal">Cancel</button>
              <button class="btn ghost" data-action="export-json">Export first</button>
              <button class="btn danger" data-action="wipe-confirm">Delete everything</button>
            </div>
          </div>`);
        break;
      case 'wipe-confirm':
        store.clear();
        closeModal();
        toast('All predictions deleted. Fresh slate.');
        break;
      case 'clear-filters':
        filters = { query: '', status: 'all', category: 'all', sort: 'newest' };
        render();
        break;
      case 'toggle-theme': {
        const html = document.documentElement;
        const next = html.dataset['theme'] === 'dark' ? 'light' : 'dark';
        html.dataset['theme'] = next;
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch { /* ignore */ }
        break;
      }
    }
  });

  shell.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (form.id === 'pred-form') {
      const fd = new FormData(form);
      const title = String(fd.get('title') ?? '').trim();
      if (!title) {
        toast('Give your prediction a title.');
        return;
      }
      const editId = form.dataset['editId'];
      const input = {
        title,
        details: String(fd.get('details') ?? ''),
        rationale: String(fd.get('rationale') ?? ''),
        disconfirm: String(fd.get('disconfirm') ?? ''),
        category: String(fd.get('category') ?? 'Other') as Prediction['category'],
        confidence: Number(fd.get('confidence') ?? 70),
        resolveBy: (String(fd.get('resolveBy') ?? '') || null) as string | null,
        tags: parseTags(String(fd.get('tags') ?? '')),
      };
      if (editId) {
        store.update(editId, input);
        toast('Prediction updated.');
      } else {
        store.create(input);
        toast('Prediction logged. See you at resolution time.');
        if (view === 'dashboard') setView('journal');
      }
      closeModal();
    } else if (form.id === 'resolve-form') {
      const fd = new FormData(form);
      const id = form.dataset['id'] as string;
      const happened = String(fd.get('outcome') ?? 'yes') === 'yes';
      store.resolve(id, happened, String(fd.get('note') ?? ''));
      const p = store.all().find((x) => x.id === id);
      const b = p && p.status !== 'pending' ? brierScore(p.confidence, happened).toFixed(2) : '';
      toast(happened ? `Scored as correct — Brier ${b}. Nice call.` : `Scored as missed — Brier ${b}. The chart thanks you for your honesty.`);
      closeModal();
    }
  });

  shell.addEventListener('input', (e) => {
    const t = e.target as HTMLElement;
    if (t.id === 'q') {
      filters = { ...filters, query: (t as HTMLInputElement).value };
      refreshJournalList();
    } else if (t.id === 'confidence') {
      const out = shell.querySelector('#conf-out');
      if (out) out.textContent = `${(t as HTMLInputElement).value}%`;
    }
  });

  shell.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    if (t.id === 'f-status' || t.id === 'f-cat' || t.id === 'f-sort') {
      const q = (shell.querySelector('#q') as HTMLInputElement | null)?.value ?? filters.query;
      filters = {
        query: q,
        status: (shell.querySelector('#f-status') as HTMLSelectElement)?.value as JournalFilters['status'] ?? 'all',
        category: (shell.querySelector('#f-cat') as HTMLSelectElement)?.value as JournalFilters['category'] ?? 'all',
        sort: (shell.querySelector('#f-sort') as HTMLSelectElement)?.value as JournalFilters['sort'] ?? 'newest',
      };
      render();
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseImport(String(reader.result ?? ''));
      if (!result.ok) {
        toast(result.error);
      } else {
        const n = store.importMany(result.predictions, 'merge');
        toast(n === 0 ? 'Those predictions are already in your journal.' : `Imported ${n} predictions.`);
        render();
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  });

  store.subscribe(() => render());

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openModal(predictionFormHTML());
      wireConfidenceSlider();
    }
  });

  function refreshJournalList(): void {
    if (view !== 'journal') return;
    const all = store.all();
    const list = applyFilters(all, filters);
    const container = viewEl.querySelector('.card-list, .panel.empty');
    if (!container) return;
    const head = viewEl.querySelector('.journal-head h1');
    if (head) head.textContent = `${list.length} of ${all.length} predictions`;
    const tmp = document.createElement('div');
    tmp.innerHTML = list.length === 0
      ? `<section class="panel empty"><p><strong>Nothing matches those filters.</strong></p><button class="btn ghost" data-action="clear-filters">Clear filters</button></section>`
      : `<section class="card-list">${list.map((p) => cardHTML(p)).join('')}</section>`;
    container.replaceWith(tmp.firstElementChild as Element);
  }

  function wireConfidenceSlider(): void {
    const slider = modal.querySelector('#confidence') as HTMLInputElement | null;
    const out = modal.querySelector('#conf-out');
    if (slider && out) {
      out.textContent = `${slider.value}%`;
      slider.addEventListener('input', () => {
        out.textContent = `${slider.value}%`;
      });
    }
  }

  render();
}

function initTheme(shell: HTMLElement): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch { /* ignore */ }
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset['theme'] = saved ?? (prefersDark ? 'dark' : 'light');
  void shell;
}

function pendingByDue(all: Prediction[]): Prediction[] {
  return all
    .filter((p) => p.status === 'pending')
    .sort((a, b) => (daysUntil(a.resolveBy) ?? 3650) - (daysUntil(b.resolveBy) ?? 3650));
}

function applyFilters(all: Prediction[], f: JournalFilters): Prediction[] {
  const q = f.query.trim().toLowerCase();
  let list = all.filter((p) => {
    if (f.status !== 'all' && p.status !== f.status) return false;
    if (f.category !== 'all' && p.category !== f.category) return false;
    if (q) {
      const hay = `${p.title} ${p.details} ${p.rationale} ${p.resolutionNote} ${p.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  switch (f.sort) {
    case 'oldest':
      list = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case 'confidence':
      list = [...list].sort((a, b) => b.confidence - a.confidence);
      break;
    case 'due':
      list = [...list].sort((a, b) => (daysUntil(a.resolveBy) ?? 3650) - (daysUntil(b.resolveBy) ?? 3650));
      break;
    default:
      list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
  }
  return list;
}

function option(value: string, label: string, current: string): string {
  return `<option value="${escapeHtml(value)}"${value === current ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

function eyeSVG(): string {
  return `<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="16" cy="16" r="5.5" fill="currentColor"/><circle cx="18.2" cy="13.8" r="1.8" fill="var(--bg)"/></svg>`;
}

function themeSVG(): string {
  return `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
}
