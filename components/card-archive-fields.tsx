"use client";
import { UiText, UiElement } from "./ui-text";
import { OptionalCardFields } from "./optional-card-fields";
import { pickCardField as pickValue, hasOptionalCardData } from "@/lib/card-form-display";
import type { CardFieldSource } from "@/lib/card-form-types";
import type { Ref, ReactNode } from "react";
import { CardEntrySuggestions } from "./card-entry-suggestions";

export function CardArchiveFields({ values, card, numberedRef, afterBasicFields }: CardFieldSource & { numberedRef: Ref<HTMLInputElement>; afterBasicFields?: ReactNode }) {
  const hasSerial = Boolean(pickValue(values?.serialNumber, card?.serialNumber ?? "").trim() || pickValue(values?.serialRange, card?.serialRange ?? "").trim());
  return <>
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
          <UiElement as="input" uiAttributes={["placeholder"]} name="year" list="card-entry-year-options" type="text" placeholder="例如 2016-17" defaultValue={pickValue(values?.year, card?.year ?? "")} />
          <CardEntrySuggestions />
        </label>

        <label className="field">
          <span><UiText text={"品牌"} /></span>
          <UiElement as="input" uiAttributes={["placeholder"]} name="brand" list="card-entry-brand-options" placeholder="例如 Panini / Topps" defaultValue={pickValue(values?.brand, card?.brand ?? "")} />
        </label>

        <label className="field">
          <span><UiText text={"产品线"} /></span>
          <UiElement as="input" uiAttributes={["placeholder"]} name="productLine" list="card-entry-productLine-options" placeholder="例如 Prizm / Select / Immaculate" defaultValue={pickValue(values?.productLine, card?.productLine ?? "")} />
        </label>

    {afterBasicFields}
    <OptionalCardFields title="版本与卡片属性（可选）" initialOpen={hasOptionalCardData(values, card, ["subsetName", "parallel", "cardNumber", "serialNumber", "serialRange", "autoType", "patchType", "isSerialNumbered", "isAutograph", "isPatch", "isRookie"])}>
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

    </OptionalCardFields>
  </>;
}
