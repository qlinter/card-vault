# Card Vault

[简体中文](./README.md) | English

Card Vault is a local-first sports-card collection manager for cataloging, organizing, searching, showcasing, and sharing a personal collection. It is built with `Next.js + React + Prisma + SQLite + Electron`; card data and images remain on the local computer by default and can be used offline.

## Current Version

`1.0.11`

### 1.0.11 Highlights

- Database upgrades now use ordered migrations and create a snapshot before adopting a legacy database.
- Settings adds data health checks, unreferenced-file review and location in Explorer, confirmed cleanup, complete backup, and in-app restore.
- AI API keys are encrypted with Windows `safeStorage`; an unreadable legacy key no longer blocks startup and can be replaced from Settings.
- Home adds AI portfolio analysis using allowlisted aggregate data only, without images or private notes.
- Fixed development builds reusing a stale local service; each desktop session now owns its server and terminates the full process tree on exit.
- Fixed preload bridge failures, incorrect non-desktop AI messages, and unhelpful `Failed to fetch` theme errors.
- Fixed missing feedback when saving edited share collections while retaining the native Server Action path.
- The release pipeline now requires encoding, type, unit, production-build, card/share E2E, packaged-runtime, and SHA-256 verification.

## Core Features

- Create, edit, delete, and inspect cards with up to five images per card.
- Search, filter, and sort by player, sport, team, year, product line, grade, autograph, patch, and collection status.
- Track purchase price, grading fee, total investment, valuation, grading, collection status, and visibility.
- Browse the Showcase by player or group, with collapsible navigation and multi-image card views.
- Use Azure OpenAI or MiniMax for AI card recognition, gallery copy, and portfolio analysis.
- Build editable share galleries with themes, layouts, sections, covers, backgrounds, and per-card presentation overrides.
- Export standalone static galleries and server-ready static hosting packages.
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

## Install and Run

### Installer

File: `dist/card-vault-1.0.11-setup.exe`

- Uses an installation wizard and supports a user-selected installation directory.
- Installing a newer build of the same application normally replaces program files without deleting collection data.
- Current releases are not code-signed, so Windows may show a security warning on first launch.

### Portable Build

File: `dist/card-vault-1.0.11-portable.zip`

1. Extract the complete ZIP.
2. Run `Card Vault.exe` from the extracted directory.
3. Keep the directory intact; the executable depends on the adjacent runtime files.

The portable release is suitable for testing, temporary use, external drives, and quick distribution. It is a ZIP containing a complete runtime, not a single-file portable executable.

### Local Development

Initial preparation:

```bash
npm install
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

Use the in-app backup workflow when moving to another computer. Copying only the database or only the images produces an incomplete collection. See the [Chinese Data Backup Guide](./数据备份说明.md) for the detailed workflow.

## AI Features

- Global configuration is under Settings → AI Settings and supports Azure OpenAI and MiniMax.
- Recognition, share copy, and portfolio analysis use the same active provider.
- API keys stay in the local user configuration and are encrypted with Windows `safeStorage`; they are not written to Git, SQLite, or release packages.
- If Windows cannot decrypt a legacy key, Card Vault keeps the endpoint, deployment, and model and asks for the API key once more.
- Recognition accepts one or two front/back `jpg/png/webp` images and fills empty fields by default.
- Portfolio analysis sends only aggregate statistics for the current result set and is not investment or trading advice.
- Connection errors distinguish the local service from upstream network, endpoint, proxy, and provider failures.

## Share Galleries

- Share collections are independent from the local Showcase and contain only explicitly selected cards.
- Titles, introductions, narratives, sections, themes, layouts, covers, backgrounds, and per-card overrides remain editable.
- General, Sport, and Team themes use the same renderer in preview, static exports, and cloud packages.
- Static export uses a strict public-field allowlist and excludes prices, costs, purchase sources, private notes, AI keys, and local paths.
- Cloud packages include static-server deployment guidance; in-app publish, update, revoke, and URL management are not implemented yet.

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Create the Next.js production build. |
| `npm run typecheck` | Run TypeScript checks. |
| `npm run check:encoding` | Check UTF-8 and known Chinese mojibake patterns. |
| `npm test` | Run the core automated test suite. |
| `npm run test:card` | Verify card create, upload, edit, and detail flows. |
| `npm run test:share` | Verify share create, edit save, preview, and export flows. |
| `npm run check:release` | Run all pre-release checks without creating distributions. |
| `npm run release:win` | Verify and create the installer and portable ZIP. |
| `npm run clean:cache` | Remove regenerable caches and logs. |

## Git and Generated Files

GitHub should primarily contain source code, documentation, and configuration. `.gitignore` excludes local or regenerable content such as:

- `.env` / `.env.local`: may contain API keys and machine-specific configuration.
- `node_modules`: large installed dependencies that `npm install` can recreate.
- `.next`: generated by `npm run build`.
- `data`, local databases, and uploads: personal collection data.
- `logs` and caches: local runtime and diagnostic output.

Whether to track `dist` is a repository policy choice. Publishing the installer and portable ZIP through GitHub Releases usually keeps the source repository smaller and clearer.

## Project Structure

- `app/`: pages, API routes, and Server Actions.
- `components/`: forms, filters, settings, and gallery UI.
- `lib/`: database, AI, image, statistics, and export logic.
- `electron/`: desktop main process, preload bridge, storage, and AI configuration.
- `prisma/`: database schema.
- `scripts/`: migration, checking, E2E, and release scripts.
- `tests/`: business-rule, data-safety, and export regression tests.

## Roadmap

- Complete managed cloud publishing, update, revoke, URL, and visibility workflows.
- Add recognition confidence, batch ingestion, and duplicate-card warnings.
- Introduce separate transaction, expense, and valuation-history models.
- Expand portfolio analytics, transaction records, and AI valuation after historical data is reliable.

## Technology

`Next.js 15`, `React 19`, `TypeScript`, `Prisma`, `SQLite`, `Electron`, and `Tailwind CSS`
