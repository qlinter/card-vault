# Card Vault

[简体中文](./README.md) | English

Card Vault is a local-first Windows sports-card collection application built with Next.js, React, Prisma, SQLite and Electron. Archives, images and financial history stay on the computer; AI and share hosting are optional external services.

## Current version

Current version: `1.6.0`. Local accounts, sign-in and recovery codes are described in the [v1.6.0 notes](./docs/release-v1.6.0.md).

Download the Windows x64 installer `card-vault-1.6.0-setup.exe`, portable archive `card-vault-1.6.0-portable.zip`, SHA-256 checksums, build manifest and validation record from the [v1.6.0 release](https://github.com/qlinter/card-vault/releases/tag/v1.6.0). These binaries are unsigned; Windows may show an Unknown Publisher warning.

## Main capabilities

- Local accounts: offline sign-in, sign-out, Windows screen-lock protection and recovery codes. Accounts stay separate from collection backups; access protection does not encrypt files.
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

Alternatively, run `start-desktop.bat`. See [Development and maintenance](./docs/development.md) for setup, checks and code responsibilities, and [Windows distribution](docs/development.md#windows-distribution) for packaging and signing. Confirm the intended data path before database initialization.

## Documentation

The [documentation index](./docs/README.md) links current rules by feature. Everyday instructions are available inside the application under Settings → Help & version → User guide.

The complete bilingual summaries, original release results and development records are centralized in [Version history](./docs/history/README.md), rather than duplicated in both READMEs. Read [Data management and backups](./docs/data-guide.md) before upgrading, moving computers or restoring data.
