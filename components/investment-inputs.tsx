"use client";

import { useEffect, useRef, useState } from "react";
import { ValuationSourceSelect } from "@/components/financial-history-selects";
import { useLanguage } from "./language-provider";
import { defaultInitialQuantityForStatus } from "@/lib/card-quantity";

type InvestmentInputsProps = {
  initialQuantity: string;
  collectionStatus: string;
  purchasePrice: string;
  secondaryPurchasePrice: string;
  gradingFee: string;
  totalCost: string;
  currentValue: string;
  currency: string;
  valuationDate: string;
  valuationSource: string;
};

function parseMoney(value: string): number {
  const normalized = value.replace(/[¥￥,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyInput(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return "";
  }

  return `${Math.round(value * 100) / 100}`;
}

export function InvestmentInputs({
  initialQuantity,
  collectionStatus,
  purchasePrice,
  secondaryPurchasePrice,
  gradingFee,
  totalCost,
  currentValue,
  currency,
  valuationDate,
  valuationSource
}: InvestmentInputsProps) {
  const { locale } = useLanguage();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  const [currencyValue, setCurrencyValue] = useState(currency || "CNY");
  const [initialQuantityValue, setInitialQuantityValue] = useState(
    initialQuantity || String(defaultInitialQuantityForStatus(collectionStatus))
  );
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const previousCollectionStatusRef = useRef(collectionStatus);
  const [purchasePriceValue, setPurchasePriceValue] = useState(purchasePrice);
  const [gradingFeeValue, setGradingFeeValue] = useState(gradingFee);
  const [totalCostValue, setTotalCostValue] = useState(totalCost);

  useEffect(() => {
    setTotalCostValue(formatMoneyInput(parseMoney(purchasePriceValue) + parseMoney(gradingFeeValue)));
  }, [purchasePriceValue, gradingFeeValue]);

  useEffect(() => {
    const form = quantityInputRef.current?.form;
    const statusField = form?.elements.namedItem("collectionStatus");
    if (!(statusField instanceof HTMLSelectElement)) return;

    previousCollectionStatusRef.current = statusField.value;
    const handleStatusChange = () => {
      const nextStatus = statusField.value;
      setInitialQuantityValue((currentValue) => {
        const previousDefault = String(defaultInitialQuantityForStatus(previousCollectionStatusRef.current));
        return currentValue === previousDefault
          ? String(defaultInitialQuantityForStatus(nextStatus))
          : currentValue;
      });
      previousCollectionStatusRef.current = nextStatus;
    };

    statusField.addEventListener("change", handleStatusChange);
    return () => statusField.removeEventListener("change", handleStatusChange);
  }, []);

  return (
    <>
      <label className="field">
        <span>币种</span>
        <select name="historyCurrency" value={currencyValue} onChange={(event) => setCurrencyValue(event.target.value)}><option value="CNY">CNY</option><option value="USD">USD</option></select>
      </label>

      <label className="field">
        <span>初始数量</span>
        <input
          ref={quantityInputRef}
          name="initialQuantity"
          type="number"
          min="0"
          step="1"
          value={initialQuantityValue}
          onChange={(event) => setInitialQuantityValue(event.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>购买价格</span>
        <input
          name="purchasePrice"
          type="text"
          inputMode="decimal"
          value={purchasePriceValue}
          onChange={(event) => setPurchasePriceValue(event.target.value)}
        />
      </label>

      <label className="field">
        <span>评级费用</span>
        <input
          name="gradingFee"
          type="text"
          inputMode="decimal"
          value={gradingFeeValue}
          onChange={(event) => setGradingFeeValue(event.target.value)}
        />
      </label>

      <label className="field" data-i18n-skip>
        <span>{text("另一币种购买金额（可选）", "Additional purchase payment (optional)")} · {currencyValue === "CNY" ? "USD" : "CNY"}</span>
        <input name="secondaryPurchasePrice" inputMode="decimal" defaultValue={secondaryPurchasePrice} />
        <small>{text("两项为同一次购入的付款组成，数量仅计算一次。全部留空表示成本未知；赠品请填 0。", "Both amounts belong to one purchase; quantity is counted once. Leave both blank for unknown cost; enter 0 for a gift.")}</small>
      </label>

      <label className="field">
        <span data-i18n-skip>{text("主币种投入小计", "Primary currency subtotal")} · {currencyValue}</span>
        <input name="totalCost" type="text" inputMode="decimal" value={totalCostValue} readOnly />
      </label>

      <label className="field">
        <span>初始估值</span>
        <input name="currentValue" type="text" inputMode="decimal" defaultValue={currentValue} />
      </label>

      <label className="field">
        <span>估值日期</span>
        <input name="valuationDate" type="date" defaultValue={valuationDate} />
      </label>

      <label className="field">
        <span>估值来源</span>
        <ValuationSourceSelect name="valuationSource" defaultValue={valuationSource || "个人估计"} />
      </label>
    </>
  );
}
