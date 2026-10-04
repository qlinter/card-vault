# Card Vault Product Roadmap

Updated 2026-10-04. Current source is v1.3.5, covering themes, interface and AI settings, dependency patches and obsolete compatibility cleanup. The [v1.3.5 release notes](./release-v1.3.5.md) record the full review and source validation. Unsigned Windows x64 installer and portable artifacts have been generated and passed packaged-runtime validation; earlier distribution facts remain in their release documents.

## Completed capabilities

| Capability | Status |
| --- | --- |
| Card Entry Workbench 2.0 | Released in v1.1.0: drafts, queues, templates, duplicate hints and reviewed AI candidates. |
| Positions and returns | Released in v1.1.1; v1.3.0 source unifies physical quantities, mixed payments and manual FX. |
| Portfolio Center | Released in v1.2.0: history, structure, quality queues, saved views and frozen snapshots. |
| Share Gallery | Released in v1.2.1; v1.3.0 source refines card imagery, readability and management UI. |
| Data management | Implemented in v1.3.0 source: Settings groups import, export, storage and backup/restore, including mapping, retries and undo. |
| Reminders and planning | Implemented in v1.3.0 source: 180-day reminders, 7/30-day digests, wishlist and original-currency budgets. |
| Reliability and scale | Implemented in v1.3.0 source: shared operation locks, recovery copies, manifests, explicit translations, Home pagination and chunked Portfolio reads. |
| v1.3.1 reliability and optimization | Implemented: port fallback, recurring reminders, selected exports, final restore rollback, incremental indexing and financial-query optimization; current data formats only. |

## Completed — Share Gallery

The current implementation retains independent styles and themes, sections, card overrides, shared rendering, a public-field allowlist, export checks and difference reports. Static packages and manual Drop publishing remain; this cleanup does not add hosted services. See the [gallery specification](./share-gallery.md).

## Historical distribution status

Feature details, source checks and packaged-runtime results for v1.3.1–v1.3.4 are maintained in their release notes: [v1.3.1](./release-v1.3.1.md), [v1.3.2](./release-v1.3.2.md), [v1.3.3](./release-v1.3.3.md), [v1.3.4](./release-v1.3.4.md). The roadmap no longer duplicates release logs. Real Windows installation/upgrade and external AI checks with configured credentials remain separate follow-ups.

## Completed this release

Today's changes are consolidated into v1.3.5. Themes, finance entry points, editing, view icons, AI settings and code cleanup are documented in [v1.3.5](./release-v1.3.5.md), with extension rules in [application themes](./app-themes.md). Earlier functionality, check fixes and distribution details stay in the [v1.3.4 release notes](./release-v1.3.4.md); this roadmap does not duplicate development logs.

## Next priorities

| Priority | Direction | Conditions and acceptance |
| --- | --- | --- |
| Deferred | Real Windows installation and upgrade validation | Deferred by user agreement. v1.3.5 packaging and packaged-runtime validation are complete. Schedule real clean-install, upgrade, portable-migration and data-retention checks separately. |
| 1 | Scale and failure recovery | Dense-history reuse and disk-backed streaming exports are complete. Next profile Portfolio queries, reporting projection and rendering separately, assess task pagination, and validate large real photos and power interruption. |
| 2 | Feedback-driven usability | Record actual entry, search and maintenance problems. Retain current layout and typography unless feedback supports further changes. |
| 3 | Data rule extensions | Define the model and compatibility requirements for full status-transition history beyond the implemented status start dates, additional import fields and more detailed correction flows. |
| Deferred | Managed publishing and multi-device sync | Resume only with renewed user agreement and long-term hosting, identity, operational and recovery resources. |

The removed standalone bulk-edit controls, recent-batch list, system digest notifications and share More menu are not future deliverables. No independent mobile application is planned; exported galleries still support phone browsers.

## Continuing standards

Financial work reuses the [unified accounting model](./financial-history-model.md); missing values never become zero. Database/media changes require snapshots, rollback or conflict protection. Preserve user content, form input, filters and navigation context. Tests use isolated data; coverage measures only modules actually loaded. Select future release numbers during scope and release closeout, and maintain both roadmap languages together.
