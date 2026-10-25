"use client";
import { UiText, UiElement } from "./ui-text";
import { OptionalCardFields } from "./optional-card-fields";
import { pickCardField as pickValue, hasOptionalCardData } from "@/lib/card-form-display";
import type { CardFieldSource } from "@/lib/card-form-types";

export function CardGradingFields({ values, card, mode }: CardFieldSource & { mode: "create" | "edit" }) {
  return <OptionalCardFields title="评级信息（可选）" initialOpen={hasOptionalCardData(values, card, ["gradingCompany", "grade", "certNumber", "gradingLink"])}>
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

  </OptionalCardFields>;
}
