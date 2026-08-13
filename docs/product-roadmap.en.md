# Card Vault Product Roadmap

Last confirmed: 2026-08-13.

This document records the product direction after v1.0.16. The roadmap may be adjusted in response to real usage, data-safety concerns, and platform availability, while preserving the agreed product principles and overall sequence.

## Product Direction

Card Vault will remain a local-first sports-card collection manager and gradually grow from a collection archive into a personal collection asset-management and presentation platform.

Development follows four connected tracks:

1. Faster collection entry and maintenance.
2. Traceable position and return accounting.
3. Deterministic portfolio analytics with AI-assisted interpretation.
4. Higher-quality sharing, followed by optional managed publishing and sync when infrastructure is ready.

## Principles

- Improve frequent workflows before adding infrequent advanced features.
- Core local features must not require an account or continuous connectivity.
- Collection data, media, and financial history remain local by default.
- The application calculates money, ratios, returns, and trends; AI recognizes, explains, summarizes, and suggests.
- CNY and USD remain separate unless the user supplies or confirms a dated exchange rate.
- Do not combine a high-risk data migration with a major UI redesign in one release.
- Keep Cloudflare Drop as a manual temporary publishing channel until permanent infrastructure exists.
- Feature growth must preserve the backup, recovery, testing, and repeatable-release baseline established in v1.0.16.

## Version Overview

| Version | Theme | Primary value |
| --- | --- | --- |
| `v1.1.0` | Card Entry Workbench 2.0 | Faster continuous entry, batch preparation, and duplicate review. |
| `v1.2.0` | Positions and Returns | Quantities, multiple purchases, partial sales, and traceable returns. |
| `v1.3.0` | Collection Portfolio Center | Trends, concentration, data quality, and saved collection views. |
| `v1.4.0` | Share Gallery 3.0 | Better output quality, responsive presentation, and large-gallery performance. |
| `v1.5.0` | Batch Data and Migration Center | Import, bulk edit, export, deduplication, and computer migration reports. |
| `v1.6.0` | Reminders and Collection Planning | Local reminders, wish lists, budgets, and maintenance queues. |
| `v2.0.0` | Optional Online Services | Managed publishing, permissions, and multi-device sync when infrastructure is ready. |

## v1.1.0 — Card Entry Workbench 2.0

Deliver continuous entry, batch-image queues, review-before-write AI recognition, reusable field templates, copy-as-new, draft recovery, duplicate candidates, image preparation, keyboard workflows, and field-level confidence. A single failed batch item must not discard other work, and AI must never write confirmed collection data without user review.

## v1.2.0 — Positions and Returns

Separate card identity, position quantity, and transaction facts. Add multiple purchases, partial sales, refunds, reversals, linked expenses, remaining cost, realized return, unrealized return, and total return. Start with one explicit cost-allocation method, preferably moving average. Keep currencies separate and store any user-confirmed dated FX rate. Treat this as an isolated high-risk database release with snapshots, rollback, and old-backup recovery coverage.

## v1.3.0 — Collection Portfolio Center

Create a dedicated portfolio page for value, cost, realized and unrealized return trends; concentration by collection dimensions; 30/90/180-day valuation changes; valuation age and source quality; incomplete-data queues; high-value and high-cost positions; sold-card review; saved collection views; comparison between views or dates; and stored analysis snapshots. AI conclusions must cite deterministic evidence and their applicable scope.

## v1.4.0 — Share Gallery 3.0

Prioritize finished-output quality over adding more controls. Add a template library, desktop/tablet/mobile previews, image optimization, gallery and topic pages, card stories, typography and cover safety checks, accessibility checks, QR codes, export-difference summaries, lazy loading or pagination for large galleries, and visual regression baselines. Keep Cloudflare Drop manual and temporary; do not store its one-hour URL or claim link.

## v1.5.0 — Batch Data and Migration Center

Add CSV/XLSX mapping and preview, duplicate review, skip/replace/merge strategies, bulk status and metadata edits, batch valuations, public-field export, complete collection packages without AI credentials, computer-migration validation, backup notes, migration reports, and recoverable per-item failures.

## v1.6.0 — Reminders and Collection Planning

Add stale-valuation reminders, grading-duration reminders, long-listed reminders, wish lists, budgets, purchase plans, incomplete-record queues, a local notification center, and periodic collection summaries. Reminder data remains local by default.

## v2.0.0 — Optional Online Services

Begin only after permanent hosting, authentication, operations, and recovery responsibilities are clear. Candidate scope includes accounts, device authorization, encrypted sync, conflict handling, history recovery, object storage, permanent share links, publish/update/revoke permissions, release history, and optional access analytics. Never synchronize a live SQLite file through a generic cloud drive; record versions, operation logs, or server-side transactions are required. Local collection management must continue when the service is unavailable.

## Cross-Version Experience Standard

- Auto-save drafts for long forms and complex editors.
- Provide confirmation, undo, or safety backups for destructive actions.
- Show stage, progress, outcome, and recovery guidance for long-running work.
- Preserve user input after validation failures.
- Give empty states a clear next action.
- Avoid forcing navigation after successful saves.
- Support appropriate keyboard workflows.
- Allow partial success and retry in batch operations.
- Review backup, recovery, migration, and privacy implications for every new feature.

## Cross-Version Release Standard

Every formal release should include a lockfile-based clean install, UTF-8 and metadata checks, TypeScript checks, feature-specific tests, card and sharing HTTP end-to-end tests, a production build, packaged-runtime smoke tests, installer and portable-version verification, SHA-256 output, production dependency auditing, and updated documentation. Database releases additionally require pre-migration snapshots, rollback behavior, and old-backup recovery tests.

Before starting a version, split its scope into verifiable development batches. New requests should normally be assigned to the most relevant planned version. Record the reason and data risk when changing the sequence, and update this roadmap with actual delivery status after each release.
