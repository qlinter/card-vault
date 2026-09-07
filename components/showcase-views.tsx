"use client";
import type { ReactNode } from "react";
import { CollectionViewToggle, useCollectionView } from "./view-mode-toggle";
export function ShowcaseViews({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  const [view] = useCollectionView();
  return <section className={"showcase-grid-wrap showcase-views" + (view === "list" ? " is-list" : "")}><div className="showcase-section-head">{heading}<CollectionViewToggle compact /></div>{children}</section>;
}
