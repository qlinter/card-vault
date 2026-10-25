"use client";
import type { ReactNode } from "react";
import { CollectionViewToggle, useCollectionView } from "./view-mode-toggle";
import { UiText } from "./ui-text";
export function ShowcaseViews({ heading, children, hasCards }: { heading: ReactNode; children: ReactNode; hasCards: boolean }) {
  const [view] = useCollectionView();
  return <section className={"showcase-grid-wrap showcase-views" + (view === "list" ? " is-list" : "")}><div className="showcase-section-head">{heading}<CollectionViewToggle /></div>
    {view === "list" && hasCards ? <div className="showcase-list-head" aria-hidden="true"><div className="showcase-list-head-fields"><span /><div><span><UiText text="版本" /></span><span><UiText text="评级" /></span><span><UiText text="限量编号" /></span></div></div></div> : null}
    {children}</section>;
}
