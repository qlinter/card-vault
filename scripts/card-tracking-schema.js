// Triggers cover forms, imports, undo and direct ledger writes without changing facts.
function createCardTrackingSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS CardReportDirty(cardId TEXT PRIMARY KEY NOT NULL REFERENCES Card(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS CardTracking(
      cardId TEXT PRIMARY KEY NOT NULL REFERENCES Card(id) ON DELETE CASCADE,
      statusStartedAt DATETIME NOT NULL, statusDateEstimated BOOLEAN NOT NULL DEFAULT 0,
      statusRevision INTEGER NOT NULL DEFAULT 0, imagesRevision INTEGER NOT NULL DEFAULT 0,
      purchaseRevision INTEGER NOT NULL DEFAULT 0, valuationRevision INTEGER NOT NULL DEFAULT 0
    );
    CREATE TRIGGER IF NOT EXISTS tracking_card_insert AFTER INSERT ON Card BEGIN
      INSERT INTO CardTracking(cardId,statusStartedAt) VALUES(NEW.id,NEW.createdAt);
      INSERT OR IGNORE INTO CardReportDirty(cardId) VALUES(NEW.id);
    END;
    CREATE TRIGGER IF NOT EXISTS tracking_status_update AFTER UPDATE OF collectionStatus ON Card
    WHEN OLD.collectionStatus IS NOT NEW.collectionStatus BEGIN
      UPDATE CardTracking SET statusStartedAt=CURRENT_TIMESTAMP,statusDateEstimated=0,statusRevision=statusRevision+1 WHERE cardId=NEW.id;
    END;
    CREATE TRIGGER IF NOT EXISTS report_card_update AFTER UPDATE OF collectionStatus,holdingQuantity ON Card
    WHEN OLD.collectionStatus IS NOT NEW.collectionStatus OR OLD.holdingQuantity IS NOT NEW.holdingQuantity BEGIN
      INSERT OR IGNORE INTO CardReportDirty(cardId) VALUES(NEW.id);
    END;
  `);
  for (const [table, revision] of [["CardImage", "imagesRevision"], ["CardTransaction", "purchaseRevision"], ["CardValuation", "valuationRevision"], ["CardExpense", null]]) {
    for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
      const ids = operation === "INSERT" ? "NEW.cardId" : operation === "DELETE" ? "OLD.cardId" : "OLD.cardId,NEW.cardId";
      const update = table === "CardImage" && operation === "UPDATE" ? "UPDATE OF cardId" : operation;
      db.exec(`CREATE TRIGGER IF NOT EXISTS tracking_${table}_${operation} AFTER ${update} ON ${table} BEGIN
        ${revision ? `UPDATE CardTracking SET ${revision}=${revision}+1 WHERE cardId IN (${ids});` : ""}
        ${table !== "CardImage" ? `INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card WHERE id IN (${ids});` : ""}
      END;`);
    }
  }
  for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
    const effectiveDate = operation === "UPDATE" ? "min(OLD.effectiveDate,NEW.effectiveDate)" : `${operation === "DELETE" ? "OLD" : "NEW"}.effectiveDate`;
    const businessDay = field => `CASE WHEN typeof(${field})='integer' THEN strftime('%Y-%m-%d',${field}/1000,'unixepoch') ELSE substr(${field},1,10) END`;
    const mainCurrency = "COALESCE((SELECT reportingCurrency FROM FinancialSettings WHERE id='default'),'CNY')";
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS report_settings_${operation} AFTER ${operation} ON FinancialSettings BEGIN
        INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card;
      END;
      CREATE TRIGGER IF NOT EXISTS report_rates_${operation} AFTER ${operation} ON ExchangeRate BEGIN
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardTransaction
          WHERE (currency != ${mainCurrency} OR paymentsJson IS NOT NULL) AND ${businessDay("occurredAt")} >= ${effectiveDate};
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardExpense
          WHERE currency != ${mainCurrency} AND ${businessDay("occurredAt")} >= ${effectiveDate};
        INSERT OR IGNORE INTO CardReportDirty SELECT cardId FROM CardValuation
          WHERE currency != ${mainCurrency} AND ${businessDay("valuedAt")} >= ${effectiveDate};
      END;
    `);
  }
}

module.exports = { createCardTrackingSchema };
