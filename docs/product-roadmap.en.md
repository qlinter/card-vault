# Card Vault Product Roadmap

Updated 2026-09-07. The current version is v1.3.0; installer and portable archives have been generated and verified after explicit confirmation. See [development status](./v1.3.0-implementation.md) for acceptance results and the [documentation index](./README.md) for current behavior. This roadmap records capability status and priorities, not duplicate specifications or chronological logs.

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

## Completed — Share Gallery

The current implementation retains independent styles and themes, sections, card overrides, shared rendering, a public-field allowlist, export checks and difference reports. Static packages and manual Drop publishing remain; this cleanup does not add hosted services. See the [gallery specification](./share-gallery.md).

## Completed closeout — v1.3.0

1. Review accumulated code, remove retired entry points, consolidate shared utilities and retain recovery compatibility.
2. Align READMEs, specifications, in-app guidance, release notes and development status with final behavior.
3. Complete source release checks, dependency auditing and necessary performance reruns.
4. Present results for explicit user confirmation, then build and verify the installer, portable ZIP and checksums.

Source review, documentation, validation and confirmed packaging are complete. Artifacts reside in the local dist directory and have not been uploaded to an online release channel. Clean Windows installation and upgrade checks remain manual follow-ups below.

## Next priorities

| Priority | Direction | Conditions and acceptance |
| --- | --- | --- |
| 1 | Real Windows usage validation | After packaging approval, verify clean installation, upgrades, protected install locations, portable migration and data retention. |
| 2 | Scale and failure recovery | Test dense financial histories, large image sets and real hardware; exercise disk exhaustion, service interruption and restore before choosing incremental aggregation work. |
| 3 | Feedback-driven usability | Record actual entry, search and maintenance problems. Retain current layout and typography unless feedback supports further changes. |
| 4 | Data rule extensions | Define the model and compatibility requirements for precise grading/listing status dates, additional import fields and more detailed correction flows. |
| Deferred | Managed publishing and multi-device sync | Resume only with renewed user agreement and long-term hosting, identity, operational and recovery resources. |

The removed standalone bulk-edit controls, recent-batch list, system digest notifications and share More menu are not future deliverables. No independent mobile application is planned; exported galleries still support phone browsers.

## Continuing standards

Financial work reuses the [unified accounting model](./financial-history-model.md); missing values never become zero. Database/media changes require snapshots, rollback or conflict protection. Preserve user content, form input, filters and navigation context. Tests use isolated data; coverage measures only modules actually loaded. Select future release numbers during scope and release closeout, and maintain both roadmap languages together.
