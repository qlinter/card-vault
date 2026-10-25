import "server-only";
import { resetPortfolioHistory, portfolioResetVersion } from "../scripts/reset-portfolio-history";
import { resolveCollectionDatabasePath } from "./scout-ready";
import { ensureHistoryReady } from "./history-readiness";

export function ensurePortfolioReady() {
  return ensureHistoryReady(resolveCollectionDatabasePath(), portfolioResetVersion, resetPortfolioHistory);
}
