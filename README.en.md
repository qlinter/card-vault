# Card Vault

[简体中文](./README.md) | English

Card Vault is a local-first Windows sports-card collection application built with Next.js, React, Prisma, SQLite and Electron. Archives, images and financial history stay on the computer; AI and share hosting are optional external services.

## Current status

Source version: `1.4.1` (2026-10-23). This version delivers the four-tab Data workspace, compact Home layouts, Scout query improvements and desktop startup fixes. See the [v1.4.1 release notes](./docs/release-v1.4.1.md) and [Git update notes](./docs/git-update-v1.4.1.md).

This release publishes source and a version tag. No v1.4.1 installer or portable archive has been generated; future artifacts will be named `dist/card-vault-1.4.1-setup.exe` and `dist/card-vault-1.4.1-portable.zip`. Existing v1.4.0 files and checksums remain in the [historical release notes](./docs/release-v1.4.0.md) and are not v1.4.1 artifacts.

## Latest version: v1.4.1

1. **Data workspace**: Overview, Trends, Structure and Details share the applied collection scope. Keyword searches, filter removal, exact archive drill-through and edit-return links preserve context.
2. **Overview and details**: valuation, cost and profit take priority, with expandable accounting evidence. Holdings, Sale, Needs attention and All support search, sorting and complete pagination.
3. **Trends and structure**: charts have independent ranges. Amount/quantity controls sit together; quantities exclude expenses. Structure counts all archives, uses quoted holdings for value shares, marks sold archives and shows Top 1/3/5 with collapse controls at the end.
4. **Fixed snapshots**: save frozen snapshots, view, rename, delete and compare historical points. Differences are target minus baseline; different accounting versions or currencies cannot be compared directly.
5. **Home and navigation**: three aligned summary panels, matching valuation/count typography and whole-row list links. View controls and the filter arrow are compact while all conditions remain available. Slow navigation retains existing content with a delayed progress hint.
6. **Scout and startup**: debounced searches, database pagination, shared relationship indexes and safe recovery from damaged scroll caches. The launcher prepares Electron separately and supports retry. Dependencies use Next.js 16.4.1 and Electron 42.11.9.
7. **Code structure**: shared presentation state; summary pages retain aggregates and five positions rather than complete detail lists. Obsolete drag layouts, live-view actions, stale styles and a duplicate release entry are removed. Independent financial reference tests, business-date FX rules and the existing data format remain.

Rules are maintained in the [Data analysis guide](./docs/data-analysis-guide.md), [financial model](./docs/financial-history-model.md) and [backup guide](./docs/data-backup-guide.md). Earlier validation is recorded in the [development log](./docs/development-v1.4.1.md).

## Features

- Themes: switch between Classic, Minimal Gallery, Midnight Collection and Warm Archive in Settings. Typography is preserved and the choice persists; share themes remain independent. See [application themes](./docs/app-themes.md).
- Home: search, filters, global financial ordering, paginated loading and remembered Cards/List views with consistent icon controls.
- Cards: up to five images, rotation, drafts, continuous entry, templates, duplicate hints, batch image preparation and AI candidates requiring review.
- Finance: one physical quantity, one currency per transaction, moving-average cost, transaction/expense/valuation history, manual FX and explicit incomplete-data states.
- Showcase and Data: collection browsing; analysis uses Overview, Trends, Structure and Details with shared scope, physical quantities, complete issue lists, fixed snapshots and historical comparison. See the [data analysis guide](./docs/data-analysis-guide.md).
- Shares: editable galleries, themes, sections and stories, shared preview/export rendering, static packages and the existing manual Drop workflow.
- Scout: cross-site searches, saved keywords, linked wishes, wishlist and acquisition. Digests and reminders are on Home.
- Settings: Theme, Data, AI, Finance, User guide and About. Expand Data to manage Storage, Backup & restore, Import and Export.
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

Alternatively, start the desktop development app with `start-desktop.bat`. It checks project dependencies, prepares the Electron runtime separately, and automatically builds the application when the build is missing or outdated. The first runtime download needs a network connection. An npmmirror npm registry selects the corresponding Electron mirror; `ELECTRON_MIRROR` can override it. Rerun the launcher after a failed download to retry without removing all dependencies.

The local service prefers ports 3000–3019 and falls back to an OS-assigned loopback port when that range is occupied or reserved by Windows; system port exclusions need no changes. Development configuration uses `%APPDATA%\Card Vault Development`. The actual collection directory is shown under Settings → Data → Storage. Use the application migration controls to change it.

API keys reside in the local user configuration and are encrypted with Windows safeStorage, not stored in the collection database. Optional AI supports Azure OpenAI, MiniMax, DeepSeek and OpenAI Chat Completions-compatible services. Relevant images or content are sent to the selected provider only when a feature is called. Manual entry does not require AI.

## Validation and distribution

| Command | Purpose |
| --- | --- |
| `npm run check:release` | Encoding, docs, metadata, architecture, lint, types, coverage, production build, desktop startup and all HTTP/UI checks; does not package. |
| `npm run check:architecture` | Check source cycles and client imports of Node.js/database modules. |
| `npm test` | Unit and module tests. |
| `npm run test:card` / `test:share` / `test:security` / `test:management` / `test:scout` / `test:export` | Business and security HTTP flows using isolated data. |
| `npm run test:ui` | Desktop UI, minimum-window checks, narrow share previews and strict screenshot comparisons. |
| `npm run test:desktop` | Real-server startup with port contention, session checks and service restart. |
| `npm run test:desktop:launcher` | Run the actual Windows launcher with an isolated profile, checking automatic build and build reuse; rebuilds local `.next`. |
| `npm run test:desktop:runtime` | Launch the current Electron with an isolated collection to check sandboxing, preload and edit-return navigation. |
| `npm run benchmark` | Isolated 1k/5k/10k synthetic collection benchmarks. |
| `npm run benchmark:portfolio-history` | Compare complete monthly output and timings with the frozen former implementation. |
| `npm run benchmark:portfolio-workload` | Compare frozen, full and summary aggregation for equivalent output and in-memory timings, excluding database reads and rendering. |
| `npm run benchmark:export` | Validate streamed exports for 1k/10k cards, including duration and server memory. |
| `npm run benchmark:dense` | Dense financial history and synthetic-image benchmarks at 1k/5k/10k cards. |
| `npm run audit:all` / `audit:prod` | Online audit of all dependencies or production dependencies only; CI audits all dependencies, including packaging tools. |
| `npm run release:win` | After confirmation: full checks, installer, portable ZIP, packaged smoke tests and SHA-256. |
| `npm run verify:release-artifacts` | Verify existing artifacts, version, structure, signing mode and checksums. |

The installer provides a directory-selection wizard. Extract the entire portable ZIP before running `Card Vault.exe`; the executable depends on its adjacent runtime files. End users do not need Node.js. See [Windows signing](./docs/windows-code-signing.md) for release configuration.

Keep a full backup before upgrades or moving computers. CSV/XLSX files omit media and application state and cannot replace backups. Only complete supported database formats with a valid manifest are accepted. Complete v1.3 base databases receive Scout tables in the staging copy; arbitrary earlier formats are not converted. See the [backup guide](./docs/data-backup-guide.md).

## Historical releases

All 32 earlier versions are retained below, newest first. These summaries describe each release at the time; current behavior and compatibility follow the latest documentation. The original bilingual summaries were recovered from the v1.2.1 README files, with v1.3.0–v1.3.3 added from their release notes. Early standalone release notes were not found; see [historical sources and gaps](./docs/version-history-sources.md).

| Version | Main changes | Source |
| --- | --- | --- |
| `1.4.0` | Scout searches, saved keywords, multi-card wish acquisition and compact collection overview. | [Release notes](./docs/release-v1.4.0.md) |
| `1.3.6` | Batched Portfolio, restore protection, editing navigation, single-currency transactions and code organization. | [Release notes](./docs/release-v1.3.6.md) |
| `1.3.5` | Added four application themes, refined Finance, editing and AI settings, unified icons, updated dependencies and removed obsolete compatibility code. | [Release notes](./docs/release-v1.3.5.md) |
| `1.3.4` | Unified collection statuses and holding coverage, added entry financial records, improved Home, wishes and navigation, and consolidated structure and checks. | [Release notes](./docs/release-v1.3.4.md) |
| `1.3.3` | Added DeepSeek, improved financial and Portfolio layouts, and consolidated AI configuration and architecture. | [Release notes](./docs/release-v1.3.3.md) |
| `1.3.2` | Security and startup fixes, settings/restore protection, dense Portfolio history and streamed exports, with shared ZIP and performance helpers. | [Release notes](./docs/release-v1.3.2.md) |
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
- [v1.3.6 release notes](./docs/release-v1.3.6.md): scale and restore improvements, navigation and Finance, code organization, source/package validation, checksums and Git update notes.
- [Product roadmap](./docs/product-roadmap.en.md); [中文](./docs/product-roadmap.md).

Application source lives in `app`, `components`, `lib` and `electron`. `scripts` handles preparation, tests and distribution; `tests` contains regressions and visual baselines. Git ignores personal data, secrets, `node_modules`, `.next`, `logs`, `dist` and test runtime files. Both READMEs retain detailed notes for the latest version and concise entries for every earlier version. Full release notes and source provenance remain in `docs`; a new release must not remove older entries.
