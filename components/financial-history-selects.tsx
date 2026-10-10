import { UiText } from "@/components/ui-text";
import type { SelectHTMLAttributes } from "react";
import { supportedHistoryCurrencies, valuationSources } from "@/lib/financial-history";
import { expenseKindLabels, valuationSourceLabel } from "@/lib/financial-history-presentation";

const currencyLabels: Record<(typeof supportedHistoryCurrencies)[number], string> = {
  CNY: "CNY - 人民币",
  USD: "USD - 美元"
};

type SelectProps = {
  name: string;
  defaultValue?: string;
  required?: boolean;
};

export function HistoryCurrencySelect({ name, defaultValue = "CNY", required = false, value, onChange, compact = false }: SelectProps & Pick<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & { compact?: boolean }) {
  return (
    <select name={name} defaultValue={value === undefined ? defaultValue : undefined} value={value} onChange={onChange} required={required}>
      {supportedHistoryCurrencies.map((currency) => (
        <option value={currency} key={currency}><UiText text={compact ? currency : currencyLabels[currency]} /></option>
      ))}
    </select>
  );
}

export function ValuationSourceSelect({ name, defaultValue = "个人估计", required = false }: SelectProps) {
  return (
    <select name={name} defaultValue={defaultValue} required={required}>
      {valuationSources.map((source) => <option value={source} key={source}><UiText text={valuationSourceLabel(source)} /></option>)}
    </select>
  );
}

export function ExpenseKindSelect({ name, defaultValue = "grading" }: SelectProps) {
  return <select name={name} defaultValue={defaultValue}>
    {Object.entries(expenseKindLabels).map(([value, label]) => (
      <option key={value} value={value}><UiText text={label} /></option>
    ))}
  </select>;
}
