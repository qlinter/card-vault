# Card Vault

[简体中文](./README.md) | English

Card Vault is a local-first Windows sports-card collection application built with Next.js, React, Prisma, SQLite and Electron. Archives, images and financial history stay on the computer; AI and share hosting are optional external services.

## Current status

Source version: `1.3.2` (2026-09-09), a security, reliability and large-collection performance update. See the [v1.3.2 release notes](./docs/release-v1.3.2.md) for review scope, changes and validation.

Unsigned Windows x64 artifacts were generated on 2026-09-09: `dist/card-vault-1.3.2-setup.exe`, `dist/card-vault-1.3.2-portable.zip` and `dist/SHA256SUMS.txt`. Full release checks, packaged runtime, version, bundle contents and SHA-256 verification passed.

## Latest version: v1.3.2

1. **Dependency security**: Next.js 16.3.3, sharp 0.35.4 and js-yaml 4.3.2 address known advisories while retaining the full audit scope and failure threshold.
2. **Startup diagnostics**: preparation failures include the underlying error and actual log path, with complete UTF-8 output handling.
3. **Data protection**: AI and storage settings are written to a complete temporary file before replacement; restore rechecks the copied manifest before switching data to reject corrupted media.
4. **Paths and digests**: correctly handle Windows path case and child names starting with two dots; exclude future dates from collection digests while supporting SQLite text and numeric timestamps.
5. **Code optimization**: derive reminders in batches of 250 cards, query unknown-purchase existence, count digest events in the database and scan valuations once. Share grouping avoids repeated array copies.
6. **Portfolio history**: advance through records chronologically and reuse balances when transactions and expenses have not changed, preserving monthly amounts, missing markers and coverage.
7. **Large exports**: CSV/XLSX use a consistent database snapshot, bounded reads and streamed temporary files, then download in chunks. Cancellation cleanup and automatic worksheet splitting are included.
8. **Code cleanup**: remove obsolete queries and helpers, share streamed ZIP generation between galleries and XLSX, consolidate memory sampling, narrow internal exports, and exclude development checks and benchmarks from distribution packages.

Financial accounting, database structure and current-format validation remain unchanged. This patch adds no automatic historical upgrades or page layout changes. Historical release and distribution facts remain in their respective notes.

## Features

- Home: search, filters, global financial ordering, paginated loading and remembered Cards/List views.
- Cards: up to five images, rotation, drafts, continuous entry, templates, duplicate hints, batch image preparation and AI candidates requiring review.
- Finance: one physical quantity, mixed CNY/USD payments, moving-average cost, transaction/expense/valuation history, manual FX and explicit incomplete-data states.
- Showcase and Portfolio: collection browsing, structure and historical trends, quality queues, saved views, frozen snapshots and comparison.
- Shares: editable galleries, themes, sections and stories, shared preview/export rendering, static packages and the existing manual Drop workflow.
- Plans: 180-day maintenance reminders, 7/30-day digests, wishlists and separate currency budgets.
- Settings: Data, AI, Finance, User guide and About. Expand Data to manage Storage, Backup & restore, Import and Export.
- Data: CSV/XLSX mapping and preview, archive updates, per-row retries and conflict-safe undo. Full backups include the database, media and management state.

There is no independent mobile app. Narrow viewports such as 390px validate shared web galleries for phone browsers. Managed online publishing, multi-device sync and system digest notifications are outside the current scope.

## Local development

Use Node.js 24 and the locked dependencies:

```powershell
npm ci
npm run db:init
npm run build
npm run electron
```

Alternatively, start the desktop development app with `start-desktop.bat`. The launcher prefers ports 3000–3019 and falls back to an OS-assigned loopback port when that range is occupied or reserved by Windows; system port exclusions need no changes. Development configuration uses `%APPDATA%\Card Vault Development`. The actual collection directory is shown under Settings → Data → Storage. Use the application migration controls to change it.

API keys reside in the local user configuration and are encrypted with Windows safeStorage, not stored in the collection database. Optional AI supports Azure OpenAI, MiniMax and OpenAI Chat Completions-compatible services. Relevant images or content are sent to the selected provider only when a feature is called. Manual entry does not require AI.

## Validation and distribution

| Command | Purpose |
| --- | --- |
| `npm run check:release` | Encoding, docs, metadata, lint, types, coverage, production build, desktop startup and all HTTP/UI checks; does not package. |
| `npm test` | Unit and module tests. |
| `npm run test:card` / `test:share` / `test:security` / `test:management` / `test:export` | Business and security HTTP flows using isolated data. |
| `npm run test:ui` | Desktop UI, minimum-window checks, narrow share previews and strict screenshot comparisons. |
| `npm run test:desktop` | Real-server startup with port contention, session checks and service restart. |
| `npm run benchmark` | Isolated 1k/5k/10k synthetic collection benchmarks. |
| `npm run benchmark:portfolio-history` | Compare complete monthly output and timings with the frozen former implementation. |
| `npm run benchmark:export` | Validate streamed exports for 1k/10k cards, including duration and server memory. |
| `npm run benchmark:dense` | Dense financial history and synthetic-image benchmarks at 1k/5k/10k cards. |
| `npm run audit:all` / `audit:prod` | Online audit of all dependencies or production dependencies only; CI audits all dependencies, including packaging tools. |
| `npm run release:win` | After confirmation: full checks, installer, portable ZIP, packaged smoke tests and SHA-256. |
| `npm run verify:release-artifacts` | Verify existing artifacts, version, structure, signing mode and checksums. |

The installer provides a directory-selection wizard. Extract the entire portable ZIP before running `Card Vault.exe`; the executable depends on its adjacent runtime files. End users do not need Node.js. See [Windows signing](./docs/windows-code-signing.md) for release configuration.

Keep a full backup before upgrades or moving computers. CSV/XLSX files omit media and application state and cannot replace backups. Only the complete current database format is supported. Restore requires a valid backup manifest and does not upgrade older data; see the [backup guide](./docs/data-backup-guide.md).

## Historical releases

All 26 earlier versions are retained below, newest first. These summaries describe each release at the time; current behavior and compatibility follow the latest documentation. The original bilingual summaries were recovered from the v1.2.1 README files, with v1.3.0 and v1.3.1 added from their release notes. Early standalone release notes were not found; see [historical sources and gaps](./docs/version-history-sources.md).

| Version | Main changes | Source |
| --- | --- | --- |
| `1.3.1` | Fixed startup ports, recurring reminders, export scope and restore rollback; optimized financial indexing/history and consolidated current-format validation and documentation. | [Release notes](./docs/release-v1.3.1.md) |
| `1.3.0` | Unified mixed-currency accounting and manual FX; import previews/undo, reminders and plans, Home pagination, Portfolio/gallery refinements and local security improvements. | [Release notes](./docs/release-v1.3.0.md) |
| `1.2.1` | Added bilingual UI, consolidated Share Gallery and preview/export improvements, optional Windows signing, and unified code and product documentation. | [Release notes](./docs/release-v1.2.1.md) |
| `1.2.0` | Completed the Portfolio Center, saved views, point-in-time snapshots, true historical trends and comparison, plus image rotation, card-subject terminology, and Showcase refinements. | [Release notes](./docs/release-v1.2.0.md) |
| `1.1.1` | Added position accounting, in-app restore, home thumbnails and incremental rendering, a 1/1 filter, and database/UI consolidation. | [Release notes](./docs/release-v1.1.1.md) |
| `1.1.0` | Delivered Card Entry Workbench 2.0 with draft recovery, continuous entry, batch-image preparation, templates, duplicate review, and confirmation-gated AI candidates. | [Release notes](./docs/release-v1.1.0.md) |
| `1.0.19` | Corrected serial-numbered data, added serial-numbered filtering and CNY cost/valuation sorting, and hardened the local service, Electron sandbox, IPC, and quality gates. | [Release notes](./docs/release-v1.0.19.md) |
| `1.0.18` | Improved home and portfolio-analysis rendering, hardened cross-computer dependency recovery, restored default GPU acceleration, and added a compact application-version entry. | [Release notes](./docs/release-v1.0.18.md) |
| `1.0.17` | Added multiple custom AI providers, more reliable five-dimension portfolio analysis, preserved filtered return context, and consolidated shared protocols and redundant code. | [Release notes](./docs/release-v1.0.17.md) |
| `1.0.16` | Reduced home-page history loading and added clean Windows CI, repeatable release candidates, artifact verification, and release-metadata safeguards. | [Release notes](./docs/release-v1.0.16.md) |
| `1.0.15` | Completed the v2 AI analysis protocol, further Electron/storage/share-editor modularization, feedback-message consolidation, storage-rule unification, and Tailwind removal. | [Release notes](./docs/release-v1.0.15.md) |
| `1.0.14` | Completed Editor 2.0 and Drop export, reliable financial history, history-backed portfolio analysis, staged backup migration, and optional Windows release signing. | [Release notes](./docs/release-v1.0.14.md) |
| `1.0.13` | Unified Azure OpenAI on the v1 API with unified-resource endpoints and GPT-5.4 / 5.5 / 5.6 support. | [Historical README](./docs/version-history-sources.md) |
| `1.0.12` | Upgraded core dependencies and hardened storage migration, safe navigation, filtered context, and Share Gallery Editor 2.0. | [Historical README](./docs/version-history-sources.md) |
| `1.0.11` | Established migration, recovery, credential, data-health, portfolio-analysis, and release foundations. | [Historical README](./docs/version-history-sources.md) |
| `1.0.10` | Added three gallery layouts, sortable sections, live preview, and a shared renderer. | [Historical README](./docs/version-history-sources.md) |
| `1.0.9` | Added General, Sport, and Team themes with consistent preview and export assets. | [Historical README](./docs/version-history-sources.md) |
| `1.0.8` | Hardened storage migration, image validation, SQLite backup, desktop startup, and tests. | [Historical README](./docs/version-history-sources.md) |
| `1.0.7` | Added share backgrounds, display overrides, richer editing, and 3D image switching. | [Historical README](./docs/version-history-sources.md) |
| `1.0.6` | Moved storage controls to Settings and added an independent one-click backup path. | [Historical README](./docs/version-history-sources.md) |
| `1.0.5` | Added share collections, a four-step wizard, AI gallery copy, and static export. | [Historical README](./docs/version-history-sources.md) |
| `1.0.4` | Added Azure OpenAI / MiniMax recognition, shared AI settings, and encoding safeguards. | [Historical README](./docs/version-history-sources.md) |
| `1.0.3` | Expanded card fields, visibility states, advanced search, and legacy-data compatibility. | [Historical README](./docs/version-history-sources.md) |
| `1.0.2` | Added grading cost and total investment, corrected success feedback, and improved desktop icons. | [Historical README](./docs/version-history-sources.md) |
| `1.0.1` | Added multi-image entry, Showcase counts and collapsing, and form-value retention after errors. | [Historical README](./docs/version-history-sources.md) |
| `1.0.0` | Delivered local card management, filters, Showcase, SQLite storage, and Electron desktop use. | [Historical README](./docs/version-history-sources.md) |

## Documentation

- [Historical sources and gaps](./docs/version-history-sources.md): recovered README history and documentation policy.
- [Documentation index](./docs/README.md): current specifications and release history.
- [v1.3.2 release notes](./docs/release-v1.3.2.md): fixes, code optimization, acceptance and distribution status.
- [Product roadmap](./docs/product-roadmap.en.md); [中文](./docs/product-roadmap.md).

Application source lives in `app`, `components`, `lib` and `electron`. `scripts` handles preparation, tests and distribution; `tests` contains regressions and visual baselines. Git ignores personal data, secrets, `node_modules`, `.next`, `logs`, `dist` and test runtime files. Both READMEs retain detailed notes for the latest version and concise entries for every earlier version. Full release notes and source provenance remain in `docs`; a new release must not remove older entries.
