# What Are Your Values, Mapache?

[![Vercel](https://therealsujitk-vercel-badge.vercel.app/?app=what-are-your-values)](https://what-are-your-values-mapache.DoctorDerek.com)
[![Codecov](https://codecov.io/gh/DoctorDerek/what-are-your-values-mapache/graph/badge.svg)](https://app.codecov.io/gh/DoctorDerek/what-are-your-values-mapache)

## Play the game free now to find out what your values are: [https://what-are-your-values-mapache.DoctorDerek.com](https://what-are-your-values-mapache.DoctorDerek.com)

_What Are Your Values, Mapache?_ is a high-speed autobattler designed to help you find your values in life by pitting 100 canonical human values against one another in rapid-fire battles.

The application is a frontend engineering showcase built as a `pnpm` Turborepo with Next.js (App Router), React 19, and Tailwind CSS v4.

Strict TypeScript domain modules and XState v5 machines govern the canonical value catalog, lazy deterministic pair scheduler, score progression, and application routing.

The current web build provides the core battle loop. Custom Values, JSON data portability, achievements, and Expo mobile support are next in the GDD roadmap.

## Technical Journal

- `0.0.0` Build initial demo game as a SPA Next.js app and ~20 values.
- `0.1.0` Migrate existing codebase to pnpm monorepo and latest Next.js.
- `0.1.1` Load data including all 83 values and animal + hero animation specs.
- `0.2.0` Phase A Bare Metal: initial gameplay loop with XState and basic UI.

## Local Development

Use [fnm](https://github.com/Schniz/fnm) for Node version management and [pnpm](https://pnpm.io/) as the package manager:

```bash
fnm use
corepack enable pnpm
pnpm install
pnpm dev
```
