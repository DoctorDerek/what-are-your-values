# What Are Your Values, Mapache?

[![Production](https://img.shields.io/website?url=https%3A%2F%2Fwww.whatareyourvaluesmapache.com%2F&up_message=live&down_message=offline&label=production&logo=vercel&logoColor=white)](https://www.whatareyourvaluesmapache.com/) [![Codecov](https://codecov.io/gh/DoctorDerek/what-are-your-values-mapache/graph/badge.svg)](https://app.codecov.io/gh/DoctorDerek/what-are-your-values-mapache) [![Test and Lint](https://github.com/DoctorDerek/what-are-your-values-mapache/actions/workflows/test-and-lint.yml/badge.svg)](https://github.com/DoctorDerek/what-are-your-values-mapache/actions/workflows/test-and-lint.yml) [![Playwright](https://github.com/DoctorDerek/what-are-your-values-mapache/actions/workflows/playwright.yml/badge.svg)](https://github.com/DoctorDerek/what-are-your-values-mapache/actions/workflows/playwright.yml)

Play the live game: [whatareyourvaluesmapache.com](https://www.whatareyourvaluesmapache.com/)

What Are Your Values, Mapache? is a private, offline values-clarification autobattler. Pick the value that matters more in each pair; repeated choices produce a Top Five and a complete ranking across 100 included values plus any Custom Values you add.

## Current build

The public web application currently includes:

- 100 immutable canonical values with definitions.
- Private Custom Value create, edit, and delete flows.
- Durable local persistence through IndexedDB, with no account required.
- A deterministic XState state machine and lazy pair scheduler.
- First-run browsing, rank-preserving search, All Values, Top Five, and visible definitions.
- Undo and Redo for battle history.
- Responsive keyboard- and touch-friendly web UI.

## Release status

The current public release is web-only. iOS and Android releases, JSON import/export, and local achievements are planned next. The README will be updated when those features are shipped.

## Technology

- TypeScript 6, pnpm, and Turborepo.
- Next.js 16 App Router and React 19.
- Tailwind CSS 4.
- XState 5 for application state and Motion for web animation.
- Vitest, Testing Library, Playwright, Codecov, GitHub Actions, and Vercel.

## Local development

Use [fnm](https://github.com/Schniz/fnm) for Node version management and [pnpm](https://pnpm.io/) as the package manager:

```powershell
fnm use
corepack enable pnpm
pnpm install
pnpm dev
```

## Verification

```powershell
pnpm lint
pnpm format
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm build
```
