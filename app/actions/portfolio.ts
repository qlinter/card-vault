"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage } from "@/lib/feedback-messages";
import { normalizePortfolioFilterInput, type PortfolioFilterInput } from "@/lib/portfolio-analysis";
import {
  createSavedPortfolioView,
  createStoredPortfolioSnapshot,
  deleteSavedPortfolioView,
  deleteStoredPortfolioSnapshot,
  getSavedPortfolioView
} from "@/lib/portfolio-persistence";
import { loadPortfolioSnapshot } from "@/lib/portfolio-snapshot-service";

function textValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function queryFromJson(value: FormDataEntryValue | null): PortfolioFilterInput {
  if (typeof value !== "string" || !value) return {};
  try {
    return normalizePortfolioFilterInput(JSON.parse(value));
  } catch {
    throw new Error("当前组合筛选条件无效，请刷新页面后重试。");
  }
}

function portfolioPath(query: PortfolioFilterInput, values: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const suffix = params.toString();
  return suffix ? `/portfolio?${suffix}` : "/portfolio";
}

export async function createPortfolioViewAction(formData: FormData): Promise<void> {
  let path = "/portfolio";
  let query: PortfolioFilterInput = {};
  try {
    query = queryFromJson(formData.get("queryJson"));
    const view = await createSavedPortfolioView(formData.get("name"), query);
    revalidatePath("/portfolio");
    path = portfolioPath(query, { viewId: view.id, success: "收藏视图已保存。" });
  } catch (error) {
    path = portfolioPath(query, { error: errorMessage(error, "保存收藏视图失败。") });
  }
  redirect(path);
}

export async function deletePortfolioViewAction(viewId: string): Promise<void> {
  let path = "/portfolio";
  try {
    await deleteSavedPortfolioView(viewId);
    revalidatePath("/portfolio");
    path = portfolioPath({}, { success: "收藏视图已删除，已保存的时间点快照仍会保留。" });
  } catch (error) {
    path = portfolioPath({}, { error: errorMessage(error, "删除收藏视图失败。") });
  }
  redirect(path);
}

export async function createPortfolioSnapshotAction(formData: FormData): Promise<void> {
  let path = "/portfolio";
  let query: PortfolioFilterInput = {};
  const savedViewId = textValue(formData.get("savedViewId")) || null;
  try {
    const savedView = savedViewId ? await getSavedPortfolioView(savedViewId) : null;
    if (savedViewId && !savedView) throw new Error("当前收藏视图不存在或已删除。");
    query = savedView?.query ?? queryFromJson(formData.get("queryJson"));
    const result = await loadPortfolioSnapshot(query, { allowEmpty: true });
    await createStoredPortfolioSnapshot({
      name: formData.get("name"),
      query,
      snapshot: result.snapshot,
      savedViewId
    });
    revalidatePath("/portfolio");
    path = portfolioPath(query, { viewId: savedViewId ?? undefined, success: "时间点组合快照已保存。" });
  } catch (error) {
    path = portfolioPath(query, { viewId: savedViewId ?? undefined, error: errorMessage(error, "保存时间点快照失败。") });
  }
  redirect(path);
}

export async function deletePortfolioSnapshotAction(snapshotId: string): Promise<void> {
  let path = "/portfolio";
  try {
    await deleteStoredPortfolioSnapshot(snapshotId);
    revalidatePath("/portfolio");
    path = portfolioPath({}, { success: "时间点组合快照已删除。" });
  } catch (error) {
    path = portfolioPath({}, { error: errorMessage(error, "删除时间点快照失败。") });
  }
  redirect(path);
}
