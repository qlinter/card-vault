"use client";
import { UiText } from "./ui-text";
import { OptionalCardFields } from "./optional-card-fields";
import { pickCardField as pickValue, hasOptionalCardData } from "@/lib/card-form-display";
import type { CardFieldSource } from "@/lib/card-form-types";
import { splitTagString, stringifyTags } from "@/lib/card-helpers";

export function CardDescriptionFields({ values, card, mode }: CardFieldSource & { mode: "create" | "edit" }) {
  const tags = splitTagString(card?.tags ?? null);
  return <OptionalCardFields title="标签与描述（可选）" initialOpen={hasOptionalCardData(values, card, ["tags", "publicDescription", "notes"])}>
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

        <label className="field full">
          <span><UiText text="标签（逗号分隔）" /></span>
          <input name="tags" placeholder="rookie, holo, psa" defaultValue={pickValue(values?.tags, stringifyTags(tags))} />
        </label>

  </OptionalCardFields>;
}
