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
- Local achievements with durable unlock history.
- Versioned JSON backup, reviewed import, scoped resets, and recovery paths.
- Responsive keyboard- and touch-friendly web UI.

The Expo application uses the same values, ranking, battle, achievement, and
backup contracts with native React Native screens, AsyncStorage, file picking,
sharing, and Reanimated transitions.

## Release status

The public release remains web-only. The Expo SDK 57 application is configured
for Expo Go and development-build testing, but iOS and Android store releases
still require physical-device QA, manual bidirectional backup-transfer QA, EAS
project and channel validation, and signed release candidates.

## Technology

- TypeScript 6, pnpm, and Turborepo.
- Next.js 16 App Router and React 19.
- Expo SDK 57, React Native 0.86, Expo Router, and React Native Reanimated.
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

For early native iteration in a matching Expo Go client:

```powershell
pnpm mobile:go
```

For production-grade native development after installing a development build:

```powershell
pnpm mobile:dev-client
```

Expo Go is an iteration surface, not evidence of a signed store build. SDK
availability differs by platform; use the development client when a matching
Expo Go build is unavailable.

## Verification

```powershell
pnpm lint
pnpm format
pnpm test
pnpm test:coverage
pnpm mobile:doctor
pnpm test:e2e
pnpm build
```
