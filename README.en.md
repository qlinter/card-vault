# Card Vault

[简体中文](./README.md) | English

Card Vault is a local-first sports-card collection manager for cataloging, organizing, searching, showcasing, and sharing a personal collection. It is built with `Next.js + React + Prisma + SQLite + Electron`; card data and images remain on the local computer by default and can be used offline.

## Current Version

`1.0.16`

### 1.0.16 Highlights

- The home page now loads only list and latest-valuation data; complete financial history is queried after Portfolio Analysis is requested for the current filter scope.
- Portfolio filters now use a strict field allowlist, type and length validation, and a maximum analysis size.
- Added Windows GitHub Actions for clean-environment quality checks and manually triggered release-candidate packaging on Node.js 24.
- Added packaged `/api/health` smoke testing, standalone artifact validation, and a generated `SHA256SUMS.txt` manifest.
- Added release-metadata consistency checks and expanded mojibake detection after repairing stale test fixtures.
- v1.0.16 introduces no database migration and remains directly compatible with v1.0.15 data and backups.

- Completed Share Gallery Editor 2.0 with four workspaces, drag and keyboard ordering, undo/redo, local draft recovery, pre-save cover/background preview, and typography, density, and image-fit controls.
- Fixed application share previews loading the complete Card Vault UI after a card click; previews now use an inline card detail.
- Consolidated share-package export with general static and Cloudflare Drop variants plus public-field, broken-link, file-count, and 25 MiB per-file validation.
- Added transaction, expense, and valuation history with entry, timeline, per-currency summary, correction, and deletion; legacy fields remain CNY compatibility snapshots only.
- Limited financial currencies to CNY/USD and valuation sources to Personal estimate, Recent sale, or Platform quote, with automatic migration for existing and restored backups.
- Home-page totals now use each filtered card's latest valuation. CNY/USD display on separate lines with matching typography, ISO labels, thousands separators, and compact coverage.
- Home portfolio analysis now reads transaction, expense, and latest-valuation history directly, presenting cost, net cash invested, comparable unrealized return, valuation age, and sources separately for CNY and USD without implicit FX conversion.
- Backup restore now completes pending migrations and integrity checks in staging before replacing active data.
- The desktop launcher now detects missing or lockfile-stale dependencies and installs them automatically when needed.
- Windows releases support optional Authenticode signing and can still be generated when no certificate is configured.

## Core Features

- Create, edit, delete, and inspect cards with up to five images per card.
- Search, filter, and sort by player, sport, team, year, product line, grade, autograph, patch, and collection status.
- Track purchases, sales, refunds, grading, other costs, and latest values through transaction, expense, and valuation history.
- Browse the Showcase by player or group, with collapsible navigation and multi-image card views.
- Use Azure OpenAI or MiniMax for AI card recognition, gallery copy, and portfolio analysis.
- Build editable share galleries with themes, layouts, sections, covers, backgrounds, and per-card presentation overrides.
- Export a general static sharing bundle or a temporary Cloudflare Drop preview bundle.
- Store data in local SQLite, move the active data path, configure separate backups, inspect health, and restore in-app.
- Distribute self-contained Windows installer and portable ZIP builds that do not require Node.js.

## Release Summary

| Version | Main Change |
| --- | --- |
| `1.0.0` | Delivered local card management, filters, Showcase, SQLite storage, and Electron desktop use. |
| `1.0.1` | Added multi-image entry, Showcase counts and collapsing, and form-value retention after errors. |
| `1.0.2` | Added grading cost and total investment, corrected success feedback, and improved desktop icons. |
| `1.0.3` | Expanded card fields, visibility states, advanced search, and legacy-data compatibility. |
| `1.0.4` | Added Azure OpenAI / MiniMax recognition, shared AI settings, and encoding safeguards. |
| `1.0.5` | Added share collections, a four-step wizard, AI gallery copy, and static export. |
| `1.0.6` | Moved storage controls to Settings and added an independent one-click backup path. |
| `1.0.7` | Added share backgrounds, display overrides, richer editing, and 3D image switching. |
| `1.0.8` | Hardened storage migration, image validation, SQLite backup, desktop startup, and tests. |
| `1.0.9` | Added General, Sport, and Team themes with consistent preview and export assets. |
| `1.0.10` | Added three gallery layouts, sortable sections, live preview, and a shared renderer. |
| `1.0.11` | Established migration, recovery, credential, data-health, portfolio-analysis, and release foundations. |
| `1.0.12` | Upgraded core dependencies and hardened storage migration, safe navigation, filtered context, and Share Gallery Editor 2.0. |
| `1.0.13` | Unified Azure OpenAI on the v1 API with unified-resource endpoints and GPT-5.4 / 5.5 / 5.6 support. |
| `1.0.14` | Completed Editor 2.0 and Drop export, reliable financial history, history-backed portfolio analysis, staged backup migration, and optional Windows release signing. |
| `1.0.15` | Completed the v2 AI analysis protocol, further Electron/storage/share-editor modularization, feedback-message consolidation, storage-rule unification, and Tailwind removal. |
| `1.0.16` | Reduced home-page history loading and added clean Windows CI, repeatable release candidates, artifact verification, and release-metadata safeguards. |

## Install and Run

### Installer

Release file: `dist/card-vault-1.0.16-setup.exe`

- Uses an installation wizard and supports a user-selected installation directory.
- Installing a newer build of the same application normally replaces program files without deleting collection data.
- Releases can be generated without a signing certificate, but Windows may display an unknown-publisher or SmartScreen warning.
- When OV/EV credentials or Microsoft Artifact Signing are configured, the build signs automatically; a new OV certificate may still need time to build SmartScreen reputation.

### Portable Build

Release file: `dist/card-vault-1.0.16-portable.zip`

1. Extract the complete ZIP.
2. Run `Card Vault.exe` from the extracted directory.
3. Keep the directory intact; the executable depends on the adjacent runtime files.

The portable release is suitable for testing, temporary use, external drives, and quick distribution. It is a ZIP containing a complete runtime, not a single-file portable executable.

### Local Development

Initial preparation:

```bash
npm ci
npm run db:init
npm run build
```

Start the Windows desktop app with:

```bat
start-desktop.bat
```

Or run:

```bash
npm run electron
```

Development mode stores desktop configuration under `%APPDATA%\Card Vault Development`. On first use it inherits only the previous development storage path and AI configuration; it does not move or clean collection data.

## Data and Backup

Card Vault data consists of the SQLite database and managed media directories:

- `dev.db`: cards, share collections, and related records.
- `uploads`: card images.
- `share-covers`: custom share covers.
- `share-backgrounds`: custom share backgrounds.
- `schema-backups`: pre-migration database snapshots.

Settings supports:

- Changing the active data directory.
- Checking SQLite integrity, missing files, and unreferenced files under Data Storage.
- Reviewing unreferenced files, locating them in Explorer, and cleaning them after confirmation.
- Selecting a separate backup destination and creating a complete backup.
- Restoring from a dated backup folder or a specific data folder after automatically creating a safety copy of current data.
- Backup, restore, health checks, and cleanup run in a separate storage process; Settings reports the current stage and progress while the desktop shell remains responsive.

Use the in-app backup workflow when moving to another computer. Copying only the database or only the images produces an incomplete collection. See the [Chinese Data Backup Guide](./docs/data-backup-guide.md) for the detailed workflow.

## AI Features

- Global configuration is under Settings → AI Settings and supports Azure OpenAI and MiniMax.
- Recognition, share copy, and portfolio analysis use the same active provider.
- API keys stay in the local user configuration and are encrypted with Windows `safeStorage`; they are not written to Git, SQLite, or release packages.
- If Windows cannot decrypt a legacy key, Card Vault keeps the endpoint, deployment, and model and asks for the API key once more.
- Recognition accepts one or two front/back `jpg/png/webp` images and fills empty fields by default.
- Portfolio analysis sends only aggregate statistics for the current result set and is not investment or trading advice.
- Connection errors distinguish the local service from upstream network, endpoint, proxy, and provider failures.
- Azure OpenAI uses only the `v1` API. Enter the resource root endpoint (`.openai.azure.com` or `.services.ai.azure.com`) and the deployment name created in Azure.
- GPT-5.4 / GPT-5.5 / GPT-5.6 requests use `/openai/v1/chat/completions`; dated `api-version` configuration is no longer retained, and GPT-5 reasoning requests omit the unsupported `temperature` parameter.

## Share Galleries

- Share collections are independent from the local Showcase and contain only explicitly selected cards.
- Editor 2.0 separates Content, Visual, Sections, and per-card presentation into focused workspaces while retaining a continuously updated preview.
- Live preview switches between desktop and mobile widths; preview, static export, and Cloudflare Drop packages continue to share one renderer.
- Titles, introductions, narratives, sections, themes, layouts, covers, backgrounds, and per-card overrides remain editable.
- General, Sport, and Team themes use the same renderer in preview, static exports, and Cloudflare Drop packages.
- Static export uses a strict public-field allowlist and excludes prices, costs, purchase sources, private notes, AI keys, and local paths.
- Cloudflare Drop packages validate broken references, private fields, file count, and per-file size, and include noindex metadata, a 404 page, a content manifest, and one-hour preview guidance.
- Card Vault does not retain temporary Drop URLs or claim links; permanent publishing, update, revoke, and online verification remain future work.

See [Share Gallery Editor 2.0](./docs/share-editor-2.0.md) for its boundaries, delivered phase, and planned iterations.
See [Cloudflare Drop temporary publishing](./docs/cloudflare-drop-publishing.md) for the package checks and privacy boundaries.
See [Financial history model](./docs/financial-history-model.md) for storage rules, constraints, and legacy migration behavior.

## Financial History

- Initial card entry creates separate purchase, grading-expense, and valuation records.
- Editing card metadata never overwrites financial history; transactions, expenses, and valuations are maintained on the card detail page.
- The detail page provides separate CNY/USD summaries, a unified timeline, record correction, and deletion. Valuation sources are limited to Personal estimate, Recent sale, or Platform quote.
- Legacy financial fields remain CNY-only compatibility snapshots for flows not yet migrated; home valuation and portfolio analysis both read financial history directly.
- Home-page total valuation uses exactly the latest dated valuation for every card in the current filtered result. CNY and USD use matching ISO-code typography, regardless of collection status, without summing older valuation history.
- Home portfolio analysis summarizes actual transactions, expenses, and latest valuations separately for CNY and USD, including active cost basis, net cash invested, comparable unrealized return, valuation age, and sources without implicit FX conversion or fabricated realized returns.
- Restoring an older backup runs all pending migrations and integrity checks in staging before replacing current data, including normalization of restored valuation sources to Personal estimate.

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Create the Next.js production build. |
| `npm run typecheck` | Run TypeScript checks. |
| `npm run check:encoding` | Check UTF-8 and known Chinese mojibake patterns. |
| `npm run check:metadata` | Verify version, lockfile, README, and release-note consistency. |
| `npm test` | Run the core automated test suite. |
| `npm run test:card` | Verify card create, upload, edit, and detail flows. |
| `npm run test:share` | Verify share create, edit save, preview, and export flows. |
| `npm run check:release` | Run all pre-release checks without creating distributions. |
| `npm run release:win` | Verify and create the installer and portable ZIP. |
| `npm run verify:release-artifacts` | Verify the installer, portable ZIP, and SHA-256 manifest. |
| `npm run clean:cache` | Remove regenerable caches and logs. |

## Git and Generated Files

GitHub should primarily contain source code, documentation, and configuration. `.gitignore` excludes local or regenerable content such as:

- `.env` / `.env.local`: may contain API keys and machine-specific configuration.
- `node_modules`: large installed dependencies that `npm install` can recreate.
- `.next`: generated by `npm run build`.
- `data`, local databases, and uploads: personal collection data.
- `logs` and caches: local runtime and diagnostic output.

Whether to track `dist` is a repository policy choice. Publishing the installer and portable ZIP through GitHub Releases usually keeps the source repository smaller and clearer.

Windows code signing is an optional enhancement and no longer blocks routine packaging. See the [Windows Code Signing Guide](./docs/windows-code-signing.md) for PFX, certificate-store/EV, and Microsoft Artifact Signing setup. Never store certificate files or passwords in the repository or `.env`.

## Project Structure

- `app/`: pages, API routes, and Server Actions.
- `components/`: forms, filters, settings, and gallery UI.
- `lib/`: database, AI, image, statistics, and export logic.
- `electron/`: desktop main process, preload bridge, storage, and AI configuration.
- `prisma/`: database schema.
- `scripts/`: migration, checking, E2E, and release scripts.
- `tests/`: business-rule, data-safety, and export regression tests.

## Roadmap

The confirmed version sequence is:

1. `v1.1.0`: Card Entry Workbench 2.0.
2. `v1.2.0`: Position quantity, partial sales, and return accounting.
3. `v1.3.0`: Collection Portfolio Center and trend analytics.
4. `v1.4.0`: Share Gallery 3.0.
5. `v1.5.0`: Batch Data and Migration Center.
6. `v1.6.0`: Reminders and Collection Planning.
7. `v2.0.0`: Optional managed publishing and multi-device sync after permanent infrastructure is available.

See the [Card Vault Product Roadmap](./docs/product-roadmap.en.md) for version scope, exclusions, risk controls, and shared release standards.

## Technology

`Next.js 16`, `React 19`, `TypeScript`, `Prisma`, `SQLite`, `Electron`, and custom CSS
