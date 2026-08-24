# What Are Your Values, Mapache?

[![Production](https://img.shields.io/website?url=https%3A%2F%2Fwww.whatareyourvaluesmapache.com%2F&up_message=live&down_message=offline&label=production&logo=vercel&logoColor=white)](https://www.whatareyourvaluesmapache.com/) [![Codecov](https://codecov.io/gh/DoctorDerek/what-are-your-values-mapache/graph/badge.svg)](https://app.codecov.io/gh/DoctorDerek/what-are-your-values-mapache) [![ESLint, Vitest, and XState](https://github.com/DoctorDerek/what-are-your-values-mapache/actions/workflows/eslint-vitest-xstate.yml/badge.svg)](https://github.com/DoctorDerek/what-are-your-values-mapache/actions/workflows/eslint-vitest-xstate.yml) [![Playwright](https://github.com/DoctorDerek/what-are-your-values-mapache/actions/workflows/playwright.yml/badge.svg)](https://github.com/DoctorDerek/what-are-your-values-mapache/actions/workflows/playwright.yml)

Play the live game: [whatareyourvaluesmapache.com](https://www.whatareyourvaluesmapache.com/)

What Are Your Values, Mapache? is a private, offline values-clarification autobattler. Pick the value that matters more in each pair; repeated choices produce a Top Five and a complete ranking across 100 included values plus any Custom Values you add.

## Mobile Web Lighthouse Measurements

Latest successful automated Lighthouse scores for the canonical production website, measured with Lighthouse’s standard mobile emulation. The badges and linked HTML report come from the audit with the median performance score among five production runs.

[![Mobile Web Lighthouse Performance](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdoctorderek.github.io%2Fwhat-are-your-values-mapache%2Flighthouse-results.json&query=%24.performance&label=performance&suffix=%2F100&logo=lighthouse&logoColor=white&color=informational)](https://doctorderek.github.io/what-are-your-values-mapache/) [![Mobile Web Lighthouse Accessibility](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdoctorderek.github.io%2Fwhat-are-your-values-mapache%2Flighthouse-results.json&query=%24.accessibility&label=accessibility&suffix=%2F100&logo=lighthouse&logoColor=white&color=informational)](https://doctorderek.github.io/what-are-your-values-mapache/) [![Mobile Web Lighthouse Best Practices](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdoctorderek.github.io%2Fwhat-are-your-values-mapache%2Flighthouse-results.json&query=%24.bestPractices&label=best%20practices&suffix=%2F100&logo=lighthouse&logoColor=white&color=informational)](https://doctorderek.github.io/what-are-your-values-mapache/) [![Mobile Web Lighthouse SEO](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdoctorderek.github.io%2Fwhat-are-your-values-mapache%2Flighthouse-results.json&query=%24.seo&label=SEO&suffix=%2F100&logo=lighthouse&logoColor=white&color=informational)](https://doctorderek.github.io/what-are-your-values-mapache/)

## Current build

The public web application currently includes:

- 100 immutable canonical values with definitions.
- Private Custom Value create, edit, and delete flows.
- Durable local persistence through IndexedDB, with no account required.
- A deterministic XState state machine and lazy pair scheduler.
- First-run browsing, rank-preserving search, All Values, Top Five, and visible definitions.
- Undo and Redo for battle history.
- Schema-validated JSON backup import and export.
- Local achievement progression and presentation.
- An installable static PWA with a precached application shell for offline reloads.
- Responsive keyboard- and touch-friendly web UI.

## Release status

The public release is web-only. The Expo workspace implements the same private core loop, durable local persistence, JSON import/export, and local achievements. Its canonical build gate exports both iOS and Android bundles. Physical-device QA, signed native builds, and store submissions remain pending.

## Native iteration

Start an installed Expo development build with:

```powershell
pnpm mobile:dev
```

If a compatible Expo Go client is available, start its development server with:

```powershell
pnpm mobile:go
```

Validate Expo compatibility and export both native JavaScript bundles with:

```powershell
pnpm mobile:doctor
pnpm mobile:export
```

Export proves that Metro can resolve the JavaScript and assets for both native platforms. It does not prove native compilation, signing, installation, physical-device behavior, or store acceptance.

## Technology

- TypeScript 6, pnpm, and Turborepo.
- Next.js 16 App Router and React 19.
- Tailwind CSS 4 and source-owned shadcn/ui primitives.
- Expo 57, React Native 0.86, Expo Router, Uniwind, React Native Reanimated, and source-owned React Native Reusables primitives.
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

Build and preview the static production PWA locally with:

```powershell
pnpm --filter @game/web build
pnpm --filter @game/web start
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
