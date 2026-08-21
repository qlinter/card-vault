"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DisclosureIcon } from "@/components/disclosure-icon";
import type { CardEntryQueueItemSummary } from "@/lib/card-entry-queue-domain";

type CardEntryQueuePanelProps = {
  items: CardEntryQueueItemSummary[];
  activeItemId?: string;
};

type QueueMutationResponse = {
  error?: string;
  itemCount?: number;
  readyCount?: number;
  failedCount?: number;
};

function formatBytes(value?: number): string {
  if (!value) return "0 KB";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(status: CardEntryQueueItemSummary["status"]): string {
  if (status === "ready") return "待录入";
  if (status === "failed") return "处理失败";
  return "处理中";
}

export function CardEntryQueuePanel({
  items,
  activeItemId
}: CardEntryQueuePanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecognizingBatch, setIsRecognizingBatch] = useState(false);
  const [isExpanded, setIsExpanded] = useState(
    items.length > 0 || Boolean(activeItemId)
  );
  const [pendingItemId, setPendingItemId] = useState<string>();
  const [message, setMessage] = useState("");

  async function importBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const files = formData.getAll("images").filter((value) => value instanceof File && value.size > 0);
    if (files.length < 1) {
      setMessage("请先选择图片。");
      return;
    }

    setIsUploading(true);
    setMessage("正在校验、自动旋转并压缩图片...");
    try {
      const response = await fetch("/api/card-entry/queue", {
        method: "POST",
        body: formData
      });
      const result = (await response.json()) as QueueMutationResponse;
      if (!response.ok) throw new Error(result.error || "批量导入失败。");
      setMessage(
        `已建立 ${result.itemCount ?? 0} 个项目：${result.readyCount ?? 0} 个可录入，${result.failedCount ?? 0} 个失败。`
      );
      form.reset();
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批量导入失败。");
    } finally {
      setIsUploading(false);
    }
  }

  async function mutateItem(
    id: string,
    operation: "retry" | "swap" | "delete"
  ) {
    if (operation === "delete" && !window.confirm("确定移除这个待处理项目及其队列图片吗？")) {
      return;
    }
    setPendingItemId(id);
    setMessage(
      operation === "retry"
        ? "正在重试图片预处理..."
        : operation === "swap"
          ? "正在交换正反面..."
          : "正在移除待处理项目..."
    );
    try {
      const suffix = operation === "delete" ? "" : `/${operation}`;
      const response = await fetch(
        `/api/card-entry/queue/${encodeURIComponent(id)}${suffix}`,
        { method: operation === "delete" ? "DELETE" : "POST" }
      );
      const result = (await response.json()) as QueueMutationResponse;
      if (!response.ok) throw new Error(result.error || "队列操作失败。");
      setMessage(
        operation === "retry"
          ? "重试完成。"
          : operation === "swap"
            ? "正反面顺序已交换。"
            : "待处理项目已移除。"
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "队列操作失败。");
    } finally {
      setPendingItemId(undefined);
    }
  }

  async function recognizeItem(id: string, refresh = true): Promise<boolean> {
    setPendingItemId(id);
    setMessage("正在识别当前项目...");
    try {
      const response = await fetch(
        `/api/card-entry/queue/${encodeURIComponent(id)}/recognize`,
        { method: "POST" }
      );
      const result = await response.json() as QueueMutationResponse;
      if (!response.ok) throw new Error(result.error || "AI 识别失败。");
      setMessage("识别候选已保存，请进入录入逐项确认。");
      if (refresh) router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 识别失败。");
      return false;
    } finally {
      setPendingItemId(undefined);
    }
  }

  async function recognizePendingItems() {
    const pending = items.filter((item) =>
      item.status === "ready" &&
      item.recognition?.status !== "review" &&
      item.recognition?.status !== "recognizing"
    );
    if (pending.length < 1) {
      setMessage("没有需要识别的待录入项目。");
      return;
    }
    setIsRecognizingBatch(true);
    let succeeded = 0;
    for (const [index, item] of pending.entries()) {
      setMessage(`正在识别 ${index + 1}/${pending.length}：${item.batchLabel}`);
      if (await recognizeItem(item.id, false)) succeeded += 1;
    }
    setMessage(`批量识别完成：${succeeded} 个成功，${pending.length - succeeded} 个失败。所有结果仍需逐项确认。`);
    setIsRecognizingBatch(false);
    router.refresh();
  }

  return (
    <details
      className="entry-queue-panel panel"
      aria-label="批量录入"
      open={isExpanded}
      onToggle={(event) => setIsExpanded(event.currentTarget.open)}
    >
      <summary className="entry-queue-header">
        <span className="entry-queue-title">批量录入</span>
        <span className="entry-queue-summary-meta">
          <span className="entry-queue-count">{items.length}</span>
          <DisclosureIcon expanded={isExpanded} className="entry-queue-chevron" />
        </span>
      </summary>

      <form className="entry-queue-import" onSubmit={importBatch}>
        <label className="field">
          <span>批次名称（可选）</span>
          <input name="label" maxLength={120} placeholder="例如 2026-08 拆盒" />
        </label>
        <label className="field">
          <span>图片分组方式</span>
          <select name="pairingMode" defaultValue="pairs">
            <option value="pairs">按选择顺序两张一组（正面 / 背面）</option>
            <option value="single">每张图片单独一项</option>
          </select>
        </label>
        <label className="field entry-queue-file-field">
          <span>选择图片（最多 20 张，总计 100MB）</span>
          <input
            ref={fileInputRef}
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={isUploading}>
          {isUploading ? "正在预处理..." : "导入并预处理"}
        </button>
      </form>

      {items.some((item) => item.status === "ready") ? (
        <div className="entry-queue-batch-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isRecognizingBatch || isUploading}
            onClick={recognizePendingItems}
          >
            {isRecognizingBatch ? "批量识别中..." : "识别未完成项目"}
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="entry-queue-message" aria-live="polite">{message}</p>
      ) : null}

      {items.length > 0 ? (
        <div className="entry-queue-list">
          {items.map((item) => (
            <article
              key={item.id}
              className={`entry-queue-item${item.id === activeItemId ? " is-active" : ""}`}
            >
              <div className="entry-queue-thumbnails">
                {item.images.map((image) => (
                  image.url ? (
                    <figure key={image.id}>
                      <img src={image.url} alt={`${image.side === "front" ? "正面" : "背面"}：${image.originalName}`} />
                      <figcaption>{image.side === "front" ? "正面" : "背面"}</figcaption>
                    </figure>
                  ) : (
                    <div className="entry-queue-placeholder" key={image.id}>
                      {image.originalName}
                    </div>
                  )
                ))}
              </div>
              <div className="entry-queue-item-body">
                <div className="entry-queue-item-title">
                  <strong>{item.batchLabel}</strong>
                  <span className={`entry-queue-status is-${item.status}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <small>
                  第 {item.attemptCount} 次处理 · {item.images.map((image) =>
                    image.processedBytes
                      ? `${formatBytes(image.originalBytes)} → ${formatBytes(image.processedBytes)}`
                      : formatBytes(image.originalBytes)
                  ).join(" / ")}
                </small>
                {item.recognition ? (
                  <p className={`entry-recognition-state is-${item.recognition.status}`}>
                    {item.recognition.status === "review"
                      ? item.recognition.lowConfidenceFields.length > 0
                        ? `AI 待确认 · 低置信：${item.recognition.lowConfidenceFields.join("、")}`
                        : "AI 待确认"
                      : item.recognition.status === "failed"
                        ? `AI 失败：${item.recognition.errorMessage || "请重新识别"}`
                        : "AI 识别中"}
                  </p>
                ) : null}
                {item.errorMessage ? <p className="note-error">{item.errorMessage}</p> : null}
                <div className="entry-queue-actions">
                  {item.status === "ready" ? (
                    <a
                      className="btn btn-primary"
                      href={`/cards/new?queue=${encodeURIComponent(item.id)}`}
                      onClick={(event) => {
                        if (!document.querySelector('[data-card-entry-form="true"]')) return;
                        event.preventDefault();
                        window.dispatchEvent(new CustomEvent("card-entry:navigate", {
                          detail: `/cards/new?queue=${encodeURIComponent(item.id)}`
                        }));
                      }}
                    >
                      进入录入
                    </a>
                  ) : null}
                  {item.status === "ready" && item.images.length === 2 ? (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      disabled={pendingItemId === item.id}
                      onClick={() => mutateItem(item.id, "swap")}
                    >
                      交换正反面
                    </button>
                  ) : null}
                  {item.status === "ready" && item.recognition?.status !== "recognizing" ? (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      disabled={pendingItemId === item.id || isRecognizingBatch}
                      onClick={() => recognizeItem(item.id)}
                    >
                      {item.recognition?.status === "review" ? "重新识别" : "AI 识别"}
                    </button>
                  ) : null}
                  {item.status === "failed" ? (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      disabled={pendingItemId === item.id}
                      onClick={() => mutateItem(item.id, "retry")}
                    >
                      重试
                    </button>
                  ) : null}
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={pendingItemId === item.id}
                    onClick={() => mutateItem(item.id, "delete")}
                  >
                    移除
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </details>
  );
}
