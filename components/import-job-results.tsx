"use client";
import { useLanguage } from "./language-provider";
import type { ImportJobPage } from "@/lib/import-job-state";

type Props = { job: ImportJobPage; busy: boolean; paused: boolean; stop: boolean; onMore: () => void; onRepreview: () => void; onApply: () => void; onPause: () => void; onUndoRequest: () => void; onUndoConfirm: () => void; onUndoCancel: () => void };
export function ImportJobResults({ job, busy, paused, stop, ...actions }: Props) {
  const { locale, t } = useLanguage();
  const l = (zh: string, en: string) => locale === "en" ? en : zh;
  const { onMore, onRepreview, onApply, onPause, onUndoRequest, onUndoConfirm, onUndoCancel } = actions;
  const statusLabel = (status: string) => ({ preview: l("待预演确认", "Preview ready"), running: l("执行中", "Running"), complete: l("已完成", "Complete"), partial: l("部分完成", "Partially complete"), "undo-running": l("撤销中", "Undoing"), "undo-partial": l("部分撤销", "Partially undone"), pending: l("待执行", "Pending"), applied: l("已完成", "Applied"), failed: l("失败", "Failed"), skipped: l("跳过", "Skipped"), undone: l("已撤销", "Undone"), "undo-failed": l("撤销冲突", "Undo conflict") }[status] ?? status);
  return <section className="panel management-section" aria-live="polite">
      <h2>{l("批次预演与结果", "Batch preview & results")}</h2>
      <p>{job.id} · {statusLabel(job.status)} · {job.total}</p>
      {paused ? <p role="status">{l("已在当前批次完成后暂停，可继续执行。", "Paused after the current chunk. You can continue.")}</p> : null}
      <div className="management-toolbar">{["pending", "applied", "failed", "skipped", "undone", "undo-failed"].map(status => <span key={status}>{statusLabel(status)}: {job.counts[status] || 0}</span>)}</div>
      <div className="management-table"><table>
        <thead><tr>{[l("行", "Row"), l("数据", "Data"), l("状态", "Status"), l("结果", "Result")].map(text => <th key={text}>{text}</th>)}</tr></thead>
        <tbody>{job.rows.map(row => <tr key={row.id}><td>{row.rowNumber}</td><td>{Object.entries(row.values).map(([key, value]) => `${key}: ${value}`).join(" · ")}</td><td>{statusLabel(row.status)}</td><td>{row.error ? t(row.error) : row.cardId ? <a href={`/cards/${row.cardId}`}>{row.cardId}</a> : "–"}</td></tr>)}</tbody>
      </table></div>
      {job.nextRow !== null ? <button className="btn btn-secondary" disabled={busy} onClick={onMore}>{l("显示更多结果", "Show more results")}</button> : null}
      <div className="management-toolbar">
        <button className="btn btn-secondary" disabled={busy} onClick={onRepreview}>{l("重新建立预演", "Create fresh preview")}</button>
        <button className="btn" disabled={busy || !(job.counts.pending || job.counts.failed) || job.status === "undone"} onClick={onApply}>{busy ? l("处理中…", "Processing…") : l("执行 / 重试失败行", "Apply / retry failed rows")}</button>
        {busy ? <button className="btn btn-secondary" onClick={onPause}>{l("完成当前批次后暂停", "Pause after current chunk")}</button> : null}
        <button className="btn btn-secondary" disabled={busy || !(job.counts.applied || job.counts["undo-failed"])} onClick={onUndoRequest}>{l("撤销本批次", "Undo this batch")}</button>
      </div>
      {stop ? <p className="note-error">{l("将恢复本批次修改前的值，并删除本批次新建卡片。后续已修改的卡片会保留并提示冲突。", "Restore previous values and delete cards created by this batch. Later edits are preserved and reported as conflicts.")} <button className="btn" disabled={busy} onClick={onUndoConfirm}>{l("确认撤销", "Confirm undo")}</button> <button className="btn btn-secondary" onClick={onUndoCancel}>{l("取消", "Cancel")}</button></p> : null}
    </section>;
}
