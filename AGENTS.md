# AGENTS.md — GPX Traces Map

Static website that reads GPX files from a Google Drive folder and shows the traces on an interactive Leaflet map.
Stack: JavaScript, Webpack, Jest (unit tests), Playwright (UI smoke test), GitHub Actions, GitHub Pages.

## Standards to follow

Read the standard before working, and show its grid at the top of your answer, as each standard asks.

- Analysing a bug, a CI failure or a broken pipeline: [`docs/standards/technical-defect-analysis.md`](docs/standards/technical-defect-analysis.md)
- Any code change, fix or new feature: [`docs/standards/code-changes.md`](docs/standards/code-changes.md)

A mistake that comes back, from an agent or a human, is a missing point in a standard: propose it, do not just fix the case.

## Commands

```sh
npm run build      # webpack bundle
npm start          # local dev server
npm test           # Jest unit tests
npm run test:ui    # Playwright smoke test
npm run lint       # ESLint
npm run format     # Prettier
```

## Never

- Read, print or commit local credential files (`.env`, `credentials.json`): they are ignored by git, and CI uses GitHub secrets.
- Commit generated folders (`dist/`, `coverage/`).
