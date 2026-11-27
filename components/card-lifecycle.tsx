"use client";

import { useState } from "react";
import { UiText } from "./ui-text";
import type { cardLifecycle } from "@/lib/card-lifecycle";

export function CardLifecycle({ events }: { events: ReturnType<typeof cardLifecycle> }) {
  const [expanded, setExpanded] = useState(false);
  const recent = events.filter(event => event.milestone).slice(0, 3);
  return <section className="card-lifecycle">
    <div className="card-lifecycle-head"><h3><UiText text="卡牌履历" /></h3>
      {events.length > recent.length && <button type="button" aria-expanded={expanded} aria-controls="card-lifecycle-events" className="btn btn-secondary btn-quiet" onClick={() => setExpanded(!expanded)}>
        <UiText text={expanded ? "收起" : "全部记录"} /></button>}
    </div>
    <ol id="card-lifecycle-events">{(expanded ? events : recent).map(event => <li key={event.key}>
      <time dateTime={event.day}>{event.day}</time><span><UiText text={event.title} />{event.quantity > 0 && <> · <UiText text="{0} 张" values={[event.quantity]} /></>}
      {event.note && <small>{event.note}</small>}</span>
    </li>)}</ol>
  </section>;
}
