"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { errorMessage } from "@/lib/feedback-messages";

type SuggestionValue = string | boolean;
type Suggestion = Record<string, SuggestionValue>;

type AiRecognitionPanelProps = {
  mode?: "create" | "edit";
  defaultImageUrls?: string[];
};

const fillableTextFields = [
  "playerName",
  "cardTitle",
  "sport",
  "team",
  "year",
  "brand",
  "productLine",
  "subsetName",
  "parallel",
  "cardNumber",
  "serialNumber",
  "serialRange",
  "gradingCompany",
  "grade",
  "certNumber",
  "publicDescription",
  "autoType",
  "patchType"
];

const clearableTextFields = [...fillableTextFields, "notes"];
const booleanFields = ["isRookie", "isAutograph", "isPatch"];

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    playerName: "球员姓名",
    cardTitle: "卡片名称",
    sport: "运动类型",
  team: "Team",
    year: "年份",
    brand: "品牌",
    productLine: "产品线",
    subsetName: "子系列",
    parallel: "平行版本",
    cardNumber: "卡号",
    serialNumber: "编号",
    serialRange: "编号范围",
    gradingCompany: "评级机构",
    grade: "评级",
    certNumber: "证书号",
    publicDescription: "展示描述",
    autoType: "签字类型",
    patchType: "Patch 类型",
    isRookie: "Rookie",
    isAutograph: "签名卡",
    isPatch: "Patch/Jersey"
  };

  return labels[field] ?? field;
}

function updateTextField(form: HTMLFormElement, field: string, value: string, overwrite: boolean): boolean {
  const element = form.elements.namedItem(field);
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
    return false;
  }

  if (!overwrite && element.value.trim()) {
    return false;
  }

  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function updateBooleanField(form: HTMLFormElement, field: string, value: boolean, overwrite: boolean): boolean {
  const element = form.elements.namedItem(field);
  if (!(element instanceof HTMLInputElement) || element.type !== "checkbox") {
    return false;
  }

  if (!overwrite && !value) {
    return false;
  }

  if (!overwrite && element.checked) {
    return false;
  }

  element.checked = value;
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function clearField(form: HTMLFormElement, field: string): void {
  const element = form.elements.namedItem(field);
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    element.value = "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function clearRecognizedFields(input: HTMLInputElement): void {
  const form = input.closest("form");
  if (!form) {
    return;
  }

  for (const field of clearableTextFields) {
    clearField(form, field);
  }

  for (const field of booleanFields) {
    const element = form.elements.namedItem(field);
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      element.checked = false;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

function applySuggestion(button: HTMLButtonElement, suggestion: Suggestion, overwrite: boolean): string[] {
  const form = button.closest("form");
  if (!form) {
    return [];
  }

  clearField(form, "notes");
  const applied: string[] = [];

  for (const field of fillableTextFields) {
    const value = suggestion[field];
    if (typeof value === "string" && value.trim() && updateTextField(form, field, value, overwrite)) {
      applied.push(fieldLabel(field));
    }
  }

  for (const field of booleanFields) {
    const value = suggestion[field];
    if (typeof value === "boolean" && updateBooleanField(form, field, value, overwrite)) {
      applied.push(fieldLabel(field));
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

export function AiRecognitionPanel({ mode = "create", defaultImageUrls = [] }: AiRecognitionPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [useExistingImages, setUseExistingImages] = useState(mode === "edit" && defaultImageUrls.length > 0);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      const data = (await response.json()) as { suggestion?: Suggestion; error?: string };

      if (!response.ok || !data.suggestion) {
        throw new Error(data.error || "AI 识别失败。");
      }

      const button = actionButtonRef.current;
      const applied = button ? applySuggestion(button, data.suggestion, overwrite) : [];
      setMessage(applied.length > 0 ? `已填入 ${applied.join("、")}。备注已保持为空。` : "AI 返回了建议，但当前表单没有可填入的空字段；备注已保持为空。");
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

      {mode === "edit" && defaultImageUrls.length > 0 ? (
        <label className="field ai-existing-image-option">
          <span>
            <input type="checkbox" checked={useExistingImages} onChange={(event) => setUseExistingImages(event.target.checked)} /> 使用已有默认图片识别
          </span>
          <small className="muted">默认使用当前卡片的前 {Math.min(defaultImageUrls.length, 2)} 张图片。</small>
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
