"use client";

import { UiText } from "@/components/ui-text";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/feedback-messages";
import type { CardEntryRecognitionSummary } from "@/lib/card-entry-queue-domain";
import {
  cardRecognitionFieldLabel,
  cardRecognitionFields,
  lowConfidenceCardRecognitionFields,
  type CardRecognitionConfidence,
  type CardRecognitionSuggestion
} from "@/lib/card-recognition-domain";
import { setCardFormCheckbox, setCardFormText } from "@/lib/card-form-controls";

type AiRecognitionPanelProps = {
  mode?: "create" | "edit";
  defaultImageUrls?: string[];
  queueItemId?: string;
  persistedRecognition?: CardEntryRecognitionSummary;
};

function clearRecognizedFields(input: HTMLInputElement): void {
  const form = input.closest("form");
  if (!form) {
    return;
  }

  setCardFormText(form, "notes", "");
  // Clear supporting text first so automatic attribute checks cannot restore old flags.
  for (const field of cardRecognitionFields) {
    if (field !== "isRookie" && field !== "isAutograph" && field !== "isPatch") setCardFormText(form, field, "");
  }
  for (const field of ["isSerialNumbered", "isRookie", "isAutograph", "isPatch"]) setCardFormCheckbox(form, field, false);
}

function applySuggestion(
  button: HTMLButtonElement,
  suggestion: CardRecognitionSuggestion,
  overwrite: boolean
): string[] {
  const form = button.closest("form");
  if (!form) {
    return [];
  }

  setCardFormText(form, "notes", "");
  const applied: string[] = [];

  for (const field of cardRecognitionFields) {
    const value = suggestion[field];
    const changed = typeof value === "string"
      ? Boolean(value.trim()) && setCardFormText(form, field, value, overwrite)
      : typeof value === "boolean" && setCardFormCheckbox(form, field, value, overwrite);
    if (changed) {
      applied.push(cardRecognitionFieldLabel(field));
    }
  }

  return applied;
}

async function appendUrlImages(formData: FormData, urls: string[], signal?: AbortSignal): Promise<number> {
  let count = 0;

  for (const url of urls.slice(0, 2)) {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`读取已有图片失败：${response.status}`);
    }
    const blob = await response.blob();
    formData.append("images", blob, `existing-${count + 1}.${blob.type.split("/")[1] || "jpg"}`);
    count += 1;
  }

  return count;
}

export function AiRecognitionPanel({
  mode = "create",
  defaultImageUrls = [],
  queueItemId,
  persistedRecognition
}: AiRecognitionPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);
  const [overwrite, setOverwrite] = useState(false);
  const [useExistingImages, setUseExistingImages] = useState(defaultImageUrls.length > 0);
  const [isPending, setIsPending] = useState(false);
  const [messageIsError, setMessageIsError] = useState(false);
  const [message, setMessage] = useState<string | null>(() => {
    if (persistedRecognition?.status !== "review") return null;
    return persistedRecognition.lowConfidenceFields.length > 0
      ? `已载入 AI 候选；低置信字段：${persistedRecognition.lowConfidenceFields.join("、")}。请重点核对。`
      : "已载入 AI 识别候选，请核对后保存。";
  });

  function handleImageSelectionChange(event: React.ChangeEvent<HTMLInputElement>) {
    setMessageIsError(false);
    activeRequest.current?.abort();
    clearRecognizedFields(event.currentTarget);
    const count = event.currentTarget.files?.length ?? 0;
    setUseExistingImages(false);
    setMessage(count > 0 ? "已清空旧识别信息，请重新识别当前图片。" : "已清空旧识别信息。");
  }

  async function handleRecognize() {
    if (activeRequest.current) return;
    const files = Array.from(fileInputRef.current?.files ?? []);

    if (!useExistingImages && (files.length < 1 || files.length > 2)) {
      setMessageIsError(true);
      setMessage("请选择 1 到 2 张图片用于 AI 识别，或使用已有默认图片。");
      return;
    }

    setIsPending(true);
    setMessageIsError(false);
    setMessage(null);
    const controller = new AbortController();
    activeRequest.current = controller;

    try {
      let suggestion: CardRecognitionSuggestion | undefined;
      let confidence: CardRecognitionConfidence | undefined;
      if (queueItemId && useExistingImages) {
        const response = await fetch(
          `/api/card-entry/queue/${encodeURIComponent(queueItemId)}/recognize`,
          { method: "POST", signal: controller.signal }
        );
        const data = await response.json() as {
          recognition?: CardEntryRecognitionSummary;
          error?: string;
        };
        if (!response.ok || !data.recognition?.suggestion) {
          throw new Error(data.error || "AI 识别失败。");
        }
        suggestion = data.recognition.suggestion;
        confidence = data.recognition.confidence;
      } else {
        const formData = new FormData();
        if (useExistingImages) {
          const count = await appendUrlImages(formData, defaultImageUrls, controller.signal);
          if (count < 1) {
            throw new Error("当前卡片没有可用于识别的已有图片。");
          }
        } else {
          for (const file of files) {
            formData.append("images", file);
          }
        }
        const response = await fetch("/api/ai/recognize-card", {
          method: "POST",
          body: formData,
          signal: controller.signal
        });
        const data = (await response.json()) as {
          suggestion?: CardRecognitionSuggestion;
          confidence?: CardRecognitionConfidence;
          error?: string;
        };
        if (!response.ok || !data.suggestion) {
          throw new Error(data.error || "AI 识别失败。");
        }
        suggestion = data.suggestion;
        confidence = data.confidence;
      }

      controller.signal.throwIfAborted();
      const button = actionButtonRef.current;
      const applied = button && suggestion
        ? applySuggestion(button, suggestion, overwrite)
        : [];
      const lowConfidence = confidence
        ? lowConfidenceCardRecognitionFields(confidence).map(cardRecognitionFieldLabel)
        : [];
      const confidenceNote = lowConfidence.length > 0
        ? ` 低置信字段：${lowConfidence.join("、")}，请重点核对。`
        : "";
      setMessage(
        (applied.length > 0
          ? `已填入 ${applied.join("、")}。`
          : "AI 返回了建议，但当前表单没有可填入的空字段。") + confidenceNote
      );
    } catch (error) {
      setMessageIsError(!controller.signal.aborted);
      const detail = controller.signal.aborted ? "已取消识别，可以重新开始。" : errorMessage(error, "请稍后重试。");
      setMessage(detail);
    } finally {
      activeRequest.current = null;
      setIsPending(false);
    }
  }

  return (
    <div className="ai-recognition-panel">
      <div className="title-row" style={{ marginBottom: "0.6rem" }}>
        <div>
          {mode === "create" ? <h2 className="ai-recognition-heading">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z" /></svg>
            <UiText text="AI 识图录入" />
          </h2> : <strong><UiText text="AI 识图填充" /></strong>}
        </div>
        <Link href="/settings" className={mode === "create" ? "btn btn-secondary btn-quiet" : "btn btn-secondary"}><UiText text={"AI 设置"} /></Link>
      </div>

      <div className="ai-recognition-grid">
        <label className="field">
          <span><UiText text={"识别图片"} /></span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleImageSelectionChange}
          />
        </label>

        <label className="field ai-checkbox-field">
          <span>
            <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} /><UiText text={"覆盖当前字段"} /></span>
        </label>
        <div className="ai-actions">
          <button
            ref={actionButtonRef}
            type="button"
            className={mode === "create" ? "btn btn-secondary btn-quiet btn-soft" : "btn btn-primary"}
            onClick={handleRecognize}
            disabled={isPending}
          >
            {isPending ? <UiText text={"识别中..."} /> : mode === "edit" ? <UiText text={"识别并填充"} /> : <UiText text={"识别并填入"} />}
          </button>
          {isPending ? <button type="button" className="btn btn-secondary" onClick={() => activeRequest.current?.abort()}><UiText text="取消识别" /></button> : null}
        </div>
      </div>

      {defaultImageUrls.length > 0 ? (
        <label className="field ai-existing-image-option">
          <span>
            <input type="checkbox" checked={useExistingImages} onChange={(event) => setUseExistingImages(event.target.checked)} /><UiText text={" 使用"} />{mode === "edit" ? <UiText text={"已有默认"} /> : <UiText text={"队列预处理"} />}<UiText text={"图片识别"} /></span>
        </label>
      ) : null}

      {message ? (
        <p className={messageIsError ? "note-error" : "muted"} role={messageIsError ? "alert" : "status"} style={{ margin: "0.65rem 0 0" }}>
          <UiText text={message} />
        </p>
      ) : null}
    </div>
  );
}
