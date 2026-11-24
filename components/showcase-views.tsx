"use client";
import type { ReactNode } from "react";
import { CollectionViewToggle, useCollectionView } from "./view-mode-toggle";
import { showcaseCaptionFields } from "@/lib/showcase-presentation";
import { UiText } from "./ui-text";
export function ShowcaseViews({ heading, children, hasCards, sourceSwitch }: { sourceSwitch: ReactNode; heading: ReactNode; children: ReactNode; hasCards: boolean }) {
  const [view] = useCollectionView();
  return <section className={"showcase-grid-wrap showcase-views" + (view === "list" ? " is-list" : "")}><div className="showcase-section-head">{heading}<div className="showcase-display-tools">{sourceSwitch}<CollectionViewToggle /></div></div>
    {view === "list" && hasCards ? <div className="showcase-list-head" aria-hidden="true"><div className="showcase-list-head-fields"><span /><div>{showcaseCaptionFields.map(field => <span key={field.key}><UiText text={field.label} /></span>)}</div></div></div> : null}
    {children}</section>;
}
