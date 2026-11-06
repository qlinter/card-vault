-- Empty database structure from the published v1.5.1 source; no personal data.
CREATE TABLE Card (
      id TEXT PRIMARY KEY NOT NULL, playerName TEXT NOT NULL, cardTitle TEXT NOT NULL, sport TEXT NOT NULL,
      team TEXT, year TEXT, brand TEXT, productLine TEXT, subsetName TEXT, parallel TEXT, cardNumber TEXT,
      isSerialNumbered BOOLEAN NOT NULL DEFAULT 0, serialNumber TEXT, serialRange TEXT,
      isRookie BOOLEAN NOT NULL DEFAULT 0, isAutograph BOOLEAN NOT NULL DEFAULT 0, autoType TEXT,
      isPatch BOOLEAN NOT NULL DEFAULT 0, patchType TEXT, gradingCompany TEXT, grade TEXT, certNumber TEXT,
      gradingLink TEXT, visibility TEXT NOT NULL DEFAULT 'private', collectionStatus TEXT NOT NULL DEFAULT 'holding',
      holdingQuantity INTEGER NOT NULL DEFAULT 1 CHECK (typeof(holdingQuantity) = 'integer' AND holdingQuantity >= 0),
      tags TEXT, publicDescription TEXT, notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE CardImage (
      id TEXT PRIMARY KEY NOT NULL, cardId TEXT NOT NULL, path TEXT NOT NULL,
      rotation INTEGER NOT NULL DEFAULT 0 CHECK (rotation IN (0, 90, 180, 270)),
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardImage_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
CREATE TABLE CardTransaction (
      id TEXT PRIMARY KEY NOT NULL, cardId TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('purchase', 'sale')),
      amountMinor INTEGER NOT NULL CHECK (typeof(amountMinor) = 'integer' AND amountMinor >= 0),
      currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3 AND currency = upper(currency)),
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (typeof(quantity) = 'integer' AND quantity > 0),
      paymentsJson TEXT, amountKnown BOOLEAN NOT NULL DEFAULT 1 CHECK(amountKnown IN (0,1)),
      occurredAt DATETIME NOT NULL, source TEXT, notes TEXT,
      provenance TEXT NOT NULL CHECK (length(trim(provenance)) > 0), externalKey TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardTransaction_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
CREATE TABLE CardExpense (
      id TEXT PRIMARY KEY NOT NULL, cardId TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('grading', 'shipping', 'tax', 'insurance', 'storage', 'marketplace_fee', 'other')),
      context TEXT NOT NULL DEFAULT 'grading' CHECK (context IN ('purchase', 'grading', 'sale')),
      transactionId TEXT,
      amountMinor INTEGER NOT NULL CHECK (typeof(amountMinor) = 'integer' AND amountMinor >= 0),
      currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3 AND currency = upper(currency)),
      occurredAt DATETIME NOT NULL, vendor TEXT, notes TEXT,
      provenance TEXT NOT NULL CHECK (length(trim(provenance)) > 0), externalKey TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardExpense_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
CREATE TABLE CardValuation (
      id TEXT PRIMARY KEY NOT NULL, cardId TEXT NOT NULL,
      amountMinor INTEGER NOT NULL CHECK (typeof(amountMinor) = 'integer' AND amountMinor >= 0),
      currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3 AND currency = upper(currency)),
      valuedAt DATETIME NOT NULL,
      source TEXT NOT NULL DEFAULT '个人估计' CHECK (source IN ('个人估计', '卡淘', 'eBay', 'Others')),
      notes TEXT, provenance TEXT NOT NULL CHECK (length(trim(provenance)) > 0), externalKey TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardValuation_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
CREATE TABLE CardEntryDraft (
      id TEXT PRIMARY KEY NOT NULL, schemaVersion INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft',
      valuesJson TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE CardEntryTemplate (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, valuesJson TEXT NOT NULL, useCount INTEGER NOT NULL DEFAULT 0,
      lastUsedAt DATETIME, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE CardEntryBatch (
      id TEXT PRIMARY KEY NOT NULL, label TEXT, pairingMode TEXT NOT NULL DEFAULT 'pairs',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE CardEntryQueueItem (
      id TEXT PRIMARY KEY NOT NULL, batchId TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'processing',
      sortOrder INTEGER NOT NULL DEFAULT 0, attemptCount INTEGER NOT NULL DEFAULT 0, errorMessage TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardEntryQueueItem_batchId_fkey FOREIGN KEY (batchId) REFERENCES CardEntryBatch (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
CREATE TABLE CardEntryQueueImage (
      id TEXT PRIMARY KEY NOT NULL, itemId TEXT NOT NULL, originalName TEXT NOT NULL, sourcePath TEXT,
      processedPath TEXT, side TEXT NOT NULL DEFAULT 'front', sortOrder INTEGER NOT NULL DEFAULT 0,
      mimeType TEXT NOT NULL, originalBytes INTEGER NOT NULL, processedBytes INTEGER, width INTEGER, height INTEGER,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardEntryQueueImage_itemId_fkey FOREIGN KEY (itemId) REFERENCES CardEntryQueueItem (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
CREATE TABLE CardEntryRecognition (
      id TEXT PRIMARY KEY NOT NULL, itemId TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'recognizing',
      suggestionJson TEXT, confidenceJson TEXT, attemptCount INTEGER NOT NULL DEFAULT 0, errorMessage TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardEntryRecognition_itemId_fkey FOREIGN KEY (itemId) REFERENCES CardEntryQueueItem (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
CREATE TABLE ShareCollection (
      id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, subtitle TEXT, slug TEXT NOT NULL,
      theme TEXT NOT NULL DEFAULT 'spotlight', presentationConfig TEXT, description TEXT, themeNarrative TEXT,
      themeHighlights TEXT, groupNotes TEXT, coverImagePath TEXT, backgroundImagePath TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE ShareSection (
      id TEXT PRIMARY KEY NOT NULL, shareCollectionId TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      layout TEXT NOT NULL DEFAULT 'editorial', sortOrder INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT ShareSection_shareCollectionId_fkey FOREIGN KEY (shareCollectionId) REFERENCES ShareCollection (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
CREATE TABLE ShareCollectionItem (
      id TEXT PRIMARY KEY NOT NULL, shareCollectionId TEXT NOT NULL, cardId TEXT NOT NULL, sectionId TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0, displayTitle TEXT, displayDescription TEXT,
      CONSTRAINT ShareCollectionItem_shareCollectionId_fkey FOREIGN KEY (shareCollectionId) REFERENCES ShareCollection (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT ShareCollectionItem_sectionId_fkey FOREIGN KEY (sectionId) REFERENCES ShareSection (id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT ShareCollectionItem_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
CREATE TABLE PortfolioSavedView (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, queryJson TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE PortfolioSnapshotRecord (
      id TEXT PRIMARY KEY NOT NULL, savedViewId TEXT, name TEXT NOT NULL, queryJson TEXT NOT NULL,
      snapshotJson TEXT NOT NULL, capturedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT PortfolioSnapshotRecord_savedViewId_fkey FOREIGN KEY (savedViewId) REFERENCES PortfolioSavedView (id) ON DELETE SET NULL ON UPDATE CASCADE
    );
CREATE TABLE FinancialSettings (id TEXT PRIMARY KEY NOT NULL, reportingCurrency TEXT NOT NULL DEFAULT 'CNY' CHECK(reportingCurrency IN ('CNY','USD')));
CREATE TABLE ExchangeRate (id TEXT PRIMARY KEY NOT NULL, effectiveDate TEXT NOT NULL, rateMicros INTEGER NOT NULL CHECK(typeof(rateMicros) = 'integer' AND rateMicros > 0), source TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision > 0), createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE DataRevision(id INTEGER PRIMARY KEY NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 0, projectionRevision INTEGER NOT NULL DEFAULT -1, projectionDay TEXT NOT NULL DEFAULT '');
CREATE TABLE CardReport(cardId TEXT PRIMARY KEY NOT NULL REFERENCES Card(id) ON DELETE CASCADE, currency TEXT NOT NULL CHECK(currency IN ('CNY','USD')), remainingCostMinor INTEGER, valueMinor INTEGER, quantity INTEGER NOT NULL CHECK(quantity >= 0));
CREATE TABLE BulkJob(id TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'preview', optionsJson TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE BulkJobRow(id TEXT PRIMARY KEY NOT NULL, jobId TEXT NOT NULL REFERENCES BulkJob(id) ON DELETE CASCADE, rowNumber INTEGER NOT NULL, inputJson TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', error TEXT, cardId TEXT, beforeJson TEXT, afterJson TEXT);
CREATE TABLE CollectionTaskState(id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','dismissed','done','snoozed')), snoozedUntil DATETIME, fingerprint TEXT NOT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE CollectionPlan(id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, playerName TEXT, sport TEXT, budgetMinor INTEGER CHECK(budgetMinor IS NULL OR budgetMinor >= 0), currency TEXT NOT NULL DEFAULT 'CNY' CHECK(currency IN ('CNY','USD')), targetDate DATETIME, notes TEXT, status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','acquired','cancelled')), cardId TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE ManagementSettings(id TEXT PRIMARY KEY NOT NULL DEFAULT 'default', digestCadence TEXT NOT NULL DEFAULT 'weekly' CHECK(digestCadence IN ('weekly','monthly')));
CREATE TABLE CardReportDirty(cardId TEXT PRIMARY KEY NOT NULL REFERENCES Card(id) ON DELETE CASCADE);
CREATE TABLE CardTracking(
      cardId TEXT PRIMARY KEY NOT NULL REFERENCES Card(id) ON DELETE CASCADE,
      statusStartedAt DATETIME NOT NULL, statusDateEstimated BOOLEAN NOT NULL DEFAULT 0,
      statusRevision INTEGER NOT NULL DEFAULT 0, imagesRevision INTEGER NOT NULL DEFAULT 0,
      purchaseRevision INTEGER NOT NULL DEFAULT 0, valuationRevision INTEGER NOT NULL DEFAULT 0
    );
CREATE TABLE ScoutWatch(id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, queryJson TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE ScoutWishDetails(planId TEXT PRIMARY KEY NOT NULL REFERENCES CollectionPlan(id) ON DELETE CASCADE, priority INTEGER NOT NULL DEFAULT 2 CHECK(priority BETWEEN 1 AND 3), targetCount INTEGER CHECK(targetCount BETWEEN 1 AND 500));
CREATE TABLE ScoutWishWatch(planId TEXT NOT NULL REFERENCES CollectionPlan(id) ON DELETE CASCADE, watchId TEXT NOT NULL REFERENCES ScoutWatch(id) ON DELETE CASCADE, PRIMARY KEY(planId,watchId));
CREATE TABLE ScoutWishCard(planId TEXT NOT NULL REFERENCES CollectionPlan(id) ON DELETE CASCADE, cardId TEXT NOT NULL REFERENCES Card(id) ON DELETE CASCADE, PRIMARY KEY(planId,cardId));
CREATE INDEX Card_playerName_idx ON Card(playerName);
CREATE INDEX Card_cardTitle_idx ON Card(cardTitle);
CREATE INDEX Card_sport_idx ON Card(sport);
CREATE INDEX Card_team_idx ON Card(team);
CREATE INDEX Card_year_idx ON Card(year);
CREATE INDEX Card_brand_idx ON Card(brand);
CREATE INDEX Card_productLine_idx ON Card(productLine);
CREATE INDEX Card_parallel_idx ON Card(parallel);
CREATE INDEX Card_visibility_idx ON Card(visibility);
CREATE INDEX Card_collectionStatus_idx ON Card(collectionStatus);
CREATE INDEX Card_createdAt_idx ON Card(createdAt DESC);
CREATE INDEX CardImage_cardId_idx ON CardImage(cardId);
CREATE UNIQUE INDEX CardTransaction_externalKey_key ON CardTransaction(externalKey);
CREATE INDEX CardTransaction_cardId_occurredAt_idx ON CardTransaction(cardId, occurredAt DESC);
CREATE INDEX CardTransaction_kind_idx ON CardTransaction(kind);
CREATE INDEX CardTransaction_occurredAt_idx ON CardTransaction(occurredAt DESC);
CREATE UNIQUE INDEX CardExpense_externalKey_key ON CardExpense(externalKey);
CREATE INDEX CardExpense_cardId_occurredAt_idx ON CardExpense(cardId, occurredAt DESC);
CREATE INDEX CardExpense_kind_idx ON CardExpense(kind);
CREATE INDEX CardExpense_transactionId_idx ON CardExpense(transactionId);
CREATE INDEX CardExpense_occurredAt_idx ON CardExpense(occurredAt DESC);
CREATE UNIQUE INDEX CardValuation_externalKey_key ON CardValuation(externalKey);
CREATE INDEX CardValuation_cardId_valuedAt_idx ON CardValuation(cardId, valuedAt DESC);
CREATE INDEX CardValuation_valuedAt_idx ON CardValuation(valuedAt DESC);
CREATE INDEX CardEntryDraft_status_updatedAt_idx ON CardEntryDraft(status, updatedAt DESC);
CREATE INDEX CardEntryDraft_updatedAt_idx ON CardEntryDraft(updatedAt DESC);
CREATE UNIQUE INDEX CardEntryTemplate_name_key ON CardEntryTemplate(name);
CREATE INDEX CardEntryTemplate_lastUsedAt_idx ON CardEntryTemplate(lastUsedAt DESC);
CREATE INDEX CardEntryTemplate_updatedAt_idx ON CardEntryTemplate(updatedAt DESC);
CREATE INDEX CardEntryBatch_createdAt_idx ON CardEntryBatch(createdAt DESC);
CREATE INDEX CardEntryQueueItem_batchId_sortOrder_idx ON CardEntryQueueItem(batchId, sortOrder);
CREATE INDEX CardEntryQueueItem_status_createdAt_idx ON CardEntryQueueItem(status, createdAt);
CREATE INDEX CardEntryQueueImage_itemId_sortOrder_idx ON CardEntryQueueImage(itemId, sortOrder);
CREATE UNIQUE INDEX CardEntryRecognition_itemId_key ON CardEntryRecognition(itemId);
CREATE INDEX CardEntryRecognition_status_updatedAt_idx ON CardEntryRecognition(status, updatedAt);
CREATE UNIQUE INDEX ShareCollection_slug_key ON ShareCollection(slug);
CREATE INDEX ShareCollection_createdAt_idx ON ShareCollection(createdAt DESC);
CREATE INDEX ShareSection_shareCollectionId_idx ON ShareSection(shareCollectionId);
CREATE INDEX ShareSection_sortOrder_idx ON ShareSection(sortOrder);
CREATE UNIQUE INDEX ShareCollectionItem_shareCollectionId_cardId_key ON ShareCollectionItem(shareCollectionId, cardId);
CREATE INDEX ShareCollectionItem_shareCollectionId_idx ON ShareCollectionItem(shareCollectionId);
CREATE INDEX ShareCollectionItem_sectionId_idx ON ShareCollectionItem(sectionId);
CREATE INDEX ShareCollectionItem_cardId_idx ON ShareCollectionItem(cardId);
CREATE INDEX ShareCollectionItem_sortOrder_idx ON ShareCollectionItem(sortOrder);
CREATE UNIQUE INDEX PortfolioSavedView_name_key ON PortfolioSavedView(name);
CREATE INDEX PortfolioSavedView_updatedAt_idx ON PortfolioSavedView(updatedAt DESC);
CREATE INDEX PortfolioSnapshotRecord_savedViewId_capturedAt_idx ON PortfolioSnapshotRecord(savedViewId, capturedAt DESC);
CREATE INDEX PortfolioSnapshotRecord_capturedAt_idx ON PortfolioSnapshotRecord(capturedAt DESC);
CREATE UNIQUE INDEX ExchangeRate_effectiveDate_revision_key ON ExchangeRate(effectiveDate, revision);
CREATE INDEX ExchangeRate_effectiveDate_idx ON ExchangeRate(effectiveDate);
CREATE INDEX CardReport_remainingCostMinor_cardId_idx ON CardReport(remainingCostMinor, cardId);
CREATE INDEX CardReport_valueMinor_cardId_idx ON CardReport(valueMinor, cardId);
CREATE UNIQUE INDEX BulkJob_token_key ON BulkJob(token);
CREATE UNIQUE INDEX BulkJobRow_jobId_rowNumber_key ON BulkJobRow(jobId,rowNumber);
CREATE INDEX BulkJobRow_jobId_status_idx ON BulkJobRow(jobId,status);
CREATE INDEX CollectionPlan_status_targetDate_idx ON CollectionPlan(status,targetDate);
CREATE INDEX ScoutWishCard_cardId_idx ON ScoutWishCard(cardId);
CREATE TRIGGER CardTransaction_currency_insert_check BEFORE INSERT ON CardTransaction
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
CREATE TRIGGER CardTransaction_currency_update_check BEFORE UPDATE OF currency ON CardTransaction
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
CREATE TRIGGER CardExpense_currency_insert_check BEFORE INSERT ON CardExpense
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
CREATE TRIGGER CardExpense_currency_update_check BEFORE UPDATE OF currency ON CardExpense
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
CREATE TRIGGER CardValuation_currency_insert_check BEFORE INSERT ON CardValuation
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
CREATE TRIGGER CardValuation_currency_update_check BEFORE UPDATE OF currency ON CardValuation
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
CREATE TRIGGER revision_Card_INSERT AFTER INSERT ON Card BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_Card_UPDATE AFTER UPDATE ON Card BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_Card_DELETE AFTER DELETE ON Card BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardImage_INSERT AFTER INSERT ON CardImage BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardImage_UPDATE AFTER UPDATE ON CardImage BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardImage_DELETE AFTER DELETE ON CardImage BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardTransaction_INSERT AFTER INSERT ON CardTransaction BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardTransaction_UPDATE AFTER UPDATE ON CardTransaction BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardTransaction_DELETE AFTER DELETE ON CardTransaction BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardExpense_INSERT AFTER INSERT ON CardExpense BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardExpense_UPDATE AFTER UPDATE ON CardExpense BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardExpense_DELETE AFTER DELETE ON CardExpense BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardValuation_INSERT AFTER INSERT ON CardValuation BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardValuation_UPDATE AFTER UPDATE ON CardValuation BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_CardValuation_DELETE AFTER DELETE ON CardValuation BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_FinancialSettings_INSERT AFTER INSERT ON FinancialSettings BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_FinancialSettings_UPDATE AFTER UPDATE ON FinancialSettings BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_FinancialSettings_DELETE AFTER DELETE ON FinancialSettings BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_ExchangeRate_INSERT AFTER INSERT ON ExchangeRate BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_ExchangeRate_UPDATE AFTER UPDATE ON ExchangeRate BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER revision_ExchangeRate_DELETE AFTER DELETE ON ExchangeRate BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER tracking_card_insert AFTER INSERT ON Card BEGIN
      INSERT INTO CardTracking(cardId,statusStartedAt) VALUES(NEW.id,NEW.createdAt);
      INSERT OR IGNORE INTO CardReportDirty(cardId) VALUES(NEW.id);
    END;
CREATE TRIGGER tracking_status_update AFTER UPDATE OF collectionStatus ON Card
    WHEN OLD.collectionStatus IS NOT NEW.collectionStatus BEGIN
      UPDATE CardTracking SET statusStartedAt=CURRENT_TIMESTAMP,statusDateEstimated=0,statusRevision=statusRevision+1 WHERE cardId=NEW.id;
    END;
CREATE TRIGGER report_card_update AFTER UPDATE OF collectionStatus,holdingQuantity ON Card
    WHEN OLD.collectionStatus IS NOT NEW.collectionStatus OR OLD.holdingQuantity IS NOT NEW.holdingQuantity BEGIN
      INSERT OR IGNORE INTO CardReportDirty(cardId) VALUES(NEW.id);
    END;
CREATE TRIGGER tracking_CardImage_INSERT AFTER INSERT ON CardImage BEGIN
        UPDATE CardTracking SET imagesRevision=imagesRevision+1 WHERE cardId IN (NEW.cardId);
        
      END;
CREATE TRIGGER tracking_CardImage_UPDATE AFTER UPDATE OF cardId ON CardImage BEGIN
        UPDATE CardTracking SET imagesRevision=imagesRevision+1 WHERE cardId IN (OLD.cardId,NEW.cardId);
        
      END;
CREATE TRIGGER tracking_CardImage_DELETE AFTER DELETE ON CardImage BEGIN
        UPDATE CardTracking SET imagesRevision=imagesRevision+1 WHERE cardId IN (OLD.cardId);
        
      END;
CREATE TRIGGER tracking_CardTransaction_INSERT AFTER INSERT ON CardTransaction BEGIN
        UPDATE CardTracking SET purchaseRevision=purchaseRevision+1 WHERE cardId IN (NEW.cardId);
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card WHERE id IN (NEW.cardId);
      END;
CREATE TRIGGER tracking_CardTransaction_UPDATE AFTER UPDATE ON CardTransaction BEGIN
        UPDATE CardTracking SET purchaseRevision=purchaseRevision+1 WHERE cardId IN (OLD.cardId,NEW.cardId);
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card WHERE id IN (OLD.cardId,NEW.cardId);
      END;
CREATE TRIGGER tracking_CardTransaction_DELETE AFTER DELETE ON CardTransaction BEGIN
        UPDATE CardTracking SET purchaseRevision=purchaseRevision+1 WHERE cardId IN (OLD.cardId);
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card WHERE id IN (OLD.cardId);
      END;
CREATE TRIGGER tracking_CardValuation_INSERT AFTER INSERT ON CardValuation BEGIN
        UPDATE CardTracking SET valuationRevision=valuationRevision+1 WHERE cardId IN (NEW.cardId);
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card WHERE id IN (NEW.cardId);
      END;
CREATE TRIGGER tracking_CardValuation_UPDATE AFTER UPDATE ON CardValuation BEGIN
        UPDATE CardTracking SET valuationRevision=valuationRevision+1 WHERE cardId IN (OLD.cardId,NEW.cardId);
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card WHERE id IN (OLD.cardId,NEW.cardId);
      END;
CREATE TRIGGER tracking_CardValuation_DELETE AFTER DELETE ON CardValuation BEGIN
        UPDATE CardTracking SET valuationRevision=valuationRevision+1 WHERE cardId IN (OLD.cardId);
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card WHERE id IN (OLD.cardId);
      END;
CREATE TRIGGER tracking_CardExpense_INSERT AFTER INSERT ON CardExpense BEGIN
        
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card WHERE id IN (NEW.cardId);
      END;
CREATE TRIGGER tracking_CardExpense_UPDATE AFTER UPDATE ON CardExpense BEGIN
        
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card WHERE id IN (OLD.cardId,NEW.cardId);
      END;
CREATE TRIGGER tracking_CardExpense_DELETE AFTER DELETE ON CardExpense BEGIN
        
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card WHERE id IN (OLD.cardId);
      END;
CREATE TRIGGER report_settings_INSERT AFTER INSERT ON FinancialSettings BEGIN
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card;
      END;
CREATE TRIGGER report_rates_INSERT AFTER INSERT ON ExchangeRate BEGIN
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardTransaction
          WHERE (currency != COALESCE((SELECT reportingCurrency FROM FinancialSettings WHERE id='default'),'CNY') OR paymentsJson IS NOT NULL) AND CASE WHEN typeof(occurredAt)='integer' THEN strftime('%Y-%m-%d',occurredAt/1000,'unixepoch') ELSE substr(occurredAt,1,10) END >= NEW.effectiveDate;
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardExpense
          WHERE currency != COALESCE((SELECT reportingCurrency FROM FinancialSettings WHERE id='default'),'CNY') AND CASE WHEN typeof(occurredAt)='integer' THEN strftime('%Y-%m-%d',occurredAt/1000,'unixepoch') ELSE substr(occurredAt,1,10) END >= NEW.effectiveDate;
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardValuation
          WHERE currency != COALESCE((SELECT reportingCurrency FROM FinancialSettings WHERE id='default'),'CNY') AND CASE WHEN typeof(valuedAt)='integer' THEN strftime('%Y-%m-%d',valuedAt/1000,'unixepoch') ELSE substr(valuedAt,1,10) END >= NEW.effectiveDate;
      END;
CREATE TRIGGER report_settings_UPDATE AFTER UPDATE ON FinancialSettings BEGIN
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card;
      END;
CREATE TRIGGER report_rates_UPDATE AFTER UPDATE ON ExchangeRate BEGIN
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardTransaction
          WHERE (currency != COALESCE((SELECT reportingCurrency FROM FinancialSettings WHERE id='default'),'CNY') OR paymentsJson IS NOT NULL) AND CASE WHEN typeof(occurredAt)='integer' THEN strftime('%Y-%m-%d',occurredAt/1000,'unixepoch') ELSE substr(occurredAt,1,10) END >= min(OLD.effectiveDate,NEW.effectiveDate);
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardExpense
          WHERE currency != COALESCE((SELECT reportingCurrency FROM FinancialSettings WHERE id='default'),'CNY') AND CASE WHEN typeof(occurredAt)='integer' THEN strftime('%Y-%m-%d',occurredAt/1000,'unixepoch') ELSE substr(occurredAt,1,10) END >= min(OLD.effectiveDate,NEW.effectiveDate);
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardValuation
          WHERE currency != COALESCE((SELECT reportingCurrency FROM FinancialSettings WHERE id='default'),'CNY') AND CASE WHEN typeof(valuedAt)='integer' THEN strftime('%Y-%m-%d',valuedAt/1000,'unixepoch') ELSE substr(valuedAt,1,10) END >= min(OLD.effectiveDate,NEW.effectiveDate);
      END;
CREATE TRIGGER report_settings_DELETE AFTER DELETE ON FinancialSettings BEGIN
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card;
      END;
CREATE TRIGGER report_rates_DELETE AFTER DELETE ON ExchangeRate BEGIN
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardTransaction
          WHERE (currency != COALESCE((SELECT reportingCurrency FROM FinancialSettings WHERE id='default'),'CNY') OR paymentsJson IS NOT NULL) AND CASE WHEN typeof(occurredAt)='integer' THEN strftime('%Y-%m-%d',occurredAt/1000,'unixepoch') ELSE substr(occurredAt,1,10) END >= OLD.effectiveDate;
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardExpense
          WHERE currency != COALESCE((SELECT reportingCurrency FROM FinancialSettings WHERE id='default'),'CNY') AND CASE WHEN typeof(occurredAt)='integer' THEN strftime('%Y-%m-%d',occurredAt/1000,'unixepoch') ELSE substr(occurredAt,1,10) END >= OLD.effectiveDate;
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardValuation
          WHERE currency != COALESCE((SELECT reportingCurrency FROM FinancialSettings WHERE id='default'),'CNY') AND CASE WHEN typeof(valuedAt)='integer' THEN strftime('%Y-%m-%d',valuedAt/1000,'unixepoch') ELSE substr(valuedAt,1,10) END >= OLD.effectiveDate;
      END;
CREATE TRIGGER Scout_card_delete BEFORE DELETE ON Card BEGIN UPDATE CollectionPlan SET cardId=NULL WHERE cardId=OLD.id; END;
CREATE TRIGGER Scout_progress_delete AFTER DELETE ON ScoutWishCard BEGIN UPDATE CollectionPlan SET status='planned', updatedAt=CAST(strftime('%s','now') AS INTEGER)*1000 WHERE id=OLD.planId AND status='acquired' AND EXISTS(SELECT 1 FROM ScoutWishDetails d WHERE d.planId=OLD.planId AND d.targetCount > (SELECT COUNT(*) FROM ScoutWishCard WHERE planId=OLD.planId)); END;
INSERT INTO "DataRevision" ("id","revision","projectionRevision","projectionDay") VALUES (1,0,-1,'');
