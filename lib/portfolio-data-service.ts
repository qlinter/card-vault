import "server-only";
import { createRevisionCache } from "./revision-cache";
import { createPortfolioCacheBoundary } from "./portfolio-cache-boundary";
import { createDataCollector } from "./portfolio-workspace";
import type { DataWorkspace } from "./portfolio-workspace-types";
import { createDataRowSelector } from "./portfolio-data-rows";
import { loadPortfolioSnapshot, type PortfolioSnapshotResult } from "./portfolio-snapshot-service";
import { normalizePortfolioFilterInput } from "./portfolio-analysis-scope";
import { OperationError, operationMessages } from "./operation-errors";
import { scoutIdentity } from "./scout-identity";
import { prisma } from "./prisma";

type Loaded = { result: PortfolioSnapshotResult; workspace: DataWorkspace };
const cache = createRevisionCache<Loaded & { selectRows: ReturnType<typeof createDataRowSelector>; asOf: number; validUntil: number }>();
const revision = async () => (await prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 }, select: { revision: true } })).revision.toString();

export async function loadPortfolioData(value: unknown, state: Record<string, string | undefined>): Promise<Loaded> {
  const query = normalizePortfolioFilterInput(value);
  const includeDetails = state.tab === "trends";
  const key = JSON.stringify([scoutIdentity(), Object.entries(query).sort(([a], [b]) => a.localeCompare(b)), includeDetails]);
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await revision();
    const load = async () => {
      const asOf = new Date(), boundary = createPortfolioCacheBoundary(asOf);
      const collector = createDataCollector(asOf);
      const result = await loadPortfolioSnapshot(query, { asOf, allowEmpty: true, includeDetails,
        onReportingBatch: (reporting, originals) => { collector.add(reporting, originals); boundary.add(originals); } });
      if (await revision() !== before) throw new OperationError("data_changed", operationMessages.dataChanged);
      if (Date.now() >= boundary.expiresAt() || Date.now() < asOf.getTime()) throw new OperationError("data_changed", operationMessages.dataChanged);
      const workspace = collector.finishAll();
      const loaded = { result, workspace, selectRows: createDataRowSelector(workspace.rows), asOf: asOf.getTime(), validUntil: boundary.expiresAt() };
      return { value: loaded, createdAt: asOf.getTime(), expiresAt: boundary.expiresAt(), weight: Buffer.byteLength(JSON.stringify({ result, workspace })) + workspace.rows.length * 32 };
    };
    try {
      const loaded = await cache.get(key, before, load);
      if (await revision() !== before || Date.now() >= loaded.validUntil || Date.now() < loaded.asOf) continue;
      return { result: loaded.result, workspace: { ...loaded.workspace,
        ...(state.tab === "details" ? loaded.selectRows(state) : { rows: [] }) } };
    } catch (error) {
      if (!(error instanceof OperationError && error.code === "data_changed")) throw error;
    }
  }
  throw new OperationError("data_changed", operationMessages.dataChanged);
}
