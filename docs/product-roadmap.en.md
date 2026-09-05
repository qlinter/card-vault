# Card Vault Product Roadmap

Last confirmed: 2026-09-05.

This document records Card Vault's long-term product direction. It is organized by capability stage rather than preassigned version numbers. Actual release versions are chosen from completed scope, workload, and data risk while preserving the agreed principles and overall sequence.

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
- Do not combine a high-risk data migration with a major UI redesign in one development batch or formal release.
- Keep Cloudflare Drop as a manual temporary publishing channel until permanent infrastructure exists.
- Feature growth must preserve the established backup, recovery, local-session security, test-coverage, and repeatable-release baseline.

## Current Improvement Priorities (2026-09-05)

The review confirmed improvements to backup consistency, translation boundaries, database pagination, and visual regression checks. Multi-currency accounting now ranks ahead of performance and bulk features. Previously released capabilities still have remaining limitations.

| Order | Work | Status and acceptance focus |
| --- | --- | --- |
| 1 | Database and media backup consistency | Pending; concurrent card creation, edits, and deletion must not produce missing media in a backup reported as complete. |
| 2 | Multi-currency quantities, costs, valuations, and returns | Unified implementation has passed verification: physical quantities, original payments, manual FX settings, and all financial views share one reporting basis; see the [financial model](./financial-history-model.md). |
| 3 | Translation boundaries | Pending; protect user content first, then replace document-wide DOM translation incrementally. |
| 4 | Quality gates | Apply throughout development. Local lint and language interaction tests run again; fixed-environment visual comparisons and behavioral regressions for the first three items remain to be completed. |
| 5 | Language icon and navigation | Source updated in this batch: the globe opens a menu to select Simplified Chinese or English, with right-aligned desktop navigation and separate rows on narrow screens. The financial work is delivered as a separate unified batch; no new release package has been built. |
| 6 | Large-collection performance | Pending; database pagination and separate list/statistics queries, measured with 1,000/5,000/10,000 cards. |
| 7 | Frequent management workflows | Later batches; simpler entry, table view, bulk edits, CSV/XLSX import/export, and recovery from accidental changes. |
| 8 | Gallery visuals and advanced capabilities | Later batches; improve card prominence and readability before reminders and optional online services. |

The icon and navigation are independent, low-risk changes delivered early. Backup integrity and financial correctness remain the highest priorities. Pending items stay pending until implemented and verified; release versions are not preassigned.

## Confirmed Financial Plan: One Unified Development Batch

Status: the unified batch is implemented and verified. The requirements and internal acceptance steps below remain the agreed batch scope. The language menu and navigation have passed targeted verification and are not scheduled again. The user will replace the legacy database used by the launcher; do not add an upgrade path for that database. Future financial schema changes must use the actual database baseline present at implementation time, without clearing or overwriting existing collections.

Fix backup consistency first, then deliver the schema, accounting engine, manual FX settings, entry workflows, all financial views, and release verification in one unified financial batch. The six work items below describe internal dependencies, not separate deliverables. Do not enable partial functionality, split the work into multiple financial releases, or wait for a new start instruction after each item. Test throughout implementation and accept the entire batch together; any unfinished item keeps the batch incomplete.

### Prerequisite: Consistent Backups and the Development Baseline

Restrict and drain writes across cards, finances, shares, and the image queue while capturing a consistent database/media backup. Validate media references, resume writes on failure, and exercise concurrent creation, replacement, deletion, queue processing, and restore with isolated fixtures. Confirm the active data path and schema through metadata and retain a complete safety backup. Acceptance: no backup with missing referenced media is reported as complete; restored records and media agree.

### Internal Work 1: Specify Business Rules and Acceptance Examples

Define a transaction's single quantity change and multiple payment/receipt components, distinguishing mixed payment for one card from separate purchases of several cards. Specify reporting currency, quote selection, FX dates, rounding, same-day ordering, late expenses, corrections, and sold-state behavior. Start with manually entered and confirmed FX rates, retaining currency pair, direction, date, and source; automated rates remain out of scope.

The proposed default reporting currency is CNY with USD selectable. Prefer the latest direct quote in that currency; convert another quote only with explicit valuation FX evidence, otherwise report it as unvalued. These are the implemented defaults for this batch. Show valuation and calculable-return coverage; missing cost, receipt, or required FX evidence yields an incomplete result rather than zero. Acceptance examples cover cross-currency expenses and sales, mixed payment, multiple physical cards, partial sales, quotes on different dates, missing FX, and holdings without transaction history.

### Internal Work 2: Separate Quantity Events from Monetary Components

Store the card, purchase/sale type, quantity change, and business date on the transaction, with related payment/receipt components in original currencies and minor units. Link expenses to holdings or transactions; retain independent quotes and traceable FX evidence. Distinguish unknown cost from known zero cost rather than treating every historical zero as a free acquisition.

Design backup, transactional schema changes, rollback, and version markers for the actual baseline. Preserve existing transaction meanings and flag ambiguous mixed-currency history instead of merging quantities automatically. Acceptance: mixed payment changes quantity once, original money and media links survive, reruns do not duplicate records, and unknown schemas fail explicitly.

### Internal Work 3: Unified Positions and Original-Currency Costs

Implement one quantity ledger and oversell validation independent of receipt currency. Capitalize purchase/grading expenses as original-currency components, allocate each component by moving average, and absorb rounding remainder on the final sale. Deduct sale expenses from proceeds and preserve original-currency cash flows; replay business history after corrections or deletion. Acceptance: quantities are not duplicated, foreign-currency fees are retained, remaining plus allocated costs reconcile by currency, and cross-currency/partial sales calculate correctly.

### Internal Work 4: FX Management in Settings, Quotes, and Returns

Put all manual rate entry and maintenance in Settings → Financial Settings → Exchange Rates, alongside reporting currency, rate dates, sources, and history. Show the direction explicitly as “1 USD = … CNY” instead of asking for two independent reciprocal rates. Financial pages only display the applied evidence or missing-rate explanation and a link to Settings; transaction forms do not duplicate rate inputs.

Store rates in the local database and include them in backup/restore rather than browser preferences alone. New records do not overwrite saved historical evidence. Corrections retain traceable revisions and identify affected calculations; saved historical snapshots remain unchanged. Automated rate retrieval stays outside this batch.

Attach both currency quotes to the same physical quantity without adding them as separate assets. Convert historical costs using the evidence for each cost event, receipts using sale-event evidence, and valuations using an explicit quote/date policy. Today's FX must not overwrite historical costs. Preserve the original-currency ledger; separate investment-versus-FX attribution is outside the first release.

Expose complete/incomplete calculation status and missing evidence. Produce complete returns and return rates only when all required inputs exist. Store algorithm version, quote, and FX evidence in snapshots rather than silently rewriting them later. Fixed acceptance example: CNY 1,000 purchase plus USD 20 grading at a confirmed 7 CNY/USD cost rate gives CNY 1,140 cost and CNY 360 unrealized profit against a direct CNY 1,500 quote. Removing the required FX evidence makes the complete return unavailable.

### Internal Work 5: Unify Entry and Every Financial View

Support one transaction with multiple payment/receipt components, clear expense destinations, and quotes. Resolve FX evidence for the applicable date from Settings, linking there for missing rates instead of adding transaction-form rate inputs. Show unified quantity, original-currency costs, alternative quotes, and missing return inputs. Use explicit translation keys for new interface text and protect user-authored content from document-wide translation.

Home, portfolio totals, allocation, historical trends, comparisons, sorting, stored snapshots, and AI summaries must consume the same financial output. Keep old snapshot methodology versions; explain incompatible comparisons rather than inventing comparable differences. Keep private finances outside public share exports. Acceptance: matching scope, date, reporting currency, and coverage produce matching values across pages, with entry and correction usable in both languages and narrow layouts.

### Internal Work 6: Integrated Regression and One Complete Financial Release

Complete domain, transaction, backup/restore, HTTP, and UI regressions, including interruption, rollback, duplicate submissions, and baseline-data preservation. Reconcile representative anonymized history and resolve ambiguity before enabling complete returns. Validate installer/portable runtime, metadata, checksums, and release documentation. Retain rollback copies and publish financial changes separately from major visual redesigns or bulk imports.

End-to-end acceptance includes entering FX in Settings, mixed-currency transactions/expenses, partial sale, reconciliation across home/details/portfolio, and backup/restore. Also verify corrected or missing FX, stable historical snapshots, and bilingual/narrow-screen Settings interaction.

### After Financial Stabilization

1. Finish internationalization of remaining pages and fixed-environment visual comparisons; all new work follows those requirements from the start.
2. Add database pagination, separate statistics queries, and large-collection benchmarks.
3. Improve entry and table views, then bulk edits, CSV/XLSX import/export, and recovery from accidental changes.
4. Improve gallery readability, then reminders; online services remain conditional on infrastructure.

Do not preassign release numbers or dates. Estimate effort once business and data boundaries are clear, preserving unified completion and acceptance. Authoritative accounting rules remain in the [financial model](./financial-history-model.md); this roadmap records implementation dependencies and acceptance order.

## Stage Overview

| Status | Theme | Primary value |
| --- | --- | --- |
| Completed (released in `v1.1.0`) | Card Entry Workbench 2.0 | Faster continuous entry, batch preparation, and duplicate review. |
| Completed (released in `v1.1.1`) | Positions and Returns | Quantities, multiple purchases, partial sales, and traceable returns. |
| Completed (released in `v1.2.0`) | Portfolio Center | Trends, concentration, data quality, saved views, and point-in-time comparison. |
| Completed (consolidated in `v1.2.1`) | Share Gallery | Better output quality, responsive presentation, and large-gallery performance. |
| Later stage | Batch Data and Migration Center | Import, bulk edit, export, deduplication, and computer migration reports. |
| Later stage | Reminders and Collection Planning | Local reminders, wish lists, budgets, and maintenance queues. |
| Long-term direction | Optional Online Services | Managed publishing, permissions, and multi-device sync when infrastructure is ready. |

## Completed — Card Entry Workbench 2.0

Deliver continuous entry, batch-image queues, review-before-write AI recognition, reusable field templates, copy-as-new, draft recovery, duplicate candidates, image preparation, keyboard workflows, and field-level confidence. A single failed batch item must not discard other work, and AI must never write confirmed collection data without user review.

Delivery status: completed on 2026-08-21. The shipped scope includes SQLite drafts and recovery, continuous entry, a batch WebP preparation queue, isolated retries, public-field templates, duplicate candidates, keyboard workflows, and persistent AI candidates that require per-card review. Copy-as-new and templates reuse only common fields; serial numbers, certificates, images, and financial facts are never copied implicitly.

## Completed — Positions and Returns

Separate card identity, position quantity, and transaction facts. Add multiple purchases, partial sales, purchase/grading/sale-linked expenses, remaining cost, realized return, unrealized return, and total return. Use moving average as the single cost-allocation method and keep CNY/USD separate without automatic FX conversion. Refunds, returns, cancellations, reversals, and holding-period expense links are explicitly out of scope. The delivered UI uses the same accounting output for its core metrics, cost/value snapshot chart, cumulative cost composition, profit composition, explicit per-record impact, and expense-destination wording. Database snapshots, rollback, and v1.1.0-backup recovery remain covered.

Delivery status: completed on 2026-08-24.

This stage was provisionally labeled `v1.2.0` in an earlier roadmap and was ultimately consolidated and released as `v1.1.1`. Future roadmap stages are no longer assigned version numbers in advance.

## Completed — Portfolio Center

Create a dedicated portfolio page for value, cost, realized and unrealized return trends; concentration by collection dimensions; 30/90/180-day valuation changes; valuation age and source quality; incomplete-data queues; high-value and high-cost positions; sold-card review; saved collection views; comparison between views or dates; and stored analysis snapshots. AI conclusions must cite deterministic evidence and their applicable scope.

### Current delivery status

The first development batch was completed on 2026-08-25:

- Added a dedicated Portfolio Center page and primary navigation entry.
- Reused transaction, expense, valuation, and moving-average position accounting to show currency-separated value, remaining cost, and realized/unrealized results.
- Activity trends group purchase amounts plus purchase expenses, grading expenses, and sale proceeds less sale expenses. They support the latest 12 months, latest 24 months, or all months, with a continuous month axis, amount axis, and per-month hover details.
- Added card-subject, sport, and brand count/value shares, Top 1/Top 3 concentration, and concentration interpretation.
- Added top-valued positions, valuation coverage and freshness, plus an actionable card-level data-quality queue covering every collection status; the queue treats valuations older than 360 days as stale.
- Made the Home AI portfolio analysis and the center use the same server-side query and deterministic snapshot service.

The second development batch was completed on 2026-08-25:

- Saved collection views preserve the active Home filter scope and can be reopened, deleted, or used as the source of a new snapshot.
- Point-in-time portfolio snapshots persist the complete deterministic snapshot, filter scope, and capture time. Deleting a saved view does not delete its historical snapshots.
- True 30/90/180-day valuation changes reconstruct each cutoff from the latest valuation available by that date and the purchase/sale quantity held at that date; valuation-entry flow is never presented as portfolio value.
- Comparisons can pair the current scope, any live saved view, or any stored point-in-time snapshot and show card-count plus currency-separated value, cost, and profit changes.
- High-cost positions and sold-card reviews reuse moving-average accounting and rank CNY/USD independently without cross-currency comparison.
- Current databases and older backups add the view/snapshot tables during preparation, with a consistent SQLite pre-upgrade snapshot and automated restore coverage.

The final closeout batch was completed on 2026-08-25:

- Added month-end reconstruction of portfolio value, remaining cost, realized profit, and unrealized profit for the latest 12 months, latest 24 months, or all history. Holdings without a valuation at the historical cutoff are not incorrectly counted as unrealized losses.
- Exposed the existing latest-valuation source breakdown as card counts and shares.
- Extended collection structure from card subject, sport, and brand to team, year, product line, grading company, and rookie/autograph/patch/serial-numbered attributes, while retaining Home filter links and currency switching.
- Added structure-share changes to portfolio comparison alongside card counts and currency-separated financial changes. Existing stored snapshots now retain normalized allocation data when loaded.
- Made the Home Portfolio Center entry persistent, separated and collapsed the view/comparison workspace by default, and aligned the saved-view and snapshot action hierarchy.
- Added a backup-delete-restore regression using real saved-view, point-in-time snapshot, relationship, and snapshot JSON records.
- Unified the View & Compare disclosure control and select arrows across the project; Portfolio content sections now support locally persisted drag reordering, including horizontal and vertical placement for the four half-width cards.

The roadmap's core Portfolio Center scope and final closeout are complete and ship as the central capability of `v1.2.0`. Remaining work is limited to usage-driven refinement.

2026-08-26 experience refinement: renamed the player-name field to card subject across entry, validation, and recognition so team-based cards read naturally; fixed collapsed Showcase group overflow and added direction-preserving, continuous 90-degree rotation for entry, editing, and Showcase viewing without re-encoding original images.

## Completed — Share Gallery

Completed on 2026-08-28 and consolidated into `v1.2.1`. The delivered scope combines templates and layouts into Gallery Style while keeping themes independent, removes redundant four-step helper copy, provides desktop/tablet/mobile and full-canvas standalone previews, generates optimized WebP media plus section/subject/card pages, supports featured-card stories and segmented large galleries, audits privacy and accessibility before export, writes version-difference summaries, and maintains desktop/mobile visual baselines.

The current behavior, presentation protocol, compatibility rules, and publishing boundary are maintained in the single [Share Gallery specification](./share-gallery.md). Cloudflare Drop remains manual and temporary; the app stores neither its URL nor claim link. QR codes are not a current product objective. Permanent publishing, update, revoke, and analytics remain deferred until long-term infrastructure exists.

## Later Stage — Batch Data and Migration Center

Add CSV/XLSX mapping and preview, duplicate review, skip/replace/merge strategies, bulk status and metadata edits, batch valuations, public-field export, complete collection packages without AI credentials, computer-migration validation, backup notes, migration reports, and recoverable per-item failures.

## Later Stage — Reminders and Collection Planning

Add stale-valuation reminders, grading-duration reminders, long-listed reminders, wish lists, budgets, purchase plans, incomplete-record queues, a local notification center, and periodic collection summaries. Reminder data remains local by default.

## Long-Term Direction — Optional Online Services

Begin only after permanent hosting, authentication, operations, and recovery responsibilities are clear. Candidate scope includes accounts, device authorization, encrypted sync, conflict handling, history recovery, object storage, permanent share links, publish/update/revoke permissions, release history, and optional access analytics. Never synchronize a live SQLite file through a generic cloud drive; record versions, operation logs, or server-side transactions are required. Local collection management must continue when the service is unavailable.

## Cross-Stage Experience Standard

- Auto-save drafts for long forms and complex editors.
- Provide confirmation, undo, or safety backups for destructive actions.
- Show stage, progress, outcome, and recovery guidance for long-running work.
- Preserve user input after validation failures.
- Give empty states a clear next action.
- Avoid forcing navigation after successful saves.
- Support appropriate keyboard workflows.
- Allow partial success and retry in batch operations.
- Review backup, recovery, migration, and privacy implications for every new feature.

## Cross-Stage Release Standard

Every formal release should include a lockfile-based clean install, UTF-8 and metadata checks, TypeScript checks, feature-specific tests, card and sharing HTTP end-to-end tests, a production build, packaged-runtime smoke tests, installer and portable-version verification, SHA-256 output, production dependency auditing, and updated documentation. Database releases additionally require pre-migration snapshots, rollback behavior, and old-backup recovery tests.

Before starting a capability stage, split its scope into verifiable development batches. New requests should normally be assigned to the most relevant planned stage. Record the reason and data risk when changing the sequence, and update this roadmap with actual delivery status and the final release version after each release. Version numbers are selected during release closeout instead of being fixed by the roadmap in advance.
