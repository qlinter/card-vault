"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DisclosureIcon } from "@/components/disclosure-icon";

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

  const visibleGroups = useMemo(() => {
    if (expanded) {
      return groups;
    }

    const active = activeGroup ? groups.find((group) => group.name === activeGroup) : undefined;
    const base = groups.slice(0, 8);
    if (active && !base.some((group) => group.name === active.name)) {
      return [...base.slice(0, Math.max(base.length - 1, 0)), active];
    }

    return base;
  }, [activeGroup, expanded, groups]);

  return (
    <section className="showcase-groups" aria-label="球员筛选">
      <div className="showcase-section-head">
        <p className="muted">共 {groups.length} 位球员或组合</p>
        {groups.length > 8 ? (
          <button
            type="button"
            className="btn btn-secondary disclosure-button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? "收起球员列表" : "展开球员列表"}
            title={expanded ? "收起球员列表" : "展开球员列表"}
          >
            <DisclosureIcon expanded={expanded} />
          </button>
        ) : null}
      </div>
      <div className={`showcase-group-row${expanded ? " is-expanded" : " is-collapsed"}`}>
        <Link href={buildGroupHref(undefined, queryText)} className={`showcase-chip${!activeGroup ? " active" : ""}`}>
          全部
        </Link>
        {visibleGroups.map((group) => (
          <Link
            key={group.name}
            href={buildGroupHref(group.name, queryText)}
            className={`showcase-chip${activeGroup === group.name ? " active" : ""}`}
          >
            {group.name} <span className="showcase-chip-count">{group.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
