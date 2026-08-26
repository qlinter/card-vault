import "server-only";

import { Prisma, type PortfolioSavedView, type PortfolioSnapshotRecord } from "@prisma/client";
import { normalizePortfolioSnapshot, type PortfolioFilterInput, type PortfolioSnapshot } from "./portfolio-analysis.ts";
import { normalizePortfolioFilterInput } from "./portfolio-analysis-scope.ts";
import { prisma } from "./prisma";

const maximumSavedViews = 50;
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
    throw new Error("收藏视图筛选条件已损坏。");
  }
}

function parseSnapshotJson(value: string): PortfolioSnapshot {
  try {
    return normalizePortfolioSnapshot(JSON.parse(value));
  } catch {
    throw new Error("时间点组合快照已损坏，无法用于比较。");
  }
}

export type SavedPortfolioView = {
  id: string;
  name: string;
  query: PortfolioFilterInput;
  createdAt: string;
  updatedAt: string;
};

export type StoredPortfolioSnapshot = {
  id: string;
  savedViewId: string | null;
  name: string;
  query: PortfolioFilterInput;
  capturedAt: string;
};

function mapSavedView(view: PortfolioSavedView): SavedPortfolioView {
  return {
    id: view.id,
    name: view.name,
    query: parseQueryJson(view.queryJson),
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString()
  };
}

function mapSnapshot(record: PortfolioSnapshotRecord): StoredPortfolioSnapshot {
  return {
    id: record.id,
    savedViewId: record.savedViewId,
    name: record.name,
    query: parseQueryJson(record.queryJson),
    capturedAt: record.capturedAt.toISOString()
  };
}

export async function listSavedPortfolioViews(): Promise<SavedPortfolioView[]> {
  const views = await prisma.portfolioSavedView.findMany({ orderBy: [{ updatedAt: "desc" }, { name: "asc" }] });
  return views.map(mapSavedView);
}

export async function getSavedPortfolioView(id: string): Promise<SavedPortfolioView | null> {
  if (!id || id.length > 100) return null;
  const view = await prisma.portfolioSavedView.findUnique({ where: { id } });
  return view ? mapSavedView(view) : null;
}

export async function createSavedPortfolioView(nameValue: unknown, queryValue: unknown): Promise<SavedPortfolioView> {
  const name = requiredName(nameValue, "视图名称", 60);
  const query = normalizePortfolioFilterInput(queryValue);
  if (await prisma.portfolioSavedView.count() >= maximumSavedViews) {
    throw new Error(`收藏视图最多保存 ${maximumSavedViews} 个，请先删除不再使用的视图。`);
  }
  try {
    return mapSavedView(await prisma.portfolioSavedView.create({
      data: { name, queryJson: JSON.stringify(query) }
    }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("已经存在同名收藏视图。");
    }
    throw error;
  }
}

export async function deleteSavedPortfolioView(id: string): Promise<void> {
  const result = await prisma.portfolioSavedView.deleteMany({ where: { id } });
  if (result.count === 0) throw new Error("收藏视图不存在或已删除。");
}

export async function listStoredPortfolioSnapshots(): Promise<StoredPortfolioSnapshot[]> {
  const records = await prisma.portfolioSnapshotRecord.findMany({
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
  savedViewId?: string | null;
}): Promise<StoredPortfolioSnapshot> {
  if (await prisma.portfolioSnapshotRecord.count() >= maximumStoredSnapshots) {
    throw new Error(`时间点快照最多保存 ${maximumStoredSnapshots} 个，请先删除不再使用的快照。`);
  }
  const query = normalizePortfolioFilterInput(input.query);
  const capturedAt = new Date();
  const defaultName = `组合快照 ${capturedAt.toLocaleString("zh-CN", { hour12: false })}`;
  const name = input.name === undefined || input.name === null || input.name === ""
    ? defaultName
    : requiredName(input.name, "快照名称", 80);
  const savedView = input.savedViewId ? await getSavedPortfolioView(input.savedViewId) : null;
  if (input.savedViewId && !savedView) throw new Error("关联的收藏视图不存在或已删除。");
  if (savedView && JSON.stringify(savedView.query) !== JSON.stringify(query)) {
    throw new Error("当前筛选范围与关联收藏视图不一致，请重新打开该视图后保存快照。");
  }
  return mapSnapshot(await prisma.portfolioSnapshotRecord.create({
    data: {
      savedViewId: savedView?.id ?? null,
      name,
      queryJson: JSON.stringify(query),
      snapshotJson: JSON.stringify(input.snapshot),
      capturedAt
    }
  }));
}

export async function deleteStoredPortfolioSnapshot(id: string): Promise<void> {
  const result = await prisma.portfolioSnapshotRecord.deleteMany({ where: { id } });
  if (result.count === 0) throw new Error("时间点快照不存在或已删除。");
}
