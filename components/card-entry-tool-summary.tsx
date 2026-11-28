import { DisclosureIcon } from "./disclosure-icon";
import { UiElement, UiText } from "./ui-text";

type Props = { label: string; count: number; expanded: boolean; title?: string };

export function CardEntryToolSummary({ label, count, expanded, title }: Props) {
  return <UiElement as="summary" className="entry-tool-summary" uiAttributes={["title"]} title={title}>
    <span className="entry-tool-title"><UiText text={label} /></span>
    <span className="entry-tool-meta">
      <span className="entry-tool-count">{count}</span>
      <DisclosureIcon expanded={expanded} />
    </span>
  </UiElement>;
}
