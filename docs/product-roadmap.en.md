# Card Vault Product Roadmap

Updated 2026-09-18. Current version is v1.3.4; the installer and portable package have been generated and passed packaged-runtime checks. See the [release notes](./release-v1.3.4.md) for scope and validation. Historical distribution facts remain in their own notes.

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

Feature details, source checks and packaged-runtime results for v1.3.1–v1.3.3 are maintained in their release notes: [v1.3.1](./release-v1.3.1.md), [v1.3.2](./release-v1.3.2.md), [v1.3.3](./release-v1.3.3.md). The roadmap no longer duplicates release logs. Real Windows installation/upgrade and external AI checks with configured credentials remain separate follow-ups.

## v1.3.4 update and distribution (2026-09-18)

Completed three entry sections, automatic attribute checks, supplementary financial records, Home valuation visibility, export controls and wish deletion, including alignment of wish amounts and action buttons. Entry and import now share initial financial processing; expense options and form parsing are reused, while unused branches, internal exports and style overrides are removed. Fixed stale attributes after replacing AI images and strengthened payload and client-boundary checks. Existing quick inputs, detail-page workflows and data formats remain unchanged. Bilingual overviews, in-app guidance and development status are synchronized; repeated historical progress is consolidated into release notes. Validation is recorded in the [v1.3.4 release notes](./release-v1.3.4.md). Following user confirmation, the unsigned Windows x64 installer and portable package were generated and passed the full source gate, packaged-runtime tests and artifact checks. Previous v1.3.3 artifacts are preserved unchanged in `backups/releases/v1.3.3`.

## Next priorities

| Priority | Direction | Conditions and acceptance |
| --- | --- | --- |
| Deferred | Real Windows installation and upgrade validation | Deferred by user agreement. The v1.3.4 artifacts are available and packaged-runtime checks passed. Schedule real clean-install, upgrade, portable-migration and data-retention checks separately. |
| 1 | Scale and failure recovery | Dense-history reuse and disk-backed streaming exports are complete. Next profile Portfolio queries, reporting projection and rendering separately, assess task pagination, and validate large real photos and power interruption. |
| 2 | Feedback-driven usability | Record actual entry, search and maintenance problems. Retain current layout and typography unless feedback supports further changes. |
| 3 | Data rule extensions | Define the model and compatibility requirements for full status-transition history beyond the implemented status start dates, additional import fields and more detailed correction flows. |
| Deferred | Managed publishing and multi-device sync | Resume only with renewed user agreement and long-term hosting, identity, operational and recovery resources. |

The removed standalone bulk-edit controls, recent-batch list, system digest notifications and share More menu are not future deliverables. No independent mobile application is planned; exported galleries still support phone browsers.

## Continuing standards

Financial work reuses the [unified accounting model](./financial-history-model.md); missing values never become zero. Database/media changes require snapshots, rollback or conflict protection. Preserve user content, form input, filters and navigation context. Tests use isolated data; coverage measures only modules actually loaded. Select future release numbers during scope and release closeout, and maintain both roadmap languages together.
