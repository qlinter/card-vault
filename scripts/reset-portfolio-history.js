const { resetHistory } = require("./reset-history");
const { resetScoutHistory, scoutResetVersion } = require("./reset-scout-history");

const portfolioResetVersion = 1500302;
function resetPortfolioHistory(dbPath) {
  // Complete an outstanding Scout reset before advancing the shared marker.
  resetScoutHistory(dbPath);
  return resetHistory(dbPath, {
    version: portfolioResetVersion, previousVersion: scoutResetVersion,
    tables: ["PortfolioSnapshotRecord", "PortfolioSavedView"],
    recoveryDirectory: "portfolio-v1.5.0",
    missingMessage: "数据库不存在，未清理分析历史。",
    versionMessage: "数据库版本标记未知，未清理分析历史。"
  });
}

module.exports = { resetPortfolioHistory, portfolioResetVersion };
