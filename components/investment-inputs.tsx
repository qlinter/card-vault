"use client";

import { useEffect, useState } from "react";
import { HistoryCurrencySelect, ValuationSourceSelect } from "@/components/financial-history-selects";

type InvestmentInputsProps = {
  purchasePrice: string;
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
  purchasePrice,
  gradingFee,
  totalCost,
  currentValue,
  currency,
  valuationDate,
  valuationSource
}: InvestmentInputsProps) {
  const [purchasePriceValue, setPurchasePriceValue] = useState(purchasePrice);
  const [gradingFeeValue, setGradingFeeValue] = useState(gradingFee);
  const [totalCostValue, setTotalCostValue] = useState(totalCost);

  useEffect(() => {
    setTotalCostValue(formatMoneyInput(parseMoney(purchasePriceValue) + parseMoney(gradingFeeValue)));
  }, [purchasePriceValue, gradingFeeValue]);

  return (
    <>
      <label className="field">
        <span>币种</span>
        <HistoryCurrencySelect name="historyCurrency" defaultValue={currency || "CNY"} />
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

      <label className="field">
        <span>总投入</span>
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
