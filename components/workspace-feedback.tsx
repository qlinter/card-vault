"use client";

import { useLanguage } from "./language-provider";
import type { WorkspaceIssue } from "./use-workspace-data";

export function WorkspaceFeedback({ issue, submitting, notice, refresh }: { issue: WorkspaceIssue | null; submitting: boolean; notice: boolean; refresh: () => void }) {
  const { locale, t } = useLanguage();
  const l = (zh: string, en: string) => locale === "en" ? en : zh;
  if (issue) return <p className="note-error" role="alert">
    {issue.kind === "refresh" ? l("操作已保存，列表刷新失败。", "Saved, but the list could not be refreshed.") : t(issue.message)}{" "}
    {issue.kind !== "save" ? <button type="button" className="btn btn-secondary" onClick={refresh}>{issue.kind === "refresh" ? l("刷新列表", "Refresh list") : l("重试", "Retry")}</button> : null}
  </p>;
  return submitting || notice ? <p className="workspace-feedback muted" role="status">{submitting ? l("正在保存…", "Saving…") : l("已保存", "Saved")}</p> : null;
}
