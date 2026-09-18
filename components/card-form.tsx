"use client";

import { UiText, UiElement } from "@/components/ui-text";
import { Card, CardImage } from "@prisma/client";
import { useEffect, useRef, type FormEventHandler, type Ref } from "react";
import { AiRecognitionPanel } from "@/components/ai-recognition-panel";
import { CardImageFields } from "@/components/card-image-fields";
import { CardEntryDuplicatePanel } from "@/components/card-entry-duplicate-panel";
import { CardEntryTemplatePanel } from "@/components/card-entry-template-panel";
import { CardEntryFinancialRecords } from "@/components/card-entry-financial-records";
import { InvestmentInputs } from "@/components/investment-inputs";
import { splitTagString, stringifyTags } from "@/lib/card-helpers";
import { CardFormValues } from "@/lib/card-form-values";
import { defaultInitialQuantityForStatus } from "@/lib/card-quantity";
import { normalizeImagePath } from "@/lib/image-path";
import { encodeReturnTo } from "@/lib/query-params";
import type { CardEntryRecognitionSummary } from "@/lib/card-entry-queue-domain";

type QueuedCardImage = {
  id: string;
  url: string;
  side: "front" | "back";
  originalName: string;
};

type CardFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  card?: Card & { images: CardImage[] };
  values?: CardFormValues;
  returnTo?: string;
  formRef?: Ref<HTMLFormElement>;
  draftId?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  onInvalid?: FormEventHandler<HTMLFormElement>;
  submitDisabled?: boolean;
  queueItemId?: string;
  queuedImages?: QueuedCardImage[];
  queueRecognition?: CardEntryRecognitionSummary;
};

function pickValue(value: string | undefined, fallback: string): string {
  return value ?? fallback;
}

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
  onSubmit,
  onInvalid,
  submitDisabled = false,
  queueItemId,
  queuedImages = [],
  queueRecognition
}: CardFormProps) {
  const tags = splitTagString(card?.tags ?? null);
  const defaultAiImageUrls = queuedImages.length > 0
    ? queuedImages.slice(0, 2).map((image) => image.url)
    : card?.images.slice(0, 2).map((image) => normalizeImagePath(image.path)) ?? [];
  const collectionStatus = pickValue(values?.collectionStatus, card?.collectionStatus ?? "holding");
  const numberedRef = useRef<HTMLInputElement>(null);
  const hasSerial = Boolean(pickValue(values?.serialNumber, card?.serialNumber ?? "").trim() || pickValue(values?.serialRange, card?.serialRange ?? "").trim());

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
    <form ref={formRef} action={action} onSubmit={onSubmit} onInvalid={onInvalid} className={mode === "create" ? "panel card-entry-form" : "panel"} encType="multipart/form-data" data-card-entry-form={mode === "create" ? "true" : undefined}>
      {error ? <p className="note-error"><UiText text={error} /></p> : null}
      {mode === "edit" && returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {mode === "create" && draftId ? <input type="hidden" name="draftId" value={draftId} /> : null}
      {mode === "create" && queueItemId ? <input type="hidden" name="queueItemId" value={queueItemId} /> : null}

      {mode === "create" ? <CardEntryTemplatePanel /> : null}

      <AiRecognitionPanel
        mode={mode}
        defaultImageUrls={defaultAiImageUrls}
        queueItemId={queueItemId}
        persistedRecognition={queueRecognition}
      />

      {mode === "create" ? <CardEntryDuplicatePanel /> : null}

      <div className="form-grid">
        {mode === "create" ? (
          <div className="form-section-heading full"><div><h2><UiText text="卡片信息" /></h2></div></div>
        ) : null}
        <label className="field card-field-wide">
          <span><UiText text={"卡片主体 *"} /></span>
          <input name="playerName" required defaultValue={pickValue(values?.playerName, card?.playerName ?? "")} />
        </label>

        <label className="field card-field-wide">
          <span><UiText text={"卡片名称 *"} /></span>
          <input name="cardTitle" required defaultValue={pickValue(values?.cardTitle, card?.cardTitle ?? "")} />
        </label>

        <label className="field">
          <span><UiText text={"运动类型 *"} /></span>
          <UiElement as="input" uiAttributes={["placeholder"]}
            name="sport"
            required
            placeholder="篮球 / 足球 / 棒球"
            defaultValue={pickValue(values?.sport, card?.sport ?? "")}
          />
        </label>

        <label className="field">
          <span>Team</span>
          <input name="team" defaultValue={pickValue(values?.team, card?.team ?? "")} />
        </label>

        <label className="field">
          <span><UiText text={"年份"} /></span>
          <UiElement as="input" uiAttributes={["placeholder"]} name="year" type="text" placeholder="例如 2016-17" defaultValue={pickValue(values?.year, card?.year ?? "")} />
        </label>

        <label className="field">
          <span><UiText text={"品牌"} /></span>
          <UiElement as="input" uiAttributes={["placeholder"]} name="brand" placeholder="例如 Panini / Topps" defaultValue={pickValue(values?.brand, card?.brand ?? "")} />
        </label>

        <label className="field">
          <span><UiText text={"产品线"} /></span>
          <UiElement as="input" uiAttributes={["placeholder"]} name="productLine" placeholder="例如 Prizm / Select / Immaculate" defaultValue={pickValue(values?.productLine, card?.productLine ?? "")} />
        </label>

        <label className="field">
          <span><UiText text={"子系列"} /></span>
          <input name="subsetName" defaultValue={pickValue(values?.subsetName, card?.subsetName ?? "")} />
        </label>

        <label className="field">
          <span><UiText text={"平行版本"} /></span>
          <UiElement as="input" uiAttributes={["placeholder"]} name="parallel" placeholder="例如 Gold / Mojo / Refractor" defaultValue={pickValue(values?.parallel, card?.parallel ?? "")} />
        </label>

        <label className="field">
          <span><UiText text={"卡号"} /></span>
          <input name="cardNumber" defaultValue={pickValue(values?.cardNumber, card?.cardNumber ?? "")} />
        </label>

        <label className="field card-field-wide">
          <span><UiText text={"编号"} /></span>
          <input name="serialNumber" defaultValue={pickValue(values?.serialNumber, card?.serialNumber ?? "")} />
        </label>

        <label className="field card-field-wide">
          <span><UiText text={"编号范围"} /></span>
          <UiElement as="input" uiAttributes={["placeholder"]} name="serialRange" placeholder="例如 /99" defaultValue={pickValue(values?.serialRange, card?.serialRange ?? "")} />
        </label>

        <label className="field card-field-wide">
          <span><UiText text={"签字类型"} /></span>
          <input name="autoType" defaultValue={pickValue(values?.autoType, card?.autoType ?? "")} />
        </label>

        <label className="field card-field-wide">
          <span><UiText text={"Patch 类型"} /></span>
          <input name="patchType" defaultValue={pickValue(values?.patchType, card?.patchType ?? "")} />
        </label>

        <div className="card-attribute-options full">
        <label className="field card-numbered-option">
          <span>
            <input
              ref={numberedRef}
              name="isSerialNumbered"
              type="checkbox"
              defaultChecked={hasSerial || (values?.isSerialNumbered ?? card?.isSerialNumbered ?? false)}
            />{" "}<UiText text={"限量编号卡"} /></span>
        </label>
          <label className="field">
            <span>
              <input name="isAutograph" type="checkbox" defaultChecked={Boolean(pickValue(values?.autoType, card?.autoType ?? "").trim()) || (values?.isAutograph ?? card?.isAutograph ?? false)} /><UiText text={"是否签名卡"} /></span>
          </label>
          <label className="field">
            <span><input name="isPatch" type="checkbox" defaultChecked={Boolean(pickValue(values?.patchType, card?.patchType ?? "").trim()) || (values?.isPatch ?? card?.isPatch ?? false)} /><UiText text={"是否 Patch/Jersey"} /></span>
          </label>
          <label className="field">
            <span><input name="isRookie" type="checkbox" defaultChecked={values?.isRookie ?? card?.isRookie ?? false} /><UiText text={"是否 Rookie"} /></span>
          </label>
        </div>

        {mode === "create" ? (
          <div className="form-section-heading full"><div><h2><UiText text="评级信息" /></h2></div></div>
        ) : null}
        <label className="field">
          <span><UiText text={"评级机构"} /></span>
          <input name="gradingCompany" defaultValue={pickValue(values?.gradingCompany, card?.gradingCompany ?? "")} />
        </label>

        <label className="field">
          <span><UiText text={"评级"} /></span>
          <UiElement as="input" uiAttributes={["placeholder"]}
            name="grade"
            type="text"
            placeholder="例如 9.5 / Auto Auth / Authentic"
            defaultValue={pickValue(values?.grade, card?.grade ?? "")}
          />
        </label>

        <label className="field">
          <span><UiText text={"证书号"} /></span>
          <input name="certNumber" defaultValue={pickValue(values?.certNumber, card?.certNumber ?? "")} />
        </label>

        <label className={mode === "create" ? "field" : "field full"}>
          <span><UiText text={"评级链接"} /></span>
          <input
            name="gradingLink"
            type="url"
            placeholder="https://www.psacard.com/..."
            defaultValue={pickValue(values?.gradingLink, card?.gradingLink ?? "")}
          />
        </label>

        {mode === "create" ? (
          <section className="card-finance-fields full">
            <div className="form-section-heading full">
              <div>
                <h2><UiText text={"财务记录"} /></h2>
              </div>
            </div>

            <div className="form-grid card-finance-grid">
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
                secondaryPurchasePrice={values?.secondaryPurchasePrice ?? ""}
                gradingFee={values?.gradingFee ?? ""}
                totalCost={values?.totalCost ?? ""}
                currentValue={values?.currentValue ?? ""}
                currency={values?.historyCurrency ?? "CNY"}
                valuationDate={values?.valuationDate ?? ""}
                valuationSource={values?.valuationSource ?? "个人估计"}
              />
            </div>
            <CardEntryFinancialRecords initialValue={values?.financialRecords} />
          </section>
        ) : (
          <div className="history-edit-notice full">
            <strong><UiText text={"财务记录已从卡片资料中分离"} /></strong>
            <span><UiText text={"购买、费用和估值请在卡片详情页的“财务历史”中新增或编辑，保存本页不会改写历史记录。"} /></span>
            <a href={`/cards/${card?.id}#financial-history`}><UiText text={"前往财务历史"} /></a>
          </div>
        )}

        <label className="field">
          <span><UiText text={"公开状态"} /></span>
          <select name="visibility" defaultValue={pickValue(values?.visibility, card?.visibility ?? "private")}>
            <option value="private"><UiText text={"私密"} /></option>
            <option value="public"><UiText text={"公开"} /></option>
            <option value="linkOnly"><UiText text={"仅链接可见"} /></option>
          </select>
        </label>

        <label className="field">
          <span><UiText text={"收藏状态"} /></span>
          <select name="collectionStatus" defaultValue={collectionStatus}>
            <option value="holding"><UiText text={"持有中"} /></option>
            <option value="listed"><UiText text={"在售"} /></option>
            <option value="sold"><UiText text={"已售出"} /></option>
            <option value="grading"><UiText text={"送评中"} /></option>
            <option value="target"><UiText text={"目标卡"} /></option>
          </select>
        </label>

        <label className={mode === "create" ? "field card-field-wide" : "field full"}>
          <span><UiText text={"标签（逗号分隔）"} /></span>
          <input name="tags" placeholder="rookie, holo, psa" defaultValue={pickValue(values?.tags, stringifyTags(tags))} />
        </label>

        <label className={mode === "create" ? "field card-field-wide" : "field full"}>
          <span><UiText text={"展示描述"} /></span>
          <textarea
            name="publicDescription"
            defaultValue={pickValue(values?.publicDescription, card?.publicDescription ?? "")}
          />
        </label>

        <label className={mode === "create" ? "field card-field-wide" : "field full"}>
          <span><UiText text={"备注"} /></span>
          <textarea name="notes" defaultValue={pickValue(values?.notes, card?.notes ?? "")} />
        </label>

        <CardImageFields
          mode={mode}
          cardTitle={pickValue(values?.cardTitle, card?.cardTitle ?? "")}
          existingImages={(card?.images ?? []).map((image) => ({
            id: image.id,
            url: normalizeImagePath(image.path),
            rotation: image.rotation
          }))}
          queuedImages={queuedImages}
        />
      </div>

      <div className="card-form-actions">
        {mode === "create" ? (
          <>
            <button disabled={submitDisabled} type="submit" name="saveIntent" value="view" className="btn btn-primary" title="Ctrl + Shift + Enter"><UiText text={"保存并查看"} /></button>
            <button disabled={submitDisabled} type="submit" name="saveIntent" value="continue" className="btn btn-secondary" title="Ctrl + Enter"><UiText text={"保存并继续"} /></button>
          </>
        ) : (
          <button type="submit" className="btn btn-primary"><UiText text={"保存修改"} /></button>
        )}
        <a href={mode === "create" ? "/" : `/cards/${card?.id}${encodeReturnTo(returnTo)}`} className="btn btn-secondary"><UiText text={"取消"} /></a>
      </div>
    </form>
  );
}
