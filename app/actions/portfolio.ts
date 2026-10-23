"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage } from "@/lib/feedback-messages";
import { normalizePortfolioFilterInput, type PortfolioFilterInput } from "@/lib/portfolio-analysis";
import { createStoredPortfolioSnapshot, deleteStoredPortfolioSnapshot, renameStoredPortfolioSnapshot } from "@/lib/portfolio-persistence";
import { loadPortfolioSummary } from "@/lib/portfolio-snapshot-service";
import { buildQueryHref } from "@/lib/query-params";
import { normalizePortfolioWorkspaceState } from "@/lib/portfolio-workspace-state";

function textValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}
function queryFromJson(value: FormDataEntryValue | null): PortfolioFilterInput {
  if (typeof value !== "string" || !value) return {};
  try { return normalizePortfolioFilterInput(JSON.parse(value)); }
  catch { throw new Error("当前组合筛选条件无效，请刷新页面后重试。"); }
}
function formPath(form: FormData, query: PortfolioFilterInput, values: Record<string, string | undefined> = {}) {
  let state: Record<string, string> = {};
  try {
    state = normalizePortfolioWorkspaceState(JSON.parse(textValue(form.get("stateJson")) || "{}"));
  } catch { /* Invalid presentation state falls back to the current scope. */ }
  return buildQueryHref("/portfolio", { ...query, ...state, workspace: "1", ...values });
}

export async function createPortfolioSnapshotAction(formData: FormData): Promise<void> {
  let path = "/portfolio", query: PortfolioFilterInput = {};
  try {
    query = queryFromJson(formData.get("queryJson"));
    const result = await loadPortfolioSummary(query, { allowEmpty: true });
    await createStoredPortfolioSnapshot({ name: formData.get("name"), query, snapshot: result.snapshot });
    revalidatePath("/portfolio");
    path = formPath(formData, query, { success: "时间点组合快照已保存。" });
  } catch (error) { path = formPath(formData, query, { error: errorMessage(error, "保存时间点快照失败。") }); }
  redirect(path);
}
export async function deletePortfolioSnapshotAction(snapshotId: string, formData: FormData): Promise<void> {
  let path = "/portfolio", query: PortfolioFilterInput = {};
  try {
    query = queryFromJson(formData.get("queryJson"));
    await deleteStoredPortfolioSnapshot(snapshotId);
    revalidatePath("/portfolio");
    path = formPath(formData, query, { success: "时间点组合快照已删除。" });
  } catch (error) { path = formPath(formData, query, { error: errorMessage(error, "删除时间点快照失败。") }); }
  redirect(path);
}
export async function renamePortfolioSnapshotAction(formData: FormData): Promise<void> {
  let path, query: PortfolioFilterInput = {};
  try {
    query = queryFromJson(formData.get("queryJson"));
    await renameStoredPortfolioSnapshot(textValue(formData.get("id")), formData.get("name"));
    revalidatePath("/portfolio");
    path = formPath(formData, query, { success: "快照名称已更新。" });
  } catch (error) { path = formPath(formData, query, { error: errorMessage(error, "保存时间点快照失败。") }); }
  redirect(path);
}
