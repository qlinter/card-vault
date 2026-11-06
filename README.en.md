# Card Vault

[简体中文](./README.md) | English

Card Vault is a local-first Windows sports-card collection application built with Next.js, React, Prisma, SQLite and Electron. Archives, images and financial history stay on the computer; AI and share hosting are optional external services.

## Current version

Source version: `1.5.2`, finalized. Collection Recaps, Immersive Viewing, the AI deletion fix and verification results are maintained in the [v1.5.2 version notes](./docs/release-v1.5.2.md).

The Windows x64 installer `card-vault-1.5.2-setup.exe` and portable archive `card-vault-1.5.2-portable.zip` have been built and passed full release verification. The [download page](https://github.com/qlinter/card-vault/releases/tag/v1.5.2) also provides SHA-256 checksums and the build manifest. These files are unsigned; Windows may display Unknown Publisher or SmartScreen prompts.

## Main capabilities

- Collection management: search and filters, grid/list views, up to five images, drafts, templates, batch entry and AI suggestions requiring manual review.
- Finance and statistics: transactions, expenses, valuations, physical quantities, manual exchange rates, Overview/Trends/Structure/Details and Collection Recaps.
- Viewing and sharing: full-image collection walls, detailed image viewing, four immersive gallery styles, editable share collections and static website exports.
- Data and settings: CSV/XLSX import previews and conflict-aware undo, full backup/restore, Wishlist and Search, four application themes and device-local AI proxy settings.

There is no separate mobile app. Narrow-viewport checks mainly cover shared webpages and narrow desktop windows.

## Run locally

Use Node.js 24 and the project lockfile:

```powershell
npm ci
npm run db:init
npm run build
npm run electron
```

Alternatively, run `start-desktop.bat`. See [Development and maintenance](./docs/development.md) for setup, checks and code responsibilities, and [Windows distribution](./docs/windows-code-signing.md) for packaging and signing. Confirm the intended data path before database initialization.

## Documentation

The [documentation index](./docs/README.md) links current rules by feature. Everyday instructions are available inside the application under Settings → Help & version → User guide.

The complete bilingual summaries, original release results and development records are centralized in [Version history](./docs/history/README.md), rather than duplicated in both READMEs. Read [Data management and backups](./docs/data-guide.md) before upgrading, moving computers or restoring data.
