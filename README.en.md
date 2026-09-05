# Card Vault

[简体中文](./README.md) | English

Card Vault is a local-first sports-card collection manager for cataloging, organizing, searching, showcasing, and sharing a personal collection. It is built with `Next.js + React + Prisma + SQLite + Electron`; card data and images remain on the local computer by default and can be used offline.

## Current Version

`1.3.0`

### 1.3.0 Highlights

- One physical holding with mixed CNY/USD transaction components and cross-currency sales.
- Independent primary currency and manual exchange rate settings; effective dates are required, notes are optional, and rate history can be edited or deleted.
- Consistent home, detail, portfolio, trends, and frozen snapshots; missing costs, FX, and quotes remain explicitly incomplete.
- Backups pause the local service and validate database/media consistency.
- A globe button opens a language menu; desktop navigation aligns right.
- Database baseline 1.3.0. This source update does not include newly packaged Windows installers.

See the [v1.3.0 release notes](./docs/release-v1.3.0.md) for the complete delivered scope.

## Core Features

- Switch the interface live between Chinese and fully English; the selected language persists locally.
- Create, edit, delete, and inspect cards with up to five images per card; the card-subject field covers people, teams, and other subjects, while image rotation is stored without re-encoding originals.
- Browse the home collection through rebuildable 640px WebP thumbnails and incremental card batches while preserving every original image format and quality.
- Use SQLite drafts, continuous entry, public-field templates, duplicate review, and batch entry with WebP preparation, retry, AI candidate review, and front/back swapping.
- Search, filter, and sort by card subject, sport, team, year, product line, grade, autograph, patch, and collection status.
- Track purchases, sales, grading, other costs, holding quantity, and latest values through transaction, expense, and valuation history.
- Use the Portfolio Center for positions in the primary currency, reconstructed financial history, monthly activity, true 30/90/180-day valuation changes, valuation sources, primary and extended collection structures, top-value and top-cost positions, sold-card review, actionable data-quality queues, saved views, point-in-time snapshots, and financial or structural comparisons; content sections can be reordered by drag and retain their local layout.
- Browse the Showcase by card subject, with collapsible navigation, multi-image card views, and temporary image rotation.
- Use Azure OpenAI, MiniMax, or multiple named OpenAI Chat Completions-compatible custom providers for AI card recognition, gallery copy, and portfolio analysis.
- Build editable share galleries with gallery styles, independent themes, sections, covers, backgrounds, and per-card presentation overrides.
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
| `1.0.17` | Added multiple custom AI providers, more reliable five-dimension portfolio analysis, preserved filtered return context, and consolidated shared protocols and redundant code. |
| `1.0.18` | Improved home and portfolio-analysis rendering, hardened cross-computer dependency recovery, restored default GPU acceleration, and added a compact application-version entry. |
| `1.0.19` | Corrected serial-numbered data, added serial-numbered filtering and CNY cost/valuation sorting, and hardened the local service, Electron sandbox, IPC, and quality gates. |
| `1.1.0` | Delivered Card Entry Workbench 2.0 with draft recovery, continuous entry, batch-image preparation, templates, duplicate review, and confirmation-gated AI candidates. |
| `1.1.1` | Added position accounting, in-app restore, home thumbnails and incremental rendering, a 1/1 filter, and database/UI consolidation. |
| `1.2.0` | Completed the Portfolio Center, saved views, point-in-time snapshots, true historical trends and comparison, plus image rotation, card-subject terminology, and Showcase refinements. |
| `1.2.1` | Added bilingual UI, consolidated Share Gallery and preview/export improvements, optional Windows signing, and unified code and product documentation. |
| `1.3.0` | Unified mixed payments, physical positions, manual FX, reporting, frozen snapshots, and consistent backups. |

## Install and Run

### Installer

Release file: `dist/card-vault-1.3.0-setup.exe`

- Uses an installation wizard and supports a user-selected installation directory.
- Installing a newer build of the same application normally replaces program files without deleting collection data.
- Without a certificate, the release pipeline can generate unsigned artifacts; Windows will likely show Unknown Publisher or SmartScreen warnings.
- With a trusted OV/EV certificate or Microsoft Artifact Signing, the pipeline signs and validates the installer, executable, and timestamp automatically.

### Portable Build

Release file: `dist/card-vault-1.3.0-portable.zip`

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
The Prisma client is generated during dependency installation and production builds. Routine desktop startup does not regenerate it, avoiding Windows file-lock failures.

## Data and Backup

Card Vault data consists of the SQLite database and managed media directories:

- `dev.db`: cards, share collections, and related records.
- `uploads`: card images.
- `thumbnails`: rebuildable WebP cache for the home page; excluded from one-click backups and regenerated from originals after restore or when missing.
- `entry-queue`: source images for unfinished batch-entry items; successful preprocessing removes the corresponding source files.
- `share-covers`: custom share covers.
- `share-backgrounds`: custom share backgrounds.

Settings supports:

- Changing the active data directory.
- Checking SQLite integrity, missing files, and unreferenced files under Data Storage.
- Reviewing unreferenced files, locating them in Explorer, and cleaning them after confirmation.
- Selecting a separate backup destination and creating a complete backup.
- Restoring from a dated backup folder or a specific data folder after automatically creating a safety copy; the local service reconnects and refreshes the page without restarting Electron.
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
- Share creation keeps four steps: Select Cards, AI Generation, Edit Content, and Confirm & Save. The editor combines templates and layouts into Gallery Style, with Collector Spotlight, Archive Journal, and Arena Lineup as the initial styles.
- Live preview switches among desktop, tablet, and mobile widths; preview, static export, and Cloudflare Drop packages continue to share one renderer.
- Titles, introductions, narratives, sections, gallery styles, independent themes, covers, backgrounds, and per-card overrides remain editable.
- General, Sport, and Team themes include their background assets and use the same renderer in preview, static exports, and Cloudflare Drop packages.
- Multi-image controls use centered vector arrows; the in-app preview permits same-origin theme assets while continuing to isolate forms and top-level navigation.
- Static exports generate WebP display/thumbnail variants plus section and subject pages; large galleries use a 24-card featured carousel and a full collection browser revealed in 48-card segments.
- Static export uses a strict public-field allowlist and excludes prices, costs, purchase sources, private notes, AI keys, and local paths.
- Cloudflare Drop packages validate broken references, private fields, file count, and per-file size, and include noindex metadata, a 404 page, a content manifest, and one-hour preview guidance.
- Card Vault does not retain temporary Drop URLs or claim links; permanent publishing, update, revoke, and online verification remain future work.

See the canonical [Share Gallery specification](./docs/share-gallery.md) for the workflow, protocol, preview, export, and compatibility rules. The [documentation index](./docs/README.md) defines document responsibilities and maintenance standards.
See [Cloudflare Drop temporary publishing](./docs/cloudflare-drop-publishing.md) for the package checks and privacy boundaries.
See [Financial history model](./docs/financial-history-model.md) for storage rules, constraints, and current summary behavior.

## Financial History

- Initial card entry creates separate purchase, grading-expense, and valuation records.
- Editing card metadata never overwrites financial history; transactions, expenses, and valuations are maintained on the card detail page.
- The detail page retains original CNY/USD cost components and calculates complete costs and returns in the primary currency, with a unified timeline, record correction, and deletion.
- Home sorting, valuation totals, and portfolio analysis use financial history and dated manual exchange rates; legacy card summary fields remain for compatibility.
- Home total valuation uses remaining quantities and prioritizes direct quotes in the primary currency. Alternative quotes use the manual rate effective on their valuation date. Historical quotes are not added together, and valuation coverage is shown.
- Portfolio analysis aggregates transactions, expenses, and valuations in the primary currency using dated manual exchange rates. Missing data remain unavailable with an explanation; returns are never fabricated.
- Restore validates SQLite integrity and the current database baseline in staging before replacing current data. Official v1.1.0 and v1.1.1 backups remain supported through controlled upgrades; earlier schemas must first be upgraded with their corresponding older release.

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Create the Next.js production build. |
| `npm run typecheck` | Run TypeScript checks. |
| `npm run lint` | Check JavaScript, TypeScript, React Hooks, and JSX accessibility rules. |
| `npm run check:encoding` | Check UTF-8 and known Chinese mojibake patterns. |
| `npm run check:metadata` | Verify version, lockfile, README, and release-note consistency. |
| `npm run check:docs` | Verify documentation links, canonical specifications, and synchronized roadmap status. |
| `npm test` | Run the core automated test suite. |
| `npm run test:coverage` | Run automated tests with coverage thresholds. |
| `npm run audit:prod` | Check production dependencies for high-severity advisories. |
| `npm run test:card` | Verify card create, upload, edit, and detail flows. |
| `npm run test:share` | Verify share create, edit save, preview, and export flows. |
| `npm run test:security` | Verify desktop local-session tokens, Host/Origin enforcement, and security headers. |
| `npm run check:release` | Run all pre-release checks without creating distributions. |
| `npm run package:win` | Build a Windows installer for quick local testing. |
| `npm run release:win` | Run all gates and create the installer, portable ZIP, and SHA-256 manifest; sign automatically when credentials exist. |
| `npm run verify:release-artifacts` | Verify the installer, portable ZIP, signing mode, versions, and SHA-256 manifest. |
| `npm run clean:cache` | Remove regenerable caches and logs. |

## Git and Generated Files

GitHub should primarily contain source code, documentation, and configuration. `.gitignore` excludes local or regenerable content such as:

- `.env` / `.env.local`: may contain API keys and machine-specific configuration.
- `node_modules`: large installed dependencies that `npm install` can recreate.
- `.next`: generated by `npm run build`.
- `data`, local databases, and uploads: personal collection data.
- `logs` and caches: local runtime and diagnostic output.

Whether to track `dist` is a repository policy choice. Publishing the installer and portable ZIP through GitHub Releases usually keeps the source repository smaller and clearer.

Windows code signing is optional; unsigned releases produce more prominent system security warnings. See the [Windows Code Signing Guide](./docs/windows-code-signing.md) for unsigned releases, PFX, certificate-store/EV, Microsoft Artifact Signing, and GitHub Actions setup. Never store certificate files or passwords in the repository or `.env`.

## Project Structure

- `app/`: pages, API routes, and Server Actions.
- `components/`: forms, filters, settings, and gallery UI.
- `lib/`: database, AI, image, statistics, and export logic.
- `electron/`: desktop main process, preload bridge, storage, and AI configuration.
- `prisma/`: database schema.
- `scripts/`: database baseline, code/documentation checks, E2E, and release scripts.
- `tests/`: business-rule, data-safety, and export regression tests.
- `docs/`: canonical product specifications, roadmap, operating guides, and release history.

## Roadmap

The roadmap is organized by capability stage without locking version numbers in advance:

1. Batch Data and Migration Center.
2. Reminders and Collection Planning.
3. Optional managed publishing and multi-device sync after permanent infrastructure is available.

See the [Card Vault Product Roadmap](./docs/product-roadmap.en.md) for stage scope, exclusions, risk controls, and shared release standards. The release version is selected during stage closeout.

## Technology

`Next.js 16`, `React 19`, `TypeScript`, `Prisma`, `SQLite`, `Electron`, and custom CSS
