# What Are Your Values, Mapache?

[![Vercel](https://therealsujitk-vercel-badge.vercel.app/?app=what-are-your-values)](https://what-are-your-values-mapache.DoctorDerek.com)

## Play the game free now to find out what your values are: [https://what-are-your-values-mapache.DoctorDerek.com](https://what-are-your-values-mapache.DoctorDerek.com)

_What Are Your Values, Mapache?_ is a high-speed, zero-friction autobattler designed to gamify Acceptance and Commitment Therapy (ACT) value-sorting by pitting 83 fundamental human values against each other in rapid-fire 1v1 matchups.

The application is a frontend engineering showcase built as a `pnpm` Turborepo with Next.js (App Router), React 19, and Tailwind CSS v4.

To explicitly reject the fragility of unpredictable renders, the entire client-side battle loop, priority queueing, and layout routing are deterministically governed by a robust XState v5 actor model (state machines).

Currently deployed as an offline-first Phase A build featuring the core combat sandbox (gameplay loop).

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
