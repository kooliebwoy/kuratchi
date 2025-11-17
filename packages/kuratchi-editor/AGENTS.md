# Repository Guidelines

## Project Structure & Module Organization
Kuratchi Editor ships as a SvelteKit package consumed by other workspace apps. Library code stays in `src/lib`, where feature folders (`blocks/`, `layouts/`, `themes/`, `stores/`, `utils/`, etc.) mirror editor domains. Surface new functionality through `src/lib/index.ts` so exports stay curated. Registries live in `src/lib/registry/*.svelte`, while shell chrome sits in `src/lib/shell`. `src/routes` may host lightweight demos, but consumers import everything from `@kuratchi/editor`. Shared styles belong to `src/app.css`, sourced through Tailwind in `vite.config.ts`.

## Build, Test, and Development Commands
- `npm run dev` – runs the Vite dev server for iterating on the editor UI.
- `npm run build` – runs `vite build` followed by `npm run prepack` (SvelteKit sync + `svelte-package`).
- `npm run preview` – serves the latest build for manual smoke tests.
- `npm run check` / `npm run check:watch` – validates Svelte and TypeScript using the package `tsconfig`.
- `npm run lint` – applies `@kuratchi/config-eslint` to `.ts` and `.svelte`; fix findings instead of disabling rules.

## Coding Style & Naming Conventions
Use TypeScript everywhere (`lang="ts"` in Svelte) and Svelte 5 runes for state helpers. ESLint enforces 4-space indentation, single quotes in TS modules, and PascalCase filenames for exported components (e.g., `EditorCanvas.svelte`). Stores, utilities, and registry helpers stay camelCase (`rightPanel`, `addComponentToEditor`), and shared types should come from `src/lib/types.ts` or `themes/`.

## Testing Guidelines
`svelte-check` is the current baseline, so run `npm run check` before every commit. When adding automated tests, colocate `*.spec.ts` or `*.test.ts` next to the source; `package.json#files` already excludes those globs from publication. Favor Vitest with @testing-library/svelte for components and keep store/util tests focused on pure logic with stubbed DOM APIs.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `refactor:`, `fix:`) as shown in the Git history, keeping subjects under 72 characters. Pull requests must include a concise summary, linked issue, verification steps (commands or route links), and screenshots or GIFs for UI changes. Call out updated exports or APIs in the description and land accompanying documentation before requesting review.

## Security & Configuration Tips
Never commit credentials or production data; demo content belongs in `defaultPageData` or local fixtures. Pass integration configuration through `EditorOptions` props instead of hardcoding keys. Keep CSS side effects isolated in files already declared under `sideEffects`, and review new dependencies for licensing and bundle impact before adding them.
