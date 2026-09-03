# Launch checklist for Hindsight v1.0

Status: **ready to review, then ship.** Everything below is done except the
two human steps at the end (GitHub + hosting), which need your account.

## Done ✅

- [x] App builds clean (`npm run build`: tsc + vite, 0 errors)
- [x] 21/21 unit tests pass (`npm test`)
- [x] Production bundle smoke-tested (`npm run preview` → 200, manifest → 200)
- [x] Onboarding, empty states, sample data, error toasts
- [x] Export JSON / CSV + import with validation
- [x] Light/dark themes, responsive layouts, reduced-motion support
- [x] PWA manifest + custom icon + meta/SEO tags
- [x] README, LICENSE (MIT), methodology page in-app

## Before you share publicly (5–15 min)

1. **Click through once** (`npm run dev`): load sample data → resolve one
   prediction → check dashboard charts → export JSON. Anything look off,
   file it as an issue.
2. **Create the GitHub repo** (see commands below) — kept local-only on
   purpose; publishing the repo is an irreversible public act, so it's yours.
3. **Host `dist/`** — easiest: Netlify Drop (drag `dist/`), or
   `npx serve dist`, or GitHub/Cloudflare Pages. No env vars, no backend.
4. Optional polish: custom domain, OG social image, lighthouse pass.

## Suggested repo setup

```bash
# from this directory:
git remote add origin git@github.com:<you>/hindsight.git
git branch -M main
git push -u origin main
```

Then in the repo settings: MIT license detected automatically, add the
description "A local-first decision journal that scores your judgment",
topics: `forecasting`, `calibration`, `brier-score`, `local-first`, `vite`.
