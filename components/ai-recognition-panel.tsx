"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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
  for (const field of cardRecognitionFields) {
    if (field === "isRookie" || field === "isAutograph" || field === "isPatch") {
      setCardFormCheckbox(form, field, false);
    } else {
      setCardFormText(form, field, "");
    }
  }
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

async function appendUrlImages(formData: FormData, urls: string[]): Promise<number> {
  let count = 0;

  for (const url of urls.slice(0, 2)) {
    const response = await fetch(url);
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
  const [overwrite, setOverwrite] = useState(false);
  const [useExistingImages, setUseExistingImages] = useState(defaultImageUrls.length > 0);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(() => {
    if (persistedRecognition?.status !== "review") return null;
    return persistedRecognition.lowConfidenceFields.length > 0
      ? `已载入 AI 候选；低置信字段：${persistedRecognition.lowConfidenceFields.join("、")}。请重点核对。`
      : "已载入 AI 识别候选，请核对后保存。";
  });

  function handleImageSelectionChange(event: React.ChangeEvent<HTMLInputElement>) {
    clearRecognizedFields(event.currentTarget);
    const count = event.currentTarget.files?.length ?? 0;
    setUseExistingImages(false);
    setMessage(count > 0 ? "已清空旧识别信息，请重新识别当前图片。" : "已清空旧识别信息。");
  }

  async function handleRecognize() {
    const files = Array.from(fileInputRef.current?.files ?? []);

    if (!useExistingImages && (files.length < 1 || files.length > 2)) {
      setMessage("请选择 1 到 2 张图片用于 AI 识别，或使用已有默认图片。");
      return;
    }

    setIsPending(true);
    setMessage(null);

    try {
      let suggestion: CardRecognitionSuggestion | undefined;
      let confidence: CardRecognitionConfidence | undefined;
      if (queueItemId && useExistingImages) {
        const response = await fetch(
          `/api/card-entry/queue/${encodeURIComponent(queueItemId)}/recognize`,
          { method: "POST" }
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
          const count = await appendUrlImages(formData, defaultImageUrls);
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
          body: formData
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
      const detail = errorMessage(error, "请稍后重试。");
      setMessage(detail);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="ai-recognition-panel">
      <div className="title-row" style={{ marginBottom: "0.6rem" }}>
        <div>
          <strong>{mode === "edit" ? "AI 识图填充" : "AI 识图录入"}</strong>
          <p className="muted" style={{ margin: "0.3rem 0 0" }}>
            {mode === "edit"
              ? "使用已有默认图片或重新选择图片，AI 会补充字段和中文展示描述，备注保持为空。"
              : defaultImageUrls.length > 0
                ? "可直接使用队列预处理图片识别，也可重新选择 1-2 张图片；保存前仍可手动修改。"
                : "选择 1-2 张正反面图片，AI 会生成字段建议；保存前仍可手动修改，备注保持为空。"}
          </p>
        </div>
        <Link href="/settings" className="btn btn-secondary">
          AI 设置
        </Link>
      </div>

      <div className="ai-recognition-grid">
        <label className="field">
          <span>识别图片</span>
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
            <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} /> 覆盖当前字段
          </span>
          <small className="muted">默认只填空字段；需要刷新已有信息时再勾选覆盖。</small>
        </label>
      </div>

      {defaultImageUrls.length > 0 ? (
        <label className="field ai-existing-image-option">
          <span>
            <input type="checkbox" checked={useExistingImages} onChange={(event) => setUseExistingImages(event.target.checked)} /> 使用{mode === "edit" ? "已有默认" : "队列预处理"}图片识别
          </span>
          <small className="muted">默认使用当前项目的前 {Math.min(defaultImageUrls.length, 2)} 张图片。</small>
        </label>
      ) : null}

      <div className="ai-actions">
        <button
          ref={actionButtonRef}
          type="button"
          className="btn btn-primary"
          onClick={handleRecognize}
          disabled={isPending}
        >
          {isPending ? "识别中..." : mode === "edit" ? "识别并填充" : "识别并填入"}
        </button>
      </div>

      {message ? (
        <p className="muted" style={{ margin: "0.65rem 0 0" }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
