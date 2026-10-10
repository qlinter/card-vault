"use client";

import { UiText } from "@/components/ui-text";
import type { MouseEvent } from "react";
import { NAVIGATION_STATE_KEY, NAVIGATION_TRAIL_KEY, previousNavigation, type NavigationTrail } from "@/lib/navigation-history";

type BackButtonProps = {
  href: string;
  className?: string;
};

export function BackButton({ href, className = "btn btn-secondary" }: BackButtonProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const opensCurrentPage =
      event.button === 0 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey;

    if (!event.defaultPrevented && opensCurrentPage && window.history.length > 1) {
      event.preventDefault();
      try {
        const trail = JSON.parse(sessionStorage.getItem(NAVIGATION_TRAIL_KEY) ?? "null") as NavigationTrail | null;
        if (trail && trail.visits?.[trail.current]?.key === window.history.state?.[NAVIGATION_STATE_KEY]) {
          const previous = previousNavigation(trail, window.location.href, window.location.origin);
          if (previous) { window.history.go(previous.delta); return; }
        }
      } catch { /* Use the explicit return context if browser storage is unavailable. */ }
      // The app intentionally sends no referrer. Without a readable trail,
      // the explicit return context is the reliable way to avoid editing pages.
      window.location.assign(href);
    }
  }

  return (
    <a href={href} className={className} onClick={handleClick}><UiText text={"返回上一页"} /></a>
  );
}
