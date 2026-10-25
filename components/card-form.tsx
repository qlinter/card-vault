"use client";

import { cardCollectionStatuses, collectionStatusText } from "@/lib/card-domain";
import { UiText } from "@/components/ui-text";
import { useEffect, useRef } from "react";
import { AiRecognitionPanel } from "@/components/ai-recognition-panel";
import { CardImageFields } from "@/components/card-image-fields";
import { CardEntryDuplicatePanel } from "@/components/card-entry-duplicate-panel";
import { CardEntryFinancialRecords } from "@/components/card-entry-financial-records";
import { InvestmentInputs } from "@/components/investment-inputs";
import { defaultInitialQuantityForStatus } from "@/lib/card-quantity";
import { CardArchiveFields } from "./card-archive-fields";
import { CardGradingFields } from "./card-grading-fields";
import { CardDescriptionFields } from "./card-description-fields";
import type { CardFormProps } from "@/lib/card-form-types";
import { pickCardField as pickValue, revealCardField, hasOptionalCardData } from "@/lib/card-form-display";
import { OptionalCardFields } from "./optional-card-fields";
import { encodeReturnTo } from "@/lib/query-params";

const attributeFields = {
  isSerialNumbered: ["serialNumber", "serialRange"],
  isAutograph: ["autoType"],
  isPatch: ["patchType"]
} as const;

export function CardForm({
  mode,
  action,
  error,
  card,
  values,
  returnTo,
  formRef,
  draftId,
  draftImages,
  onSubmit,
  onInvalid,
  submitDisabled = false,
  queueItemId,
  queuedImages = [],
  queueRecognition
}: CardFormProps) {
  const defaultAiImageUrls = queuedImages.length > 0
    ? queuedImages.slice(0, 2).map((image) => image.url)
    : card?.images.slice(0, 2).map((image) => image.path) ?? [];
  const collectionStatus = pickValue(values?.collectionStatus, card?.collectionStatus ?? "holding");
  const statusFields = <div className="form-grid card-status-fields full">
    <label className="field">
      <span><UiText text="公开状态" /></span>
      <select name="visibility" defaultValue={pickValue(values?.visibility, card?.visibility ?? "private")}>
        <option value="private"><UiText text="私密" /></option>
        <option value="public"><UiText text="公开" /></option>
        <option value="linkOnly"><UiText text="仅链接可见" /></option>
      </select>
    </label>
    <label className="field">
      <span><UiText text="收藏状态" /></span>
      <select name="collectionStatus" defaultValue={collectionStatus}>
        {cardCollectionStatuses.map(status => <option key={status} value={status}><UiText text={collectionStatusText(status)} /></option>)}
      </select>
    </label>
  </div>;
  const numberedRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = numberedRef.current?.form;
    const sport = form?.elements.namedItem("sport");
    if (mode !== "create" || !(sport instanceof HTMLInputElement)) return;
    try {
      if (!draftId && !queueItemId && !sport.value) sport.value = window.localStorage.getItem("card-vault:last-entry-sport") || "";
    } catch { /* Entry remains available when browser preferences are unavailable. */ }
    const remember = () => { try { if (sport.value.trim()) window.localStorage.setItem("card-vault:last-entry-sport", sport.value.trim()); } catch { /* Optional preference. */ } };
    sport.addEventListener("change", remember);
    return () => sport.removeEventListener("change", remember);
  }, [mode, draftId, queueItemId]);

  useEffect(() => {
    const checkbox = numberedRef.current;
    const form = checkbox?.form;
    if (!checkbox || !form) return;
    function syncAttributes() {
      for (const [attribute, fields] of Object.entries(attributeFields)) {
        const hasValue = fields.some(name => {
          const field = form!.elements.namedItem(name);
          return field instanceof HTMLInputElement && Boolean(field.value.trim());
        });
        const option = form!.elements.namedItem(attribute);
        if (hasValue && option instanceof HTMLInputElement) option.checked = true;
      }
    }
    // AI fills the same uncontrolled fields and dispatches native events.
    syncAttributes();
    form.addEventListener("input", syncAttributes);
    form.addEventListener("change", syncAttributes);
    return () => {
      form.removeEventListener("input", syncAttributes);
      form.removeEventListener("change", syncAttributes);
    };
  }, [values, card]);

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} onInvalid={onInvalid} onInvalidCapture={event => { if (event.target instanceof HTMLElement) revealCardField(event.target); }} className={mode === "create" ? "panel card-entry-form" : "panel"} encType="multipart/form-data" data-card-entry-form={mode === "create" ? "true" : undefined}>
      {error ? <p className="note-error"><UiText text={error} /></p> : null}
      {mode === "edit" && returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {mode === "create" && draftId ? <input type="hidden" name="draftId" value={draftId} /> : null}
      {mode === "create" && queueItemId ? <input type="hidden" name="queueItemId" value={queueItemId} /> : null}

      <details className="entry-ai-tools" open={queueRecognition?.status === "review" || undefined}><summary><UiText text="AI 识图填充" /></summary><AiRecognitionPanel
        mode={mode}
        defaultImageUrls={defaultAiImageUrls}
        queueItemId={queueItemId}
        persistedRecognition={queueRecognition}
      /></details>

      {mode === "create" ? <CardEntryDuplicatePanel /> : null}

      <div className="form-grid">
        <CardImageFields
          mode={mode}
          cardTitle={pickValue(values?.cardTitle, card?.cardTitle ?? "")}
          existingImages={(card?.images ?? []).map((image) => ({
            id: image.id,
            url: image.path,
            rotation: image.rotation
          }))}
          queuedImages={queuedImages}
          draftImages={draftImages}
        />
        {mode === "create" ? (
          <div className="form-section-heading full"><div><h2><UiText text="卡片信息" /></h2></div></div>
        ) : null}
        <CardArchiveFields values={values} card={card} numberedRef={numberedRef} afterBasicFields={mode === "create" ? statusFields : undefined} />

        <CardGradingFields values={values} card={card} mode={mode} />

        {mode === "create" ? (
          <OptionalCardFields title="财务记录（可选）" initialOpen={hasOptionalCardData(values, undefined, ["purchaseDate", "purchaseSource", "purchasePrice", "gradingFee", "currentValue", "valuationDate"]) || Boolean(values?.financialRecords && values.financialRecords !== "[]") || Boolean(values?.initialQuantity && values.initialQuantity !== String(defaultInitialQuantityForStatus(collectionStatus)))}>

            <div className="form-grid card-finance-grid full">
              <label className="field">
                <span><UiText text={"购买日期"} /></span>
                <input name="purchaseDate" type="date" defaultValue={values?.purchaseDate ?? ""} />
              </label>

              <label className="field">
                <span><UiText text={"购买渠道"} /></span>
                <input name="purchaseSource" defaultValue={values?.purchaseSource ?? ""} />
              </label>

              <InvestmentInputs
                initialQuantity={values?.initialQuantity ?? String(defaultInitialQuantityForStatus(collectionStatus))}
                collectionStatus={collectionStatus}
                purchasePrice={values?.purchasePrice ?? ""}
                gradingFee={values?.gradingFee ?? ""}
                currentValue={values?.currentValue ?? ""}
                currency={values?.historyCurrency ?? "CNY"}
                valuationDate={values?.valuationDate ?? ""}
                valuationSource={values?.valuationSource ?? "个人估计"}
              />
            </div>
            <CardEntryFinancialRecords initialValue={values?.financialRecords} />
          </OptionalCardFields>
        ) : null}

        {mode === "edit" ? statusFields : null}

        <CardDescriptionFields values={values} card={card} mode={mode} />


      </div>

      <div className="card-form-actions">
        {mode === "create" ? (
          <>
            <button disabled={submitDisabled} type="submit" name="saveIntent" value="view" className="btn btn-primary" title="Ctrl + Shift + Enter"><UiText text={"保存并查看"} /></button>
            <button disabled={submitDisabled} type="submit" name="saveIntent" value="continue" className="btn btn-secondary" title="Ctrl + Enter"><UiText text={"保存并继续"} /></button>
          </>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={submitDisabled}><UiText text={"保存修改"} /></button>
        )}
        <a href={mode === "create" ? "/" : `/cards/${card?.id}${encodeReturnTo(returnTo)}`} className="btn btn-secondary"><UiText text={"取消"} /></a>
      </div>
    </form>
  );
}
