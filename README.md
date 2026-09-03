# Hindsight — a decision journal that keeps you honest

> Write down what you believe. Find out if you should.

Most people are overconfident and never find out — because they never keep score. **Hindsight** is a local-first decision journal: log a prediction with a confidence level, resolve it when the outcome is known, and get a **Brier score** plus a **calibration chart** that shows exactly where your judgment slips.

100% local. No account, no server, no tracking. Your predictions never leave your browser.

## Why this exists

- **Forecasters keep score; everyone else guesses.** Superforecasting research (Tetlock et al.) shows the single biggest driver of better judgment is a tight feedback loop: predict → resolve → review. Hindsight is that loop in an app.
- **Overconfidence is the default bug.** The calibration chart makes yours visible: bars below the diagonal mean you claim more certainty than you deliver.
- **Memory lies; logs don't.** Writing *why* you believed something — and what would change your mind — before the outcome is known defeats hindsight bias (fittingly).

## Features (v1.0)

- 📝 **Prediction journal** — title, confidence slider (1–99%), category, resolve-by date, context, rationale, disconfirming evidence, tags
- ✅ **One-click resolution** — happened / didn't happen + outcome note, with live Brier preview
- 📊 **Dashboard** — accuracy, mean Brier score + verdict, calibration gap, streaks
- 📈 **Calibration chart** — stated confidence vs. actual hit rate, hand-rolled SVG, zero dependencies
- 📉 **Brier trend** — cumulative score in resolution order (falling line = improving judgment)
- 🔒 **Honesty lock** — confidence is frozen once resolved; you can't edit your way to a better score
- 🔍 **Search, filter, sort** — by status, category, confidence, due date
- 💾 **JSON backup / CSV export / JSON import** — your data, portable
- 🌱 **Sample dataset** — one click to explore scoring before logging your own
- 🌓 **Light + dark themes**, responsive, keyboard accessible (`Cmd/Ctrl+K` for a new prediction), installable (PWA manifest)

## Quick start

```bash
npm install
npm run dev      # → http://localhost:5173
```

```bash
npm test         # 21 unit tests (vitest)
npm run build    # typecheck + production build → dist/
npm run preview  # serve the production build locally
```

Deploy anywhere that serves static files: `dist/` is the whole app. Drag it onto Netlify Drop, `npx serve dist`, GitHub Pages, Cloudflare Pages — no server code, no env vars.

## How scoring works

**Brier score** per prediction: `(confidence − outcome)²`, outcome = 1 if it happened, 0 if not.

| You said | It happened | Brier |
|----------|-------------|-------|
| 80%      | yes         | 0.04  |
| 80%      | no          | 0.64  |
| 50%      | either      | 0.25  |

Mean Brier across resolved predictions: **0 = perfect, 0.25 = coin-flip, 1 = worst possible.** Confident errors hurt — that's the point.

**Calibration:** group predictions by stated confidence. Everything you called "70%" should happen ~70% of the time. The in-app *How scoring works* page explains the methodology in full.

**Three habits of calibrated people:** start from a base rate → pre-commit the number → review monthly. The app is designed around all three.

## Tech

- **Vite + TypeScript**, vanilla DOM (no framework), hand-rolled SVG charts — total JS ~44KB (~14KB gzipped)
- **Vitest** unit tests for the scoring engine, store, validation, and seed data
- **localStorage** persistence (`hindsight.v1`, schema-versioned) with JSON validation on import
- No runtime dependencies. No network calls. Ever.

```
src/
  types.ts    domain model
  scoring.ts  Brier / calibration / streaks (pure, tested)
  store.ts    persistence + CRUD + import validation (tested)
  charts.ts   SVG renderers (dependency-free)
  seed.ts     sample dataset (dates relative to today)
  app.ts      views, dialogs, events
  utils.ts    dates, CSV, download helpers
```

## Privacy

Everything lives in `localStorage` under `hindsight.v1`. There is no backend, no analytics, no cookies. Export anytime from **Data → Export**; clearing site data deletes everything. Import validates and repairs what it can, rejects what it can't.

## Roadmap ideas

- Reminders for due predictions (notification API, still local)
- Base-rate helper per category
- Calibration by tag/category breakdown
- Optional encrypted sync (still no account — e.g. WebDAV / iCloud file)

## License

MIT — see [LICENSE](LICENSE). Built as an autonomous one-shot experiment; contributions welcome.
