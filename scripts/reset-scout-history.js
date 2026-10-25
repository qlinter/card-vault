const { resetHistory } = require("./reset-history");

const scoutResetVersion = 1500301;
function resetScoutHistory(dbPath) {
  return resetHistory(dbPath, {
    version: scoutResetVersion, previousVersion: 0,
    tables: ["ScoutWishCard", "ScoutWishWatch", "ScoutWishDetails", "CollectionPlan", "ScoutWatch"],
    recoveryDirectory: "scout-v1.5.0",
    missingMessage: "数据库不存在，未清理寻卡记录。",
    versionMessage: "数据库版本标记未知，未清理寻卡记录。"
  });
}

module.exports = { resetScoutHistory, scoutResetVersion };
