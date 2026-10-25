"use client";

import { UiElement, UiText } from "@/components/ui-text";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DisclosureIcon } from "@/components/disclosure-icon";
import { useLanguage } from "./language-provider";

type ShowcaseGroup = {
  name: string;
  count: number;
};

type ShowcaseGroupFilterProps = {
  groups: ShowcaseGroup[];
  activeGroup?: string;
  queryText?: string;
};

function buildGroupHref(group: string | undefined, queryText: string | undefined): string {
  const params = new URLSearchParams();

  if (group) {
    params.set("group", group);
  }

  if (queryText) {
    params.set("q", queryText);
  }

  const query = params.toString();
  return query ? `/showcase?${query}` : "/showcase";
}

export function ShowcaseGroupFilter({ groups, activeGroup, queryText }: ShowcaseGroupFilterProps) {
  const [expanded, setExpanded] = useState(false);
  const [collapsedLimit, setCollapsedLimit] = useState(1);
  const groupListId = useId();
  const groupRow = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const row = groupRow.current;
    if (!row) return;
    const observer = new ResizeObserver(([entry]) => {
      // Keep the collapsed selector to one row, including the All link.
      const columns = Math.max(1, Math.floor((entry.contentRect.width + 4) / 128));
      setCollapsedLimit(Math.max(1, columns - 1));
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  const visibleGroups = useMemo(() => {
    if (expanded) {
      return groups;
    }

    const active = activeGroup ? groups.find((group) => group.name === activeGroup) : undefined;
    const base = groups.slice(0, collapsedLimit);
    if (active && !base.some((group) => group.name === active.name)) {
      return [...base.slice(0, Math.max(base.length - 1, 0)), active];
    }

    return base;
  }, [activeGroup, collapsedLimit, expanded, groups]);

  return (
    <UiElement as="section" uiAttributes={["aria-label"]} className="showcase-groups" aria-label="收藏分组">
      <select className="showcase-group-select" aria-label={t("收藏分组")} value={activeGroup ?? ""} onChange={event => { window.location.assign(buildGroupHref(event.target.value || undefined, queryText)); }}>
        <option value="">{t("全部")}</option>
        {groups.map(group => <option key={group.name} value={group.name}>{group.name} · {group.count}</option>)}
      </select>
      <div ref={groupRow}
        id={groupListId}
        className={`showcase-group-row${expanded ? " is-expanded" : " is-collapsed"}`}
      >
        <Link href={buildGroupHref(undefined, queryText)} aria-current={!activeGroup ? "true" : undefined} className={`showcase-chip${!activeGroup ? " active" : ""}`}><UiText text={"全部"} /></Link>
        {visibleGroups.map((group) => (
          <Link
            key={group.name}
            href={buildGroupHref(group.name, queryText)}
            className={`showcase-chip${activeGroup === group.name ? " active" : ""}`}
            title={group.name}
            aria-current={activeGroup === group.name ? "true" : undefined}
          >
            <span className="showcase-chip-label">{group.name}</span>
            <span className="showcase-chip-count">{group.count}</span>
          </Link>
        ))}
      </div>
      {groups.length > collapsedLimit ? (
        <UiElement as="button" uiAttributes={["aria-label", "title"]}
          type="button"
          className="showcase-tool showcase-group-toggle"
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
          aria-controls={groupListId}
          aria-label={expanded ? "收起分组" : "展开全部分组"}
          title={expanded ? "收起分组" : "展开全部分组"}
        ><DisclosureIcon expanded={expanded} /></UiElement>
      ) : null}
    </UiElement>
  );
}
