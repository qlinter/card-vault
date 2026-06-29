"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
    <section className="showcase-groups">
      <div className="showcase-section-head">
        <div>
          <h2>按球员浏览</h2>
          <p className="muted">共 {groups.length} 位球员或组合</p>
        </div>
        {groups.length > 8 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "收起球员列表" : "展开球员列表"}
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
