# Repository Guidelines

## Project Structure & Module Organization
The Next.js application lives in `src/app`, with reusable UI in `src/components`, shared hooks in `src/hooks`, service and data helpers under `src/lib`, and utility functions in `src/utils`. Static assets stay in `public/`, while product notes and specs go in `docs/`. Supabase functions and configuration live in `supabase/`, and maintenance scripts are in `scripts/` (e.g., `scripts/generate-icons.mjs`). Keep new tests alongside the code they cover.

## Build, Test, and Development Commands
Install dependencies with `npm install`. Use `npm run dev` for the local dev server on port 3000. `npm run build` creates the production bundle, and `npm run start` serves that bundle for smoke tests. Run `npm run lint` to enforce ESLint/TypeScript rules, and execute `npm run generate:icons` after adjusting icon metadata (`components.json`).

## Coding Style & Naming Conventions
The repo targets TypeScript, React 19, and Next 15. Favor server components unless client interactivity is needed, and keep Tailwind utility-first styling consistent. Follow the ESLint ruleset in `eslint.config.mjs`; format with two-space indentation. Name components in PascalCase (`WorkoutPlanCard.tsx`), hooks with a `use` prefix, helper modules in camelCase, and share common types via `src/lib` or `src/utils`.

## Testing Guidelines
Tests use Jest with ts-jest (see `middleware.test.ts`). Name new suites `*.test.ts` and place them near the implementation. Run `npx jest` (or `npm exec jest`) before opening a PR, ensuring coverage for supabase, vision, and ingest integrations by stubbing external calls when needed.

## Commit & Pull Request Guidelines
Keep commit messages short, present-tense summaries with context (e.g., `add withings webhook handler`). Husky + lint-staged will auto-run ESLint on staged files, so commit clean. Pull requests should describe the change, link the related issue or task, include screenshots or recordings for UI updates, and flag configuration or migration steps.

## Environment & Security Notes
Copy `env.example` to `.env.local` and populate Supabase and Google Vision keys locally only. Never commit secrets. Prefer Winston log utilities for structured logging and sanitize any user-identifying data in new telemetry.
