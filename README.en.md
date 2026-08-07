# Card Vault

English | [Chinese](./README.md)

Card Vault is a local-first sports card collection manager for cataloging, filtering, presenting, and maintaining a personal collection on the desktop.

It is built with `Next.js + React + Prisma + SQLite + Electron`. Card data and images are stored locally by default, making the application suitable for offline use. The desktop app also supports moving the data directory to a user-selected location.

## Current Version

- `1.0.10`

## Release History

### 1.0.0 - Initial Release

- Create, edit, and delete sports cards.
- Upload and store up to five card images locally.
- Search, filter, and sort a personal collection.
- View card images, card details, purchase data, grading data, and notes.
- Browse all cards through Showcase and individual showcase detail pages.
- Run as an Electron desktop application with local SQLite storage.
- Keep the image directory separate from the database and change the desktop storage location.
- Build Windows installer and portable distributions.

### 1.0.1

- Added collapsible player groups, collection statistics, and card counts to Showcase.
- Improved card and image navigation on showcase detail pages.
- Added home-page card counts while retaining total valuation.
- Preserved form values after card creation errors.
- Added multi-image selection and standardized the limit at five images per card.
- Allowed free-form years and grading values.
- Replaced the numbered-card filter with a `Patch/Jersey` filter.
- Cleaned up and standardized Chinese interface and documentation copy.

### 1.0.2

- Added grading fee and total investment fields.
- Calculate `total investment = purchase price + grading fee` in both the form and server save flow.
- Added the new cost fields to card detail pages.
- Fixed the incorrect `NEXT_REDIRECT` message after successful card creation.
- Applied the product icon to packaged Windows releases.
- Updated SQLite initialization and migration scripts.

### 1.0.3

- Added brand, product line, subset, parallel, rookie status, autograph type, patch type, certificate number, visibility, and collection status.
- Removed the duplicate series field and migrate existing series data into product line.
- Added Private, Public, and Link Only visibility options.
- Expanded keyword search and advanced filters across the new card fields.
- Preserved expanded filter state when advanced conditions are active.
- Ensured extended fields are retained when editing existing cards.
- Added migration compatibility and further encoding checks.

### 1.0.4

- Added a top-level Settings page and shared global AI configuration between card creation and editing.
- Added Azure OpenAI and MiniMax with independent endpoint, key, model, and deployment settings.
- Added model discovery and connection testing.
- Added AI-assisted entry from one or two front/back card images.
- Added AI filling for existing cards from their current default image or newly selected images.
- Preserve existing values by default, with an explicit overwrite option.
- Generate Chinese public descriptions focused on the athlete's career, achievements, and the card's collecting significance; notes remain empty.
- Improved MiniMax parsing for non-strict JSON and multi-part responses.
- Standardized UTF-8 and LF, added encoding checks, and generate Prisma Client after `npm install`.

### 1.0.5

- Added a top-level Share page and persistent share collection models.
- Added title, subtitle, introduction, cover, gallery narrative, card order, and per-card display overrides.
- Added a public-field export whitelist that excludes private costs, notes, AI keys, and local paths.
- Rebuilt share creation as a four-step wizard: select cards, generate with AI, edit content, and confirm.
- Added search and collapsible sport groups to card selection.
- Added automatic and custom covers stored separately in `share-covers`.
- Added editable Chinese gallery copy generation through the active global AI provider.
- Added multi-card preview, static export, and generic cloud publishing packages.
- Added `README-deploy-cloud.md` and `nginx-card-vault-share.conf` to cloud packages.
- Shared AI JSON extraction and thinking-content cleanup between card recognition and gallery generation.
- Fixed Azure OpenAI and MiniMax theme-generation parsing errors.
- Standardized product naming, button hierarchy, page visuals, and desktop branding.
- Added `home-bg.webp`, `showcase-bg.webp`, `shares-bg.webp`, and `settings-bg.webp`.
- Added cache and TypeScript checks and excluded `.env` from packaged releases.

### 1.0.6

- Moved storage path controls from Home to Settings.
- Added an independent backup destination and one-click full data backup.
- Store backups under dated folders and avoid overwriting repeated same-day backups.
- Prevent selecting a backup destination inside the active data directory.
- Standardized Settings modules and corrected AI-related Chinese copy.
- Updated the README and data backup guide.

### 1.0.7

- Added a custom background image for each share collection, stored in `share-backgrounds`.
- Applied the same background to in-app preview and exported galleries.
- Added background upload, retention, and removal controls.
- Expanded per-card title, description, and order overrides.
- Added 3D card switching with click navigation on desktop and swipe navigation on mobile.
- Added `assets/site.js` to exported packages.
- Kept the complete gallery experience in static and cloud packages.
- Assign automatic order by selection sequence when no manual order is supplied.
- Return to the Share list after saving a new collection.
- Updated database initialization for the share background field.

### 1.0.8

`1.0.8` focused on stability, data safety, desktop reliability, performance, and maintainability.

#### Behavior and Data Safety

- Home-page total valuation includes only cards marked Held, For Sale, or At Grading. Sold and Target cards are excluded.
- Removed grade ascending and grade descending sorting.
- Storage migration now moves card images, share covers, and share backgrounds together.
- One-click backup creates a consistent SQLite snapshot and runs an integrity check.
- Added a 15 MB limit, real file-type validation, and safe extensions to all uploaded card and share images.
- Clean up unused files after failed saves and remove superseded share assets.

#### Reliability and Maintenance

- Added Electron single-instance protection, service identity checks, and automatic port fallback.
- Shared form conversion logic and image response utilities.
- Reduced database reads to the first image where only a thumbnail is needed.
- Shared one AI request client between Azure OpenAI and MiniMax.
- Split share export into orchestration, public mapping, rendering, types, and ZIP modules.
- Enabled unused TypeScript symbol checks and added automated tests for core business and safety rules.
- Added `npm test` and `npm run check:release`.

### 1.0.9

`1.0.9` completes the first major gallery theme system and improves browsing, export consistency, and regression coverage.

#### Gallery Themes

- Added a persistent `theme` field. Existing share collections default to Spotlight Gallery.
- Grouped themes into General, Sport, and Team categories.
- Included Spotlight Gallery, Classic Archive, Football Stadium, Basketball Home Court, Tennis Center, F1 Pit Lane, and two Nerazzurri themes.
- Added an independent background image to every built-in theme. A user-uploaded background takes priority.
- Converted built-in theme and main application backgrounds to high-quality WebP at their original dimensions.
- Shared theme configuration between preview, static packages, and cloud packages, with theme assets copied into every export.

#### Gallery Experience

- Simplified the 3D carousel to show card images only while keeping complete information in the detail section below.
- Applied consistent rounded clipping and retained click navigation on desktop and swipe navigation on mobile.
- Replaced the full-page dark overlay with localized transparent glass panels, text shadows, and light blur.
- Kept Preview, Edit, Export, and Delete on one row for every share collection, including narrow screens.
- Return to the Share list after saving edits and show the export public-field whitelist.

#### Quality

- Removed unused carousel copy, badges, borders, and theme overlay styles.
- Consolidated duplicate background and glass-panel rules.
- Replaced repeated traversal in carousel and theme lookup with direct indexing.
- Added share theme unit tests and browser regression tests for list, create, edit, preview, export, and theme assets.
- Added `npm run test:share` to `npm run check:release`.

### 1.0.10

`1.0.10` upgrades Share galleries from theme-based pages into structured, editable digital exhibitions.

#### Layout and Visual Controls

- Added three structural layouts: Immersive Stage, Collector Archive, and Home Arena.
- Centralized text, accent, panel, and divider colors as reusable theme design tokens.
- Added horizontal and vertical background focal-point controls for better cropping across screen sizes.
- Added adjustable information-panel opacity to balance readability with background artwork.
- Added dedicated responsive behavior for desktop and mobile while preserving touch navigation.

#### Section-Based Editing

- Added sortable gallery sections with titles, descriptions, and Editorial, Rail, or Grid layouts.
- Cards can be assigned to one section, while unassigned cards remain available in the main gallery area.
- AI-generated narrative, highlights, and grouping notes are converted into editable section drafts.
- Added a live gallery preview to the Share editor for layout, theme, background, and section changes.

#### Consistency and Maintenance

- App preview, static export, and cloud export now use the same HTML, CSS, and interaction renderer.
- Added versioned presentation settings and a persistent section data model with fallback support for existing shares.
- Removed the legacy React share-preview component and centralized carousel, theme, and responsive behavior.
- Extended automated coverage for presentation parsing, theme tokens, section persistence, all three layouts, and unified preview rendering.
- `1.0.10` automatically updates the local database schema. A full backup is recommended before upgrading.

## Main Features

- Create, edit, and delete sports cards.
- Upload up to five images per card.
- Use one or two front/back images for AI-assisted card recognition with Azure OpenAI or MiniMax.
- Fill existing cards from their saved images while preserving current fields by default.
- Search, filter, sort, and count cards across detailed collection fields.
- Track purchase price, grading fee, total investment, valuation, grading, and collection status.
- Browse player groups and individual cards in Showcase.
- Create curated share collections from selected cards.
- Generate editable Chinese gallery titles, introductions, narratives, highlights, and grouping copy with AI.
- Customize gallery themes, backgrounds, covers, per-card display overrides, and an image-only 3D carousel.
- Export standalone static galleries and server-ready cloud packages.
- Store data locally in SQLite and run as an Electron desktop app.
- Configure an independent backup destination and create a complete backup from Settings.

## Technology Stack

- `Next.js 15`
- `React 19`
- `TypeScript`
- `Prisma`
- `SQLite`
- `Electron`
- `Tailwind CSS`

## Project Structure

- `app/`: Next.js App Router pages, detail pages, Showcase, and Server Actions.
- `components/`: forms, filters, gallery components, and desktop settings.
- `lib/`: Prisma access, AI clients, filtering and statistics, image validation, storage resolution, and share export modules.
- `electron/`: Electron main process, preload scripts, and local storage migration.
- `scripts/`: database initialization, local build preparation, icon generation, and maintenance utilities.
- `prisma/`: Prisma schema and local SQLite definitions.
- `public/`: static assets.
- `tests/`: automated tests for business rules, data safety, and export structure.

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Prisma Client

```bash
npm run prisma:generate
```

### 3. Initialize the Local Database

```bash
npm run db:init
```

### 4. Build the Next.js Application

```bash
npm run build
```

### 5. Start the Desktop Application

```bash
npm run electron
```

On Windows, you can also run:

```bat
start-desktop.bat
```

`start-desktop.bat` starts development mode. The packaged installer and portable builds use the application icon and production runtime.

## Windows Releases

Both Windows distributions are self-contained and do not require Node.js or `npm install` on the target computer.

### Installer

- File: `dist/card-vault-1.0.9-setup.exe`
- Uses an installation wizard and supports a user-selected installation directory.
- Best suited to regular long-term use.

### Portable Build

- File: `dist/card-vault-1.0.9-portable.zip`
- Extract the complete archive and run `Card Vault.exe`.
- Keep the extracted directory intact rather than moving the executable by itself.
- Best suited to testing, temporary use, external drives, and quick distribution.

The packaging process also keeps `dist/win-unpacked/` for local inspection. The current release is not code-signed, so Windows may show a security warning on first launch.

## Common Scripts

- `npm run build`: build the Next.js application.
- `npm run check:encoding`: detect common Chinese mojibake and invalid UTF-8 source content.
- `npm run typecheck`: run TypeScript type checking.
- `npm test`: run the core automated test suite.
- `npm run test:share`: run Share list, creation, editing, preview, and export browser regression tests in a temporary data environment.
- `npm run check:release`: run encoding checks, type checks, automated tests, a production build, and share browser regression tests.
- `npm run clean:cache`: remove regenerable caches and logs.
- `npm run start`: start the Next.js production server.
- `npm run electron`: start the Electron desktop app.
- `npm run prepare:local`: prepare the local desktop build.
- `npm run db:init`: initialize or migrate the local database.
- `npm run prisma:generate`: generate Prisma Client.
- `npm run dist:win`: build the Windows installer and `win-unpacked` portable directory.

## AI-Assisted Card Recognition

The top-level Settings page contains global AI configuration. New-card and edit-card pages provide AI recognition and filling controls. Azure OpenAI and MiniMax are currently supported.

- The desktop app stores AI settings in `ai-config.json` inside the local user-data directory. They are not written to Git or the card database.
- Azure OpenAI configuration includes Endpoint, API Key, Deployment, and API Version.
- MiniMax configuration includes API Endpoint, API Key, and Model.
- Development mode can use `CARD_VAULT_AI_PROVIDER` in `.env.local` with provider-specific `AZURE_OPENAI_*` or `MINIMAX_*` variables.
- Recognition accepts one or two `jpg/png/webp` images for front and back card photos.
- Existing cards can be filled from their current default image.
- AI output is a suggestion only and remains editable before saving.
- Empty fields are filled by default. Existing values are replaced only when overwrite is enabled.

## Sharing and Cloud Publishing

Share collections are separate from the local Showcase and contain only cards selected by the user.

- Configure titles, subtitles, introductions, narratives, highlights, grouping copy, covers, and backgrounds.
- Choose a General, Sport, or Team theme and apply it consistently to preview and exported packages.
- Generate editable Chinese gallery copy with the active global AI provider.
- Store custom covers in `share-covers` and custom backgrounds in `share-backgrounds`.
- Override a card's display title, description, and order without changing the original card record.
- Use an image-only 3D carousel with click controls on desktop and swipe controls on mobile.
- Static export creates standalone HTML, CSS, images, data, and a ZIP archive.
- Cloud packages also include `README-deploy-cloud.md` and `nginx-card-vault-share.conf` for static server deployment.
- Relative paths allow the same package to open locally or run on a static host.
- A strict public-field whitelist excludes private costs, purchase source, notes, AI keys, and local database paths.

## Data Storage and Backup

Card Vault is local-first.

- Card metadata is stored in SQLite.
- Card images are stored in `uploads`.
- Custom share covers are stored in `share-covers`.
- Custom share backgrounds are stored in `share-backgrounds`.
- The desktop app supports changing the active storage path.
- Settings supports a separate backup path. One-click backup copies image assets and creates an integrity-checked SQLite snapshot.

The default development database is:

```text
prisma/dev.db
```

The packaged desktop app normally uses its own data directory rather than the database in the project root.

- [Data Backup Guide (Chinese)](./数据备份说明.md)

## GitHub and Local Runtime Files

Do not normally commit the following local or generated content:

- `.env` and `.env.local`
- `node_modules`
- `.next`
- `dist`
- `data`
- local database files and uploaded images

GitHub should contain source code, documentation, and configuration. Use the installer or portable package to distribute a runnable application to another computer.

Some ignored directories are still required for local development. Deleting `node_modules` requires `npm install`, while deleting the complete `.next` directory requires `npm run build` before production startup.

## Project Size and Maintenance

Most of the development directory size comes from `node_modules`, which contains installed Electron, Next.js, Prisma, TypeScript, and related dependencies rather than project source code.

- Safe to clean: `.next/cache`, `logs`, `tsconfig.tsbuildinfo`, and obsolete `dist` artifacts.
- Clean with care: removing all of `.next` requires a new production build.
- Avoid casual removal: deleting `node_modules` requires reinstalling dependencies.
- Never commit personal databases, uploaded images, AI keys, or local environment files.

Recommended release check:

```bash
npm run clean:cache
npm run check:release
```

The sharing feature has been merged into `master`. Develop new features on a separate branch, run the release checks, and verify key desktop workflows before merging.

## Cross-Device Sync and Encoding

Source files use `UTF-8`, with common text encoding and line-ending rules enforced by `.editorconfig` and `.gitattributes`.

- Use an editor that supports `.editorconfig` and save source files as UTF-8.
- Do not resave `.ts`, `.tsx`, `.js`, `.md`, or other source files with GBK, ANSI, or a system-default encoding.
- Run `npm run check:encoding` before committing.
- Move collection data separately through the backup workflow instead of GitHub.

## Roadmap

- More control over share layouts, typography, colors, sections, and card grouping.
- Mobile card flipping, image zoom, swipe navigation, and immersive browsing.
- Stronger visual consistency checks between in-app preview and static export.
- AI field confidence, batch ingestion, and duplicate-card warnings.
- Server publishing through SSH/SFTP after static export remains stable.

## Notes

Card Vault is designed primarily for local use, so its desktop and data-directory behavior is more involved than a typical web project. Keep this README, the [Chinese README](./README.md), and the [Data Backup Guide (Chinese)](./数据备份说明.md) so contributors can understand the product and its storage model.
