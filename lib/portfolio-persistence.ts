import "server-only";

import type { PortfolioSnapshotRecord } from "@prisma/client";
import { normalizeStoredPortfolioSnapshot, type PortfolioFilterInput, type PortfolioSnapshot } from "./portfolio-analysis.ts";
import { normalizePortfolioFilterInput } from "./portfolio-analysis-scope.ts";
import { prisma } from "./prisma";

const maximumStoredSnapshots = 200;

function requiredName(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`请填写${label}。`);
  const name = value.trim();
  if (name.length > maximumLength) throw new Error(`${label}不能超过 ${maximumLength} 个字符。`);
  return name;
}

function parseQueryJson(value: string): PortfolioFilterInput {
  try {
    return normalizePortfolioFilterInput(JSON.parse(value));
  } catch {
    throw new Error("快照筛选条件已损坏。");
  }
}

function parseSnapshotJson(value: string): PortfolioSnapshot {
  try {
    return normalizeStoredPortfolioSnapshot(JSON.parse(value));
  } catch {
    throw new Error("时间点组合快照格式不受支持或已损坏，无法用于比较，请重新保存当前快照。");
  }
}

export type StoredPortfolioSnapshot = {
  id: string;
  name: string;
  query: PortfolioFilterInput;
  capturedAt: string;
};

type SnapshotMetadata = Pick<PortfolioSnapshotRecord, "id" | "name" | "queryJson" | "capturedAt">;

function mapSnapshot(record: SnapshotMetadata): StoredPortfolioSnapshot {
  return {
    id: record.id,
    name: record.name,
    query: parseQueryJson(record.queryJson),
    capturedAt: record.capturedAt.toISOString()
  };
}

export async function renameStoredPortfolioSnapshot(id: string, value: unknown): Promise<void> {
  const name = requiredName(value, "快照名称", 80);
  const result = await prisma.portfolioSnapshotRecord.updateMany({ where: { id }, data: { name } });
  if (!result.count) throw new Error("时间点快照不存在或已删除。");
}

export async function listStoredPortfolioSnapshots(): Promise<StoredPortfolioSnapshot[]> {
  const records = await prisma.portfolioSnapshotRecord.findMany({
    // The picker needs metadata only; frozen financial payloads may be large.
    select: { id: true, name: true, queryJson: true, capturedAt: true },
    orderBy: { capturedAt: "desc" },
    take: maximumStoredSnapshots
  });
  return records.map(mapSnapshot);
}

export async function getStoredPortfolioSnapshot(id: string): Promise<{
  record: StoredPortfolioSnapshot;
  snapshot: PortfolioSnapshot;
} | null> {
  if (!id || id.length > 100) return null;
  const value = await prisma.portfolioSnapshotRecord.findUnique({ where: { id } });
  return value ? { record: mapSnapshot(value), snapshot: parseSnapshotJson(value.snapshotJson) } : null;
}

export async function createStoredPortfolioSnapshot(input: {
  name?: unknown;
  query: unknown;
  snapshot: PortfolioSnapshot;
}): Promise<StoredPortfolioSnapshot> {
  const snapshot = normalizeStoredPortfolioSnapshot(input.snapshot);
  if (await prisma.portfolioSnapshotRecord.count() >= maximumStoredSnapshots) {
    throw new Error(`时间点快照最多保存 ${maximumStoredSnapshots} 个，请先删除不再使用的快照。`);
  }
  const query = normalizePortfolioFilterInput(input.query);
  const capturedAt = new Date();
  const defaultName = `组合快照 ${capturedAt.toLocaleString("zh-CN", { hour12: false })}`;
  const name = input.name === undefined || input.name === null || input.name === ""
    ? defaultName
    : requiredName(input.name, "快照名称", 80);
  return mapSnapshot(await prisma.portfolioSnapshotRecord.create({
    data: {
      name,
      queryJson: JSON.stringify(query),
      snapshotJson: JSON.stringify(snapshot),
      capturedAt
    }
  }));
}

export async function deleteStoredPortfolioSnapshot(id: string): Promise<void> {
  const result = await prisma.portfolioSnapshotRecord.deleteMany({ where: { id } });
  if (result.count === 0) throw new Error("时间点快照不存在或已删除。");
}
