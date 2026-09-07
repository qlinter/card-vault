# Card Vault

[简体中文](./README.md) | English

Card Vault is a local-first Windows sports-card collection application built with Next.js, React, Prisma, SQLite and Electron. Archives, images and financial history stay on the computer; AI and share hosting are optional external services.

## Current status

Source version: `1.3.0`. Accumulated changes have passed review, source validation and user-authorized local packaging. See the [development status](./docs/v1.3.0-implementation.md) for current acceptance results.

With user confirmation on 2026-09-07, the Windows x64 installer `dist/card-vault-1.3.0-setup.exe`, portable archive `dist/card-vault-1.3.0-portable.zip` and `dist/SHA256SUMS.txt` have been generated. Packaged runtime, version, signing mode and checksum verification passed. This build is unsigned; Windows may display Unknown Publisher or SmartScreen prompts. See [release notes](./docs/release-v1.3.0.md) for artifact details. The files have not been uploaded to an online release channel.

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

Alternatively, start the desktop development app with `start-desktop.bat`. Development configuration uses `%APPDATA%\Card Vault Development`. The actual collection directory is shown under Settings → Data → Storage. Use the application migration controls to change it.

API keys reside in the local user configuration and are encrypted with Windows safeStorage, not stored in the collection database. Optional AI supports Azure OpenAI, MiniMax and OpenAI Chat Completions-compatible services. Relevant images or content are sent to the selected provider only when a feature is called. Manual entry does not require AI.

## Validation and distribution

| Command | Purpose |
| --- | --- |
| `npm run check:release` | Encoding, docs, metadata, lint, types, coverage, production build and all HTTP/UI checks; does not package. |
| `npm test` | Unit and module tests. |
| `npm run test:card` / `test:share` / `test:security` / `test:management` | Business and security HTTP flows using isolated data. |
| `npm run test:ui` | Desktop UI, minimum-window checks, narrow share previews and strict screenshot comparisons. |
| `npm run benchmark` | Isolated 1k/5k/10k synthetic collection benchmarks. |
| `npm run audit:all` / `audit:prod` | Online audit of all dependencies or production dependencies only; CI audits all dependencies, including packaging tools. |
| `npm run release:win` | After confirmation: full checks, installer, portable ZIP, packaged smoke tests and SHA-256. |
| `npm run verify:release-artifacts` | Verify existing artifacts, version, structure, signing mode and checksums. |

The installer provides a directory-selection wizard. Extract the entire portable ZIP before running `Card Vault.exe`; the executable depends on its adjacent runtime files. End users do not need Node.js. See [Windows signing](./docs/windows-code-signing.md) for release configuration.

Keep a full backup before upgrades or moving computers. CSV/XLSX files omit media and application state and cannot replace backups. Supported legacy-database boundaries are in the [backup guide](./docs/data-backup-guide.md).

## Documentation

- [Documentation index](./docs/README.md): current specifications and release history.
- [v1.3.0 release notes](./docs/release-v1.3.0.md): final changes and artifact status.
- [Development and acceptance status](./docs/v1.3.0-implementation.md): completed, pending and confirmation-dependent work.
- [Code review](./docs/project-assessment-2026-09-07.md): scope, cleanup, risks and evidence limits.
- [Product roadmap](./docs/product-roadmap.en.md); [中文](./docs/product-roadmap.md).

Application source lives in `app`, `components`, `lib` and `electron`. `scripts` handles preparation, tests and distribution; `tests` contains regressions and visual baselines. Git ignores personal data, secrets, `node_modules`, `.next`, `logs`, `dist` and test runtime files. Version history is maintained in the docs directory instead of duplicated in this README.
