import { UiText } from "./ui-text";
import type { PortfolioFilterCriterion } from "@/lib/portfolio-analysis-types";
export function PortfolioCriterion({ item }: { item: PortfolioFilterCriterion }) {
  const translated = ["collectionStatus", "visibility", "isSerialNumbered", "isOneOfOne", "isRookie", "isAutograph", "isPatch", "isGraded"].includes(item.field);
  return <><UiText text={item.label} />: {translated ? <UiText text={item.value} /> : <span data-i18n-skip>{item.value}</span>}</>;
}
