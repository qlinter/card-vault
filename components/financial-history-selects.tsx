import { supportedHistoryCurrencies, valuationSources } from "@/lib/financial-history";

const currencyLabels: Record<(typeof supportedHistoryCurrencies)[number], string> = {
  CNY: "CNY - 人民币",
  USD: "USD - 美元"
};

type SelectProps = {
  name: string;
  defaultValue?: string;
  required?: boolean;
};

export function HistoryCurrencySelect({ name, defaultValue = "CNY", required = false }: SelectProps) {
  return (
    <select name={name} defaultValue={defaultValue} required={required}>
      {supportedHistoryCurrencies.map((currency) => (
        <option value={currency} key={currency}>{currencyLabels[currency]}</option>
      ))}
    </select>
  );
}

export function ValuationSourceSelect({ name, defaultValue = "个人估计", required = false }: SelectProps) {
  return (
    <select name={name} defaultValue={defaultValue} required={required}>
      {valuationSources.map((source) => <option value={source} key={source}>{source}</option>)}
    </select>
  );
}
