# Card Vault Product Roadmap

Updated 2026-09-08. Current source is v1.3.1; installer and portable packages have been generated and verified after user confirmation. See the [release notes](./release-v1.3.1.md) for scope and acceptance, and the [documentation index](./README.md) for current rules. This file maintains capability status and future priorities only.

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

## v1.3.1 release completed

This batch includes startup/restore fixes, reminder and export correctness, incremental indexing, financial-query optimization, current-format cleanup and bilingual documentation. Source checks, packaged runtime, version and SHA-256 verification passed; results are recorded in the release notes. Artifacts have not been uploaded.

## Next priorities

| Priority | Direction | Conditions and acceptance |
| --- | --- | --- |
| 1 | Real Windows usage validation | Verify clean installation and upgrades with the new packages, protected install locations, portable migration and data retention. |
| 2 | Scale and failure recovery | Per-card indexing, dense-history/synthetic-image benchmarks and restore-failure rollback are implemented. Next optimize dense Portfolio histories and validate large real photos and power interruption. |
| 3 | Feedback-driven usability | Record actual entry, search and maintenance problems. Retain current layout and typography unless feedback supports further changes. |
| 4 | Data rule extensions | Define the model and compatibility requirements for full status-transition history beyond the implemented status start dates, additional import fields and more detailed correction flows. |
| Deferred | Managed publishing and multi-device sync | Resume only with renewed user agreement and long-term hosting, identity, operational and recovery resources. |

The removed standalone bulk-edit controls, recent-batch list, system digest notifications and share More menu are not future deliverables. No independent mobile application is planned; exported galleries still support phone browsers.

## Continuing standards

Financial work reuses the [unified accounting model](./financial-history-model.md); missing values never become zero. Database/media changes require snapshots, rollback or conflict protection. Preserve user content, form input, filters and navigation context. Tests use isolated data; coverage measures only modules actually loaded. Select future release numbers during scope and release closeout, and maintain both roadmap languages together.
